# Skill: `cosmology-interior-plates-loco-audit`

Reusable workflow for auditing and verifying Rust cosmology/reheating/clock physics, SPH planetary interior differentiation bakes, MORVEL plate kinematics & Web Worker isolation, and locomotion stop/joint-gate/scapula + photo-fly/WebGL rendering hygiene against published scientific sources and live headless Chromium captures.

## Steps
1. **Cosmology & Reheating WASM Probe (`rust/boreal-sim/src/{cosmology.rs, reheating.rs, cosmic_time.rs}`):**
   - Instantiate `public/wasm/boreal_sim.wasm` and query `engine_set_cycle` / `engine_report_len` across late inflation (`ε ≈ 0.4`), post-inflation handoff (`10⁻³⁰ s`), MeV-era (`10⁻² s`, `~11.5 MeV`), neutrino decoupling (`0.5 s` vs `1.5 s`), today (`13.8 Gyr`), and future (`30–100 Gyr`).
   - Check against Planck 2018 (`a(30 Gyr) ≈ 2.665, T ≈ 1.022 K`), Klein-Gordon `w = (½φ̇² − V)/(½φ̇² + V)`, Standard Model `g*(T)` (Husdal 2016 / Saikawa & Shirai 2018: `g*(10 MeV) = 10.75` with `0` free gluons/quarks below `T_QCD ≈ 150 MeV`, smooth `e±` drop across `0.5→0.1 MeV`), `g_star_cmb ≈ 3.36`, `run_cached()` memoization, and `365.25 d` `planet_clock`.
2. **Earth Interior SPH Bake Audit (`public/bake/earth-hot.{bin,json}`, `differentiation.rs`, `parcels.ts`, `axisView.ts`):**
   - Parse the 6-float stride `.bin` parcel array and `.json` metadata; verify solid vs liquid iron parcel counts inside `r < cmb`, `icb` vs PREM `1,221.5 km`, `r_vol` vs `6,371.0 km`, `g_eq/g_pole` vs WGS84 `9.7803 / 9.8322 m/s²`, `J₂` vs IERS `1.08263e-3` (`1/f = 298.257`), `COM`, and residual `vmax`.
   - Capture live `?view=globe&dir=25,-60&r=0&parcels=1` in headless Chromium and compare visually against a PREM cutaway reference (`19%` solid inner core inside a `95.6%`-volume orange liquid outer core).
3. **Plate Kinematics & Worker Concurrency Audit (`src/world/globe/{plates.ts, tileWorker.ts}`):**
   - Verify spherical frame handedness explicitly: compute `dot(omega_North × p(0°N, 0°E), unit(0°N, 90°E))` (must be `+1.000`, never `-1.000`).
   - Audit boundary extraction for dropped North edges (`break;` inside the 2-neighbour loop), polar vs equatorial boundary density per steradian, MORVEL area sum vs `4π` and small-plate convergence error, main-thread latency, and module-global `STAGES` mutation across `await` yields in `tileWorker.ts`.
4. **Locomotion, Photo Fly & WebGL Pipeline Checks (`src/animals/locomotion/{foot.ts, jointSwing.ts, bodyPlan.ts}`, `src/photo/fly.ts`, `src/world/cosmos/sphere.ts`):**
   - Test `stepFoot` mid-swing stop continuity (`moving: true -> false` at `phase = 0.85`, jump `< 0.05 m`), `limitStep` world-space forearm angle delta (`<= 1.0× max`), `skeletonOf` `fore.hip === shoulder`, `photoFlyMove` normalized diagonal speed (`1.0×`), and absence of per-frame synchronous `gl.finish()` plus `applyTier` knob respect in `sphere.ts`.
5. **Live Headless Chromium Verification & Calibration (`refs/audit/cosmology-interior-plates-loco-audit/audit.ts`):**
   - Start Vite on an agent-range port (`5250–5269`), run `npx tsx refs/audit/cosmology-interior-plates-loco-audit/audit.ts <baseUrl>`, verify `calibrationValid = true` (known match `>= 0.95`, known mismatch `<= 0.25`) and `0` console/page errors, inspect captured `frame-0..2.png` + `recording.webm` against `reference/ref-0..2.jpg`, and stop the Vite server + Chromium cleanly.

## Mistakes to Avoid
- Do not assume `unit(lat, lon) = [cos*cos, sin, +cos*sin]` is right-handed with `omega × p`: `+z = +sin(lon)` reverses the cross-product sign unless `p × omega` or `-sin(lon)` is used consistently.
- Do not rely on `icb` metadata alone for SPH bakes: always count `MAT_IRON` (`10`) vs `MAT_IRON_SOLID` (`12`) inside `r < cmb` directly from the `.bin` buffer (a stray silicate parcel can artificially mask a `100%`-solid core).
- When checking `tileWorker.ts` or similar files via regex in an audit script, anchor to the specific function (`self.onmessage`) so `[\s\S]*` cannot span across adjacent function definitions.
- Remember Rule 19 whenever a task carries `gait` or `locomotion` tags: completion requires real animal footage URLs, a committed side-by-side clip, and sourced numbers in the complete event.
