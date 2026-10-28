# Skill: the strongest urge wins

Use when hunger, thirst, fear, fatigue, or a habitat score should change what an animal does next. Roadmap step 10. Issues #100, #101, and #103. Conflict 4: #103 wins. #101's `choose_action` ladder loses.

## Steps
1. Read `notes/design-roadmap.md` step 10 and conflict row 4. The animal feeds, drinks, flees, rests, or moves. The winner is the highest score. Do not port fear 90, thirst 80, hunger 80, habitat 25, or mating 85.
2. Reuse `src/core/agent.ts`. The score is #100's product: severity × the species utility × the opportunity. The utilities are the row already on the species (`feedHere`, `approach` or `investigate`, `rest`, `restBase`, `seek`). Flee's importance is 1 because `perceive` already multiplied the cue by `species.fear[kind]`. That 1 is the multiplicative identity, not a new weight.
3. The opportunity is what the animal can sense. Food underfoot is 1. A sensed patch falls with distance over the existing `approachDistance`. Otherwise it is the step 9 cell's food. A sensed drinkable point is 1; otherwise it is the cell's water. Leave is how far a neighbor's quality beats the cell's quality. No new distance and no new coefficient.
4. Pass the step 9 cell on `AgentWorld.urges`. Omit `urges` and the relaxed hare and deer choice is unchanged. `AnimalBrain.decide` stays the legs until step 13. Do not edit render or camera files while another change owns them.
5. A predator switches the action on that step only when flee's score is strictly greater. A weak cue leaves the animal on its food. `startFlight` is still the flee. The goal is prefixed `urge flee` so a trace can tell this path from the old notice cutoff.
6. Record the motion. Nothing new is drawn when the caller is a test. Save the positions, the action, and the goal. A picture of the unchanged forest is not this recording.

## Checks that prove it worked
- `npx tsx --test tests/strongest-urge.test.ts`
- The same hunger feeds on a rich cell and leaves when that cell's food drops and a neighbor scores higher.
- Fear 0.7 flees. Fear 0.2 keeps feeding. Thirst with water drinks. Fatigue rests.
- The trace walks toward the food, ignores a wolf at 80 m, and runs back when the wolf is 3 m ahead.
- `needs/engine.ts` still cites Nagy & Peterson 1988 and Taylor, Heglund & Maloiy 1982. The urge slice has no `choose_action` and no bare 90, 80, 25, or 85.

## Mistakes to avoid
- Replacing `decide` for every caller. The hare still grazes when it is not hungry but it is standing on clover. The product would send it to rest. `urges` is opt-in.
- Putting the cutoff ladder behind new names. `seekBelow` on the needs template is that ladder. Do not read it here.
- A second flee weight on top of `species.fear`. The cue is already scaled.
- Editing `src/core/animalBehavior.ts` or `src/render/**` for this step. The legs and the camera stay.
- Treating the issue's example scores (hunger 92, fear 83, safety 100) as game numbers.
- Calling `habitatAt` from the render loop in this step. The open camera change owns those files. A caller passes the cell.
