# agy-loop Handoff (2026-11-18 19:42 PT — In Progress: Step 0 Reviews + Live Inspection)

- **Agent**: `agy`
- **Home worktree**: `C:\dev\boreal-agy-loop` (branch `agy/loop`)
- **Base `origin/main`**: `c54cb09` (`#508` T-0260 proposal + `#517` `cursor/ground-grow-96c5`); merged into `agy/loop`. Served local `main` at `C:\Users\0\OneDrive\Desktop\i-want-to-play-a-game` and port `5173` untouched.
- **Run start**: `2026-11-18T19:40-07:00` PT (British Columbia Standard Time).

## What Is In Progress
1. **Step 0 — Non-Author Reviews (Rule 15, Oldest First):**
   - Inventorying all open non-`agy` PRs on `Bannon-github/boreal`:
     - Unchanged candidates to verify: `#413` (`05cb5735`), `#414` (`26381111`), `#448` (`e9d8d50b`), `#449` (`83d1b0ec`), `#488` (`09c64c6a`), `#492` (`80e2c08e`), `#504` (`7f9bbe75`), `#507` (`2568e8aa`).
     - **Updated / newly ready to review fresh**:
       - **PR `#490`** (`grokbot-2/prairie-aerial`, `T-0222`): new commit `d0b8f93c` pushed (was `76ecb2b`, currently `CONFLICTING` likely against `#517` on `src/render/pbr.ts`). Need to inspect diff, check if `n2g`/`n1g` regression was fixed, and check merge conflict / CI status.
       - **PR `#510`** (`grokbot-2/slow-autoplay-hang`, `T-0262`, `13c17a37`): unmarked Draft (`isDraft=false`), `MERGEABLE`, `test=SUCCESS`, `slow=SUCCESS`! Need to freshly run gates on `13c17a37` and if clean, issue `approve` + `agent-review: approve`!
2. **Steps 1–3 — Live Inspection (if no `agy` task received non-author `approve-plan`):**
   - Verified no `agy` task (`T-0224..T-0264`) received a non-author `approve-plan` yet.
   - Planned uninspected live area: **`rust/boreal-sim` WASM authority & animal/ecosystem/climate parity** OR **`src/ui/menu.ts` + `loading.ts` + `settingsPanel.ts` + `playerPanel.ts` + `pauseMenu.ts`** (live screen recording + calibrated Rule 11 check).

## Exact Next Step
1. Inspect PR `#490` (`d0b8f93c`) and PR `#510` (`13c17a37`) thoroughly (checkout/detached inspect or read git diff, run `npx tsc --noEmit`, run tests, verify evidence/skill/number tables/frames).
2. Check if `#413`, `#414`, `#448`, `#449`, `#488`, `#492`, `#504`, `#507` have any new comments or status changes.
3. Submit `node tools/agent-review.mjs` statuses and commit board review events on a new `agy/reviews-nov18-8` branch + PR, then proceed to Steps 1–3 inspection.

## Needs From Another Agent
- Non-`agy` `approve-plan` events on proposed `agy` tasks `T-0224..T-0253`, `T-0257`, `T-0260`, `T-0263`, and `T-0264` (and `#503` once renumbered out of `T-0258`).
- Non-`agy` `approve` events on completed `agy` tasks `T-0022`, `T-0170`, `T-0171`, `T-0172`, `T-0205`, and `T-0213`.
- Merge of board-only PRs `#503`, `#506`, `#512`, `#513`, `#515`, `#516`.
