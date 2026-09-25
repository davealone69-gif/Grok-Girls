# Dropbox Avatar Asset Source

This repository's avatar source-of-truth is the connected Dropbox collection at `/avatar`.

## Canonical families

- Female: `/avatar/female` and `/avatar/avatar2/Avatar/Females`
- Male: canonical family is reserved in the app even though the current Dropbox collection has fewer dedicated male source files than female/cyborg.
- Cyborg: `/avatar/cyborgs` and `/avatar/avatar2/Avatar/Cyborgs`
- Body references: `/avatar/guides/body` and `/avatar/avatar2/Avatar/Random/Bodys`
- Armour: `/avatar/armor`
- Tattoo references: `/avatar/guides/Tats-1.jpg`, `/avatar/guides/Tats-2.jpg`
- Intro source: `/avatar/intro`
- Brand icon source: `/avatar/icon/images (9)(1).jpg`

## Verified intro source files

| File | Size | SHA-256 |
|---|---:|---|
| `/avatar/intro/female.png` | 1,843,515 | `cd19ca3c764304b7576ae0ac69ba4452022f5e68d4153cd1c35b50710f6b4b10` |
| `/avatar/intro/male.png` | 1,601,132 | `e6cd0fadbe682137eb69a5f7504bac7d11ae132e1a33f11fa937e8fdc4d43924` |
| `/avatar/intro/cyborg.png` | 1,950,606 | `abaf3fea039eb5ffe46cc67371f05e8d1351b3da26affd385f563f227ea20140` |
| `/avatar/intro/smoke.png` | 1,665,988 | `49a7c4146ac41fac9ea65a260acfb9964bc6cf193fc20b499bce206662a466b9` |
| `/avatar/icon/images (9)(1).jpg` | 23,070 | `d61f322853da4826a7a1430e0d5765bb39d32f643af7538ee515b12b5e1f9213` |

## Import policy

1. Dropbox source assets are not treated as generated renders.
2. Duplicate `female` and `avatar2/Avatar/Females` trees are source mirrors, not two separate avatar libraries.
3. The app's canonical runtime families are **Female / Male / Cyborg**.
4. Intro artwork is separate from the premade avatar catalog.
5. Adult/random reference material is not automatically bundled into the APK. It remains source material until explicitly classified and legally/technically suitable for packaging.
6. No temporary Dropbox download URL is committed to source code. Temporary links expire and are not an offline asset strategy.
7. Before binary assets are committed, their SHA-256 is recorded and CI must verify the committed bytes.

## Current state

The Dropbox collection has been fully enumerated and the canonical intro/icon files have been verified by size and content hash. Binary import is intentionally kept separate from the application source so the app never silently substitutes a remote or expired Dropbox URL for a local asset.

