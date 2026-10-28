# Skill: fill the drone view out to the horizon

Use when the glide or the low drone shows a small patch of chunk terrain floating in the globe, or the ground should reach the horizon at a landing that is not the Kenora square.

## Search before writing

1. The globe is already a quadtree. Tiles are `src/world/globe/tile.ts`, the split is `src/world/globe/lod.ts`, and the height is `planet.sampleSurface` in `src/world/globe/planet.ts`. Do not add a second planet.
2. The in-page drone draws that globe into the far layer (`src/world/globe/farLayer.ts`) and the chunk patch on top (`src/world/globe/inpage.ts`). The patch dither is `src/render/fade.ts`. Its disc used to end near `INPAGE.ring * CHUNK_SIZE` (80 m), which is why the glide showed a square.
3. Off home, `heightAt` already reads the landing frame (`src/core/siteHeight.ts`, `src/world/globe/landingSite.ts`). At home it is the staged Kenora grid. `sampleSurface` blends that grid into the planet relief at the home square's edge. Use that, not a new noise.
4. Colour for the rings is `surfaceColour` and `GLOBE_COLOURS`. The chunk soils stay on the chunk meshes.

## Steps

1. Build concentric rings from `HORIZON_SKIRT.innerM` out past `horizonMetres(eye)`. Radius doubles each ring. Keep the triangle count under `HORIZON_SKIRT.maxTriangles`.
2. Place each vertex at the game (x, z) and set y to the tangent-plane height minus `curvatureDrop`. The drop is `R − R² / sqrt(R² + r²)`. At the horizon distance `sqrt(2 R h + h²)` that drop is `h R / (R + h)`.
3. Near a remote landing, add the same `surfaceDetail * 0.5` the remote `heightAt` adds, and fade that term out by 2 km so the far rings match the globe.
4. Draw the mesh in the game scene, under the chunks (`polygonOffset`), and do not put it on the patch-fade discard. Widen the chunk disc with `patchDiscRadius` so the square corners fall inside the dither. Extend the band camera's far plane past `horizonMetres`.
5. Dither the outer 10 % of the skirt away so the globe shows through at the limb. Haze the lit colour toward the horizon over the outer part of the view.

## Checks

- `tests/horizon-skirt.test.ts`: the drop matches `h R / (R + h)`, rings have no gaps, the mesh stays under the triangle cap, a flat place stores `y − drop`, home land keeps the local height, and Ultra globe triangles plus the skirt cap stay under the 750k Quest figure in `src/core/quality.ts`.
- `npx tsc --noEmit` and `npm test`. `XR_CAPS` is not raised.
- Stills at the T-0108 landings: home, boreal, prairie, at glide and low. The ground should cross the frame to a horizon. A hard square of chunk terrain in a blurry globe means the skirt did not draw.

## Mistakes to avoid

- Do not sample `heightAt` alone out to the horizon at home. The staged grid is periodic and repeats Kenora. The planet sample is what the tiles show past the home square.
- Do not subtract curvature twice. `skirtSample` returns the tangent-plane height. `buildSkirtMesh` applies the drop.
- Do not give the skirt `renderOrder < 0`. `hideForBand` treats that as sky. Mark `userData.horizonSkirt` and skip it there.
- Do not opt the skirt into `fadeOptIn`. The patch disc would discard it, which is the square you are trying to remove.
- A rebuild every frame is wasted. `sampleSurface` is about 4 µs. Snap the camera and rebuild on that cell.
