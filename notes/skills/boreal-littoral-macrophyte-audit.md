# Skill: Boreal Littoral Macrophyte Zonation & Geometry Audit (`boreal-littoral-macrophyte-audit`)

Use when inspecting, implementing, or verifying aquatic and shoreline vegetation (`sedge`, `horsetail`, `bulrush`, floating-leaved `pond-lily`) across the littoral depth gradient (`0–1.55 m`), water-surface placement, emergent culm elongation, and frame-calibrated visual scoring against boreal lake references. Created and refined by `agy` for `T-0025` (`refs/water/littoral-audit/`).

## Steps
1. **Propagate water depth, water surface, and flow through `Site` (`src/core/flora/site.ts`):**
   - `siteAt(x, z)` evaluates `lake = lakeAt(STAGES.seed, x, z)` and `river = riverAt(STAGES.seed, x, z)` when `STAGES.on` is true.
   - Base-water lakes (`h < 0 && !lake.active && river.flow === 0`) cover ~27% of the staged world (including the `(30, 0)` shore), while perched kettle pits (`lake.active`, `surface > 12 m`) cover ~0.3% of the world and are excluded by legacy `tests/grass.test.ts` and `tests/flora.test.ts` assertions (`!lakeAt(...)`).
   - Compute `waterSurface = river.flow > 0 ? river.surface : 0` and `waterDepth = Math.max(0, waterSurface - h)` on base-water and low-order river margins. Allow littoral emergence and floating macrophytes up to `MAX_LITTORAL_DEPTH = 1.6 m` (Duarte & Kalff 1986, *Limnol. Oceanogr.* 31:1072–1080) and low stream flow (`river.flow <= 0.12`), while keeping `soil = 0` where `waterDepth > 1.6 m` or `perched` is true.
   - Expose `waterDepth?: [number, number]` and `maxSlopeDeg?: number` on `Niche` so `suitability(site, niche)` returns `0` outside a species' depth window or on steep wave-washed shores (`slope > maxSlopeDeg`, Mäkelä et al. 2004, *Aquatic Botany* 80:253–269).

2. **Add emergent graminoid/equisetoid cover rows (`src/render/grass/cover.ts`, `src/render/grass/grass.ts`):**
   - Represent littoral emergents as data rows in `COVER_KINDS`:
     - `sedge` (*Carex aquatilis / C. utriculata*): `depth: [0, 0.55]`, `maxSlope: 0.25`, `h: 0.42 m`, `standScale: 7`.
     - `horsetail` (*Equisetum fluviatile*): `depth: [0, 0.95]`, `maxSlope: 0.22`, `h: 0.65 m`, `standScale: 8`.
     - `bulrush` (*Schoenoplectus tabernaemontani*): `depth: [0.05, 1.15]`, `maxSlope: 0.20`, `h: 1.15 m`, `standScale: 10`.
   - In `fillTile`, keep `root.y = h` on the submerged bed so stems visibly enter the water, and elongate culm height by `waterDepth * 0.92` (`Math.max(waterDepth + 0.18, hScale + waterDepth * 0.92)`, Grace 1989, *Func. Ecol.* 3:593) so aerial tips emerge above `y = waterSurface`.
   - In the grass vertex shader (`grass.ts`), set `wet = smoothstep(-0.35, 0.08, root.y) * (1.0 - smoothstep(0.08, 0.9, root.y)) * step(-0.22, root.y)` so submerged emergent bases (`root.y < -0.22`) keep their chlorophyll green instead of blending to dark mud brown.

3. **Add 3D littoral flora rows & horizontal floating lily pads (`src/core/flora/plants.ts`, `src/render/flora/plant.ts`, `src/render/flora/flora.ts`):**
   - Add `horsetail` (`whorled`, ascending branchlets `droop: -0.35`), `bulrush` (`graminoid`, compact nodding terminal spikelet cluster `flower: { kind: 'solitary', nod: 0.45 }`), and `pond-lily` (*Nuphar variegata*, `floating: true`, `basal`, `orbicular` floating pads `len: 0.20 m`, `wid: 0.17 m`, `waterDepth: [0.22, 1.55]`, solitary yellow cup flower `0.042 m` on `[150, 235]` DOY).
   - **Floating pad orientation in `frame(at, dir, spin)`:** Because `frame(at, dir, spin)` aligns local `+Y` with `dir = (cos(az), 0.01, sin(az))` and rotates local `X/Z` around `UP × dir` by the elevation angle `acos(dir.y) ≈ π/2`, passing `spin = 0` tilts local `X` vertically (`±Y`) when `az = ±π/2`, standing lily pads on edge like vertical fins! Always pass `spin = -Math.PI / 2 - az` for `plant.floating` leaves so local `X` (pad width) aligns with the horizontal rotation axis `UP × dir` and local `+Z` (pad normal) points straight up (`normal.y = +0.9998`).
   - Place `plant.floating` leaves and flowers at `y = waterSurface + 0.012 m` in `flora.ts` (`placeAt = p.floating && site.waterDepth > 0.05 ? Math.max(h, site.waterSurface + 0.012) : h`).

4. **Record matched shore/wading views and run the calibrated 4-part metric (`refs/water/littoral-audit/capture.mjs`, `measure.mjs`):**
   - Wait for `Boolean(document.querySelector('canvas')) && document.readyState === 'complete' && !document.getElementById('loading')` and `borealGrass.info.tiles >= 20 && borealFlora.info.tiles >= 9` before shooting.
   - Sample lake-water ROIs strictly below the far-shore treeline (`y >= 275` on `noon-0` and `wade-*`) and evaluate `littoralMacrophyteScore = openWaterGate * (0.35 * emergentCoverSubscore + 0.25 * floatingCoverSubscore + 0.20 * verticalCulmSubscore + 0.20 * openWaterSubscore)`.

## Checks that proved it worked
- Full `npm test` and `npx tsc --noEmit` (0 errors), including dedicated littoral zonation and horizontal floating-pad normal tests (`normal.y > 0.95`) in `tests/grass.test.ts` and `tests/flora.test.ts`.
- `measure.mjs` calibrated at `1.000` on the nature reference (`refs/water/reference/t0025-littoral.png`) and rejected pre-fix bare-water frames (`refs/water/shore-audit/noon-0.png`, `wade-2.png`) and inland forest-floor frames (`refs/rocks/shield-audit/forest-floor-0.png`), while scoring `>= 0.95` on the littoral views.

## Mistakes to avoid
- **Passing `spin = 0` to `frame(at, dir, spin)` for horizontal `dir`:** That rotates local `X` into the vertical plane whenever `dir.z != 0`, turning floating lily pads into vertical blades. Use `spin = -Math.PI / 2 - az`.
- **Using `flower.kind = 'umbel'` on tall graminoids (`h > 0.8 m`):** `umbel` peduncle rays scale as `0.12 * H`, producing `14 cm` parasol spokes on `1.15 m` bulrushes. Use `kind: 'solitary'` with `nod: 0.45` for compact terminal spikelet clusters.
- **Including `y < 270` in lake-water ROIs on the `(30, 0)` shore view:** `y = 225..268` is the far-shore spruce/birch treeline across the lake, which causes false-positive plant pixel counts on bare-water frames.
