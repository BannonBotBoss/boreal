# Skill: body, feeling, and urge are three blocks

Use when hunger, thirst, fear, curiosity, or a pull to feed, flee, mate, or move has to be placed for an embodied animal. Roadmap step 19. Issues #102, #103, #105, and #106. Conflict 12: #106 wins. T-0105 did the first split.

## Steps
1. Read roadmap step 19 and conflict row 12. Do not build #102's `Mind` (fear, curiosity, and mating in one struct) or #103's `Instincts` (hunger and fear in one list). #106's three blocks are the perception slices from step 16.
2. Reuse the body. Hunger, thirst, fatigue, pain, temperature stress, oxygen stress, stamina, and the reserved float are `physiologyOf` and `packPhysiology` in `src/core/bodyFeelings.ts`. Hunger is the unfilled share of energy on the needs percent scale. Copy those 32 bytes to `PERCEPTION.physiologyOffset` (byte 64). Do not recompute them.
3. Feelings are the emotion block at byte 96. `feelingsOf` writes fear, then stress, confidence, curiosity, aggression, social attachment, and two reserved floats. Fear is the sensed cue step 10 already multiplies. Curiosity is a feeling argument. Omit it and it stays 0 (calibration: no curiosity rate on the species row). Emotion stress stays 0. It is not the body's temperature stress. Hunger is not a parameter of this function.
4. Urges are the instinct block at byte 128. Call `urgeWeights` and `urgeScores` in `src/core/agent.ts`. Do not copy the utility numbers. Feed, drink, flee, and move become `feedDrive`, `drinkDrive`, `safetyDrive`, and `explorationDrive`. Flee's importance stays 1. Mating is the fifth float and stays 0 (calibration: step 10 has no mating weight; #101's cutoff 85 lost). Migration, territorial, and social stay 0 for the same reason. The rest score stays inside `strongestUrge` and is not written into mating or into an emotion.
5. `frameWithBlocks` copies the three slices and leaves the counts at 0. `readPerception` is the check. Do not edit the reader to make a field fit, and do not add a second mind on the entity store.

## Checks that prove it worked
- `npx tsx --test tests/three-blocks.test.ts`
- Byte 64 is body hunger, byte 96 is fear, byte 108 is curiosity, byte 128 is the feed pull, byte 144 is mating.
- The 32 emotion bytes do not contain the body hunger float or the body thirst float. `emotions` has no `hunger` and no `matingDrive`. `urges.matingDrive` is 0.
- Hare and wolf feed pulls equal `urgeScores(urgeWeights(that row))` and differ from each other. A tired hare's winner is still `rest`, and that rest score is not one of the eight packed urge floats.
- `src/core/threeBlocks.ts` calls `urgeWeights` and `urgeScores` and does not contain `choose_action`, `interface Mind`, `Instincts`, or the cutoffs 90, 80, 25, or 85.
- `npx tsc --noEmit` and `npm test` pass. Frame gate is N/A: nothing is drawn.

## Mistakes to avoid
- Putting hunger, thirst, or mating on the emotion block because #102 or #103 listed them beside fear.
- A new mating weight, or #101's 85. The slot exists so mating is an urge. The value stays 0 until a season row that already exists supplies it.
- Copying the body's temperature stress into emotion stress. Conflict 11 kept those apart in step 18.
- Packing the rest score into the mating float because issue #106 has no rest slot. Rest still wins `strongestUrge` when it is the highest score.
- Hardcoding `feedHere` or any other utility. The row is the weight. Hare drink uses `approach`. Wolf drink uses `investigate`.
- Editing the senses panel, `main.ts`, `habitat.ts`, or `systemProperties.ts` for this split. Those files belong to other open changes. Nothing in this step is drawn.
