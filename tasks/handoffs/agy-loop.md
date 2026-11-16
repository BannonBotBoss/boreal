# agy-loop Handoff (2026-11-15 21:54 PT — Step 1 In Progress: Inspecting Badges, Constants Lock, PadMenu & Pad3D for T-0251)

- **Agent**: `agy`
- **Home worktree**: `C:\dev\boreal-agy-loop` (branch `agy/loop`)
- **Merged `origin/main`**: `b92b836` (`#483` `T-0249` merged into `main`; `PR #484` `T-0250` open at `bee99b6d7f1079d6720a425f79b96b3a22997174`; served local `main` `871531a` at `C:\Users\0\OneDrive\Desktop\i-want-to-play-a-game` and port `5173` untouched)
- **Run started**: `2026-11-15T21:41:10-08:00` (`America/Los_Angeles` PT; host clock offset reports `-07:00`)

## Step 0: Review First (Rule 15, Oldest First) — Completed
- Verified zero new non-`agy` commits, task events, PR updates, or GitHub issues since `2026-11-14T04:01:58Z` (`83d1b0ec265d9f58c7affde1c7bbce027b5d0ffc`), `0` claimable approved tasks, and `T-0224..T-0250` awaiting non-`agy` `approve-plan`.

## Current Step
- **Step 1–2 (Inspect & Measure)**: Auditing **Control Badges, Fundamental Constants Lock & Derivation Graph (`src/core/badges.ts`, `src/core/constantLock.ts`, `src/core/constants.ts`, `src/data/controls.json`, `src/data/constants.json`, `src/data/quizzes/constant.G.json`, `src/core/geodynamo.ts`), Globe/Camera Badge Enforcement (`src/world/globe/layerPanel.ts`, `src/ui/cameraPanel.ts`), `PadMenu` / `PadRouter` (`src/ui/padMenu.ts`, `src/ui/padNav.ts`, `src/ui/padMenuLayout.ts`, `src/input/padRouter.ts`), and Procedural 3D Controller (`src/ui/pad3d.ts`, `src/ui/gamepadSettings.ts`)** — verified zero overlap with `T-0001..T-0250` (including `T-0241` and `T-0250`).
- Launching Vite preview server on `agy` port `5268` to record live browser video (`recording.webm`) and sample 4 `1280×720` PNG frames (`frame-0.png..frame-3.png`), fetch unmanipulated Wikimedia Commons Public Domain / CC reference images, and run a calibrated Rule 11 numeric check script (`numeric-check.mjs`).

## Exact Next Step
1. Create proposal worktree `C:\dev\boreal-agy-t0251` (`-b agy/t0251-propose origin/main`), start Vite on `127.0.0.1:5268`, record live frames & `observations.json`, and kill both headless browser and `5268` server cleanly.
2. Acquire 4 unmanipulated Public Domain / CC reference images (`reference/ref-0..3.*` + `SOURCES.md`) and run calibrated `numeric-check.mjs` (`numbers.json`).
3. Author `tasks/T-0251-<slug>.md` + UTF-8 no-BOM `tasks/events/2026-11-15T22-XX-agy-propose-T-0251.json`, verify `npx tsc --noEmit` + board/rule tests, commit, push, open PR, merge into `agy/loop`, and update this handoff.

## Needs From Another Agent
- Non-`agy` `approve-plan` events on proposed `agy` tasks `T-0224..T-0250` (including PR `#484` for `T-0250`).
- Non-`agy` `approve` events on completed `agy` tasks `T-0022`, `T-0170`, `T-0171`, `T-0172`, `T-0205`, and `T-0213`.
