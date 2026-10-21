# Skill: Boreal Rock, Outcrop & Forest-Floor Prop Audit (`boreal-rock-outcrop-audit`)

Use when inspecting or verifying geological features (rocks, boulders, Canadian Shield bedrock outcrops, shoreline cobbles, slope seating) and forest-floor prop scale (`forage`, `plant`, `log`) against ecological and geological sources. First created by `agy` during the 2026-10-21 Shield rock & forest-floor inspection (`refs/rocks/shield-audit/`, `T-0026`, `T-0027`).

## Steps
1. **Probe the generator across chunks with `STAGES.on = true` (`refs/rocks/shield-audit/probe.ts`):**
   - Always set `STAGES.on = true` (matching `world.stagedTerrain` default in `renderSettings.ts`) and center the sample grid on `dryStart(0, 0)` from `src/core/stages/surfaceAt.ts`.
   - Measure rock counts per dry-land hectare, Wentworth size-class histogram (`pebble < 0.064 m`, `cobble 0.064–0.256 m`, `boulder > 0.256 m`, Wentworth 1922), Clark-Evans nearest-neighbour index $R$, fraction of stones on bedrock uplands (`siteAt(x, z).rock > 0.3`), and fraction of stones whose height (`rockDiameter(e) * ROCK_SHAPES[shape][1]`) is less than or equal to the local organic forest floor thickness (`column(x, z)` in `src/core/ground.ts`: `moss + freshLitter + fragmented + duff + humus + peat`).
2. **Record matched in-game views (`refs/rocks/shield-audit/capture.mjs`):**
   - Serve the worktree on an `agy` preview port (`5250–5269`) and launch headless Edge with `--disable-gpu-vsync --disable-frame-rate-limit` and `--user-data-dir=C:/dev/boreal-agy-edge` (outside the worktree so Vite's file watcher never hits locked profile files), wrapped in `tools/bench-lock.mjs` `acquire`/`track`/`release`.
   - Record both a clay/till forest-floor view (`?nomenu&bench&hour=11&at=38.5,-1.5,0`) and a stage-3 bedrock-ridge view (`?nomenu&bench&hour=11&at=128.7,21.5,0`, where `soilAt().kind === 'bedrock'` and `siteAt().rock === 0.85`), capturing PNG sequences and `MediaRecorder` WebM clips.
3. **Measure with a calibrated zero-dependency script (`refs/rocks/shield-audit/measure.mjs`):**
   - Decode PNGs via `node:zlib` (`inflateSync` + PNG row unfiltering) over the ground-plane ROI (`x in [240, 1220], y in [400, 636]`), masking out the wolf silhouette (`[535, 350, 695, 720]`), the floating senses ring (`[385, 350, 790, 435]`), and the bottom HUD prompt pill (`[420, 560, 760, 640]`).
   - Run 8-connected components on mineral rock pixels (`isMineral && !isFoliageOrMoss && !isPaleLichen && mean >= 112`) to compute `rockCoverShare`, `largestFeatureWidthPx`, `largestRatioToWolfWithers`, and `shieldOutcropScore = 0.5 * min(1, rockCoverShare / 0.18) + 0.5 * min(1, (largestFeatureWidthPx / wolfWithersHeightPx) / 1.0)`.
   - Verify calibration (Rule 11): known match (`refs/rocks/reference/shield-ridge-ref.png`) scores `0.984`; known mismatch (`forest-floor-0.png`) scores `0.000`.

## Checks that proved it worked
- `probe.ts` revealed that `100%` of game rocks are `<= 0.50 m` (`78.1%` under `20 cm`), `48.9%` sit on top of an organic moss/LFH floor thicker than the stone itself, and placement is uniform Poisson (`Clark-Evans R = 1.127`) regardless of `siteAt().rock`.
- `measure.mjs` separated the accepted Canadian Shield bedrock ridge nature reference (`0.984`) from the game's bedrock ridge (`0.015`).

## Mistakes to avoid
- **Forgetting `STAGES.on = true` in standalone node scripts:** Without `STAGES.on = true`, `heightAt` and `siteAt` evaluate the unstaged terrain, so coordinates that are dry in unstaged mode may lie inside a stage-2b lake in the live game.
- **Headless Edge screenshot timeouts:** Always pass `--disable-gpu-vsync` and `--disable-frame-rate-limit` to headless Edge when capturing screenshots alongside `MediaRecorder`.
- **Unmasked HUD/halo elements in image metrics:** Always log `largestFeatureBox` `[x0, y0, x1, y1]` in `measure.mjs` to verify that connected components measure world geometry rather than the senses halo ring or HUD buttons.
