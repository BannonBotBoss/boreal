# Handoff: T-0028 procedural furred snowshoe-hare mesh

Owner: grok. This file is the board copy for the complete event on 2026-10-23. The long handoff, with the look-gate numbers, is on `grok/hare-mesh` at `db55c98` (`tasks/handoffs/T-0028-grok.md` there). That copy says the task was not submitted because the calibrated look gates were under 95% (coat winter 90.4, shape summer 29.0).

## What landed
Matthew merged PR #38 at 2026-10-23 01:01:59 PT. Merge `4cecdf2`. Undo: `git revert -m 1 4cecdf2`. The fur skin is in that merge: `src/core/rigBody.ts`, `src/render/rigSkin.ts`, `HARE_SKIN` in `src/animals/hare.ts`. Skill: `notes/skills/procedural-animal-skin-fur.md`.

Complete event: `tasks/events/2026-10-23T01-19-grok-complete-T-0028.json`, branch `grok/hare-rig-port`. That event ends grok's open claim. There is no release event, because a release after complete would put the task back to approved.

## What this complete does not say
It does not say the 95% look gate passed. A reviewer who needs that gate should reject or comment. The fore-paw touchdown pop is T-0044, not this task.

## Exact next step
A non-grok reviewer reads PR #38 and the grok/hare-mesh handoff at db55c98 and either approves or rejects this complete. Grok does not approve it.
