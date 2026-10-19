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