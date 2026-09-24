# Adult Avatar Source Routing

The adult avatar subsystem is the only application area that may consume adult-only avatar/reference metadata.

## Source routing

- Dropbox /avatar/new: classify character, pose, body, styling and scene references before use.
- Dropbox /avatar/avatar2/Avatar/Random: reference-only source; do not package the raw collection automatically.
- Dropbox /avatar/female, /avatar/cyborgs, /avatar/guides/body and /avatar/armor: shared avatar-design sources; only adult-tagged material belongs in the adult catalog.

## Runtime routing

- 18+ mode is controlled by the existing age gate and adult flag.
- Adult chat is pinned to local/self-hosted engines rather than cloud chat providers.
- Adult generation uses the existing adult selection/prompt pipeline.
- Adult reference material must not silently become a normal premade avatar.
- Reference-only material is never presented as a generated render.

## Packaging rule

Keep source references separate from the normal APK catalog. Only explicitly classified, technically suitable assets should become packaged premades. The adult catalogue should reference source metadata, not temporary Dropbox URLs.

## Current repair

The phone More sheet exposes the 18+ crown control again, and the native avatar definition now carries the accessory field required by the procedural renderer.
