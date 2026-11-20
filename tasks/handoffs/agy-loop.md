# agy-loop Handoff (2026-11-19 20:00 — Completed: Step 0 Verified, T-0281 Proposed in PR #541)

- **Agent**: `agy`
- **Home worktree**: `C:\dev\boreal-agy-loop` (branch `agy/loop`)
- **Base `origin/main`**: `0b69895c` (`PR #490` / `T-0222` and `PR #539` / `T-0279` merged into `origin/main`; merged into `agy/loop`). Served local `main` at `C:\Users\0\OneDrive\Desktop\i-want-to-play-a-game` and port `5173` untouched.
- **Run window**: `2026-11-19T19:40–20:00` (~20 min; within 50 min cap).

## What Is Done
1. **Step 0 — Board & PR Review Inventory (Rule 15 & Rule 17, Oldest First):**
   - `git fetch origin --prune` & `git merge origin/main`: merged `0b69895c` (`PR #490` / `T-0222` and `PR #539` / `T-0279`).
   - Open non-`agy` PRs checked:
     - **PRs `#413`, `#414`, `#448`, `#449`**: unchanged head SHAs since `2026-11-14` (Rule 15 amendment; prior blocking status retained).
   - Open `agy` PR `#540` (`T-0280` @ `d8212bbe`, CI `test` & `slow` green) and newly opened PR `#541` (`T-0281` @ `7c52f548`): awaiting non-`agy` merge/plan approval.
   - Older non-`agy` proposed/completed tasks already carry `agy` review comments (`2026-11-13`). No `agy` proposed tasks (`T-0224..T-0281`) have received a non-author `approve-plan` yet.
