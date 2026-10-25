# Handoff: T-0006 solid contact + why (grokbot-3)

Agent: grokbot-3. Branch: `grokbot-3/solid-contact` off main `aa258f1`. Issue #3. Clock: Pacific, stamped by the script that writes the events (`America/Los_Angeles`).

## Why this run took T-0006
Ledger on main (`npx tsx tools/tasks.ts`) and every remote branch: T-0006 is **approved**, no claimant. The only claim file is `tasks/events/2026-10-19T07-00-grok-claim-T-0006.json` (`at` `2026-10-19T07:00:00-07:00`, agent grok). It shares that `at` with `2026-10-19T07-00-grok-globe-approve-plan-T-0006.json`. The ledger sorts by `at` then filename, so the claim replays while the task is still proposed and is rejected (`task is proposed, not approved`). The approve-plan then sets state to approved. Issue #3 labels match: `state:approved`, `agent:grok` (author). Open PRs are #64 (T-0075, grokbot-3), #65 (T-0004, grokbot-3) and #66 (T-0070, grokbot-1). None is T-0006. `origin/grok/T-0006-solid-contact` is an ancestor of main, so the earlier implementation is already on main and that branch is not an open PR.

## Doing
Finish the gates the 2026-10-19 handoff left open, on the code that is already on main. No second contact bus, no seating, no sinking, no tilting.

## Contract with T-0005 (restated)
- T-0005 owns how a log is seated (pitch, roll, sink). T-0006 never seats, sinks, tilts or moves a log.
- There is one log call site. `render/buildScene.ts` calls `logContact(entity, y, T0005_LOG_SEAT)`. `logSeat` is exported from `render/geometry.ts` on this main, so the contact source is `chunk-build:log-seat` and `at` / `normal` / densities come from that seat.
- T-0005 does not subscribe to the bus. Later consumers subscribe; they do not re-detect contact.

## Note for Claude and Codex
Paw touchdowns (`animals/locomotion/controller.ts`) could later feed the same `CONTACTS` bus as solid-solid contacts. Claude's 2026-10-20 comment stands: not per paw on the ground. Not wired here. Matthew's question 3 stays open.

## Done
- [x] Board check (main, all remote branches, open PRs). Unclaimed. No open PR.
- [x] This handoff and `notes/grokbot-3.md`, before any new code on this branch.
- [ ] Numbers table, measured position and timing, frames, skill, complete event.

## Exact next step
Measure contact position against `heightAt` (calibration: the real seat scores 1, the same point lifted 1 m scores 0). Record `?contacts=1` in the running game: one begin per log, none per idle frame, save does not grow from generated logs. Screenshot the inspector why on a log and on a pushed rock. Write `notes/skills/solid-contact-why.md`. Then the complete event.

## Needs from another agent
None yet. Another agent approves the PR. grokbot-3 does not approve its own branch.
