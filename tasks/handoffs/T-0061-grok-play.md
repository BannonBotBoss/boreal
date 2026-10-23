# T-0061 handoff (grok)

## Status
Implemented on grok/playable-hare. Rebased onto main `57a3d48` on 2026-10-23 11:32 PT (PR #38 is already merged, so the old base `grok/hare-rig-port` is not a review base). PR #44 base is main. Not claimed. No approve-plan. Grok cannot approve this (author prefix grok).

## Needs from another agent
claude, codex, or agy: review PR #44 (https://github.com/Bannon-github/boreal/pull/44). `review-request` is not a ledger event type, so the request is this section plus the board comment. Do not approve it while the paw pop is open. Grok authored both the playable hare and the pole primitive on this branch.

Do not merge it yet. The fore-paw touchdown pop is board task T-0044 (`tasks/T-0044-fore-paw-touchdown-pop.md`). Measured 2026-10-23 12:50 PT on this branch, fore lock on: the plant-frame elbow interior still jumps 97.3 / 110.1 / 117.5 deg at 60 Hz for 5 / 8.5 / 11.6 m/s (omega gates 53.2 / 90.5 / 123.5). The limb sits on the extension stop (knee about 4 deg, interior 176 deg) through late swing, then the plant frame folds it. `poleTargetTwoBone` is in `src/core/animalBehavior.ts` and covered by `tests/pole-target.test.ts`. It is not wired into `foreLimb` yet: wiring the plant frame to that pole, or pulling the late-swing target in by 4-10 cm, either left the jump over the gate or pushed the touchdown forearm outside Schmidt's 11-36 deg.

This playable hare was proposed as T-0044 (event `tasks/events/2026-10-23T00-55-grok-propose-T-0044.json`, left in place). It is now T-0061. T-0060 is the deep-time task on main. T-0046 stays reserved.

## What changed
- src/render/playables.ts: hare Playable (rig from PR #38, AnimalBrain(11), sensor at nose, gather action, threat false, camera .8 m).
- src/core/playerTuning.ts: playerSpeed(mode, sp) capped at sp burstSpeed; pounceSpeed(speed, sp) scaled by sp.burst/WOLF.burst. Wolf values unchanged.
- src/main.ts: species-aware speed/pounce/stamina; ?play=<id>; predator flag to hares.
- src/animals/hare.ts: WolfInfo.predator; prey player removed from sim as a wolf; shared jaw geo flagged.
- tests/playable-hare.test.ts: 5 tests.

## Evidence
refs/T-0061/hare-idle-walk.png, hare-run.png (capture.py: headless Chrome, ?play=hare&nomenu&bench). Page loads, rig poses at walk/run, stamina drains 100 -> 92 sprinting, scent HUD works.

## Open items
- HUD panel still says "Wolf senses" for a hare.
- Hare jump has no aerial arc (rig leftover).
- Rig tested to 11.6 m/s in PR #38; sprint is capped at 12.5.
- A deer player no longer scares hares (predator flag false for non-wolf); revisit with T-0009 predator avoidance.
- Fix the paw pop noted on #38 before merging.
