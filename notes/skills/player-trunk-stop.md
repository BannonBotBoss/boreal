# Steered Player Trunk & Person Stop (`player-trunk-stop`)

## When to Use
Use this skill when wiring the steered player locomotion branch (`src/main.ts`) to respect the same trunk/person clearance (`BLOCK.wolf.trunk = 0.7 m`) used by the autonomous wolf (`src/core/autonomy.ts`), without applying autonomous water-refusal (`LEVEL.wolfWater`) or slope-refusal (`BLOCK.wolf.step`) to manual player movement.

## Steps
1. **Export shared trunk/person block predicate and steered step helper (`src/core/autonomy.ts`)**:
   - Define `wolfTrunkBlocked(x, z, objects)` returning `true` when any entity with `kind === 'spruce' || kind === 'person'` in `objects` (`view.entities()`) has `Math.hypot(e.x - x, e.z - z) < BLOCK.wolf.trunk` (`0.7 m`).
   - Define `steerPlayerWolf(pose, speed, dt, objects)` that computes `next = steerWolf(pose, 0, Math.sign(speed), dt, Math.abs(speed))` and `probe = steerWolf(pose, 0, Math.sign(speed), 0.25, Math.abs(speed))`, and returns `{ x: pose.x, z: pose.z, heading: pose.heading }` when `wolfTrunkBlocked(probe.x, probe.z, objects) || wolfTrunkBlocked(next.x, next.z, objects)`.
2. **Wire the steered player branch (`src/main.ts`)**:
   - Replace the bare `steerWolf` call on the non-autonomous player branch in `src/main.ts` with `steerPlayerWolf({ x: player.x, z: player.z, heading: brain.heading }, brain.speed, 1 / 30, view.entities())`.
   - Do not apply `LEVEL.wolfWater` or `BLOCK.wolf.step` on this branch (`T-0054` owns wading water entry, and terrain slope follows `footHeight(x, z)`).
3. **Verify with unit tests and an in-game walk-probe replay**:
   - Run `npx tsx --test tests/autonomy.test.ts` to verify the origin calibration (`spruce` at `(0, -1)` keeps `x = 0, z = 0`), placed jack pine `3:4:10` at `(141.900, 196.983)` (`d >= 0.7 m`), and open-ground walking.
   - Replay `?nomenu&noprobe&rec&stages=1&walkprobe&hour=12&at=141.900,198.183,0` in headless Chrome on an `agy` preview port (`5250–5269`) and confirm `minDist >= 0.7 m` toward `3:4:10` while an open walk moves normally.

## Mistakes to Avoid
- Do not change `BLOCK.wolf.trunk` (`0.7 m`) or invent a separate trunk collision radius.
- Do not copy `wolfGround`'s water (`LEVEL.wolfWater`) or slope (`BLOCK.wolf.step`) checks onto the manual player branch.
- Do not test against unplaced candidate trees (`applyPopulation` culls candidates based on stand density and `hash('keep:...')`; verify the specimen is present in `view.entities()`).
