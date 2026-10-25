# rust/boreal-sim: planet budgets in Rust, compiled to WebAssembly (issue #43)

Matthew (2026-10-23): "i want to use rust for the game". New simulation code for the planet goes here. The Three.js/TypeScript game is not
rewritten: TypeScript loads the wasm (`src/core/planetBudget.ts`) and reads each layer as a `Float64Array` over wasm memory.

The source tree is `src/planet_fundamentals/` (issue #46, T-0062). `lib.rs` re-exports the old module names so there is one copy of each formula. `grid.rs` is still the plane table.

| Module | Issue #46 file | Formulas (all cited in the source) |
|---|---|---|
| `planet_fundamentals/energy/solar_budget.rs` | `energy/solar_budget.rs` | NOAA/Spencer solar position, Kasten–Czeplak cloud attenuation. Ported from `weather.ts`, checked against it to 1e-9 |
| `planet_fundamentals/energy/longwave.rs` | `energy/longwave.rs` | Brutsaert 1975 emissivity, Crawford & Duchon 1999, North & Coakley 1979 OLR A and B |
| `planet_fundamentals/energy/albedo.rs` | `energy/albedo.rs` | Oke 1987 surface albedo; Budyko 1969 / North, Cahalan & Coakley 1981 planetary albedo |
| `planet_fundamentals/energy/energy_update.rs` | `energy/energy_update.rs` | slab energy balance. Air temperature stays the climatological field |
| `planet_fundamentals/hydrosphere/` | evaporation, precipitation, humidity_column, sst, soil_moisture, ice_fraction | Penman–Monteith, Manabe 1969 bucket, Bolton `qsat`, degree-day snow, sub-grid ice |
| `planet_fundamentals/atmosphere/` | pressure, wind, instability, cloud_fraction, cloud_optical_depth | hydrostatic and hypsometric pressure, geostrophic wind `f = 2Ω sin φ`, Sundqvist cloud, Stephens optical depth |
| `planet_fundamentals/surface/` | land_sea_mask, elevation, heat_capacity, roughness, vegetation_fraction | land and elevation are host inputs from `planet.ts`. Vegetation fraction is the `// later` stub |
| `planet_fundamentals/climate_seed.rs` | `climate_seed.rs` | Budyko 1969 / North & Coakley 1979 zonal energy balance. Land mask is not regenerated |
| `planet_fundamentals/planet_initialization.rs` `planet_update.rs` | the ordered fill and the per-tick step | `Grid::seed` and `Grid::step` moved, not reordered |
| `grid.rs`, `lib.rs` | | lat–lon grid, plain `extern "C"` exports `grid_init`, `grid_seed`, `grid_step` (no wasm-bindgen) |

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
