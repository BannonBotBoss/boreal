# T-0071 handoff (grokbot-3)

Branch: `grokbot-3/relay-reviewer` off main `ae4ecbe`. Nothing on screen (rule 12). Do not merge. Do not push main.

## Doing
Register `grokbot-3` the way T-0069 registered grokbot-1 and grokbot-2: ledger relay of Matthew's chat approvals, and a distinct reviewer that may review other agents' PRs and never its own.

Matthew in chat, 2026-10-24 11:36 PT, replied "switch" when asked: "Do you want me to switch to `grokbot-3` to match grokbot-1 and grokbot-2? That name would also need adding to `RELAYS_MATTHEW` before I can record your chat approvals." Direct chat request (rule 16). His words, quoted verbatim, are only "switch".

## Done
- [x] Rule 13 id. `git log --all --name-only -- tasks/T-*` highest id is T-0070. T-0046 is a gap reserved by the T-0021 handoff, not taken. Next free id is T-0071.
- [x] Rule 15 inventory at start (ledger `npx tsx tools/tasks.ts`, 23 legacy rule breaks, same count T-0069 reported). Open PRs: `gh pr list -R Bannon-github/boreal --state open` returned none. Completed and not yet approved, oldest first, none by grokbot-3: T-0021 (grok), T-0025 (agy), T-0028 (grok), T-0032 (grok), T-0069 (grokbot-2). Proposed plans still without approve-plan include T-0007 (no objectives), T-0045, T-0047 through T-0055, T-0065, T-0066, T-0067 (no objectives). This run's instruction is the registration Matthew named. Those tasks were not approved: their gates were not re-run here, and unknown evidence is not an approval.
- [x] Task file `tasks/T-0071-grokbot-3-relay.md` (author grokbot-3, 3 objectives, credits 30 = 10 x 3, scratch false, research false, skill grokbot-relay-reviewer).
- [x] Events, `at` from the clock in `/tmp/write-board-event.mjs` (not typed): propose `tasks/events/2026-10-24T11-41-25-grokbot-3-propose-T-0071.json` (2026-10-24T11:41:25-07:00), approve-plan for matthew `tasks/events/2026-10-24T11-41-26-grokbot-3-approve-plan-T-0071.json` (2026-10-24T11:41:26-07:00), claim `tasks/events/2026-10-24T11-41-27-grokbot-3-claim-T-0071.json` (2026-10-24T11:41:27-07:00). Claim is one second after the approve-plan.
- [x] Code and tests written. Skill `notes/skills/grokbot-relay-reviewer.md` created (T-0069's header is `skill: false` and it left no how-to). `notes/skills/board-rule-inspection.md` line 38 now names the relay list. `AGENT-NOTES.md` has the 2026-10-24 entry.

## Rule 12 evidence
Nothing on screen, so no frame gate. No new physical numbers (numbers gate N/A). A reviewer can spot-check any three rows.

| Finding | Evidence | Became |
|---|---|---|
| Ledger accepted a Matthew relay only from grok, grokbot-1, grokbot-2 | `tools/tasks.ts` `RELAYS_MATTHEW` was that three-name array (T-0069) | `grokbot-3` appended. `tests/tasks.test.ts` T-0071 case: for-matthew relay reaches done with award credits and no review credits; missing `for` or missing note stays proposed |
| Reviewer list had no grokbot-3, so `node tools/agent-review.mjs` would exit 2 on that name | `tools/agent-review.mjs` `AGENTS` (T-0069 list) | `grokbot-3` inserted before `grok`. `tests/agent-review.test.ts`: grokbot-3 approves grokbot-1/, grokbot-2/ and grok/; those three approve grokbot-3/; self-review exits 1 with no status call |
| Rules 16 and 17(c) named only grokbot-1 and grokbot-2 | `tasks/RULES.md` rule 16 last sentence and rule 17(c) | Both now list grokbot-3, with the 2026-10-24 11:36 PT quote "switch" on 17(c) |
| T-0069 did not leave a skill for the next bot | `tasks/T-0069-grokbot-reviewers.md` header `skill: false`; no `notes/skills` file from that task | `notes/skills/grokbot-relay-reviewer.md`. Task header `skill: grokbot-relay-reviewer` |
| `grok/` must not be read as the author of `grokbot-3/` | `AGENTS.find` uses `startsWith(name + '/')`. `grokbot-3/topic`.startsWith(`grok/`) is false, and grokbot-3 is listed before grok | Test asserts `review('grokbot-3/topic', 'grok')` exits 0 (grok is not treated as the author) and `review('grokbot-3/relay-reviewer', 'grokbot-3')` exits 1 |

## Next
Run `npx tsc --noEmit` and `npm test`. Confirm the ledger still reports 23 legacy rule breaks and that none of them name T-0071. Then write the complete event from the clock.

## Needs from another agent
- A non-author `agent-review` on this PR if the merger wants one. `tools/agent-review.mjs` refuses grokbot-3 on a `grokbot-3/` branch.
- Not merged. Undo after a merge would be `git revert` of the merge commit, or `git reset --keep ae4ecbe` only if this branch is the tip of main and Matthew asks for that.
