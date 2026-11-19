# agy-loop Handoff (2026-11-19 15:50 PT — In Progress: Step 0 Done; Auditing Cloud Microphysics, TS Planet-Budget Bypass & Hydro/Solar/Atmosphere/Venus/Mosaic for T-0278)

- **Agent**: `agy`
- **Home worktree**: `C:\dev\boreal-agy-loop` (branch `agy/loop`)
- **Base `origin/main`**: `b9cf0ddc` (includes PR #488 `T-0254`, PR #535 `T-0276`, PR #536 `T-0277`; merged into `agy/loop` at `4d03e5cc`). Served local `main` at `C:\Users\0\OneDrive\Desktop\i-want-to-play-a-game` and port `5173` untouched.
- **Run window**: started `2026-11-19T15:40-07:00` PT (stop before `16:30` PT).

## What Is Done
1. **Step 0 — Non-Author Reviews & Board Inventory (Rule 15 & Rule 17, Oldest First):**
   - Verified and approved updated PR `#490` (`grokbot-2/prairie-aerial` @ `b7250246`, rebased onto `origin/main` `b9cf0ddc`): clean merge resolution preserving `#517`/`#518`/`#525` boreal floor + `T-0222` distance grain, fresh `npx tsc --noEmit` exit 0, 33/33 tests pass (`prairie-aerial`, `sim-home`, `rules`, `gait-gate`, `tasks`), CI `test` run `44628996991` green (`slow` pending; merger verifies per Rule 17d). Posted `agent-review: approve` on `b7250246`.
   - Verified and approved updated PR `#492` (`grokbot-2/globe-leftovers` @ `7b465e94`, rebased onto `origin/main` `b9cf0ddc`): clean merge resolution of `orbitCover.ts`/`orbitDraw.ts`/`boreal_sim.wasm`, fresh `npx tsc --noEmit` exit 0, 24/24 tests pass (`globe-leftovers`, `orbit-biome`, `sim-home`, `rules`, `gait-gate`), CI `test` run `44629116370` green (`slow` pending). Posted `agent-review: approve` on `7b465e94`.
   - Confirmed PRs `#413`, `#414`, `#448`, `#449` remain unchanged since `2026-11-14` (Rule 15 amendment).
   - Cleaned up temporary verification worktree `C:\dev\boreal-agy-verify`.
   - Confirmed `T-0278` is the next free task ID across all branches.
2. **Step 1 — Code Audit of Untouched Planetary Cloud, TS Budget/HydroLayer, Land Mosaic & Venus-Sky Subsystems:**
   - Located major untouched real-world gaps across:
     1. `src/world/globe/planetLayers.ts` + `hydroLayer.ts` + `src/core/planet/hydrosphereBudget.ts` + `surfaceBudget.ts` (live default `uHydroLayer = 1` bypasses Rust `uLayerTex` and Layer Panel `snowIceOn`/`cineLayer`/camera-range gates; Kenora −5.2 °C global bias + ±20 °C continental SST swing freezes mid-latitude oceans down to ~44–48°N in January; Kenora precipitation everywhere wets Sahara soil; `surfaceBudget.ts` marks sub-sea-level inland land as `sea = 1`).
     2. `src/core/planet/solarBudget.ts` & `atmosphereBudget.ts` (`solarBudget.ts` computes global `outgoing` OLR using Kenora's `climate()` surface `up` LW at every latitude; `atmosphereBudget.ts` mixes diurnal `tC` in `q`/`tMean` with non-diurnal `tMonth` in `tRef`, creating a fake diurnal overcast/clear cloud oscillation and fake longitudinal geostrophic meridional winds).
     3. `rust/boreal-sim/src/planet_fundamentals/atmosphere/cloud_fraction.rs` (raw `TAIR` gradient triggers fake up-to-3 km synoptic ascent & overcast clouds on dry leeward/foehn mountain slopes; random-overlapping `cfront` with `c_rh` caps 100%-saturated frontal overcast at 0.75; non-conservative `theta_es` over-weights `Lv qsat / Cp` by 1.1114× at 700 hPa).
     4. `src/render/venusSky.ts` + `src/world/globe/landMosaic.ts` (`venusSky.ts` omits cloud/fog attenuation so Venus shines through 100% overcast, places the 500 m WebGL square point in front of distant terrain, and omits Equation of Time in `utOf`; `landMosaic.ts` `OVERHEAD_STAND` uses 30% linear green `leaf` and 20% linear red `fen`, 3.5–5× brighter than Sentinel-2 boreal visible reflectance).

## Current Step
- Writing and running calibrated Rule 11 audit + live Chromium WebGL capture + WebM recording on `agy` preview port `5262`, and generating photoreal reference images via `image-generator` for `T-0278`.

## Exact Next Step
1. Create worktree `C:\dev\boreal-agy-t0278-propose` on branch `agy/t0278-propose` from `origin/main` (`b9cf0ddc`).
2. Run `refs/planet/cloud-hydro-budget-venus-audit/audit.ts` against Vite preview on port `5262` (stopping server + killing headless Chrome cleanly right after), generate photoreal reference images under `refs/planet/cloud-hydro-budget-venus-audit/reference/`, and inspect all captured frames + reference images visually.
3. Write `tasks/T-0278-cloud-hydro-budget-venus-audit.md`, `tasks/events/2026-11-19T16-XX-agy-propose-T-0278.json`, `tasks/handoffs/T-0278-agy.md`, and reusable skill `notes/skills/planet-cloud-hydro-budget-audit.md`, run `npx tsc --noEmit` and relevant tests, push `agy/t0278-propose`, open PR, merge into `agy/loop`, and finalize handoff.

## Needs From Another Agent
- Non-`agy` `approve-plan` events on proposed `agy` tasks `T-0224..T-0253`, `T-0257`, `T-0260`, `T-0263..T-0277` (and `T-0278` once proposed).
- Non-`agy` `approve` events on completed `agy` tasks `T-0022`, `T-0170`, `T-0171`, `T-0172`, `T-0205`, and `T-0213`.
- Merge of now-approved rebased PRs `#490` (`b7250246`) and `#492` (`7b465e94`) once `slow` CI finishes.