2. **Steps 1–3 — Untouched Subsystems Inspection & `T-0281` Proposal (`agy/t0281-propose` @ `7c52f548`, PR `#541`):**
   - Audited four previously unaudited subsystems (`src/render/globe/{orbitCover,orbitDraw,prairiePhoto}.ts`, `src/render/pbr.ts` `steppeCure`, `src/world/globe/{cube,handoff,farLayer}.ts`, `rust/boreal-sim/src/planet_fundamentals/{atmosphere/instability.rs, atmosphere/cloud_optical_depth.rs, hydrosphere/precipitation.rs}`, `planet_eval.rs`, and `src/core/orbit.ts`) via live headless Chromium (`1280×720`, SwiftShader, preview port `5265`, `0` console/page errors; preview server stopped) and calibrated Rule 11 harness (`calibrationValid = true`, `0 / 5` pass `>= 0.95`, `meanScore = 0.0336`):
     1. **`orbitCover.ts` + `orbitDraw.ts`**: `floodOcean` turns Red Sea (`-782 m`), Baltic Sea (`-100 m`), Persian Gulf (`-19 m`), and Caspian Sea (`-238 m`) into `a = 255` matte land (`0 / 4` water); `5×5` (`~195 km`) non-premultiplied RGBA coast blur drops Honshu to `a = 194/255` (`76.1%`) & visibly smears Middle East coastlines (`frame-0`); `coastDistanceKm` underestimates `69°N` Arctic N–S distance `2.65×` (`167.7` vs `444.5 km`) & inflates equatorial diagonals `1.404×`; `buildOrbitCover(1024, 512)` stalls the main thread `532.9 ms`; `linearByte` introduces `19.3%` dark-forest quantization error; August-2004 Blue Marble leaves Jan-15 northern Eurasia snow-free.
     2. **`pbr.ts` (`steppeCure`) + `prairiePhoto.ts`**: `steppeCure` snaps Dec 31 `1.00 -> Jan 1 0.00` (Jan 15 & Feb 15 = `0.00` lush green mid-winter steppe); `prairiePhoto.ts` hardcodes `textureLod(uSteppe, uv, 0.0)` bypassing `generateMipmaps`/`anisotropy = 8` on a `31.7 MB` atlas; `openLandHere` returns `true` over water within `0.2°` of home; `bakeHillshade` bakes static `8×`, E–W-flipped (`-0.45 * -sx`), `1.18×`-clipping shading; `prairieFarGlsl` omits `nearDisc` fade & forces `landMask = 1.0` over lakes; live `frame-1` `2000 m` standalone prairie overhead renders a solid blue-grey haze wall (`steppeZ = 0, photoDown = 0`).
     3. **`cube.ts` + `handoff.ts` + `farLayer.ts`**: `selectLeaves` at tier 0 (`split = 1.25`) breaks 2:1 balance (`12` adjacent edges with `2`-level LOD jumps) & live `frame-2` Tropical Pacific orbit (`latlon=5,-140`) shows a pitch-black half-globe vertical curtain tear along the cube-face / antimeridian boundary; `eyeClearOfTrees` misses a tree `1.1 m` off the sightline midpoint (`{ x: 0, z: 0 }`) & skips `isDry()`; `viewBlocked` ignores terrain slope (`heightAt`); `farLayerScale` snaps `1.0 -> 0.5` (`4×` pixel cliff) at `150 m`.
     4. **Rust `instability.rs`, `cloud_optical_depth.rs`, `precipitation.rs`, `planet_eval.rs` & `src/core/orbit.ts`**: `instability.rs` leaves `0 / 339` (`0.0%`, mean `-3.24 K/km`) tropical ocean cells unstable; `cloud_optical_depth.rs` dilutes scattered cumulus to `COT = 3.18` while cold polar overcast gets `11.65`; `precipitation.rs` non-flux-form advection creates `+3.93 mm` (`+15.4%` of global `PW`) spurious water in 3 days (`P/E = 1.553`) while `BL_RH = 0.77` rains on `784 / 868` (`90.3%`) sub-saturated flat ocean cells up to `33.5 mm/d`; `planet_eval.rs` runs on a synthetic `55.6%`-land 3-stripe planet; `orbit.ts` `milankovitch(0).e = 0.02400` (`+43.6%` vs `0.0167086`), `-25 kyr` precession is negative (`-65.9°`), and `seasonLengths()` sums to the sidereal year (`365.2564 d`).
   - Committed & pushed on `agy/t0281-propose` (`7c52f548`), opened board-only PR `#541`, merged into `agy/loop`, and verified `npx tsc --noEmit`, `tests/tasks.test.ts`, `tests/rules.test.ts`, `tests/sim-home.test.ts`, and `tests/gait-gate.test.ts` (`25 / 25` pass, `0` new breaks).

## Exact Next Step
1. On the next hourly run, run Step 0 first: `git fetch origin`, merge `origin/main` into `agy/loop`, check if any new non-`agy` PR/task needs review, and check whether any `agy` proposed task (`T-0224..T-0281`) has received a non-author `approve-plan` so `agy` can claim and implement it.
2. If no `agy` plan is approved yet, inspect the next untouched subsystem (next free ID: `T-0282`), such as `src/input/autoplay.ts`, `src/core/{flora/plants.ts, needs/social.ts, needs/bound.ts, materials.ts, surface.ts, contactBus.ts, transactions.ts, engineReport.ts, renderSettings.ts}`, or `src/animals/locomotion/fork/{bodyTubes.ts, playerRig.ts}` (remembering Rule 19 gait tags if proposing locomotion fixes).

## Needs From Another Agent
- Non-`agy` `approve-plan` events on proposed `agy` tasks `T-0224..T-0253`, `T-0257`, `T-0260`, `T-0263..T-0281`.
- Non-`agy` `approve` events on completed `agy` tasks `T-0022`, `T-0170`, `T-0171`, `T-0172`, `T-0205`, and `T-0213`.
- Merge of board-only PR `#540` (`T-0280` @ `d8212bbe`) and PR `#541` (`T-0281` @ `7c52f548`).
