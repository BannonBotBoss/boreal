# T-0009 handoff — grokbot-3

Agent: grokbot-3. Branch: `grokbot-3/agent-core-hare`. Code: `4589625`. Clock: Pacific (America/Los_Angeles, UTC-7). PR: https://github.com/BannonBotBoss/boreal/pull/69

## What this run is doing
Issue #5, T-0009. The shared agent core, the transaction registry, and the clover resource field were not on main. The hare rig was (PR #38). This branch ports the reviewed pipeline from `origin/grok/rabbit-clover` (`ab067b8`) onto the paths the task names, so T-0010, T-0011 and T-0012 can add wolf, deer and person rows of the same type.

## What was already on main
- Hare render adapter `src/animals/hare.ts` over `src/core/sim` (T-0036), procedural fur, bounding rig. `SIM_ACTION` maps sim states to rig actions.
- `HARE_NEEDS` and `HARE_GAIT` in `src/core/needs/species`.
- `CONTACTS` (`kind` was only `solid-solid`), `stateFields.ts`, `why.ts`, `siteAt`, `solar` / `shortwave`.
- Ledger: T-0009 approved, unclaimed, after grok's release `tasks/events/2026-10-23T01-19-grok-release-T-0009.json`. Codex approve-plan `2026-10-21T21:32:41-07:00` stands. No new propose and no new approve-plan (both would be rule breaks). GitHub issue #5 still says claimed; the ledger is the board.

Missing on main before this branch: `src/core/agent.ts`, `src/core/transactions.ts`, `src/core/fields.ts`, a hare `BEHAVIOUR` row.

## Done
- [x] Handoff (this file) and claim `tasks/events/2026-10-24T21-20-51-grokbot-3-claim-T-0009.json`.
- [x] `src/core/agent.ts`: percepts, levels, goal, action. `agentReadout`, `writeLocomotion` (does not call `AnimalBrain.decide`), `agentSnapshot` / `restoreAgent`.
- [x] `src/core/transactions.ts`: kind-pair rows. A contact row runs only while `CONTACTS` has the pair.
- [x] `src/core/fields.ts`: clover units, grazed deltas, closed-form regrowth, `clearingAt` (not wired into the forest), `groundLight`, `cloverSiteAt`.
- [x] `BEHAVIOUR.hare` in `src/core/species.ts`. Gait stays `HARE_GAIT`.
- [x] `Contact.kind` includes `feed`. `main.ts` ignores feed contacts for the solid why tip.
- [x] Why tags `grazed` and `regrew` (not inserted into `WHY_DEFAULTS`).
- [x] `stateFields` groups `agent`, `cloverPatch`, `world.cloverRegrowth`.
- [x] Unused `HARE.freezeSeconds` removed. Spawn, model and the sim tick stay.
- [x] `tests/agent.test.ts`. Skill `notes/skills/agent-pipeline-species.md`.
- [x] `npx tsc --noEmit` exit 0 (local typescript 5.9.3 after `npm install`).
- [x] `npm test` exit 0: 669 tests, 655 pass, 0 fail, 14 todo. The board todo is unchanged (22 legacy rule breaks, the same three T-0009 lines and no new one).
- [x] CI `ci / test` on PR #69 succeeded (run 40162015372). `npm test` then `npx tsc --noEmit`.
- [x] Complete event `tasks/events/2026-10-24T21-28-22-grokbot-3-complete-T-0009.json`. Not an approve.

## Exact next step
PR #69 is open against main (`Refs #5`). Do not approve this task (own work). A non-author reviews and merges after `ci` and `agent-review`.

## Numbers
Flight ×8 and the 8 s stamina window are flagged. They are pinned by `tests/agent.test.ts` and are not a sourced pass. Taylor, Heglund and Maloiy 1982 (JEB 97:1) at 1.5 kg and 8.5 m/s is about 9.9× FMR, the same order, and was not substituted.

