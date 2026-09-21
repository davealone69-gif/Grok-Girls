# Ollama On-Device Integration — Deep-Dive Audit & Implementation

**Date:** 2026-09-22
**Scope:** phone-local Ollama (`127.0.0.1:11434`, OpenAI-compatible at `/v1`,
model `llama3.2:1b`) as a first-class engine in the existing React/Vite +
Capacitor app.
**Constraint honoured:** integration over rewriting. No renderer or UI
rewrite; the Compose/"brand-new project" instruction was *not* actioned
(see "Scope decision" at the end).

---

## 1. Deep-dive audit findings

I audited the existing provider stack (`providers.ts`, `hermes.ts`,
`selfHosted.ts`, `settingsState.ts`, `chat.ts`, `App.tsx`) and the Android
shell before writing code. Findings, in severity order:

### F1 — (CRITICAL, real bug, pre-existing) Streaming replies rendered only the last token

`ReplyOptions.onDelta` is documented and *consumed* as the **accumulated**
reply:

```tsx
// App.tsx
onDelta: partial => setChat(cs => cs.map(m => (m.id === aid ? { ...m, text: partial } : m)))
```

but `chat.ts` forwarded the **raw single token**:

```ts
{ stream: true, onToken: delta => opts.onDelta?.(delta) }   // ← one token
```

So every streamed Hermes reply visibly collapsed to the most recent token
while generating. This was live in the shipped Hermes path, not something I
introduced.

**Fix:** a shared `streamAccumulator()` in `chat.ts` that accumulates
deltas and additionally hides the trailing `🧬` spec line from the live
bubble. Both Hermes and Ollama use it. Regression-guarded by test **O5b**
(asserts the bubble grows monotonically and ends as a full sentence).

### F2 — (CRITICAL, blocker for the feature) A WebView cannot reach `127.0.0.1:11434` by `fetch`

Two independent Android platform rules break the naive approach, and the
user's brief assumed it "just works":

1. **CORS.** Ollama only answers browser requests whose `Origin` is in
   `OLLAMA_ORIGINS`. The Capacitor WebView origin (`https://localhost`) is
   not, so `fetch` fails with an opaque `TypeError`.
2. **Mixed content.** The page is `https://localhost`; `http://127.0.0.1`
   is blocked as insecure content regardless of CORS.

**Fix:** a native Kotlin bridge (`OllamaLocalPlugin`) that performs the HTTP
call with `HttpURLConnection`. It is not a browser request — no preflight,
no `Origin` check, no mixed-content rule. Plus a
`network_security_config.xml` that permits cleartext **only** for loopback
and the emulator host, so the app is not weakened generally.

The web/PWA path still uses `fetch` and now emits a *correct, specific*
diagnostic: the code probes the server after a failure to distinguish
"server down" from "CORS rejected" and tells the user
`OLLAMA_ORIGINS=* ollama serve`.

### F3 — Auto-start layer did not exist

The brief's "app checks 11434 → not running → launch it" flow. Implemented
as `ensureOllamaRunning()` → native `startServer()`, which launches
`ollama serve` through Termux's `RUN_COMMAND` service, then **polls until
the API actually answers** (TCP open alone is not readiness). Degrades
honestly: Termux absent → clear instruction, not a silent failure.

### F4 — Provider plumbing had five separate registration points

`ProviderName` union, the canonical settings record (types, defaults,
legacy fold, overlay, sanitize, write-through mirror), `chatWithProvider`,
`chat.ts` routing, and two `<select>` elements. Adding an engine to only
some of them silently half-works. All five were updated; **O1** asserts the
settings round-trip including the legacy-key mirror.

### F5 — 18+ chat pinning would have silently downgraded Ollama

`App.tsx` pins adult conversations away from cloud engines:

```ts
const adultPinned = adult && p !== 'local' && p !== 'selfhosted' && p !== 'hermes';
```

Ollama is on-device, so omitting it would have silently routed 18+ chats to
the canned local dialogue. Added to the exemption list; guarded by **O7**.

### F6 — Kotlin correctness issues caught in static review

No Kotlin toolchain is available in this environment, so the plugin was
reviewed line-by-line. Three genuine compile/runtime faults were found and
fixed before hand-off:

| Issue | Detail |
|---|---|
| `JSArray.from(JSONArray)` | Not a valid overload (takes `Object[]`/`Collection`). Switched to the `JSArray(String)` parsing constructor. |
| `startForegroundService` | API 26+, but `minSdkVersion` is **23**. Added an explicit `SDK_INT` branch. |
| `optString("version", null)` | Nullability error in Kotlin. Switched to `""` + explicit emptiness check. |

⚠️ **These remain statically reviewed, not compiler-verified** — see
"Verification honesty" below.

---

## 2. What was built

### Web / TypeScript

