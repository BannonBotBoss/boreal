# T-0020 handoff — grokbot-3

Agent: grokbot-3. Issue #16. Branch: `grokbot-3/behaviour-animation-gate` from main `bc51e4b`. Clock: Pacific, stamped by the script that writes events (`America/Los_Angeles`).

## Claim check (this run)
`git fetch origin`. No claim, complete, or approve event for T-0020 on any fetched branch. Events on main stop at agy's approve-plan `2026-10-21T11:45:49-07:00`. Open PRs at the start of the run were #79 T-0017, #80 T-0018, #81 T-0019. None name T-0020. Issue #16 is open, labels `state:approved` and `agent:grok` (the author).

Matthew, 2026-10-24 17:10 PT: "every 30 minutes, check the issues and get one done." That is why this run took #16. It is not an approve-plan. The plan stays agy's. This complete event is not a self-approve.

## What was built
First complete slice of T-0020 for the hare and wolf behaviours named in the task.

- `src/core/behaviourData.ts` — 22 animation rows. Each id is the animation id. `happening` is the concrete line the prompt tool copies. Timing and bone lengths are copied from rows that already exist (`HARE_GAIT`, `canidPlan`, `HARE_BODY`, `WOLF_LEGS`, `holdVisual`, `PHYS.jumpSeconds`).
- `src/core/behaviourPose.ts` — `sampleBehaviour(id, phase)` is the recording. Wolf gaits call `gaitFor` and `footTarget`. Hare gaits call `footState` from `core/needs/bound.ts`. A leap uses `gaitPose`'s ballistic height (`gravity()`). A plant pose holds the feet.
- `tools/anim-gate.ts` — `diagramPose` is the reference. It reads the row and does not call `sampleBehaviour`, `footTarget`, or `footState`. `scoreAnimation` asks the six questions over 8 frames. Pass at >= 0.95.
- `tools/ref-prompt.ts` — writes `refs/<species>/<behaviour>/`.
- `notes/skills/behaviour-animation-gate.md` — the skill. Task header `skill: behaviour-animation-gate`.
- `tests/behaviour-animation.test.ts` — the numbers, the paw cross-check, and the frame calibration.

The live `playerWolf` / hare mesh is not driven by `behaviourPose`. Deer postures and visitor walk / sit / drink are not in the catalogue. Graze and rest share the bind pose. Sleep shares the drink neck-limit pitch. A full loaf needs a sourced sternum height and was left out. Photoreal frames are logged as a rejected try in each `attempts.md` (rule 11: no calibrated keypoint picker). The accepted reference is the sagittal diagram built from the published footfall row.

## How to verify
```
npx tsc --noEmit
npm test
npx tsx tools/tasks.ts
```
`T-0020` should read `completed`, claimant `grokbot-3`, 90 cr. It stays short of `done` until another agent approves. The legacy rule-break todo stays; this run adds no new break.

Per animation, open `refs/<species>/<behaviour>/gate.txt` (score), `see.txt` (description generated from the recording), `strip.svg` (recording on top, diagram below), `reference/frame-0.svg` … `frame-7.svg`, `attempts.md`, `meta.json`.

## Numbers
Every rate and length below is a value the code already cited, or the midpoint of a published range the same files already use. No new crouch depth and no chew-window fraction. Consume and carry keep the jaw on for the whole sample.