| value | game | real figure and source | match |
|---|---|---|---|
| leaf unit | 15 mg DM; 10000 units/m² = 150 g DM/m² | Olykan et al. 2021, J NZ Grasslands 83, doi:10.33584/jnzg.2021.83.3494 ('Kopu' ~1.6 t DM/ha). One unit ~ half a summer leaf, doi:10.33584/jnzg.2021.83.3498 | yes |
| residual stolon | 50 g DM/m², never grazed | DairyNZ (stolon rarely grazed); Lincoln College stocking-rate study, hdl:10182/3015 (50–55 g DM/m²) | yes |
| regrowth | 6 g DM/m²/day at full sun and ≥20°C; 0 at ≤5°C; half at 12.5°C | summer white clover 50–70 kg DM/ha/day, Aust J Exp Agric 45:1577 (2005); base <4°C, Grass Forage Sci 2006 doi:10.1111/j.1365-2494.2006.00553.x | yes |
| recovery | ~25 days, test window 21–28 | Miller et al. 1951 via UC SAREP | yes |
| hare intake | 167 g DM/day; 111 units = +1 energy | captive snowshoe hares, Seeley Lake MT, UMT thesis | yes |
| cropping | 4.1 units / 3 s = 20.5 mg DM/s | 167 g over 8.7 h/day × 26% cropping, Belovsky 1984, Theor Popul Biol, doi:10.1016/0040-5809(84)90009-1 | yes |
| rest drain | 100 per real day (100/86400 per second) | one day's food over one real day | yes |
| flight cost | ×8 rest | Matthew's spec. Taylor et al. 1982 is ~9.9× and was not used. Pinned: 8 s of flee drops energy by 64/864 from 49 | flagged |
| stamina | empty in 8 s of flight, full in 8 s of rest | Matthew's spec, game calibration, pinned | flagged |
| flight distance | 3.7 m, bolt at once inside it; ~1 s freeze then flee when farther | Emmel 2024, UMT MSc, Fig. 1 (224 approaches). Freeze-then-flee: Emmel 2024; Chapman and Flux 2008. The 1 s hold is from the reference video [estimate] | yes for 3.7 m; 1 s hold flagged estimate, pinned |
| flight accel | 10 m/s², top speed ~0.85 s | below cheetah 13 m/s², Wilson et al. 2013, Nature 498:185. No measured hare acceleration | flagged estimate, pinned |
| calm bouts | 3 s graze, 1 s scan, 3 s sprint, 1 s pause | Matthew's spec. A leporid head-up scan averages 3.6 s (Monclús and Rödel 2008, Ethology 114:287); the 1 s scan is kept because he specified it | yes as his spec; scan shorter than 3.6 s |
| ground light | `siteAt().light * shortwave(max(0, solar().cosZ), cloud)` | NOAA solar position; Meinel and Meinel 1976 / Kasten and Young 1989 shortwave, already in `weather.ts` | yes, derived |
| sun table | `lighting().day`, not shortwave | same daylight blend the game clock uses. One game day is 7200 real seconds (`REAL_SECONDS_PER_GAME_HOUR` 300). `regrowTransaction` over 86400 real seconds is one biological day | yes, two clocks, documented |

## Frame gate
N/A for pixels. This branch adds no mesh and does not change poses. The rig on main is PR #38; the fore-paw pop stays T-0044.

Substitute, calibrated in `tests/agent.test.ts`: a calm fed hare's modulators equal `[3, 1, 1, 3, 1]` (known match to Matthew's bout lengths). A nervous hare's graze bout is under 60% of that (known mismatch for a fixed 3 s timer). Alert-to-flee holds `timing.react` (1 s) when the wolf is at 12 m, and is under 0.1 s inside 3.7 m. Flight speed stays under `accel * t`. Clover regrowth over one biological day is within 2% of 6 g DM/m², and the lazy closed form matches stepped `regrowTransaction` within 3% over 3 game days.

## Needs from another agent
None to submit the library. A non-author reviews and merges. Do not self-approve.

Live rendered hares still read `core/sim`. Pointing the herd at `stepAgent` would fork the brain `tests/sim.test.ts` already scores (group awareness, vigilance, the 200-hare bolt). That host call is a later task, after T-0010 / T-0011 / T-0012 have rows. `clearingAt` is not subscribed by population or stands, so the forest on main does not change.

## Leftovers
- `stepPrey` bout timers remain. The new pipeline's bout lengths are the species typicals scaled by relaxation, hunger and cue strength (`modulators`). The `timer` field is the remaining duration of that bout, not a clock that fires on its own.
- ×8 and 8 s stamina stay flagged.
- No clover mesh (`src/render/clover.ts` on the old branch). A mesh would open the pixel gate.
- Wolf, deer and person rows are not added here.

## Board inventory (rule 15)
Own open PRs #65 (T-0004) and #67 (T-0006) were not reviewed. grok-globe's T-0005 was not branched. The earlier grokbot-3 loop handoff still cites the unchanged blocked reviews. This run is T-0009 only.

## What the next owner needs
`import { stepAgent, createAgent } from './agent'` and `BEHAVIOUR.hare` (or a new row of `AgentSpecies`). Food is `createCloverField(cloverSiteAt)`. Graze runs through `TRANSACTIONS` only while a `feed` contact is on `CONTACTS`. Regrowth is `unitsAt` / the `clover|sun` row. `writeLocomotion` copies heading, speed and motion onto an `AnimalBrain` without calling `decide`.
