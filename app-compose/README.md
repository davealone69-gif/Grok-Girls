# Grok Girls Studio — Jetpack Compose rewrite

A complete, from-scratch rebuild of the UI in **Jetpack Compose + Material 3**.
No code, layout, or asset is carried over from the previous React/Vite +
Capacitor app or the legacy OpenGL ES renderer in `native/`.

## Stack

| | |
|---|---|
| UI | Jetpack Compose, Material 3 (BOM 2024.12.01) |
| Language | Kotlin 2.0.21 (K2), Compose Compiler plugin |
| Build | AGP 8.7.3, Gradle 8.11.1, version catalog |
| Nav | Navigation-Compose, adaptive bar/rail |
| 3D | Google Filament 1.51.2 (`filament-android`, `gltfio`, `filament-utils`) |
| State | ViewModel + StateFlow, kotlinx.serialization |
| SDK | minSdk 26, target/compile 35 |

## Module layout

```
app-compose/
├── settings.gradle.kts
├── gradle/libs.versions.toml        # version catalog
└── app/src/main/
    ├── java/ai/grokgirls/studio/
    │   ├── MainActivity.kt
    │   ├── data/
    │   │   ├── model/               # Persona, Studio, Catalog
    │   │   └── repo/                # StudioRepository, ViewModel, PromptEngine
    │   ├── render/AvatarStage.kt    # Filament glTF/GLB stage + IBL
    │   └── ui/
    │       ├── theme/               # Color, Type, Shape, Theme
    │       ├── components/          # GlassPanel, ChipRow, ColorWheel, …
    │       ├── nav/Destinations.kt
    │       ├── AppShell.kt
    │       └── screens/             # 9 screens
    ├── assets/{presets,scenes}/     # HD generated art
    └── res/                         # adaptive icon, splash, themes
```

## Design system

Expressive dark theme — crimson (`#E23E58`) → violet (`#9B6CFF`) on
near-black (`#07070B`), with a cyan tertiary for state/HUD. Custom type
scale, 5-step shape scale, frosted `GlassPanel` surface, and an animated
`AuroraBackground` that re-tints from the active scene's accent colour.

## Screens

- **Studio** — 7-tab inspector (Appearance, Hair, Face, Body, Clothing,
  Extras, Scene), live viewport with scene backdrop + tool rail, immersive
  fullscreen, render progress, x4 variations, prompt bottom sheet with
  negative prompt / steps / CFG / resolution / engine.
- **Presets** — searchable adaptive grid, load/duplicate/delete-confirm.
- **Chat** — gradient bubbles, quick replies, scene-aware responses, affinity.
- **Story** — 4 affinity-gated chapters with per-scene actions.
- **Gallery** — engine filter chips, fullscreen lightbox with arrow nav,
  favourite / download / set-viewport / delete.
- **Video** — quality, FPS, aspect, camera motion, duration; REC HUD.
- **Stats** — 6 stat pills, 8 achievements with progress bars.
- **Settings** — engine picker, self-hosted server (A1111/ComfyUI) with
  checkpoint + 3 LORA slots and test/fetch, API key, 18+ toggle, data tools.
- **Premium** — perk list and upgrade CTA.

## Build

```bash
cd app-compose
echo "sdk.dir=$ANDROID_HOME" > local.properties
./gradlew :app:assembleDebug
```

> `gradle.properties` is tuned for a low-RAM (2 GB) container. On a normal
> dev machine or CI runner, raise `org.gradle.jvmargs` to `-Xmx4g`, set
> `org.gradle.parallel=true`, and drop the `in-process` Kotlin strategy —
> the `Compose App Build` GitHub workflow does exactly this and publishes
> the APK as an artifact.

## Verified

`:app:compileDebugKotlin` — **BUILD SUCCESSFUL**. Resource merge, manifest
processing, and dexing also pass locally; only the final `mergeDebugGlobalSynthetics`
/packaging step exceeds the 2 GB sandbox, which CI covers.

## Filament assets

`AvatarStage` loads `assets/avatars/*.glb` and an optional
`assets/envs/studio_ibl.ktx` IBL. Both are optional at runtime — the stage
degrades to a clear-colour skybox so the UI is never blocked. Drop in real
GLB/KTX files to enable full 3D.

## Content

All personas are fictional adults (18+). Bundled art is SFW and stylised;
the 18+ toggle gates mature wording only.
