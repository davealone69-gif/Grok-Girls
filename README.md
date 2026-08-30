# Grok Girls Studio

AAA-style cyberpunk / gothic-glamour **character creator & companion studio** — a fully client-side React + Vite app. Design a persona (the flagship preset is **Ruby Noir**: crimson hair, lace corset, fishnets, red velvet choker, reclining in a dark leather armchair under moody noir lighting), chat with her, run story chapters, and render images/video.

> All personas are fictional adults (18+). The app includes a built-in 18+ toggle in the left rail. Keep interactions respectful.

## Features

### Avatar Studio (Builder)
- **Left nav rail** — Appearance, Body, Clothing, Hair, Face, Eyes, Accessories, Augments, Tattoos, Animations, Premium, Help + Randomize, Settings, 18+ toggle, Chat.
- **Presets drawer** — Ruby Noir plus **ultra-HD female models** (Kira HD, Nova HD, Aria HD — DAZ Genesis-8 style renders), Matrix_07, Shadow Synth, Crazzers AI, Silver Valkyrie, Sugarlab AI, Flirty Rouge + custom/imported personas. Create new presets anytime.
- **PRESETS browser** — full-grid identity browser with LOAD buttons.
- **IMPORT tab** — import an image as a new preset, restore a gallery JSON archive, or reset all local data.
- **Viewport** — drag to pan, ROTATE / ZOOM / PAN / RANDOM / PNG export, lighting modes (Noir armchair mood, Studio, Full, Bust, Wireframe), camera status chip, multi-angle preview circles.
- **Scene prompt editor** (✎ in header) — the prompt compiles live from your builder choices; edit, copy, or rebuild it.
- **Lower dock** — HAIR STYLE grid, HAIR COLOR wheel (canvas HSV wheel + sliders + hex + swatches + named color chips), MAKEUP presets (eye looks + lipstick chips), EYEBROWS shapes + thickness.
- **Details & add-ons** — click to cycle: Choker, Corset, Fishnets, Piercings, Scars, Makeup, Face Paint, Cyberware.
- **Right inspector** — Appearance (gender: female / non-binary / android, 8 skin tones, head shape slider, age slider, skin details, color accent), Hair, Eyes, Face, Body, Clothing & Lingerie (corset, choker, hosiery, scene backdrop, room), Tattoos, Augments.
- **Footer** — Avatar ID + copy, LOAD OUTFIT wardrobe drawer, generation ENGINE selector (Local / OpenRouter / Gemini / Custom), CANCEL, GENERATE RENDER, SAVE AVATAR.
- **Local Noir render engine** — zero-config procedural SVG renderer that draws a stylized boudoir portrait reflecting your actual choices (hair colour, corset, fishnets, choker, accent light, cyber scene). Cloud providers render via their APIs when configured.
- **HD-model prompt engine** — all compiled prompts target ultra-HD photorealistic 3D character renders (DAZ Studio Genesis 8 HD style, Iray GI, 8K pore-level skin, SSS), so cloud generations match the HD model look.

### Companion features
- **Chat** — in-character dialogue; keyword-based local engine by default, or OpenRouter / Gemini / Custom LLMs when keys are configured. Quick-reply chips, affection state machine, per-persona memory that feeds future generations.
- **Story** — 4 chapters (First Meeting, Private Space, Nightlife, New Horizons), relationship-gated chapter jumps, per-room scene actions that render story images straight to the gallery.
- **Video studio** — VideoExportPage render settings with the active persona.
- **Gallery** — every render lands here; favorite, set-as-viewport, download PNG, delete, export/import JSON archives.
- **Premium modal** — feature list + Stripe payment-link redirect (configure link in `src/services/keys.ts`).
- **Help modal** — in-app guide (Esc closes any overlay).

## Quick start

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build to dist/
```

## AI provider configuration

Configure in the in-app ⚙ **Settings** modal (stored in your browser's localStorage), or via `.env.local`:

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
