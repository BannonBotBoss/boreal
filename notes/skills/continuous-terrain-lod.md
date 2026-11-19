# Skill: one terrain mesh to the horizon

Use when the ground is separate chunk plates, a second far ring, or a flat plane under the near mesh.

## Search before writing

1. Near ground is `heightAt` in `terrainCore` (one 40 m chunk, flat shaded). The loaded disc is `chunkRadius` / `INTEREST.mid`, about 100 m, so an eye at 40 m sees the edge of that disc.
2. The second surface was `createHorizonSkirt` (`horizonMesh.ts`, rings from `horizonSkirt.ts`). It is a different height (planet sample, DEM, photograph) and it read as a flat brown plane with the chunk plates floating on it.
3. Do not add another far ring. A CDLOD ring past the chunks (PR #428) left the plates in place. The published fix is one chunked LOD for the whole ground: Ulrich 2002, skirts as in Proland, the same crack fill the three.js terrain examples use.
4. Horizon distance is `sqrt(2 R h + h^2)` (`horizonMetres`). The drop of the sphere under the tangent plane is `curvatureDrop`. The camera far plane was 700 m, short of that horizon.

## Steps

1. Select a quadtree of leaves that tile one root square reaching past the horizon (`selectTerrainLeaves`). Split when the 3D distance to the node is under `size / 0.72`. Then split any neighbour more than twice as large, so a skirt hides one LOD step.
2. Build one indexed mesh (`buildContinuousMesh`). Every surface vertex is `heightAt(x, z) - curvatureDrop`. A skirt of `max(8 m, 0.35 * size)` hangs under each edge. Normals are central differences on that same grid. Colour is `terrainBand` / `groundColor`, the chunk palette.
3. Draw that mesh. Do not add the skirt mesh. Leave each chunk ground in the scene but `visible = false` (water sheets stay). Set `camera.far` to at least `horizonMetres(eye) * 1.15`.
4. Push the linear fog out only far enough that the surface is visible. Aerial perspective is a separate change. The Sky.js dome already has `depthWrite = false` and follows the camera, so ground past 600 m is not hidden by the sky box.

## Checks

- `tests/continuous-terrain.test.ts`: the leaves tile the root with no overlap, a neighbour is at most twice as large, the outer vertex passes the horizon, surface vertices match `height - curvatureDrop`, skirts sit at least 8 m below, the first triangle faces up.
- `tests/ground-picture.test.ts`: tan share of the ground window (y 0.48–0.70, x 0.28–0.78; R > G > B, R − B > 25, R in (90, 190)). Known mismatch: the before eye-40 frame scores 0.209 and the before standing frame 0.297. Known match: the after frames score 0.001 and 0. Pass is under 0.04.
- Frames: `?view=ground&nomenu=1&noprobe=1&stages=1&trees=v2&hour=8.6&eye=40` and the same URL without `eye`. SwiftShader, 1280×720. Wait until `window.__terrain.leaves` is set.

## Mistakes to avoid

- Do not keep the chunk meshes visible on top of the new mesh. They are the plates.
- Do not sample a second height function for the far ground. Cracks and the brown plane both came from that.
- A rebuild walks `heightAt` for every leaf. At eye 40 that is about 350 leaves and under a second. Snap the camera to 24 m so a step does not rebuild it. Do not sample `heightAt` five times per vertex for the normal.
- Do not build the whole horizon inside `update`. On main `6af1de2e` that call took 371–560 ms and uploaded 2–3 MB before the frame could draw (eye 400 m: 560 ms, 2.55 MB, 58,368 triangles). A dive crosses about forty `round(log2(eye) * 4)` bands, so holding the dive stacks those stalls and `setEye` changes the reported height while the canvas is still the previous picture. Chunk adds are already capped (`CHUNK_ADDS_PER_FRAME`) and photo tiles decode off the draw; they were not the multi-second gap.
- The frame shows `coarseLeaf` (8×8 on the horizon square) in the same call the eye moves, then `buildLeaf` fills the quadtree nearest-first for at most `TERRAIN_BUILD_MS` (8 ms). Each call uploads at most `TERRAIN_UPLOAD_BYTES` (256 KB) as one new mesh. The placeholder stays until those leaves cover the root (`chunkAction` does not drop it early). The shared terrain shader already uses `GLSL_NOISE` from `proc/glsl.ts`. Do not add a noise library.
