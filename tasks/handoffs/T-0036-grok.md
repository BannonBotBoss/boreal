# T-0036 handoff (grok)

Status: BUILT, recorded; NOT submitted. Plan not yet approved (needs an approve-plan from claude, codex or agy before claim / main).
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

## Recording (box headless Chrome, SwiftShader; one PC run off-screen before the rule)
Tool: `tools/needs-record.mjs` (CDP; fresh profile; on the box run with `node --experimental-websocket` and Chrome
`--headless=new --use-angle=swiftshader`). Frames + per-frame HUD/act text: box /workspace/hydration/frames3 (drink, low,
stagger) and /workspace/hydration/frames (alert, PC). Picked shots: /workspace/hydration/shot-*.jpg.
- low (`?needs=water:25`): a pale, semi-transparent drop rises above the head and fades; the next one ~10 s later.
- alert (`?needs=water:6`): a red-ringed drop, more opaque, rises and fades in ~1.5 s (shot-alert-sequence.jpg, 5 frames).
- stagger (`?needs=water:20,energy:15,rest:25`): meat (energy, lowest) in lane 0, drop in lane 1 higher, offset in time.
- drink (`?at=14.37,7.53,2.02&needs=water:22`, staged terrain): prompt "E / click · drink", click -> "Drinking. Move to stop.",
  HUD `DRINKING`, water 22 -> 26 % over the burst (sim runs slow under software GL).

## Frame answers
1. What do I see? The wolf from behind on a meadow by a lake; a round icon (drop / meat) floats up from just above its head,
   semi-transparent, fading out; when critical, a red-ringed drop, brighter, repeating faster; two needs show two icons,
   one above the other, at different moments; at the shore the action button offers drink and the HUD says DRINKING.
2. Natural? It is UI, not nature: the gate question is "does it match Matthew's description" (semi-transparent icons
   floating up from the head, fading in 1-2 s, every 10 s; alert pulsing faster near critical). Timing is tested in
   tests/needs.test.ts (10 s / 3 s / 1.75 s / 1.5 s / 3 Hz pulse); the frames confirm placement, transparency and style.
3. Reference: none generated (UI element; no nature reference applies) -> uncalibrated visual score; the measured
   timing tests are the gate evidence. A reviewer may want a short real-GPU video at 60 fps to see the pulse.
4. No drinking pose (head stays up while drinking): leftover for Gait Builder (head-down lap pose).

## Next step
Ask claude/codex/agy for approve-plan, then claim, then complete + review.

## Leftovers / flags
- First person: the game has no first-person camera today; the renderer's fallback (bubbles in the upper view when the
  camera is within 0.9 m of the head) is untested.
