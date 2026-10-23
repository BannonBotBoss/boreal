# Skill: give a creature needs, stamina and a behaviour model with the species needs template

Use when a new animal should get thirst/hunger/fatigue, stamina, thought bubbles and need-driven behaviour, whether the player
embodies it or it runs as an NPC. No engine code changes: a creature is one data file.

## Files
- `src/core/needs/template.ts`: the typed `SpeciesTemplate` (commented fields) and `Sourced` = { v, src, est? }.
- `src/core/needs/species/_template.ts`: COPY ME (every slot NaN + 'TODO: source').
- `src/core/needs/species/index.ts`: the filled instances (WOLF_NEEDS, HARE_NEEDS) and the registry `NEEDS_SPECIES`, all in one file (PROJECT-RULES: no species-specific source files; tests/rules.test.ts).
- `src/core/needs/engine.ts`: generic drain/restore (`stepNeeds`, `eatWater`, `staminaRates`, `agentLevels`).
- `src/core/needs/behaviour.ts`: needs + activity pattern + threat -> goal + gait (`chooseGoal`, `activityAt`, `sunTimes`).
- `src/core/needs/thoughts.ts` + `src/render/thoughtBubbles.ts`: the bubble schedule and its sprites.
- `src/config/systemProperties.ts` `SYSTEM_PROPERTIES.needsThoughts`: every non-species gameplay figure of the bubbles
  (30 % / 10 % thresholds, 10 s / 3 s repeats, fades, opacities, stagger, pulse). Species numbers never go there, and
  system figures never go in a species record. Add a new system as its own group so parallel branches merge cleanly.
- `tests/needs.test.ts`: the source check and the same-engine-on-both-species tests.

## Steps
1. Reuse first: the body mass comes from the creature's row in `core/species` MAMMALS (the test checks they match). If
   it has an agent record in `core/agent/species.ts` (T-0009 pipeline), copy its sourced numbers (stamina seconds, energy
   drain, alert react, flight distance) and cite the record; do not invent new ones.
2. Copy the record in `_template.ts` into `species/index.ts` as `<ID>_NEEDS`; fill every slot. Order of preference for each number: a measurement of that
   species (doubly labelled water FMR, water flux, radio-tracked activity budgets, flight initiation distance), then a
   published allometric equation at its mass (FMR: Nagy, Girard & Brown 1999 eutherians 4.21 g^0.772 kJ/d; water flux: Nagy
   & Peterson 1988 eutherians 0.326 g^0.818 mL/d), then a related species, flagged in `est`. Write the derivation into `src`.
3. Units: rates on GAME time (world clock, 1 real s = 12 game s); stamina in REAL seconds; levels 0..100 %. Energy 100 = one
   day of FMR (the hare's convention): the engine drains the host's existing Energy, never a copy.
4. Behaviour: activity pattern + active share (activity budgets), drive thresholds (`seekBelow`) per need, `gaitAt` urgency
   steps, alert react seconds + freeze, fears + flight distance. Thresholds without a measurement are flagged estimates.
5. Register it in `NEEDS_SPECIES` (same file). If the player can embody it, `needsSpecies()` in main.ts picks it by `view.playable.id`.
6. Add its expectations to tests/needs.test.ts (the generic tests loop over every registered species; add any
   species-specific derived number, e.g. measured vs predicted FMR).
7. Number table in the task handoff: value | game number | real figure + source | resembles nature? (yes/no/estimate).
8. Record: `?needs=water:25` (low bubble), `?needs=water:6` (alert), `?needs=water:20,energy:15,rest:25` (stagger) and
   `?at=x,z` near water to show the drink prompt; screenshot third person and first person.

## Checks that proved it worked
- `npx tsx --test tests/needs.test.ts tests/wolf-modes.test.ts`; full `npm test`; `npx tsc --noEmit`.
- Every `Sourced` has a non-TODO `src` (test); template paths equal the wolf's (test), so a field added to the template must
  be filled for every species.
- Emergent times printed in the handoff (wolf: 100 -> 30 % water in ~1.8 real hours of walking; drinking 30 -> 100 % in ~37 real s).

## Mistakes to avoid
- A second Energy value next to the brain's (double drain); per-metre costs with no source.
- Mixing clocks: metabolism on the game clock, stamina and bubble timing on real seconds.
- Bubble timing in a float accumulator in tests (t += .05 drifts); use integer steps.
- Reporting Matthew's minimum (10 s sprint) as nature: real wolves chase for minutes; say it is game design.

## Senses, diet, social, evasion (part 2)
Every template also fills `senses` (sight range/FOV/night/motion/presence, hearing, smell), `diet` (kind + food rows per kg wet: kJ, assimilation, water, bite, eat time), `social` (group size, spacing, link distance, relay delay, vigilance, alarm, scatter) and `behaviour.evasion` (real top / tired speed, zig, lateral grip). The burst length is `stamina.sprintSeconds` (one stamina engine for player and NPC). Run the animal headless with `src/core/sim` (createWorld / createAnimal / tick / nearby*); renderers only read it. tests/sim.test.ts checks every species defines all of it.

## Playing as a non-wolf species (T-0061)
The one `Playable` (src/render/playables.ts) and one `playerTuning.ts` serve every species; do not fork them.
- Add the species to `PLAYABLES` with its existing rig (hare: `createHareModel` + `poseHare`) and an `AnimalBrain`; `?play=<id>` starts as it.
- Speed comes from the species template: `playerSpeed(mode, sp)` = wolf-tuned game speed x scale, capped at `sp.behaviour.evasion.burstSpeed` (real top speed). Pounce speed scales by `sp.burst / WOLF.burst`. Stamina uses `staminaRates(needsSpecies())`.
- A prey player must not be a wolf in the sim: `WolfInfo.predator = false` removes the embodied `controlled` animal so NPCs do not flee from or get captured by the player.
- Mistakes to avoid: a x1.5 sprint multiplier above the real top speed; a second speed table; copying the wolf's pounce minimum for a 3.5 kg animal.
