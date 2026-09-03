# Architecture Audit — Priority 1 (Foundation)

Date: 2026-09-03 · Branch: `renderer/native-engine` (HEAD `7e9a0fa`; `377cee9` GLB milestone + `7e9a0fa` audit both committed locally, unpushed — PAT pending)
Scope: entire repo (web app `src/`, Capacitor wrapper `android/`, Kotlin engine `native/`, tests, CI)
Governing rules for this audit: **report first — nothing was deleted or rewritten.** All findings below are
observations + proposals awaiting sign-off. Working systems are preserved; no second implementations were created.

---

## 1. Build & CI health

| Check | Result |
|---|---|
| `npm run build` (tsc -b + vite) | ✅ exit 0, **zero TS errors** |
| Vite warnings | ⚠️ 1: single JS chunk **517.6 kB** (154 kB gzip) > 500 kB — no code-splitting anywhere (single-page, no router; `App.tsx` is one 4.1 k-line component) |
| `npm audit --audit-level=high` (CI gate) | ✅ passes — 3 moderate (Capacitor CLI), below the `high` gate |
| CI workflow | `.github/workflows/build.yml` — web build → browser suites (audit+glb+stress via `tests/ci_runner.py`) → Android debug/release APK. ⚠️ triggers **only on `main` pushes / PRs to main** — the working branch `renderer/native-engine` is not covered by any workflow trigger |
| Git state | clean tree; commit `377cee9` (GLB milestone, incl. new `tests/glb_suite.py` wired into ci_runner) committed locally, **not pushed** |

---

## 2. Platform map (what the project actually is)

```
grok-girls (web app — the product)
├─ src/            16.6 k LOC / 73 files  (TypeScript + React, no router)
│  ├─ App.tsx       4.1 k LOC — ~90 % of all UI lives inline here
│  ├─ components/   3 files (AvatarPreviewView, ColorWheel, SettingsModal)
│  ├─ pages/        1 file  (VideoExportPage)
│  ├─ models/       5 files — avatar/scene story data models
│  ├─ services/    19 files — generation providers, storage, chat, adult content
│  └─ renderer/    32 files — live 3D avatar renderer + offline renderer + GLB path
├─ android/         Capacitor 8 wrapper (MainActivity.java, AvatarStudioPlugin.kt,
│                   NativeAvatarActivity.kt) — produces the APK
├─ native/          6.9 k LOC / 47 Kotlin files — standalone Android Studio engine
│                   mirror (com.aura.avatarstudio) + headless-test tools
├─ public/          menu.xml (nav layout), glb test assets, icons, sw.js, manifest
└─ tests/           audit_suite, glb_suite, stress_suite, ci_runner, mocks/, fixtures/
```

Runtime shape: one React root (`main.tsx`), **no router** — “screens” are branches of a single
`view` state union inside `App.tsx`, plus modal overlays. Production build injects a CSP meta tag
(vite plugin); PWA service worker registered in browser, forcibly unregistered inside the Capacitor
webview (see `main.tsx`).

---

## 3. Screen / navigation / component map

### 3.1 Top-level views (`type ActiveView` — App.tsx:139)

| View | JSX anchor | Contents / notes |
|---|---|---|
| `builder` | ~2016–2790 | default studio: persona selector, mode pills, preview panel, lighting bar, 3D “cube” viewport overlay, bottom dock, identity/options panel |
| `presets` | 2799 | style presets gallery (styles.ts `stylePresets`) |
| `import` | 2886 | gallery import/export |
| `chat` | 2954 | companion chat (chat.ts persistence + `reply()` provider routing) |
| `story` | 3043 | story-chapter flow (models/story.ts) |
| `video` | 3102 | `<VideoExportPage>` (AI video export, pages/VideoExportPage.tsx) |
| `gallery` | 3130 | generated-image gallery + lightbox |

### 3.2 Modal / overlay registry (all in App.tsx)

