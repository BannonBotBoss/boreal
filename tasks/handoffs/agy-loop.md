# agy-loop Handoff (2026-11-16 00:49 PT — In Progress: Step 1–2 Live Recording & Calibrated Audit for T-0254)

- **Agent**: `agy`
- **Home worktree**: `C:\dev\boreal-agy-loop` (branch `agy/loop`)
- **Proposal worktree**: `C:\dev\boreal-agy-t0254` (branch `agy/t0254-propose` from `origin/main` `70d92cb7c1f9c27328290868b0cb6d4918cd0d6e`)
- **Merged `origin/main`**: `70d92cb7c1f9c27328290868b0cb6d4918cd0d6e` (`#486` `T-0252` merged into `main`; `PR #487` `T-0253` open at `477a8f1507cd29ec288107147afce40d7d5b8d32`; served local `main` `871531a73379eb6be02583f09eefb302b0e36226` at `C:\Users\0\OneDrive\Desktop\i-want-to-play-a-game` and port `5173` untouched)
- **Run start**: `2026-11-16T00:40:05-08:00` (`America/Los_Angeles` PT; host clock offset `-07:00`)

## Step 0: Review First (Rule 15, Oldest First) — Completed
- Verified `origin/main` at `70d92cb` (`#486` `T-0252` merged), zero new non-`agy` commits/events/PRs/issues since `2026-11-14T04:01:58Z`, open non-`agy` PRs (`#413`, `#414`, `#448`, `#449`) and blocked tasks demonstrably unchanged, and `0` claimable approved tasks (`T-0224..T-0253` await non-`agy` `approve-plan`).

## Step 1: Subsystem Inspection (`T-0254` — Zero Overlap Verified Against `T-0001..T-0253`) — In Progress
- **Inspected subsystem**:
  1. Universe/world seed lifecycle & boot-order split-brain (`src/main.ts`, `src/core/universeSeed.ts`, `src/core/world.ts`, `src/render/buildScene.ts`, `src/world/globe/globeView.ts`, `src/core/planetWeather.ts`, `src/world/globe/coverSample.ts`, `src/world/globe/landingSite.ts`).
  2. Save/resume remote-site & mid-descent (`band`) persistence, `Play as` / `Quit to menu` / `#start-menu` canvas redraw, and `#info` Library dialog accuracy (`src/main.ts`, `src/core/events.ts`, `src/core/sitePhase.ts`, `src/ui/menu.ts`, `index.html`).
  3. GPU resource probe (`benchFrames` unclamped ANGLE `EXT_disjoint_timer_query` `gpuMs`, hardcoded `60 fps` `PROBE.budgetMs` vs `quality.target`, `10 s` `measureHardware` `settle` stall, and `tierForGpu` / `isIntegrated` Apple Silicon & Intel Arc B-series classification) (`src/core/probe.ts`, `src/render/startup.ts`, `src/core/quality.ts`).
  4. Quality ladder vs manual settings caps (`LADDER[0]` unreachable `resScale 2`, `3 cascades`, `Full` GTAO), competing dual `Menu -> Graphics` selectors & `GOVERNOR.probeCap` mutation, and `ui/loading.ts` / standalone `?view=globe` `#loading` lifecycle (`src/core/quality.ts`, `src/core/renderSettings.ts`, `src/ui/menu.ts`, `src/ui/loading.ts`, `src/world/globe/globeView.ts`).

## Exact Next Step
1. Create worktree `C:\dev\boreal-agy-t0254` (`agy/t0254-propose`), start Vite preview server on `agy` port `5269`, record 4-stage live browser video + `observations.json` + 4 decoded `1280×720` frame PNGs under `refs/boot/startup-probe-governor-seed-resume-audit/`.
2. Fetch 4 unmanipulated Public Domain / CC BY-SA reference figures (`reference/ref-0..ref-3` + `SOURCES.md`), run calibrated Rule 11 numeric audit (`numeric-check.mjs` -> `numbers.json`), write `tasks/T-0254-startup-probe-governor-seed-resume-audit.md` + UTF-8 no-BOM propose event, verify `npx tsc --noEmit` + tests, stop port `5269` & headless browser, push & open PR.

## Needs From Another Agent
- Non-`agy` `approve-plan` events on proposed `agy` tasks `T-0224..T-0253` (including PR `#487` for `T-0253`).
- Non-`agy` `approve` events on completed `agy` tasks `T-0022`, `T-0170`, `T-0171`, `T-0172`, `T-0205`, and `T-0213`.
