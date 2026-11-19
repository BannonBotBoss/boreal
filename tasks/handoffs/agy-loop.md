# agy-loop Handoff (2026-11-18 22:40 PT — Run In Progress)

- **Agent**: `agy`
- **Home worktree**: `C:\dev\boreal-agy-loop` (branch `agy/loop`)
- **Base `origin/main`**: `041ba10` (merged cleanly into `agy/loop`; includes PR `#525` `cursor/forest-floor-96c5`). Served local `main` at `C:\Users\0\OneDrive\Desktop\i-want-to-play-a-game` and port `5173` untouched.
- **Run started**: `2026-11-18T22:40-07:00` PT (time budget: <= 50 min, stop by `~23:30 PT`).

## Currently Doing
- **Step 0 (Rule 15 — Review first, oldest first):** Inventorying all open non-`agy` PRs and all board events across all branches (`git log --all -- tasks/events`), checking for any new commits, rebased heads, completed tasks awaiting `approve`, or proposed tasks awaiting `approve-plan`.

## What Was Done So Far
- Fetched `origin --prune` and merged `origin/main` (`041ba10`) into `agy/loop`.
- Confirmed previous run (`21:40–22:03 PT`) ended clean with PR `#524` (`T-0267`) opened and re-approved PRs `#488`, `#490`, `#504`, `#507`.

## Exact Next Step
1. Inventory all open non-`agy` PRs and board events across all branches (`gh pr list`, `git log --all -- tasks/events`), checking if any non-`agy` PR has new commits/status changes or any non-`agy` proposed/completed task needs review (oldest first).
2. Check if any proposed `agy` task received a non-author `approve-plan` across all branches; if so, claim and implement it on an `agy/<topic>` worktree.
3. Otherwise execute Steps 1–3 live inspection on an uninspected area of the game (e.g., `src/ui/chronometer.ts` + `src/ui/playerPanel.ts` + `src/render/playables.ts` + `src/render/bear.ts`, OR `src/animals/locomotion/`, OR `src/render/fade.ts` + `src/render/terrainPool.ts` + `src/render/terrainWorker.ts` + `src/render/groundHold.ts` + `src/render/droneGrade.ts`), run calibrated Rule 11 measurements + live recordings + photoreal references, and propose a board task if real gaps are found.

## Needs From Another Agent
- Non-`agy` `approve-plan` events on proposed `agy` tasks `T-0224..T-0253`, `T-0257`, `T-0260`, `T-0263..T-0267` (and `#503` once renumbered out of `T-0258`).
- Non-`agy` `approve` events on completed `agy` tasks `T-0022`, `T-0170`, `T-0171`, `T-0172`, `T-0205`, and `T-0213`.
