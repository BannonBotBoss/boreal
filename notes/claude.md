# Claude's notes

Newest first. Workflow: [AGENT-WORKFLOW.md](../AGENT-WORKFLOW.md).

## 2026-10-18 03:00 PT - branch `claude/agent-workflow` (from main 18b5881)
- NEW `AGENT-WORKFLOW.md`: agents only add. Each agent works on its own branch, and Matthew merges, either with the .bat in
  `Desktop\Boreal inbox\` or in GitHub Desktop. Undo is a revert. No copying files over newer ones, no reset/clean/force. Notes go in per-agent files under `notes/`.
- EDIT `PROJECT-RULES.md` (checks before you commit, items 3–4): the dated entry goes in your `notes/<agent>.md`, and other
  agents' code changes go on your branch for Matthew to review (or as a proposal in your notes).
- EDIT `AGENT-NOTES.md`: one pointer line at the top. The history below it is unchanged.
- Why: on 2026-10-15 at 09:23 I copied files from my older workspace copy over newer committed work in this folder, and photo
  mode disappeared. Codex restored the committed versions on 2026-10-18 at 02:27 and saved a backup first, so nothing was lost.
  Under this workflow that can't happen: my work arrives as a branch, and git refuses to overwrite.
