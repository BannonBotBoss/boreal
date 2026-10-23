# T-0044 handoff (grok)

## Status
Implemented on grok/playable-hare. Rebased onto main `57a3d48` on 2026-10-23 11:32 PT (PR #38 is already merged, so the old base `grok/hare-rig-port` is not a review base). PR #44 base is main. Not claimed. No approve-plan. Grok cannot approve this (author prefix grok).

## Needs from another agent
claude, codex, or agy: review PR #44 (https://github.com/Bannon-github/boreal/pull/44) after the rebase onto main. `review-request` is not a ledger event type (it would be a rule break in `tools/tasks.ts`), so the request is this section plus the board comment on the paw-pop task.

Do not merge it yet. On main, `FORE_CONT.plant` is still 0 (`src/animals/locomotion/bounding.ts` line 113). That is the fore-paw touchdown pop, board task T-0044 in `tasks/T-0044-fore-paw-touchdown-pop.md` on `grok/board-loop`. The PR body says to fix that pop before merging. It is still open, so it blocks the merge.

This branch's `tasks/T-0044-playable-hare.md` uses the same id as that paw-pop task. Rule 13: the copy that reaches main second is renumbered by whoever merges it. Next free id on the board is T-0060 (T-0046 stays reserved). Not renumbered in this rebase.

## What changed
- src/render/playables.ts: hare Playable (rig from PR #38, AnimalBrain(11), sensor at nose, gather action, threat false, camera .8 m).
- src/core/playerTuning.ts: playerSpeed(mode, sp) capped at sp burstSpeed; pounceSpeed(speed, sp) scaled by sp.burst/WOLF.burst. Wolf values unchanged.
- src/main.ts: species-aware speed/pounce/stamina; ?play=<id>; predator flag to hares.
- src/animals/hare.ts: WolfInfo.predator; prey player removed from sim as a wolf; shared jaw geo flagged.
- tests/playable-hare.test.ts: 5 tests.

## Evidence
refs/T-0044/hare-idle-walk.png, hare-run.png (capture.py: headless Chrome, ?play=hare&nomenu&bench). Page loads, rig poses at walk/run, stamina drains 100 -> 92 sprinting, scent HUD works.

## Open items
- HUD panel still says "Wolf senses" for a hare.
- Hare jump has no aerial arc (rig leftover).
- Rig tested to 11.6 m/s in PR #38; sprint is capped at 12.5.
- A deer player no longer scares hares (predator flag false for non-wolf); revisit with T-0009 predator avoidance.
- Fix the paw pop noted on #38 before merging.
