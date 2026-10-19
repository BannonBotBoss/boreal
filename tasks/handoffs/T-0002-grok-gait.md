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