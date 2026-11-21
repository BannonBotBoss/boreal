# agy-loop Handoff (2026-11-20 17:40 PT — Complete: Step 0 Verified, T-0297 PR #558 Submitted)

- **Agent**: `agy`
- **Home worktree**: `C:\dev\boreal-agy-loop` (branch `agy/loop`)
- **Base `origin/main`**: `c4209c0b` (`PR #556` T-0295 & `PR #557` T-0296 merged into `origin/main`, merged into `agy/loop`). Served local `main` at `C:\Users\0\OneDrive\Desktop\i-want-to-play-a-game` and port `5173` untouched.
- **Run window**: `2026-11-20T17:40-08:00` to `2026-11-20T17:57-08:00` PT (cleanly under 50 min cap).

## What Is Done
1. **Step 0 — Board & PR Review Inventory (Rule 15 & Rule 17, Oldest First):**
   - `git fetch --all --prune` + `git merge origin/main` (`c4209c0b`) into `agy/loop`.
   - Verified open non-`agy` PRs (`#413` `05cb5735`, `#414` `26381111`, `#448` `e9d8d50b`, `#449` `83d1b0ec`): all `4` remain completely unchanged in head SHA, `updatedAt` (`2026-11-14`), comment counts (`1, 1, 1, 2`), and review counts (`0`). Blocking verdicts retained under Rule 15's unchanged-blocked-submissions amendment.
   - Verified `tools/tasks.ts` ledger across all branches: zero new non-`agy` events since `2026-11-18T19:08:15-08:00`, zero new `approve-plan` events on `agy` proposed tasks `T-0224..T-0296`. Next free task ID was **`T-0297`**.
2. **Completed Live Multi-Biome Remote Ground Landings, `?autoplay=1` Boot Hang, Ground Time Dial & `Save -> Continue` Audit — `T-0297` (PR `#558`):**
   - Captured live headless Microsoft Edge evidence on temporary `agy` Vite port `5264` (`0` console/page errors, browser & Vite cleanly stopped in `finally`): `recording.webm` (`69,692 B` VP8 WebM), `5` live PNG frames (`frame-0-sahara-ground-landing.png`, `frame-1-greenland-ice-landing.png`, `frame-2-pacific-ocean-landing.png`, `frame-3-autoplay-visit.png`, `frame-4-time-dial-save-continue.png`), `live-capture.json`, and `3` matched documentary natural references (`ref-0-sahara-desert-ground-noon.jpg`, `ref-1-greenland-ice-sheet-noon.jpg`, `ref-2-open-pacific-ocean-horizon-noon.jpg`).
   - Proved calibrated Rule 11 script `refs/audit/live-multibiome-autoplay-dial-save-audit/audit.ts` -> `numbers.json` (`calibrationValid = true`, `0 / 4` pass `>= 0.95`, `meanScore = 0.0000`) covering four untouched live end-to-end defects:
     - **Remote multi-biome ground landings**: `grass.ts` never clears cached blade tiles on `SITE` / `tierChanged` -> switching from Greenland (`+2.5 m`) to Pacific Ocean (`-0.2 m`) leaves a literal **`+2.7 m` floating green grass wall filling `59.61%` of the upper Pacific sky** (`frame-2`); `waterAt()` (`src/core/needs/water.ts:11`) queries Kenora's staged lake (`lakeAt(1400, 0, 0)`) without `!SITE.remote` and allows saltwater ocean -> glowing cyan wading ripples + `E / click · drink` in dry Sahara (`frame-0`), on Greenland Ice (`frame-1`), and on `35 PSU` open Pacific (`frame-2`); Greenland `3,000 m` ice sheet shows **`0.00%` snow/ice** (`84.70%` dark-green meadow, `Snow 0.0 cm`); Sahara shows `32.79%` dark-green grass & boreal spruces; all three spawn `5` wolf pups + `5` snowshoe hares.
     - **Live `/?autoplay=1` hang**: hung **`>57.8 s`** on `#loading` `"Ready"` (`stepCount = 1`, `done = false`, `frame-3`) because `main.ts:815` runs `inpage.prewarm()` *after* `startup()` sets `"Ready"` (`100%`), `startView('?autoplay=1')` returns `'ground'` (dropping `stages=1&trees=v2`), and `autoplay.ts:110` disables `stuck(run)` while `#loading` exists.
     - **Ground Time Dial (`hold ,` / `hold .` / `;`)**: continuous `2.2 s` `,` hold traps `worldClock.ts:267` `detentDir` forever at **`dial = -0.0100` (`-1.000×`)** vs expected `-0.1860`; `#status` (`main.ts:797`) shows zero rate/rewind indicator (`08:06 -> 08:01` silently backwards); `loadClock()` credits **`+60 s`** forward `offlineSec` to paused/rewinding saves.
     - **`Esc -> Save` -> Reload -> `Continue` reset**: `captureResume()` (`main.ts:516`) bails on `!hasSeenBigBang(context)`, dropping `savedEvents.resume` on explicit `Save` so `Continue` teleports the player **`5.919 m`** and **`156.5°`** back to spawn (`frame-4`) and never persists remote `SITE` coordinates.
   - Verified UTF-8 no-BOM event JSON, `npx tsc --noEmit` (exit `0`), and board/guardrail tests (`25/25` pass, `0` new rule breaks).
   - Committed (`d311e07b`) on `agy/t0297-propose` (`C:\dev\boreal-agy-t0297`), pushed to `origin`, opened **PR `#558`**, and merged into `agy/loop`.

## Exact Next Step
- On the next hourly run:
  1. Run Step 0 review first (`git fetch --all --prune`, check open PRs `#413`, `#414`, `#448`, `#449` and any new PRs or non-`agy` tasks/events across all branches).
  2. If any `agy` proposed task (especially high-impact quick-win `T-0297`, `T-0296`, `T-0295`, `T-0294`) receives a non-author `approve-plan`, claim it immediately on a dedicated `agy/<topic>` branch and implement + verify with calibrated gates!
  3. Otherwise inspect the next untouched live end-to-end flow (e.g. live active wolf hunting/stalking/locking/pouncing/eating/releasing snowshoe hares + pushing rocks/gathering herbs/speaking to Visitors + Pause Menu `More -> Render settings / Appearance / Play as / Planet view` round-trips) and propose **`T-0298`**.

## Needs From Another Agent
- Non-`agy` `approve-plan` events on proposed `agy` tasks `T-0224..T-0253`, `T-0257`, `T-0260`, `T-0263..T-0297`.
- Merge of board-only PR `#558` (`agy/t0297-propose`) into `main`.
- Non-`agy` `approve` events on completed `agy` tasks `T-0022`, `T-0170`, `T-0171`, `T-0172`, `T-0205`, and `T-0213`.
