# Skill: add a species or forage resource to the shared agent pipeline, with nature-checked numbers

Use when adding an animal (or a food it eats) that should behave from senses + levels -> goal -> action -> contact
transactions, with no random actions or bare timers.

## Steps
1. Reuse first: read the pipeline (`src/core/agent.ts`), the behaviour rows (`BEHAVIOUR` in `src/core/species.ts`; the hare is
   `HARE_AGENT`), the transaction registry (`src/core/transactions.ts`), and the clover field (`src/core/fields.ts`). Tests
   are `tests/agent.test.ts`. Search core/ for climate, season, daylight and clock helpers before writing any.
   Do not replace `core/sim` `stepPrey`: the live herd still uses it, and `tests/sim.test.ts` pins those bouts. A new species
   sits on `AgentSpecies` and `stepAgent`. The hare bound gait is `HARE_GAIT` in `core/needs/species`, not a second copy.
   `groundLight` is site shade times solar shortwave (W/m² at one instant). Clover's closed-form sun tables stay on
   `lighting().day`. Do not feed shortwave into `sunSeconds`. Flight cost ×8 and the 8 s stamina window are flagged
   (Matthew's spec, pinned by the tests); do not silently replace them with a sourced figure or the tests fail.
2. Ask "why is it here?" and "what gives?": write the causal chain (why steps) and every transaction as a pair
   (eater <-> food while in contact; food <-> sunlight; animal <-> threat by senses).
3. Pick units that map to a real quantity (g dry matter, kcal) and write the mapping in the file header.
4. For every number: find a real figure with a citation (paper DOI, agency page). Make a table:
   value | game number | real figure + source | resembles nature? If a given number fails, replace it and say so; if no source
   exists, flag it with the reason and its effect size. Never tune a sourced number to look nicer.
5. Derive rates instead of inventing them (e.g. intake per second = daily intake / (foraging hours x fraction actually
   cropping)); check with a second, independent source when you can (e.g. bite counts x item mass).
6. Separate clocks: animal motion and metabolism in world seconds; growth on world seconds scaled by daylight, temperature
   and site light from the existing climate. Note any time compression (day dial vs world clock) in the report.
7. Model the residual: what an eater cannot take (roots, stolons, growing points) and regrowth from it.
8. Species data only: new species = a new record; the pipeline gets no species-specific numbers.
9. Tests: assert the sourced rates (with tolerance), the residual, night/cold/shade zero cases, and the emergent outcome
   (time to graze out, time to recover) as numbers, plus the existing behaviour tests.
10. Record in game (headless browser, frames ~10 fps with per-frame state), sample frames, and answer the animation gate:
    what do I see? does it look natural, compared with a reference that has the same description? does the reference show
    nature? does the game match it in timing and position (honest % per question)?

## Checks that proved it worked
- npx tsc --noEmit clean; npm test green (known flaky: the trace allocation test).
- Numbers script printing the emergent times (graze-out, recovery) from the real constants.
- Recording + per-frame state JSON + contact sheet + reference image, scores per question.

## Mistakes to avoid
- Keeping a requested number that contradicts nature without flagging it.
- Units with no physical meaning (they hide 100x errors).
- Staging state for a screenshot without saying so.
- Food state that resets when a tile unloads (depletion silently disappears).
- Killing a shared dev server or leaving headless browsers running; git reset --hard.
- Copying the agent's energy back onto the brain. `stepNeeds` owns Energy. `unitsPerEnergy: Infinity` so the pipeline does not also grant `FORAGE_ENERGY`.
- Treating the segment-segment gap as how far the body is from a log. A crossing path has gap 0, so the wolf would jump at once. Use the distance from the body to the centreline.
- Detouring out to a log end during the jump cooldown. If the hop was the cheaper plan, keep walking toward the goal while the legs recover.
- Scaling a log up to make the detour long. Mesh scale fattens the radius too. One hop at the lope is `jumpHopM` (2.08 m at 2.4 m/s). A log wider than that is walked around even when the vertical joules look cheaper.
- Putting food at exactly `reach.food`. Approach utility subtracts distance / approachDistance, and at the cap it loses to rest.
- Giving a person `utility.approach` above 0. With hunger at 0 that term still walks them to berries. Hunger is the approach term (`approach` base 0, `feedHere` 0).
- Passing a friend as a feared `other`. The friend record is a lure. A stranger is the wolf `other`. Both at once makes them flee the friend.
- Leaving `timing.react` at the hare's 1 s. The shared pipeline bolts a moving cue once `react` elapses, even outside the flight distance. A visitor watches until `flee.distance`; `react` stays long so the distance is the cause.
- Editing `src/core/agent.ts` for a person. T-0011's open PR already rewrites that file for the herd. A person is a new `AgentSpecies` plus `stepVisitor`.

## Wolf route on the same pipeline (T-0010)
1. Add `BEHAVIOUR.wolf` by reading `WOLF_NEEDS` (senses, lope, sprint, fed, stamina, flight distance). Do not copy those numbers into a second table. Flag mood bends, `full`, the 1.2 m lure hold, `movingAt`, and the rest recheck.
2. `autonomousWolfStep` calls `createAgent` once and `stepAgent` each frame. It does not call `AnimalBrain.decide`. `main.ts` still calls `decide` with a player command. Drink and bed-down stay on `chooseGoal` (`steerOnly`).
3. `plan()` (`src/core/plan.ts`) compares two costs on the straight path to the goal. Detour joules are `travelJ` (Taylor, Heglund and Maloiy 1982, the same split as `metabolicW`) over the extra metres. Jump joules are the vertical kinetic energy of `jumpArc` (`PHYS.jumpSeconds`). Pass the rig mass. Both costs are per kilogram; the allometric exponent does not cancel.
4. Jump only a low blocker, only when the jump costs less than the detour, and only when `jumpHopM(speed)` clears the far bark plus `JUMP_LAND_M`, inside `JUMP_REACH_M`. Otherwise walk straight until that window, or walk around. No goal means no route and no jump.
5. Lures are optional. `utility.investigate` omitted or 0, and no lures, leaves the hare row unchanged. A water lure's level has to beat rest-while-full or a sated wolf will not walk to the drink.
6. Show the goal and the cause on the status line and in the player inspector (`wolfReadout`). Clear the plan when the wolf is not driving, so a manual frame does not keep a stale goal.
7. Position gate: `tests/autonomy.test.ts`. Score is `1 - |z - expected| / |expected|` with `expected = -approach * (seconds - 1/30)`. Known match: jump count 0 and displacement 0 with nothing sensed, including a log the old 1.8 m rule would jump. Known mismatch: `oldWouldJump` is true for that log. Pixel frames are not this metric.

## What T-0011 added (white-tailed deer)

The hare row has no `social` field. Leave it that way. A species with `social` takes the herd path inside the same `stepAgent`: no `rng` call (utility noise, jitter, zig, rest span and the feed step are all off), bout lengths from `herdBouts`, alarm delay from `alarmDelay`. Do not add a second pipeline and do not call `AnimalBrain.decide` for that species.

Vigilance here is Lashley's linear feeding-time slope (females, +0.07 per extra deer, flat after group size 4), not the hare power law in `needs/social.ts`. Do not copy `vigilance()` onto the deer. The lone intercept 0.36 is an estimate so the slope stays inside 0..1; say so.

A chew is one bite of fresh mass (`biteG`), not a sound timer. Hooves are gait-phase crossings while fleeing. The snort is the bolt event. `deerSoundIds` keeps the old escape-edge snort only when `snort` is omitted, so an old caller does not go silent and a new caller does not snort twice.

Herd alarm uses the previous step's posture. `senseHerd` sets `distance` to Infinity so flight-initiation distance is the wolf's, not the mate's. The implied threat sits behind the mate (heading 0 faces -z). Delay is `distance / 343` only when the acoustic cue leads, plus `attend / cue`.

Browse is a virtual `browse:ground` contact (`deer` | `browse`, Koerth 7.8 g fresh/min). The grazed stock is one 8 m cell on the forage field (T-0015, `takePatch`). Do not add a second depletion map.

Deer rigs are still dropped before the chunk commits (T-0047). A pixel frame of a deer body is not a behaviour score until that lands. The calibrated substitute is the vigilance slope, `alarmDelay` against 343 m/s, and the 7.8 g/min intake. Do not invent a 95% pixel match.

## Visitors on the same pipeline (T-0012)
1. Add `BEHAVIOUR.person` in `src/core/species.ts`. Do not edit `src/core/agent.ts` while T-0011's PR is open: that PR rewrites the herd inside the pipeline. `src/core/visitors.ts` calls `createAgent` / `stepAgent` only.
2. Berries are forage entities wrapped as a `FoodSource`. The pick transaction is `person | forage` and it runs only while the feed contact is on the bus. Water is a lure aimed at `drinkPoint` (the last dry step toward `nearestWater`), not a second food. A friend (`records[key].relationship === 'friend'`) is a lure. A stranger is one `other` of kind `wolf`.
3. `utility.approach` and `utility.feedHere` stay 0 so hunger is what walks them to a patch and keeps them picking. `utility.noise` and `timing.jitter` stay 0 so the path is the need. `timing.react` stays long so a moving wolf outside `flee.distance` is watched, not bolted.
4. Gait: comfortable 1.393 m/s and fast walk 2.533 m/s (Bohannon 1997, men in their 20s). Energy 100 is the 2000 kcal reference day, spent over one game day (`PERSON_DAY_S`). Berry grams per energy point are `(2000/100) / (57/100)` from USDA FDC 171711. One berry per second is an estimate; the 1.36 g berry is the USDA 50-berry portion.
5. Hydration 100 = euhydrated, 70 = 3% body-mass deficit (Engell et al. 1987). The day drain is the 3.0 L beverage AI (IOM 2004) on the ICRP 23 70 kg reference man, mapped onto a 10% span, over `PERSON_DAY_S`. A 0.3 L cup is 12 real seconds. The reference kilograms are not the mesh mass.
6. The live LOD in `buildScene` copies `stepVisitor` onto the entity. Rest lowers the figure by `PERSON_SIT_M` (0.45 m, a pose the clay legs can show). There is no `sin(time * .7)` sway. The inspector reads `visitorReadout` into `withDoing`.
7. Position gate: `tests/visitors.test.ts`, `trackScore`. Known match: sated displacement 0. Known mismatch: the old sway `sin(time * .7 + seed) * .07` does not score as a still heading. Berry walk, water walk, friend walk and the fast step-back use `speed * (seconds - 1/30)` at 30 Hz.

## Traces on the same pipeline (T-0019)
Scent marks, carcasses and droppings are `notes/skills/trace-deltas.md`. Do not replace `stepPrey` bout logic. The hare hook runs only when a delta is smelled or a bite has just landed. An empty log leaves the graze timers alone.

Do not put the wolf's 2400 m trace range on a live body. Body odor stays on `SENSES.range` (the x = 41 m scent test). Only `deltaSources` sets `source.range`.
