# Skill: Population-Density Fold, Living-Pack Embodiment, Lifespan Clock & `#106` Perception Audit (`population-density-embodiment-perception-audit`)

## When to use
Use this skill whenever auditing or modifying:
- Temporal and spatial animal population folding (`src/core/coarse.ts`, `src/render/animalDensity.ts`, `src/render/animalPicture.ts`, `src/render/buildScene.ts`)
- Living-animal store embodiment & species switching (`src/core/enterLiving.ts`, `src/core/livingPack.ts`, `src/core/storedAnimal.ts`, `src/render/playables.ts`, `src/main.ts`)
- `#109` world-clock year scaling, ontogeny, and biological lifespan turnover (`src/core/worldClock.ts`, `src/core/timeOfDay.ts`, `src/core/lifespan.ts`, `src/core/growth.ts`, `src/core/litter.ts`)
- Issue `#106` packed perception / physiology / emotion / urge boundary & `#senses` stream (`rust/boreal-sim/src/perception.rs`, `src/core/perceptionBuffer.ts`, `src/core/bodyFeelings.ts`, `src/core/threeBlocks.ts`, `src/core/sensePictures.ts`, `src/ui/senses.ts`)

## Key invariants & checks
1. **Population conservation (`shares.body + shares.density === 1`)**:
   - At any distance $d$ and observation scale `obs`, `markFor(d, obs)` partitions each wild animal into `body` and `density` shares summing to `1.0`.
   - `animalPicture.sync` (`full` Meshy skins, `low` impostors, `speck` points, and `proc` procedural bodies) MUST multiply wild animal opacity/visibility by `m.body` (including `landingCast` fauna; only the embodied `player` stays `1.0`), so `0` solid statues draw over density marks at `>= 12×` (`Behavioral` / `Ecological` / `Evolutionary`).
   - `coarseStep` carrying density `perKm2(species)` must use cited species-specific values (snowshoe hare `1,000 / km²` = `10 / ha`, Keith 1990; deer `1 / km²`, Ranta & Lankester 2017; wolf `0.04 / km²`, Fuller, Mech & Cochrane 2003) and persist `FieldCell` state across frames via `demoteFar` / `promoteField`.
2. **Terrain-draped, physically lit `animalDensity` marks & shader-safe `setBodyShare`**:
   - Ground density marks must sample `heightAt(wx, wz) + DENSITY_MARK_LIFT_M` per vertex (no double `+0.12 m` lift) and discard `!isDry(wx, wz)` water fragments so marks never cantilever into mid-air off slopes or over lakes.
   - Fragment radiance must scale with scene daylight/moonlight illuminance (`<= 0.0016` linear luminance at `0.001 lx` New Moon midnight, Kyba et al. 2015) and winter `snow` depth.
   - When `setBodyShare` clones a material (`mat = base.clone()`), always copy `mat.onBeforeCompile = base.onBeforeCompile` and `mat.customProgramCacheKey = base.customProgramCacheKey` because Three.js `Material.clone()` resets `onBeforeCompile` to a no-op.
3. **Unified `#109` Julian-year clock & stateful living-pack embodiment**:
   - Every year-rate consumer (`epochOffsetYr`, `coarseStep`, `stepPups`, `ageYears`, `dayAt`, `tickGround`) must agree on `1` year of `worldSec()` so `"1 year / sec"` on the `#109` dial advances age and seasons by `1 yr/s`, not `12 yr/s`.
   - Living-roster spawns must sit on dry `dropStand` ground (`heightAt >= LEVEL.shore`), instantiate packmates (`WOLF_NEEDS.social.groupSize >= 2`), enforce `LIFESPAN[species].maxYears` turnover, and persist per-handle `(x, z, energy, water, rest, ageYears, memories)` across `setPlayable` switches.
4. **Live `#106` wasm perception frame, browser-clean imports, & per-modality sense caps**:
   - Never place top-level `import ... from 'node:fs'` inside `src/core/*` modules (`bodyFeelings.ts`).
   - `stepBodyFeelings` must include sub-$T_{lc}$ endotherm cold stress (Scholander et al. 1950) as well as heat stress and apneic submersion `oxygenStress` (Butler & Jones 1997).
   - `signalsFromFrame` must normalize `VisibleThing.salience` (`0..100` or `0..1`) and compute `-Z`-forward listener bearings (`atan2(dx, -dz)`), and `createSenseStream` must enforce per-modality `#106` caps (`32` visual, `16` scent, `8` sound) with entity-keyed `reemit` so sound + scent cues never starve visual `sight` cues.

## Verification workflow
1. Run `npx tsc --noEmit` and `npm test` (plus `npx tsx tools/tasks.ts` and `npx tsx --test tests/tasks.test.ts`).
2. Run `node refs/ecosystem/population-density-embodiment-perception-audit/capture.mjs` on an `agy` preview port (`5250–5269` under `tools/bench-lock.mjs`, killing Vite and headless Edge in `finally`).
3. Run `npx tsx refs/ecosystem/population-density-embodiment-perception-audit/numeric-check.mjs` and confirm `calibrationValid === true` and all 12 checks score `>= 0.95`.
