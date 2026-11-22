#!/usr/bin/env python3
"""
Pre-generate studio-quality Gemini TTS voiceovers for Wild World Map.

Generates compressed .m4a audio clips in public/audio/ so the website plays
pre-recorded narration directly on click with ZERO runtime API calls.

Usage:
  export GEMINI_API_KEY="your-key-here"
  python3 scripts/generate_voiceovers.py

Options:
  --voice Sulafat   Gemini prebuilt voice (default: Sulafat; also great: Aoede, Leda, Puck, Kore)
  --workers 3       Parallel API requests (default: 3)
  --force           Regenerate existing audio files
  --limit N         Only generate N missing items (useful for testing)
"""

from __future__ import annotations

import argparse
import base64
import concurrent.futures
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import wave
from pathlib import Path

from google import genai
from google.genai import types

ROOT = Path(__file__).resolve().parent.parent
PUBLIC_AUDIO_DIR = ROOT / "public" / "audio"
PLACES_DIR = PUBLIC_AUDIO_DIR / "places"
ANIMALS_DIR = PUBLIC_AUDIO_DIR / "animals"
MANIFEST_PATH = PUBLIC_AUDIO_DIR / "manifest.json"

DEFAULT_MODEL = "gemini-2.5-flash-preview-tts"
DEFAULT_VOICE = "Sulafat"

STYLE_PROMPT = (
    "Read the following narration aloud in a warm, cheerful, gentle, slow "
    "storybook narrator voice for a curious five-year-old child. Speak clearly, "
    "pause naturally between sentences and fun facts, and make any animal sounds "
    "playful and expressive. Do not add any extra commentary—only read the text:\n\n"
)


def load_api_key() -> str:
    key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if key:
        return key.strip()

    for env_file in (ROOT / ".env.local", ROOT / ".env"):
        if env_file.exists():
            for line in env_file.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                if k.strip() in ("GEMINI_API_KEY", "GOOGLE_API_KEY"):
                    val = v.strip().strip('"').strip("'")
                    if val:
                        return val

    print(
        "Error: GEMINI_API_KEY is not set.\n"
        "Set it via `export GEMINI_API_KEY=...` or put `GEMINI_API_KEY=...` in wild-world-map/.env.local",
        file=sys.stderr,
    )
    sys.exit(1)


def load_places_from_ts() -> list[dict]:
    """Use Vite's bundled esbuild + node to read src/data/places.ts cleanly."""
    esbuild_bin = ROOT / "node_modules" / ".bin" / "esbuild"
    if not esbuild_bin.exists():
        raise RuntimeError(f"esbuild not found at {esbuild_bin}. Run `npm install` first.")

    with tempfile.NamedTemporaryFile(suffix=".mjs", delete=False) as tmp:
        bundle_path = Path(tmp.name)

    try:
        subprocess.run(
            [
                str(esbuild_bin),
                str(ROOT / "src" / "data" / "places.ts"),
                "--bundle",
                "--format=esm",
                f"--outfile={bundle_path}",
            ],
            check=True,
            capture_output=True,
            text=True,
        )
        result = subprocess.run(
            [
                "node",
                "-e",
                f"import('{bundle_path.as_uri()}').then(m => console.log(JSON.stringify(m.WORLD_PLACES)))",
            ],
            check=True,
            capture_output=True,
            text=True,
        )
        return json.loads(result.stdout)
    finally:
        bundle_path.unlink(missing_ok=True)


def build_place_script(place: dict) -> str:
    return f"Welcome to {place['name']}, in {place['subtitle']}! {place['intro']}"


def build_animal_script(animal: dict) -> str:
    parts = [
        f"Meet the {animal['name']}!",
        f"It is a {animal['group'].lower()} that lives in {animal['habitat']}.",
        f"How big is it? {animal['sizeComparison']}",
        f"Listen for its sound: {animal['soundText']}",
    ]
    for idx, fact in enumerate(animal["facts"], start=1):
        parts.append(f"Fun fact number {idx}: {fact}")
    return " ".join(parts)


B64_RE = re.compile(rb"^[A-Za-z0-9+/=\r\n]+$")


def decode_pcm_bytes(raw: bytes | str) -> bytes:
    """Handle both raw PCM bytes (newer google-genai) and base64-encoded PCM bytes (older google-genai)."""
    if isinstance(raw, str):
        return base64.b64decode(raw)
    if len(raw) >= 16 and len(raw) % 4 == 0 and B64_RE.match(raw[:256]):
        try:
            decoded = base64.b64decode(raw, validate=True)
            if len(decoded) > 0 and len(decoded) % 2 == 0:
                return decoded
        except Exception:
            pass
    return raw


