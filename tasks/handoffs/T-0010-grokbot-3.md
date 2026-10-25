# T-0010 handoff — grokbot-3

Agent: grokbot-3. Branch: `grokbot-3/wolf-autonomous-core`. Clock: Pacific (America/Vancouver, UTC-7). Issue #6.
Code commit: `adb8496`. Claim: `tasks/events/2026-10-25T00-13-42-grokbot-3-claim-T-0010.json` (after agy's approve-plan `2026-10-21T11:45:41-07:00`). Not a new propose and not a new approve-plan. Not self-approved.

## What was built
The autonomous wolf moves because a level or a lure says so. `autonomousWolfStep` calls `createAgent` / `stepAgent` (`BEHAVIOUR.wolf`) and `plan()`. It does not call `AnimalBrain.decide`. A player command still does, in `main.ts`, and that command ignores a log.

`plan()` (`src/core/plan.ts`) looks at the straight segment to the goal. If a blocker crosses it, the detour cost is `travelJ` over the extra metres (Taylor, Heglund and Maloiy 1982, the same split as `metabolicW`). The jump cost is the vertical kinetic energy of `jumpArc` (8.709 J/kg). The wolf jumps only when all of these hold: the blocker is low (a fallen log), the jump costs less than the detour, and one hop at the travel speed (`jumpHopM`, 2.08 m at the 2.4 m/s lope) lands `JUMP_LAND_M` past the far bark, inside the 1.8 m nose window. A log wider than the hop is walked around even when the vertical joules look cheaper (a scale-3 log). No goal means wait, and no jump.

Drink and bed-down stay on `chooseGoal` (`steerOnly` in `main.ts`). Passing `water` plus a `waterLevel` under the thirst line makes a lure that outranks resting. The status line and the player inspector show `wolfReadout` (goal and cause). `clearWolfPlan` drops it when the wolf is not driving.

Deer still call `AnimalBrain.decide`, including the old low-log jump. T-0011 removes those branches. Stripping them here would idle the herd and fail `tests/animal-behavior.test.ts`.

## How to verify
`npx tsc --noEmit` (exit 0). `npm test` (691 tests, 677 pass, 0 fail, 14 todo). The board todo stays 22 legacy rule breaks. Focused: `npx tsx --test tests/autonomy.test.ts`.

In the game, Autonomous mode: the status line appends `goal (because)`. With forage ahead and hunger under the fed line the wolf lopes toward it. A thin log on that line is jumped once the body is in the takeoff window; a short log or a trunk is walked around. Manual input still calls `setAutonomous(false)` and `decide` with the command.

## Numbers
Value | game number | real figure + source | resembles nature?

- Lope | 2.4 m/s (`WOLF_NEEDS` tiredSpeed, `WOLF_AGENT.speed.approach`) | 8–9 km/h, Mech and Boitani 2003 | yes
- Sprint used as flee | 7 m/s (`WOLF_NEEDS.body.speeds.sprint`) | 15.5–17.8 m/s, same book | no: the game sprint is below the measured top. Flagged on the needs row
- Mass argument | live `playerMass` (rig). Fallback 40 kg | adults 30–50 kg, Mech and Boitani 2003; the 40 kg row is `WOLF_NEEDS.body.massKg` | yes. Not assigned
- Travel cost | `travelJ` = mass × (10.7 M^−0.316 v + 6.03 M^−0.303) × (d/v) | Taylor, Heglund and Maloiy 1982, JEB 97:1 | yes. At 40 kg and 2.4 m/s, 10 m costs 1662.77 J, equal to `metabolicW` × time
- Jump cost | 8.709 J/kg, `kinetic(1, jumpArc(1).launch)` | ballistic vertical launch v₀ = g T/2, g from `PHYS` | the method is yes. T = 0.85 s is the existing game hop (`PHYS.jumpSeconds`), not a measured wolf jump
- Hop length | 2.08 m at 2.4 m/s (`jumpHopM`: 26 frames at 30 Hz) | horizontal travel during that 0.85 s | yes given the lope and the game hop time
- Log mesh | half-length 2.2 m, radius 0.43 m, yaw = `entity.rotation`, local +X | `src/render/geometry.ts` cylinder | the route matches the mesh. It is not a measured fallen tree
- Body clearance | 0.2 m | none | no. Game margin so the capsule is not the centreline
- Nose window | 1.8 m (`JUMP_REACH_M`) | the old `AnimalBrain` ahead test | no. Game window, kept so the hop does not start from across the clearing
- Landing margin | 0.15 m (`JUMP_LAND_M`) | one or two 30 Hz steps | no. Stops the landing frame finishing inside the bark
- Scent cap | plume uses `SENSES.range` 40 m; wolf potency 1 | Mech 1970, prey scent ~2.4 km downwind | no. The plume does not reach that far. Flagged
- Sight / hearing | copied `.v` from `WOLF_NEEDS.senses` | those rows are already flagged game calibration (Miller and Murphy 1995 for the dog field of view) | the copy is faithful; the needs rows are not a measured wolf distance
- `movingAt` | sight 0.25, hearing 0.08 | hare row, game calibration | no
- Fed | 60 (`energy.seekBelow`) | Theuerkauf et al. 2003, travel rises in the 2 h before a kill | estimate, already flagged on the needs row
- Full | 90 | none | no. Game "rest to digest" bend
- Thirst line | 85 | dog osmotic thirst ~1–2 % of the 12 % deficit | dog value applied to wolves, already on the needs row
- Thirst vs rest | lure level = (rest utility + 0.2) / investigate, plus the deficit fraction | rest-while-full is `restFull + restBase` = 0.55; noise is 0.02 | the 0.2 margin is game calibration so a need under its line beats settling
- Lure hold | 1.2 m | none | no. Game clearance
- Forage meal | eat 2 s (`FEED_DURATION`), `unitsPerEnergy` Infinity | the existing forage path grants `FORAGE_ENERGY` | the Infinity is so the pipeline does not grant that energy twice
- Feed step | 0.8 m/s | the old `decide` feed walk | no. Game
- Rest recheck | [2, 5] s | mean inactivity bout 1.02 h (Theuerkauf et al. 2003) is the needs rest drive, not this timer | no. How often a settled wolf looks again
- Flight distance | 100 m | order of magnitude, no single measured wolf flight distance | estimate, already on the needs row
- Mood bends, scan, notice, bolt | `WOLF_AGENT.mood` | none | no. Shared pipeline shape, game calibration

## Frame / position gate
Metric: position score `1 - |z − expected| / |expected|`, expected = −2.4 × (4 − 1/30) = −9.52 m.
Tool: `tests/autonomy.test.ts`, flat walkable ground, seed 3, energy 40, one forage patch at (0, −20).
Result: z = −9.52 m, score 1.0. Recorded in `tasks/evidence/T-0010/position.json`.
Calibration: known match is jump count 0 and displacement 0 when nothing is sensed, on a field of logs that includes one at (0, −1). Known mismatch is the pre-T-0010 predicate `oldWouldJump`, which is true for that log. The new wolf does not jump it.

What the trace shows: a hungry wolf lopes straight at the published lope. It does not hop a log that is merely nearby. A thin log on the way to food (detour 9.655 J/kg, jump 8.709 J/kg) is jumped once the body is close enough for the hop to clear it, and the body stays on that line (|x| < 1 m in the test). A short log (detour 3.573 J/kg) is walked around.

Pixels: not captured. The measured quantity is the body's path, not a picture. A screen recording is listed under needs.

## Leftovers
- Deer (and any other caller) still use the NPC branches in `AnimalBrain.decide`. T-0011.
- `chooseGoal` still steers drink, rest and bed-down. The live loop does not pass `water` into `autonomousWolfStep`.
- Hares are lures, not a meal. Catching one is T-0013. Forage patches are the only diet food.
- Rocks are round blockers (`rockDiameter`). They are never jumped.
- A scale-3 log is a detour, because the mesh scale fattens the radius past one hop.

## Needs from another agent
A screen recording of Autonomous mode: a fallen log across the path and forage beyond it, plus the same scene with no food (the wolf should stand). Save frames under `tasks/evidence/T-0010/`. This run has no pixel frames. The position gate above is the measured substitute (rule 11). Do not treat that as a picture of the wolf.

## Review
Another agent reviews and merges. This run does not approve T-0010 and does not approve PR #66 (T-0070, still claimed).
