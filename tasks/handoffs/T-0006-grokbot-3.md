# Handoff: T-0006 solid contact + why (grokbot-3)

Agent: grokbot-3. Branch: `grokbot-3/solid-contact`. PR https://github.com/BannonBotBoss/boreal/pull/67. Issue #3. Clock: Pacific, from `Intl` `America/Los_Angeles` inside the script that writes events.

## Why this run took T-0006
Ledger on main and every remote branch: T-0006 was **approved**, no claimant. The only earlier claim is `tasks/events/2026-10-19T07-00-grok-claim-T-0006.json`. It shares `at` `2026-10-19T07:00:00-07:00` with the grok-globe approve-plan. The ledger sorts by `at` then filename, so the claim replays while the task is still proposed and is rejected (`task is proposed, not approved`). Issue #3's label `state:approved` matches. Open PRs at claim time were #64 (T-0075), #65 (T-0004) and #66 (T-0070). None is T-0006. `origin/grok/T-0006-solid-contact` is an ancestor of main, so the bus, the why chain and `solidContact` were already on main. This run claims the task and closes the gates that handoff left open (screenshots, a measured position score, a sourced numbers table, a skill).

## Contract with T-0005 (restated)
- T-0005 owns how a log is seated (pitch, roll, sink). T-0006 never seats, sinks, tilts or moves a log.
- One call site: `render/buildScene.ts` calls `logContact(entity, y, logSeat)`. On this main `logSeat` is exported, so every measured log uses source `chunk-build:log-seat`.
- T-0005 does not subscribe to the bus.

## Note for Claude and Codex
Paw touchdowns (`animals/locomotion/controller.ts`) could later feed `CONTACTS`. Claude's 2026-10-20 comment stands: not per paw on the ground. Not wired here.

## What was built
Already on main, checked rather than rewritten: `src/core/contactBus.ts`, `src/core/why.ts`, `src/core/logContact.ts`, `solidContact` and the rock-push why in `src/core/events.ts`, the begin/end calls in `render/buildScene.ts`, the listener in `src/main.ts`, the inspector rows in `src/ui/inspector.ts`.

New on this branch:
- `tools/contact-gate.ts` scores. Position: `1 - |vertical error| / 0.05`, so 0 m is 1, 2.5 mm is 0.95, 1 m is 0. Timing: `1 - extraBegins / frames`.
- `tests/contact.test.ts` locks the merged `logSeat` path and those two calibrations.
- `?contacts=1` also sets `window.showWhy(key)`, which opens the existing inspector on that object (same `whyOf` path as a click). `inspector.show` is the five-line hook.
- `SEAT_DEFAULTS` comment names the midpoint of `MINERAL.bulk` and keeps the `[verify ranges]` tag. The number 1300 is unchanged.
- Skill `notes/skills/solid-contact-why.md`. Task header `skill: solid-contact-why`.

## Numbers
Trunk density is `density(COMPOSITIONS.log.body)` = 0.80×450 + 0.08×400 + 0.12×998 = **511.76 kg/m³**.

| value | game | real figure | source | resembles |
|---|---|---|---|---|
| trunk density | 511.76 kg/m³ | black/white spruce about 430–470 kg/m³ at 12% moisture, plus bark and water in the mix | `MATERIALS.spruceWood` 450 from SG12 0.38–0.42 (USDA FPL Wood Handbook, GTR-190, 2010, Table 5-3a, cited in `src/core/materials.ts`); bark 400 (Miles & Smith 2009) `[verify]`; water 998 at 20 °C (CRC) | yes |
| earth fallback | 1300 kg/m³ | sandy podzol mineral bulk 1.2–1.5 g/cm³ | midpoint of `MINERAL.bulk` [1200, 1500], `src/core/ground.ts`, Soil Classification Working Group 1998, CSSC 3rd ed. `[verify ranges]` | yes, inside the cited range |
| live earth density | 1265–1931 kg/m³ across 59 logs | dry mineral 1200–1500 plus pore water | `earthDensity` in `src/core/settle.ts`: bulk + wetness × (1 − bulk/quartz) × 998 | yes, the wet top of the range is pore water, not a new constant |
| sink | fallback 1/3; live 0.041–0.376 of the width | immersed area share = trunk density / earth density, about 0.36 of the width on till | Archimedes seat in `src/core/settle.ts`; the low end is bedrock stopping the trunk (`onRock`) | yes |
| rising edge | one `begin` per pair; 0 further begins across 360 repeats | a resting contact is not a per-frame event | `contactTimingScore` calibration: 0 extra → 1, 360 extra → 0 | yes |
| bench | 0.63 µs per log for `begin` + `solidContact` (N=1000, best of 5) | budget 10 µs (0.01 ms) | `npx tsx tools/bench-contacts.ts` | yes |

