# Grok Girls Studio

AAA-style cyberpunk / gothic-glamour **character creator & companion studio** — a fully client-side React + Vite app. Design a persona (the flagship preset is **Ruby Noir**: crimson hair, lace corset, fishnets, red velvet choker, reclining in a dark leather armchair under moody noir lighting), chat with her, run story chapters, and render images/video. Installable as a **PWA** and packaged for **Android** via Capacitor.

> All personas are fictional adults (18+). The app includes a built-in 18+ toggle in the left rail. Keep interactions respectful.

## Features

### Avatar Studio (Builder)
- **Left nav rail** — Appearance, Body, Clothing, Hair, Face, Eyes, Accessories, Augments, Tattoos, Animations, Premium, Help + Randomize, Stats & Achievements, Settings, 18+ toggle, Chat.
- **Persona management** — rename any persona (Appearance → Persona Name), duplicate (⧉), delete with double-click confirm, export/import personas as JSON files from the PRESETS browser.
- **Scene Style presets** — one-click mood library (Noir Boudoir, Cyber Neon, Golden Hour, Candlelight, Pastel Dream, B&W Noir, Blue Hour, Red Room): each sets the viewport filter, backdrop, accent color, and prompt style together.
- **⧉ x4 Variations** — batch-render four alternate poses/angles at once, re-roll any single card, and apply the winner to the viewport + gallery.
- **Advanced render controls** — negative prompt, seed, steps, CFG, and resolution (1024/1536/2048) in the prompt editor; all forwarded to cloud providers (A1111-style `negative_prompt`, `steps`, `cfg_scale`, `seed`) and used by the local engine.
- **Drag & drop / paste import** — drop any image onto the viewport or press Ctrl+V to turn it into a new preset instantly.
- **Immersive fullscreen** — `F` hides all panels for a clean studio view.
- **Presets drawer** — Ruby Noir plus **ultra-HD female models** (Kira HD, Nova HD, Aria HD — DAZ Genesis-8 style renders), Matrix_07, Shadow Synth, Crazzers AI, Silver Valkyrie, Sugarlab AI, Flirty Rouge + custom/imported personas. Create new presets anytime.
- **PRESETS browser** — full-grid identity browser with LOAD buttons.
- **IMPORT tab** — import an image as a new preset, restore a gallery JSON archive, or reset all local data.
- **Viewport** — drag to pan, ROTATE / ZOOM / PAN / RANDOM / PNG export, lighting modes (Noir armchair mood, Studio, Full, Bust, Wireframe), camera status chip, multi-angle preview circles.
- **Scene prompt editor** (✎ in header) — the prompt compiles live from your builder choices; edit, copy, or rebuild it.
- **Lower dock** — HAIR STYLE grid, HAIR COLOR wheel (canvas HSV wheel + sliders + hex + swatches + named color chips), MAKEUP presets (eye looks + lipstick chips), EYEBROWS shapes + thickness.
- **Details & add-ons** — click to cycle: Choker, Corset, Fishnets, Piercings, Scars, Makeup, Face Paint, Cyberware.
- **Right inspector** — Appearance (gender: female / non-binary / android, 8 skin tones, head shape slider, age slider, skin details, color accent), Hair, Eyes, Face, Body, Clothing & Lingerie (corset, choker, hosiery, scene backdrop, room), Tattoos, Augments.
- **Footer** — Avatar ID + copy, LOAD OUTFIT wardrobe drawer, generation ENGINE selector (Local / OpenRouter / Gemini / Custom / **Self-Hosted**), CANCEL, GENERATE RENDER, ⧉ x4 variations, SAVE AVATAR.
- **Local Noir render engine** — zero-config procedural SVG renderer that draws a stylized boudoir portrait reflecting your actual choices (hair colour, corset, fishnets, choker, accent light, cyber scene). Cloud providers render via their APIs when configured.
- **HD-model prompt engine** — all compiled prompts target ultra-HD photorealistic 3D character renders (DAZ Studio Genesis 8 HD style, Iray GI, 8K pore-level skin, SSS), so cloud generations match the HD model look.

