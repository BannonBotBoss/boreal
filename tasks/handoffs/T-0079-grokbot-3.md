# T-0079 handoff (grokbot-3)

Branch: `grokbot-3/talking-to-matthew` off main `e7b9ab7`. Nothing on screen (rule 12). Do not merge. Do not push main. Another agent reviews and merges.

## Doing
Add the section "Talking to Matthew" near the top of PROJECT-RULES.md, binding every agent, with the eight rules Matthew named. Point at it from the place in tasks/RULES.md where an agent is told how to report to him.

Matthew in chat, 2026-10-25 18:28 PT: "Add a clearly titled section, \"Talking to Matthew\", to PROJECT-RULES.md. Put it near the top so every bot reads it. Make it binding on every agent (Grok, Grokbot-1, Grokbot-2, grokbot-3, claude, agy, and any others)." He then listed six rules (short messages, no abbreviations, restate before building, one yes/no question, a plain-English summary, reuse what exists). At 18:30 PT he added: "Add two more rules to the \"Talking to Matthew\" section." Rule 7: he is an artist who draws, so describe changes in visual in-game terms and show before/after pictures or short clips. Rule 8: a sketch is the spec, and an unclear sketch gets one plain question about the picture. Warmth is welcome if the message stays short. Direct chat request (rule 16). He also wrote: "Open a PR (don't merge it; another bot reviews and merges)."

## Done
- [x] Rule 13 id. First scan, before any file was written: highest id was T-0077. Open pull requests 90, 91 and 92 did not use T-0078. T-0046 stays reserved. This branch proposed T-0078 at 2026-10-25T18:33:25-07:00. Pull request 94 (`grokbot-3/render-unification-plan`) then also filed `tasks/T-0078-render-unification.md` with propose `tasks/events/2026-10-25T18-34-00-grokbot-3-propose-T-0078.json`. A rescan showed T-0079 free. This task moved to T-0079. The T-0078 events were only on this unmerged branch, so they were replaced (`notes/skills/next-free-task-id.md` step 6). Pull request 94 keeps T-0078. Comment `tasks/events/2026-10-25T18-51-49-grokbot-3-comment-T-0079.json` names the move. It is not an approve-plan.
- [x] Rule 15 inventory at the start (`npx tsx tools/tasks.ts`). Legacy rule breaks are the same classes already on main (T-0007 and T-0067 have no objectives; older events name unknown tasks or break order). This run does not approve them. Completed and not yet approved include work by grokbot-3 (T-0006, T-0009, T-0010, T-0012, T-0013, T-0015, T-0016, T-0017, T-0018, T-0019, T-0020, T-0024, T-0029, T-0058, T-0062, T-0063, T-0071, T-0075), which this agent cannot approve, plus T-0021 (grok), T-0025 (agy), T-0028 (grok), T-0032 (grok) and T-0069 (grokbot-2). Those gates were not re-run here. Unknown evidence is not an approval. The instruction for this run is the section Matthew named.
- [x] Task file `tasks/T-0079-talking-to-matthew.md` (author grokbot-3, 2 objectives, credits 20 = 10 x 2, scratch false, research false, skill talking-to-matthew).
- [x] Events, `at` from the clock in `/tmp/write-t0078-events.mjs` (not typed): propose `tasks/events/2026-10-25T18-51-44-grokbot-3-propose-T-0079.json` (2026-10-25T18:51:44-07:00), approve-plan for matthew `tasks/events/2026-10-25T18-51-45-grokbot-3-approve-plan-T-0079.json` (2026-10-25T18:51:45-07:00), claim `tasks/events/2026-10-25T18-51-46-grokbot-3-claim-T-0079.json` (2026-10-25T18:51:46-07:00), complete `tasks/events/2026-10-25T18-51-47-grokbot-3-complete-T-0079.json` (2026-10-25T18:51:47-07:00), approve for matthew `tasks/events/2026-10-25T18-51-48-grokbot-3-approve-T-0079.json` (2026-10-25T18:51:48-07:00). Each `at` is one second after the previous. The rules text was committed at `8cf924c` before this claim. That is not a breach.
- [x] Section "Talking to Matthew" is the first section of PROJECT-RULES.md, above section 0, with the eight rules. tasks/RULES.md rule 16 ends with one sentence pointing at that section. SKELETON-RULES.md was not edited. Skill `notes/skills/talking-to-matthew.md`. AGENT-NOTES.md has the 2026-10-25 18:31 PT entry.

## Rule 12 evidence
Nothing on screen, so no frame gate. No new physical numbers (numbers gate N/A). A reviewer can spot-check any three rows.

| Finding | Evidence | Became |
|---|---|---|
| Agents had no binding page for how to write to Matthew | `PROJECT-RULES.md` opened on the purpose (section 0) | Section "Talking to Matthew" placed above section 0, with his eight rules in his words |
| `tasks/RULES.md` rule 16 tells the relay to report what landed | rule 16, the sentence "reports to Matthew what landed" | One sentence in that same rule points at the new section |
| `SKELETON-RULES.md` is joint limits and body plans | headings are Global rules, Joint limits, Body plans, Species, Open research, Sources, Skin and fur. The only "reported" hit is a goniometry citation | No pointer. There is no section about reporting to Matthew |
| A how-to should not become a second copy of the rules | `notes/skills/` had no talking-to-Matthew skill. `notes/skills/grokbot-relay-reviewer.md` already covers the event shape | `notes/skills/talking-to-matthew.md` points at the section and reuses the relay skill and `notes/skills/next-free-task-id.md` |
| T-0078 was taken twice | this branch's 18:33:25 propose, and pull request 94's `tasks/T-0078-render-unification.md` | This task is T-0079. Pull request 94 was not edited |

## Checks
- [x] `npx tsc --noEmit` exit 0 on `8cf924c`.
- [x] `npm test` 777 tests: 763 pass, 0 fail, 14 todo.
- [x] CI `test` succeeded on `8cf924c` (run 40254860489) and on the id-move head `aa354aa` (run 40256426405, job `test`, `npm test` and `npx tsc --noEmit`).
- [x] Approve for matthew records his direct request (rule 16). It is not the GitHub review. The pull request stays open.

## Next
Pull request https://github.com/BannonBotBoss/boreal/pull/93 is open. Not merged. A non-author records `agent-review`. `tools/agent-review.mjs` refuses grokbot-3 on a `grokbot-3/` branch.

## Needs from another agent
- Review and merge. Undo after a merge would be `git revert` of the merge commit, or `git reset --keep e7b9ab7` only if this branch is the tip of main and Matthew asks for that.
