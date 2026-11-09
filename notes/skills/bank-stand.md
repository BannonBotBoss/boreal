# Skill: stand the animal on the bank, not in the lake

Use when a drop or a cold start leaves the animal standing on the flat water plane.

## Search before writing

1. `landSpawn` (`src/world/globe/handoff.ts`) already walks to the nearest dry cell (`dryStart`).
2. That cell at the home lake is the waterline. The store mark faces the shore, so the follow camera looks across the water.
3. `forestLanding` already finds the stand edge, facing the trees, on dry ground. Do not add a second search.
4. The splash waits on `landReady`. If you move the feet, the wait has to use the same point. `livingHere` stays the store mark.

## Steps

1. `clearOfWater` is dry ground above `LEVEL.shore` at the feet and on a 16 m ring. A waterline fails it.
2. `dropStand` keeps a point that is already clear. Otherwise it returns `forestLanding().land`.
3. The home drop (`descend` when the landing is not remote), the cold start, and Return to start call `dropStand`.
4. Pass `landReady` that checks the chunk under the feet, not the store mark.

## Checks

- `tests/bank-stand.test.ts`: the shore mark fails `clearOfWater`, the drop stand passes, and the feet are above `LEVEL.shore`.
- A ground frame at `?view=ground&stages=1&trees=v2` shows the animal on the dark ground, with the lake in the distance.

## Mistakes to avoid

- Do not leave the splash waiting on `livingHere` after moving the player. The chunk it asks for is never built, and the card says the ground did not arrive.
- Do not send Return to start to (0, 0). That point is the lake bed, and the feet clamp onto the water plane.
