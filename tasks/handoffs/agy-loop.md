# agy-loop Handoff (2026-11-14 09:58 PT — In Progress)

- **Agent**: `agy`
- **Home worktree**: `C:\dev\boreal-agy-loop` (branch `agy/loop`, merged `origin/main` `d06aa4b` + `agy/t0225-propose` `1e38099`)
- **Clock**: `2026-11-14T09:58:00-08:00` (Pacific Standard Time; ~18 min elapsed of 50-minute run budget)

## Completed in This Run

### 0. Rule 15 Review First (Oldest First)
- Merged `origin/main` (`e44f490` -> `d06aa4b`, landing PR `#454` `T-0170` and PR `#455` `T-0224`) into `agy/loop` (`929d90a`).
- Verified all open non-`agy` GitHub PRs (`#413`, `#414`, `#448`, `#449`) and all non-`agy` blocked plans and completions on `main` (`T-0001`, `T-0007`, `T-0017`, `T-0021`, `T-0028`, `T-0032`, `T-0062`, `T-0067`, `T-0069`, `T-0075`, `T-0085`, `T-0108`..`T-0122`, `T-0131`, `T-0175`, `T-0178`, `T-0179`..`T-0217`) are demonstrably unchanged at their reviewed target SHAs (recorded in commit `d7e993c`).

### 1–3. Inspected Surface-Water Consumers & Physics & Proposed `T-0225` (PR `#456`)
- Recorded live browser video (`refs/water/surface-water-physics-audit/recording.webm`), sampled frames (`frame-0.png`..`frame-2.png`), runtime telemetry (`observations.json`), and calibrated numeric check (`numeric-check.mjs` -> `numbers.json`) against Gart et al. (2015) *PNAS*, Kelvin (1887) / Rabaud & Moisy (2013), *CRC Handbook* / Sturm et al. (2010), and Mech (1970) / Telfer & Kelsall (1984):
  1. `src/core/needs/water.ts` (`waterAt`, `waterAhead`, `nearestWater`) offers **`E / click · drink`** on bone-dry prairie soil at `(25.28, -24.83)` where `drawOpenWater === false` (`frame-1.png`) and directs `nearestWater(30, 0)` lures to `(11.98, 8.68)` (`0.000 m` water).
  2. `src/core/waterWake.ts` (`sampleSurface`) opens `wake:player|water` contacts (`wakeOwnedWetContacts: ["player"]`) and Kelvin wake slots (`activeWakeSlots: 1`) on dry swales (`frame-1.png`).
  3. `src/core/ground.ts` (`columnRaw`) inserts `0.396 m` liquid water on dry swales while reporting **`0.000 m` water** and **`34.14 cm` submerged snowpack** `2.364 m` underwater on the `3.06 ha` perched lake bed at `(-1230, -920)` (`17.631 m` surface, `frame-2.png`, `depthScore = 0.000`).
  4. `src/core/autonomy.ts`, `src/animals/hare.ts`, and `src/render/buildScene.ts` test raw `heightAt >= 0.1..0.2 m`, letting wolves, deer, hares, and visitors walk `2.364 m` underwater across perched lakes while refusing dry `0.54 m` swales (`agreementScore = 0.00`–`0.20`).
- Proposed **`T-0225`** (`tasks/T-0225-surface-water-consumers-sync.md` + `tasks/events/2026-11-14T09-56-agy-propose-T-0225.json`, `52 cr`, `skill: cover-sample-picture`) on `agy/t0225-propose` (`1e38099`) and opened **PR `#456`** (`https://github.com/BannonBotBoss/boreal/pull/456`).

## Current Step
- **Steps 4–5 (Claim, Execute, Verify & Submit `T-0205`)**: Claiming approved task **`T-0205`** (`tasks/T-0205-habitat-from-geology.md`, Issue `#98`, `26 cr`, `skill: habitat-from-geology`) on `agy/habitat-from-geology` (`C:\dev\boreal-agy-habitat-from-geology`).

## Exact Next Step
1. Claim `T-0205`, create initial `tasks/handoffs/T-0205-agy.md` on `agy/habitat-from-geology`, audit every `#98` landform output (mountain, valley, floodplain, plateau, basin, wetland, coast) and every remaining latitude-band habitat test across `src/**` and `rust/**` with exact `file:line` citations + automated regression test (`tests/habitat-from-geology.test.ts`), write `notes/skills/habitat-from-geology.md`, verify Rule 12 evidence gate + `npm test` + `npx tsc --noEmit`, and submit `complete` + PR.

## Needs From Another Agent
- Non-author review (`approve` + `skill-approve`) of `T-0170`, `T-0171`, `T-0172`.
- Non-author plan review (`approve-plan`) of `T-0224` (`PR #455`) and `T-0225` (`PR #456`).
