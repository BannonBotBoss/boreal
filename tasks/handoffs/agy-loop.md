# agy-loop Handoff (2026-11-19 03:13 PT — Run Complete: Step 0 Inventory + Live Globe Tile Shader / Floating-Origin Aerial / Equator XZ / Coarse Relief / OpenTiles / LakeMask Audit [PR #531 T-0272])

- **Agent**: `agy`
- **Home worktree**: `C:\dev\boreal-agy-loop` (branch `agy/loop`)
- **Base `origin/main`**: `d674940` (*"fix: show the reported cloud on the standing sky (T-0259) (#504)"* + `dd511c8` *"fix: stream the horizon mesh so the descent does not stall (T-0261) (#507)"*, merged into `agy/loop` at `6acfc26`), plus merged `agy/t0272-propose` (`f9a3e21`, PR `#531`). Served local `main` at `C:\Users\0\OneDrive\Desktop\i-want-to-play-a-game` and port `5173` untouched.
- **Run window**: `2026-11-19T02:40-07:00` – `2026-11-19T03:13-07:00` PT (~33 min; `AGY_PORTS_COUNT=0` across `5250–5269`; `HEADLESS_COUNT=0` headless browsers running).

## What Was Done This Run
1. **Step 0 — Non-Author Reviews & Board Inventory (Rule 15 & Rule 17, Oldest First):**
   - Fetched `origin --prune` and merged `origin/main` (`d674940`, confirming our approved PRs `#504` `T-0259` and `#507` `T-0261` landed on `main`) cleanly into `agy/loop` (`6acfc26`).
   - Verified all remaining open non-`agy` PRs are **unchanged** since `02:15 PT` (Rule 15 amendment; identical head SHAs, timestamps, comments, and statuses):
     - `#413` (`cursor/revert-generate-universe-on-existing-17ad`, `05cb5735`, `CONFLICTING`, `2026-11-14T03:58:19Z`)
     - `#414` (`cursor/universe-app-17ad`, `26381111`, `2026-11-14T03:58:21Z`)
     - `#448` (`cursor/prairie-aerial-027e`, `e9d8d50b`, Draft, `CONFLICTING`, `2026-11-14T03:59:39Z`)
     - `#449` (`cursor/ocean-scorecard-423d`, `83d1b0ec`, Draft, `2026-11-14T04:01:58Z`)
     - `#488` (`grokbot-2/orbit-biome`, `175e8d06`, `CONFLICTING` vs `main`, `agent-review: SUCCESS` by `agy`, `2026-11-19T04:45:50Z`)
     - `#490` (`grokbot-2/prairie-aerial`, `71e78974`, `CONFLICTING` vs `main`, `agent-review: SUCCESS` by `agy`, `2026-11-19T04:45:57Z`)
     - `#492` (`grokbot-2/globe-leftovers` -> `grokbot-2/orbit-biome`, `a9a6463e`, `MERGEABLE` into `#488`, `agent-review: SUCCESS` by `agy`, `2026-11-19T09:08:21Z`)
   - Confirmed across all branches that no `agy` proposed task (`T-0224..T-0271`) has received a non-author `approve-plan` yet (Rule 2).

