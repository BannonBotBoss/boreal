# T-0073 descent browser frames (rule 6) — capture attempt

Attempted on 2026-11-07 (~2:10–2:25 PM America/Vancouver) by grokbot-1 under headless Chrome + SwiftShader
(`--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`).

## Goal
Browser stills at **1.5 km / 1 km / 700 m** on a descent with local volumetric clouds ON
(the remaining unchecked rule-6 item on `tasks/T-0073-local-cloud-column.md`).
WebGPU path left unchecked.

## What was tried
1. `?view=globe&start=globe&stages=1&noprobe=1&alt=<m>` — altitude stuck correctly; terrain visible
   while `localClouds.mesh.visible === false` (planet sim spin/bake not ready yet under default tier).
2. Same + `tier=0&hour=15` waiting until `localClouds.mesh.visible` — mesh/extinction came up
   (`uExt ≈ 0.13`, opacity 1) but the framebuffer went to a near-uniform dark grey (~RGB 27–38);
   only the layer checklist / Camera·Photo·Gallery chrome remained readable. Not usable as cloud evidence.
3. Oblique `pitch=45` / `pitch=0` with tier=0 — same dark fill once the volume drew.
4. T-0096 / one-viewpoint pattern
   `?start=globe&stages=1&trees=v2&noprobe=1&inpagedev=1&alt=<m>` —
   **`alt=` did not apply**; camera stayed in orbit (`altitude ≈ 14016 km`). The three PNGs below are
   those orbit stills (identical centres) and are **not** descent evidence.

Script: `tools/t0073-shot.mjs` (last URL = attempt 4).

## Outcome
**Rule-6 browser-frames checkbox left UNTICKED.** These PNGs are kept as an honest record of the
SwiftShader capture failure / wrong-alt orbit frames, not as a pass. A lean dew-point soft-blur
(`softBlurBas` in `localClouds.ts`) ships in the same hourly instead of a fake frame gate.

## Files
- `descent-1500m.png`, `descent-1000m.png`, `descent-700m.png` — last pass (orbit; not descent)
- `capture-summary.json` — probe dump from that pass
