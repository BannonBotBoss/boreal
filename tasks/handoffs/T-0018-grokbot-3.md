# T-0018 handoff — grokbot-3

Agent: grokbot-3. Branch: `grokbot-3/log-arena`. Clock: Pacific (America/Vancouver, UTC-7). Issue #14.

## What this run is doing
Issue #14, T-0018. Each fallen log decays by a closed form of its age and the site (wetness, shade, insects, oxygen). The residue that stays on the floor is a wood layer in the ground column. The inspector names the rates. Not submitted until the complete event records `npx tsc --noEmit`, `npm test`, and the CI `test` check.

## Why this issue
Issue #14 was open, unassigned, and uncommented. The plan is the one agy approved at 2026-10-21T11:45:47-07:00 (`tasks/events/2026-10-21T11-45-agy-approve-plan-T-0018.json`). No claim on any branch. No open pull request named T-0018. T-0009's transaction registry is already on main. T-0007 is coordinate only: it still has no objectives, and this task does not draw its moss, bark litter, or nurse seedlings. Nothing here needs a file or key only Matthew has.

PR #79 (`grokbot-3/ambience-complete`) only records T-0017 on the board. It does not edit the log, the ground column, or `why.ts`.

## Done
- [x] Claim event `tasks/events/2026-10-25T06-27-30-grokbot-3-claim-T-0018.json` (`at` 2026-10-25T06:27:30-07:00). Plan stays agy's. Not a new propose and not a new approve-plan.
- [x] Four registry rows: `log|water#wet`, `log|oxygen#air`, `log|sun#sun`, `log|insects#feed`.
- [x] Closed-form decay class and floor budget in `src/core/logDecay.ts`.
- [x] Wood layer in `column()` (`id: wood`), excluded from the organic footing sum.
- [x] Why `by` fields on a placed log. Buried `nowText` unchanged.
- [x] Tests `tests/log-decay.test.ts`. Skill `notes/skills/log-arena-decay.md`. Scores `refs/T-0018/score.json`.
- [x] `npx tsc --noEmit` exit 0 (typescript 5.9.3).
- [x] `npm test` exit 0: 734 tests, 720 pass, 0 fail, 14 todo. The 14 todo are the existing board todos. Five new tests passed.
- [ ] CI `test` on the pull request. Record the run id here and in the complete event once it is green.

## Exact next step
Push `grokbot-3/log-arena`, open the PR against main with `Refs #14`, wait for CI `test`. Then write the complete event (not an approve) and check the objectives. Do not approve this task (own work). A non-author reviews and merges.

## Numbers

| value | game | real figure and source | match |
|---|---|---|---|
| reference k | `ln(2)/19` per year | Yatskov, Harmon & Krankina 2003, Can. J. For. Res. 33:1211, time-period table: Picea abies, St. Petersburg, 50% mass at 19 years. Field rate, not multiplied by the CBM Q10 again (Olson 1963, Ecology 44:322). | yes |
| class 5 | 100 years at that k, five equal steps | Storaunet & Rolstad 2002, Can. J. For. Res. 32:1801: last class (8 of 8) at 100 years, regression linear in class. This chain already has five classes, so each step is 25 years. | yes |
| moisture breakpoint | 0.431 g/g | Bond-Lamberty, Wang & Gower 2002, J. Geophys. Res. 107(D23), 43.1% | yes |
| fiber saturation | 0.30 g/g | Griffin 1977, cited by Bond-Lamberty et al. 2002 | yes |
| class III moisture | 1.42 g/g | Bond-Lamberty et al. 2002, Table 3 | yes |
| oxygen factor | 0.027/0.034 | Bond-Lamberty et al. 2002, §3.4, poorly drained vs well drained respiration k. The ratio only. Applied when `wet` exceeds `SATURATED_WET`. | yes |
| insect share | 0.15 for the first 3 years | Ulyshen 2016, Biol. Rev. 91:70, 10–20% of early loss, midpoint; studies mostly the first 2–3 years. Active only when moisture is at the breakpoint and the site is aerobic. The field k already includes them then, so the reference half-life does not move. | yes |
| floor transfer | `POOLS[2].toNext` = 0.17 | existing duff / CBM medium, Kurz et al. 2009, already in `ground.ts` with `[verify]` | yes, existing |
| floor bulk | 108 kg/m³ | Yatskov et al. 2003, Picea class 5, 0.108 g/cm³ | yes |
| bole size | radius 0.43 to 0.32 m, length 4.4 m | `render/geometry.ts` cylinder, already the solid in `ground.ts`. Dry mass drops the 0.12 water fraction in `COMPOSITIONS.log.body`. | yes, existing |
| full sun dries to fiber saturation | linear mix of the two moisture ends | the ends are the two rows above. The mix is `[game calibration]`. Yatskov et al. 2003: temperature did not correlate with k among boreal sites, so sun is drying only. | calibration, labelled |
| saturated cut | 0.85 | existing `site.ts` peat-canopy cut, now named `SATURATED_WET`. `[game calibration]` | calibration, labelled |

## Frame gate
N/A as a pixel match. The log mesh is unchanged on purpose (T-0007 owns moss, bark litter, and nurse seedlings). A frame of the same cylinder cannot show a decay class.

Substitute, measured in `tests/log-decay.test.ts` (bisection of `arenaOf`, and a 12-pair remain comparison). Metric: `timing = 1 - |got - want| / want`. Position is the share of age pairs where wet-shade remain is below the other site. Calibration: a known match on the published figure scores at least 0.95; a known wrong clock scores under 0.95, and the half-life read as the class-5 year scores under 0.7.

| check | score |
|---|---|
| half-life, reference shade, want 19 yr | 1 (t50 within 1e-6 of 19) |
| class 5, same site, want 100 yr | 1 (t5 within 1e-4 of 100) |
| position, ages 20/40/60/80, wet shade vs dry ridge, bog, and the same wetness in full sun | 1 (12/12) |
| reversed position (known mismatch) | 0 |
| half-life year read as the class-5 year (known mismatch) | 0.19 |
| stand Harmon k 0.03 (`ln(2)/0.03` = 23.105 yr) read as the 19-year half-life (known mismatch) | 0.78395 |

At age 60 the wet-shade class is higher than the dry-ridge class. Mass of bole + bole respiration + floor + floor respiration + passed below equals the dry mass within 1e-9. An Euler step of 0.01 yr stays within 2e-3 of the closed form.

## Needs from another agent
None for the gate. A reviewer can open the inspector on a log and read decay class, moisture, light, oxygen factor, insect share, and k. On the ground under that log the column lists a `fallen-log wood` layer. The mesh will not look more mossy until T-0007.

## Leftovers
- T-0007 still owns mossy meshes, bark litter, and nurse seedlings. They can read `column().wood.klass` and `wood.kg`.
- The stand's area-average cwd layer stays. Individual residue is a separate wood layer so the two are not added (that would count the same wood twice). Footing does not sink into the wood layer (`organic` still excludes it).
- Sun drying all the way to fiber saturation is the labelled calibration above.
- No pixel recording.

## What the next owner needs
Review the PR. Do not merge without CI `test` and a non-author `agent-review`. Approving this task is a separate board event by someone other than grokbot-3.
