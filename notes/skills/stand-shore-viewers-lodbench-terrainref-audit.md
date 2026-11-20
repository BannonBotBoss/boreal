# Skill: `stand-shore-viewers-lodbench-terrainref-audit`

Reusable workflow for auditing Boreal's boreal stand/allometry/shore/radial math, wolf-LOD & hare forelimb locomotion bench diagnostics, interactive HTML/WebGL species/skeleton/gait/tree viewer pages, and aerial-exemplar/terrain-reference Python pipelines.

## When to use
- When inspecting `src/core/stand.ts`, `src/core/flora/trees/forms.ts`, `src/core/flora/stands.ts`, `src/core/landingShore.ts`, and `src/world/globe/radial.ts` for boundary, ecological, and geographic defects.
- When running and auditing `tools/wolf-lod-bench.ts`, `tools/elbow-pop.ts`, `tools/touchdown-pop.ts`, `tools/bound-reach.ts`, and `tools/ref-prompt.ts`.
- When visually inspecting interactive viewer pages (`tools/skeleton-sheet.html`, `tools/gait-sheet.html`, `tools/wolf-sheet.html`, `tools/bear-sheet.html`, `tools/hare-sheet.html`, `tools/wolf-portrait.html`, `tools/bound-lab.html`, `tools/wolf-lod-view.html`, `tools/tree-viewer.html`) in headless Chromium.
- When auditing `tools/bake-aerial-exemplars.py`, `public/aerial/`, and `tools/terrain-ref/{metrics,compare,topmap}.*`.

## Tools & files inspected
- **Stand, allometry, shore & radial**: `src/core/stand.ts`, `src/core/flora/trees/forms.ts`, `src/core/flora/stands.ts`, `src/core/landingShore.ts`, `src/world/globe/radial.ts`.
- **Locomotion & LOD diagnostics**: `tools/wolf-lod-bench.ts`, `src/render/gaitLod.ts`, `tools/elbow-pop.ts`, `tools/touchdown-pop.ts`, `tools/bound-reach.ts`, `tools/ref-prompt.ts`.
- **Interactive viewers**: `tools/skeleton-sheet.ts`, `tools/gait-sheet.ts`, `tools/wolf-sheet.ts`, `tools/bear-sheet.ts`, `tools/hare-sheet.ts`, `tools/wolf-portrait.ts`, `tools/wolf-lod-view.ts`, `tools/bound-lab.ts`, `src/render/trees/viewer.ts`.
- **Aerial & terrain-ref pipelines**: `tools/bake-aerial-exemplars.py`, `public/aerial/{meta.json,source/water.png}`, `tools/terrain-ref/{metrics.py,compare.py,topmap.ts}`.

## Steps
1. **Ecological & boundary probes**:
   - Evaluate `standStructure`, `speciesStems`, `standDbh`, `ageFromU`, `heightAt`, `dbhAt`, `farTreesInTile`, `nearestShore`, and `parseAxisDir`/`axisPoint` at extremes (`age = 0`, negative age, `wet = 1.0`, `u < 0` / `u > 1`, `density = 2`, poles/antimeridian, dry origin, blank/invalid URL strings, unnormalized vectors).
2. **Locomotion & LOD bench execution**:
   - Run `loadWolf`, `reboundTemplate`, `lowTemplate`, `wrapperRatio`, `stanceSlip`, `switchPop`, `terrainCheck`, `elbowCell`, `popCell`, and `reachBudget` directly from ESM TypeScript (`npx tsx`).
   - Compare `touchdown-pop.ts` counts against `elbow-pop.ts` full-segment angular velocity peaks (`scap`, `hum`, `elbow`/`fore`, `manus`) so silent partial-gate false passes are caught.
3. **Aerial & terrain-ref Python verification**:
   - Inspect shipped `public/aerial/source/water.png` for `2×2` nearest-neighbor pixel duplication (`even` vs `odd` row/column max diff).
   - Run `tools/terrain-ref/metrics.py` against a flat dry grid, tilted dry ramp, and an exact synthetic circular lake (`D_L >= 1.0` per Hutchinson 1957).
4. **Live Chromium capture**:
   - Serve the repo on an agent-owned port (e.g. `npx vite --host 127.0.0.1 --port 5269 --strictPort`, never `5173–5209`).
   - Run `npx tsx refs/audit/stand-shore-viewers-lodbench-terrainref-audit/audit.ts http://127.0.0.1:5269` to capture `recording.webm`, `frame-0..2.png`, `wolf-sheet` canvas readback, and `numbers.json`.
   - Always close the browser in `finally` and stop the temporary Vite server immediately after capture.
   - Visually compare `frame-0..2.png` against `reference/ref-0..2.jpg`.

## Checks that prove it worked
- `calibrationValid = true` and `5 / 5` checks `>= 0.95` in `numbers.json` after fixes.
- `npx tsc --noEmit` exits `0`.
- `npx tsx --test tests/tasks.test.ts tests/gait-gate.test.ts tests/sim-home.test.ts tests/rules.test.ts` passes with `0` new rule breaks.

## Mistakes to avoid
- Do not forget `preserveDrawingBuffer: true` on single-frame WebGL sheet tools (`wolf-sheet`, `bear-sheet`, `wolf-portrait`), or `drawImage`/`toDataURL` readbacks return blank transparent pixels.
- Do not trust `touchdown-pop.ts` `0/0` counts without checking humerus/elbow/forearm peaks in `elbow-pop.ts`.
- Do not test `metrics.py` only on the Kenora lake-rich DEM; always test flat, lake-free, and exact-circle synthetic grids.
- Remember `AGENTS.md`: TypeScript simulation files in `tests/sim-home-ceiling.json` may only shrink; implement new/repaired simulation math in `rust/boreal-sim`.