### Companion features
- **Story** — 4 chapters (First Meeting, Private Space, Nightlife, New Horizons), relationship-gated chapter jumps, per-room scene actions that render story images straight to the gallery.
- **Video studio** — real video pipeline: cloud providers return actual clips; **Local mode records a genuine 5-second WebM in-browser** (Ken Burns camera motion, scanlines, film grain, HUD frame, progress) with quality/FPS/aspect/motion presets and one-click download.
- **Gallery** — every render lands here; engine filter chips (ALL / LOCAL / OPENROUTER / GEMINI / CUSTOM); click any card for a **fullscreen lightbox** (←/→ arrows, favorite, set-as-viewport, download, delete, prompt caption); export/import JSON archives; **CONTACT SHEET** downloads a PNG grid of your renders; copy the viewport image straight to the clipboard.
- **Chat** — in-character dialogue with quick-reply chips, engine selector, **chat log export** (JSON), and per-persona memory that feeds future generations.
- **Stats & achievements** — renders, favorites, messages, chapters, imports, clips are tracked with 8 unlockable achievement badges.
- **Premium modal** — feature list + Stripe payment-link redirect (configure link in `src/services/keys.ts`).
- **Help modal** — in-app guide (Esc closes any overlay) + keyboard shortcuts: `R` rotate · `Z` zoom · `P` prompt editor · `G` generate · `S` save · `V` video studio · `C` chat · `F` fullscreen · `Ctrl+Z` / `Ctrl+Y` undo/redo · `←`/`→` lightbox navigation.

## 🖥️ Self-hosted engine (first-class)

Select **SELF-HOSTED** in the footer ENGINE selector and configure it in ⚙ Settings → Self-Hosted Server:

