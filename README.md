# 🌍 Wild World Map — Interactive Animal Explorer

An interactive, kid-friendly world map web application built for curious young explorers! Click on continents, countries, large-country regions, famous national parks, deserts, and oceans to discover the popular animals that live there, browse fun facts with real wildlife photos, and listen along with **Read-Aloud Mode**.

## ✨ Features

- **Interactive Zoomable World Map (Leaflet):** Explore 28+ iconic places across all 7 continents, 5 oceans, 5 major deserts, large-country regions (e.g., Alaska, Yellowstone, Everglades, Australian Outback, Gir Forest, Sundarbans, Sichuan), and world-famous national parks.
- **Animal Explorer Carousel:** Navigate effortlessly through each area's animals with big touch-friendly buttons, animal tabs, or keyboard arrow keys (`←` / `→`).
- **Real Wildlife Photos + Offline-Safe Fallback:** Automatically fetches high-resolution wildlife photographs from Wikipedia with colorful illustrated emoji fallbacks.
- **Read-Aloud Mode (Web Speech API):**
  - Global **Auto-Read ON/OFF** toggle that automatically reads place intros and animal facts aloud as you click.
  - **Play / Pause / Stop** controls, kid-friendly reading speed toggles (🐢 Slow / 🦊 Normal / 🐆 Fast), and live yellow highlighting of each fact while it is being read.
  - Tap any individual fact, sound callout, or place intro to hear it immediately.
- **Kid-Friendly Discovery Tools:**
  - **🔍 Search** any animal, country, park, desert, or ocean.
  - **🎲 Surprise Me!** button to fly to a random place and animal on Earth.
  - **🐾 Explorer Passport** tracking how many animals have been discovered (saved locally in the browser).
  - **Continent Quick-Jump Bar** and **Category Filters** (Countries & Regions, Parks & Jungles, Deserts, Oceans & Reefs).

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

### 3. Pre-Generate Studio Gemini TTS Voiceovers (Optional — Zero Runtime API Calls)
To generate warm storybook voiceovers using **Gemini TTS (`gemini-2.5-flash-preview-tts`)** and bundle them as static `.m4a` clips in `public/audio/`:

```bash
cd /Users/madhu/adyu-projects/wild-world-map
# Put your key in .env.local (gitignored) or export it:
export GEMINI_API_KEY="your-gemini-api-key"
python3 scripts/generate_voiceovers.py
```

The script automatically converts audio to compact `.m4a` files, writes `public/audio/manifest.json`, and skips already-generated clips on re-runs.

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
