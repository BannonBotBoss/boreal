# T-0012 handoff — grokbot-3

Agent: grokbot-3. Branch: `grokbot-3/people-agent-core`. Clock: Pacific (America/Vancouver, UTC-7), stamped by the script that writes the events. Issue #8.
Claim: `tasks/events/2026-10-25T02-21-55-grokbot-3-claim-T-0012.json` (`at` 2026-10-25T02:21:55-07:00). Complete: `tasks/events/2026-10-25T02-21-56-grokbot-3-complete-T-0012.json` (`at` 2026-10-25T02:21:56-07:00).

Plan: agy's approve-plan `tasks/events/2026-10-21T11-45-agy-approve-plan-T-0012.json` (`at` 2026-10-21T11:45:43-07:00). Not a new propose and not a new approve-plan. Not self-approved. Matthew, 2026-10-24 17:10 PT, said "every 30 minutes, check the issues and get one done." That names the run, not this task's design, so it is not an approve-plan and not an approve.

## What this run is doing
People (visitors) on the shared agent. Travel between water, berries and rest. A stranger turns to the wolf. A friend walks over and stays.

## Board check before the claim
`git fetch origin`. Open PRs: #73 `grokbot-3/deer-agent-core` (T-0011, this agent's own open PR) and #66 `grokbot-1/core-light-elements` (T-0070, claimed, not a completion). No branch and no event claims T-0012. Events on every fetched head: propose `2026-10-21T10-25-grok-propose-T-0012.json`, approve-plan `2026-10-21T11-45-agy-approve-plan-T-0012.json`. Ledger: T-0012 approved, 52 cr, no claimant.

Rule 15, not a new comment: #73 is grokbot-3's own work. T-0070 is claimed, not completed. The older completed-and-unapproved rows (T-0025, T-0032, T-0028, T-0021, T-0069) were reviewed on `grokbot-3/review-loop` and `grokbot-3/fix-duplicate-t0071`. This run does not re-open them and does not approve them.

T-0011's open PR edits `src/core/agent.ts`, `src/core/deerHerd.ts`, `src/core/stateFields.ts`, `src/audio/borealSound.ts`, `src/render/animalRig.ts` and the deer block of `buildScene.ts` `simulateAnimals`. This branch does not edit those. The person row is appended in `species.ts` after `WOLF_AGENT`. `BEHAVIOUR` gains `person`. A merge with #73 will conflict on that one export; the deer row and the person row both stay.

## What was built
`PERSON_AGENT` (`BEHAVIOUR.person`) is the same `AgentSpecies` as the hare and the wolf. `stepVisitor` (`src/core/visitors.ts`) calls `createAgent` / `stepAgent`. It does not call `AnimalBrain.decide` and it does not edit `agent.ts`.

- Hunger (energy under `fed` 80) walks to the nearest forage entity at 1.393 m/s and picks. The pick is the `person | forage` transaction, only while the feed contact is on the bus.
- Thirst (hydration under 70) walks to `drinkPoint`, the last dry step toward `nearestWater`. At the lip, a 0.3 L cup raises the meter over 12 real seconds.
- Sated, no wolf: they sit. The LOD drops `PERSON_SIT_M` (0.45 m) and there is no `sin(time * .7 + seed) * .07` sway.
- A stranger (`relationship` not `'friend'`) faces the wolf and stays put outside 8 m. Inside 8 m they step back at 2.533 m/s.
- A friend is not passed as a threat. The same record field the deer read becomes a lure. They walk to the wolf and, within the pipeline's 1.2 m hold, stay.

The inspector (`describe`, person only) appends `withDoing` and a `why.goal` line from `visitorReadout`. Chains are not stored.

## How to verify
`npx tsc --noEmit` exit 0. `npm test` exit 0: 698 tests, 684 pass, 0 fail, 14 todo. Focused: `npx tsx --test tests/visitors.test.ts` (7 pass).

In the game, a visitor near berries with a low seed store walks to the patch. One at the shore with a low water store faces the water. One who has been spoken to (friend) walks toward the wolf instead of backing away. The body yaws with the heading. It does not rock on a sine.

## Numbers
Value | game number | real figure + source | resembles nature?

