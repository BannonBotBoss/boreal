# grokbot-3 review loop

Agent: grokbot-3. Branch: `grokbot-3/review-loop` from main `ae4ecbe`. Clock: Pacific, stamped by the script that writes the events. Matthew in chat 2026-10-24 ~11:38 PT said "ok" to starting this rule 15 pass. That is an instruction to review, not an approval of any task. grokbot-3 is not in `RELAYS_MATTHEW`. No event in this run uses `"for": "matthew"`.

## What this run is doing
Rule 15 review of everything waiting on review that grokbot-3 did not write. Completed tasks first, then proposed plans, oldest first. Board-only. Nothing merged. main not pushed.

## Inventory (all branches, `git fetch origin`, `git ls-tree` of `tasks/`, `gh pr list --state all`)
Open PRs: none. Closed PRs 33-51 are all merged. No `grokbot-3/` branch existed. `tools/agent-review.mjs` `AGENTS` does not include grokbot-3, so the status tool refuses this reviewer. Verdicts are events plus PR comments where a PR exists.

Ledger on main before this branch (`npx tsx tools/tasks.ts`), completed and not approved:

| task | complete `at` | claimant | PR |
|---|---|---|---|
| T-0025 | 2026-10-21T17:39:41-07:00 | agy | none |
| T-0032 | 2026-10-22T02:19:20-07:00 | grok | none (`origin/grok/T-0032-forest-edge`) |
| T-0028 | 2026-10-23T01:19:03-07:00 | grok | #38 merged |
| T-0021 | 2026-10-23T02:23:45-07:00 | grok | none (board commits already on main) |
| T-0069 | 2026-10-23T19:07:00-07:00 | grokbot-2 | #51 merged |

Proposed, no approve-plan: T-0001 (side branch only, until this branch copies the file), T-0007, T-0045, T-0047, T-0048, T-0049, T-0050, T-0051, T-0052, T-0053, T-0054, T-0055, T-0065, T-0067, T-0066.

Not in the queue: T-0002 and T-0003 are claimed (approve-plan already exists). Their task files are not on main, so the ledger reports unknown task. That is new task T-0071, not a review of those plans.

## Unchanged blocked submissions (rule 15, no new comment)

### T-0025 littoral plants
Previous blocking review: `tasks/events/2026-10-21T21-32-codex-comment-T-0025.json` (`at` 2026-10-21T21:32:38-07:00). Full target SHA: `01c4bbb145c12f5999d91b51eddb591a0988fbd7` (`origin/agy/littoral-plants`, committer 2026-10-21 18:41:42 -0700). No later commit. No PR, so there is no base ref to re-diff. No event after that comment.

Checks that the inputs are unchanged:
- Task blob `tasks/T-0025-littoral-plants.md` = `a2f68bc72870e232` (sha256 prefix, 6190 bytes) at that SHA.
- Handoff blob `tasks/handoffs/T-0025-agy.md` = `c4fc31765edc9c3c`.
- `measure.mjs` = `1157742d613d31e5`. `measure.json` = `bcb82a82b53912fd`. `wade-stop-0.png` = `f88f308e6deacd84`. `refs/water/reference/t0025-littoral.png` is on the branch.
- Rule 6 text (from "6. **Every task" through the start of rule 7) sha256 `53cfe020c3fd` at `01c4bbb` and at HEAD. Rule 11 text sha256 `c2f6c34c9157` at both. Later edits to rules 15-17 do not change the frame or numbers gate this review used.
- `package-lock.json` is present at `01c4bbb` (blob id `01c4bbb:package-lock.json`).

Verdict stays the codex comment: not approved. The metric scores stripes with no plants at 0.987. Not re-run.

### T-0007 forest floor
Previous blocking review: `tasks/events/2026-10-21T21-32-codex-comment-T-0007.json`. Task file has a single commit, `fac2f75`. Blob on HEAD `a2bf2f9ab93dcf0cf95f38b660dd30be89c87446`. No `## Objectives` heading. `src/core/why.ts` still ends the log chain at `buried` (line 44) and still exports `GROUND_WHY` (line 51). Rule 13's objective requirement predates the codex comment (commit `9dce12c`, 2026-10-21 11:24 PT). No duplicate comment.

## Completed, reviewed this run

### T-0032 comment, not approved
`git merge-base --is-ancestor 241c2b7 origin/main` exits 1. The completion names `241c2b7`. `origin/grok/T-0032-forest-edge` is `1e6477b`. "Grok run 2" (sky share 0.0000-0.0033) is in that branch's `tasks/handoffs/T-0032-claude.md` and is absent from the copy on main, where objectives 2-4 are still open. Frame gate not executed here: Chrome is installed, and there is no calibrated lake-view capture or run of `refs/forest-edge/gate/trunk-share.mjs` on `241c2b7`.

### T-0028 comment, not approved
Main handoff `tasks/handoffs/T-0028-grok.md` says the complete does not claim the 95% look gate. `origin/grok/hare-mesh` handoff records coat winter 90.4 and shape summer 29.0 and says the other gates are under 95%. Those frames were not re-measured here.

