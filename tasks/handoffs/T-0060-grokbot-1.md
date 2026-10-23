# T-0060 handoff (grokbot-1)

- **Doing / done:** deep-time model (tasks/T-0060-deep-time.md). Code, tests, review page, skill, system-map entry are written and green.
- **Authority (rule 10, quoted, not an approval of this specific task):** Matthew via Grok Bot, 2026-10-23: "Just figure it out" (~11:34 PT),
  and earlier the same day "i want you to touch main" (direct pushes to main allowed). No non-author approve-plan exists for T-0060, so no claim
  or complete event is written (the ledger would flag them); the task is left `proposed`. Needs a non-author approve-plan/approve, or Matthew.
- **Prior art searched:** src/, tasks/, docs/, notes/, all remote branches (git log --all -- tasks/T-*; T-0044..T-0059 titles), open PRs #41 #44 #45,
  issue #43. Nothing on deep time. Reused: core/weather `AIR.S0`, `AIR.sigma`; the repo's `tools/*.html` review-page pattern; system-map wiring.
  Published models adopted by formula (no code to vendor): Gough 1981 (Feulner 2012 Fig. 1 shows it matches Bahcall 2001 solar models).
  Considered, not added: a full stellar-evolution code (MESA/Padova tracks) - overkill for a dial; Berger 1978 orbital forcing - T-0057 says no.

## Gap analysis (file evidence)
| Vision pillar | Status | Evidence |
|---|---|---|
| Digital twin globe, spin/zoom, descent to ground | partial-done | src/world/globe/*, T-0034/T-0043, PR #45, issue #43 (budgets T-0057..59 proposed) |
| Procedural everything, 95% realism target | partial | PROJECT-RULES.md rules 1-11; terrain/trees/rocks/rivers done (core/stages/*), many animals still provisional (core/species.ts `provisional: true`) |
| Behaviour from scientific data | partial | needs/senses/diet/social in core/needs/* with `Sourced` numbers (T-0036); only wolf, deer, hare |
| Animations from video, frame-by-frame | partial | T-0020 gate, gait-data, tools/hare-sheet; reference-gate not met for most behaviours |
| Transactional logic, inspectable per animal | partial | core/why.ts, T-0008/T-0009/T-0016, thought bubbles; hunt/forage on shared core, not all species |
| Time control: day/hour | done | ui/chronometer.ts, core/timeOfDay.ts |
| **Time control: reverse to no globe / forward to engulfment** | **missing -> this task (model)** | grep luminosity/Gyr/deep time = no hits in src, tasks, docs, notes |
| Start of life, microscopic watery world | missing (model now gives the stage + date; the world itself is not built) | no microbe/plankton code anywhere |
| Blue whale: feed, breach, air need, calf learns | missing | `rg whale` hits only rocks.ts false positives; no cetacean plan in core/species.ts; no air/oxygen need (NeedId = water/energy/rest) |
| Species locator tool | missing | no code |
| Embody any creature (first/third person) | partial | render/playables.ts + PR #44 (hare); wolf only on main; bear body exists (core/bearBody.ts) |
| Bird's-eye follow a bear, cooperative foraging | missing/partial | bear body + render/bear.ts; no follow cam, no cooperation logic; bird plans exist in core/species.ts, no flight behaviour |

## Why this gap
Highest-value because it is the opening of the player's experience in the vision ("players start off with a view of the world, and have a tool
to control the value of time"), nothing else owns it (T-0057..59 are today's budgets, PR #44/#45 are hare/globe), it is data + a pure function
(rules 2, 5, 7, 8: one module, cited, closed form) and the whale/microbe worlds both need its stage + date as their first input.

## Numbers (rule 6)
| value | game | real figure + source | resembles? |
|---|---|---|---|
| Te now | 254.0 K | 254.0 K, NASA Earth Fact Sheet (A = 0.306) | yes (calibration point) |
| Sun at birth | 71.4 % | ~30 % lower, Feulner 2012 Rev. Geophys. 50:RG2006 | yes |
| Brightening | +0.97 % at +110 Myr | 1 % per ~110 Myr, Wolf & Toon 2015 | yes |
| Moist-greenhouse onset | +1.27 Gyr (S +12.5 %) | flux +12.5 % S0, Wolf & Toon 2015 JGR 120:5775 (years from the Gough fit) | yes, years depend on Gough fit |
| Runaway | +1.98 Gyr (S +21 %) | +21 % S0; ~2 Gyr hence | yes |
| Engulfment | 7.59 Gyr | Schroder & Smith 2008 MNRAS 386:155 | yes |
| Earth forms | -4.54 Gyr | Dalrymple 2001 (4.54 +- 0.05) | yes |
| Life | -3.7 Gyr | Nutman 2016 Nature 537:535 | yes (disputed date, stated) |
| Cambrian | -538.8 Myr | ICS chart v2026-06 | yes |
| K-Pg | -66.043 Myr | Renne 2013 (checked via search: 66.043) | yes |
| Homo sapiens | -315 kyr | Richter 2017 Nature 546:293 (315 +- 34 ka, checked) | yes |
| Great Oxidation | -2.4 Gyr | Bekker 2004 Nature 427:117 | [verify] from memory, not re-read |

## nature-realism-inspection (this is a model, not a rendered item)
Items: dial, stage text, Te, luminosity, milestones. Each exists because the vision asks for the axis; every number has the citation in the
table above. Score: numbers 100 % match to their sources where checked (11 of 12; the 12th is tagged [verify]); stage descriptions are text, not
yet rendered: **visual realism is unmeasured (N/A, nothing is drawn in the game yet)**. Open gaps: surface temperature before 2.4 Ga is not
modelled (Te only; faint young Sun), Hadean wording is generic, nothing shown on the globe yet, no recording (rule 6 frame gate N/A for a
non-visual model; screenshots of the review page are in the PR/commit notes below).

## Next steps for the next owner
1. Wire `deepTimeAt` into the chronometer UI (a second ring) and into the globe's sun brightness/atmosphere (needs PR #45 merged first).
2. `microbial` stage -> a microscopic watery world (nutrient chemotaxis, Berg & Purcell 1977 / Berg 1993 for E. coli run-and-tumble) using core/needs.
3. Whale: add 'air' to `NeedId` (breath-hold, Kooyman diving physiology) and a cetacean plan; the calf-learns pillar needs social learning in core/needs/social.
4. Great Oxidation row: re-read Bekker 2004 and drop [verify].
