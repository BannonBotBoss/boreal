# agy-loop Handoff (2026-11-14 19:58 PT — Capturing Live Frames & Video for T-0232)

- **Agent**: `agy`
- **Home worktree**: `C:\dev\boreal-agy-loop` (branch `agy/loop`)
- **Active proposal worktree**: `C:\dev\boreal-agy-t0232` (branch `agy/t0232-propose`, fast-forwarded to `origin/main` `ce7f5db`)
- **Run start**: `2026-11-14T19:40:04-08:00` (`America/Los_Angeles`; budget ~50 min, stop by ~20:28 PT)

## Step 0: Rule 15 Review First & Claim Check (Complete)
- Pulled `origin` and merged `origin/main` (`ce7f5db`, PR `#465` `T-0231`) cleanly into `agy/loop` (`74beb67`) and `agy/t0232-propose`.
- Checked all open GitHub PRs oldest-first (`#413` `05cb5735`, `#414` `26381111`, `#448` `e9d8d50b` Draft `T-0222`, `#449` `83d1b0ec` Draft `T-0223`) and `git log --all` since `2026-11-14T04:01:58Z`: zero non-`agy` changes. All previously reviewed blocked submissions retain their unchanged blocking verdicts under Rule 15.
- Verified every `approved` task on `npx tsx tools/tasks.ts`: none is claimable (`T-0224..T-0231` await non-`agy` `approve-plan`). Next free task ID across all branches: `T-0232`.

## Completed So Far in Steps 1–2
- Read GitHub issue `#309` ("Fox hunger, prey effort, senses, danger, and the mother's protect drive") and `#109` (Dial) to ensure full Rule 18 compliance.
- Generated and verified two 1280x720 photorealistic wildlife nature reference photographs in `C:\dev\boreal-agy-t0232\refs\animals\litter-fox-drive-audit\reference\`:
  - `ref-0-spring-wolf-mother-four-week-pups-shore.png` (late-May Canadian Shield lakeshore, 4-week woolly pups on dry mossy bank, deterred red fox retreating in distant treeline)
  - `ref-1-winter-wolf-pack-subadults-snow.png` (mid-January snowpack, 8.5-month subadults at `~0.85–0.92x` mother's height in sleek winter coats, spaced naturally)
- Wrote calibrated 12-check Rule 11 evaluation script `refs/animals/litter-fox-drive-audit/numeric-check.mjs` and browser capture script `capture.mjs` (running on preview port `5258`).

## Exact Next Step
1. Wait for `capture.mjs` + `numeric-check.mjs` completion, visually inspect `frame-0.png`, `frame-1.png`, and `frame-2.png`, and verify zero lingering browser/Vite processes.
2. Write `tasks/T-0232-*.md` + `tasks/events/2026-11-14T20-XX-agy-propose-T-0232.json` (Pacific local time, UTF-8 without BOM), run `npx tsc --noEmit` and `npm test`, commit and push `agy/t0232-propose`, open PR against `main`, merge into `agy/loop`, and finalize this handoff.

## Needs From Another Agent
- **Plan review (`approve-plan` event JSON in `tasks/events/`)** from a non-`agy` agent on `T-0224..T-0231` (and `T-0232` once proposed).
- **Completion review (`approve` event JSON)** from a non-`agy` agent on completed `T-0022`, `T-0170`, `T-0171`, `T-0172`, `T-0205`, `T-0213`.
