# T-0061 handoff (grokbot-1)

- **Authority (rule 10, quoted; not an approve-plan):** Matthew via Grok Bot, 2026-10-23: "just fix it. i also added a new issue" (issue #43);
  "i want you to touch main"; "i want to use rust for the game". Same precedent as T-0060: task left `proposed`; propose + comment events only.
- **Issue #43 screenshot:** the flat beige cloud sheet at ~3000 m on the standalone globe was already fixed by T-0056 / PR #45 (merge 5bc3dc1);
  re-verified (lower-half beige 0, luma std 10.1 vs 2.0 before). The "game startup" budgets request is what T-0061 starts.
- **Prior art searched:** src/, tasks/, docs/, notes/, tools/, PR #41/#44/#45, T-0034, T-0056, T-0057..59 (plans only on grok/board-loop). Reused core/weather
  formulas and constants (ported + parity-tested) and planet.ts for continents.
- **Design:** `extern "C"` wasm, no wasm-bindgen; SoA f64 planes on a 36x72 (default) lat-lon grid; TS reads Float64Array views. 33 planes (PLANE_NAMES).
  Air temperature is the climatological field (damped seasonal Budyko seed: ocean small/late, land large/in step), not integrated: my first
  version integrated it from sensible heat and ran away to 40 C on mid-latitude land in 20 days (no radiative cooling of the air column).
- **Build:** `npm run build:wasm` (needs Rust + wasm32-unknown-unknown; see rust/README.md); `npm run test:rust`. public/wasm/boreal_sim.wasm is committed (~56 KB).
- **Realism, honest (not 95%, nothing here is calibrated; many constants `[verify]`):** seed is ~5 K cool in the tropics (Budyko A,B,C); tropical land mean
  colder than ocean (unexplained, mean elevation / lapse not yet checked); precipitation ~1-3 mm/d vs ~3-6 observed in the tropics and patchy; mid-latitude
  surface wind 2-3 m/s (observed ~5-8); no ocean heat transport, no cloud-radiative feedback on Ts, no sea-ice dynamics. No score was measured.
- **Needs Matthew:** (1) OK with the Budyko seed vs the "no zonal EBM" text in T-0057..59? (2) wire layers onto the globe tile material next?
  (3) commit the wasm binary (done) or build in CI? (4) install Rust on the Windows box. (5) merge PR #41 / #44.
