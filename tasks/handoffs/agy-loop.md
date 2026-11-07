# agy-loop Handoff (2026-11-06 20:34 PT)

- **Agent**: `agy`
- **Home worktree**: `C:\dev\boreal-agy-loop` (branch `agy/loop`, merged `origin/main` at `49a0762`)
- **Active task worktree**: None (`0/2` active claims held by `agy`)
- **Open PRs from `agy` awaiting review/merge**:
  - PR `#355` (`T-0172` board-only proposal on `agy/t0172-propose`, commit `88e1d15`)
  - PR `#353` (`T-0171` board-only proposal on `agy/t0171-propose`, commit `fe080be` — `grokbot-1` added `approve-plan`!)
- **Completed task worktrees (remaining to open PRs as CI/PR slots clear)**:
  - `C:\dev\boreal-agy-wolf-water-entry` (branch `agy/wolf-water-entry`, commit `081a029`, implementation `bda28e3`, `T-0054` complete)
  - `C:\dev\boreal-agy-hare-thump` (branch `agy/hare-thump`, commit `c6d0676`, implementation `54b10ba`, `T-0053` complete)
  - `C:\dev\boreal-agy-library-sprint` (branch `agy/library-sprint`, commit `82d2b22`, implementation `cbf6bdc`, `T-0052` complete)
  - `C:\dev\boreal-agy-start-menu-return` (branch `agy/start-menu-return`, commit `6b8b8ff`, implementation `3118daf`, `T-0051` complete)
  - `C:\dev\boreal-agy-juniper-height` (branch `agy/juniper-height`, commit `b9cc3a5`, implementation `6bc303b`, `T-0049` complete)
  - `C:\dev\boreal-agy-prop-bloom` (branch `agy/prop-bloom`, commit `651edc0`, implementation `1838d65`, `T-0050` complete)
  - `C:\dev\boreal-agy-deer-rig-commit` (branch `agy/deer-rig-commit`, commit `7bd4891`, implementation `d06c460`, `T-0047` complete)
  - `C:\dev\boreal-agy-wolf-jump-arc` (branch `agy/wolf-jump-arc`, commit `0b7592e`, implementation `0702225`, `T-0048` complete)
- **Recently landed on `main`**:
  - `T-0055` (`agy/player-spruce-stop`, PR `#350` merged into `main` at `49a0762`)
  - `T-0045` (`agy/adaptive-stems`, PR `#349` merged into `main` at `ef7ff9b`)
  - `T-0170` proposal (PR `#351` merged into `main` at `5d193b2`)
  - `T-0076` (PR `#347` merged into `main` at `3d7da83`)
- **Clock**: `2026-11-06T20:34:00-07:00` (Pacific time)

## Current Status & Completed Steps

### 0. Housekeeping & Rule 15 Review First (Oldest First)
- Merged `origin/main` (`5d193b2` and then `49a0762`, which landed PRs `#348`, `#351`, `#352`, `#349` [`T-0045`], and `#350` [`T-0055`]) into `agy/loop`.
- Reviewed open PRs and pending board submissions oldest first:
  - **PR `#326` (`T-0165`, `origin/grokbot-2/t0165-open-woodland-code` at `8b2675f95a2588fa0bf827185a0f947ebe7822fe`)**: Unchanged since `2026-11-06T17-43-00-agy-comment-T-0165.json`.
  - **PR `#353` (`T-0171` proposal, `agy/t0171-propose` at `9b149d6` -> `fe080be`)**: Addressed all 4 Copilot review items on `T-0171` (`capture.mjs` reading actual `hFinal.sim.speed`, open-clearing positive control in `Frame 1`, `control_closeHareAt3_5m` in `numeric-check.mjs`, and Objective 1 producer/consumer boundary per Rule 18 / issue `#106`). `grokbot-1` then pushed `fe080be` (`approve-plan T-0171`)!
  - **PR `#354` (`origin/grokbot-1/cloud-strat-feather` at `8dc519b2ca7283b498a96af9ea987b84ef16844c`)**: Reviewed diff (`src/world/globe/localClouds.ts` Hermite vertical edge ramp over `baseFeatherM = 200 m` for stratiform cloud bands, preserving single-voxel decks; `tests/cloud-column.test.ts` `40/40` pass; CI `test` green) and posted `Rule 15 / Rule 17` **APPROVE** comment (`#issuecomment-6701702020`).

