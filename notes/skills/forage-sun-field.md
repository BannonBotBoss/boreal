# Forage on the sun field

Use this when a patch of berries, an herb shoot, or a deer's browse should shrink when eaten and come back from sunlight. One field (`src/core/fields.ts`) and one grazed delta (`src/core/deltas.ts`). Do not add a second regrowth clock.

## Steps

1. Place berries in `generateChunk` with the forage stream. Draw x, z, seed, keep, rotation and scale on every candidate. Keep the point only when it is dry, below the tree line, and `keep < berrySuit(site.light)`. `berrySuit` is 0 at half sun and 1 at full sun (Hall et al. 1979). Call `siteAt(x, z, true, false)`. The last argument skips drawn crowns.
2. Place herbs with a separate hash, `herb-light:<worldSeed>:<cx>:<cz>:<i>`. Do not draw that keep from the chunk RNG. Acceptance probability is the site light. Same `siteAt` call: stand shade only.
3. Read stock with `settledGrams`. No delta means the patch is full. Do not sample light just to draw an ungrazed bush (`patchCover` returns 1).
4. Eat with `takePatch`. It writes one `grazed` row: meta `key|atWorldSec|perSun|max|by`, `m` = grams left. Replace by key. Do not call `record()` (a 1 m merge fuses neighbours).
5. Regrow by reading. `gramsNow` is `stored + perSun * sunSeconds(at, now)`. `perSun` is `max / (60 game days)` times `berrySuit` for berries and site light for herbs. Browse cells ignore shade. Clover stays on `/86400`. Do not change it.
6. Show the fraction with `batch.cover`. Full is 1. A stripped mat is `FORAGE_STEM` (0.35). The mesh stays at `entity.scale`.
7. Time a meal as grams / grams-per-second. The shared mouthful is 7.8 g fresh/min. `FEED_DURATION` (2) and `FORAGE_ENERGY` (18) stay on the system-property map and are not the meal.

## Files

- `src/core/fields.ts` — suit, crop, `takePatch`, `sunSeconds` (already the clover clock).
- `src/core/deltas.ts` — `grazed` kind. `strength` is depletion left, from world seconds, not the exponential.
- `src/core/world.ts` — light-weighted placement.
- `src/core/events.ts` — `consumeForage` and gather. The bush stays in the world (`removed: false`).
- `src/core/species.ts` — deer `BROWSE` cell, wolf diet and `WOLF_BERRY_G_PER_ENERGY`.
- `src/core/autonomy.ts`, `src/core/visitors.ts` — eat through `takePatch`.
- `src/render/batch.ts`, `src/render/buildScene.ts` — instance cover. Do not hide the bush until unload.

## Checks

- `npx tsc --noEmit`
- `npm test` — `tests/forage-field.test.ts` holds the position score, the acceptance score and the sun-hour score. `tests/proc.test.ts` carries the chunk digest after a placement change.
- A placed berry with site light under 0.5 is a failed gate.
- An instant-full regrowth (the whole interval already booked halfway through) must score under 0.95.

## Mistakes

- Reading drawn crowns from inside `generateChunk` overflows the stack. The canopy hook rebuilds the chunk, which asks for light again. Placement passes `crowns` false and uses stand closure. A later eat may read full `siteAt`.
- `world.ts` must not import `fields.ts`. `berrySuit` lives in `src/core/forageLight.ts`. Fields already import the world, then weather, and a cycle there calls `setSurfaceSource` before the surface exists.
- Importing `deltas` from `fields` and `sunSeconds` from `fields` into `deltas` is a cycle. It holds only because neither module calls the other while it is loading. Do not add a top-level call.
- Scaling `entity.scale` to show a bite changes the crop and the seed identity. Scale the instance matrix.
- Granting wolf berry energy in both `unitsPerEnergy` and `autonomousWolfStep` doubles the meal. The diet keeps `unitsPerEnergy: Infinity`.
- Deleting the entity on eat puts a full bush back when the chunk reloads. The delta is the memory.
- Using 86400 for berries makes a play session show no regrowth. Forage uses game days on purpose.
