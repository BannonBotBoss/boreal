# Skill: `surface-registry-clock-loco-audit`

## Purpose
Reusable calibrated Rule 11 inspection workflow for Boreal's Rust surface budget (`roughness.rs`, `heat_capacity.rs`, `surface/mod.rs`), emergent halo/tidal physics (`emergent.rs`), Rust engine registry equations & animal drives (`registry.rs`, `drives.rs`), world-clock hysteresis / observation / photo-frame / settings contracts (`worldClock.ts`, `observation.ts`, `frame.ts`, `renderSettings.ts`), and procedural wolf anatomy / locomotion-lab banking / springs / gait scorers (`wolfBody.ts`, `fork/bodyTubes.ts`, `lab.ts`, `spring.ts`, `boundScore.ts`, `contactScore.ts`).

## Steps
1. **Live WASM Grid & Emergent Probe (`public/wasm/boreal_sim.wasm`)**:
   - Instantiate `boreal_sim.wasm` and call `grid_init(18, 36)`. Set a `+55°N` boreal land cell (`land = 1, elev = 300`) and `+85°N` Arctic ocean cell (`land = 0, elev = 0`).
   - Run `grid_seed(15, 12)` (winter) vs `grid_seed(200, 12)` (summer) and read `ROUGH` (plane 30), `HEATCAP` (plane 29), `SNOW` (plane 7), `SNOWFRAC` (plane 31), and `ICE` (plane 10). Verify winter conifer `z₀` stays `0.8–1.5 m`, partial snow uses true log geometric mixing, and Arctic pack ice uses sea-ice `z₀` (`0.001–0.01 m`) and conductive slab `heatcap` (`~2–4e6 J/m²/K`).
   - Run `emergent_demo(3000, 2, outPtr)` and inspect `emergent.rs` softening ratio vs Moon radius, Roche radius cancellation, and NaN-safe sorting.
2. **Rust Engine Registry Self-Consistency & Drives Parity**:
   - Decode `engine_report_ptr/len` at `13.8 Gyr` via `decodeEngineReport()`. Substitute each card's own reported symbols into its own displayed equation: Budyko `T = ((1 - α)Q - A)/(B)` (`Q ≈ 340.25 W/m²`, `α ≈ 0.29`), Friedmann `H²_rhs / H² = 1.000`, and Wind `f = 2Ω sin φ`.
   - Call `engine_spawn("planet")` and verify the new instance is evaluated (`health != 0`, `vars.length > 0`) after reconcile.
   - Compare `drives_tick` vs `engine_set_drives` at `mama_d = 12.5 m` (with pup at `(-1.2, 0.3)` so `pup_d > 12 m`) and measure 1-frame fox displacement from `mama_d = 4.0 m` (`< 0.2 m/frame`).
3. **Clock Conservation, Observation Rate, Frame & Settings Contracts**:
   - Check `simWorldSec(1, resolveObservation('behavioral', r)) + aggregateWorldSec(1, ...)` across `r ∈ (8, 12)` (must equal `1.000`).
   - Set `setClockRate(1e6)` and `setClockRate(-100)` and check `observationRecord().rate === clockRate()`.
   - Test `clampVideo(3000, 1)` (`w, h >= 2`) and pass out-of-range/NaN storage into `createSettingsStore`.
4. **Wolf Anatomy, Locomotion Lab, Springs & Scorers**:
   - Check `wolfTeeth().length === 42`, shaped wolf ear length (`9–11 cm`), and paw sole `y = 0`.
   - Compute centripetal acceleration `v² / (g R)` and required bank `atan(v² / (g R))` in `lab.ts` against `supportPlane().roll`.
   - Test `springTo(spring(1), 0, hl, hl)` (`0.5000 ± 1%`) and `hl = 0` velocity stability.
   - Run `scoreTrace()` on a curved path at `(100, 0)` turning `0.1 rad` to verify heading-invariant `overtake`, and inspect `contactScore.ts` for multi-leg sub-frame splitting.
5. **Live Headless Chromium Evidence (Port `5250–5269`, SwiftShader)**:
   - Serve Vite on an `agy` preview port (never `5173–5209`) from a directory with a real `node_modules` (not a symlink/junction blocked by Vite's `server.fs.strict`).
   - Capture `recording.webm` + `frame-0` (`tools/locomotion-lab.html?rig=real&gait=gallop&speed=7&t=2.5&cam=follow`), `frame-1` (`/?start=globe&nomenu=1&noprobe=1&tier=1&data=1` scrolled to Budyko), and `frame-2` (`/?start=game&nomenu=1&noprobe=1&tier=1&hour=10` after `#loading` clears, `KeyT` pressed).
   - Compare all 3 frames visually against natural/scientific reference images (`ref-0..2.jpg`) and stop Vite + Chromium cleanly before exit.

## Common Mistakes to Avoid
- Placing the pup in front of the mother (`+1.2 m`) when testing the `12..13 m` `mama_d` threat boundary masks the split because `pup_d < 12 m`.
- Serving Vite from a worktree with a junctioned `node_modules` triggers `403 Forbidden` under Vite's `server.fs.strict`; serve from a repo with local `node_modules` at the same commit SHA or configure `server.fs.allow`.
- Taking ground screenshots before `#loading` is removed captures the birch-bark loading card instead of the 3D scene.
- Forgetting Rule 19 (`gait`/`locomotion` tags) when completing locomotion fixes: footage URLs, a committed side-by-side clip, and sourced numbers are CI-enforced.
