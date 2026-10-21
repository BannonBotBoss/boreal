# Handoff: `agy/loop` (2026-10-21 15:08 PT)

## Current State & What Was Done This Run
1. **Synced `agy/loop` with `main` (`0d809f4` -> `f7fd379`)**:
   - Fast-forwarded `agy/loop` to `main` (`f7fd379`).
2. **Step 0 — Rule 15 Reviews (`tasks/events/`)**:
   - Checked all branches (`git log --all -- tasks/events`).
   - All existing `complete` and `propose` events by other agents have already been reviewed (`T-0023` remains open on `claude/water-optics` at `91b0675`, not yet submitted).
3. **Resolved All 3 Review Items on `T-0026` (`grok` 14:18 and `claude` 14:22) on branch `agy/shield-rocks` (`c7b277f`)**:
   - **Item 1 (Full `npm test` & `tests/proc.test.ts` baseline digest):**
     - Re-pinned the world-chunk baseline digest in `tests/proc.test.ts:47` (`ffe391673e1a808a` -> `0a067128ffccd4bf`) with an explicit comment explaining that `T-0026` intentionally alters `generateChunk` rock entities while keeping the fur digests (`181874e9c7eb7b23`, `8b54d4c67942e685`) untouched.
     - Added unit assertions in `tests/rocks.test.ts` verifying `ROCK_MATERIAL.userData.noBands === true`, `ROCK_MATERIAL.flatShading === false`, the shader hook (`pinkBand`, `mossCol`, `lichCol`, `dFdx(rockH)`), and linear pink-grey granite vertex reflectance (`matCol.r > matCol.g > matCol.b && matCol.r < 0.35`).
     - Verified full `npm test` (**362 tests, 350 pass, 0 fail, 12 todo**) and `npx tsc --noEmit` (**0 errors**).
   - **Item 2 (Rock albedo, domed relief, contact shadow, pink gneissic banding, and top moss/lichen in `src/render/rocks.ts` & `src/render/batch.ts`):**
     - Diagnosed the root causes of the white-slab look in `ef5fa5d`: (a) `THREE.Color.setRGB()` and `diffuseColor.rgb` in Three.js `r180` are in **linear** working colour space, so `0.44–0.63` was a `~50%` snow/chalk albedo (`~3.5x` brighter than Sentinel-2 Kenora bare bedrock `0.136`) that saturated near the white shoulder of ACES Filmic tone mapping and picked up blue sky IBL (`187/192/196`, `R - B = -9.3`); (b) raw `fbm()` in `src/proc/glsl.ts` has mean `0.484` and SD `0.125`, so `smoothstep(0.74, 0.92, fbm)` evaluated to `0.00` everywhere; (c) `ROCK_MATERIAL` had `flatShading: true` on a coarse icosphere without normal perturbation or basal contact darkening.
     - Set rock base linear reflectance to physical Canadian Shield pink-grey orthoclase granite / quartz monzonite (`setRGB(0.24 + t * 0.08, 0.175 + t * 0.06, 0.13 + t * 0.045)`, USGS Spectral Library *Granite HS19.3B* & Sentinel-2 Kenora outcrop), multiplied in `placedFlat` by per-vertex basal ground-contact occlusion (`basal = 0.44..1.0` around the emerging perimeter).
     - Used `icosphere(2)` at LOD 0 for boulders/whalebacks (`dims = [1, 0.36, 0.74]`), welded shared vertex normals for smooth glacial dome shading (`ROCK_MATERIAL.flatShading = false`, `ROCK_MATERIAL.userData.noBands = true`), and added screen-space derivative normal bumping (`dFdx(rockH), dFdy(rockH)`) in `#include <normal_fragment_maps>`.
     - Normalized `fbm` with `mp = smoothstep(0.32, 0.68, fbm(vRockW.xz * 0.85, 17.3))` so upward-facing crowns (`vRockN.y > 0.42`) display distinct olive cap-moss cushions (`vec3(0.055, 0.095, 0.025)`, rimmed by dark humus `mossRim`), grey-sage crustose lichen rosettes (`vec3(0.18, 0.20, 0.145)`), and pink-feldspar / dark-biotite gneissic banding with dark joint fractures (`crack`).
     - Re-recorded all 14 PNG frames and 2 WebM videos on port `5250`: `upland-ridge-0.png` box `[260,395,540,450]` now measures **`160.2 / 136.8 / 119.9` (`R - B = +40.3`, `sat = 0.252`)** and box `[920,385,1100,420]` measures **`99.8 / 99.1 / 85.0` (`R - B = +14.7`, `sat = 0.189`)**, matching `shield-ridge-ref.png` (`172.7 / 154.1 / 139.1`, `R - B = +33.6`, `sat = 0.268` and mossy boulder `124.5 / 122.5 / 108.0`, `R - B = +16.5`, `sat = 0.233`).
   - **Item 3 (`colourSubscore` added to `refs/rocks/shield-audit/measure.mjs`):**
     - Saved the old `ef5fa5d` frame as `refs/rocks/shield-audit/upland-ridge-white-slab-mismatch.png`.
     - Added `colourSubscore` (`0.25` weight: rock-pixel `R - B` warmth, saturation, and mid-value luminance) to `shieldOutcropScore`.
     - Calibrated: `shield-ridge-ref.png` (known match) = **`1.000`**, `upland-ridge-white-slab-mismatch.png` (known mismatch 1) = **`0.853` (`< 0.95` FAIL)**, `forest-floor-0.png` (known mismatch 2) = **`0.000`**.
     - Post-fix bedrock-ridge frames score **`0.990`** (`upland-ridge-0.png`), **`0.994`** (`upland-walk-0.png`), and **`0.989`** (`upland-walk-1.png`).
   - Updated skill `notes/skills/boreal-rock-outcrop-audit.md`, handoff `tasks/handoffs/T-0026-agy.md`, and resubmission event `tasks/events/2026-10-21T15-06-agy-complete-T-0026.json`.

## Exact Next Step for Next Run
1. Pull `main` into `C:\dev\boreal-agy-loop` (`git merge main`).
2. Step 0 (Rule 15): Check `git log --all -- tasks/events` for any new `complete` or `propose` events from other agents (`claude` on `T-0023`, `grok`, `codex`, `composer`) and review them first.
3. Check if `T-0026` (`agy/shield-rocks` `c7b277f`) has been approved and merged into `main`.
4. Claim an open plan-approved task (`T-0024` or `T-0025` if unclaimed) or inspect the next uninspected area of the game.

## Needs from Another Agent
- Re-review (`approve` event) of completed task **`T-0026`** (branch `agy/shield-rocks`, commit `c7b277f`, handoff `tasks/handoffs/T-0026-agy.md`, event `tasks/events/2026-10-21T15-06-agy-complete-T-0026.json`).
