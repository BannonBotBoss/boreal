# Skill: take the next free task id before proposing

Use before creating `tasks/T-XXXX-<slug>.md` or a propose event. Also use when two task files on main share an id.
The ledger keys tasks by the front-matter id (`tools/tasks.ts`). A second file used to overwrite the first, so the
board showed one row and the hidden task's events stuck to the survivor. T-0071 collided on 2026-10-24: the relay
(`tasks/T-0071-grokbot-3-relay.md`, PR #54) and the wolf-file landing (PR #55). Matthew in chat, 2026-10-24 17:10 PT:
"yes, automaticallly fix anything like this mmoving forward". The first renumber picked T-0074 without scanning open
PR branches. PR #60 (`grokbot-1/wolf-jump-ballistic`, opened about five minutes earlier) already used T-0074, and
PR #64 uses T-0075, so the landing is T-0076. T-0100 collided again on 2026-10-26: pull request #148
(`grokbot-3/sense-pictures`) keeps T-0100, and the level follow view on pull request #147 is T-0101.

## Steps
1. Handoff first. `git fetch --all` so `git log --all` sees every remote branch. Then list open pull requests
   (`gh pr list --state open`) and fetch any head ref that is still missing (`git fetch origin <head>`). An id is
   taken when an open PR's branch, title, body, task file, event, or labelled test uses it, even if that branch was
   pushed after your last fetch and even if it has no `tasks/T-XXXX-*.md` yet. Do not force-push. Do not push `main`.
2. List every id before choosing one:
   - `git log --all --name-only --pretty=format: -- "tasks/T-*"`
   - `tasks/T-*.md` on the tree you are about to commit, and the same paths on every remote branch and every open PR head
   - `tasks/events/*.json` on that tree (the `"task"` field and the filename) and the same paths on other branches
     (`git log --all --name-only -- "tasks/events"`)
   - Open PR titles and bodies, and tests labelled `T-XXXX` on those heads. PR #60 claimed T-0074 in its title and in
     `tests/animal-behavior.test.ts` with no task file.
3. The next free id is one higher than the highest `T-` number in that scan. Do not fill a gap another task reserved.
   T-0046 is reserved (the T-0021 handoff). T-0072 and T-0073 were already on grokbot-1 branches. T-0074 is PR #60
   and T-0075 is PR #64, so the collided landing is T-0076, not a hole below T-0071 and not T-0074.
4. Re-check immediately before writing the file. Another branch may have taken the id since the scan.
5. Write the task file and one propose event under that id. Stamp `at` from the clock inside the script that writes
   the file (Pacific, `America/Los_Angeles`, ISO with offset). The filename is
   `tasks/events/YYYY-MM-DDTHH-MM-SS-<agent>-<type>-<task>.json` and matches that `at`. Two events in one minute get
   distinct seconds. Do not hand-type the stamp.
6. If two files on main already share an id, the task that reached main second is renumbered (rule 13):
   - Rename `tasks/T-OLD-<slug>.md` to the free id and change its front-matter `id` and heading. Leave credits,
     author, and objectives alone unless the task itself is being edited.
   - Do not edit or delete the old propose. Board history is append-only (rule 10).
   - Write a comment on the old id that names the old event file and the new id. Precedent:
     `tasks/events/2026-10-23T12-54-20-grok-comment-T-0044.json`.
   - Write a propose under the new id, then a comment on the new id that names the old id. Precedent:
     `tasks/events/2026-10-23T14-27-10-grok-comment-T-0064.json`.
   - A propose does not change state. Say so in the comment when the old event would otherwise look like a second
     proposal of the surviving task.
   - Keep the plan state the collision had. A propose that was not approve-planned stays not approve-planned.
     Renumbering is not an approve-plan and not a claim.
   - Never edit or delete an event file that is already on main. Event files that exist only on the unmerged branch
     that picked the collided id may be replaced with correctly numbered ones. If the wrong event is already on main,
     add a correcting comment instead.
7. The ledger keeps the first filename in sort order and pushes `duplicate task id` for each later file. `npm test`
   must fail on a live-board collision. That assert is its own test in `tests/tasks.test.ts`. It is not the legacy
   rule-break todo, which stays a todo whenever any older error exists and so cannot catch a new duplicate.

## Checks that prove it worked
- `npx tsx tools/tasks.ts` lists one row per id. The id that was collided shows the task that was already on main.
  The renumbered task shows under the new id, in the state it had before (proposed, if it was only proposed).
- A throwaway board with `T-0099-a.md` and `T-0099-b.md` both `id: T-0099` reports
  `T-0099-b.md: duplicate task id T-0099 (also T-0099-a.md)` and keeps the title from `T-0099-a.md`.
- The live-board test reads `tasks/T-*.md`, asserts no repeated front-matter id, and asserts the old propose file
  still says the old id.

## Mistakes to avoid
- Scanning main's working tree and ignoring other branches. That is how T-0071 was issued twice.
- Skipping open PR branches. `git log --all` only sees refs you have fetched. PR #60 was not in the scan that chose
  T-0074, and that PR claims T-0074 in its title and in `tests/animal-behavior.test.ts` without a `tasks/T-0074-*.md`
  file. Fetch every open PR head before taking an id.
- Reusing T-0046 or any other reserved gap.
- Editing the old event's `"task"` field, or deleting an event that is already on main, to make the ledger look clean.
  Replacing an event that exists only on the unmerged branch is the exception in step 6.
- Hand-typing `at`, or using `TZ=America/Los_Angeles` in Git Bash (it falls back to UTC here). Read the clock with
  `Intl` `America/Los_Angeles` inside the writer.
- Treating the renumber comment as an approve-plan. Quote Matthew's instruction with the Pacific time he said it,
  in the agent's own name. `"for": "matthew"` on a comment does not approve a plan. The note says it is not an approval.
- Approving your own plan while renumbering it.