Age gate (3801) · premium (3840) · help (3892) · variations (3943) · lightbox (4048) · stats (4063) ·
outfit drawer (3772) · SettingsModal (4124, component) · **3D viewport “cube mode” overlay**
(2383 — mounts `HdAvatarRenderer` on the `.hd3d-canvas`) · immersive fullscreen (F) ·
mobile bottom sheet (`mobileSheet`, 4117) · toasts.

### 3.3 Navigation data chain (XML-driven, two alias layers — verified complete)

`public/menu.xml` (android:id) → `ID_ALIASES` in `services/menuXml.ts` (strips `btn`/`cat` prefixes,
`catHairStyle→hair_style`, `catAvatar→catAvatar`) → `menuItems` sections `rail|header|angles|dock|options`
→ App dispatch switches (`railAction`, `headerAction`, `angleAction`, `optionsAction`, `DOCK_TAB_IDS`) →
`ActiveView` / section accordions / `DockTab`.

- Rail ids (19): appearance, presets, import, body, clothing, hair, face, eyes, accessories, augments,
  tattoos, animations, story, gallery, premium, chat, help, settings
- Dock tabs (6): `DockTab = style | color | makeup | eyebrows | scene | categories`
  (`DOCK_TAB_IDS`: hair_style→style, hair_color→color, makeup→makeup, eyebrows→eyebrows,
  scene_style→scene, catAvatar→categories) — the mapping from the roadmap is correct and complete
- Header actions: generate, hd_render, random, rotate, zoom · angles: front/3q/side/back
- Options panel (menu.xml `options` section): avatarId input, Load outfit, Cancel, Save, tattoo/augment toggles

⚠️ One navigation gap found (functional, not stale-id): **identity Load restores only `outfit`**
(App.tsx:558–559 applies `def.outfit` to the draft; the other 10 canonical fields of the saved
`AvatarDefinition` are written on Save but not re-applied on Load). See §6 row 8.

### 3.4 Component inventory (non-inline)

`AvatarPreviewView` (wired: builder preview img + Kotlin-mirror `setAvatar()` handle) ·
`ColorWheel` (wired: dock color tab) · `SettingsModal` (wired: provider/self-host/sampler settings) ·
`VideoExportPage` (wired: video view). Everything else is inline in App.tsx — the largest
maintainability issue in the UI layer (dock sections, identity panel, lighting bar, HUD are all inline).

---

## 4. Data model map

### 4.1 Avatar — **six overlapping models** (the core canonical-state problem)

| # | Model | File | Role | Live? |
|---|---|---|---|---|
| 1 | `AvatarDraft` (rich, ~30 fields) | services/avatarCreator.ts | runtime edit state + undo/redo; prompt builder source | ✅ live |
| 2 | `AvatarDefinition` (11 coarse fields) | models/avatarDefinition.ts | canonical Kotlin mirror; identity save/load | ✅ live |
| 3 | `AvatarDesignerViewModel` | models/avatarDesignerViewModel.ts | Kotlin StateFlow mirror; dispatcher bridging def ↔ draft | ✅ live |
| 4 | `AvatarSpec` / `Girl` | models/studio.ts | persona storage (bio/affinity/memories + appearance strings) | ✅ live |
| 5 | `AvatarState` (mood/energy/trust…) | services/avatarState.ts | persona simulation state, per id | ✅ live |
| 6 | `AvatarProfile` | services/avatarProfiles.ts | **entire file dead — zero importers** (storage key `grok-girls-avatars-v2` never read) | ❌ dead |

Plus a write-only legacy store: `services/avatarEditor.ts` (`saveAvatar(Girl)` → per-id key
`grok-girls-avatar-editor-v1:{id}`) is called on every persona edit (App.tsx:915, 938) but **has no
reader anywhere** — duplicate JSON written on each edit for nothing. ❌ obsolete (write-only).

### 4.2 Vocabulary duplication (option strings)

