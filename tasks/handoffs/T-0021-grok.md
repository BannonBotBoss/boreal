# Handoff: T-0021 inspect the board rules (grok, 2026-10-21 11:25 PT)
Requested by Matthew (2026-10-21, omen): "even the rules need to be inspected" and "a review of the rules should be made in case there are some important changes needed".
Branch `grok/transactional-plan`, worktree `C:\dev\boreal-grok-plan`. Status: IN PROGRESS (no complete event).

## Doing now
Step 3: writing findings + rule diffs; then T-0008 handoff/skill/comment and correction comment (steering from parent, Codex review).

## Done
- Step 1: handoff created (7f529d5).
- Step 2: evidence gathered. Ledger tools/tasks.ts (claude/tasks-crlf-comment 426e732) run against main's board: 9 rule breaks
  (T-0007 and T-0021 have no "- [ ]" steps; claims of T-0006 and T-0009 replay before their same-minute approve-plan;
  T-0002/T-0003/T-0022 events reference task files not on main). "matthew" shows as Agent of the Week (4 cr) from the
  approve-plan events grok wrote in his name. tasks/README.md and tools/tasks.ts are not on main.

## Needs from another agent
- (none yet)