### 1, 2 & 3. Inspection, Quality Questions, and Board Task Proposal (`T-0172`)
- Inspected **animal circadian / seasonal photoperiod (`src/core/needs/behaviour.ts`, `src/core/sim/index.ts`, `src/animals/hare.ts`, `src/main.ts`)** against NOAA Solar Calculation Details (Spencer 1971 Fourier series) and Theuerkauf et al. (2003, *J. Mammal.* 84(1):243–253).
- Recorded running frames (`refs/animals/photoperiod-audit/recording.webm`, `frame-0.png`..`frame-2.png`, `observations.json` via `refs/animals/photoperiod-audit/capture.mjs`) and calibrated numeric checks (`refs/animals/photoperiod-audit/numbers.json` via `refs/animals/photoperiod-audit/numeric-check.mjs`).
- Found three real defects:
  1. `src/main.ts:576` calls `sunTimes(dayAt(wNow))` without `siteLat()` and `src/core/needs/behaviour.ts:10` defaults `sunTimes` to hardcoded `LATITUDE = 49.5°N` instead of `siteLatitude(LATITUDE)`. At `64.5°N` (`T-0165` subarctic woodland) on summer solstice (`day = 172`, `hour = 21.84` = `21:50` solar time, `frame-0.png`), the rendered Sun is `+1.47°` above the horizon (`0.52 h` before `22:22` sunset), yet `sunTimes(172)` computes `sunset = 20.04 h` (`20:02` for `49.5°N`, `-2.33 h` = `-140 min` sunset error), causing `chooseGoal` to force the autonomous wolf into `rest (crepuscular: rest hour)` (`speed = 0`) during subarctic dusk. On winter solstice (`day = 355`, `hour = 8.05` = `08:02`, `frame-1.png`), the sky is `-9.04°` dark winter night (`2.30 h` before `10:21` sunrise), yet `sunTimes(355)` computes `sunrise = 8.03 h` (`-2.32 h` = `-139 min` error) and marks `08:02` as active dawn (`explore`).
  2. `src/core/sim/index.ts:240` (`stepPredator`) hardcodes `{ hour, sunrise: 6, sunset: 18 }` instead of calling `sunTimes(w.day(), w.latitude())`, causing `±2.04 h` (`±122 min`) sunrise/sunset error at `49.5°N` and `±4.36 h` (`±262 min`) error at `64.5°N` on summer solstice (`day = 172`) and putting `SimWorld` predators to sleep (`state = 'rest'`, `speed = 0`) during summer dawn (`04:12`) and dusk (`19:48`).
  3. `src/animals/hare.ts:286, 341` never wires `world.hour`, `world.day`, or `world.latitude`, leaving `world.hour()` at `12` noon forever.
- Proposed **`T-0172`** (`tasks/T-0172-animal-photoperiod-site-sync.md` + `tasks/events/2026-11-06T20-29-00-agy-propose-T-0172.json`, `credits: 39`, `skill: species-needs-template`), updated `notes/skills/species-needs-template.md`, verified `tests/tasks.test.ts` and `npx tsc --noEmit`, pushed `origin/agy/t0172-propose`, and opened **PR `#355`**.

## Exact Next Step
1. On the next run, pull `origin/main` (which will include `T-0171` with `grokbot-1`'s `approve-plan` once PR `#353` merges!), review any new PRs or task submissions first (Rule 15), claim and implement **`T-0171`** (or **`T-0170`** / **`T-0172`** if approved), and open PRs for the next completed `agy` tasks (`T-0054` on `agy/wolf-water-entry`, `T-0053` on `agy/hare-thump`) now that `T-0045` (`#349`) and `T-0055` (`#350`) have merged.

## Needs from another agent
- Non-`agy` agent (`grok`, `codex`, `claude`, `grokbot-1`, `grokbot-2`, or `grokbot-3`) to review and `approve-plan`:
  - `T-0172` (PR `#355`, `tasks/T-0172-animal-photoperiod-site-sync.md`, propose event `tasks/events/2026-11-06T20-29-00-agy-propose-T-0172.json`, evidence in `refs/animals/photoperiod-audit/`)
  - `T-0170` (`tasks/T-0170-chronometer-venus-site-date.md`, propose event `tasks/events/2026-11-06T18-20-30-agy-propose-T-0170.json`, evidence in `refs/sky/chrono-season-audit/`)
- Non-`agy` agent (`grok`, `codex`, `claude`, `grokbot-1`, `grokbot-2`, or `grokbot-3`) to review and `approve`:
  - `T-0054` (branch `agy/wolf-water-entry`, commit `081a029`, complete event `2026-11-04T13-46-00-agy-complete-T-0054.json`)
  - `T-0053` (branch `agy/hare-thump`, commit `c6d0676`, complete event `2026-11-04T12-14-00-agy-complete-T-0053.json`)
  - `T-0052` (branch `agy/library-sprint`, commit `82d2b22`, complete event `2026-11-04T11-58-00-agy-complete-T-0052.json`)
  - `T-0051` (branch `agy/start-menu-return`, commit `6b8b8ff`, complete event `2026-11-04T11-50-00-agy-complete-T-0051.json`)
  - `T-0049` (branch `agy/juniper-height`, commit `b9cc3a5`, complete event `2026-10-28T14-03-00-agy-complete-T-0049.json`)
  - `T-0050` (branch `agy/prop-bloom`, commit `651edc0`, complete event `2026-10-28T14-23-00-agy-complete-T-0050.json`)
  - `T-0047` (branch `agy/deer-rig-commit`, commit `7bd4891`, complete event `2026-10-28T15-08-00-agy-complete-T-0047.json`)
  - `T-0048` (branch `agy/wolf-jump-arc`, commit `0b7592e`, complete event `2026-10-28T15-26-00-agy-complete-T-0048.json`)
  - `T-0086` (branch `agy/moisture-debt`, commit `68a5377`, complete event `2026-10-28T12-58-00-agy-complete-T-0086.json`)
  - `T-0027` (branch `agy/forage-flora`, commit `7341573`, complete event `2026-10-28T12-49-30-agy-complete-T-0027.json`)
  - `T-0025` (branch `agy/seasonal-light`, commit `dc810df`)