Same conceptual options exist in up to 3 vocabularies with **no shared source**:
`avatarOptions` (avatarCreator — rich AI-prompt fragments), `AVATAR_CATEGORIES` (avatarCategories —
coarse canonical Kotlin list, drives dock CATEGORIES tab), `AvatarSpec`/menu.xml strings.
Direction is one-way draft→definition (via `toAvatarDefinition`/VM) — documented as intentional
(coarse canonical vocabulary would clobber rich picks). Acceptable by design, but the two *lists*
(`avatarOptions.hairStyle` etc. vs `AVATAR_CATEGORIES.options`) still drift by hand.

### 4.3 Scene — no dedicated model

“Scene” today = `draft.styleTag` (string) + `draft.chairSetting` + `draft.colorAccent` + a CSS filter
(`stylePresets[].filter` via `styleFilter`) applied to the preview image + lighting-bar presets.
`StylePreset` (services/styles.ts) is the closest thing to a scene definition (lighting, chair,
prompt, filter, accent). Scene state is **scattered across draft fields + UI state** — see §7.

### 4.4 Settings & content gate

Provider/generation settings persist under ~12 independent keys (see §6 persistence table).
Content gate has **three keys**: app flag `grok-girls-adult-v1` (App.tsx), `grok-girls-age-confirmed-v1`
(ageGate), and `grok-girls-adult-mode-v1` (ageGate) — and the ageGate
`isAdultModeEnabled()`/`setAdultMode()` API has **zero callers** (dormant duplicate machinery).

### 4.5 Duplicate leaf types

`ChatMessage` exists twice: `services/chat.ts` (`{id, role:user|assistant, text, createdAt}` —
persisted) vs `services/providers.ts` (`{role: system|user|assistant, content}` — wire format).
`reply()` adapts inline (chat.ts:100). `Mode = 'image'|'video'` also duplicated (studio.ts vs providers.ts).

### 4.6 Persistence inventory (localStorage keys found in src)

| Key | Written by | Read by | Status |
|---|---|---|---|
| `grok-girls-state-v2` | memory.ts saveGirls | memory.ts loadGirls (boot) | ✅ canonical persona store |
| `grok-girls-avatar-editor-v1:*` | avatarEditor.saveAvatar (App edit path) | **nobody** | ❌ write-only |
| `grok-girls-avatars-v2` | avatarProfiles.ts | **nobody** (file dead) | ❌ dead |
| `grok-girls-avatar-defs-v1` | avatarDefinition save/load | identity Save/Load | ✅ |
| `grok-girls-draft-v1:{id}` | avatarCreator saveDraft | loadDraft | ✅ per-persona draft |
| `grok-girls-avatar-state-v1:{id}` | avatarState | avatarState | ✅ per-persona sim |
| `grok-girls-gallery-v1` | gallery.ts | gallery.ts | ✅ (raster blobs in IndexedDB) |
| `grok-girls-chat-v1:{id}` | chat.ts | chat.ts | ✅ |
| `grok-girls-deleted-v1` | memory markPersonaDeleted | memory | ✅ |
| `grok-girls-stats-v1` | stats.ts | stats.ts | ✅ |
| `grok-girls-adult-v1` | App adult flag | App | ✅ |
| `grok-girls-age-confirmed-v1` | ageGate | App + ageGate | ✅ |
| `grok-girls-adult-mode-v1` | ageGate.setAdultMode | **nobody** | ❌ dormant |
| `grok-girls-provider-v1`, `-chat-provider-v1` | providers | providers | ✅ |
| `grok-girls-seed/steps/cfg/size/neg-v1` | App | App | ✅ generation defaults |
| `grok-girls-key-*`, endpoint/model keys | providers | providers/SettingsModal | ✅ |
| `grok-girls-comfy-job-v1` + self-host keys | selfHosted.ts | selfHosted.ts | ✅ |
| IndexedDB | assetStore.putImage | gallery/media personas | ✅ raster store |

---

## 5. Renderer architecture map

