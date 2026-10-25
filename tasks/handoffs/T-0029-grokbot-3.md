# T-0029 handoff — grokbot-3

Agent: grokbot-3. Branch: `grokbot-3/river-banks`. Clock: Pacific (America/Vancouver, UTC-7). Issue #24.

## What this run is doing
Issue #24, T-0029. A channel that crosses a filled depression ponds up to its spill, and any remaining drawn segment is capped at the unconfined bank, so the water sheet meets the ground. Local `npx tsc --noEmit` and `npm test` passed, and CI `test` run 40206127929 succeeded on `d66d60d`. Not self-approved.

## Why this issue
Issue #17 (T-0021) is not workable. grok claimed it at 2026-10-23T00:31:00-07:00 and completed it at 2026-10-23T02:23:45-07:00. grokbot-3 already commented on 2026-10-24 that the handoff is stale against main. D1–D6 still need Matthew. The skill `notes/skills/board-rule-inspection.md` is already on main.

Skipped as claimed or already reviewed, in issue order: #18 T-0022 (codex claim, side branch only), #19 T-0023 (claude), #21 T-0025 (agy, blocking review), #22 T-0027 (grok, approved), #23 T-0028 (grok). The standing skip list also drops #1, #2, #3, #5–#16 and #20. Discussion issues were not taken. T-0029 is the first remaining task with a non-author approve-plan and no claim.

The plan is the one grok approved at 2026-10-21T17:15:45-07:00 (`tasks/events/2026-10-21T17-15-grok-approve-plan-T-0029.json`). No claim on any remote branch. No open pull request named T-0029. Nothing here needs a file or key only Matthew has. Matthew's standing "every 30 minutes, check the issues and get one done" (2026-10-24 17:10 PT) is why this run took an open issue. It is not a quoted approval of this result, and it is not a new approve-plan.

Rule 15: no new review comment on unchanged blocked submissions, and no approval of grokbot-3's own open PR #82.

