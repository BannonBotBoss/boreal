# Skill: drop from the globe onto the animal ladder

Use when a double-click on the planet should pass through the clouds, become the existing drone, and show the animals that are already simulated, finer as the eye gets closer.

## Search before writing

1. The fall is `beginFall` in `src/world/globe/globeView.ts` and `FALL_END_M` in `src/world/globe/flight.ts`. It still ends at 10,000 ft (3,048 m). Do not time-compress gravity. The drone after that is `stepCarriedFly` in `src/world/globe/inpage.ts`.
2. Clouds are the ones already drawn: the shell in `src/world/globe/atmosphere.ts` (`CLOUDS`, 2.5 km) and the local box in `src/world/globe/localClouds.ts` (top 12 km). The fall crosses the local box. The drone then continues under the shell. Do not add a cloud.
3. Off the home square, `sampleSurface` writes game x and z as 0. That is why a far click used to wake up on the wolf's lake. `engageLanding` in `src/world/globe/landingSite.ts` stores the clicked direction. `heightAt` reads the planet sample only while that frame is remote. Home stays the Kenora grid.
4. Animals already placed by `generateChunk` and `createHares` are the population. The picture is `src/render/animalPicture.ts`. Shares are `detailShares` in `src/render/animalLadder.ts`. The old density disc stays gated by `densityTintGate` so it cannot become a dome.
5. Stored models are one manifest, `public/models/animals/manifest.json`, keyed by the names in `src/core/species.ts`. `GLTFLoader` is the three.js example. A missing file keeps the procedural body. The wolf proof is scaled to the Gray Wolf shoulder row (0.74 m). Head in the file is −X; the fit turns that to game −Z.

## Steps

1. Pass `dir` and `home` out of the fall (`dropAt`). `descend` calls `engageLanding` only when `home` is 0.
2. Stop the carried fall at `ANIMAL_LADDER.mapHoldM` (400 m) unless `playerDiving` says the player is flying down. `arrestGlide` turns the vertical speed into an 8 m/s glide once.
3. Stream chunks with the eye height (`inpage.height`), capped, so the glide has ground under it.
4. Fade each animal with `detailShares`. Specks are a fixed pixel size. A stored mesh is skinned onto the existing gait (`src/render/meshySkin.ts`), so close and moving is the Meshy body. The mid step is a shared impostor quad. `setBodyShare` runs after `density.sync`. No file still means the procedural body.
5. Above the tree line (`plantsGrowAt` at the site latitude) the generator does not place deer, spruce, or hares.

## Checks

- `tests/globe-landing.test.ts`: shares sum to 1, the floor holds at 400 m, the path crosses both cloud decks, a northern click moves the frame and the home click does not, the manifest names the wolf.
- `npx tsc --noEmit` and `npm test`.
- Stills, if a browser is available: `tasks/evidence/T-0108/`. Home, a far boreal point, and a temperate point, each at the glide, at the low step, and close.

## Mistakes to avoid

- Do not draw the density disc from the ground. It reads as a dome.
- Do not invent a second terrain. Off home, sample the planet function the tiles already use.
- Do not spawn a new herd for the picture. Read the animals the chunk and the hare adapter already made.
- Do not put a hare-named mesh in the hare's own source files. The manifest is the only store.
- Species ranges and a photoreal landscape are other lanes. This skill only hands the click to the frame that already exists, and draws the animals that frame already has.