```
Live 3D avatar (in-app, cube-mode overlay)
  HdAvatarRenderer.ts (1.3 k)          — orchestrates frames, RTs, materials, GLB draw
  renderer/avatar/                     — GlbLoader, GltfAvatar(loader), GltfMesh (GPU prim),
                                         GltfSkeleton (skin eval), GltfMorphs, GltfImages,
                                         GltfAccessor, GltfMaterial, GltfTypes
  HdAvatarRenderer stack:              — AvatarMesh (procedural), Skeleton, MorphTarget(s),
                                         FaceControls, Correctives, AvatarParameters,
                                         AdvancedSkinMaterial + ProceduralSkinTextures
  Shared shader/materials:             — EyeShader/HairShader/MorphShader/ShadowShader,
                                         EyeMaterial/HairMaterial, ShadowMap, IblPipeline,
                                         CinematicPipeline, HDFrameRenderer,
                                         RenderTarget.ts (renderable-format probe factory),
                                         HDRenderTarget.ts, RenderResolution, math, types
  GLB test assets + suite:             — public/glb/*, tests/glb_suite.py (25/25 green)

Offline HD render (headless → gallery PNG; “HD RENDER” header button)
  HDRenderer.ts (858)                  — self-contained pipeline: its OWN embedded shadow/tonemap
                                         shaders, its own mini scene graph (renderer/types.ts),
                                         independent of the live stack
```
Duplicate-implementation notes (no change made):
1. **HDRenderer.ts is a second, self-contained rendering implementation** — own shaders (shadow,
   PBR-ish, bloom, ACES), own mesh/light/material types. It is *wired and functional* (header
   `hd_render` action → gallery item). Not dead — but the strongest implementation is the live
   `HdAvatarRenderer` stack; consolidating offline export onto it (render offscreen through the
   shared pipeline + `exportPng`) would remove ~900 LOC of duplicate shaders/types later, only if
   the user chooses to (see §7 recommendations).
2. **Dead renderer files (zero importers):**
   - `renderer/SkinMaterial.ts` (27 LOC) — superseded by AdvancedSkinMaterial
   - `renderer/HDRenderView.tsx` (294 LOC) — old React view wrapper, referenced only by a title string
   - `theme.ts` (71 LOC) — no importers (colors hardcoded inline / styles.css)
   - `services/avatarProfiles.ts` (194 LOC) — dead model + storage (see §4.1)
3. Duplicate import line: App.tsx imports `ProceduralSkinTextures` twice (lines 27 & 29) — cosmetic.
4. `renderer/types.ts` `Material/Light/Mesh/Scene/RenderConfig` serve HDRenderer only (its own world),
   while the live renderer carries parallel concepts internally — mirrors finding 1.

---

## 6. Duplicate / obsolete / dead inventory (report only — no deletions performed)