- Comfortable walk | 1.393 m/s (`PERSON_WALK_MPS`, `speed.approach`) | 139.3 cm/s, men in their 20s, Bohannon 1997, Age Ageing 26:15, doi:10.1093/ageing/26.1.15 | yes
- Fast walk (step back) | 2.533 m/s (`PERSON_FAST_MPS`, `speed.flee`) | 253.3 cm/s, same table, maximum gait without running | yes for a fast walk. A sprint is faster. This is not a sprint
- Pick shuffle | 0.4 m/s (`speed.feedStep`) | none | no. Flagged. A step inside the patch
- Day clock | `PERSON_DAY_S` = 24 × `realSecondsPerGameHour` (7200 s) | the clock is design (2 real hours a day, systemProperties) | the compression is labelled. Rates below are per game day
- Energy scale | 100 = 2000 kcal (`PERSON_KCAL_DAY`) | FDA Nutrition Facts reference diet, not a measured expenditure | the scale is the label convention. A real day is often higher
- Energy drain | `100 / PERSON_DAY_S` | one reference day over one game day | yes given that scale and the clock
- Berry energy | 57 kcal/100 g (`PERSON_KCAL_PER_100G`) | USDA FoodData Central FDC 171711, blueberries raw | yes. The mesh is lowbush; the table is highbush. Same order
- Grams per energy | `PERSON_G_PER_ENERGY` = (2000/100) / (57/100) = 35.088 g | the two rows above | yes
- One berry | 1.36 g (`PERSON_BERRY_G` = 68/50) | USDA portion, 50 berries = 68 g | yes
- Pick cadence | 1 berry/s (`PERSON_PICK_PER_S`) | none | no. Flagged. The gram weight is sourced; the cadence is not
- Pick bout | 8 s (`PERSON_PICK_BOUT_S`) | none | no. Flagged. It only groups the cadence
- Patch stock | 68 g (`PERSON_PATCH_G`) | one USDA portion on the bush | a wild mat can hold more. This is one picking
- Hydration seek | 70 | 3% of body mass lost, on a meter where 0 = 10%. Engell et al. 1987, Physiol. Behav. 40:229 (thirst at 3, 5 and 7%) | yes for the line. The 10% span is the meter's top, not a cited lethal point
- Beverage day | 3.0 L (`PERSON_DRINK_L_DAY`) | IOM 2004 DRI, men 19–30, beverages out of 3.7 L total water | yes. Food water (0.7 L) is not a second transaction
- Reference body | 70 kg (`PERSON_REFERENCE_KG`) | ICRP Publication 23 Reference Man | used only to turn litres into the unitless meter. The mesh mass is `entityMass`. Not assigned
- Water points / day | 42.857 (`PERSON_WATER_POINTS_PER_DAY`) | 3.0 L / 70 kg / 0.10 × 100 | yes given those three inputs
- Cup | 0.3 L, 4.286 points, 12 s (`PERSON_CUP_S`) | 10 × 0.3 L = 3.0 L | the volume closes the day. The 12 s is an estimate
- Sight | 40 m, night 0.2, presence 8 m | none | no. Flagged. Open ground, not a canopy trial
- Hearing | 30 m | none | no. Flagged
- Scent potency | 0.2 | none | no. Flagged. Sight does the noticing
- Step-back distance | 8 m (`flee.distance`) | none | no. Flagged. Yellowstone's 100-yard rule is a park instruction not to approach, so it is not this number
- Watch before a moving-cue bolt | `timing.react` 30 s | the pipeline bolts a moving cue after `react` | the 30 s is so distance, not that timer, is the cause. Flagged
- Alert turn | 2.5 rad/s | none | no. Flagged. A quarter-turn finishes inside a second
- Rest recheck | 8 s | none | no. Flagged. How often a seated visitor looks again, not a sleep
- Sit drop | 0.45 m (`PERSON_SIT_M`) | Drillis & Contini 1966 hip ~0.53 of stature; a ground sit is lower | no as anatomy. The clay leg is 0.8 m; 0.45 m reads as seated. Flagged game pose
- Friend pull | 0.4 (`PERSON_FRIEND_PULL`) | none | no. Game margin so the bond beats sitting. Same role as the wolf's 0.2
- Lure hold | 1.2 m | none | no. The shared pipeline's clearance. Not changed
- `fed` 80, `full` 97, mood bends, `fleeMult` 2 | the shared row shape | none | no. Flagged. Hunger is `(fed - energy) / fed`

## Frame / position gate
Metric: `trackScore` in `src/core/visitors.ts`. Tool: `tests/visitors.test.ts`. Recorded in `tasks/evidence/T-0012/position.json`.

Calibration: known match is a sated visitor, score 1, displacement 0. Known mismatch is the old sway `sin(time * 0.7 + seed) * 0.07`, score 0.000 against a 0.14 rad peak-to-peak. That sway cannot pass.

Scores (float error under 1e-12, reported as 1):

- Berries, 4 s, energy 20, patch at (0, −20): z = −5.526 m, expected −1.393 × (4 − 1/30), score 1
- Water, 4 s, water 40, drink at (0, −20): same z, score 1
- Rest, 4 s, energy 95, water 100: z = 0, heading unchanged, posture `rest`, score 1
- Watch, 2 s, wolf at (16, 0) moving 2 m/s: heading = −π/2, moved 0 m, score 1
- Step back, 2 s, wolf at (0, −5): z = +4.982 m, expected 2.533 × (2 − 1/30), score 1
- Friend, 4 s, wolf at (0, −12): z = −5.526 m, because `friend`, score 1

Pixels: not captured. The measured quantity is the body's path and facing. A screen recording is listed under needs. Do not treat the position file as a picture of a person.

## Leftovers
- `decide()` still writes "trotting to sensed forage" for every approach. The speed is the 1.393 m/s walk. Changing that string means editing `agent.ts`, which T-0011's open PR already rewrites. Left.
- The 1.2 m lure hold is the pipeline's, so a friend stops about a body-length short of the wolf.
- Berry regrowth and a real forage field are T-0015. A picked patch stays at the grams left in this process. A chunk reload starts the portion again, because far state is the seed (rule 9). Nothing is saved.
- Sight, the 8 m step-back, the pick cadence, the sit drop and the friend margin are flagged above. They are not tuned to clear the gate. The gate uses the two Bohannon speeds.
- Deer still use `AnimalBrain.decide` on this branch. T-0011 moves them. This branch does not.

## Needs from another agent
A screen recording of one visitor: hungry walk to a berry patch, a sit when sated, a turn toward the wolf, and a friend who walks toward the wolf instead. Save frames under `tasks/evidence/T-0012/`. This run has no pixel frames. The position gate above is the measured substitute (rule 11).

Another agent reviews and merges. This run does not approve T-0012 and does not approve PR #73 or PR #66.

## Exact next step
PR against main. `Closes #8`. Do not merge. Do not push main. Do not self-approve.
