# Phase 8 — device tests

14 instrumented tests that drive the **real installed APK** via UI Automator.

> **Status: WRITTEN BUT NEVER EXECUTED.**
> They were authored in a sandbox with 1,984 MB RAM, no swap and no `/dev/kvm`
> — Gradle OOMs there and no emulator can run, so these have never been
> compiled or run. Treat the first run as part of the test: expect to fix a
> selector or two against your actual device. Do not assume they pass.

## Run

Plug in a phone (USB debugging on) or start an emulator, then:

```bash
cd android

# debug build
./gradlew connectedDebugAndroidTest

# release candidate — what Android's guidance says to verify
./gradlew connectedReleaseAndroidTest \
  -Pandroid.testInstrumentationRunnerArguments.expectRelease=true
```

The `expectRelease=true` argument switches on the assertion that the release
APK is **not** debuggable. Without it that check is skipped, because deriving
the condition and the assertion from the same flag would make it tautological.

Reports land in `android/app/build/reports/androidTests/connected/`.

## What they assert

**`CriticalJourneyTest`** (7) — the app as a user meets it:

| Test | Asserts |
|---|---|
| `t01` | Launches and renders ≥5 real text nodes, still alive after a 3 s settle |
| `t02` | All 16 rail sections reachable and each **changes the screen** |
| `t03` | GENERATE responds and the UI returns to interactive (no wedge) |
| `t04` | Settings exposes both `11434` and `1234` endpoints |
| `t05` | Back produces no crash/ANR dialog |
| `t06` | Survives background → resume with content intact |
| `t07` | Package identity, INTERNET granted, release not debuggable |

**`PluginBridgeTest`** (7) — the native surface as shipped:

| Test | Asserts |
|---|---|
| `pluginClassesAreLoadable` | All 4 plugin/activity classes survived dexing |
| `pluginMethodsExist` | Every `@PluginMethod` the web layer calls is present |
| `termuxIntegrationIsDeclared` | `RUN_COMMAND` + `INTERNET` requested |
| `termuxIsVisibleUnderPackageVisibility` | `<queries>` present (mandatory API 30+) |
| `backupIsDisabled` | `allowBackup=false` — persona data stays on device |
| `cleartextIsPermittedForLoopback` | `127.0.0.1` reachable, else both servers fail |
| `packageIsCorrect` | `ai.grokgirls.studio`, not the scaffold package |

## Design notes

**UI Automator, not Espresso.** This is a Capacitor app: every screen is inside
one WebView. Espresso's view matchers see a single opaque node. UI Automator
reads the rendered accessibility tree, where the buttons actually are.

**No vacuous passes.** "The activity launched" is never accepted as proof.
`waitForWebContent()` blocks until real text renders, because a blank WebView
still satisfies "activity is showing" — exactly the false pass to avoid.
A journey that cannot find its target **fails**; it does not skip.

**Known environment dependency:** `t03` and `t04` assume no local server is
running, so GENERATE surfaces an honest error rather than an image. With Ollama
or sd-server actually running on the device, `t03` may take the success path —
still a pass, but the timing differs.