def pcm_to_m4a(pcm_bytes: bytes, out_path: Path, sample_rate: int = 24000) -> None:
    pcm_bytes = decode_pcm_bytes(pcm_bytes)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        wav_path = Path(tmp.name)

    try:
        with wave.open(str(wav_path), "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(sample_rate)
            wf.writeframes(pcm_bytes)

        if Path("/usr/bin/afconvert").exists():
            subprocess.run(
                [
                    "/usr/bin/afconvert",
                    "-f",
                    "m4af",
                    "-d",
                    "aac",
                    "-b",
                    "48000",
                    str(wav_path),
                    str(out_path),
                ],
                check=True,
                capture_output=True,
            )
        elif shutil.which("ffmpeg"):
            subprocess.run(
                [
                    "ffmpeg",
                    "-y",
                    "-i",
                    str(wav_path),
                    "-c:a",
                    "aac",
                    "-b:a",
                    "48k",
                    str(out_path),
                ],
                check=True,
                capture_output=True,
            )
        else:
            raise RuntimeError("Neither /usr/bin/afconvert nor ffmpeg was found to encode audio.")
    finally:
        wav_path.unlink(missing_ok=True)


def generate_one(
    client: genai.Client,
    model: str,
    voice: str,
    kind: str,
    item_id: str,
    text: str,
    out_path: Path,
    max_retries: int = 5,
) -> tuple[str, str, int]:
    prompt = f"{STYLE_PROMPT}{text}"

    for attempt in range(1, max_retries + 1):
        try:
            response = client.models.generate_content(
                model=model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_modalities=["AUDIO"],
                    speech_config=types.SpeechConfig(
                        voice_config=types.VoiceConfig(
                            prebuilt_voice_config=types.PrebuiltVoiceConfig(
                                voice_name=voice,
                            )
                        )
                    ),
                ),
            )

            pcm_bytes = None
            for cand in response.candidates or []:
                for part in cand.content.parts or []:
                    if part.inline_data and part.inline_data.data:
                        pcm_bytes = part.inline_data.data
                        break
                if pcm_bytes:
                    break

            if not pcm_bytes:
                raise RuntimeError("Empty audio response from Gemini TTS")

            pcm_to_m4a(pcm_bytes, out_path)
            return kind, item_id, out_path.stat().st_size
        except Exception as exc:
            msg = str(exc)
            if "exceeded your current quota" in msg.lower() or "perday" in msg.lower():
                raise RuntimeError(f"Daily quota reached on {kind}/{item_id}: {msg[:140]}") from exc
            if attempt == max_retries:
                raise RuntimeError(f"Failed {kind}/{item_id} after {max_retries} attempts: {msg}") from exc
            sleep_sec = min(4 * (2 ** (attempt - 1)), 45)
            print(f"  [retry {attempt}/{max_retries}] {kind}/{item_id}: {msg[:100]} -> waiting {sleep_sec}s", flush=True)
            time.sleep(sleep_sec)

    raise RuntimeError(f"Unreachable retry loop end for {kind}/{item_id}")


def write_manifest(places: list[dict], model: str, voice: str) -> None:
    places_map = {}
    animals_map = {}

    for p in places:
        pf = PLACES_DIR / f"{p['id']}.m4a"
        if pf.exists() and pf.stat().st_size > 0:
            places_map[p["id"]] = f"audio/places/{p['id']}.m4a"
        for a in p["animals"]:
            af = ANIMALS_DIR / f"{a['id']}.m4a"
            if af.exists() and af.stat().st_size > 0:
                animals_map[a["id"]] = f"audio/animals/{a['id']}.m4a"

    PUBLIC_AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    manifest = {
        "model": model,
        "voice": voice,
        "places": places_map,
        "animals": animals_map,
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(
        f"Updated {MANIFEST_PATH.relative_to(ROOT)}: "
        f"{len(places_map)} places, {len(animals_map)} animals."
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate Gemini TTS voiceovers for Wild World Map")
    parser.add_argument("--model", default=DEFAULT_MODEL, help=f"TTS model (default: {DEFAULT_MODEL})")
    parser.add_argument("--voice", default=DEFAULT_VOICE, help=f"Voice name (default: {DEFAULT_VOICE})")
    parser.add_argument("--workers", type=int, default=2, help="Parallel workers (default: 2)")
    parser.add_argument("--force", action="store_true", help="Overwrite existing audio files")
    parser.add_argument("--limit", type=int, default=0, help="Only generate up to N missing files")
    args = parser.parse_args()

    api_key = load_api_key()
    places = load_places_from_ts()

    tasks: list[tuple[str, str, str, Path]] = []
    for place in places:
        p_out = PLACES_DIR / f"{place['id']}.m4a"
        if args.force or not p_out.exists() or p_out.stat().st_size == 0:
            tasks.append(("place", place["id"], build_place_script(place), p_out))

        for animal in place["animals"]:
            a_out = ANIMALS_DIR / f"{animal['id']}.m4a"
            if args.force or not a_out.exists() or a_out.stat().st_size == 0:
                tasks.append(("animal", animal["id"], build_animal_script(animal), a_out))

    if args.limit > 0:
        tasks = tasks[: args.limit]

    total_items = len(places) + sum(len(p["animals"]) for p in places)
    print(
        f"Loaded {len(places)} places & {total_items - len(places)} animals. "
        f"To generate: {len(tasks)} clips using {args.model} (voice={args.voice}).",
        flush=True,
    )

    if not tasks:
        write_manifest(places, args.model, args.voice)
        print("All voiceovers are already generated!")
        return

    client = genai.Client(api_key=api_key)
    completed = 0
    failures: list[str] = []

    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {
            pool.submit(
                generate_one, client, args.model, args.voice, kind, item_id, text, out_path
            ): (kind, item_id)
            for kind, item_id, text, out_path in tasks
        }

        for future in concurrent.futures.as_completed(futures):
            kind, item_id = futures[future]
            try:
                _, _, size_bytes = future.result()
                completed += 1
                print(
                    f"  [{completed}/{len(tasks)}] ✓ {kind}/{item_id}.m4a ({size_bytes / 1024:.1f} KB)",
                    flush=True,
                )
                if completed % 10 == 0:
                    write_manifest(places, args.model, args.voice)
            except Exception as exc:
                failures.append(f"{kind}/{item_id}: {exc}")
                print(f"  ✗ {kind}/{item_id}: {exc}", file=sys.stderr, flush=True)

    write_manifest(places, args.model, args.voice)

    if failures:
        print(f"\nCompleted with {len(failures)} failures:", file=sys.stderr)
        for f in failures:
            print(f"  - {f}", file=sys.stderr)
        sys.exit(1)

    print("\nAll voiceovers generated successfully!")


if __name__ == "__main__":
    main()
