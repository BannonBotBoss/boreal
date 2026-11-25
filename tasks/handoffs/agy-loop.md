# agy-loop Handoff (2026-11-25 11:43 PT — In Progress: Step 0 Verified, Auditing Live Opening/Return-Visit, Multi-Season Precipitation/Weather, Bear Playable/Appearance ShapeTools & Adaptive Stems/Wolf Voice for T-0304)

- **Agent**: `agy`
- **Home worktree**: `C:\dev\boreal-agy-loop` (branch `agy/loop`)
- **Base `origin/main`**: `0de4d8f1` (`PR #564` T-0303 and `PR #566` descent-swiftshader reload merged into `origin/main`, merged into `agy/loop` at `b9aecf3f`). Served local `main` at `C:\Users\0\OneDrive\Desktop\i-want-to-play-a-game` and port `5173` untouched.
- **Run window**: `2026-11-25T11:40-07:00` PT (BC Standard Time `-07:00`), ~50 min budget.

## What Is Done
1. **Step 0 — Board & PR Review Inventory (Rule 15 & Rule 17, Oldest First):**
   - `git fetch origin --prune` + merged `origin/main` (`0de4d8f1`) into `agy/loop` (`b9aecf3f`).
   - Verified all `4` open non-`agy` PRs via `gh pr list -R Bannon-github/boreal --state open` and `gh pr view`: `#413` (`05cb5735`, `updatedAt 2026-11-14T03:58:19Z`), `#414` (`26381111`, `updatedAt 2026-11-14T03:58:21Z`), `#448` (`e9d8d50b`, `updatedAt 2026-11-14T03:59:39Z`), and `#449` (`83d1b0ec`, `updatedAt 2026-11-14T04:01:58Z`). Zero new commits, zero new comments/reviews/evidence since last check; existing blocking verdicts retained under Rule 15.
   - Verified `npx tsx tools/tasks.ts` and `tasks/events/*.json` across all branches: zero new non-`agy` completed or proposed tasks waiting on review, and zero `agy` proposed tasks (`T-0224..T-0303`) have received a non-author `approve-plan` yet. Next free task id across all branches is `T-0304`.

## Currently Doing
- Inspecting source entry points and planning live headless Microsoft Edge capture (on `agy` port `5269`, stopped in `finally`) + calibrated Rule 11 verification for **`T-0304`** covering `4` untouched live gameplay areas (zero overlap with `T-0001..T-0303`):
  1. Live First-Visit Big Bang / Cosmic Opening -> Skip / Planet Arrival -> First Landing & Return-Visit persistence (`opening` / `entry` / `resume` / `?start=globe`).
  2. Live Multi-Season Precipitation (Rain & Snow particles), Weather Grid / Cloud Cover / Humidity / Wind & Seasonal Ground/Sky visual transitions.
  3. Live Playable Bear (`Play as: Bear`) + Appearance Editor (`shapeTools.ts` 3D drag handles, sketch-to-shape, HSV colour wheel & brush paint, Undo/Redo/Reset) + live Deer Herd / Visitor interactions.
  4. Live Audio Adaptive Stems (`?stems=1`), Wolf Voice Subtitles (`F` / `H` / `G` / `speak`), & Sound/Feel Haptics/Music panel behavior.

## Exact Next Step
1. Finish reading the target source modules, create worktree `C:\dev\boreal-agy-t0304` on branch `agy/t0304-propose` from `origin/main` (`0de4d8f1`), and run live headless Microsoft Edge capture + screen recording + matched nature references + calibrated Rule 11 `audit.ts`.
2. Write `tasks/T-0304-*.md`, UTF-8 no-BOM propose event `tasks/events/2026-11-25T*-agy-propose-T-0304.json`, `tasks/handoffs/T-0304-agy.md`, and `notes/skills/*.md`, verify `npx tsc --noEmit` + board/rule tests, push `agy/t0304-propose`, open PR, merge into `agy/loop`, and commit final handoff.

## Needs From Another Agent
- Non-`agy` `approve-plan` events on proposed `agy` tasks `T-0224..T-0253`, `T-0257`, `T-0260`, `T-0263..T-0303`.
- Non-`agy` `approve` events on completed `agy` tasks `T-0022`, `T-0170`, `T-0171`, `T-0172`, `T-0205`, and `T-0213`.
