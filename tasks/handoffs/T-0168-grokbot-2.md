# T-0168 handoff — grokbot-2

Claimed. Warm startup for a return reload in the same tab. Not submitted: the loading screen was not recorded here.

## Doing

Code and tests are on the branch. Waiting on Grokbot-1's review. Not complete.

## Done

- Id scan before the propose. `origin/main` task files stop at T-0164 (plus the legacy T-0998 / T-0999 fixtures). Open PR #321 is T-0165 (`grokbot-2/t0165-open-woodland-cover-propose`). PR #322 is T-0166 (`grok-globe/big-bang-cinematic`). PR #323 is T-0167 (`grokbot-2/t0166-save-resume`; the branch name was not retargeted). `git log --all -- tasks/T-0168*` was empty. Locked T-0168.
- Rule 16b approve-plan is on this branch, agent `grokbot-2`, `for: matthew`, quoting the three Cinematic Coder lines from 2026-11-05 afternoon PT and the 2026-10-22 01:52 PT sentence. Claim is after that `at`.
- `startupRoute` / `startupBudget` pick the path. Warm requires a `boreal.probe.v1` hit, the same build id (`import.meta.url`), and `sessionStorage` `boreal.startup.warm.v1` for this renderer. Cold keeps `settle(15, 20000)`, the Ultra bench when the cache misses or `?reprobe` is set, compile-before-probe, the 3 s sky cap, and `warmUp` up to 6 s.
- Warm land wait exits once the standing chunk (`?at=` or `livingHere()`) has been in the scene for 4 frames. The 20 s ceiling stays if it has not. Compile runs once at the cached tier. Sky wait is unchanged. `warmUp(..., 0)` queues the next tier and does not block.
- `src/main.ts` is not edited. T-0166 and T-0167 both change the `startup(...)` call.

## Number table

These are loading budgets, not animal rates. Nothing here is a stand density, a gait, or a temperature.

| value | game | real figure | source | resembles nature? |
|---|---|---|---|---|
| cold quiet frames | 15 | — | existing `settle(15, 20000)` in `startup.ts` | N/A, not a natural rate |
| land ceiling | 20 000 ms | — | same call | N/A |
| sky cap | 3 000 ms | — | existing sky loop | N/A |
| next-tier block, cold | 6 000 ms | — | `photoreal.warmUp` default | N/A |
| warm quiet frames | 4, and only after `chunkBuilt` | — | game calibration: a few frames so the added chunk can draw before compile | N/A |
| warm next-tier block | 0 ms (precompile is queued) | — | this task; the live tier is still `compile()`'d | N/A |

## Frames

N/A in this run. No display was captured. The loading screen, the ground, and the sky are visible and were not sampled. Tests check which path runs. They do not show pixels.

What a machine with a display would record: first load of a tab logs `STARTUP cold` and the loading card stays while the queue drains; refresh logs `STARTUP warm`, the card leaves once the standing chunk is in and shaders have compiled, the ground is not an empty plane, and the sky is not black. `?reprobe` logs `STARTUP cold` and a new `PROBE` line.

## Verified

- `npx tsx --test tests/startup-warm.test.ts`: 8 passed.
- `npm test`: 1119 passed, 0 failed, 14 todo (the existing ledger todo). 
- `npx tsc --noEmit`: passed.
- `npx tsx tools/tasks.ts`: T-0168 is claimed, 30 cr, claimant grokbot-2. No T-0168 line under rule breaks.

## Next

Open the PR and ask Grokbot-1 to review. No complete event in this run: the loading screen was not recorded. Do not self-merge.

## Needs from another agent

Grokbot-1: review the PR. The frame check above is the visible part this run could not capture.

## Branch

`grokbot-2/t0168-warm-startup`.
