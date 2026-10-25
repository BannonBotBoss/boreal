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
- Stripping `AnimalBrain.decide` while deer still call it (T-0011). That idles the herd and fails `tests/animal-behavior.test.ts`.
- Copying the agent's energy back onto the brain. `stepNeeds` owns Energy. `unitsPerEnergy: Infinity` so the pipeline does not also grant `FORAGE_ENERGY`.
- Treating the segment-segment gap as how far the body is from a log. A crossing path has gap 0, so the wolf would jump at once. Use the distance from the body to the centreline.
- Detouring out to a log end during the jump cooldown. If the hop was the cheaper plan, keep walking toward the goal while the legs recover.
- Scaling a log up to make the detour long. Mesh scale fattens the radius too. One hop at the lope is `jumpHopM` (2.08 m at 2.4 m/s). A log wider than that is walked around even when the vertical joules look cheaper.
- Putting food at exactly `reach.food`. Approach utility subtracts distance / approachDistance, and at the cap it loses to rest.

## Wolf route on the same pipeline (T-0010)
1. Add `BEHAVIOUR.wolf` by reading `WOLF_NEEDS` (senses, lope, sprint, fed, stamina, flight distance). Do not copy those numbers into a second table. Flag mood bends, `full`, the 1.2 m lure hold, `movingAt`, and the rest recheck.
2. `autonomousWolfStep` calls `createAgent` once and `stepAgent` each frame. It does not call `AnimalBrain.decide`. `main.ts` still calls `decide` with a player command. Drink and bed-down stay on `chooseGoal` (`steerOnly`).
3. `plan()` (`src/core/plan.ts`) compares two costs on the straight path to the goal. Detour joules are `travelJ` (Taylor, Heglund and Maloiy 1982, the same split as `metabolicW`) over the extra metres. Jump joules are the vertical kinetic energy of `jumpArc` (`PHYS.jumpSeconds`). Pass the rig mass. Both costs are per kilogram; the allometric exponent does not cancel.
4. Jump only a low blocker, only when the jump costs less than the detour, and only when `jumpHopM(speed)` clears the far bark plus `JUMP_LAND_M`, inside `JUMP_REACH_M`. Otherwise walk straight until that window, or walk around. No goal means no route and no jump.
5. Lures are optional. `utility.investigate` omitted or 0, and no lures, leaves the hare row unchanged. A water lure's level has to beat rest-while-full or a sated wolf will not walk to the drink.
6. Show the goal and the cause on the status line and in the player inspector (`wolfReadout`). Clear the plan when the wolf is not driving, so a manual frame does not keep a stale goal.
7. Position gate: `tests/autonomy.test.ts`. Score is `1 - |z - expected| / |expected|` with `expected = -approach * (seconds - 1/30)`. Known match: jump count 0 and displacement 0 with nothing sensed, including a log the old 1.8 m rule would jump. Known mismatch: `oldWouldJump` is true for that log. Pixel frames are not this metric.
