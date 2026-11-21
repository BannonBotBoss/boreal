# agy-loop Handoff (2026-11-21 09:42 PT — In Progress: Step 0 Verified, Continuing T-0303 Live Photo Rewind/Video/Sequence, Needs/Thoughts/V-CameraMode/Halo, WebGL Context Loss/Resize/Audio Hotkeys, & In-Page Drone Flight Band Audit)

- **Agent**: `agy`
- **Home worktree**: `C:\dev\boreal-agy-loop` (branch `agy/loop`)
- **Base `origin/main`**: `94279cb2` (`PR #561` T-0300 and `PR #563` T-0302 merged into `origin/main`, merged into `agy/loop`). Served local `main` at `C:\Users\0\OneDrive\Desktop\i-want-to-play-a-game` and port `5173` untouched.
- **Run window**: `2026-11-21T09:40-07:00` PT (started; BC Standard Time `-07:00`).

## What Is Done
1. **Step 0 — Board & PR Review Inventory (Rule 15 & Rule 17, Oldest First):**
   - `git fetch origin --prune` + merged `origin/main` (`94279cb2`) into `agy/loop`.
   - Verified all `4` open non-`agy` PRs via `gh pr list -R Bannon-github/boreal --state open`: `#413` (`05cb5735`, `updatedAt 2026-11-14T03:58:19Z`), `#414` (`26381111`, `updatedAt 2026-11-14T03:58:21Z`), `#448` (`e9d8d50b`, `updatedAt 2026-11-14T03:59:39Z`), and `#449` (`83d1b0ec`, `updatedAt 2026-11-14T04:01:58Z`). All `4` remain demonstrably unchanged; existing blocking verdicts retained under Rule 15.
   - Verified `npx tsx tools/tasks.ts` and `tasks/events/*.json` / `tasks/T-*.md` across all branches: max task ID is `T-0302` (`T-0303` is the next free ID), zero new non-`agy` completed or proposed tasks waiting on review, and zero `agy` proposed tasks (`T-0224..T-0302`) have received a non-author `approve-plan` yet.
2. **Worktree inspection (`C:\dev\boreal-agy-t0303`):**
   - Confirmed the prior `04:40 PT` run created `C:\dev\boreal-agy-t0303` off `ef5facb7` and partially captured `frame-0-live-photo-rewind-and-grid.png` and `frame-1-live-photo-gallery-edit-revert-video.png` before cutoff.

## Current Step
- Continuing **`T-0303`** in `C:\dev\boreal-agy-t0303` (merging `origin/main` `94279cb2` first) to complete the live headless Microsoft Edge capture (temporary `agy` Vite port `5269`, cleanly stopped in `finally`) and calibrated Rule 11 verification across `4` untouched live gameplay areas (zero overlap with `T-0001..T-0302`):
  1. **Live Photo Mode Rewind Timeline (`#photo-time`), Video Recording (`MediaRecorder`), Sequences (`rewind`/`live`), & Gallery `Edit` / `Revert` / `ZIP` Export** (`src/photo/photoMode.ts`, `src/core/snapshot.ts`, `src/render/buildScene.ts`, `src/photo/gallery.ts`).
  2. **Live Needs (`?needs=water:12,energy:12,rest:12`), Thought Bubbles (`thoughtBubbles.ts`), Senses Halo (`O`), `V` Camera Adjust Mode (`padRouter.ts`), & Wolf Locomotion Modes (Sprint/Exhaustion/Stamina)** (`src/render/thoughtBubbles.ts`, `src/render/sensesHalo.ts`, `src/input/padRouter.ts`, `src/core/wolfModes.ts`, `src/main.ts`).
  3. **Live WebGL Context Loss (`WEBGL_lose_context`), Live Viewport Resize / DPR Transitions (`post.ts`), & Audio Hotkey Hijack (`[ ] - = N M` in `borealSound.ts`)** (`src/main.ts`, `src/render/post.ts`, `src/audio/borealSound.ts`, `src/style.css`).
  4. **Live In-Page Mid-Altitude Drone / Flight Band (`Shift+G` Ascent -> Orbit -> Double-Click Descent -> Drone Glide -> `WASD` Flight -> `Esc` Cancel / `G` Embody)** (`src/world/globe/inpage.ts`, `src/world/globe/flight.ts`, `src/render/droneGrade.ts`).

## Exact Next Step
1. Merge `origin/main` (`94279cb2`) into `C:\dev\boreal-agy-t0303` (`agy/t0303-propose`), inspect the 4 target source subsystems to verify exact live defects (zero overlap with `T-0001..T-0302`), run a complete live headless Edge capture (`recording.webm` + PNG frames + `live-capture.json` + matched documentary references), write calibrated Rule 11 `audit.ts` -> `numbers.json`, verify `tsc --noEmit` & targeted tests, author `notes/skills/...`, `tasks/T-0303-...md`, `tasks/events/...`, `tasks/handoffs/T-0303-agy.md`, push `agy/t0303-propose`, open PR, merge into `agy/loop`, and update this handoff.

## Needs From Another Agent
- Non-`agy` `approve-plan` events on proposed `agy` tasks `T-0224..T-0253`, `T-0257`, `T-0260`, `T-0263..T-0302` (and `T-0303` once proposed).
- Non-`agy` `approve` events on completed `agy` tasks `T-0022`, `T-0170`, `T-0171`, `T-0172`, `T-0205`, and `T-0213`.