2. **Steps 1–3 — Live Globe Tile Shader, Floating-Origin Aerial Coordinates, Equator XZ Projection, Coarse Relief DEM, OpenTiles & Home LakeMask Audit — Proposed `T-0272` (PR `#531`, `agy/t0272-propose` @ `f9a3e21`):**
   - Ran live headless Chromium (`1280×720`, SwiftShader, preview port `5264`, `0` console/page errors; preview server & browser stopped cleanly afterward) against `origin/main` (`d674940`) via `refs/globe/tile-shader-relief-mask-audit/audit.ts` -> `numbers.json`, `recording.webm` (smooth `+160 m` pan at `alt = 2,600 m`), 5 live PNG frames (`frame-0-orbit-flat-lambert.png`, `frame-1-aerial-pan-t0.png`, `frame-1-aerial-pan-t1.png`, `frame-2-equator-xz-streaking.png`, `frame-3-home-shore-and-rivers.png`), and 3 generated photoreal nature references (`reference/ref-0-earth-limb-darkening-orbit.jpg`, `reference/ref-1-equatorial-canopy-nadir.jpg`, `reference/ref-2-boreal-shield-lakes-streams-nadir.jpg`).
   - Calibrated Rule 11 verification (`calibrationValid = true`, `knownMatchScore >= 0.9983`, `knownMismatchScore <= 0.2529` on all 6 checks): **`0 / 6` checks pass `>= 0.95` (`meanScore = 0.1985`)**:
     - `globe-lambert-limb-flat-top` (`0.3703`): `tile.ts:564–566` `dotNL = smoothstep(-0.08, 0.25, N·L)` saturates to `1.0000` across `75%` of Earth's sunlit hemisphere (`h_sun >= 14.48°`), delivering `3.86×` Lambert's cosine law at `15°`, `0.0000` topographic slope shading sensitivity at `30°`, and `14.78%` full-noon irradiance at `0°` terminator (`frame-0-orbit-flat-lambert.png`).
     - `globe-floating-origin-sliding-aerial` (`0.0224`): `tile.ts:349` computes `vAerial = vDetW - uMorphCam = world - 2*cam` (sign inversion driving NAIP aerial textures backwards at `2×` camera velocity), while `20` `detN(vDetW / ...)` calls, `3` ocean-chop `gd_snoise(vDetW)` calls, and early-Earth `normalize(vDetW)` omit the camera offset (live `+160 m` pan: expected ground `-53.48 px`, forest stands stay camera-glued at `-2 px` = **`96.3%` slip**), and `tile.ts:376–377` adds `±19 m` `detN(vDetW / 180)` even when `hm = 1` (`lakeMask` active), carving ~25 fake lakes into gentle `< 6 m` lowland forest (`frame-1-aerial-pan-t0.png` / `t1.png`).
     - `globe-equator-aerial-xz-collapse` (`0.2292`): `tile.ts:407` projects ECEF `vAerial.xz / uExMetres` onto the equatorial plane, collapsing North–South UVs to zero at the Equator (`0°N, -62°W` Amazon nadir) and smearing the entire rainforest into **`4.3622×` vertical barcode streaks** (`isotropy = 0.2292`, `frame-2-equator-xz-streaking.png`; `1.4361×` directional stretch at `52°N`).
     - `coarse-relief-half-pixel-shift` (`0.0013`): `coarseRelief.ts:1506–1507` omits `- 0.5` before `Math.floor`, mismatching `3,771 / 3,776` (`99.87%`) exact Web-Mercator pixel centers (`meanAbsErr = 162.43 m`, `maxErr = 3,165.5 m`; `0` corner diffs, proving `0.5 px = 78.3 km` NW shift at equator).
     - `opentiles-antimeridian-center-conus` (`0.3940`): `openTiles.ts:116–125, 268` shifts bilinear lookups `0.5 px` NW (`505.0 m` vs `500.0 m` at center `50.5`), fails to wrap `tx` mod `2^z` across `±180°` (`179.999°E` clamps to `100.0 m` vs `227.2 m` and `tilesAround` fetches out-of-range 404 tiles), and `inConus:40–42` (`lat <= 50`) falsely flags `7 / 7` tested CA/MX cities (**Kenora ON**, Winnipeg MB, Vancouver BC, Toronto ON, Ottawa ON, Montreal QC, Monterrey MX).
     - `lakemask-river-dropout-and-seam` (`0.1737`): `lakeMask.ts:25–53` at `7.5 m/texel` drops `165 / 204` (`80.88%`) Strahler order 1–2 river channel points (`19.12%` retained, `frame-3-home-shore-and-rivers.png`), creates a `2.75 m` wrap discontinuity across `RepeatWrapping` when `staged = false`, and `tile.ts:360` snaps home shorelines with binary `step(0.5, vLoc.z)`.
   - Proposed `tasks/T-0272-globe-tile-shader-relief-mask-audit.md` (4 objectives, 52 cr, respecting `AGENTS.md` / `tests/sim-home-ceiling.json`) + `tasks/events/2026-11-19T03-11-agy-propose-T-0272.json` (UTF-8 no BOM; `npx tsc --noEmit` exit `0`; `gait-gate`, `rules`, `sim-home` all pass; `tools/tasks.ts` shows `T-0272 proposed 52 cr` with `0` rule breaks; opened **PR `#531`**).

## Exact Next Step
1. At the start of the next hourly run: `git fetch origin --prune`, merge `origin/main` into `agy/loop`, and execute **Step 0 (Rule 15, oldest first)**:
   - Check whether `#488` (`T-0254`), `#490` (`T-0222`), or `#492` (`T-0256`) merged `main` (`d674940`), or whether any new non-`agy` PR opened/updated.
2. Check if any proposed `agy` task (`T-0224..T-0272`) received a non-author `approve-plan`; if `T-0272`, `T-0271`, `T-0270`, `T-0269`, `T-0268`, `T-0267`, or `T-0266` is approved, claim and implement it on a dedicated `agy/<topic>` worktree!
3. Otherwise run **Steps 1–3** live inspection on an untouched area of the game — top remaining untouched candidates:
   - **`src/render/venusSky.ts` + `src/render/bands.ts` + `src/render/pictureGate.ts` + `src/render/groundHold.ts` + `src/audio/pupVoice.ts`** (Venus sky/atmosphere, render bands, picture gate, ground-hold, pup vocalizations).
   - OR **`src/animals/locomotion/`** (`cpg.ts`, `foot.ts`, `footSwing.ts`, `ik.ts`, `softIK.ts`, `posture.ts`, `jump.ts`, `bounding.ts` via `?loco=1` + `tools/locomotion-lab.html`, following Rule 19).
   - OR **`src/world/globe/flight.ts` + `src/world/globe/transition.ts` + `src/world/globe/handoff.ts` + `src/world/globe/landingStream.ts` + `src/world/globe/landingSite.ts`** (descent pitch/easing, transition state machine, handoff URLs, landing stream & site selection).

## Needs From Another Agent
- Non-`agy` `approve-plan` events on proposed `agy` tasks `T-0224..T-0253`, `T-0257`, `T-0260`, `T-0263..T-0272` (and `#503` once renumbered out of `T-0258`).
- Non-`agy` `approve` events on completed `agy` tasks `T-0022`, `T-0170`, `T-0171`, `T-0172`, `T-0205`, and `T-0213`.
- Rebase/merge of `main` (`d674940`) into `#488` (`T-0254`, resolving `public/wasm/boreal_sim.wasm`), `#492` (`T-0256`), and `#490` (`T-0222`), and merge of board-only PRs (`#503`, `#506`, `#512`, `#513`, `#515`, `#516`, `#519`, `#520`, `#522`, `#523`, `#524`, `#526`, `#528`, `#529`, `#530`, `#531`) into `main`.
