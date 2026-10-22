# T-0036 handoff (grok)

Status: IN PROGRESS. Plan not yet approved (needs an approve-plan from claude, codex or agy before claim / main).
Branch `grok/wolf-hydration`, worktree `C:\dev\boreal-grok-hydration` (from main a436a9d). Built on the box in
/workspace/hydration/repo and applied as a patch.

## What was built
- `src/core/needs/template.ts`: typed SpeciesTemplate (needs, stamina, behaviour) with Sourced slots; `species/_template.ts`
  copy-me; `species/index.ts` holds the wolf + hare instances and the registry (one file: the no-species-files rule).
- `src/core/needs/engine.ts`: one engine. Water: daily turnover x activity factor (metabolic power / FMR; Taylor et al. 1982
  cost of transport) x heat; 0 % = 12 % body-mass deficit. Energy: the brain's existing stat, 100 = one day of FMR, drained
  x activity factor (replaces expend's unsourced per-metre cost for the embodied player). Rest: drains moving, refills still.
- `src/core/needs/behaviour.ts`: chooseGoal (threat -> flee/alert; lowest need below its seekBelow -> drink/hunt/forage/
  bed-down with gait by urgency; else activity pattern: explore or rest), sunTimes.
- `src/core/needs/thoughts.ts` + `src/render/thoughtBubbles.ts`: drop / meat / moon icons, <30 % every 10 s fading over
  1.75 s, <=10 % red-ring pulsing alert every 3 s (1.5 s fade, ~3 Hz pulse), staggered 1.2 s and stacked in lanes; head-sensor
  anchored; first person: in the upper view.
- `src/core/wolfModes.ts`: stamina rates from the template (sprint 12 s, run 36 s, refill 10 s); the 1.5 s sprint cap is gone.
- `src/main.ts`: needs state saved under `boreal.needs.v1` (with Energy), HUD `Water n% · Rest n%`, E/A = drink when water
  is within 0.6-1.8 m of the muzzle (toggle; moving stops), hare caught adds its body water, `?needs=water:25,energy:8,rest:50`
  debug flag, autonomous wolf follows chooseGoal (walks/runs to the nearest water and drinks; beds down; rests off-peak).
- `src/core/stateFields.ts`: `needs` group tagged snapshot. Tests: `tests/needs.test.ts` (9), `tests/wolf-modes.test.ts` updated.
- `src/config/systemProperties.ts` (new; Matthew 01:2x: gameplay figures in one system properties file): group `needsThoughts`
  holds the bubble thresholds, repeat intervals, fades, opacities, stagger and pulse. No central file existed (core/tuning.ts
  is world terrain thresholds); grok/interact-outline creates the same file with an `autoFocus` group: an add/add conflict at
  merge, resolved by keeping both groups.
- Recorder: `tools/needs-record.mjs` (headless Edge CDP, fresh profile, drink/low/stagger shots), `tools/needs-probe.mjs`.
- Skill: `notes/skills/species-needs-template.md`.

## Number table (value | game | real figure + source | nature?)
| Value | Game | Real figure + source | Nature? |
|---|---|---|---|
| Wolf sprint before breather | 12 s real | Matthew min 10 s; real wolf chased a hare 6-7 min (Mech 2007, USGS) | game design (real far longer) |
| Wolf run before breather | 36 s real | Matthew min 30 s; wolves lope 8-9 km/h for hours, >72 km/day (Mech & Boitani 2003) | game design |
| Stamina refill 0->100 | 10 s real | unchanged game calibration | estimate |
| Wolf mass | 40 kg | core/species row; adults 30-50 kg (Mech & Boitani 2003) | yes |
| Wolf FMR | 15 034 kJ/d | Nagy, Girard & Brown 1999 eutherian 4.21 g^0.772 | yes (allometric) |
| Wolf water turnover | 1 895 mL/d = 47 mL/kg/d | Nagy & Peterson 1988 eutherian 0.326 g^0.818; dogs 40-60 mL/kg/d | yes (allometric) |
| Hydration 0 % | 12 % body-mass deficit (4.8 L) | AAHA 2024 dogs: 10-12 % severe, >12 % shock | yes (dog) |
| Activity factor still/walk 2/run 4/sprint 7 m/s | .45 / 1.99 / 3.52 / 5.82 x FMR | Taylor, Heglund & Maloiy 1982 JEB 97:1 | yes |
| Heat | +4 %/degC above 20 degC | panting | estimate |
| Drink rate | 7.5 mL per game s | ~2.5 mL/lap (Gart et al. 2015 PNAS) x ~3 Hz (Fig. 3B) | yes (dog) |
| Hare eaten -> water | 650 mL/kg x 1.5 kg | body water 60-70 % (Pace & Rathbun 1945) | yes |
| Energy 100 | one day of FMR | hare convention (HARE_AGENT) | convention |
| Wolf rest 100->0 | 7 game h active | longest activity bout 7 h (Theuerkauf et al. 2003 J Mammal 84:243) | yes |
| Wolf rest 0->100 | 8.5 game h still | active 45.2 % of the day (Theuerkauf 2003) | yes (derived) |
| Wolf activity | crepuscular, off-peak .35 | dawn/dusk peaks, troughs midday/midnight (Theuerkauf 2003) | yes |
| Wolf drink below | 85 % (1.8 % deficit) | dogs drink at ~1-2 % body-water deficit | estimate (dog) |
| Wolf hunt below | 60 % | more travel 2 h before a kill (Theuerkauf 2003) | estimate |
| Bed-down below | 30 % | | estimate |
| Wolf fears person within | 100 m | | estimate (order of magnitude) |
| Hare mass / FMR | 1.5 kg / 1 113 kJ/d | 742 kJ/kg/d DLW winter (Can J Zool 2015 doi:10.1139/cjz-2015-0074); Nagy eq. 1 192 (93 %) | yes |
| Hare water turnover | 129 mL/d | Nagy & Peterson 1988 at 1.5 kg | yes (allometric) |
| Hare clover water | 830 mL/kg | fresh white clover ~17 % DM (Feedipedia) | yes |
| Hare stamina | sprint 8 s, run 24 s, refill 8 s | HARE_AGENT (Matthew); run = 3x sprint | sprint/refill Matthew; run estimate |
| Hare activity | nocturnal, 50 %, off-peak .2 | Studd et al. 2019 Front Ecol Evol; Feierabend & Kielland 2014 | yes |
| Hare alert / flight | 1 s freeze, 3.7 m | HARE_AGENT (Emmel 2024) | yes / estimate (freeze) |
| Bubbles | <30 % / 10 s / 1.75 s fade; <=10 % / 3 s / 1.5 s, 3 Hz pulse | Matthew's spec | spec |

Emergent: wolf walking 100 -> 30 % water in 21.4 game h = 1.8 real h; standing ~4x longer; sprinting ~3x faster.
Drinking 30 -> 100 % in ~37 real s. Energy walking 100 -> 30 % in ~8.4 game h = 42 real min (only food restores it).

## Next step
Apply patch on the PC, full npm test + tsc, screenshots (third person low / alert / stagger, first person, drink prompt)
to /workspace/hydration/, frame answers, then ask claude/codex/agy for approve-plan + review.

## Leftovers / flags
- Autonomous wolf keeps AnimalBrain.expend's idle 'recover' energy refill (its forage loop depends on it; unsourced).
- NPC hares: the T-0009 agent pipeline (core/agent, grok/rabbit-clover) is not on main yet; `agentLevels(HARE_NEEDS)` equals
  HARE_AGENT's levels (test), so when T-0009 lands HARE_AGENT should read stamina/energy from the template and its decide
  step can call chooseGoal for water/rest. Deer (AnimalBrain, Claude's file) not wired.
- Energy is no longer restored by standing still for the embodied player (real-world: only food). Matthew may find hunger
  bites after ~40 min of walking; catch hares (+35, plus water).

## Needs from another agent
- approve-plan for T-0036 (claude, codex or agy), then review of the complete event.
