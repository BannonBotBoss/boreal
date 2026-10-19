# grok-gait notes

## 2026-10-18 - T-0002 wolf gallop, part 1 (branch `grok-gait/T-0002-wolf-gallop`, off 7849d7a)
Claimed T-0002 as `grok-gait` (event `tasks/events/2026-10-18T17-15-grok-gait-claim-T-0002.json`, handoff
`tasks/handoffs/T-0002-grok-gait.md`, committed before any code).

**Done (only the pieces that don't touch stride or gait numbers):**
- `?timescale=0.05..1` (`src/core/timescale.ts`, `src/main.ts`, locomotion lab): URL only, never saved. The frame dt is scaled
  once, before the 30 Hz accumulator, so the player, animal AI and movement (buildScene derives their dt from `simTime`), gaits,
  touchdowns, `shaderClock` (wind, water) and hares slow together. `worldSec` (saves, offline credit), sun, seasons, weather,
  audio, camera look, input and UI stay on real time. There is no `simTime` re-sync to `worldSec` in `main.ts` to skip. Test:
  `tests/timescale.test.ts`.
- Gait readout (`src/core/gaitReadout.ts`): gait, Froude, cadence Hz, stride m, duty, airborne. Shown in the inspector's
  brain view (player and animals) and in the lab readout (cadence, airborne, timescale added).
- `tests/gait-data.test.ts`: the plan's canid table against `gaitFor(WOLF_LEGS)` at ±15 %. The cadence/stride rows and the
  Walter & Carrier stance sweep are marked `todo` until the stride work lands, so `npm test` stays green while they report.
  They **fail on the current code**: 2.12/3.12/3.95/5.14/5.20/8.40 Hz against 1.50/2.10/2.41/2.61/2.7/3.0 Hz, and a 0.25 m
  stance sweep against 0.67 m. The Maes 2008 duty check (< 0.5 above 2 m/s) and the readout identity pass.
- `tools/bench-gait.ts` (`npx tsx tools/bench-gait.ts`). Before numbers, on omen under the bench lock (median of 5 × 100 000
  calls after 10 000 warm-up): default wolf (`expend` + `quadrupedPose`) 2.95 / 3.93 / 4.96 µs; `?loco=1`
  `createLocomotion().update` 19.9 / 18.9 / 29.6 µs, at walk / trot / sprint. Budget 50 µs.

**Blocked:** Codex's gallop-order edit (`gaitFor` / `GAIT_TABLE.gallop` offsets `[.45, 0, .6, .9]`) is still uncommitted in the
served tree and not in `main` (checked `git log main` at each piece; main is 7d71892). Per the plan I don't touch stride,
cadence, duty or gait numbers in `gaitFor` / `gaits.ts` until it lands. Then I merge main into this branch and do the stride,
cadence, hysteresis, flight, spine, bounce and phase work.

**To Codex:** please commit the gallop order to main. I'll build on it and not redo it. Your wolf movement in
`world.ts` / `buildScene.ts` stays yours. The plan removes the wall-clock torso bounce in `render/playerWolf.ts` (your
proposal) after that.
**To Claude:** `gaitFor` is yours. Nothing in it has changed yet. `src/core/gaitReadout.ts` only reads it.
**Workflow:** no `package-lock.json` in the repo, so the worktree used `npm install --no-package-lock` (nothing written to git).

## Target spec: wolf rotary gallop (2026-10-18 22:30 PT)
Matthew's 18-frame reference sheet (grey wolf, probably AI-generated, labels inconsistent with each other) is used **for pose
shape only**: leg tuck in the gathered flight, forelimb reach at the plant, a level head, back flexion. Timing comes from the
canid literature:
- **Footfall, rotary gallop:** LH → RH → RF → LF ("left lead": the left fore lands last and leads), or the mirror,
  RH → LH → LF → RF. Canids use the rotary gallop (Hildebrand 1977, Am. Zool. 17:61; Biancardi & Minetti 2012, JEB 215:4144).
  As phase offsets in leg order LF, LH, RF, RH (touchdown at phase 1 - offset): left lead `[.45, 0, .6, .9]`
  (LH 0, RH .1, RF .4, LF .55), right lead `[.6, .9, .45, 0]`.
- **Gathered suspension:** after the last forelimb lifts off, before the leading hind plants. All four legs are off the ground
  and tucked under the body, with the back flexed. This is the main suspension of the canid rotary gallop (Hildebrand 1977;
  Bertram & Gutmann 2009, J. R. Soc. Interface 6:549; Walter & Carrier 2007, JEB 210:208). It lasts at least 0.1 of a stride
  at a moderate gallop and grows with speed as duty falls.
- **Extended suspension:** after the hind pair lifts off, before the first fore plants, with the back extended. It appears only
  at high speed, when duty is about 0.2 or less.
- **Extended reach at the forelimb plant:** the leading fore plants well ahead of the shoulder at the end of the extended
  phase. The stance sweep is about 0.65-0.69 m per foot at 9.2 m/s (Walter & Carrier 2007: 71-75 ms contact), against 0.25 m
  in the game today.
- **Lead changes:** swap left/right lead (mirror the offsets) toward the inside of a turn, or after a few strides on a long
  straight. Dogs change lead in the air, so blend the offsets during a suspension and never mid-stance.
- **Cadence:** about 2.4 Hz at the trot-gallop transition (Heglund & Taylor 1988: 4.19·M^-0.150 Hz, 40 kg) and 2.6-2.7 Hz at
  5-6 m/s (Bryce & Williams 2017), rising gently to about 3 Hz at 10.5 m/s. Speed comes from stride length (Maes et al. 2008).
- **Duty factors:** walk about 0.65; trot about 0.45 (below 0.5 above 2 m/s, Maes et al. 2008); gallop about 0.30 at the
  transition, falling to about 0.20-0.22 at 9-10 m/s (Walter & Carrier 2007 contact times × cadence).
- Tests: `tests/gait-data.test.ts` checks the rotary order and the gathered suspension. The rows against the live `gaitFor`
  stay `todo` until it is wired to `src/core/gaitData.ts`.

## 2026-10-18 23:00 PT - T-0002 part 2: canid gait model, interface contract (no edits to Codex's files)
Codex's gallop order is still not in main (7d71892), so `gaitFor` / `gaits.ts` numbers stay frozen. Per Grok Bot's scope I
did not edit `gaits.ts`, `animalBehavior.ts`, `playerWolf.ts`, `world.ts`, `buildScene.ts` or their tests.

**New:** `src/core/gaitData.ts`, a pure module with cited constants:
- `cadence(speed, legLength)`: piecewise in Froude terms through Bryce & Williams 2017 and Heglund & Taylor 1988, scaling
  with leg length by dynamic similarity.
- `strideLength`, `stanceReach`, `dutyFactor`.
- `selectGait(froude, prev?)`, with hysteresis.
- `offsetsFor(gait, lead)`, `footfallOrder`.
- `suspensions(offsets, duty)` (gathered/extended), `suspensionRise` (g·t²/8).
- `canidPlan(speed, legLength, prev?, lead?)`.

`tests/gait-data.test.ts`: the MODEL rows test gaitData and pass. The LIVE rows test `gaitFor` and stay `todo`.

Model values at hip 0.55 m:

| m/s | gait | Hz | stride (m) | duty | sweep (m) | suspensions |
|---|---|---|---|---|---|---|
| 1.27 | walk | 1.50 | 0.85 | 0.65 | 0.55 | none |
| 2.70 | trot | 2.10 | 1.29 | 0.45 | 0.58 | diagonal flights |
| 4.96 | gallop | 2.61 | 1.90 | 0.29 | 0.55 | gathered 0.16 |
| 6.0 | gallop | 2.70 | 2.22 | 0.28 | 0.61 | gathered 0.17 |
| 9.2 | gallop | 2.90 | 3.18 | 0.23 | 0.72 (75 ms contact) | gathered 0.22, extended 0.07 |
| 10.5 | gallop | 3.00 | 3.50 | 0.20 | 0.70 | gathered 0.25, extended 0.10 |

**Controller opt-in: tried, NOT clean, reverted (nothing committed).** I plugged the model into our controller as an optional
planner (`createLocomotion(..., planner)`, lab `?gaitdata=1`). The legs cannot sweep the measured stance: today's reach is
about 0.39 m at a walk or trot and 0.25 m in a gallop. Counted touchdowns per leg per second over 10 s on flat ground:

| m/s | gait | model Hz | fore legs | hind legs |
|---|---|---|---|---|
| 1.27 | walk | 1.50 | 3.0 (extra leash steps) | 1.5 |
| 2.7 | trot | 2.10 | 4.2 | 2.1 |
| 6 | gallop | 2.70 | 4.5-5.4 | 0 (they never land) |
| 10 | gallop | 2.96 | 0 | 0 |

With the stock planner it is a clean 1× cadence (2.1/3.1/5.2/8.0 Hz). So the cadence fix needs the reach work that goes with
it: spine flex / pelvis shift, girdle swing, and body pitch at the plant. Otherwise the leash in `foot.ts` adds steps and the
feet can't reach their targets. I'll do it as one piece (gaitData + reach) once the gait numbers are unfrozen, with the
touchdown-rate test (one per leg per stride, 4 × cadence in all) that I drafted for it.

### Contract 1: `gaitFor` reads gaitData (core/animalBehavior.ts, Claude's file; Codex is editing it)
Line numbers on 7849d7a/18b5881, inside `gaitFor(motion, speed, legs)`:
- add the import: `import { canidPlan, type CanidGait } from './gaitData';`
- signature: `export function gaitFor(motion: Motion, speed: number, legs: LegDims, prev?: GaitName): Gait | null {`
- L152-153 (name, duty) and L162-163 (cycle, offsets) become:
  ```ts
  const c = canidPlan(Math.max(.15, Math.abs(speed)), h, prev as CanidGait | undefined); // T-0002: cadence/stride/duty from canid data
  const name: GaitName = motion === 'back' ? 'walk' : c.gait, duty = motion === 'back' ? .65 : c.duty;
  const cycle = motion === 'back' ? Math.max(.4 * h, Math.min(2.3 * h * fr ** .3, maxStance / duty)) : c.stride; // never shortened for reach
  const offsets = motion === 'back' ? [.25, 0, .75, .5] : c.offsets; // rotary gallop LH, RH, RF, LF (Codex's order)
  ```
  (`reachOf` / `maxStance` stay for walking backwards only.)
- Deer use `gaitFor` with `DEER_LEGS`. To change only wolves first, gate the four lines with `legs === WOLF_LEGS` (the model
  scales with hip height, but its data are canid).
- `AnimalBrain.expend` passes `this.gait` as `prev` and stores the result; `planGait` gets the same optional `prev` (the
  controller passes `plan.id`).
- **This is not enough on its own:** the rig needs the reach work above, or planted feet slide and fore legs overstep.
- Afterwards: drop `todo` from the LIVE rows in `tests/gait-data.test.ts`. They are the acceptance test.

### Contract 2: wall-clock torso bounce (render/playerWolf.ts, Codex)
On 7849d7a: L178 `const gait = moving ? Math.sin(time * (mode === 'sprint' ? 24 : running ? 19 : stealth ? 5 : 13)) : 0;`
and L180 `torso.position.y = moving ? Math.abs(gait) * .012 : Math.sin(time * 2) * .003;`. They bounce the torso at 7.6/s in a
sprint, unrelated to the legs. Replace with a phase-locked bob, `torso.position.y = moving ? 0 : Math.sin(time * 2) * .003;`,
keeping `pose.bob` (added next). In a gallop, `pose.bob` should come from `suspensionRise` over each window of
`suspensions(offsets, duty)` (a ballistic arc), not the fixed `gallopBob` bump. Remove `gait` if nothing else reads it.

### Contract 3: phase from raw distance (src/main.ts)
L291 on this branch (L289 on main 7d71892):
`brain.expend(1/30,Math.hypot(pose.x-player.x,pose.z-player.z)*ground.cost);` →
`brain.expend(1/30,Math.hypot(pose.x-player.x,pose.z-player.z),ground.cost);`, with `expend(dt, distance, cost = 1)` keeping
`cost` for energy only. The phase and `gaitSpeed` then follow the distance actually travelled, so on bog or snow the legs don't
speed up and planted paws don't slide. Interpolate the rendered phase between 30 Hz sim steps (store the last two phases, blend
by `accumulator · 30`).
