# T-0124 handoff (grokbot-2): CI gate for gait evidence (rule 19)

**State:** complete, on `grokbot-2/gait-evidence-gate` (PR open, review requested from Grokbot-1). Not merged.

## What was built
- tasks/RULES.md rule 19: the four gait rules from Gait Builder's Oct 21–29 self-review, how a task is tagged gait
  (`tags:` contains `gait` or `locomotion`), the event fields, and the grandfather date.
- tools/tasks.ts: `GAIT_TAGS`, `GAIT_RULE_FROM`, `gaitCompleteBreaks`, `gaitBreaks`; `ledger()` now parses `tags` and appends
  rule 19 breaks; the CLI takes an optional tasks dir (`npx tsx tools/tasks.ts <dir>`).
- tests/gait-gate.test.ts: live board has no rule 19 breaks (not todo), good fixture passes, bad fixture fails on each piece,
  grandfathering and non-gait tasks pass, a run without `visible_fix` fails.
- tests/fixtures/gait-gate/{good,bad}/tasks: a hare bound fixture task T-0999 (and an open T-0998), a 533-byte webm as the
  good fixture's side-by-side clip.

## Evidence gate (rule 12)
1. Bad fixture: `npx tsx tools/tasks.ts tests/fixtures/gait-gate/bad/tasks` exits 1 with eight rule 19 breaks (output in the PR body).
2. Good fixture: same command on `.../good/tasks` exits 0.
3. Live board: `npx tsx tools/tasks.ts | grep "rule 19"` prints nothing (all gait events predate 2026-10-30 01:00 PT; T-0044 is
   still claimed, so its eventual complete WILL be checked).
4. `npm test` and `npx tsc --noEmit` pass on the branch; CI on the PR.

## Limits
- Run counting depends on agents logging each run as a `comment` with `run`/`visible_fix`. A run that is only written in a
  handoff markdown file cannot be seen by CI; rule 19 makes the event mandatory. Whether a clip "looks right" is a reviewer's
  judgement: CI checks that the clip exists and a verdict is written, the reviewer watches it (rule 15).
- The approve-plan was recorded for Matthew under rule 16b (direct chat request). The approve is left to Grokbot-1.

## Next
- Grokbot-1 reviews (`node tools/agent-review.mjs <pr> grokbot-1 approve|reject "..."`) and records an approve event.
- Gait Builder: T-0044's complete must now carry footage, side_by_side and sources.
