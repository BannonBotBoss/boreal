# Skill: Boreal Rock, Outcrop & Forest-Floor Prop Audit (`boreal-rock-outcrop-audit`)

Use when inspecting, implementing, or verifying geological features (rocks, glacial erratic boulders, Canadian Shield whaleback bedrock outcrops, shoreline cobbles, slope seating, crustose lichen/moss shading) and forest-floor prop scale (`forage`, `plant`, `log`) against ecological and geological sources. Created and refined by `agy` for `T-0026` (`refs/rocks/shield-audit/`).

## Steps
1. **Probe the generator across chunks with `STAGES.on = true` (`refs/rocks/shield-audit/probe.ts`):**
   - Always set `STAGES.on = true` (matching `world.stagedTerrain` default in `renderSettings.ts`) and center the sample grid on `dryStart(0, 0)` from `src/core/stages/surfaceAt.ts`.
   - Measure rock counts per dry-land hectare, Wentworth size-class histogram (`pebble < 0.064 m`, `cobble 0.064–0.256 m`, `boulder 0.256–2.0 m`, `whaleback-outcrop > 2.0 m`, Wentworth 1922; Dredge & Cowan 1989), Clark-Evans nearest-neighbour index $R$, fraction of stones on bedrock uplands (`siteAt(x, z).rock > 0.3`), and fraction of stones whose height (`rockDiameter(e) * ROCK_SHAPES[shape][1]`) is less than or equal to the local organic forest floor thickness (`column(x, z)` in `src/core/ground.ts`: `moss + freshLitter + fragmented + duff + humus + peat`).
2. **Causal rock placement without `heightAt`/`riverAt` stalls (`src/core/rocks.ts`, `src/core/world.ts`):**
   - Never call `siteAt(x, z)` or `column(x, z)` inside the 120-stone loop of `generateChunk(cx, cz)`: `column` calls `generateChunk` (infinite recursion), and `siteAt` calls `heightAt` 5 times (`600` `riverAt` calls per chunk, stalling the 4 ms frame budget).
   - Instead, use `fastRockSite(x, z)` in `src/core/rocks.ts`, which performs 4 O(1) array reads on `soilGrid(STAGES.seed).kind` (`0 = bedrock`, `4 = peat`, `5 = water`), and pass the already-evaluated `h = heightAt(x, z)` into `placeRockSeed(x, z, h, baseSeed, isCandidate)`.
   - Encode boulder and whaleback outcrop size tiers (`tier = 1..3` -> `size = 9..11` = `0.95 m`, `1.65 m`, `3.60 m`) in the upper integer bits above `0xffffffff` via `withRockTier(seed, tier)` (`(seed >>> 0) + tier * 0x100000000`). Because `random(seed)` uses `seed | 0`, the 32-bit RNG stream is unchanged while `rockRecipe(e.seed)` and `rockDiameter(e)` deterministically decode the boulder/outcrop size without depending on `e.scale`.
3. **Slope-conformed whaleback & boulder geometry (`src/render/rocks.ts`, `src/render/batch.ts`):**
   - For boulders and whaleback outcrops (`recipe.size >= 9`), use low-domed glacially scoured proportions (`[1, 0.24, 0.78]` for whalebacks), suppress vertical tumbling (`rotateX`), and shear vertex $y$ by the local terrain gradient (`p.getX(i) * gx + p.getZ(i) * gz` from `elevationGrid`) so uphill and downhill perimeters embed equally into the slope with zero floating edges.
   - In `ROCK_MATERIAL.onBeforeCompile` (`src/render/batch.ts`), pass `vRockN` and `vRockW` to blend procedural crustose grey-sage lichen (`lich`) and cap-moss (`moss`) onto upward-facing rock surfaces (`vRockN.y > 0.58`) in the same single draw call and shader program.
4. **Record matched in-game views & run the 3-part calibrated metric (`refs/rocks/shield-audit/capture.mjs`, `measure.mjs`):**
   - Serve the worktree on port `5250` and capture both the clay/till forest floor (`?nomenu&bench&hour=11&at=38.5,-1.5,0`) and the Canadian Shield bedrock ridge (`?nomenu&bench&hour=11&at=128.7,21.5,0`, `siteAt().rock === 0.85`).
   - Evaluate `shieldOutcropScore = 0.40 * min(1, rockCoverShare / 0.16) + 0.35 * min(1, (largestFeatureWidthPx / wolfWithersHeightPx) / 1.0) + 0.25 * (0.5 * min(1, aspectWH / 1.8) + 0.5 * min(1, mineralLichenStdDev / 8.0))`, which checks cover share, largest outcrop span relative to the wolf, low-relief whaleback aspect ratio (`w/h >= 1.8`), and internal mineral/lichen texture variance (`stdDev >= 8.0`), rejecting any monochrome spherical/cubic grey blob.

## Checks that proved it worked
- `probe.ts` verified `maxDiameterM = 3.6 m`, `shareOver50cmPct = 46.1%`, `sharePebblesSittingOnDeepOrganicFloorPct = 0%`, `shareOnBedrockUplandPct = 53.5%`, `underwaterRocksInStagedLakesOrRivers = 0`, and `clarkEvansR = 0.625` (clustered).
- `measure.mjs` calibrated at `1.000` on the nature reference (`refs/rocks/reference/shield-ridge-ref.png`) and `0.000` on the deep-moss forest floor (`forest-floor-0.png`), while scoring `1.000` on `upland-ridge-0.png` and `upland-walk-0.png` (`0.985` on `upland-walk-1.png`).

## Mistakes to avoid
- **Calling `siteAt` or `heightAt` 5x per stone inside `generateChunk`:** Multiplies `riverAt` calls by 600x per chunk and starves the terrain tile build queue during page load. Always use `fastRockSite` and `elevationGrid` `sampleGrid`.
- **Ignoring skylight blue shift on shadowed rock in pixel classifiers:** In canopy shadow, `HemisphereLight` shifts neutral rock toward blue (`b >= g - 2`), whereas green foliage/moss always has `g > r + 8 && g > b + 4`.
