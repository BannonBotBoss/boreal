# Skill: Boreal Botanical Forage & Herb Prop Geometry (`boreal-forage-herb-geometry`)

## Purpose
Build, audit, and maintain interactive botanical props (`entity.kind === 'forage'` and `entity.kind === 'plant'`) in `src/render/geometry.ts` so they reuse the shared procedural plant generator (`src/render/flora/plant.ts` `buildClump` / `buildPlant`) and sourced species rows (`src/core/flora/plants.ts` `FLORA_BY_ID`), rather than hand-built placeholder icosahedron blobs, while batching into `PROP_MATERIAL` (`src/render/batch.ts`) with zero extra draw calls or shader programs.

## When to use
- Adding or modifying interactive plant/forage resource props (`forage`, `plant`) in `src/render/geometry.ts`.
- Auditing prop organ dimensions (berry diameter, petal/inflorescence size, lamina thickness, total height relative to the wolf) against published boreal botany sources.
- Verifying that chunk-batched props share `PROP_MATERIAL` (`position`, `normal`, `color` attributes only) and reduce triangle count across LODs `0 -> 1 -> 2`.

## Steps

### 1. Reuse `buildClump` / `buildPlant` and `FLORA_BY_ID`
1. In `src/render/geometry.ts`, import `FLORA_BY_ID` from `../core/flora/plants`, `buildClump` and `buildPlant` from `./flora/plant`, and `PROP_MATERIAL` from `./batch`.
2. Define species specs from `FLORA_BY_ID`:
   - `forage`: clone `FLORA_BY_ID.blueberry` (*Vaccinium angustifolium*, lowbush blueberry `0.18–0.35 m` tall) with a clonal carpet (`ramets: 12`, `radius: 0.38`) and terminal corymb berry clusters (`petalLength: 0.009`, `petalWidth: 0.007`, `open: 0.35`, `nod: 2.2`, `cup: 0.003`, `#4d6bb3`) matching sourced berry diameter (`6–12 mm`, Vander Kloet 1988).
   - `plant`: select deterministically from low boreal understorey herbs in `FLORA_BY_ID` (`bunchberry` *Cornus canadensis*, `bluebead` *Clintonia borealis*, `woodlily` *Lilium philadelphicum*, `everlasting` *Anaphalis margaritacea*) with heights `0.14–0.35 m` (always below the wolf's `0.75 m` withers).
3. Strip custom flora-shader attributes (`aFall`, `aOrgan`, `aBloom`) via `stripFlora(g)` so every geometry in `PROP_MATERIAL`'s `BatchedMesh` has the exact attribute set `['color', 'normal', 'position']`.
4. Cache the stripped `BufferGeometry` per `(kind, speciesId, variant, detail)` in a module `Map` and set `mesh.userData.shared = true` on the returned `THREE.Mesh(g, PROP_MATERIAL)`. Ensure `PROP_MATERIAL` has `side: THREE.DoubleSide` so thin two-triangle leaf blades and petals render from all viewing angles.
5. Use `buildClump(spec, v, 0)` for `detail === 0`, `buildClump(spec, v, 1)` for `detail === 1`, and `buildPlant({ ...spec, ...spec.carpet?.form }, v, 2)` for `detail === 2` so triangle count strictly decreases (`LOD 0 > LOD 1 > LOD 2`).

### 2. Record and measure frames (`refs/forage/t0027-audit/`)
1. Start a preview Vite server on an agent-range port (e.g. `5250` for `agy`) and run `node refs/forage/t0027-audit/capture.mjs 5250` (acquiring `tools/bench-lock.mjs` and killing headless Edge on release).
2. Capture both the upland ridge (`?nomenu&bench&hour=11&at=128.7,21.5,0`, where a `Practice herb` spawns directly in front of the wolf alongside `Forage berry patch` clumps) and the forest floor (`?nomenu&bench&hour=11&at=38.5,-1.5,0`).
3. Run `npx tsx refs/forage/t0027-audit/measure.ts` to compute `refs/forage/t0027-audit/measure.json`:
   - Checks 3D bounding-box heights and radii across generated chunks (`forage` height `0.20–0.33 m`, `plant` height `0.19–0.52 m`).
   - Computes calibrated `botanicalPropScore` (`1.000` on `refs/rocks/reference/shield-ridge-ref.png`, `0.000` on pre-T-0027 frames with giant `120 mm` berry spheres or `1.02 m` cactus herbs, `>= 0.95` on post-change frames).

### 3. Run unit tests
- `npx tsc --noEmit`
- `npm test` (specifically `tests/library.test.ts`, `tests/batchbuild.test.ts`, `tests/rules.test.ts`, `tests/flora.test.ts`).

## Mistakes to avoid
- **Forgetting to delete `aFall`, `aOrgan`, `aBloom`**: `buildPlant` attaches custom attributes for `floraMaterial()`. Leaving them on a `PROP_MATERIAL` geometry will cause `mergeGeometries` in `src/render/batch.ts` to fail when merging with visitor (`person`) meshes that only have `position`, `normal`, `color`.
- **Single-sided `PROP_MATERIAL` on blade leaves**: `buildPlant` builds leaves and petals as zero-thickness curved strips (`blade`). Without `side: THREE.DoubleSide` on `PROP_MATERIAL`, half of the leaves are backface-culled.
- **Using tall `fireweed` (`0.5–1.8 m`) for low `plant` props**: Keep interactive `plant` herbs to low understorey species (`0.14–0.52 m`) so they never tower over the wolf.
