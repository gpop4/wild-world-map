# 🌍 Wild World Map — Interactive Animal Explorer

An interactive, kid-friendly world map web application built for curious young explorers! Click on continents, countries, large-country regions, famous national parks, deserts, and oceans to discover the popular animals that live there, browse fun facts with real wildlife photos, and listen along with **Read-Aloud Mode**.

## ✨ Features

- **6 Explorer Modes:**
  - **🗺️ Map Mode (Clutter-Free Atlas):** Clean National Geographic World Map with zero pin clutter—click **anywhere** on Earth to discover the wildlife living closest to that point!
  - **🐾 Animal Mode (200 Animals):** Full-screen visual photo carousel of **200 unique animals** with group filters and shuffle; tap any animal to see where it lives on the map and listen immediately.
  - **🏞️ Parks & Jungles Mode (19 Parks & Jungles):** Photo-collage carousel of the world's greatest parks and rainforests—tap any place to zoom to it on the map and take a guided audio+photo tour of the animals living there.
  - **🏜️ Deserts Mode (10 Deserts):** Carousel of the world's iconic deserts (Sahara, Gobi, Kalahari, Arabian, Namib, Mojave, Sonoran, Atacama, Thar, Australian Outback).
  - **🏔️ Mountains Mode (9 Mountain Ranges):** Carousel of iconic peaks & ranges (Himalayas, Andes, Alps, Kilimanjaro, Rockies, Ethiopian Highlands, Appalachians, Mount Fuji, Caucasus).
  - **🏳️ Countries Mode (20 Countries & Regions):** Carousel of iconic countries and wildlife regions worldwide.
- **200 Bundled Real Wildlife Photos:** Every animal has an optimized local photograph (`public/images/animals/`) plus tap-to-zoom **Big Photo** fullscreen mode.
- **Pre-Generated Studio Voiceovers (Zero Runtime API Calls):** Uses pre-recorded `.m4a` clips generated locally with open-source **Kokoro-82M** (and Gemini TTS), with **Play / Pause / Stop**, **Tour All**, and **🐢 / 🦊 / 🐆** speed controls.
- **Kid-Friendly Discovery Tools:** **🔍 Search** across all 200 animals & 64 places, **🎲 Surprise Me!**, **🐾 Explorer Passport** progress tracker (`localStorage`), and **Continent Quick-Jump Bar**.

---

## 🛠️ Setup & Local Execution

### Prerequisites
- [Node.js](https://nodejs.org/) v18+ and `npm`

### 1. Install Dependencies
```bash
cd /Users/madhu/adyu-projects/wild-world-map
npm install
```

### 2. Run Locally (Development Server)
```bash
npm run dev
```
Open the local URL printed in the terminal (typically `http://localhost:5173`) in your browser.

### 3. Pre-Generate Studio Voiceovers (Zero Runtime API Calls)
All 136 voiceovers (36 places + 100 animals) are pre-generated as compact `.m4a` clips in `public/audio/` with zero runtime API calls. To generate voiceovers for newly added animals:

- **Option A — Kokoro-82M (Open-source, free, local, no API key or quota):**
  ```bash
  uv venv /tmp/kokoro-venv --python 3.12
  uv pip install --python /tmp/kokoro-venv/bin/python kokoro-onnx soundfile
  mkdir -p /tmp/kokoro-models
  curl -sL "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx" -o /tmp/kokoro-models/kokoro-v1.0.onnx
  curl -sL "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin" -o /tmp/kokoro-models/voices-v1.0.bin
  /tmp/kokoro-venv/bin/python scripts/generate_kokoro_voiceovers.py --workers 4
  ```
- **Option B — Gemini TTS (`gemini-2.5-flash-preview-tts`):**
  ```bash
  export GEMINI_API_KEY="your-gemini-api-key"
  python3 scripts/generate_voiceovers.py
  ```

Both scripts automatically skip existing clips and update `public/audio/manifest.json`.

### 4. Build for Production (Standalone Static Website)
```bash
npm run build
```
This outputs a standalone static website in the `dist/` folder that can be hosted anywhere (Firebase Hosting, GitHub Pages, Netlify, Vercel, Cloudflare Pages, etc.).

To preview the production build locally:
```bash
npm run preview
```

---

## 🚀 Deploying as a Standalone Website

Because `npm run build` produces a pure static bundle in `dist/`, you can deploy it with any static hosting provider:

### Option A: Firebase Hosting
```bash
npx firebase-tools login
npx firebase-tools init hosting   # set public directory to "dist", single-page app: Yes
npx firebase-tools deploy --only hosting
```

### Option B: GitHub Pages
1. Push this project to a GitHub repository.
2. Deploy `dist/` to the `gh-pages` branch or enable GitHub Pages in repository settings.

### Option C: Netlify / Vercel
- **Netlify Drop:** Drag and drop the `dist/` folder onto [app.netlify.com/drop](https://app.netlify.com/drop).
- **Vercel:** Run `npx vercel --prod` inside `wild-world-map/`.

---

## 🧹 Clean Up

To remove build outputs and installed dependencies:
```bash
rm -rf /Users/madhu/adyu-projects/wild-world-map/dist /Users/madhu/adyu-projects/wild-world-map/node_modules
```

To reset saved Explorer Passport progress in the browser, clear `localStorage` for the site in your browser settings.
