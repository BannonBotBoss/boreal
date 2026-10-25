# T-0063 handoff — grokbot-3

Issue #47, globe boot order. Branch `grokbot-3/globe-boot-order`. Claim `tasks/events/2026-10-25T11-50-32-grokbot-3-claim-T-0063.json`. The plan stays grok's approve-plan for Matthew, 2026-10-23 13:23:30 PT. This is not a new approve-plan.

## What this run is doing
Fill the existing planet planes in Matthew's order, then let the globe render. No new physics. `Grid::seed` is left on the T-0061 order so the open folder move (PR #86, T-0062) can keep re-exporting it.

## Done
- `rust/boreal-sim/src/boot_order.rs` `boot`, driven by `RUST_BOOT_STEPS`.
- Wasm `grid_boot`. `PlanetSim.boot`. `src/world/globe/bootOrder.ts` writes land, then elevation, then calls it.
- `startGlobe` waits on `bootP` before the first frame. Shared `step` does not call `renderTo` until `booted`. `inpage` prewarm and the far-layer demo wait on `bootP`.
- Layer drawing stays `spinAndBake` after that paint (48 h of `Grid::step`). It is not part of the boot.
- Skill `notes/skills/globe-boot-order.md`.

## Tests (this run)
- `./node_modules/.bin/tsc --noEmit` exit 0.
- `npm test`: 758 tests, 744 pass, 0 fail, 14 todo. The todo is still the 22 legacy board breaks. T-0063 is not one of them. Task ids on this branch are unique.
- `cargo test --manifest-path rust/boreal-sim/Cargo.toml`: 74 passed, 0 failed.

## Exact next step
A different agent reviews the PR. grokbot-3 does not approve it and does not merge it.

## Numbers
No new physical constant.

| Value | Game | Real source | Match |
|---|---|---|---|
| Sea-level pressure | `P0` 101325 Pa on elev 0 ocean cells | ISO 2533:1975 | yes, boot test |
| Ocean roughness | 0.0002 m | Stull 1988, `surface_budget` WATER | yes |
| Land roughness at boot | bare z0 from `cell_surface(land, 0, 0, 0)`, not forest 1.5 m | Oke 1987 / the existing bare row (game calibration in that file) | yes: roughness runs while soil is still 0 |
| Soil | half of `BUCKET_MM` 150 mm | Manabe 1969; the half is the existing seed calibration | yes |
| Humidity | 0.75 of `qsat` | Peixoto & Oort 1996, `RH_SEED` | yes |
| Surface temperature | equal to the climate-seed air temperature | boot does not call `update_energy` | yes |

## Frame gate
N/A. The tile mesh is still `sampleSurface`. No shader, camera, or layer-draw change. The 48 h spin still bakes the same texture after the first paint, so there is no new frame to score. Substitute checks are the pressure, roughness-before-bucket, and Ts = Tair assertions in `tests/boot-order.test.ts` and `boot_order::tests`.

## Needs from another agent
A non-author review. grokbot-3 does not approve this branch. Nothing else is blocked on a recording: the frame gate does not apply.

## Leftovers
- `Grid::seed` still integrates Ts for one second. Callers that want the issue #47 order must call `boot`, not `seed`.
- PR #86 will conflict on `public/wasm/boreal_sim.wasm` and may need a rebuild. It should not need to edit `boot_order.rs` if its `pub use` names stay.
- Open PRs #84 and #86 were not modified.
