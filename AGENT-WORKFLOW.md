# How agents add work (read before you change anything)

Matthew's rule (2026-10-18): **agents only add to the project. Nobody overwrites anyone's work. Matthew decides what goes in.**
Git already gives us this. Every change is a new commit on the agent's own branch, and `main` changes only when Matthew merges.

## Tasks and credits
Work is picked from the **task board** in [tasks/](tasks/README.md): propose, get the plan approved by another agent, claim,
write a handoff file **before** you start (in case you are rate-limited), complete, and another agent approves. Approved
work earns credits; confirmed bugs move credits from the author to the finder. `npx tsx tools/tasks.ts` shows the board.

## The loop
1. **`main` is the build Matthew plays**, in `Desktop\i-want-to-play-a-game`. Agents never edit files in that folder in place
   and never commit to `main`.
2. **Fork the latest `main`** into a branch named `<agent>/<topic>` (`claude/…`, `codex/…`, `grok/…`). Always start from the
   newest `main`, not from an old copy.
   - Agents with a shell on this PC work in their own worktree **outside OneDrive** (OneDrive can corrupt `.git`):
     `git worktree add C:\dev\boreal-<agent> -b <agent>/<topic> main`
   - Claude has no shell on this PC. It builds the branch in its own workspace and delivers it as **new files only** in
     `Desktop\Boreal inbox\` (outside the project): a git bundle with the branch, and a `Merge … .bat` button. Nothing in the
     project changes until Matthew double-clicks it.
3. **Commit under your own name** (`git -c user.name="Codex" -c user.email=… commit`), so the history shows who did what.
4. **Before you hand it over**, on the branch: `npx tsc --noEmit`, `npm test` (includes `tests/rules.test.ts`) and
   `npm run build` are green. Give Matthew a **playable link** (or the exact steps to play it) and say what changed.
5. **Matthew merges**: double-click the branch's `Merge … .bat` in `Desktop\Boreal inbox\`, or in GitHub Desktop select `main`,
   then *Branch → Merge into current branch* and pick the branch. The .bat merges only if the folder has no uncommitted
   work, git finds no conflict, and `npm test` passes; otherwise it changes nothing. If there is a conflict, nothing is merged. The agent then brings its branch up to date with the new `main`
   (merge or rebase *its own* branch) and hands it over again.
6. **Undo is a new commit.** If something merged must go back, use `git revert` (it adds a commit). History is never rewritten.

## Never
- Copy whole files over newer ones, or "sync" a folder from an older copy. (This is what lost photo mode on 2026-10-15.)
- `git reset --hard`, `git checkout -- <file>` / `git restore` over changes you didn't make, `git clean` in the project
  folder, force-push, rebase or amend commits that are already on `main`.
- Commit straight to `main`, or merge your own branch into `main`.

## Notes
- Each agent writes only its **own** notes file: `notes/claude.md`, `notes/codex.md`, `notes/grok.md` (create yours). Add a dated
  entry per branch: what changed, which files, how it was checked, anything you propose for another agent's code.
  Separate files mean notes never conflict.
- `AGENT-NOTES.md` is the shared history up to 2026-10-18. Read it for context; new entries go in `notes/`.
- `PROJECT-RULES.md` still applies to every branch.
