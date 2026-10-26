# Handoff T-0080 — grokbot-3

Documentary task (rule 12). No picture changes. grokbot-3 authored the plan and does not approve it.

## What this is

The full path from the current game to issues #100–#109, in `notes/design-roadmap.md`. Branch `grokbot-3/design-roadmap`. Status of the task: proposed. Not claimed.

## Doing now

The plan is on pull request #114. A correction marks steps 30 and 31, and the delivered parts of steps 32–35, as already on pull request #92. The remaining wiring (animals, weather, ground following the scale) stays in the queue. Do not merge. Do not claim T-0081–T-0087. Do not open a second wheel.

## Done

- Read issues #100–#109 (no comments on them at read time).
- Compared them with the planet crate, the forest weather, scent, needs, playables, interest, deep time, pull request #92, and pull request #94.
- Wrote the roadmap: plain summary, 21 conflicts, 38 steps, coverage table.
- Added the one precedence line to `PROJECT-RULES.md`.
- Proposed T-0080 through T-0087 only.
- Recorded Matthew's 7:15 PM and 7:17 PM Pacific notes as comment events with `"for": "matthew"`. Those comments are not approvals.

## Findings (reviewer spot-checks any three)

| # | Finding | Evidence | Became |
|---|---|---|---|
| 1 | The forest computes a second climate beside the Rust planet grid | `src/core/weather.ts` `climateRaw` lines 112–118; planes in `rust/boreal-sim/src/grid.rs` lines 7–17; wasm host `src/core/planetBudget.ts` lines 1–8 | Step 2, task T-0082. Rewrite of authority. Formulas reused. |
| 2 | The wolf panel shows a percent and a distance | `src/ui/senses.ts` lines 31 and 69; `src/core/needs/senses.ts` `threatCue` lines 37–41 | Steps 20, 24, and 25. Queue, no task file yet. Scent math in `src/core/senses.ts` stays. |
| 3 | Pull request #92 now has the log wheel. The 0.05–16 clamp is gone. The lip is still about 1.32×, and that pull request is moving it to exactly 1× | `origin/grokbot-3/single-time-control` `src/core/worldClock.ts`: `targetRateFromDial`, `DIAL_DEADZONE` 0.01, `DIAL_DECADES` 12, `DIAL_SPRING`. Commit `565b2e6`. Branch tip `8f14525` when this row was corrected. The header comment still says the first notch is about 1.32× | Steps 30 and 31. Delivered there. Not queued. The 1× lip stays on #92. |
| 4 | Entering an animal creates a fresh rig | `src/render/playables.ts` lines 27–50 | Step 17. Queue. The shared motor stays. |
| 5 | Issue #101's JSON export fights issue #106's packed perception buffer | Issue text. Nothing in the repo sends that JSON | Step 16, task T-0083. #106 wins. |
| 6 | Snow below 0 °C is already the code | `src/core/weather.ts` line 274; `precipitation.rs` line 77 | Step 7, task T-0087. Reuse. The threshold is not replaced. |
| 7 | `agent.ts` already picks an act from utilities. Issue #101's cutoff ladder would be a third brain | `src/core/agent.ts` lines 1–16 | Step 10. Queue. #103 wins. The ladder is not ported. |
| 8 | Deep time puts zero at now. Issue #108 puts zero at formation | `src/core/deepTime.ts` `dialToYears` lines 91–96. On pull request #92, `epochOffsetYr` is session seconds passed into `deepTimeAt` | Step 3. Queue. Branch from that clock. The wheel is already there. The epoch is not. |
| 9 | Interest drops far individuals. Issue #101 keeps every individual. Issue #109 aggregates them and forbids a pop | `src/core/interest.ts` lines 10–19. On pull request #92, `simWorldSec` holds animals above Immediate instead of transforming them | Steps 14 and the rest of 32. #109 wins. Queue. The scale signal is already on #92. |
| 10 | Issue #107 keeps the simulation at full detail always. Issue #109 switches the simulation by time level | Issue text, and pull request #94 covers only the spatial picture | Steps 14 and 32. #109 wins. Spatial work stays in pull request #94. |
| 11 | Issue #102 stores a mass. Rule 4 derives mass | `PROJECT-RULES.md` rule 4; issue #102 `body_mass` | Step 18. Queue. The field is not added. |
| 12 | Two open changes already cover a piece | Pull request #94 (T-0078, the spatial picture) and pull request #92 (T-0077 the one clock, and T-0078 on that branch for the dial — not the render plan's T-0078) | Linked. Steps 30 and 31, the scale signal, clock-and-sun rewind, and the ground's refusal of a backward gap are #92. No duplicate task. |

## Needs from another agent

- Approve-plan on T-0080 through T-0087, by an agent other than grokbot-3. Matthew's two comments do not approve them: he did not name the task ids.
- Review this pull request. Do not merge it from this run.
- Nothing to generate. No frame. The evidence gate is this table.

## Review-first note

Open pull requests at the start of this run were #91, #92, #93, and #94, all `grokbot-3/*`. grokbot-3 does not review its own branches. No other agent's open pull request was in the list, so no approve or reject was recorded.

## How to verify

1. Open `notes/design-roadmap.md`. The first section after the header rule is the plain summary, ten lines, no abbreviations.
2. Pick three rows in the coverage table. Each names a step that exists.
3. Pick three findings above. The file and line still say what the row says, at commit `14d5782` for main files.
4. `npx tsx tools/tasks.ts` shows T-0080–T-0087 as proposed, author grokbot-3, with no claim.
5. `npm test` and `npx tsc --noEmit`.
