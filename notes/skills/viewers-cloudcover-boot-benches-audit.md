# Skill: `viewers-cloudcover-boot-benches-audit`

Reusable workflow for auditing standalone Three.js/Canvas diagnostic viewers (`tools/*.html`), procedural cloud CPU twins (`src/world/globe/cloudCover.ts`), WASM globe boot/surface planes (`src/world/globe/bootOrder.ts`, `rust/boreal-sim/src/boot_order.rs`), and CLI benchmark/Python helper scripts (`tools/*.ts`, `tools/terrain-ref/*.py`) under Rules 6, 11, and 12.

## Steps
1. **Verify zero overlap**: scan `tasks/T-*.md` to identify genuinely untouched `tools/*.html`, `src/*.ts`, `rust/boreal-sim/src/*.rs`, and `tools/*.{ts,py}` modules.
2. **Start a temporary isolated Vite server** on a port inside your assigned range (`5250–5269` for `agy`; never `5173–5209`) and always stop it immediately after capture (`Get-NetTCPConnection -LocalPort <port> -State Listen` must return `0`).
3. **Capture live headless Chromium frames and WebM video**:
   - Check 720p (`1280×720`) viewport overflow (`canvas.width > innerWidth || canvas.height > innerHeight`) and initial render before any manual step hook (`__step`) is invoked.
   - Probe invalid query parameters (`?ts=-1`, `?row=bogus`, `?pose=bogus`) on an isolated page so `pageerror` crashes are caught without polluting normal-path console counts.
   - Record a live VP8 WebM clip via `canvas.captureStream(20)` + `MediaRecorder` and inspect every captured PNG visually before writing frame descriptions.
   - Generate or source matched real-world references from the frame descriptions and compare side-by-side honestly against the 95% Rule 6 bar.
4. **Run calibrated deterministic probes (`knownMatch = 1.0`, `knownMismatch = 0.0`)**:
   - **Procedural rigs (`src/render/bear.ts`)**: traverse `THREE.Box3` per anatomical group (claws, paws) across variants (`grizzly` vs `black`) and compare against published zoological morphology (e.g. Herrero 2002 / USFWS).
   - **Cloud CPU twin (`cloudCover.ts`)**: probe `half = 0` (`smoothstep` division by zero), `n = 0` / `0×0` stats, non-unit `dir` vectors (`[1.8, 0.7, 0.6]` vs unit vector — avoid equator-only test vectors that mask scaling through clipping), Worley F1 initialization (`d = 1` vs `Infinity`), hardcoded radii vs `K.R_earth`, and global area-weighted cover vs MODIS (`0.67`, King et al. 2013).
   - **WASM globe boot (`bootOrder.ts` + `boot_order.rs`)**: load `public/wasm/boreal_sim.wasm` via `loadPlanetSim`, inspect mid-latitude (`40°–60°N`) land cells at boot vs after `sim.step(3600)` (not polar cells), and inject `elev = NaN` to verify whether `finalize` (`planes_finite`) catches non-finite planes or lets IEEE `f64::max(NaN, 0.0)` mask them.
   - **CLI benches & Python scripts**: invoke with boundary inputs (`SECS <= warm`, empty `argv`, truncated binary payloads) via `spawnSync`, and check geodesic framing formulas against WGS84 ellipsoid radii (NIMA TR8350.2).
5. **Validate board gates** before committing: `npx tsc --noEmit` and `npx tsx --test tests/tasks.test.ts tests/gait-gate.test.ts tests/sim-home.test.ts tests/rules.test.ts`.

## Common Pitfalls to Avoid
- Do not rely on shallow glob searches in `rust/boreal-sim/src/` — use `git grep` so 3-level subdirectories (`planet_fundamentals/energy/energy_update.rs`) are never missed.
- Do not sample index `0` of row-major south-to-north globe grids when testing mid-latitude forests (index `0` is polar Antarctica).
- Avoid `npx tsx -e` inline snippets in PowerShell on Windows (can hang); write a `.ts` script file instead.
- Never commit `node_modules` junctions or leave headless browser / Vite preview processes running.