- Drinking pose (head down, lapping) not animated; the sim's needs run on the fixed step, so slow frames slow drinking too.
- Autonomous wolf keeps AnimalBrain.expend's idle 'recover' energy refill (its forage loop depends on it; unsourced).
- NPC hares: the T-0009 agent pipeline (core/agent, grok/rabbit-clover) is not on main yet; `agentLevels(HARE_NEEDS)` equals
  HARE_AGENT's levels (test), so when T-0009 lands HARE_AGENT should read stamina/energy from the template and its decide
  step can call chooseGoal for water/rest. Deer (AnimalBrain, Claude's file) not wired.
- Energy is no longer restored by standing still for the embodied player (real-world: only food). Matthew may find hunger
  bites after ~40 min of walking; catch hares (+35, plus water).

## Needs from another agent
- approve-plan for T-0036 (claude, codex or agy), then review of the complete event.

## Part 2 (2026-10-22 01:41-01:57 PT additions): diets, senses, groups, vigilance, headless sim

Separate commit set on top of the T-0036 needs work (branch `grok/hunt-senses` = `grok/wolf-hydration` + this commit;
`grok/wolf-hydration` fast-forwarded to it). Scope as recorded in Matthew's T-0036 approve-plan event (01:55).

### Public module path (stable): `src/core/sim`
Headless, no Three.js (test walks the imports): `createWorld(opts)`, `createAnimal(world, speciesId, {x, z, heading?}, {controlled?})`,
`addFood(world, kind, x, z, kg)`, `tick(world, dt)` (fixed sub-steps of `world.step`; coarse ticks: raise `step`),
`nearbyAnimals / nearbyFood / nearbyWater`, `takeEvents` (`caught`, `bolt`, `ate`), `removeAnimal`.
An embodied animal is `controlled`: the adapter writes x/z/heading/speed/mode/pouncing, the sim senses it and tests captures.
`animals/hare.ts` is now only the render adapter (spawn/despawn, meshes, hop animation) over a `core/sim` world.
Pure modules it uses: `core/needs/senses` (perceive: sight in FOV, hearing of footfalls, smell via `core/senses` scentLevel),
`core/needs/diet` (one `DietModule` interface: carnivore / herbivore / omnivore; meal energy + water; capture test; Howland jink evasion),
`core/needs/social` (link-distance shared detections, scatter, vigilance group-size effect).
System properties groups (main's file, alphabetical, with PROPERTY_META + SYSTEM_MAP system `animalSim`): `hunt`, `perception`, `sim`, `social`.

### Template additions (every species, sourced; `_template.ts` updated)
| field | wolf | hare | source / flag |
|---|---|---|---|
| sight range / FOV | 60 m / 250 deg | 26 m / 360 deg | dogs 240-250 deg (Miller & Murphy 1995); leporid panoramic ~360 deg (rabbit, Hughes 1971); ranges game calibration |
| hearing range | 40 m | 22 m | game calibration (HARE_AGENT for the hare) |
| smell potency | 1.0 | 0.8 | wolves scent prey ~2.4 km downwind (Mech 1970), relative scale |
| diet | carnivore: hare 6000 kJ/kg x .9, 650 mL/kg, 1.5 kg | herbivore: clover 3128 kJ/kg wet x .36, 830 mL/kg, bite .362 g / 3 s | prey energy estimate; clover GE 18.4 MJ/kg DM x 17 % DM (Feedipedia); hare assimilation derived to close FMR 1113 kJ/d on 167 g DM/d |
| top / tired flight speed | 15.5 / 2.4 m/s real | 12.5 / 11.2 m/s real | wolf 56-64 km/h (Mech & Boitani 2003); hare 45 km/h (ECCC Hinterland Who's Who); hare tired speed estimate (tuned) |
| burst length | stamina sprint 12 s | stamina sprint 8 s | same stamina field for player and NPC (one engine) |
| lateral grip | 13 m/s2 | 30 m/s2 | cheetah 13 m/s2 (Wilson et al. 2013) as bound; hare value an estimate (small prey out-turn predators, Howland 1974) |
| group size / spacing | 2-8 / 5 m | 1-4 / 20 m | packs 5-8 (Mech & Boitani); hares usually solitary, loose feeding aggregations (Behav Processes 1997; ADW); 5-10 hares/ha peak -> 16-22 m nearest neighbour (Keith 1990) |
| link distance / relay | 40 m / .5 s | 22 m / .3 s | hare: hind-foot thump is the alarm, mates freeze (ADW, EALT); link = hearing range (estimate) |
| vigilance lone share / exponent | .1 / 0 | .3 / .3 | Roberts 1996; Monaghan & Metcalfe 1985 (brown hares feed more, corporate vigilance rises with group); Marboutin & Aebischer 1996 r = -0.32 (weak); estimates |
| scatter | 0 | .6 rad | confusion effect (Krause & Ruxton 2002), angle estimate |

What the sources say about snowshoe hare groups: usually solitary with overlapping home ranges (ADW); they aggregate
temporarily at rich feeding sites (windfalls), and arrivals/departures are independent of group size, i.e. food-driven
aggregation, not a social group (Behav Processes 1997). Densities cycle from <0.1 to 5-10 hares/ha (Keith 1990). Main signal:
hind-foot thumping; others freeze. No herd values were invented: group max 4 at a patch is flagged as an estimate.

### Behaviour now
- Hare (NPC): own detection from senses -> freeze (react 1 s x jitter) -> bolt inside flight distance 3.7 m x (.5 + 1.5 x perception) or
  when the freeze ends and the wolf is not stalking; flee = Howland jink inside the pursuer's turning radius + zig-zag, grip-limited turns,
  scatter away from linked mates. Linked mates (<= 22 m, chains count) share the detection after .3 s per link; out of link, no relay.
  Graze bouts lengthen with linked mates (vigilance), so grouped hares feed longer and still detect earlier.
- Wolf (NPC, in core/sim): behaviour model goal; hunt = stalk (crouched, .2 x walk) the best-perceived hare, chase on its bolt, pounce at 3 m.
- Embodied wolf: a capture runs the carnivore diet module (+54 Energy, +20 % hydration from a 1.5 kg hare).

### Capture tuning (tools/hunt-sim.ts: headless, 120 chases per style, keys steer 2.2 rad/s as main.ts)
| style | approach | catch rate | tries per catch |
|---|---|---|---|
| super-stealth stalk, react .2 s, pounce at 3 m | bolt gap 4.4 m | 37 % | 2.7 |
| stealth stalk, react .3 s, pounce at 3 m | bolt gap 4.4 m | 59 % | 1.7 |
| walk straight in, react .45 s, contact only | bolt gap 13.9 m | 46 % | 2.2 |
Field reference: coyote 36.9 %, lynx 28.7 % of chases on snowshoe hares (O'Donoghue et al. 1998, Oikos 82:169; older coyote reports 6-10 %).
So a catch takes about 2-3 tries. Caveat: the 12 s sprint (Matthew's >= 10 s) outlasts the hare's 8 s burst, so endurance, not stalking,
decides most chases (catches cluster at 5-10 s); stalking closer does not raise the rate in this model. Levers if it should reward stealth more:
grip-limit the player's turns while sprinting (wolf 13 m/s2 -> 1.2 rad/s at 10.5 m/s), cover the hare can reach, or a shorter wolf sprint.

### Tests (tests/sim.test.ts, node, no renderer)
every species defines needs/senses/stamina/diet/social (sourced, finite); stamina wolf >= 10/30 s, hare burst shorter; FOV (hare sees behind,
wolf not) and stealth hides a slow crouched body; both diets refill Energy + hydration; relay inside link distance, none outside (+ chain);
vigilance: linked hare grazes a larger share and detects a stalking wolf no later; scatter outward; 200 hares + 5 wolves x 10 sim min
(~8-11 s wall at .1 s steps); no Three.js import under core/sim; capture rate within 10-75 % for skilled and naive.
npm test on the branch: 381 pass, 1 fail = tests/trace.test.ts "trace off: hooks are pass-through" (allocation check, passes alone; flaky under load).

### Playing as a hare: what is missing
The data and sim plug in (template, senses, herbivore diet, stamina, group awareness all generic). Missing: (1) a playable hare body/rig in
the Play-as list (`view.playable` only has the wolf here; T-0009's bounding rig on grok/rabbit-clover); (2) the clover patches are on
grok/rabbit-clover (T-0009), not main: the adapter must `addFood(world, 'clover', ...)` from them; (3) controls for hare gaits (hop/bound)
mapped to the template speeds; (4) the predator-awareness cue: `strongestThreat` + `threatCue` (core/needs/senses) and `relayed` on the sim
animal exist, but the HUD/halo wiring waits for an embodied prey (plan: push relayed alarms as sound cues into the existing senses halo,
no new ring; auto-focus radius stays invisible); (5) NPC wolves in the rendered world (core/sim has them; no renderer adapter yet).
No recording of a chase yet (needs scripted input in the recorder); the headless sim table above is the evidence.
