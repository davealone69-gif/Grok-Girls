<div align="center">

# Grok Girls Character Studio

**Next-generation interactive AI persona studio, avatar identity designer, companion dialogue engine, and multimedia generation suite.**

[![React](https://img.shields.io/badge/React-18+-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5+-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6+-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Status](https://img.shields.io/badge/Status-Active_&_Working-22C55E?style=flat-square)](#)

</div>

---

## 🌟 Core Features

- **🎭 Character Persona Studio**
  - Instant access to seeded companion personas (`Crazzers AI`, `Secrets AI`, `Sugarlab AI`, `Flirty AI`).
  - Create and save custom personas with tailored traits, backstories, mood states, and visual preferences.
  - Adaptive relationship states: tracks emotional mood, energy, trust, and affection.

- **🎨 Avatar Identity Designer (`AvatarCreator`)**
  - Deep character customization: ethnicity, body build, facial structure, eye color/shape, hair style/color, skin tone, wardrobe, poses, and expressions.
  - **Identity Randomizer**: Roll balanced, coherent character traits with one click.
  - Dynamic prompt compilation for consistent identity preservation across media generations.

- **💬 Memory-Aware Companion Dialogue**
  - Interactive chat system with real-time emotional memory.
  - Companions recall past conversations, shared moments, and current environmental cues.
  - Works offline in **Local Procedural Mode** or with live cloud LLMs.

- **📸 Scene & Environment Engine**
  - Switch between multi-camera environments: Photo Studio, Luxury Penthouse, Neon Nightclub, and Rooftop at Blue Hour.
  - Select contextual interactions and camera framing presets (e.g. Centered Portrait, Sofa Lounge, Private Booth, Railing View).

- **🎬 Video Export & Render Studio**
  - Production-ready render settings: 720p, 1080p, 1440p, 4K UHD.
  - Custom frame rates (24, 30, 60 FPS), aspect ratios (16:9, 9:16, 1:1, 21:9), and camera motion dynamics.
  - Animated render progress simulator and keyframe preview.

- **🖼️ Generations Archive & Gallery**
  - Visual gallery of generated media with favorites filter.
  - Direct media export and download.
  - Full JSON backup: export and import gallery archives across devices.

- **⚡ Multi-Provider AI Routing**
  - **Local Procedural Mode**: High-speed, zero-config offline SVG generation engine.
  - **OpenRouter**: Access Claude 3.5, GPT-4o, Llama 3, and FLUX diffusion models.
  - **Google Gemini**: Gemini 2.5 Flash chat & Imagen generation.
  - **Custom Endpoints**: Connect your self-hosted LLMs or ComfyUI/Automatic1111 pipelines.
  - In-app **API Settings Modal**: Safely store keys in local browser storage.

- **🔞 Adult Mode Overlay**
  - Global toggle adjusting generation prompts, avatar specs, companion chat policies, and story content for mature (18+) creative workflows.

---

## 🚀 Quick Start

### 1. Prerequisites
- **Node.js** 20+ (recommended)
- **npm** or **pnpm**

### 2. Installation
```bash
git clone https://github.com/davealone69-gif/Grok-Girls.git
cd Grok-Girls
npm install
```

### 3. Development Server
```bash
npm run dev
```
The app will be available at `http://localhost:5173`.

### 4. Production Build
```bash
npm run build
npm run preview
```

---

## 🔑 Environment Configuration

You can configure provider keys either through the **in-app "API Settings" modal** or via a `.env.local` file:

```env
# OpenRouter Configuration
VITE_OPENROUTER_API_KEY=your_openrouter_key
VITE_OPENROUTER_CHAT_MODEL=openai/gpt-4o-mini
VITE_OPENROUTER_IMAGE_ENDPOINT=https://openrouter.ai/api/v1/chat/completions

# Google Gemini Configuration
VITE_GEMINI_API_KEY=your_gemini_key
VITE_GEMINI_CHAT_MODEL=gemini-2.5-flash

# Custom Endpoint Configuration
VITE_CUSTOM_AI_KEY=your_token
VITE_CUSTOM_CHAT_ENDPOINT=https://your-custom-llm.example.com/v1/chat/completions
```

---

## 📁 Architecture & File Structure

```
Grok-Girls/
├── index.html                     # Entry HTML document
├── package.json                   # Dependencies and scripts
├── tsconfig.json                  # TypeScript bundler configuration
├── vite.config.ts                 # Vite server & preview configuration
└── src/
    ├── main.tsx                   # React root hydration
    ├── App.tsx                    # Main Studio layout and navigation
    ├── styles.css                 # Dark neon studio design system
    ├── theme.ts                   # AppTheme tokens and typography
    ├── components/
    │   ├── AvatarCreator.tsx      # Avatar identity customizer
    │   └── SettingsModal.tsx      # In-app API credentials manager
    ├── models/
    │   ├── story.ts               # Campaign chapters & relationship engine
    │   └── studio.ts              # Persona specs, rooms, and prompts
    ├── pages/
    │   └── VideoExportPage.tsx    # HD/4K video render studio
    └── services/
        ├── avatarCreator.ts       # Trait options & prompt compiler
        ├── avatarEditor.ts        # Avatar persistence adapter
        ├── avatarState.ts         # Emotional state and bond dynamics
        ├── chat.ts                # Dialogue engine with persona memory
        ├── gallery.ts             # Gallery storage and favorite toggling
        ├── media.ts               # Download helpers and JSON import/export
        ├── memory.ts              # Conversational and prompt memory
        ├── providers.ts           # Local, OpenRouter, Gemini, Custom adapters
        ├── stripe.ts              # Optional checkout link routing
        └── supabase.ts            # Supabase auth/storage client
```

---

## 📄 License

MIT License. Designed for creative character design and fictional companion interactions.
