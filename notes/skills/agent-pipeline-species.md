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

## What T-0011 added (white-tailed deer)

The hare row has no `social` field. Leave it that way. A species with `social` takes the herd path inside the same `stepAgent`: no `rng` call (utility noise, jitter, zig, rest span and the feed step are all off), bout lengths from `herdBouts`, alarm delay from `alarmDelay`. Do not add a second pipeline and do not call `AnimalBrain.decide` for that species.

Vigilance here is Lashley's linear feeding-time slope (females, +0.07 per extra deer, flat after group size 4), not the hare power law in `needs/social.ts`. Do not copy `vigilance()` onto the deer. The lone intercept 0.36 is an estimate so the slope stays inside 0..1; say so.

A chew is one bite of fresh mass (`biteG`), not a sound timer. Hooves are gait-phase crossings while fleeing. The snort is the bolt event. `deerSoundIds` keeps the old escape-edge snort only when `snort` is omitted, so an old caller does not go silent and a new caller does not snort twice.

Herd alarm uses the previous step's posture. `senseHerd` sets `distance` to Infinity so flight-initiation distance is the wolf's, not the mate's. The implied threat sits behind the mate (heading 0 faces -z). Delay is `distance / 343` only when the acoustic cue leads, plus `attend / cue`.

Browse is a virtual `browse:ground` contact (`deer` | `browse`, Koerth 7.8 g fresh/min). Forest depletion and regrowth stay T-0015. Do not build that field here.

Deer rigs are still dropped before the chunk commits (T-0047). A pixel frame of a deer body is not a behaviour score until that lands. The calibrated substitute is the vigilance slope, `alarmDelay` against 343 m/s, and the 7.8 g/min intake. Do not invent a 95% pixel match.