## Done
- [x] Claim event `tasks/events/2026-10-25T08-14-28-grokbot-3-claim-T-0029.json` (`at` 2026-10-25T08:14:28-07:00). Plan stays grok's. Not a new propose and not a new approve-plan.
- [x] Channel pits deeper than `RIVER.freeboard` (0.12 m) become ponds at the spill. Why chain `filled -> ponded -> spilled` on every body. Off-channel pits stay peat. `ELEV.lakeMinDepth` stays 12 m.
- [x] Remaining drawn segments are capped at the lower unconfined bank (Lindsay 2016's constraint, no Whitebox port). Slope and Manning speed stay on the filled surface.
- [x] The water sheet uses `pondAt` the same way as `lakeAt`. A dry shore vertex sits on `heightAt`. A wet vertex beside lower dry ground drops to that ground.
- [x] `surfaceAt`, `terrainBand`, `isDryLand`, `siteAt`, and the globe mask treat a pond as water.
- [x] `riverContainment` in `tests/river-contain.test.ts`. Seed 1400 and seed 7 both report `openShare` 0.
- [x] Skill `notes/skills/river-pond-containment.md`.
- [x] `npx tsc --noEmit` exit 0.
- [x] `npm test` exit 0: 736 tests, 722 pass, 0 fail, 14 todo. The 14 todo are the existing board todos.
- [x] CI `test` on PR #83 succeeded. Run 40206127929, commit `d66d60d`, job https://github.com/BannonBotBoss/boreal/actions/runs/40206127929/job/121207326832. Complete event `tasks/events/2026-10-25T08-25-49-grokbot-3-complete-T-0029.json` (`at` 2026-10-25T08:25:49-07:00). Not self-approved.

## Exact next step
PR #83 is open against main. Do not approve this task (own work). A non-author reviews and merges after `agent-review`. CI `test` is already green.

## Choice
Both options in the task, in that order. Deep channel residuals (fill depth greater than 0.12 m, not a stage-2b lake, not an outlet) flood-fill 8-connected from a channel cell. Level is the max filled height. Shoreline is the lake test: a corner node in the body and bilinear ground below the level. Area under 2 ha is a pond, otherwise a lake (the cut already in `lakeGrid`, Biggs et al. 2005). `drawn` is cleared on those cells; the channel flag stays so Strahler is unchanged. What is still drawn gets a per-segment cap: the min unconfined side ground 1 m past `half + bank`, plus just under 2 cm. Up to 8 passes, because carving a neighbour can lower the bank. The surface is `min(filled − freeboard, cap)`.

`GENERATOR_VERSION` stays 1. The version is inside the chunk-seed hash, and forage records are stored as `generatorVersion: 1`. Lakes already skip entities through `isDryLand` without a bump. Ponds use that same skip. The chunk digest pin `50484521d390b267` is unchanged.

## Numbers

Measured 2026-10-25 on seed 1400 with `riverContainment` and `riverPondGrid`, unless a row says otherwise. Before is the 2026-10-21 audit in this task file (`contained.json` at that commit: 572 segments).

| value | game before | game after | real figure and source | match |
|---|---|---|---|---|
| open share (surface > 2 cm above ground 1 m past the sheet) | 0.615 (352/572) | 0 (0/201) | 0. Hydrostatics: a free surface over unconfined ground spreads until it meets the ground. | yes |
| open among flat / among sloped | 0.831 / 0.149 | 0 / 0 | 0, same reason | yes |
| edge height | p10 0.23 m, median 1.53 m, p90 7.07 m | null (no open edges) | 0 m | yes |
| seed 7 open share | not in the old audit | 0 (0/273) | 0 | yes |
| flat-fill share of drawn cells (S ≤ 1e-4) | 0.684, median speed 0.06 m/s | 0.100, median speed 0.06 m/s | Priority-Flood marks these cells below their spill (Barnes, Lehman & Mulla 2014, Computers & Geosciences 62:117–127). They leave the drawn set and become ponds. | yes: the remaining 10% are flat cells the cap still draws, not walls |
| pool-riffle share (1e-4–0.02) | 0.117 | 0.333; vGameMed 1.29 m/s, Jarrett 0.70, sMed 0.0097 | Jarrett 1990 velocity at that slope. Speed is not retuned here (T-0030). | reported, not retuned |
| step-pool share (0.02–0.08) | 0.163 | 0.463; vGameMed 2.77, Jarrett 0.84, sMed 0.0417 | same | reported, not retuned |
| cascade share (> 0.08) | 0.037 | 0.104; vGameMed 3 (the existing cap), Jarrett 1.02, sMed 0.1029 | same | reported, not retuned |
| speed-capped share | 0.096 | 0.274; sMin 0.0432; Jarrett at the cap 0.77, 0.96, 1.19 | the 3 m/s cap is existing. Not changed. | reported, not retuned |
| freeboard / pond threshold | 0.12 m | 0.12 m (`RIVER.freeboard`) | the freeboard already in `rivers.ts`. A residual deeper than that is ground below the spill. | yes, existing |
| area cut | 2 ha | pond if area < 2 ha, else lake | Biggs et al. 2005, the cut already in `lakeGrid` | yes, existing |
| pond bodies, seed 1400 | 0 (drawn as channel) | 52 bodies (34 pond, 18 lake), 5374 cells, area min/med/max 0.09 / 1.08 / 102.6 ha, median max depth 1.424 m | one cell is 30×30 m = 0.09 ha. Chains of small lakes on the Shield are the task's own description of option A. | yes |
| float (−1875, −255) | sheet above the meadow (surface 24.68 m vs ground 20.62 m beyond the bank) | standing water, kind lake, 26.1 ha, level 24.82 m, max depth 11.98 m, ground 20.92 m, river null, why `filled -> ponded -> spilled` | just under `lakeMinDepth` 12 m, so stage-2b never took it. The spill pond does. | yes |
| slow1 (−1180, −680) | sheet ~5 m wide, ground ~20.1 m out to 14 m | pond 1.8 ha, level 20.50 m, max depth 1.63 m, ground 20.13 m | a surface at 20.5 m covers the flat, which is the pond | yes |
| order2 (2970, 310) | drawn river, left bank below the water | still drawn, order 2, surface 0.47 m, bed 0.04 m, half 3.39 m, bank 4.07 m, speed 3 m/s. Containment 0, so the sides are not above the ground. | a confined channel keeps a surface below both banks | yes |
| loon callers, seed 1400, 7680 m | 1 (T-0017 score on main) | 22 | `habitatOf` counts `kind === 'lake'`. Channel ponds at or above 2 ha are that kind. The schedule is unchanged. | consequence, not a retune |
| woodpecker callers, same map | 555 | 489 | wet cells are not land, so the canopy draw skips them. The drum interval is unchanged. | consequence, not a retune |

`tests/callField.test.ts` rewrote `refs/T-0017/score.json` on this run. Timing scores still clear 0.95. `realTerrain` position is still 1. Known mismatches stay 0 and −2.264.

## Frame gate
A full recapture is N/A on this machine. `capture.mjs` now finds Chrome and uses SwiftShader off Windows. It wrote one float still (`refs/water/river-audit/float/after-across-0.png`, 1280×720, 2026-10-25 14:59 UTC) and then `Page.captureScreenshot` timed out at 60 s. A second headless screenshot hung with a GPU stall on ReadPixels. `/dev/dri` is empty. The 2026-10-21 before-frames, including the teal wall in `float/across-0.png`, are restored and not overwritten. slow1 and order2 were not re-shot. Pixel resemblance to `refs/water/river-audit/reference/real-*.jpg` is not a calibrated timing metric.

Substitute, measured by `riverContainment` (the old `contained.ts` loop, now in `src/core/stages/riverContain.ts`). A segment is open when the surface is more than 0.02 m above the ground 1 m past `half + bank` and that point is not already lake, pond, or channel. Score = 1 − openShare. Calibration: the pre-change network scores 0.385 (open share 0.615, the known mismatch). A contained network scores 1.

| check | score |
|---|---|
| seed 1400, 201 drawn segments, open share 0 | 1 |
| seed 7, 273 drawn segments, open share 0 | 1 |
| pre-change seed 1400, open share 0.615 (known mismatch) | 0.385 |
| water-sheet shore, chunks (−47,−7), (−30,−17), (74,7), waterSeg 16 | every wet vertex that touches a dry vertex is within 5 cm of that ground, and the dry vertex is `heightAt`, not `heightAt − 0.6`. At least one shore edge. |

## Needs from another agent
Review the PR. Do not merge without CI `test` and a non-author `agent-review`. Approving this task is a separate board event by someone other than grokbot-3.

A machine with a GPU can re-run `node refs/water/river-audit/capture.mjs <port> float slow1 order2` if pixels are required. The one landed still is `float/after-across-0.png`.

## Leftovers
- T-0030 owns whitewater and speed. Manning `n` and the 3 m/s cap were not retuned. The slope-class table above is the remeasure T-0030 should read, because the flat cells left the drawn set.
- T-0031 owns planform. It also edits `rivers.ts` and should land after this.
- Off-channel pits stay the peat case in `soils.ts`.
- No new task id. Duplicate task-id scan of every remote branch: the only pair is T-0071 on `docs/research`, `grokbot-1/altitude-zones`, and `grokbot-1/local-cloud-column`. Main has one file per id. Those side branches were not renumbered.

## What the next owner needs
`npx tsx refs/water/river-audit/contained.ts` prints the containment object. `npx tsx refs/water/river-audit/slopes.ts` reprints the class table. `tests/river-contain.test.ts` is the gate.
