# T-0123 handoff (grok-globe): boot splash, no unstyled flash

**State:** built and verified on the box; pushed to `grok-globe/boot-splash` and merged to main on Matthew's direct instruction
(2026-10-28 7:10 PM PT "push yourr work to the main", 7:14 PM PT "just do it, i said").

## What was built
- `index.html`: inline `<style>` in `<head>`: `html{background:#16241d}body{margin:0;overflow:hidden}` plus the existing `#loading`
  rules, moved out of `src/style.css` (one copy). The existing loading screen now covers the page from the first paint.
- `src/style.css`: the `#loading` line replaced by a comment pointing at index.html.
- `src/world/globe/entry.ts`: `bootFailed` catches each boot `import()` and writes the error on the splash step line.
- `tests/boot-splash.test.ts`: the inline style, the single copy, and the four catches.

## Root cause
Slow-load flash, not a stuck CSS file: Vite dev injects `src/style.css` from JS only after `main.ts` and its whole import graph
load (8.2 s on the box at CPU 4x / 120 ms latency, cache off). The standalone `?view=globe` page (used when the in-page globe
cannot enter, e.g. software GL) never imports style.css, so it flashed the same raw page for ~5 s more. Matthew's screenshot has
"Starting…" and an empty fact line, i.e. main.ts had not run yet; whether his load was slow or failed cannot be told from the
picture. A failed boot import was unhandled and would have left that page up for good; it now says so on the splash.

## Verify
- `npx tsx --test tests/boot-splash.test.ts`, `npm test`, `npx tsc --noEmit`, `npx vite build`.
- `node refs/T-0123/tools/capture.mjs 'http://127.0.0.1:<port>/?start=globe&stages=1&trees=v2' <out> 120` (needs puppeteer-core
  and Chrome), count frames >50 % near-white.

## Evidence (refs/T-0123/)
- `boot-before-after.jpg`: grid. Before (origin/main 30217f4): 97/128 frames white and unstyled (f000-f057 = 0.3-8.2 s, f087-f125
  = 113.6-118.9 s on the ?view=globe reload). After: 0/125.
- `before/`, `after/`: sampled frames + `frames.json` (per-frame DOM probe: #loading position/background, html background).
- `failed-import.jpg`: `/src/main.ts` aborted; the splash reads "Boreal could not start (Failed to fetch dynamically imported module
  …). Reload the page to try again."
- `after-build-f000.jpg`: production build (vite preview), dark splash in the first frame.

## Numbers
| value | game | real | ok |
|---|---|---|---|
| splash fade | 0.9 s (unchanged) | n/a, UI timing | N/A |
No new rates or sizes; the frame gate is N/A (UI, not nature). Measured: white-frame count, metric = share of pixels with luma >235
over 50 % of a 160x100 thumbnail; calibration: the known-raw frame f000 before = white, the known-styled splash f058 = not white.

## Leftovers
- Standalone `?view=globe`: globeView hides #loading with display:none (no fade). Only reached when the in-page globe fails to enter.
- Approve-plan / approve for Matthew (rule 16b) still need recording by a relaying Grok bot.