### T-0021 comment, not approved
Documentary. Three spot-checks on `ae4ecbe`:
1. `git show ebb6561` is the 2026-10-22 01:31:30 PT rule 16 commit. `git blame -L 25,25 tasks/RULES.md` today is `f5c5c46`, because T-0069 edited the sentence. The handoff's blame command does not reproduce.
2. `git merge-base --is-ancestor eb11755 origin/main` exits 0. The handoff says exit 1. T-0043 is done, so that check is stale on current main.
3. Holds: `.github/workflows/ci.yml` name `ci`, job `test`. `gh api repos/Bannon-github/boreal/commits/ba5281f/check-runs` is one run named `test`, conclusion success. `.../commits/ba5281f/status` is `statuses: []`.

The causal table still says no approve event exists and that `tools/tasks.ts` is not on main. `tools/tasks.ts` has been on main since `c33fe53` (2026-10-22 02:08:45 PT). Skill file `notes/skills/board-rule-inspection.md` is present. Not approved.

### T-0069 comment, not approved
No `tasks/handoffs/T-0069*` on any branch. Header `skill: false`. The complete event does not name a skill. Rules 4 and 6 are not met. Code claims that do hold on `ae4ecbe`: `RELAYS_MATTHEW` is grok, grokbot-1, grokbot-2 (`tools/tasks.ts:12`); `tools/agent-review.mjs` lists both and the tests cross-approve (`tests/agent-review.test.ts`); rules 16 and 17(c) name them. `npm test` includes those tests (see below) and is not an approval.

## Plans

### T-0001 comment, not approve-plan
Reopened. The task blob is unchanged (`0e4fb0e34ad156ca787be1775a92f211c811c360`) but main's planet code moved after the 2026-10-21 codex comments, so the dependency is not unchanged. Re-read the plan. `createPlanet` and `surfaceColour` still exist (`src/world/globe/planet.ts`). `sunPosition` still exists. The chronometer still shows the hour and the sun elevation. The plan still has `skill: false`, no `credits:` header, screenshot acceptance, and no reconciliation with the globe (T-0034, now the default view) or T-0022. Brought the task file and the side-only propose and codex comments onto this branch so the new comment is not an unknown task.

### T-0045 through T-0055 approve-plan
Cited lines read on `ae4ecbe`. `npx tsc --noEmit` exit 0. `npm test` result is filled in below when the suite finishes. Frame gate N/A: these are plans, not a visual submission. Numbers that were recomputed are in the events. External pages (FEIS, ADW) were not re-fetched; the in-repo citations and the code mismatch were checked.

### T-0065 and T-0066 approve-plan
`docs/deep-time-causes.md` has the sections the tasks name (1-20 and 21-24) with author-year citations. `src/data/deepTimeCauses.json` exists. Credits headers say 39. The formula is 54 for T-0065 (3 objectives, scratch, research) and 72 for T-0066 (4 objectives, scratch, research). The ledger still pays the formula. The header was not edited (only Matthew changes credits). Not a completion review: there is no complete event.

### T-0067 comment, not approve-plan
Checkboxes are not under `## Objectives`. The ledger reports 0 steps and a rule break. Sections 25-29 of the doc exist. Not approve-plan until the objectives are in that heading and the credits header matches the formula.

## Tests on ae4ecbe
`npx tsc --noEmit` exit 0.
`npm test`: 628 tests, 614 pass, 0 fail, 14 todo, exit 0. The board's legacy rule-break check stays a todo (`not ok 561`, TODO 22 legacy rule breaks) and does not fail the suite. `npm install` was local only. `package-lock.json` was restored and is not part of the commit. The suite ran on this tree before the review events below were written.

## Needs from another agent
- T-0032: re-run the calibrated sky-share gate (`refs/forest-edge/gate/trunk-share.mjs`) on commit `241c2b7`, on a machine that can record the two lake views. Save the log next to the branch handoff.
- T-0028: re-measure the fur look gates on `origin/grok/hare-mesh` (coat winter, shape summer) with the calibrated metric named in that handoff. The scores on that branch are under 95% except coat winter in a later table.
- `node tools/agent-review.mjs` refuses reviewer `grokbot-3` until that name is in `AGENTS`. A separate branch `grokbot-3/relay-reviewer` was described as the place that adds the relay. This run does not edit `RELAYS_MATTHEW` or `AGENTS`.

## New task
T-0071, proposed, not approve-planned (own work).

## Events written
All `agent` grokbot-3, Pacific `at` from `new Date()` in the writer, one second apart. No `"for"` field.

- comment T-0032 `2026-10-24T11-53-41`
- comment T-0028 `2026-10-24T11-53-42`
- comment T-0021 `2026-10-24T11-53-43`
- comment T-0069 `2026-10-24T11-53-44`
- comment T-0001 `2026-10-24T11-53-45`
- approve-plan T-0045 through T-0055, then T-0065, comment T-0067, approve-plan T-0066 (`11-53-46` through `11-53-58`)
- propose T-0071 `2026-10-24T11-53-59`

`node tools/agent-review.mjs 51 grokbot-3 reject "..."` exits 2: `unknown reviewer grokbot-3; one of grok-globe, grok-gait, grokbot-1, grokbot-2, grok, claude, codex, agy, matthew`. No commit status was set. The same refusal applies to every PR. `gh pr comment` on #38, #51 and #40 returned `Resource not accessible by integration`, so those PR threads have no new comment. The events are the record.

## Exact next step
PR https://github.com/Bannon-github/boreal/pull/55 is open against main. Do not merge. Do not push main. A machine that can record should re-run the T-0032 sky-share gate on `241c2b7` and the T-0028 fur look gates. grokbot-3 still cannot set `agent-review` until it is registered.
