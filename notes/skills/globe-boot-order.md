# Skill: globe boot order

When to use: the planet grid must be filled in Matthew's issue #47 order before the globe draws its first frame. Not for a new formula, and not for the issue #46 folder move.

Steps
1. Read `tasks/T-0063-globe-boot-order.md`. Land and elevation come from one `planet.sampleSurface` call (`src/world/globe/planet.ts`). Do not add a second mask.
2. Commit the land plane, then the elevation plane, in `src/world/globe/bootOrder.ts` `bootGlobe`. Then call `PlanetSim.boot`, which is wasm `grid_boot`.
3. The rust order is `RUST_BOOT_STEPS` in `rust/boreal-sim/src/boot_order.rs`. The only call order is `for step in RUST_BOOT_STEPS`. Call the existing modules (`climate_seed`, `surface_budget::cell_surface`, `update_clouds`, `solar_budget`, `atmosphere_budget::surface_pressure`, `update_wind`, `hydrosphere_budget::surface_balance`, `update_moisture` at dt 0, then `update_clouds` again and `column_water`). Those paths stay valid when `lib.rs` re-exports them from `planet_fundamentals`.
4. Do not call `update_energy` and do not call `Grid::step` inside the boot. `Grid::seed` keeps the older T-0061 order. Ongoing advance stays `grid_step`.
5. `startGlobe` waits on `bootP` before `requestAnimationFrame`. Shared `step` returns before `renderTo` until `booted` is set. The 48 h layer spin (`planetLayers.ts` `spinAndBake`) stays after that first paint.
6. Rebuild wasm with `npm run build:wasm` and commit `public/wasm/boreal_sim.wasm`. `npm test` loads that file; CI does not compile Rust.

Checks
- `cargo test --manifest-path rust/boreal-sim/Cargo.toml --lib boot_order` (order list, Ts unchanged, roughness from empty soil, sea-level pressure = `P0`).
- `tests/boot-order.test.ts` (the same list in TS, land write before elevation write before `sim.boot`, first frame after boot).
- `./node_modules/.bin/tsc --noEmit` and `npm test`.

Mistakes to avoid
- Reordering `Grid::seed` instead of adding `grid_boot`. Issue #46 moves `seed` and must keep its own order.
- Treating the layer spin as part of boot. It advances the clock.
- Scoring a frame gate on this fill. The mesh is still `sampleSurface`. If nothing on screen changed, write N/A and keep the pressure / roughness / Ts checks.
- Editing `rust/boreal-sim/src/grid.rs` or the flat budget files in the same change as an open folder-move branch. A new file plus a `grid_boot` export merges past that branch's re-exports.
