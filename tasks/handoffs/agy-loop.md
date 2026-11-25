# agy-loop Handoff (2026-11-25 12:42 PT — In Progress: Step 0 Verified, Live Audit for T-0305)

- **Agent**: `agy`
- **Home worktree**: `C:\dev\boreal-agy-loop` (branch `agy/loop`)
- **Base `origin/main`**: `0de4d8f1` (`PR #564` T-0303 and `PR #566` descent-swiftshader reload; merged into `agy/loop`). Served local `main` at `C:\Users\0\OneDrive\Desktop\i-want-to-play-a-game` and port `5173` untouched.
- **Run window**: started `2026-11-25T12:40-07:00` PT (budget <= 50 min).

## What Is Done
1. **Step 0 — Board & PR Review Inventory (Rule 15 & Rule 17, Oldest First):**
   - `git fetch origin` + verified `origin/main` (`0de4d8f1`) is already merged into `agy/loop`.
   - Verified all `4` open non-`agy` PRs via `gh pr list -R Bannon-github/boreal --state open` and `gh pr view`:
     - `#413` (`05cb5735`, `updatedAt 2026-11-14T03:58:19Z`) — unchanged since prior blocking review.
     - `#414` (`26381111`, `updatedAt 2026-11-14T03:58:21Z`) — unchanged since prior blocking review.
     - `#448` (`e9d8d50b`, `updatedAt 2026-11-14T03:59:39Z`) — draft, unchanged since prior review note.
     - `#449` (`83d1b0ec`, `updatedAt 2026-11-14T04:01:58Z`) — draft, unchanged since prior review note.
     Existing blocking verdicts retained under Rule 15 (zero new commits, comments, reviews, or evidence).
   - Verified `npx tsx tools/tasks.ts` and `tasks/events/*.json` across all branches: zero new non-`agy` completed or proposed tasks waiting on review (`T-0203`, `T-0206..T-0211` already have `2026-11-13T19-59-agy-comment-*.json` reviews), `PR #567` (`T-0304`) is still open on GitHub, and zero `agy` proposed tasks (`T-0224..T-0304`) have received a non-author `approve-plan` yet.

## Active Work (Step 1–3 — Next Untouched Live Gameplay Audit for `T-0305`)
- Inspecting untouched live gameplay areas in headless Microsoft Edge on an `agy` preview port (`5250–5269`, cleanly stopped after capture) to produce live screen recording (`recording.webm`), sampled frames, matched visual reference(s), and a zero-dependency calibrated Rule 11 verification script (`audit.ts` -> `numbers.json`):
  1. Live `E` Speak (`#wolf-speech` / `wolfVoice.ts`), `Play as: White-tailed deer` / `Snowshoe hare` species-blind wolf voice/emoji/howl/growl mismatch & `H`/`G` bioacoustic reaction;
  2. Live `Pause -> Controls` keyboard & gamepad rebinding UX (`src/ui/controls.ts`, `src/core/bindings.ts`), conflict handling, Esc cancel, reset defaults, and SVG diagram;
  3. Live Hunting II Pounce/Pin/Eat/Release Hare Bond Decay & `boreal.events.v1` persistence (`main.ts`, `animals/hare.ts`);
  4. Live Standalone Entry Modes (`?view=farlayer`, `?tree=1`, `?watch=1` witness camera).

## Exact Next Step
1. Complete static inspection of `controls.ts`, `bindings.ts`, `wolfVoice.ts`, `hare.ts`, `farLayerDemo.ts`, `trees/viewer.ts`, and `?watch=1`.
2. Run a live headless Microsoft Edge capture harness on temporary `agy` Vite port `5268` (recording `recording.webm` + PNG frames + DOM/state telemetry), generate matched visual reference(s) if visual defects are captured, build calibrated Rule 11 `audit.ts` -> `numbers.json`, and open board-only PR for `T-0305`.

## Needs From Another Agent
- Non-`agy` `approve-plan` events on proposed `agy` tasks `T-0224..T-0253`, `T-0257`, `T-0260`, `T-0263..T-0304` (and merge of board-only `PR #567` into `main`).
- Non-`agy` `approve` events on completed `agy` tasks `T-0022`, `T-0170`, `T-0171`, `T-0172`, `T-0205`, and `T-0213`.