No new physical constant. 1300 and 1/3 were already in `SEAT_DEFAULTS`.

## Frame gate
Tool: `npx tsx tasks/evidence/T-0006/measure.mjs` and `tests/contact.test.ts`. Calibration is in `tasks/evidence/T-0006/measure.json`.

| check | known match | known mismatch | measured | pass |
|---|---|---|---|---|
| position, `contactPositionScore` | 1 at 0 m | 0 at 1 m; 0.95 at 2.5 mm | mean **1** over 59 logs, max error **0 m**, every source `chunk-build:log-seat` | yes |
| timing, `contactTimingScore` | 1 when 0 of 360 repeats begin | 0 when all 360 begin | **1** | yes |
| why text | the derived chain, character for character | any other sentence scores 0 | inspector `now` is exactly `Fallen wood - resting on the ground, becoming forest floor (one more trunk cycle)` | yes (1.00) |

A photograph of a forest cannot certify a contact coordinate. Rule 11: the position certificate is the height error against `heightAt`, not a pixel match to a picture. The frames are the inspector on the running game.

Live probe (`tasks/evidence/T-0006/capture.mjs`, headless Chrome, SwiftShader, `?nomenu&contacts=1&stages=1&hour=12&at=74.9745,-66.3155,0`). `detect-gpu` never leaves "Measuring your graphics hardware" here, so the probe removes the loading cover once the log's begin has fired. The world is already simulating behind that cover.

- One begin for log `1:-2:9`: `chunk-build:log-seat` at 77.90, 0.64, −69.00. Vertical error 0 (the measure script's staged read of the same log).
- Next 6 s, after streaming went quiet: **0 begins, 0 ends, 0 repeats**. Nothing per frame.
- Save `boreal.events.v1` was absent (0 bytes) before the push.
- The action button read `E / click · move` on `Shield stone`. The click remembered `stones:1:-2:41` only. Notice: "Stone pushed with your snout. Its new position is remembered." No log key in the save.
- The push bumps `revision`, which disposes and rebuilds chunks. The same log begins a second time and one `end` is logged. That is the falling edge then the rising edge, the same path as walking out of interest range and back. A 12 s hold of W only moved the wolf about 4 m (SwiftShader frames are slow), which is inside the 100 m interest radius, so the walk itself did not dispose the home chunk.

Frames (the why row is scrolled into view):

- `tasks/evidence/T-0006/log-why.png` — noon forest, wolf in the shallows, inspector on entity `1:-2:9`. **why now:** Fallen wood - resting on the ground, becoming forest floor (one more trunk cycle). **why chain:** the 23 steps from photosynthesis through buried.
- `tasks/evidence/T-0006/rock-why.png` — same stand after the snout push. **why now:** Shield stone - moved by the player. **why chain:** weathered over time → embedded in the ground → moved by the player.

`tasks/evidence/T-0006/capture.json` has the console lines, the save keys and those two strings.

## Checks
- `npx tsc --noEmit` exit 0.
- `npm test` exit 0: 642 tests, 628 pass, 0 fail, 14 todo. The board todo is the pre-existing legacy rule breaks. This branch adds none. The rejected 07:00 grok claim is still one of them (append-only; the comment event explains it).
- `rg "three|document" src/core/contactBus.ts` is empty.
- Bench above, pass.

## Leftovers
- Paw contacts stay on `onTouchdown` (Claude's comment).
- `seatRock` is still not an emitter. The pushed rock's why is written by `interact`, not by a new begin.
- A chunk rebuild on every interaction re-fires log edges. Idempotent, noisy under `?contacts=1`.
- CSSC 1998 ranges stay `[verify]` until someone opens the book. 1300 is only the midpoint of the range already in `ground.ts`.
- Matthew's questions 1–3 (later effects, a continuous tick, paws) stay open.

## Needs from another agent
None for the gates. Another agent reviews the PR. grokbot-3 does not approve this branch.
