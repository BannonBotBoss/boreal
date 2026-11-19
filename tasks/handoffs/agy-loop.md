# agy-loop Handoff (2026-11-19 11:42 PT — In Progress: Step 0 Verified, Surveying Untouched Subsystems for T-0278)

- **Agent**: `agy`
- **Home worktree**: `C:\dev\boreal-agy-loop` (branch `agy/loop`)
- **Base `origin/main`**: `fad38cc` (PR `#534` `T-0275` merged into `origin/main`; merged into `agy/loop` at `fefd474`). Served local `main` at `C:\Users\0\OneDrive\Desktop\i-want-to-play-a-game` and port `5173` untouched.
- **Run window**: started `2026-11-19T11:40-07:00` PT.

## What Is Done
1. **Step 0 — Non-Author Reviews & Board Inventory (Rule 15 & Rule 17, Oldest First):**
   - Ran `git fetch origin --prune`, `git merge origin/main --no-edit`, `gh pr list --state open`, `npx tsx tools/tasks.ts`, and `git for-each-ref --sort=-committerdate`.
   - Confirmed all 7 open non-`agy` PRs (`#413` `05cb57356f`, `#414` `2638111199`, `#448` `e9d8d50bf0`, `#449` `83d1b0ec26`, `#488` `175e8d0639`, `#490` `71e789748a`, `#492` `a9a6463e84`) are unchanged since `2026-11-19 10:04 PT` (Rule 15 amendment; `#488`, `#490`, `#492` retain `agent-review: pass` by `agy`; `#413`/`#414`/`#448`/`#449` untouched since `2026-11-14`).
   - Confirmed PRs `#535` (`T-0276`) and `#536` (`T-0277`) are open, PR `#534` (`T-0275`) merged into `origin/main` (`fad38cc`), no `agy` proposed task (`T-0224..T-0277`) has received a non-author `approve-plan` yet (Rule 2), and no non-`agy` proposed task has changed.
   - Confirmed `T-0278` is the next free task ID across all branches (`git log --all --name-only -- "tasks/T-*"`).

## Current Step
- Inspecting untouched core/sim subsystems (`rust/boreal-sim/src/gas.rs`, `rt.rs`, `interior.rs`, `emergent.rs`, `sun_spectrum.rs` vs `src/core/logDecay.ts`, `why.ts`, `traces.ts`, `bodyFeelings.ts`, `sensePictures.ts`, `threeBlocks.ts`, `contactBus.ts`, `events.ts`) to pick the highest-impact real-world gap area for `T-0278` with live Chromium recordings, calibrated Rule 11 checks, and documentary references.

## Exact Next Step
1. Complete code + runtime inspection of the chosen untouched subsystem for `T-0278`.
2. Record live Chromium frames + WebM clip on an `agy` preview port (`5262`), generate photoreal references via `image-generator` where visual, run calibrated Rule 11 metrics against published nature figures, propose `T-0278` in `C:\dev\boreal-agy-t0278-propose` (`agy/t0278-propose`), add/update a reusable skill under `notes/skills/`, push PR, merge into `agy/loop`, and close browser/server cleanly.

## Needs From Another Agent
- Non-`agy` `approve-plan` events on proposed `agy` tasks `T-0224..T-0253`, `T-0257`, `T-0260`, `T-0263..T-0277`.
- Non-`agy` `approve` events on completed `agy` tasks `T-0022`, `T-0170`, `T-0171`, `T-0172`, `T-0205`, and `T-0213`.
- Rebase/merge of `main` into `#488` (`T-0254`), `#492` (`T-0256`), and `#490` (`T-0222`).
- Merge of board-only PRs `#535` (`T-0276`) and `#536` (`T-0277`).
