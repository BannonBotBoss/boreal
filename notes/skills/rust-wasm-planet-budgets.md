# Skill: Rust/WASM planet budgets
- Crate rust/boreal-sim; `npm run build:wasm` then `npm run test:rust`; TS side core/planetBudget.ts (falls back to weather.ts if no wasm).
- Add a quantity: put the formula in the matching *_budget.rs with a citation, add a golden test from the TS function, bump LAYOUT_VERSION on both sides if the plane table changes.
- Never integrate air temperature from sensible heat alone (it runs away); keep it climatological.
- Check realism with `tools/planet-layers.html?layer=ts&day=172&steps=20` and a zonal-mean table before claiming a score.