- **AUTOMATIC1111 SD-WebUI** — launch with `--api --listen`, then enter `http://<your-pc-ip>:7860` (LAN works from your phone's browser too). The app supports checkpoints (model switching via `override_settings`), samplers, Hires-Fix + upscaler, LORA slots (`<lora:name:weight>`), negative prompts, seeds, steps, CFG and resolution.
- **ComfyUI** — enter `http://<your-pc-ip>:8188`. The app builds a full workflow (CheckpointLoader → CLIP encodes → KSampler → VAE → SaveImage), submits it to `/prompt`, polls `/history` and returns the rendered PNG.

Settings console features: **🔌 TEST CONNECTION** (auto-detects server type, counts models & LORAs), **🔄 FETCH MODELS** (populates the checkpoint dropdown), 3 LORA slots with weights, and clear error surfacing (bad URL, missing `--api` flag, workflow errors). Everything is stored in your browser. Your server, your model, your rules — no third-party content policies apply.

## 📱 Android app

The app is a **PWA** (installable) and ships with a ready **Capacitor Android project** in `android/`.

### Option A — PWA install (no build tools needed)
1. Host the built app anywhere (Netlify, Vercel, GitHub Pages) or run `npm run build && npm run preview`.
2. Open the URL in **Chrome on Android** → ⋮ menu → **Add to Home screen / Install app**.
3. It installs as a standalone full-screen app with the Grok Girls icon, splash color, and offline shell support (service worker).

### Option B — Real APK via Capacitor (Android Studio)
```bash
npm install
npm run build          # regenerates dist/
npx cap sync android   # bundles the web app into the android project
npx cap open android   # opens Android Studio → Build → Build APK(s)
```
- The generated project is `android/` (appId `ai.grokgirls.studio`), with the web assets already synced.
- **Hosted-shell mode** ("web hosted where required"): in `capacitor.config.json` add
  `"server": { "url": "https://your-hosted-app.example.com", "cleartext": false }` — the APK then acts as a thin shell that always loads your latest hosted web build. Without it, the app is fully bundled and runs offline.
- Sign the APK in Android Studio (Build → Generate Signed Bundle/APK) to distribute it.

## Deployment

```bash
npm run build        # outputs static site to dist/
npx serve dist       # quick local test
```
`dist/` is a static site — drag & drop it onto Netlify/Vercel, or push to GitHub Pages. No server-side code required.

## Quick start

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build to dist/
```

## AI provider configuration

Configure in the in-app ⚙ **Settings** modal (stored in your browser's localStorage), or via `.env.local`. The Settings modal now includes **per-provider model pickers** (image + chat models for OpenRouter and Gemini) and **per-mode custom endpoints** (chat / image / video):

```env
# OpenRouter (chat + image via compatible endpoints)
VITE_OPENROUTER_API_KEY=your_openrouter_key
VITE_OPENROUTER_CHAT_MODEL=openai/gpt-4o-mini
VITE_OPENROUTER_IMAGE_MODEL=openrouter/auto

# Google Gemini
VITE_GEMINI_API_KEY=your_gemini_key
VITE_GEMINI_CHAT_MODEL=gemini-2.5-flash

# Custom provider
VITE_CUSTOM_API_KEY=your_token
VITE_CUSTOM_CHAT_ENDPOINT=https://your-custom-llm.example.com/v1/chat/completions
VITE_CUSTOM_IMAGE_ENDPOINT=https://your-custom-image.example.com/v1/generate
```

Image/video generation endpoints can also be set per-mode in the Settings modal pattern (`getSavedEndpoint(p, mode)`), or via `VITE_<PROVIDER>_IMAGE_ENDPOINT` / `VITE_<PROVIDER>_VIDEO_ENDPOINT`.

**Cloud response formats supported** — the parser extracts media from: A1111/SD-WebUI (`images[]` base64), OpenAI-style image output (`choices[].message.images[]`), Gemini inline parts (`candidates[].content.parts[].inlineData` / `fileData`), Imagen (`mediaItems[]` base64 / `generatedImages[]` URIs), and generic `url`/`output[]`/`data[].b64_json` shapes. OpenRouter image mode sends `modalities: ["image","text"]` with the default model `google/gemini-2.5-flash-image-preview`; Gemini image mode defaults to `gemini-2.5-flash-image` with `responseModalities: ["IMAGE"]`. Override models via env keys above.

The **Local engine needs no keys** — it always works offline and produces the stylized Noir render.

## Project structure

```
src/
├── App.tsx                    # Studio shell: rail, presets, viewport, dock, inspector, overlays
├── styles.css                 # Full cyberpunk design system
├── components/
│   ├── ColorWheel.tsx         # Canvas HSV color wheel
│   ├── SettingsModal.tsx      # API key management (localStorage)
│   └── AvatarCreator.tsx      # Legacy creator component
├── models/
│   ├── studio.ts              # Girls, rooms, prompt builder, seed personas
│   └── story.ts               # Story chapters & progression
├── services/
│   ├── avatarCreator.ts       # AvatarDraft, options, randomizer, prompt compiler, draft persistence
│   ├── providers.ts           # Local Noir engine + OpenRouter/Gemini/Custom clients + fallback cascade
│   ├── chat.ts                # Companion dialogue (local + cloud)
│   ├── memory.ts              # Persona memory + generation prompt assembly
│   ├── gallery.ts / media.ts  # Gallery CRUD, favorites, JSON export/import, downloads
│   ├── avatarState.ts         # Mood/affection/trust state machine
│   ├── avatarEditor.ts        # Avatar save/load options
│   └── stripe.ts / keys.ts    # Payment link redirect + runtime config
└── pages/
    └── VideoExportPage.tsx    # Video render settings
```

## Notes
- Everything persists in browser localStorage — personas, drafts, chats, gallery, settings.
- The Noir render engine (`createLocalPlaceholderSvg`) parses the compiled prompt and stylizes the scene accordingly — check `public/assets/noir-render-demo.svg` for a sample.
- Sandbox preview note: filesystem previews have no network access; the live dev server preview is the best way to use the app.


## Hosting note (H3)
The PWA uses absolute paths (`/manifest.webmanifest`, `/icons/…`) and is meant to be hosted at a
**domain root** (or Capacitor's bundled webview). Hosting under a sub-path (e.g. GitHub Pages
`user.github.io/repo/`) is not supported — the manifest/scope/asset URLs would resolve against the
domain root. Root-only hosting is the documented, supported deployment.

## Automated tests
`npm ci && npm run build` then serve `dist/` on :8080 with `tests/mocks/mock_big_a1111.py` (:7860)
and `tests/mocks/mock_slow_a1111.py` (:7861) running, and execute `python3 tests/ci_runner.py`.
The same suites gate every CI push (job `Browser test suites`).
