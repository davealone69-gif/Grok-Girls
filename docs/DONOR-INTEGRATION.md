# Grok-Girls donor integration work

This branch is the integration branch for the full avatar-engine recovery.

## Verified donor sources

- 3DDD: real Android Filament studio renderer, glTF/GLB loader, skeletal animation, morph targets, materials, lighting, offscreen capture, procedural avatar parts and repair supervisor.
- 3d-models: mature GLES3 HD renderer, GLB loader, PBR pipeline, textures, IBL, animation and native touch viewport. Grok-Girls already contains this engine lineage under native/.
- Grok-Girls: existing React/Capacitor UI, canonical avatar VM, WebGL2 HD renderer, native AvatarStudio bridge, Ollama bridge, gallery and tests.
- Aura-Studio-Avatar / AuraAvatarStudio / Aura-Avatar: avatar-studio lineage checked for reusable architecture; no stronger renderer than the 3d-models/3DDD implementations found in the indexed code.

## Critical finding

Grok-Girls currently has multiple renderer paths, but the native GLES path only receives the canonical 11-field AvatarDefinition and its current NativeAvatarActivity applies only exposure/IBL/camera changes. It does NOT map hair/body/face/accessory/outfit selections into native geometry. That is why a visible 3D engine can exist while the selected character still looks like the fixed bundled GLB.

3DDD's PartBuilder explicitly contains a real CROWN accessory geometry path, plus hair, outfit, augment and tattoo geometry. This is the donor path to wire into the phone renderer rather than inventing another renderer.

## Rule for this branch

Do not replace the working Grok-Girls UI or renderer wholesale. Reuse the existing paths and transplant only the missing native customization/scene layer, then build and runtime-test before calling it complete.
