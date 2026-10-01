# Phone UI audit harness

Renders the **built** app in headless Chrome at phone size (390×844) and reports
every visible control, so "there are duplicate buttons" becomes a number you can
measure instead of a guess.

```
bash tools/ui-audit/run_audit.sh
```

It prints one line per state, e.g.:

```
===== 01-initial: 44 visible controls, 44 distinct labels, 0 duplicated =====
===== 02-more-open: 36 visible controls, 36 distinct labels, 0 duplicated =====
===== 03-inspector: 46 visible controls, 46 distinct labels, 0 duplicated =====
```

`0 duplicated` means no two visible controls share a label — which is the actual
acceptance criterion for the phone layout. JSON dumps and screenshots land in
`tools/ui-audit/shots/` (gitignored).

## What it does

1. `audit_ui.mjs` drives three states: initial, MORE sheet open, inspector open.
   For each it enumerates `button, [role=button], [role=tab]`, keeps only those
   that are laid out, non-zero size, inside the viewport and not
   `display:none`/`visibility:hidden`/transparent, records the centre point, and
   flags `occluded` when `document.elementFromPoint()` at that centre is not the
   control itself — i.e. something is painted on top of it.
2. Labels are grouped; anything appearing more than once is printed with both
   positions and its DOM ancestry, so the duplicate's source is obvious.

## Setup notes (sandbox)

- `puppeteer` is installed into `tools/ui-audit/node_modules` (not a repo
  dependency — this is a verification tool, not part of the app).
- Chrome cannot be `apt install`ed here (no root), so `run_audit.sh` downloads
  **chrome-headless-shell** and unpacks the nine shared libraries it needs from
  the Debian trixie pool into `tools/ui-audit/sysroot/`, then points
  `LD_LIBRARY_PATH` at it.
- The app must be built and served first: `npm run build`, then anything serving
  `dist/` on `http://127.0.0.1:4173`. `run_audit.sh` starts a static server if
  that port is not answering.

Override the target with `AUDIT_URL`, e.g.
`AUDIT_URL=http://127.0.0.1:5173 bash tools/ui-audit/run_audit.sh` to audit the
dev server instead of the production build.
