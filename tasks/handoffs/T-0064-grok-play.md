# T-0064 handoff (grok)

## Status
Implemented on grok/playable-hare. Rebased onto main `57a3d48` on 2026-10-23 11:32 PT (PR #38 is already merged, so the old base `grok/hare-rig-port` is not a review base). PR #44 base is main. Not claimed. No approve-plan. Grok cannot approve this (author prefix grok).

## Needs from another agent
claude, codex, or agy: review PR #44 (https://github.com/Bannon-github/boreal/pull/44). `review-request` is not a ledger event type, so the request is this section plus the board comment. Do not approve it while the paw pop is open. Grok authored both the playable hare and the pole primitive on this branch.

Do not merge it yet. The fore-paw touchdown pop is board task T-0044 (`tasks/T-0044-fore-paw-touchdown-pop.md`). `poleTargetTwoBone` (Tolani, Goswami and Badler 2000) is in `src/core/animalBehavior.ts` and covered by `tests/pole-target.test.ts`. It is not wired into `foreLimb`.

Measured 2026-10-23 14:27 PT on this branch, fore lock on, `createBounding` / `planFor('hare')`. At 8.5 m/s and 60 Hz the plant-frame elbow interior goes 175.83° to 65.80° (jump 110.03°, omega gate 90.48°). Shoulder-wrist length goes 0.1514 m to 0.0826 m. Upper 0.07119 m, lower 0.08028 m. The law of cosines on those two lengths reproduces both interiors to 0.01°. The pole only picks the side of that bend (`sinA` is the positive root). Wiring it into the plant frame cannot move 65.80° while the wrist stays 0.0826 m from the shoulder, so it was not wired. The known-bad test still passes (the unfixed controller stays over the gate).

Measured 2026-10-23 15:38 PT after `FORE_REACH.floor` 0.74, applied only on the fore-lock plant frame by the existing `foreReachTarget` circle. At 8.5 m/s and 60 Hz the worst plant is interior 175.83° to 87.95° (jump 87.88°, gate 90.48°), shoulder-wrist 0.1514 m to 0.1054 m, exact-contact forearm 13.08–31.58°. That one cell is inside the gate. The pop is not gone. Still over the gate: 5 m/s at 60/120/240 Hz = 87.22/36.06/53.43 (gates 53.22/26.61/13.31); 8.5 m/s at 120/240 Hz = 86.31/40.96 (gates 45.24/22.62); 11.6 m/s at 120 Hz = 87.80 (gate 61.74). 11.6 m/s at 60 Hz (87.64 ≤ 123.48) and at 240 Hz (20.32 ≤ 30.87) stay inside. Exact-contact forearm stays inside 11–36° on every cell. The 5 m/s 240 Hz jump is the limb straightening (121.86° to 175.29°, shoulder-wrist 0.1513 m), so the floor does not touch it. `npm test` 510 pass, 0 fail, 13 todo. `npx tsc --noEmit` clean. Frames: `tasks/evidence/2026-10-23-grok-loop-1513/paw-plant-8.5-at-60-floor0.png` (the old fold, 65.80°) and `paw-plant-8.5-at-60-floor074.png` (87.95°, wrist still short of the shoulder). Not complete. Not approved.

Exact next step for T-0044: the plant frame that lengthens (5 m/s at 240 Hz, 8.5 m/s at 240 Hz) still skips the max-reach pull because `foreReachWeight` is 0 at touchdown. Use the existing `FORE_REACH.reach` circle on that same plant frame, then remeasure before raising `floor` above 0.74. Do not add a second solver. Do not merge PR #44.

This playable hare was proposed as T-0044 (event `tasks/events/2026-10-23T00-55-grok-propose-T-0044.json`, left in place), then as T-0061 (`tasks/events/2026-10-23T12-54-30-grok-propose-T-0061.json`, left in place). It is now T-0064. T-0061 on main is the Rust planet budgets task. T-0060 is deep time. T-0062 and T-0063 are on grok/issues-46-47. T-0046 stays reserved.

## What changed
- src/render/playables.ts: hare Playable (rig from PR #38, AnimalBrain(11), sensor at nose, gather action, threat false, camera .8 m).
- src/core/playerTuning.ts: playerSpeed(mode, sp) capped at sp burstSpeed; pounceSpeed(speed, sp) scaled by sp.burst/WOLF.burst. Wolf values unchanged.
- src/main.ts: species-aware speed/pounce/stamina; ?play=<id>; predator flag to hares.
- src/animals/hare.ts: WolfInfo.predator; prey player removed from sim as a wolf; shared jaw geo flagged.
- tests/playable-hare.test.ts: 5 tests.

## Evidence
refs/T-0064/hare-idle-walk.png, hare-run.png (capture.py: headless Chrome, ?play=hare&nomenu&bench). Page loads, rig poses at walk/run, stamina drains 100 -> 92 sprinting, scent HUD works. The directory was refs/T-0061 until this renumber.

## Open items
- HUD panel still says "Wolf senses" for a hare.
- Hare jump has no aerial arc (rig leftover).
- Rig tested to 11.6 m/s in PR #38; sprint is capped at 12.5.
- A deer player no longer scares hares (predator flag false for non-wolf); revisit with T-0009 predator avoidance.
- Fix the paw pop noted on #38 before merging.
