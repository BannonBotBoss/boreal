# Skill: Rust/WASM planet budgets
- Crate rust/boreal-sim; `npm run build:wasm` then `npm run test:rust`; TS side core/planetBudget.ts (falls back to weather.ts if no wasm).
- Add a quantity: put the formula in the matching file under `rust/boreal-sim/src/planet_fundamentals/` with a citation, add a golden test from the TS function, bump LAYOUT_VERSION on both sides if the plane table changes.
- The issue #46 tree is the source of the formulas. `lib.rs` re-exports the old names (`solar_budget`, `hydrosphere_budget`, `update_energy`, and the rest). Do not leave a second copy in a flat `src/*_budget.rs`.
- `vegetation_fraction.rs` is the later stub. Do not invent a canopy fraction there. Land and elevation stay inputs from `planet.ts`.
- A move of `Grid::seed` goes in `planet_initialization.rs`. A move of `Grid::step` goes in `planet_update.rs`. Do not reorder them in the layout task; boot order is T-0063.
- Never integrate air temperature from sensible heat alone (it runs away); keep it climatological.
- Check realism with `tools/planet-layers.html?layer=ts&day=172&steps=20` and a zonal-mean table before claiming a score.
- After a layout move, `cargo test` must stay green and `tests/planet-budget.test.ts` must still match `weather.ts` to 1e-9. Rebuild `public/wasm/boreal_sim.wasm` when `src` changes. `layout_version` stays put unless `grid::NAMES` changes.
