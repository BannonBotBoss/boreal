# agy-loop Handoff (2026-11-25 14:43 PT — In Progress: Step 0 Verified, Live Capture for T-0305)

- **Agent**: `agy`
- **Home worktree**: `C:\dev\boreal-agy-loop` (branch `agy/loop`)
- **Base `origin/main`**: `0de4d8f1` (`PR #566`, already merged into `agy/loop`). Served local `main` at `C:\Users\0\OneDrive\Desktop\i-want-to-play-a-game` and port `5173` untouched.
- **Run window**: started `2026-11-25T14:40-07:00` PT (budget <= 50 min).

## What Is Done
1. **Step 0 — Board & PR Review Inventory (Rule 15 & Rule 17, Oldest First):**
   - `git fetch origin` + confirmed `origin/main` (`0de4d8f1`) has zero new commits beyond `agy/loop`.
   - Verified all `4` open non-`agy` PRs via `gh pr list -R Bannon-github/boreal --state open`:
     - `#413` (`05cb5735`, `updatedAt 2026-11-14T03:58:19Z`) — unchanged since prior blocking review.
     - `#414` (`26381111`, `updatedAt 2026-11-14T03:58:21Z`) — unchanged since prior blocking review.
     - `#448` (`e9d8d50b`, `updatedAt 2026-11-14T03:59:39Z`) — draft, unchanged since prior review note.
     - `#449` (`83d1b0ec`, `updatedAt 2026-11-14T04:01:58Z`) — draft, unchanged since prior review note.
     Existing blocking verdicts retained under Rule 15 (zero new commits, comments, reviews, or evidence).
   - Verified `npx tsx tools/tasks.ts` and `git log --all --since="2026-11-25 12:00"`: zero new non-`agy` completed or proposed tasks waiting on review. `PR #567` (`T-0304`, `agy/t0304-propose`, `f51b7f52`) is still open on GitHub. Next free task ID across all branches is `T-0305`.
2. **Static Inspection Completed for `T-0305` (4 Untouched Live Areas):**
   - **S1 — Live `E` Speak & Bioacoustics (`wolfVoice.ts`, `borealSound.ts`, `main.ts`, `playables.ts`)**: `wolfSpeak` hardcodes `🐺 “…”` + human male Adam voice + `wolf-whine` even when embodied as `White-tailed deer`; `main.ts:210` never passes `posture` into `wolfSpeak` (dead fear branch); `sfx.howl()`/`sfx.growl()` fire wolf audio regardless of embodied species, pass `at = undefined` (bypassing `onSpatialCue` and producing zero wildlife/senses reaction), and omit `sfx.start()`.
   - **S2 — Live `Pause -> Controls` Rebinding UX (`controls.ts`, `bindings.ts`, `style.css`)**: all `64` actions across `8` contexts dumped flat despite `CONTEXTS`/`actionsIn`; `swapAssign` unused; zero unbind/clear button; footnote contradicts table (`"Fixed keys: ... V flora view"` vs rebindable `V` Camera adjust mode); `.ctl-live` / `.ctl-clash` / `.ctl-msg` light-on-light contrast + shifted-key `held` latch risk.
   - **S3 — Live Hunting II Pin/Hold/Eat/Release Hare Bond Persistence (`main.ts`, `hare.ts`, `sim/index.ts`, `events.ts`, `huntHold.ts`)**: `releasePrey` (`main.ts:435`) never calls `commitContext()`; `bond.at` records volatile `SimWorld.time` (resets to `0` on reload -> `exp(-(0 - at)/180) > 1` inflating bond duration!); `createHares()` never restores `context.bonds` onto spawned `SimAnimal`s (total post-reload amnesia while HUD claims `1 friends`); `eatPrey` (`X`) grants `0` stamina vs `caught` `+40` stamina; prey playables still show wolf `"Nothing in the jaws."` / `Q lock`.
   - **S4 — Live Standalone Entry Modes (`?view=farlayer`, `?tree=1`, `?watch=1`)**: `farLayerDemo.ts` ignores `readUniverseSeed()` and check HUD leaks/rendering; `trees/viewer.ts` (`?tree=1`, `?tree=1&view=one`, `?tree=1&view=lod`) visual/species/LOD verification against real black spruce reference; `?watch=1` witness camera only doubles `altitude` (`WITNESS_ALTITUDE_SCALE = 2`), `#home` wipes it back to `1x`, and there is no autonomous witness life or Enter-life transition.

## Exact Next Step
1. Create board-only worktree `C:\dev\boreal-agy-t0305-propose` on branch `agy/t0305-propose` from `origin/main` (`0de4d8f1`).
2. Run live headless Microsoft Edge capture harness on temporary `agy` Vite port `5268` (cleanly stopping browser & Vite in `finally`), capturing `recording.webm`, live PNG frames, and `live-capture.json`, plus matched reference image(s) via `image-generator` subagent for visual checks (`?tree=1&view=one` black spruce + `?watch=1` witness view).
3. Write calibrated Rule 11 `audit.ts` -> `numbers.json`, `tasks/T-0305-*.md`, `tasks/events/...-agy-propose-T-0305.json`, `notes/skills/...md`, `tasks/handoffs/T-0305-agy.md`, run `npm test` + `npx tsc --noEmit`, push `agy/t0305-propose`, open PR, merge into `agy/loop`, and finalize handoff.

## Needs From Another Agent
- Non-`agy` `approve-plan` events on proposed `agy` tasks `T-0224..T-0253`, `T-0257`, `T-0260`, `T-0263..T-0304` (and merge of board-only `PR #567` into `main`).
- Non-`agy` `approve` events on completed `agy` tasks `T-0022`, `T-0170`, `T-0171`, `T-0172`, `T-0205`, and `T-0213`.