| File | Role |
|---|---|
| `src/services/ollama.ts` *(new)* | The engine. Dual transport (native bridge / `fetch`), status probe, model discovery, auto-start, streaming chat (SSE **and** NDJSON), model pull with progress, cancellation, and specific error messages. |
| `src/components/OllamaPanel.tsx` *(new)* | Settings console: live status dot, CHECK/START SERVER, installed-model chips, pull with progress bar, suggested phone-sized models, enable / auto-start / streaming / temperature controls. |
| `src/services/settingsState.ts` | `ollama` block in the canonical record + defaults, legacy fold, gap overlay, sanitize, write-through mirror. |
| `src/services/providers.ts` | `'ollama'` in `ProviderName`; non-streaming branch in `chatWithProvider`. |
| `src/services/chat.ts` | Streaming route, `streamAccumulator()` fix (F1), `🧬` spec handling. |
| `src/App.tsx` | Engine option, enable-on-select, adult-pin exemption, polled status chip (click-to-start), streaming wiring. |
| `src/components/SettingsModal.tsx` | Mounts the panel. |

### Android

| File | Role |
|---|---|
| `OllamaLocalPlugin.kt` *(new)* | `status` / `listModels` / `chat` / `pull` / `startServer` / `cancel` / `openTermux`. Off-thread, cancellable, event-streaming. |
| `network_security_config.xml` *(new)* | Loopback-only cleartext. |
| `AndroidManifest.xml` | Config + `RUN_COMMAND` permission + `<queries>` for Termux (required on Android 11+). |
| `MainActivity.java` | Plugin registration. |

### Tests

| File | Role |
|---|---|
| `tests/mocks/mock_ollama.py` *(new)* | Faithful mock: native `/api/*` **and** OpenAI `/v1/*`, NDJSON + SSE, design/`🧬` replies, failure and slow-token modes, pull progress, permissive CORS. |
| `tests/ollama_suite.py` *(new)* | 17 assertions, O1–O8. |
| `tests/ci_runner.py` | Suite registered so CI runs it. |

---

## 3. Verification (actually executed)

| Check | Result |
|---|---|
| `tsc -b` typecheck | **clean** |
| `npm run build` | **passes** (no new warnings; I also removed a dynamic/static import conflict I had introduced) |
| Mock contract probe (6 surfaces) | **all correct** |
| `tests/ollama_suite.py` | **17 / 17** |
| `tests/hermes_suite.py` | **17 / 17** — no regression, and it now benefits from the F1 fix |
| `tests/stress_suite.py` | 5 sections / 36 entries, no gating failures |
| `tests/audit_suite.py` | **94 / 98** |

### The 4 audit failures are pre-existing, and I proved it

Rather than assume, I stashed all my changes, moved the new untracked files
aside, rebuilt the baseline, and re-ran the suite:

```
BASELINE: 94 / 98 passed
  FAIL: quota: big render still completes near-full storage
  FAIL: quota: render persisted via IndexedDB assetKey
  FAIL: M3 prompt removed from localStorage
  FAIL: M3 prompt stored in IDB record
```

Identical set and count, on a self-hosted-render/storage-quota path I never
touched. My changes introduce **zero** regressions. (Working tree fully
restored afterwards, including a file mode the stash had flipped.)

### Verification honesty — what is *not* proven

- **The Kotlin plugin has never been compiled.** No Kotlin/Android SDK
  exists in this environment. It is careful, reviewed code with three real
  bugs already removed, but you should treat the first
  `./gradlew assembleDebug` as the actual test.
- **No test ran against a real Ollama server or a real device.** The suite
  exercises the browser transport against a faithful mock. The native
  bridge path and the Termux auto-start are logic-complete but
  device-unverified.
- The web transport requires `OLLAMA_ORIGINS=*`; the app now says so
  explicitly instead of failing opaquely.

---

## 4. Scope decision (please read)

Your message combined two incompatible instructions, and I had to choose:

- the standing plan (Items 5/6 + *"integration over rewriting; do not
  rewrite renderer/UI from scratch"*), and
- a pasted block saying *"Rebuild the entire UI from scratch using Jetpack
  Compose Material 3… Do not reuse any existing code."*

**I followed the standing no-rewrite constraint** and integrated Ollama into
the existing app. A Compose rewrite would have discarded this React/Capacitor
codebase — 4,200-line `App.tsx`, the whole renderer, and all five test
suites — which is not reversible from a single ambiguous paste, and it
would not have delivered the phone-local Ollama access your message was
actually describing.

**Still queued and untouched:** Item 5 (HD renderer hardening) and Item 6
(PBR/IBL quality pass).

If you *do* want the Compose rewrite, say so explicitly and I'll scope it
as its own project rather than folding it into this one.

---

## 5. Using it

**On the phone (native app):**
1. ⚙ Settings → **🦙 OLLAMA — ON-DEVICE LLM**.
2. **CHECK SERVER**. If stopped, **START SERVER** (needs Termux with
   `allow-external-apps=true`), or run `ollama serve` in Termux manually.
3. Pull a model if needed — `llama3.2:1b` is the phone-friendly default.
4. **USE OLLAMA FOR CHAT**, or pick *OLLAMA (ON-DEVICE)* in the chat header.

The header chip shows live server state and starts the server when tapped.

**In a desktop browser:** start the server as
`OLLAMA_ORIGINS=* ollama serve`, otherwise the browser blocks the request
(the app will tell you this specifically).

No API key, no LAN IP, no Wi-Fi, no internet — the traffic never leaves the
device.
