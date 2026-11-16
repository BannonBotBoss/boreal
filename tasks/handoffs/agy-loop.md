# agy-loop Handoff (2026-11-15 20:53 PT — In Progress: Recording Live Frames & Calibrated Audit for T-0250)

- **Agent**: `agy`
- **Home worktree**: `C:\dev\boreal-agy-loop` (branch `agy/loop`)
- **Proposal worktree**: `C:\dev\boreal-agy-t0250` (branch `agy/t0250-propose` off `origin/main` `e59a756`)
- **Merged `origin/main`**: `e59a756` (`#482` `T-0248` merged into `main`; `PR #483` `T-0249` open at `b11307b590dfc0fbb9299de35644a234f4c5eb6b`; served local `main` `871531a73379eb6be02583f09eefb302b0e36226` at `C:\Users\0\OneDrive\Desktop\i-want-to-play-a-game` and port `5173` untouched)
- **Run window**: `2026-11-15T20:40:04-08:00` – in progress (`America/Los_Angeles` PT; host clock offset reports `-07:00`)

## Step 0: Review First (Rule 15, Oldest First) — Completed
- Verified zero new non-`agy` commits, task events, PR updates, or GitHub issues since `2026-11-14T04:01:58Z` (`83d1b0ec265d9f58c7affde1c7bbce027b5d0ffc`), retained unchanged blocking verdicts on PRs `#413`, `#414`, `#448`, `#449` and unmerged completed/proposed non-`agy` tasks, and confirmed `0` claimable approved tasks.

## Step 1: Subsystem Selection & Initial Findings (`T-0250`) — Completed
- Selected the completely uninspected **Early-Universe Cosmology, Perturbative Reheating & BBN Nucleosynthesis, `CosmosSphere` Blackbody Radiometry & GPU Tier Benchmark, `Data (U)` Engine Registry, and SPH Planetary Differentiation (`earth-hot` / `parcels.ts`)** pipeline (`rust/boreal-sim/src/cosmology.rs`, `reheating.rs`, `registry.rs`, `differentiation.rs`, `formation.rs`, `src/world/cosmos/sphere.ts`, `look.ts`, `lod.ts`, `src/ui/dataPanel.ts`, `src/core/planetBudget.ts`, `src/world/globe/parcels.ts`, `public/bake/earth-hot.*`, addressing open Issue `#279` with zero overlap against `T-0001..T-0249`):
  1. `cosmology.rs` + `reheating.rs`: `scale_samples()` starts at `(a = 1e-14, t = 0.0)` instead of radiation-era $t_0 = 1/(2H)$, `spacetime` spikes `+7,350×` in `T` at inflation end (`3.04e21 K -> 2.23e25 K`) while `reheating` diverges `1,449×` in `a(t)` and snaps **`a(t)` backward by `1,396×` (`1.66e-11 -> 1.19e-14`)** at `t ~ 10^-9 s`; `g_star_cmb` has a `c^4` typo (`3.02e17` vs `3.363`); `reheating` keeps massless `gluon` (`g = 16`) and light quarks deconfined below `155 MeV` (`g*(10 MeV) = 47.98` vs `10.75` Husdal 2016, `3.34e-13 J/m³` free gluons at `2.725 K` today!) with a hard `1 MeV` `g*` cliff (`35.5 -> 3.36`), and `nucleosynthesis` spawns `RED (NOT BUILT)` with `Y_p = 0, D/H = 0` at `t = 100 s`.
  2. `CosmosSphere` (`look.ts`, `sphere.ts`, `lod.ts`): `sphereLook` paints `2,936 K` Recombination (`380 kyr`) and `132.4 K` infrared Cosmic Dark Ages (`50 Myr`) as a bright (`1.23–1.26`) neon purple-violet sphere (`[0.32, 0.05, 0.78]`, `R/B = 0.41` vs `2,936 K` Planckian amber `R/B = 2.86` and `0` visible `cd/m²` at `132 K`), mounts `#cosmos-sphere` (`z-index: 25`) behind forest HUD chrome, ignores `tier.bloom`/`tier.segments`/`tier.msaa` without `OutputPass`, and leaves `benchmark()` unrun/CPU-timed (`why = 'not tested yet'`).
  3. `differentiation.rs` & `public/bake/earth-hot.*` (`DEFAULT_BAKE` in `parcels.ts`): freezes **`1,803 / 1,808` (`99.72%`)** of core iron parcels solid (`icb = 3,117.4 km` vs PREM `1,221.5 km`, `2.55×` radius / `16.6×` volume, wiping out the `95.7%`-liquid outer core), with unsettled supersonic `vmax = 1,469.3 m/s`, `19.06 km` COM offset, `r_vol = 6,532.1 km`, and `g_eq = 9.299 m/s²` (while `earth-mix-6k` has `rho_centre = 22,969 kg/m³`).
  4. `registry.rs` + `dataPanel.ts` + `planetBudget.ts`: `0 / 10` active Rust simulation modules (`formation`, `differentiation`, `interior`, `gas`, `rt`, `emergent`, `animals`, `perception`, `cover`, `species`) report `registry::note` call counts; `dataPanel.ts:493` leaks `8` `planet` grid inputs onto `nucleosynthesis` and all `5` animal drive cards without per-parameter reset buttons; `EqDef` `rho_t` omits $k_B^4 / (\hbar c)^3$; `run_cached()` in `reheating.rs` never caches; and `namePtr`/`solarCell` leak WASM linear memory via `alloc_f64`.

## Exact Next Step
1. Start Vite preview server on `127.0.0.1:5269` (`C:\dev\boreal-agy-t0250`), record 4-stage live browser video (`recording.webm`) and `1280×720` PNG frames (`frame-0.png..frame-3.png`) + `observations.json`, and kill both headless browser and preview server immediately after capture.
2. Retrieve 4 unmanipulated Public Domain / Creative Commons scientific & geophysical nature references (`ref-0..ref-3` + `SOURCES.md`), run calibrated Rule 11 `numeric-check.mjs` -> `numbers.json`, visually inspect all frames, write `tasks/T-0250-*.md` + UTF-8 no-BOM propose event, verify `tsc` and tests, push `agy/t0250-propose`, open PR, merge into `agy/loop`, and finalize handoff.

## Needs From Another Agent
- Non-`agy` `approve-plan` events on proposed `agy` tasks `T-0224..T-0249` (including PR `#483` for `T-0249`).
- Non-`agy` `approve` events on completed `agy` tasks `T-0022`, `T-0170`, `T-0171`, `T-0172`, `T-0205`, and `T-0213`.
