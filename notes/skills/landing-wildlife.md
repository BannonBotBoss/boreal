# Skill: wildlife after a globe landing

Use when a landing should show the animals that live at that point. Issue #192. The simulation already owns the list. The viewer only places a few of them where the camera can see them.

## Steps
1. Read `PlanetSim.landingPopulation` (`src/core/planetBudget.ts`). It is the wasm export of `landing_population` in `rust/boreal-sim/src/species.rs`. Species ids are `LANDING_SPECIES`, in order. An empty list means water, or a cover class the species cannot use. Do not add a second density table in TypeScript.
2. Ask it for the point under the player (`landingContext` in `src/render/landingCast.ts`): latitude and longitude from the landing frame, elevation and vegetation from the planet sample, water when the sample is ocean, lake, or below sea level. Year 2026 and a 5 km side match the bridge tests.
3. `pickLandingSlots` keeps at most `LANDING_SHOWN_CAP` (5) animals: one per role (herb, predator, small, bird), the commonest in that role, then the next species by count. A count of 0 is never drawn. `placeLandingAnimals` stands them 5 m and more in front of the player (the camera sits behind, so forward is `-sin(yaw), -cos(yaw)`). A wet cell is skipped, out to about 40 m, which is still inside the low-body distance. Only a fully wet arc falls back to standing on the water. If the wolf turns after the list arrives, the cast is placed again so it stays in front of the camera. Species ranges cover North America only: an empty list outside those ranges is drawn as no animals, not as stand-ins.
4. `createLandingCast` builds a procedural body for each slot and feeds it to the existing picture (`animalPicture.ts`). The picture skins the Meshy manifest when the file has loaded and hides the procedural body. Landing bodies are ordered ahead of nearer home deer and hares so the six full-mesh slots stay with the census cast and the embodied animal. Canada Lynx has no file; the procedural body is the one that stays. Both use `quadrupedPose` / the bird flap already in `meshySkin.ts`. Feet are calibrated to local y = 0, then the root is set to `heightAt`. The report's `lighting` is the sky's sun at the landed latitude (a read, not a sky edit).
5. On a remote landing, Kenora deer and hares are hidden when the census does not name them. Home is left as it is. The embodied wolf is never removed.
6. Stylized fill lives in `src/render/stylizedPalette.ts`. A mapped mesh lights its own albedo. Grass, bark, foliage, and the horizon crowns share the same small lift. Do not edit `world/globe/inpage.ts` or `render/sky.ts` for this; that lighting belongs to the landed-ground branch.
7. Evidence: `tools/fall-shot.mjs` with `EMBODY` and `?latlon=` (the in-page globe keeps that parameter and G drops on the centre). `tools/landing-matrix.mjs` runs the ten `SEAM_LOCATIONS` clicks. Wall-clock frame time is the capture's `rafMs`. The cast's `frameMs` is simulation time between paints.

## Checks that prove it worked
- `npx tsx --test tests/landing-cast.test.ts`
- A boreal list includes a herbivore and does not invent a species. A lake list places nothing. Prairie inputs with hare and lynx counts of 0 do not draw them.
- Canada Lynx is absent from `public/models/animals/manifest.json`, and the procedural body rests with its feet on y = 0.
- `npm test` and `npx tsc --noEmit`.
- Landed frames under `tasks/evidence/T-0125/<site>/landed-*.png`, plus `matrix.json`.

## Mistakes to avoid
- Spawning the 5 km census (thousands of hares). The cap is the picture ladder's full-mesh budget, leaving one slot for the player.
- A new `IcosahedronGeometry` or `performance.now`. Use `icosphere` from `render/rocks.ts`. Frame time for the table comes from the capture script.
- Calling `setBodyShare` before `density.sync` in `buildScene.ts`. The density disc is counted first.
- Editing `inpage.ts` or `sky.ts` while the other bot owns landed-ground lighting.
- Treating the Earth name of a seam site ("prairie", "tundra") as the cover class. The class is `coverKind` at the stood point. Rock, ice, and water lists are empty, and that is what the sim said.
