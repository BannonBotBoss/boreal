# Skill: register a Grok bot as a Matthew relay and a distinct reviewer

Use when a new Grok bot with its own GitHub account must record Matthew's chat approvals and review other agents' pull
requests. T-0069 did this for grokbot-1 and grokbot-2. T-0071 did it for grokbot-3. The bot may review every other agent.
It may never review its own branch.

## Steps
1. Handoff first (`tasks/handoffs/T-XXXX-<agent>.md`) and update it after each step. Take the next free task id across all
   branches before writing the file. The scan, the reserved gap, and how to renumber a collision are
   `notes/skills/next-free-task-id.md`. Do not fill a gap another task reserved (T-0046 is reserved).
2. Quote only what Matthew said, with the Pacific time he said it. The event's `agent` is the bot that writes the file.
   A relay adds `"for": "matthew"`. Never write `"agent": "matthew"`. A direct chat request is an approve-plan under rule
   16b: the note quotes his request and this sentence: "well, anything i request by direct chat shouldnt need approval"
   (Matthew, 2026-10-22 01:52 PT). Stamp `at` from the clock inside the script that writes the file. The filename's Pacific
   time matches that `at`. Two events in one minute get distinct seconds.
3. Add the bot's name to `RELAYS_MATTHEW` in `tools/tasks.ts`. That array is what makes a `"for": "matthew"` approve-plan
   or approve count as a non-author review on the bot's own task. The note must quote him. The bot earns no review credits
   for relaying. Without `for`, or without the note, the bot still cannot approve its own task.
4. Add the bot to `AGENTS` in `tools/agent-review.mjs`, beside the other `grokbot-N` names and before the bare `grok`
   prefix. The author is the first entry where the branch starts with `<name>/`. A review by that author exits 1 and
   writes no commit status. `grokbot-3/topic` is not `grok/topic`.
5. Name the bot in `tasks/RULES.md` rules 16 and 17(c) next to the bots already listed there.
6. Extend `tests/tasks.test.ts` (relay reaches done and pays the award with no review credits; self-approval without `for`
   or without a note stays proposed; the new bot and an older agent can approve each other) and `tests/agent-review.test.ts`
   (fake `gh`: cross-review exits 0 with a success status; self-review exits 1 and the log has no `statuses` call; `grok/`
   and `grokbot-N/` stay distinct; an unknown reviewer still exits 2).
7. This work has nothing on screen. Use the rule 12 evidence gate: the handoff lists each edit with file and line and the
   test that checks it. `npx tsc --noEmit` and `npm test` are green before the complete event. The complete event names
   this skill. Do not merge the PR. Do not push `main`. `tools/agent-review.mjs` will refuse the branch author, so a
   non-author records `agent-review` if the merger wants that status.

## Checks that prove it worked
- A throwaway board whose author is the new bot goes proposed, approved, claimed, completed, done when that bot relays
  Matthew, and the only credits are the task award.
- The same board stays proposed when that bot approves its own plan with no `for`, or with `for` and an empty note.
- Fake `gh`: the new bot approves `grokbot-1/`, `grokbot-2/` and `grok/` (exit 0). The new bot on its own branch exits 1
  and no status is posted. `grok` approving the new bot's branch exits 0, which is the proof the prefix was not collapsed.

## Mistakes to avoid
- Hand-typing `at`. Read the clock in the writer and use that string in both the field and the filename.
- Editing or deleting an old event to rename a bot. Board history is append-only; add a comment event.
- Treating a general remark as an approval of a task he did not name. "switch" counted because the question it answered
  named this change (rule 16). A standing remark such as "i can approve work" still approves nothing by itself.
- Recording the GitHub `agent-review` status as the branch's own prefix. Rule 16b lets the relay write the board approve.
  The review tool does not. Those are different checks.
- Pushing `main`, or force-pushing the bot's branch.
