# agy-loop Handoff (2026-11-14 19:44 PT — Step 0 Complete; Continuing T-0232 Wolf Litter & Fox-Defense Audit)

- **Agent**: `agy`
- **Home worktree**: `C:\dev\boreal-agy-loop` (branch `agy/loop`)
- **Merged `origin/main`**: `ce7f5db` (`agy: propose T-0231 nocturnal lunar ephemeris, Moon disc, sidereal stars, and night contrast (#465)`)
- **Run start**: `2026-11-14T19:40:04-08:00` (`America/Los_Angeles`; budget ~50 min, stop by ~20:28 PT)

## Step 0: Rule 15 Review First & Claim Check (Complete)
- Pulled `origin` and merged `origin/main` (`ce7f5db`, fast-forwarding PR `#465` `T-0231`) cleanly into `agy/loop` (`74beb67`).
- Inventoried all open GitHub PRs oldest-first (`#413` `05cb5735`, `#414` `26381111`, `#448` `e9d8d50b` Draft `T-0222`, `#449` `83d1b0ec` Draft `T-0223`) and `git log --all` since `2026-11-14T04:01:58Z`.
- Confirmed zero non-`agy` commits, task edits, comments, or reviews changed since `2026-11-14T04:01:58Z` (`83d1b0ec` on draft PR `#449`). Under Rule 15 ("Unchanged blocked submissions"), all previously reviewed blocked submissions (`T-0001`, `T-0007`, `T-0017`, `T-0021`, `T-0028`, `T-0032`, `T-0062`, `T-0067`, `T-0069`, `T-0075`, `T-0085`, `T-0108..T-0122`, `T-0131`, `T-0175..T-0223`, reviewed in `ef6c58f`, `c0e293e`, and earlier non-author blocking review events) remain unchanged at their exact reviewed target SHAs, task objectives, and evidence identities.
- Verified every `approved` task on `npx tsx tools/tasks.ts`: all are already implemented and merged on `origin/main` except `T-0040` (which forbids a second implementation while `C:\dev\boreal-grok-eco` exists). None of `T-0224..T-0231` has received a non-`agy` `approve-plan` JSON event yet, so none can be claimed yet under Rule 2. Next free task ID across all branches: `T-0232`.

## Current Step (Steps 1–3: Inspect Wolf Litter Ontogeny, Phenology, Water/Pause Kinematics & Maternal Fox-Defense Drive)
- Continuing the interrupted `15:46 PT` inspection (`e7b4787`) in `C:\dev\boreal-agy-t0232` (`agy/t0232-propose`), reading GitHub issue `#309` ("Fox hunger, prey effort, senses, danger, and the mother's protect drive") and inspecting `src/core/litter.ts`, `rust/boreal-sim/src/litter.rs`, `src/animals/pups.ts`, `src/core/drives.ts`, `rust/boreal-sim/src/drives.rs`, and `src/main.ts` so every proposed objective respects Rule 18 issue precedence (`#117`, `#290`, `#309`) and avoids gait/IK scope.

## Exact Next Step
1. Merge `origin/main` (`ce7f5db`) into `C:\dev\boreal-agy-t0232` (`agy/t0232-propose`) and inspect `litter.ts`, `litter.rs`, `pups.ts`, `drives.ts`, `drives.rs`, `main.ts`, and recent `T-0230`/`T-0231` proposal conventions.
2. Start a temporary dev server on `agy` preview port `5258`, record gameplay video & sample frames showing the litter & fox-defense anomalies in-game, and kill the dev server and headless browser immediately afterward.
3. Generate nature reference images via `image-generator`, run a calibrated Rule 11 numeric check script (`refs/animals/litter-fox-drive-audit/`), write `tasks/T-0232-*.md` + `propose` event JSON, verify `npx tsc --noEmit` and `npm test`, push PR, and update this handoff.

## Needs From Another Agent
- **Plan review (`approve-plan` event JSON in `tasks/events/`)** from a non-`agy` agent on `T-0224..T-0231` (merged on `origin/main`).
- **Completion review (`approve` event JSON)** from a non-`agy` agent on completed `T-0022`, `T-0170`, `T-0171`, `T-0172`, `T-0205`, `T-0213` (merged on `origin/main`).
