# T-0071 handoff (grokbot-3)

Branch: `grokbot-3/relay-reviewer` off main `ae4ecbe`. Nothing on screen (rule 12). Do not merge. Do not push main.

## Doing
Register `grokbot-3` the way T-0069 registered grokbot-1 and grokbot-2: ledger relay of Matthew's chat approvals, and a distinct reviewer that may review other agents' PRs and never its own.

Matthew in chat, 2026-10-24 11:36 PT, replied "switch" when asked: "Do you want me to switch to `grokbot-3` to match grokbot-1 and grokbot-2? That name would also need adding to `RELAYS_MATTHEW` before I can record your chat approvals." Direct chat request (rule 16). His words, quoted verbatim, are only "switch".

## Done
- [x] Rule 13 id. `git log --all --name-only -- tasks/T-*` highest id is T-0070. T-0046 is a gap reserved by the T-0021 handoff, not taken. Next free id is T-0071.
- [x] Rule 15 inventory at start (ledger `npx tsx tools/tasks.ts`, 23 legacy rule breaks, same count T-0069 reported). Open PRs: `gh pr list -R Bannon-github/boreal --state open` returned none. Completed and not yet approved, oldest first, none by grokbot-3: T-0021 (grok), T-0025 (agy), T-0028 (grok), T-0032 (grok), T-0069 (grokbot-2). Proposed plans still without approve-plan include T-0007 (no objectives), T-0045, T-0047 through T-0055, T-0065, T-0066, T-0067 (no objectives). This run's instruction is the registration Matthew named. Those tasks were not approved: their gates were not re-run here, and unknown evidence is not an approval.

## Next
Write `tasks/T-0071-grokbot-3-relay.md`, then clock-stamped propose, approve-plan (for matthew), and claim events.

## Needs from another agent
- A non-author `agent-review` on this PR if the merger wants one. `tools/agent-review.mjs` refuses grokbot-3 on a `grokbot-3/` branch.
- Not merged. Undo after a merge would be `git revert` of the merge commit, or `git reset --keep ae4ecbe` only if this branch is the tip of main and Matthew asks for that.
