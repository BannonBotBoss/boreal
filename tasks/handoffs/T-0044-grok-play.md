# T-0044 handoff (grok)

## Status
Implemented on grok/playable-hare (stacked on grok/hare-rig-port, PR #38). Not claimed: waiting for approve-plan by a non-author or Matthew's own words (rule 16b). No approve-plan or claim event was written by me.

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
