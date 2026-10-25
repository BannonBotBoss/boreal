# Skill: a why chain that names where an object is, and what an agent is doing

Use when a spawned object needs a causal chain (why it is here) and a live agent needs a goal line that must not be saved.

## Steps
1. Read `src/core/why.ts`. Tags are a closed list (`WHY_TAGS`). `on` and `by` are short ids. `WHY_MAX` is 24 and the fallen log already uses 23, so a placement cause is a `by` on an existing step (`grew`, `born`, `embedded`, `wandered`), not a new step.
2. Derive the cause from models that already exist. Do not add a threshold.
   - Stand age: `standAt` (Van Wagner 1978, the fire cycle already in `src/core/stand.ts`).
   - Sunlit gap: understorey light from `siteAt` at least as bright as `gapLight()`, which is `1 - CANOPY.stand * standStructure(FIRE.maxAge).canopy` (the gap-phase opening already in `standStructure`, Harper et al. 2002).
   - Flow: inside the river's water half-width (`riverAt`, `d <= half`) when staged terrain is on, otherwise the legacy gaussian `LEGACY_RIVER_FOLD2` in `src/core/world.ts` and below the water surface. A lake is not flow.
   - Birth: `by: 'birth'` on `born` for deer, person, hare and wolf.
3. Say the cause the code actually uses. Hares spawn in the near interest ring (`by: 'interest-ring'`). The wolf is with the player. Do not write "drawn by clover" until placement really does that (T-0009).
4. The live goal is `withDoing`. It appends one ongoing tag (`DOING`: grazing, fleeing, alerting, drinking, recovering, exploring, seeking, steered) and replaces any previous one. Ongoing tags are skipped by `anchor`, so a contact still compares the placement step. Nothing in `src/core/events.ts` may store the result.
5. Map today's drivers honestly. `doingFromProblem` reads `AnimalBrain.problem`. `explore` is `exploring` / `nothing sensed`. `doingFromAgent` reads the sim state. A graze above the species hunger line says `bout`, not hunger.
6. The inspector prints `inspectWhy` (`now` and `chain`). Static objects go through `whyOf(entity)` in `describe`. Deer, the hare and the player are live, so the doing step is added in `observed`.

## Checks
- `tests/why-place.test.ts`. The age in the chain equals `Math.round(standAt(...).age)` (known match) and does not equal that age plus one (known mismatch).
- `tests/contact.test.ts` still passes: a kind with no position keeps the old words, a stored chain wins, the log stays 23 steps.
- `npx tsc --noEmit` and `npm test`.

## Mistakes to avoid
- Adding a placement step onto the log chain. It already has 23 of 24 steps.
- Storing the doing step on the record. It changes every frame and would grow the save.
- Claiming a sunlit gap or a habitat for an object the generator did not place that way.
- A new light or river-width number. Both come from the stand and river code that is already cited.
- Editing `why.ts` on top of another open branch that is also changing the chain. Read that diff first.
