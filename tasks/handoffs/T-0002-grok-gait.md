# Handoff: T-0002 wolf gallop (grok-gait, 2026-10-18 17:15 PT)
Branch `grok-gait/T-0002-wolf-gallop`, off 7849d7a (the approved plan; base main 18b5881). Worktree `C:\dev\boreal-grok-gait`.
Not yet stacked on `claude/locomotion-hooks` (not in main yet); Codex's gallop order is not committed yet either.

## To Codex (please read)
Your gallop-order edit (`gaitFor` / `GAIT_TABLE.gallop` offsets `[.45, 0, .6, .9]`, the `gallopBob` comment) is still
uncommitted in the served tree. **I will not touch stride, cadence, duty or gait numbers in `gaitFor` or `gaits.ts` until it
is in `main`.** Then I merge main into this branch and build on it. While T-0002 is claimed I own wolf stride/gait tuning
(stride, cadence, duty, gait thresholds, bob, spine); your wolf movement in `world.ts` / `buildScene.ts` stays yours. The plan
removes the wall-clock torso bounce in `render/playerWolf.ts` (your proposal) once that lands too.

## Pieces (one commit each)
- [x] claim event + this handoff (before any code)
- [ ] `?timescale=s` (0.05-1, URL only) in `main.ts`, with the scope from the plan
- [ ] gait readout (gait, Fr, cadence Hz, stride m, duty, airborne) in the inspector and the `?loco=1` lab
- [ ] `tests/gait-data.test.ts` (canid table vs `gaitFor(WOLF_LEGS)`, ±15 %); expected to FAIL on the current code until the
      stride work lands (recorded below)
- [ ] `tools/bench-gait.ts` + before numbers
- [ ] BLOCKED on Codex's commit: `gaitFor` cadence from data, hysteresis (`prev`), gallop flight + ballistic bob, spine flex,
      wall-clock bounce removal, raw-distance phase + interpolation, `?loco=1` parity + touchdown test, perf, captures

## How to check
`npx tsc --noEmit`, `npm test`, `npm run build` in the worktree. Dev server from the worktree on its own port (see notes).

## Log
- 23:00 `src/core/gaitData.ts` (c92b418) + MODEL tests passing, LIVE rows todo (732ac70). Controller opt-in tried and reverted: today's reach (0.39 m walk/trot, 0.25 m gallop) cannot sweep the measured stance, so fore legs overstep and hind legs hover. Next is gaitData + reach work (spine flex / pelvis / girdle) together once the gait numbers unfreeze. Contracts for gaitFor, the playerWolf bounce and main.ts ground.cost are in notes/grok-gait.md.

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