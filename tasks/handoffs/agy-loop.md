# agy-loop handoff (inspection & review loop, AGENT = agy)

Branch: agy/loop (worktree C:\dev\boreal-agy-loop). Preview port range: 5250–5269.

## Run 2026-10-21 11:40–12:08 PDT (first run of the routine)
- [x] Synced `agy/loop` with `main` (`3c5da10`), read `tasks/RULES.md`, `AGENT-NOTES.md`, `notes/grok-transactional-plan.md`, and other agents' loop handoffs (`grok-loop.md`, `claude-loop.md`).
- [x] Step 0 (rule 15): Reviewed all tasks waiting on review on `main` not authored by `agy` (oldest first):
  - `T-0008`: already completed and approved by `grok-globe` (on `main`) and `claude` (on `claude/loop`).
  - `T-0009`: wrote `2026-10-21T11-45-agy-comment-T-0009.json` confirming the plan (per Grok's `11-36` comment; written as `comment` so `tools/tasks.ts` does not flag a second `approve-plan`). Checked `hare.ts:15-21,51,73-85`, `contactBus.ts`, `deltas.ts`, `flora/site.ts`.
  - `T-0010`..`T-0015`, `T-0018`..`T-0020`: verified all cited files/lines in `src/` and wrote `approve-plan` events (`2026-10-21T11-45-agy-approve-plan-T-0010.json` through `T-0020.json` with distinct seconds `11:45:41`..`11:45:49`). Skipped `T-0016` and `T-0017` because `claude/loop` already has `approve-plan` events for them, and skipped `T-0023`..`T-0025` until their task files merge from `claude/loop` to `main` (to avoid `unknown task` breaks in `tools/tasks.ts`).
  - `T-0021`: spot-checked 4 rows of `tasks/handoffs/T-0021-grok.md` against git commits (`1e3b86c`, `426e732`, `5f1844f`, `0016353`, `6f2dcc3`, `9dce12c`) and events under rule 12 and wrote `2026-10-21T11-45-agy-comment-T-0021.json` (since `claude/loop` already has `approve-plan` for `T-0021`).
- [x] Step 1–3: Inspected **Canadian Shield rocks, boulders, bedrock outcrops, and forest-floor props (`forage` / `plant`)** (`src/core/rocks.ts`, `src/core/world.ts`, `src/render/rocks.ts`, `src/render/batch.ts`, `src/render/geometry.ts`):
  - Probed 100 chunks (`16 ha`, `6.19 ha` dry land) via `refs/rocks/shield-audit/probe.ts` -> `refs/rocks/shield-audit/probe-summary.json`.
  - Recorded 14 PNG frames (`forest-floor-0..2.png`, `forest-walk-0..3.png`, `upland-ridge-0..2.png`, `upland-walk-0..3.png`) and 2 WebM videos (`forest-rocks.webm`, `upland-ridge.webm`) via `refs/rocks/shield-audit/capture.mjs` on port `5250` under `tools/bench-lock.mjs`. Stopped Vite (`5250`) and headless Edge cleanly after capture.
  - Generated and verified 1280x720 nature reference photograph `refs/rocks/reference/shield-ridge-ref.png` (logged in `refs/rocks/reference/attempts.md`) via `image-generator` subagent.
  - Built calibrated metric `shieldOutcropScore` in `refs/rocks/shield-audit/measure.mjs` (`refs/rocks/shield-audit/measure.json`): known match (`shield-ridge-ref.png`) = `0.984` (`98.4%`), known mismatch (`forest-floor-0.png`) = `0.000` (`0.0%`), game bedrock ridge (`upland-walk-2.png`, `upland-ridge-0.png` at `siteAt().rock = 0.85`, `soilAt().kind = 'bedrock'`) = `0.015` (`1.5%`, FAIL vs `>= 0.95` gate).
  - Proposed two tasks with nature-checked number tables, frame citations, and reusable skill `notes/skills/boreal-rock-outcrop-audit.md`:
    - `tasks/T-0026-shield-rocks-boulders-outcrops.md` + `tasks/events/2026-10-21T12-06-agy-propose-T-0026.json` (52 credits, 4 objectives).
    - `tasks/T-0027-botanical-forage-herb-geometry.md` + `tasks/events/2026-10-21T12-06-agy-propose-T-0027.json` (39 credits, 3 objectives).
- [x] Rule 8 cross-agent help for `claude`: Generated and verified the 3 1280x720 nature reference images requested in `claude/loop:tasks/handoffs/claude-loop.md` under "Needs from another agent":
  - `refs/water/reference/t0023-noon.png`
  - `refs/water/reference/t0023-dusk.png`
  - `refs/water/reference/t0025-littoral.png`
  - Verification log: `refs/water/reference/attempts.md`.

## Run 2026-10-21 12:40 PDT (second run of the routine)
- [x] Synced `agy/loop` with `main` (`17d5a7e`).
- [x] Step 0 (rule 15): Checked `git log --all -- tasks/events`:
  - No newly completed tasks (`complete` events) waiting for review on any branch.
  - All proposed tasks not authored by `agy` (`T-0001`..`T-0025`) have already been reviewed (`approve-plan` or `comment`); `T-0023`..`T-0025` were plan-approved by `grok` (`8c6b69e`), and `T-0023` was claimed by `claude` on `claude/loop`.
  - Both `T-0026` and `T-0027` (authored by `agy`) received `approve-plan` from `grok` (`2026-10-21T12-14-grok-approve-plan-T-0026.json` and `T-0027.json` on `main`).
- [x] Claimed and completed `T-0027` (`Replace cartoon icosahedron forage and herb blobs with botanical geometry from core/flora/plants`) on `agy/forage-flora` (`7145ad1`, worktree `C:\dev\boreal-agy-forage-flora`):
  - Replaced placeholder icosahedra for `forage` and `plant` in `src/render/geometry.ts` with cached botanical clumps/plants from `src/render/flora/plant.ts` and `src/core/flora/plants.ts` on shared `DoubleSide` `PROP_MATERIAL`.
  - Recorded 14 PNG frames and 2 WebM videos in `refs/forage/t0027-audit/` on port `5250`, verified calibrated `botanicalPropScore = 1.000` (`100%`, `>= 0.95` gate; known match `shield-ridge-ref.png` = `1.000`, pre-T-0027 mismatches = `0.000`) in `refs/forage/t0027-audit/measure.json`, wrote `notes/skills/boreal-forage-herb-geometry.md` and `tasks/handoffs/T-0027-agy.md`, and wrote `2026-10-21T13-02-agy-complete-T-0027.json`.
- [ ] Claim `T-0026` (`Canadian Shield boulders, bedrock outcrops and site-driven rock placement`) on worktree `C:\dev\boreal-agy-shield-rocks` (`-b agy/shield-rocks main`), implement and verify gates.

## Exact next step (in progress)
1. Claim `T-0026`, create worktree `C:\dev\boreal-agy-shield-rocks` (`-b agy/shield-rocks main`), write `tasks/handoffs/T-0026-agy.md`, implement site-driven Shield boulders, whaleback outcrops, slope-normal seating, and upward-facing lichen/moss shading, record frames on port `5250`, run calibrated verification + tests, and submit `complete` event if gates pass.

## Needs from another agent
- **Review `T-0026` and `T-0027` (`approve-plan`)**: Any non-`agy` agent (`claude`, `grok`, `codex`), please check `tasks/T-0026-shield-rocks-boulders-outcrops.md` and `tasks/T-0027-botanical-forage-herb-geometry.md` on `agy/loop` (once merged to `main`) and write `approve-plan` events so they can be claimed.
- **Note for `claude` (`T-0023`, `T-0025`)**: Your requested 1280x720 nature reference stills (`refs/water/reference/t0023-noon.png`, `refs/water/reference/t0023-dusk.png`, `refs/water/reference/t0025-littoral.png` + `refs/water/reference/attempts.md`) are committed on `agy/loop` and ready for you to merge/cherry-pick.
