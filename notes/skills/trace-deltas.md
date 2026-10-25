# Skill: write a scent mark, a carcass or a dropping, and let every agent smell it

Use when an act should leave a trace another animal can smell. The delta kinds, their lifetimes and the 1500 cap already exist. Do not add a kind and do not retune `DELTA_KINDS`.

## Steps
1. Read `src/core/deltas.ts` (`record`, `near`, `strength`, `DELTA_KINDS`), `src/core/senses.ts` (`scentLevel`), `src/core/transactions.ts`, and `src/core/traces.ts`. The plume is dimensionless. A mark's `m` is 1 (Peters & Mech 1975 simulated 5 cc; that volume is not a concentration). A carcass `m` stays kilograms. A dropping `m` stays dry kilograms so the residue on expiry is the faeces (`kgPerM` 1), and the odor is the row's strength.
2. The writer is a transaction, not a `setInterval`. Wolf|ground `mark` (`tryMark`) fires when this step moved and no fresh own mark (same `meta`) is inside 450 m. Hare|ground and deer|ground `droppings` (`addFeces`) fire when the gut reaches one pellet or one pellet group. The consume row in `src/core/huntHold.ts` already writes the carcass. Do not import `huntHold` from `traces` (the sim imports both).
3. Species data only. `AgentSpecies.senses.scent.range` is that nose's cutoff for a trace. `traces.response` uses the fear scale: -1 avoids, +1 attracts, 0 is only smelled. `traces.droppings` is `{ groupG, fecesGPerUnit, unitsPerWetKg? }`. The pipeline reads those fields. It does not branch on species id except the live hare, which is not on `stepAgent`.
4. `stepAgent` smells `deltaSources` through `scentLevel`. A live body at or above `noticeAt` outranks a trace. Otherwise the strongest negative hit sets heading with `awayFrom` and speed `flee` or `approach` from `fleeAt`. A positive hit is a lure (`investigate * level`), and inside 1.2 m the animal holds. Clear `target` on an avoid so a stale food goal does not pull them back in.
5. Live hares tick in `core/sim` `stepPrey`. On an `ate` of clover, convert wet kg with `unitsPerWetKg` and call `addFeces`. Just before `move`, if the hare does not already know a predator, `bestAvoid` may set heading and speed. Do not touch the bout timers when the log is empty. `tests/sim.test.ts` pins those bouts.
6. The wolf HUD (`src/ui/senses.ts`) pushes `deltaSources` at `WOLF_AGENT.senses.scent.range`. Bodies keep the default range. The player wolf calls `tryMark('wolf:player', x, z, moved)` after the pose update, manual or autonomous. Footprints stay on the 1 s interval. Deer droppings do not.
7. The gut is a `Map` in `traces.ts`, not a delta and not on the agent snapshot. `resetTraceGut()` in tests. A rewind can double a half pellet. Say so. Do not add a delta kind to persist it.
8. Numbers: cite the rate in the species row. Hare pellet = 167 g DM/day * (1 - 0.36) / 576 (Rivera 2005, UMT thesis, 576±108). Deer group = 70 kg * 0.022 * (1 - 0.55) * 1000 / 34.4 (Rogers 1987, free-ranging July-August; the penned-winter 12.7 on `FAUNA` is a different season). Wolf nose 2400 m is Mech 1970, already on `WOLF_NEEDS`. Deer scat cutoff 2 m is Kuijper via van Ginkel et al. 2019, PLoS ONE 14(11):e0223248. That paper's urine response was 0.5 m. One cutoff cannot be both; use 2 m and say the urine is smelled only inside that same distance. Hare and person at 2 m are estimates. The 0.35 deer dry fraction is the existing diet estimate.
9. Tests in `tests/traces.test.ts`. Save and restore `DELTAS.log`. Assert tau 10 / 8 / 60 and cap 1500. Assert the formulas. Assert spacing, the gut, `consumeHold` still writing a carcass, deer walking away, wolf walking toward, and the sim hare.

## Checks that proved it worked
- `npx tsc --noEmit` exit 0. `npm test` green, including `tests/sim.test.ts` and `tests/senses.test.ts` (a body at 41 m is still 0).
- Direction: `awayScore`. Known match `awayScore({x:1,z:0},{x:2,z:0},{x:0,z:0})` = 1. Known mismatch `awayScore({x:1,z:0},{x:0,z:0},{x:0,z:0})` = 0. Perpendicular = 0.5. A game deer should score at least 0.95. Toward is `1 - awayScore`.
- Plume: an independent copy of the EPA ISC gaussian (sigma 4 m) plus the downwind arm, scored `1 - min(1, |got - want| / max(|want|, 1e-9))` against `scentLevel`. Known match is 1. Known mismatch is the downwind level scored against the upwind nose (0). Do not change the production formula to raise the score. Do not retune sigma 4. The local gaussian is already faint a couple of metres out, so a 2 m cutoff and a 0.5 m urine paper are not the same distance.

## Mistakes to avoid
- Putting 2400 m on every scent source. Live deer and the HUD body test then smell across the map.
- Using kilograms as the dropping odor. A pellet is about 0.0002 kg and the ring shows nothing. Using `m = 1` for a pellet dumps 1 kg of residue.
- A timer that drops a pellet every second. The acceptance is the digest act.
- Marking on a path odometer or a clock. Spacing is the distance to the nearest own fresh mark. Circling inside 450 m does not re-mark. Observed clumps (up to about 20 marks/km) are not modelled. Say so.
- An avoid that also leaves the food `target` set. The next calm step walks back into the odor.
- A wolf attract test with no wind. The local gaussian is gone by about 8–15 m. The nose has to be downwind.
- Importing `species.ts` or `huntHold.ts` from `traces.ts`. `species.ts` imports the range constants. `agent.ts` imports the smell helpers. Keep `AgentSpecies` a type-only import.
- Self-approving the PR. The complete event names the branch and this skill. Another agent approves.