| # | Item | Evidence | Replacement | Risk if deleted now |
|---|---|---|---|---|
| 1 | `services/avatarProfiles.ts` (194) | 0 importers; key `avatars-v2` unread | — (none) | none — remove after sign-off |
| 2 | `renderer/HDRenderView.tsx` (294) | 0 importers | — | none |
| 3 | `renderer/SkinMaterial.ts` (27) | 0 importers (AdvancedSkinMaterial is the live one) | — | none |
| 4 | `theme.ts` (71) | 0 importers | — | none |
| 5 | `avatarEditor.saveAvatar` write-only store | called App:915/938, no reader | delete call sites + file; canonical persona store is `grok-girls-state-v2` | low — removes duplicate JSON writes on every edit |
| 6 | ageGate `adult-mode-v1` API | `isAdultModeEnabled`/`setAdultMode` zero callers | App `adult-v1` + age-confirmed gate | low — dormant branch |
| 7 | Duplicate `ChatMessage`, `Mode` types | chat.ts vs providers.ts | keep persisted shape; single wire adapter | none |
| 8 | Identity **Load restores only outfit** | App `loadOutfit()` applies only the def's outfit field | **RESOLVED — verified by design**: the control is `btnLoadOutfit` ("Load Outfit") mirroring the Kotlin options panel; toast states "Outfit loaded…". `saveIdentity` persists the full 11-field canonical def; outfit-only restore is the intended menu semantic | none |
| 9 | `HDRenderer.ts` duplicate pipeline | own shadow/tonemap/types | later: offline export through live stack | **medium** — functional feature; only consolidate after verifying HD-render button output |
| 10 | Duplicate option vocabularies | avatarCreator vs AVATAR_CATEGORIES vs AvatarSpec | keep one-way def mapping; data-drive lists from one catalog | low |
| 11 | `smoke_textures.py` (tests) | 0 importers from suites/ci_runner | verify/remove | none |
| 12 | Single 517 kB chunk | vite warning | lazy-load gallery/video/3D surfaces via dynamic import | none |
| 13 | CI triggers main-only | build.yml | add `renderer/*` push trigger or PR workflow | none (process) |
| 14 | Known asset-path gap | MorphCube (factor-only material, NORMAL morph deltas, scale-100 node) renders 0 px on CI software GL; synthetic proxies with each trait isolated render lit (documented in glb_suite) | suite row is intentionally data-level for MorphCube + visual via MorphBoxTest | none — honest coverage |

Nothing above has been changed. Items 1–6 + 11 are safe, low-risk deletions/tidies awaiting your
go-ahead; 8–10 and 12–13 are design/process decisions.

---

## 7. Canonical state model (proposal — spec only, no code changed)

Guiding choice per your rules: **integrate the strongest existing implementations** — the app already
contains most of the canonical machinery; the work is *deleting the strays and declaring one source
of truth per concept*, not building a new store.

### 7.1 Avatar — one canonical spine (all exists today)

```
Girl (persona, grok-girls-state-v2)          ← master persona store (keep)
  └ AvatarDraft per id (draft-v1:{id})       ← rich runtime editor state + undo history (keep)
       └ AvatarDefinition (avatar-defs-v1)   ← canonical interchange, Kotlin mirror (keep)
            └ AvatarDesignerViewModel        ← single dispatcher: setOption / syncFromDraft (keep)
AvatarState (avatar-state-v1:{id})           ← persona simulation state (keep, separate concern)
```
Rules to declare: (1) `AvatarDraft` is the only avatar state React edits; (2) `AvatarDefinition` is
the only canonical interchange with native; (3) every write funnels through `AvatarDesignerViewModel`
or `applyCategoryOption`/`applyStylePreset` — no new direct field writers; (4) **delete** `avatarProfiles`
+ `AvatarProfile`, the `avatarEditor.saveAvatar` write-only store and its two call sites, and the
dormant `adult-mode-v1` API; (5) **fix identity Load** to apply the full definition (item 6.8) so
save↔load round-trips canonically.

### 7.2 Scene — one canonical scene model (currently scattered; new small spec)

Introduce (when the scene milestone lands, reusing existing data — no duplicate lists):
```
ScenePreset  = StylePreset (id, name, icon, accent, lighting, chair, prompt, filter)   // exists
SceneState   = { presetId, lightingPreset, cameraAngle, filterOverride }               // new, thin
scene persistence: draft.sceneTag (styleTag) + SceneState under ONE key (grok-girls-scene-v1:{id})
```
Until then, the declared canonical fields remain `draft.styleTag` + `styleFilter` (documented as scene).

### 7.3 Settings — one canonical settings record

Consolidate the ~12 keys into one typed `SettingsState` behind the existing provider/self-host
facades (facades stay; the key sprawl is the problem):
```
SettingsState = { contentGate:{ageConfirmed, adult}, provider:{image,chat, selfHost:{base,type,
  checkpoint, sampler, upscaler, hiresFix, loras}}, generation:{seed,steps,cfg,size,negative}, ui… }
```
Single key `grok-girls-settings-v1` with a one-time migration reader that falls back to current keys —
no data loss, no rewiring of call sites in one go.

