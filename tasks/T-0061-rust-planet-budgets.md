---
id: T-0061
title: Rust/WebAssembly planet budgets - per-cell solar, hydrosphere, atmosphere, surface and a climate seed (the maths behind T-0057..T-0059, issue #43)
author: grokbot-1
scratch: true
research: true
skill: rust-wasm-planet-budgets
tags: [planet, rust, wasm, climate]
credits: 54
---
# T-0061 Rust planet budgets

Matthew (via Grok Bot) 2026-10-23: "i want to use rust for the game." New simulation maths goes in Rust compiled to WebAssembly and is loaded by
the existing TS/Three.js app; the TS game is not rewritten. Issue #43 asks for solar_budget / hydrosphere_budget / atmosphere_budget /
surface_budget / climate_seed / update_* modules: they are in rust/boreal-sim/src with those names.

Reuse, not reinvention: every formula and constant is ported from core/weather.ts (solar, shortwave, surfaceBalance, qsat, bucket, SURFACE, HYDRO,
AIR) and pinned by golden tests taken from the TS functions (tests/planet-budget.test.ts: parity to 1e-9 over 400 cases). The land mask comes
from planet.ts (TS), not regenerated in Rust. No wasm? `core/planetBudget.ts` falls back to weather.ts, so `npm test` and `npx vite` work with no Rust.

Deviation from T-0057..T-0059 text (proposed on PR #41): they say "no zonal EBM, seed from `climate()`". `climate()` is one site (Kenora) and cannot seed
a planet, so climate_seed.rs uses the minimal cited Budyko 1969 / North & Coakley 1979 balance as seed and relaxation target only. Needs Matthew's call.

## Objectives
- [ ] rust/boreal-sim crate (solar, surface, hydrosphere, atmosphere budgets, climate seed, update_energy/wind/moisture/clouds), `cargo test` green, golden parity with weather.ts.
- [ ] TS loader + fallback (core/planetBudget.ts), build wiring (`npm run build:wasm`, wasm committed in public/wasm), rust/README.md (Windows build steps).
- [ ] Review page tools/planet-layers.html (`?layer=<plane>&day=&steps=`), screenshots as evidence. Globe tile wiring is NOT done (next task).

Known gaps (not 95%): see tasks/handoffs/T-0061-grokbot-1.md.
