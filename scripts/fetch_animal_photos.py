#!/usr/bin/env python3
"""
Download and optimize real wildlife photos for all 100 animals in Wild World Map
from Wikipedia/Wikimedia Commons into public/images/animals/<animalId>.jpg.

Bundling verified photos directly into public/images/ guarantees:
- Instant loading with zero broken images or hotlink/CORS issues
- Full compatibility inside Google Sites iframes
"""

from __future__ import annotations

import concurrent.futures
import json
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
IMAGES_DIR = ROOT / "public" / "images" / "animals"
MANIFEST_PATH = ROOT / "public" / "images" / "manifest.json"
USER_AGENT = "WildWorldMapExplorer/1.0 (https://github.com/gpop4/wild-world-map; educational kids app)"


def load_places_from_ts() -> list[dict]:
    esbuild_bin = ROOT / "node_modules" / ".bin" / "esbuild"
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
        res = subprocess.run(
            [
                "node",
                "-e",
                f"import('{bundle_path.as_uri()}').then(m => console.log(JSON.stringify(m.WORLD_PLACES)))",
            ],
            check=True,
            capture_output=True,
            text=True,
        )
        return json.loads(res.stdout)
    finally:
        bundle_path.unlink(missing_ok=True)


def http_get(url: str, timeout: int = 20) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def fetch_summary_image_url(wiki_title: str) -> str | None:
    # Request high-res thumbnail via MediaWiki pageimages API (pithumbsize=800)
    unquoted = urllib.parse.unquote(wiki_title)
    params = urllib.parse.urlencode(
        {
            "action": "query",
            "titles": unquoted,
            "prop": "pageimages",
            "format": "json",
            "pithumbsize": "800",
            "redirects": "1",
        }
    )
    api_url = f"https://en.wikipedia.org/w/api.php?{params}"
    data = json.loads(http_get(api_url).decode("utf-8"))
    pages = data.get("query", {}).get("pages", {})
    for page in pages.values():
        thumb = page.get("thumbnail", {}).get("source")
        if thumb:
            return thumb

    # Fallback to REST summary
    rest_url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{wiki_title}"
    summary = json.loads(http_get(rest_url).decode("utf-8"))
    return summary.get("thumbnail", {}).get("source") or summary.get("originalimage", {}).get("source")


def fetch_one(animal: dict) -> tuple[str, bool, str]:
    animal_id = animal["id"]
    out_path = IMAGES_DIR / f"{animal_id}.jpg"
    if out_path.exists() and out_path.stat().st_size > 2000:
        return animal_id, True, "cached"

    for attempt in range(1, 4):
        try:
            img_url = fetch_summary_image_url(animal["wikiTitle"])
            if not img_url:
                return animal_id, False, f"No image found for {animal['wikiTitle']}"

            raw = http_get(img_url, timeout=25)
            with tempfile.NamedTemporaryFile(suffix=".img", delete=False) as tmp:
                tmp_path = Path(tmp.name)
                tmp_path.write_bytes(raw)

            try:
                IMAGES_DIR.mkdir(parents=True, exist_ok=True)
                # Convert to clean JPEG <= 720px on longest side, quality 78% via macOS sips
                subprocess.run(
                    [
                        "/usr/bin/sips",
                        "-s",
                        "format",
                        "jpeg",
                        "-s",
                        "formatOptions",
                        "78",
                        "-Z",
                        "720",
                        str(tmp_path),
                        "--out",
                        str(out_path),
                    ],
                    check=True,
                    capture_output=True,
                )
            finally:
                tmp_path.unlink(missing_ok=True)

            return animal_id, True, f"{out_path.stat().st_size / 1024:.1f} KB"
        except Exception as exc:
            if attempt == 3:
                return animal_id, False, str(exc)
            time.sleep(2 * attempt)

    return animal_id, False, "unknown"


def main() -> None:
    places = load_places_from_ts()
    animals: list[dict] = []
    seen = set()
    for p in places:
        for a in p["animals"]:
            if a["id"] not in seen:
                seen.add(a["id"])
                animals.append(a)

    print(f"Fetching photos for {len(animals)} animals...", flush=True)
    ok_map: dict[str, str] = {}
    failures: list[tuple[str, str]] = []

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        futures = [pool.submit(fetch_one, a) for a in animals]
        for idx, fut in enumerate(concurrent.futures.as_completed(futures), start=1):
            aid, ok, info = fut.result()
            if ok:
                ok_map[aid] = f"images/animals/{aid}.jpg"
                print(f"  [{idx}/{len(animals)}] ✓ {aid}.jpg ({info})", flush=True)
            else:
                failures.append((aid, info))
                print(f"  [{idx}/{len(animals)}] ✗ {aid}: {info}", file=sys.stderr, flush=True)

    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST_PATH.write_text(json.dumps(ok_map, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"\nDone: {len(ok_map)}/{len(animals)} photos saved to {IMAGES_DIR.relative_to(ROOT)}")
    if failures:
        print("Failures:", failures, file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