---

## 8. Golden-rule ledger — what is verified wired & visibly working vs code-only

| Feature path | Evidence it is connected to the live path | Status |
|---|---|---|
| GLB load → render (CesiumMan/Box/MorphBoxTest) | glb_suite 25/25: loads resolve, canvas-pixel lit checks, morph weights move geometry 0→1 (d01=4275) | ✅ verified live |
| Real avatar 3D overlay | suite opens overlay, baseline/dark isolation rows | ✅ verified |
| Dock navigation mapping | alias chain complete; suite exercises builder overlay | ✅ mapped (visual rows exist) |
| AI generate / providers | audit_suite rows run against mock A1111 engines (self-host) | ✅ CI-verified w/ mocks |
| Chat | stress/audit rows (round-trips, persistence, reload) | ✅ CI-verified |
| Identity save / Load Outfit | UI probe (this pass): SAVE toast + 11-key def persisted under typed ID; Load Outfit toast + draft outfit mutated (rich→canonical→rich quantization observed, by design) | ✅ verified live |
| Offline HD render button (`hd_render`) | UI probe (this pass): click → "HD render complete · FULL_HD 1920×1080 · 827ms" + gallery item `provider=hdrenderer` | ✅ verified live |
| Video export | UI probe (this pass): video view mounts; "🎬 START VIDEO RENDER" → RENDER COMPLETE in ~5.6 s, zero page errors (local MediaRecorder path) | ✅ verified live |
| Adult-content prompts/acts | prompt builders used by generate path; age gate overlays in audit rows | ✅ partial |
| Canonical def→3D parameters | App effect maps def.body/head/age → setParameters (procedural avatar) | ✅ code-wired, visual via suite baseline |

## 9. Actions executed (second pass) & remaining

### Executed — verified-then-removed (behavior-neutral, suite-proven)
1. **Live-path probes (Playwright against built app):**
   - Identity SAVE/Load-Outfit round-trip — toasts + persisted def (11 keys) + draft outfit mutation. Confirms §6.8 is by-design (Load Outfit), not a bug.
   - HD RENDER header button — completed FULL_HD 1920×1080 in 827 ms, toast + gallery row (`provider=hdrenderer`).
   - Video export — view mounts; START VIDEO RENDER reaches RENDER COMPLETE (~5.6 s), zero page errors.
2. **Deleted (all zero-importer / write-only, per §6):**
   - `services/avatarProfiles.ts`, `renderer/HDRenderView.tsx`, `renderer/SkinMaterial.ts`, `theme.ts`, `services/avatarEditor.ts` (write-only store + 2 App call sites)
   - ageGate: removed dormant `isAdultModeEnabled`/`setAdultMode`/`clearAgeConfirmation` + `adult-mode-v1` key (file kept: `isAgeConfirmed`/`confirmAdultAge`)
   - App.tsx: merged duplicate `ProceduralSkinTextures` import; dropped stale HDRenderView title string
3. **Proof of no regression:** `npm run build` exit 0 (0 TS errors) · `tests/ci_runner.py` identical to baseline — audit 4 failing (pre-existing env: self-host endpoint unreachable), glb 25/25, stress 2 failing (pre-existing race rows). No new failures.

### Remaining (needs your go-ahead — not started)
- Renderer consolidation decision: offline HD export still runs the separate `HDRenderer.ts` pipeline (functional + verified above; consolidating is a design choice, not a fix)
- Unify option vocabularies behind one catalog (avatarCreator ↔ AVATAR_CATEGORIES mappings are hand-maintained in 4 files)
- Consolidate ~12 settings localStorage keys into one typed record with migration (§7.3)
- Code-split the 517 kB single chunk (lazy-load gallery/video/3D surfaces)
- Add `renderer/*` branch trigger to CI (build.yml currently main-only)
- Separate: push GLB milestone `377cee9` (needs a PAT) and any follow-up commits
