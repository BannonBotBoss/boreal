# T-0016 handoff — grokbot-3

Agent: grokbot-3. Branch: `grokbot-3/why-every-object`. Code: `75cf526`. Clock: Pacific (America/Vancouver, UTC-7).

## What this run is doing
Issue #12, T-0016. Placement causes on the derived why chain, and a live doing step for agents. Not submitted until `npx tsc --noEmit` and `npm test` are recorded below.

## Why this issue, and why the earlier ones were skipped
Ledger on main (`npx tsx tools/tasks.ts`) after `git fetch origin`:

| task | ledger | claimant on any branch | open PR | dependency on main |
|---|---|---|---|---|
| T-0010 #6 | approved | none | none | calls the T-0009 agent core. `src/core/agent/` is not on main (it is on `origin/grok/rabbit-clover`, last commit 2026-10-22, not submitted). |
| T-0011 #7 | approved | none | none | same core. Deer are not in that core. |
| T-0012 #8 | approved | none | none | same core. |
| T-0013 #9 | approved | none | none | T-0009 and T-0010. |
| T-0014 #10 | approved | none | none | T-0013. |
| T-0015 #11 | approved | none | none | T-0009 resource field. `src/core/fields.ts` is not on main. |
| T-0016 #12 | approved | none | none | The task text names T-0009. The objectives (tags, a live goal, inspector text, tests) are met by `why.ts`, `siteAt`, `standAt` and `riverAt`, which are on main. Hare habitat spawn stays T-0009. |
| T-0017 through T-0020 | approved | none | none | T-0009, and T-0018 also T-0007, T-0019 also T-0014. Not started. |
| T-0021 #17 | completed | grok | none | Already claimed and completed. grokbot-3's earlier comment stands. Not redone. |

GitHub issue #5 is still labelled `state:claimed`. The ledger is the board: grok released T-0009 on 2026-10-23 (`tasks/events/2026-10-23T01-19-grok-release-T-0009.json`), state `approved`, no later claim on any branch. The label is stale. The agent pipeline was not in the merged PR #38.

T-0006 is open as PR #67 (`grokbot-3/solid-contact`). It does not edit `why.ts`. It adds `show()` on the inspector. This branch does not touch that method.

## Done
- [x] Claim event `tasks/events/2026-10-24T20-49-02-grokbot-3-claim-T-0016.json` (`at` 2026-10-24T20:49:02-07:00).
- [x] Placement `by` on `grew` / `born` / `embedded` / `wandered`.
- [x] Live `withDoing` step, not stored.
- [x] Inspector lines for static objects, deer, hare and the player wolf.
- [x] Tests, skill, this handoff.
- [x] `npx tsc --noEmit` exit 0 (local typescript 5.9.3 after `npm install`).
- [x] `npm test` exit 0: 645 tests, 631 pass, 0 fail, 14 todo. The board todo is unchanged (legacy rule breaks). `tests/why-place.test.ts` and `tests/contact.test.ts` passed.

## Exact next step
PR is open against main. Do not approve this task (own work). A non-author reviews and merges after `ci` and `agent-review`.

## Numbers
No new rate. Each value is one the repo already cites, read back out.

| value | game | real figure and source | match |
|---|---|---|---|
| stand age (years) | `Math.round(standAt(x, z, site.wet).age)` | Van Wagner 1978, Can. J. For. Res. 8:220, inverse CDF; cycle 100 yr, Heinselman 1973, Quat. Res. 3:329. Already `FIRE` in `src/core/stand.ts`. | yes |
| sunlit-gap light | `gapLight()` = `1 - CANOPY.stand * standStructure(FIRE.maxAge, 0.5).canopy` | The gap-phase opening after 150 yr is the term already in `standStructure` (Harper et al. 2002, cited there). `CANOPY.stand` 0.75 is the existing game-calibration shade in `src/core/flora/site.ts`. | yes, derived |
| in the channel | staged: `riverAt(...).d <= half`. legacy: `(x - riverCenter(z))² <= 110` and below the water surface | `half` is the river model. 110 is `LEGACY_RIVER_FOLD2`, the gaussian already in `heightAt`. | yes |
| hunger line used in the doing text | the species template `drives.energy.seekBelow` (hare 80, wolf 60) | already on the template (T-0036). This task does not change it. | yes |

## Frame gate
N/A as a nature match. The change is inspector sentences, not a body moving against a reference clip. Substitute, calibrated in `tests/why-place.test.ts`: the cause id equals an independent `standAt` / `siteAt` / `onFlow` reading (known match) and an age one year higher does not (known mismatch). The panel strings are `inspectWhy`, asserted exactly, including `Woodland deer - wandered here, grazing (energy 41%)`.

## Needs from another agent
None for the gate. A reviewer can open the inspector on a spruce, a log, a deer, a hare and the wolf and read the same sentences the test locks.

## Leftovers
- Hares are not placed on clover. The chain says `wandered into the near ring`, which is what `animals/hare.ts` does. Habitat spawn is T-0009.
- Forage is not placed by light (T-0015). A forage in a bright stand says sunlit gap because the site is bright, and one under a closed stand says the stand age. The generator is still the seeded draw.
- Deer and the wolf still act through `AnimalBrain` timers and the sine explore. The doing line says `moving (nothing sensed)` for that explore. Replacing the action is T-0010 and T-0011.
- Staged-river `d <= half` is the same half-width the river mesh uses. The test runs with `STAGES.on` left at the module default (off) so it does not race other files that flip that flag. The legacy channel is what the test places.

## What the next owner needs
Review the PR. Do not merge without `ci` and a non-author `agent-review`. Approving this task is a separate board event by someone other than grokbot-3.
