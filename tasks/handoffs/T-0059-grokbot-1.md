# T-0059 planet atmosphere budget

Agent: grokbot-1. Branch: `grokbot-1/atmosphere-budget`. Issue #43. Plan: grok's approve-plan for Matthew (2026-10-23). Not self-approved.

## What was built
`src/core/planet/atmosphereBudget.ts`, pure functions on T-0058's `cellAir` column (no new climate table, no new gas constant):
- Pressure: hypsometric at `REF_Z` 1500 m (850 hPa height) from the cell's column temperature, so warm columns stand taller.
- Wind: geostrophic `Vg = |∇p| / (ρ f)`, `f = 2 Ω sin φ` (`AIR.omega`), ∇p from neighbouring cells (±2°) of the same function. Inside 5° of the equator the wind stays `climate()`'s synoptic vector. Mid-latitude January gives westerlies aloft (thermal wind).
- Cloud fraction: Sundqvist et al. (1989), `RH_CRIT` 0.8, on the relative humidity at `REF_Z` (surface vapour thinned by T-0058's `VAPOUR_SCALE_M`, at the colder `REF_Z` temperature: condensation where the air reaches its dew point). Cloud base: Espy LCL from the surface dew point. Optical depth: Stephens (1978) `τ = 3 LWP / (2 ρw re)`, typical LWP 0.1 kg/m² and re 10 µm, so 15 at full cover.
- Instability: `unstablePair`, now exported from `weather.ts` and used by `convectiveAdjust` itself, between θ at the surface and θ at `REF_Z`. Summer noon at Kenora is unstable, dawn is not.

## Gate
`tests/atmosphere-budget.test.ts`: the 0.001 Pa/m case at 49.77° N matches `|∇p| / (ρ f)` to 1% (prints both sides). Minimum tier still has 0 octaves. `npm test` 763 pass, `npx tsc --noEmit` clean.

## Known mismatch (not done)
Objective 2 (the `CLOUDS` shell reads this cloud fraction) is not wired. With one Kenora synoptic humidity moved by latitude, the area-weighted mean cover is only ~0.05 (Jan 0.04, Jul 0.06), against MODIS ~0.67 (King et al. 2013) and the rust spin-up's cloud alpha that the shell already reads. Lowering `RH_CRIT` to 0.4 still only reaches ~0.15, so the gap is missing moisture variance (fronts, convergence), not the threshold. Wiring it now would thin the clouds. `cloudGrid()` is ready for a fallback bake once the column carries that variance; the rust `cloud` plane stays the shell's source.