| Quantity | Value | Where it comes from |
| --- | --- | --- |
| Hare body | 0.420 m | ADW head-body 361–479 mm, midpoint, same as `WATERLINE.hare` |
| Hare tail | 0.0455 m | ADW 39–52 mm, midpoint |
| Graze nose | 0.085 m | `HARE_BODY.headY` |
| Head-up nose | 0.220 m | Prescott & Richard 2004 shoulder 20–22 cm, via `hare.ts` |
| Alert nose | 0.200 m | same shoulder band |
| Scan nose | 0.17 m | `HUNT_HOLD.scapulaY` |
| Hare trot | 2.91 m/s, 4.170 Hz | `HARE_GAIT` preferred gallop; Heglund & Taylor 1988 at 1.5 kg. Measured duty 0.505 / 0.575 vs row 0.502 / 0.573 |
| Hare flee | 8.5 m/s, 4.400 Hz | `HARE_NEEDS` sprint, below Seton 11.6 m/s. Hind duty 0.210 vs 0.207; fore 0.160 vs 0.158 |
| Swing fold | fore 0.25, hind 0.8 | existing `SWING.fold` |
| Wolf body | 1.325 m | Wikipedia "Wolf" 105–160 cm, midpoint, same as `WATERLINE.wolf` |
| Wolf ear / tail | 0.10 m / 0.395 m | Wikipedia 9–11 cm and 29–50 cm, midpoints |
| Wolf stalk | 1.27 m/s, 1.500 Hz, duty 0.65 | Bryce & Williams 2017; `gaitData`. One hind sample reads 0.655 |
| Wolf crawl | 0.8 m/s, 1.191 Hz, duty 0.65 | `modeSpeed.stealth`; same walk duty law |
| Wolf trot | 2.70 m/s, 2.100 Hz, duty 0.45 | Bryce & Williams 2017; Maes et al. 2008. Samples 0.450 and 0.455 |
| Wolf flee | 7 m/s, 2.432 Hz, duty 0.255 | `modeSpeed.sprint`, below Mech & Boitani 15.5–17.8 m/s. Row duty 0.252 |
| Leap | 0.85 s, flight share 0.65, dip 0.05 m | `PHYS.jumpSeconds` and `SYSTEM_PROPERTIES.jump`. Apex is `gaitPose` bob from `gravity()` |
| Pin forepaws | y 0.17 m, contact `target` | `HUNT_HOLD.scapulaY` |
| Gather head | 0.55 rad | `holdVisual().head` |

## Frame gate
Metric: share of six questions passed, weighted by frame, over `FRAME_N` = 8. Pass at `PASS_AT` 0.95. Question 2 is silhouette IoU after hip alignment and body-length scale (raster 220×140). Question 3 is ten keypoints (nose, ear, spine, shoulder, hip, four paws, tail) inside `KEY_BAND` 0.05 of body length. Question 6 compares 200 samples of duty, touchdown, and flight with the row (duty tolerance 0.02, touchdown circular tolerance 0.015, leap air within 0.02 of 0.65).

Tool: `scoreAnimation` in `tools/anim-gate.ts`. The recording is `sampleBehaviour`. The reference is `diagramPose`.

Calibration: every unshifted behaviour scores 1.000 and silhouette IoU is 1 (`refs/<species>/<behaviour>/gate.txt`, and `tests/behaviour-animation.test.ts`). Known mismatch: `scoreAnimation('hare-flee', phase => sampleBehaviour('hare-flee', phase + 0.5))` scores 0.333.

All 22 rows pass. First set named in the task: `refs/hare/graze`, `refs/hare/head-up`, `refs/hare/flee`, `refs/wolf/stalk`, `refs/wolf/leap`, `refs/wolf/pin`, `refs/wolf/bite`, `refs/wolf/carry`. The rest of the catalogue (alert, scan, trot, rest, drink, sleep, crawl, flee, consume, release) is in the same layout. Hare flee `see.txt` shows the half-bound: phase 0 LF down, 0.125 LF+RF down, 0.250 and 0.375 airborne, 0.500 and 0.625 LH+RH down, 0.750 and 0.875 airborne. Wolf leap `gate.txt`: airborne 0.650 vs flight 0.65.

## Evidence
- `tests/behaviour-animation.test.ts` locks bones to `HARE_BODY`, `HUNT_HOLD.scapulaY`, `WOLF_LEGS`, `HEAD_AT × WOLF_SCALE`, `SWING.fold`, `holdVisual().head`, `DEER_LEGS.hip`, and the jump crouch/flight shares.
- Wolf paw x equals `restX - footTarget().z` within 1e-9 m on stalk, trot, flee, crawl, and carry.
- Hare flee LH duty equals `boundDuty` and LF equals `boundForeDuty`.
- Leap hip offset equals `gaitPose('jump', …).bob` within 1e-9 m.
- `npx tsc --noEmit` exit 0. `npm test` 735 tests, 721 pass, 0 fail, 14 todo.

## Rule 15
Pending reviews were inventoried on `grokbot-3/review-loop` and `grokbot-3/fix-duplicate-t0071`. This run's instruction is to finish #16. No new review comment. Those earlier reviews are cited here and are not an approval of those tasks.

## Needs from another agent
Nothing blocking. A later owner can drive the live mesh from `sampleBehaviour`, and can add deer and visitor rows with their own sourced lengths. Photoreal frames are not required for this score.

## Exact next step
Push `grokbot-3/behaviour-animation-gate` and open the PR against main (`Closes #16`). Do not merge. Do not push main. Do not self-approve. Another agent reviews.
