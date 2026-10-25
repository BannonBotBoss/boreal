# T-0015 handoff (grokbot-3)

**Task:** T-0015 Forage on the resource field. Issue #11.
**Branch:** `grokbot-3/forage-regrowth` (off main, which already has T-0009's field in `src/core/fields.ts`).
**Agent:** grokbot-3. Not self-approved. Claim sits on agy's approve-plan (2026-10-21 11:45 PT). No second approve-plan. Matthew's 2026-10-24 17:10 PT chat ("every 30 minutes, check the issues and get one done") is why this run took the issue. It is not a quoted approval of this task's result, so this handoff does not write a rule 16 approve. Another agent reviews and merges.

## Claim check

Ledger across branches: T-0015 events are only grok's propose (2026-10-21 10:25 PT) and agy's approve-plan (2026-10-21 11:45 PT). No claim file. GitHub "owner grok" is the author fallback in `tools/board-github.ts`, not a claim. Open PRs at claim time: #66 (T-0070, grokbot-1). It does not touch forage. T-0009 is already on main (PR #69). This branch is not stacked on an unmerged field branch.

## Rule 15

Prior grokbot-3 loop (`tasks/handoffs/grokbot-3-loop.md`) already reviewed T-0025, T-0007, T-0032, T-0028, T-0021 and T-0069 as unchanged or blocked. Not re-approved here. No duplicate task id on main. Highest task file is T-0076. No new id.

## What this is

Berry patches and herb shoots use the T-0009 sun field. Placement keeps a seeded draw only where ground light can flower a lowbush blueberry (half sun or more) or, for herbs, in proportion to site light. Eating takes grams. The patch stores one grazed delta (grams left, world second, grams per sun-second, full crop). A later read is that store plus `sunSeconds` since the bite. Nothing ticks per frame. An empty bush stays in the world and fills back. Clover still refills on a 86400-second biological day. Forage refills on game days (`24 * REAL_SECONDS_PER_GAME_HOUR`) so a play session can show it.

## Numbers

| Value | Game number | Source | Resembles nature? |
|---|---|---|---|
| Flower light | suit 0 below 0.5, 1 at full sun | Hall et al. 1979, via Drummond TB203 / FEIS: lowbush blueberry does not flower below 50% full sunlight | yes, the gate |
| Standing crop | 122.22 g fresh/m² times patch area | Ma et al. 2022, Agronomy 12(3):617, Wyman's field minimum. Managed wild field, not a boreal opening | yes, as a sunlit floor |
| Patch radius | 0.38 m | Vander Kloet 1988; Hall et al. 1979. Already `FORAGE_SPEC` in `render/geometry.ts` | yes |
| Refill | 60 game days of sun-weighted time | About 8 weeks bloom to ripe. Fruit is on one-year-old wood, so a stripped crop is next season's fruit. [verify] against Hall's table | estimate |
| Bare mat | cover 0.35 | Game presentation of stems that stay after the fruit is gone. Not a measured height ratio | game presentation |
| Deer mouthful | 7.8 g fresh/min, 60 g fresh = +1 energy | Koerth & Stuth 1991. Already the deer diet | yes |
| Wolf mouthful | same 7.8 g/min, bout 60 s | The deer rate, shared so one bite clock serves the wolf. Not a measured wolf blueberry rate | estimate (the rate's species) |
| Wolf berry energy | fmrKjPerDay / 100 / (57 kcal/100 g × 4184 J/kcal) | USDA FDC 171711 and `WOLF_NEEDS.body.fmrKjPerDay` (15034 kJ) | yes, the conversion |
| Person pick | 1.36 g/s, USDA 57 kcal/100 g | Already T-0012. The bush stock is the field crop, not a second 68 g pocket | yes, the grams |
| Browse cell | 8 m, 50 g DM/m² / 0.35 | 50 g DM/m² is [verify]. 0.35 is the existing deer dry-fraction estimate. Circle of radius 4 m | estimate |
| Herb shoot | max 1, same 60 sun-days | One gather takes the shoot. The 60 days are the berry interval, shared. [verify] | estimate |

`FEED_DURATION` (2) and `FORAGE_ENERGY` (18) stay on the system-property map. Meals no longer wait on that 2 s timer or grant that flat 18.

## Frame gate

A still frame cannot show a 60-day refill. The substitute is `tests/forage-field.test.ts` (rule 11: name the metric, the tool, and a case that scores below 0.95).

- Position: share of placed forage whose site light is at least 0.5. Tool: `generateChunk` plus `siteAt`. A placed bush scores 1. A bush counted at light 0.2 scores 0.
- Acceptance: Monte Carlo of `berrySuit` against seeded keeps. Score is `1 - |rate - suit|`. A coin-flip acceptor at light 0.2 (suit 0) scores 0.5.
- Timing: slot-stepped daylight × temperature integral against `sunSeconds`. Score is `1 - mean |step - closed| / closed(end)`. An instant-full model (the whole interval's sun already booked at the halfway mark) scores below 0.95.
- Herb position: each placed plant's separate `herb-light` keep is below its site light. A plant that failed that draw scores 0.

Measured on 2026-10-25 in `tests/forage-field.test.ts` (chunks −2..2, 4000 seeded draws, 8 game days of slots):

| Check | Score | Known mismatch |
|---|---|---|
| Placed forage with site light ≥ 0.5 (8 bushes) | 1 | A bush counted at light 0.2 scores 0 |
| Monte Carlo accept rate vs `berrySuit(0.75)` | 0.992 | A coin-flip acceptor at light 0.2 scores 0.5 |
| Slot step vs `sunSeconds` | 0.999983 | Instant-full at the halfway mark scores 0.506 |

No pixel frames. The metric is the table above, the tool is that test, and each mismatch is under 0.95.

`npx tsc --noEmit` exit 0 on 2026-10-25. `npm test` 721 tests, 707 pass, 0 fail, 14 todo. The flora stack overflow (canopy hook calling `generateChunk` from inside placement) is closed by stand-only light during chunk generation.

## Leftovers

- Drought does not stop berry regrowth (same gap as clover).
- The 60-day herb interval is the berry figure, tagged [verify].
- Browse biomass of 50 g DM/m² is tagged [verify].
- Wolf berry bite rate is the deer stem rate.
- No pixel frames. The rig and the batch cover are not scored against a photo.

## What the next owner needs

- `generateChunk` calls `siteAt(x, z, true, false)`. Drawn crowns rebuild the chunk. A light read with crowns on, from inside generation, overflows the stack. Regrowth after the chunk exists may use full `siteAt`.
- `berrySuit` lives in `src/core/forageLight.ts`. `world.ts` must not import `fields.ts`. That cycle initializes the weather surface before it exists.
- The grazed row is `kind: 'grazed'` in `DELTAS.log`. Meta is `key|atWorldSec|perSun|max|by`. `strength` for that kind is depletion remaining, from `sunSeconds` and `worldSec()`, not the exponential and not the game-year argument.
- `record()` must not merge grazed rows. Use `upsertGrazed`.
- Do not retune clover's `/86400`.
- `fields.ts` imports `deltas.ts` and `deltas.ts` imports `sunSeconds` from `fields.ts`. Neither module calls the other at init.
- Visitor picking, wolf `forageSource.eat`, deer `BROWSE.eat`, `consumeForage` and gather all call `takePatch`.
