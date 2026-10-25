# Skill: pin, bite, hold, eat or release

Use when a capture should keep the prey in the world: front paws, jaws, one squeal, a limp carry, then eat or a temporary friend. The leap that creates the contact is `notes/skills/hunt-lock-leap.md`. This skill starts at the contact.

## Steps
1. Read `src/core/transactions.ts`, `src/core/huntHold.ts`, `src/core/sim/index.ts` (the capture block) and `src/animals/hare.ts` (the adapter). Do not add a species-named file. Mass comes from `HARE_NEEDS.body.massKg`, never a literal assignment.
2. A pair can have several rows. `verb` is part of the key (`hare|wolf#pin`). `get(a, b)` with no verb still returns the old single row (clover|sun, hare|clover). `run` takes the verb as the fourth argument.
3. Numbers live on `SYSTEM_PROPERTIES.hunt` and are cited in `PROPERTY_META`. `src/core/huntHold.ts` must contain the text `SYSTEM_PROPERTIES.hunt` and be listed as a reader. Regenerate `docs/system-map.md`.
4. One contact, then pin, bite, hold. The bite row is the only squeal, and only on the rising edge (`squeals` was 0). Do not call `borealSound.hare('caught')` for this path: that clip also schedules a chew. `squeal()` plays `hare-squeak` once. `setSqueal` is how the row reaches the mixer.
5. Player capture deletes the prey only when the world was not created with `handling: true`. The hare adapter sets that. NPC wolves still remove the prey and eat. `huntSim` stays on the default world.
6. While `heldBy` is set, `stepPrey` does not move the prey. `placeHeld` puts the hip under the canine. The adapter then sets root position and `rotation.x` to the limp pitch, and clears that pitch on release. The wolf rig reads `AnimateFrame.hold` (`setHold`). Do not pass the hold as the 7th argument of `playerWolf.animate`: `?loco=1` uses that for the gait pose.
7. Eat calls `dietOf(WOLF_NEEDS).meal` on tissue = body mass minus gut contents. Gut is `0.096 * mass^1.03` (Belovsky 1984). The gut mass is a `carcass` delta. Do not also add `HARE.stamina`.
8. Release writes `friendOf` / `friendAt` on the sim animal and a bond on `EventContext.bonds` (hares are not catalog kinds). Strength is `exp(-(now-at)/tau)`. Tau is 180 play seconds, not world seconds. Flight is suppressed only against that wolf, and only while strength is at or above `exp(-1)`. At exactly tau the friend is still live.
9. Defaults: eat is keyboard X, release is keyboard B. Keyboard A is steer. Pad B is Close. Both actions are rebindable. `conflicts(defaults())` stays empty.
10. Tests name the metric, the tool and both calibrations. Pin: distance from glenoid to scapula beyond paw reach, divided by body length. Known match: the reaching pin scores 1. Known mismatch: paws left under the shoulders score under 0.95. Carry: nape-to-canine distance over the same scale. Known match: the pitched carry scores 1. Known mismatch: pitch 0 and the hare on the ground scores under 0.95. Decay: `1 - |measured - exp(-t/tau)|`. The exp itself scores 1. A linear fade at half tau scores under 0.95.

## Checks that proved it worked
- `npx tsc --noEmit` clean. `npm test` green. `npm run system-map` committed with the new hunt keys.
- `tests/hunt.test.ts` prints the pin, carry, decay and gape scores.
- A second hold does not squeal. Consume ends the contact and leaves a carcass. Release ends the contact. A live friend does not bolt. After tau, flight returns. An NPC capture still emits `caught`.

## Mistakes to avoid
- A `setTimeout` for the squeal or the friendship. The contact and the closed form are the levels.
- Deleting the hare on a player capture. That is the old catch path, and it is still right for NPC wolves and for worlds without `handling`.
- Binding eat to keyboard A, or release to pad B. Those inputs are already live during play.
- Using world-seconds for the 3 minutes. The clock runs 12 times real time, so 180 world-seconds would feel like 15 seconds.
- Importing `animals/hare.ts` from `huntHold.ts`. The adapter imports the sim, and the sim imports the hold. Duplicate the neck radius and the shoulder offset, and test them against `HARE_SKIN` / `HARE_BODY`.
- Putting a hare into `context.records`. It is not a catalog kind. The bond sits on `context.bonds`, and old saves have no `bonds` field.
- Letting `prey.key` and the contact key differ. The second call then looks like a new catch and squeals again.
