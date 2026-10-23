# rust/boreal-sim: planet budgets in Rust, compiled to WebAssembly (issue #43)

Matthew (2026-10-23): "i want to use rust for the game". New simulation code for the planet goes here. The Three.js/TypeScript game is not
rewritten: TypeScript loads the wasm (`src/core/planetBudget.ts`) and reads each layer as a `Float64Array` over wasm memory.

| Module | Issue #43 item | Formulas (all cited in the source) |
|---|---|---|
| `solar_budget.rs` | 1. Solar energy budget | NOAA/Spencer solar position (declination = tilt, hour angle = time of day), Kasten–Czeplak cloud attenuation, Brutsaert longwave. Ported from `weather.ts`, checked against it to 1e-9 |
| `hydrosphere_budget.rs` | 2. Hydrosphere | Penman–Monteith evaporation (`surfaceBalance`), Manabe 1969 bucket, degree-day snow, Bolton `qsat`, large-scale condensation |
| `atmosphere_budget.rs` | 3. Atmosphere | Sundqvist cloud fraction, Stephens optical depth, hypsometric pressure, geostrophic wind with `f = 2Ω sin φ`, dry-adiabat instability |
| `surface_budget.rs` | 4. Surface | `SURFACE` table (Oke 1987): albedo, roughness, heat capacity, snow, land/sea mix |
| `climate_seed.rs` | procedural seed, no spin-up | Budyko 1969 / North & Coakley 1979 zonal energy balance with the tilt-driven daily insolation. Land mask comes from `planet.ts` (TypeScript), not regenerated |
| `update_energy.rs` `update_wind.rs` `update_moisture.rs` `update_clouds.rs` | the `update_*` steps | slab energy balance, geostrophic wind, upwind moisture advection + bucket, cloud fraction |
| `grid.rs`, `lib.rs` | | lat–lon grid, plain `extern "C"` exports (no wasm-bindgen) |

## Run it without installing Rust
`public/wasm/boreal_sim.wasm` is committed, so `npm ci && npx vite` works as before. If the wasm is missing or stale the TypeScript fallback
(`solarLayerFallback`) is used and the game still runs. Open `http://127.0.0.1:5173/tools/planet-layers.html` to see the layers.

## Build it (Windows on the HP Omen, or anywhere)
1. Install Rust: https://rustup.rs (run `rustup-init.exe`, accept the defaults; the MSVC build tools it asks for are the Visual Studio C++ Build Tools).
2. `rustup target add wasm32-unknown-unknown`
3. In the repo: `npm run build:wasm` (runs `cargo build --release --target wasm32-unknown-unknown` and copies the result to `public/wasm/boreal_sim.wasm`).
4. `npm run test:rust` runs the native `cargo test` suite (unit tests with golden values taken from `weather.ts`). `npm test` also checks the wasm against the TypeScript.

Rebuild and commit `public/wasm/boreal_sim.wasm` whenever `rust/boreal-sim/src` changes (about 55 KB). Bump `layout_version` in `lib.rs` and
`LAYOUT_VERSION` in `planetBudget.ts` if the plane list in `grid.rs` changes; a stale wasm then fails to load and the fallback is used.
