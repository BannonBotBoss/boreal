# agy-loop Handoff (2026-11-20 05:40 — In Progress: Step 0 Verified, Auditing Rule 7 Board Governance, Verification Gates, Landing/Capture Harnesses & Diagnostic Pages for T-0287)

- **Agent**: `agy`
- **Home worktree**: `C:\dev\boreal-agy-loop` (branch `agy/loop`)
- **Base `origin/main`**: `ab748944` (`PR #545` / `T-0285` merged into `origin/main`; merged into `agy/loop`). Served local `main` at `C:\Users\0\OneDrive\Desktop\i-want-to-play-a-game` and port `5173` untouched.
- **Run start**: `2026-11-20T05:40-07:00` (50-min cap).

## What Is Done
1. **Step 0 — Board & PR Review Inventory (Rule 15 & Rule 17, Oldest First):**
   - `git fetch origin`: `origin/main` advanced `5ef53af1 -> ab748944` (`PR #545` / `T-0285` merged); merged into `agy/loop`.
   - Open non-`agy` PRs checked (`gh pr list --state open`):
     - **PRs `#413`, `#414`, `#448`, `#449`**: unchanged head SHAs (`05cb5735`, `26381111`, `e9d8d50b`, `83d1b0ec`) since `2026-11-14` (Rule 15 amendment; prior blocking verdicts retained).
     - **PR `#546`** (`agy/t0286-propose`, `33bda70d`): own board-only proposal for `T-0286`.
   - Checked `npx tsx tools/tasks.ts` and `tasks/events/*.json` across all branches: no new non-`agy` pending `complete` or `propose` reviews since `2026-11-18` (`T-0258` and `T-0261` carry Rule 16b `for: matthew` approvals and `T-0261` already has `agy`'s `2026-11-18` approval comment; `T-0180..T-0214` and `T-0203`, `T-0206..T-0211` carry `agy`'s `2026-11-13` blocking comments with unchanged state). No `agy` proposed tasks (`T-0224..T-0286`) have received a non-author `approve-plan` yet. Next free task ID across all branches is `T-0287`.

## Currently Doing
- Step 8 (Rule 7) + Steps 1–3 live Chromium & calibrated Rule 11 inspection of four untouched subsystems for **`T-0287`** (zero overlap with `T-0001..T-0286`):
  1. **Rule 7 Board Governance & Ledger Enforcement** (`tasks/RULES.md`, `tools/tasks.ts`, `tests/tasks.test.ts`, `tools/agent-review.mjs`, `tools/board-github.ts`).
  2. **Verification & Scoring Gates** (`tools/anim-gate.ts`, `tools/contact-gate.ts`, `tools/wolf-view-score.ts`, `tools/wolf-lod-bench.ts`, `tools/ref-prompt.ts`).
  3. **Landing Matrix, Globe Seam Baseline & Headless Capture Harnesses** (`tools/landing-matrix.mjs`, `tools/globe-seam-baseline.ts`, `tools/fall-shot.mjs`, `tools/cine-boot-measure.mjs`, `tools/menu-frame-capture.mjs`, `tools/walk-probe.mjs`, `tools/smoke-tiers.mjs`, `tools/bench-lock.mjs`).
  4. **Diagnostic Review Pages (`tools/deep-time.html`, `tools/planet-layers.html`), `tools/system-map.ts`, `tools/hunt-sim.ts` & Live Chromium Visual Verification** (recording + 3 live frames + 3 natural references).

## Exact Next Step
1. Run quantitative probes on the four subsystems and start a temporary Vite dev server on an `agy`-range port (`5269`) for live headless Chromium recording & frame capture.
2. Build calibrated Rule 11 audit script `refs/audit/rules-gates-harnesses-diagnostics-audit/audit.ts`, capture recording + 3 frames + 3 references, verify `calibrationValid = true`.
3. Create worktree `C:\dev\boreal-agy-t0287` (`agy/t0287-propose` off `origin/main`), commit `tasks/T-0287-*.md`, propose event, handoff, skill, and evidence, run tests/tsc, push & open PR, stop preview server, update `agy-loop.md` and commit.

## Needs From Another Agent
- Non-`agy` `approve-plan` events on proposed `agy` tasks `T-0224..T-0253`, `T-0257`, `T-0260`, `T-0263..T-0286`.
- Non-`agy` `approve` events on completed `agy` tasks `T-0022`, `T-0170`, `T-0171`, `T-0172`, `T-0205`, and `T-0213`.
- Merge of board-only PR `#546` (`T-0286`).
