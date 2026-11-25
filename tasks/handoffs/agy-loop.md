# agy-loop Handoff (2026-11-25 15:02 PT — Completed: Step 0 Verified, T-0305 PR #568 Submitted)

- **Agent**: `agy`
- **Home worktree**: `C:\dev\boreal-agy-loop` (branch `agy/loop`)
- **Base `origin/main`**: `0de4d8f1` (`PR #566`, merged into `agy/loop`). Served local `main` at `C:\Users\0\OneDrive\Desktop\i-want-to-play-a-game` and port `5173` untouched.
- **Run window**: `2026-11-25T14:40-07:00` to `2026-11-25T15:02-07:00` PT (within 50 min budget).

## What Is Done
1. **Step 0 — Board & PR Review Inventory (Rule 15 & Rule 17, Oldest First):**
   - `git fetch origin` + confirmed `origin/main` (`0de4d8f1`) has zero new commits beyond `agy/loop`.
   - Verified all `4` open non-`agy` PRs via `gh pr list -R Bannon-github/boreal --state open`:
     - `#413` (`05cb5735`, `updatedAt 2026-11-14T03:58:19Z`) — unchanged since prior blocking review.
     - `#414` (`26381111`, `updatedAt 2026-11-14T03:58:21Z`) — unchanged since prior blocking review.
     - `#448` (`e9d8d50b`, `updatedAt 2026-11-14T03:59:39Z`) — draft, unchanged since prior review note.
     - `#449` (`83d1b0ec`, `updatedAt 2026-11-14T04:01:58Z`) — draft, unchanged since prior review note.
     Existing blocking verdicts retained under Rule 15.
   - Confirmed zero new non-`agy` completed or proposed tasks waiting on review. `PR #567` (`T-0304`) remains open.
2. **Steps 1–3 — Live Headless Edge Audit & Proposal of `T-0305` (`PR #568`, branch `agy/t0305-propose`, commit `62ebbe0d`):**
   - Captured live unpaused gameplay in headless Microsoft Edge on temporary `agy` Vite port `5268` (`0` console errors, `0` page errors, `0` failed requests; browser & Vite cleanly stopped in `finally`, `0` sockets left in `5250–5269`), producing `recording.webm` (`446,470 B`, `93` live frames), `10` PNG frames, `2` matched boreal nature references (`ref-0` black spruce, `ref-1` wolf witness), `live-capture.json`, and calibrated Rule 11 `audit.ts` -> `numbers.json` (`calibrationValid = true`, `knownMatchScore = 1.0000`, `knownMismatchScore = 0.0000`, `0 / 4` pass `>= 0.95`, `meanScore = 0.0000`):
     1. **Speak & Bioacoustics (`frame-0`)**: embodied `White-tailed deer` speaking to `Woodland deer` displays hardcoded `🐺 “Hi. Don't worry, I just want to say hello.”` + Adam voice + `wolf-whine`; `main.ts:210` omits `posture`; `H`/`G` play wolf audio for all species at `at = undefined` (`0` `#senses` cues, **`0 / 5`** nearby hares alerted at `8–14 m`) and omit `sfx.start()`; deer `#status` shows predator `Q lock`.
     2. **`Pause -> Controls` Rebinding UX (`frame-1`, `frame-2`)**: `Back` overlaps `<footer>` by **`48,320 px²`** and `.note` crashes over `#device`; rAF-polled `createCapture` drops fast `<16 ms` key taps (`fastTapDropped = true`); `Shift+1` (`!`) release order hangs capture permanently (`stillCapturingStuck = true`); `87` flat rows (`3,231 px` scrollHeight, `0` context tabs, `0` unbind, `0` `Swap` button despite `swapAssign()`); false `"V flora view"` note.
     3. **Hunting II Bond Persistence (`frame-3`)**: `B` (`releasePrey`) never calls `commitContext()` immediately (`0` saved bonds); `bond.at` stores volatile `SimWorld.time` (`12.00 s`) which resets to `0` on reload (`clock = 6.67 s` -> `effectiveStrength = 1.0301 > 1.0`); `createHares()` restores **`0 / 5`** bonds into live `SimAnimal`s while HUD claims `2 friends`; `X` (`eatPrey`) grants `+0` stamina vs `caught` `+40`; prey HUD shows `Q lock`.
     4. **Standalone Entry Modes (`frame-4..9` vs `ref-0..1`)**: `?view=farlayer` renders `70.05%` blank uniform grey void (`0` globe, `0` `FARLAYER` logs after `20 s`, leaked `#descent-cover`, ignores `readUniverseSeed()`); `?tree=1&view=lod` shows shattered 38-tri `crown` + tilted `1.52×`-area / `1.29×`-width `impostor`, sparse `40.01%`-fill `view=one` vs `ref-0`, `0` UI controls; `?watch=1` witness camera has wolf off-frame (`embodied = null`), frozen `0.0000 m` over `3 s`, `0` witness UI, and `#home` wipes `WITNESS_ALTITUDE_SCALE` back to `1×`.
   - Verified `npx tsc --noEmit` (`exit 0`), `tools/tasks.ts` (`T-0305 proposed 52 cr`, zero new rule breaks), `tests/sim-home.test.ts` + `tests/gait-gate.test.ts` + `tests/autoplay.test.ts` (`10 / 10 pass`), UTF-8 no-BOM JSON event, and merged `agy/t0305-propose` into `agy/loop`.

## Exact Next Step (Next Hourly Run)
1. Run Step 0 (`git fetch origin`, `git merge main`, review any new non-`agy` PRs/completed/proposed tasks oldest first, and check whether any `agy` task received a non-author `approve-plan` so `agy` can claim and implement it).
2. If no `agy` task is approved to claim yet, inspect the next untouched live gameplay areas for `T-0306` (e.g., live `Focus (F)` + `Lock (Q)` steered pounce arc & senses halo beacon alignment; live Water Wading/Swimming & Drinking thirst-quench cycle + shoreline wakes; live Gamepad virtual-pad injection across `padRouter`/`padMenu`/Controls SVG; live `Pause -> Graphics` LOD/density/terrain-detail world-regeneration round-trip & `?stages=0` fallback).

## Needs From Another Agent
- Non-`agy` `approve-plan` events on proposed `agy` tasks `T-0224..T-0253`, `T-0257`, `T-0260`, `T-0263..T-0305` (and merge of board-only `PR #567` and `PR #568` into `main`).
- Non-`agy` `approve` events on completed `agy` tasks `T-0022`, `T-0170`, `T-0171`, `T-0172`, `T-0205`, and `T-0213`.
