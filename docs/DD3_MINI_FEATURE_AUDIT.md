# DD³ / 08REDRUM Mini Feature Audit
Date: 2026-09-24
Branch: work/full-repo-donor-integration

## Current status

### DONE / WIRED
- 18+ crown exists on desktop and phone More sheet.
- Adult age gate and adult flag routing exist.
- Canonical avatar model carries accessory.
- Female / Male / Cyborg family work is the target architecture.
- Dropbox adult source manifest and routing docs are present.
- Ollama local chat/server plumbing exists.
- Stable Diffusion local provider plumbing exists.
- Native HD/GLES renderer exists.
- Menu XML parser + canonical menu model exist.
- Persona save/load/export/import, gallery, chat, story and video page code exist.
- Web build currently passes in the latest CI run.
- Latest Android debug APK build passes after the accessory fix.

### PARTIAL / NEEDS RUNTIME PROOF
- Android device/UIAutomator journey. Latest run still fails during native test execution, so no zero-trust claim of phone-wide runtime success.
- Browser audit/stress suite. Latest run still returns FAIL despite many individual suites passing.
- Native avatar parts driving every selected UI option through final GLES/HD/offscreen/export path.
- Full Male and Cyborg asset libraries from Dropbox.
- Local Ollama + Stable Diffusion end-to-end on a real phone.
- Automatic Termux/server startup on the actual phone.
- Animations/poses/scene/camera/lighting/export end-to-end.
- Gallery/save/load/customization full phone journey.
- Adult reference asset import. The source manifest exists, but raw Dropbox binaries have NOT been falsely claimed as committed.

### NOT YET DONE
- Final DD³ / DoubleD³ / 08REDRUM branding migration.
- Startup/intro video integration.
- Final phone-first menu redesign requested previously.
- Final complete button-to-operation audit after the current menu/branding changes.
- Final release APK verified on physical Android hardware.

## REQUIRED MENU STYLE
The previously requested menu is:
1. One clean navigation system, not duplicate desktop/phone menus pretending to be separate feature sets.
2. Native Android-style phone navigation.
3. HD/futuristic DD³ visual treatment.
4. Every visible destination must map to a real handler.
5. Builder categories should be grouped instead of dumping every tiny option into the primary rail.
6. More/overflow is acceptable only for secondary destinations, never as a hiding place for unfinished features.
7. No dead toast-only buttons.
8. Adult crown remains a distinct gated control.
9. Settings, Gallery, Chat, Presets and Builder remain immediately reachable.
10. Female / Male / Cyborg family selection should be obvious at the top of the builder.

## CURRENT MENU PROBLEM
The code has a canonical XML menu, but it still defines a large 19-item desktop rail while phone mode pins only four primary destinations and puts the rest behind a More sheet. That is functional architecture, but it is NOT yet the single clean native-phone menu previously requested.

## STARTUP VIDEO
No startup/intro video asset or launch-video implementation is currently present in the repo search.

Previously agreed visual direction:
- 9:16 portrait
- OLED black
- deep red light / haze
- stylised Female → Male → Cyborg silhouettes
- wireframe/scanning/glitch treatment
- fast cinematic cuts
- final title:
  08REDRUM Studio presents
  DoubleD³ Studio
  DD³

The existing Android splash infrastructure is only a static Android splash. It is not the requested cinematic intro.

## BRANDING
Current repo/app branding is still Grok Girls / Grok Girls Studio.
Target presentation:
- 08REDRUM Studio presents
- DoubleD³ Studio
- DD³

Do NOT do a half-rename. Branding migration should update the user-visible Android/web name, intro, manifest/icon/splash text, README and relevant visible labels together, while preserving package IDs unless there is a deliberate migration plan.

## NEXT ZERO-TRUST GATE
Do not call the app finished until:
- menu redesign is implemented and every menu item is traced to its handler;
- startup intro is integrated or explicitly disabled;
- branding is internally consistent;
- browser suite is green;
- Android build is green;
- Android device/UIAutomator journey is green;
- physical phone smoke test confirms the critical paths.
