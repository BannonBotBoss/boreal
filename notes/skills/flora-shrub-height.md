# Skill: Flora Shrub & Prostrate Mat Height Calibration (`flora-shrub-height`)

## Purpose
Keep procedural plant geometries built by `buildPlant` (`src/render/flora/plant.ts`) calibrated to their botanical species rows (`src/core/flora/plants.ts` `FLORA`), ensuring that prostrate/needle shrubs (`Juniperus communis var. depressa`) and upright shrubs/herbs have `boundingBox.max.y / height.mean` near `1.0` (`[0.95, 1.05]`) and never exceed `height.max` when scaled by `h / height.mean`.

## When to use
- Adding or tuning shrub or herb rows in `src/core/flora/plants.ts`.
- Modifying stem length, tilt (`mat`), or side-branch attachment rules in `src/render/flora/plant.ts` (`buildPlant`).
- Auditing placed flora heights (`plantsJob` in `src/render/flora/flora.ts`) against published botanical treatments (Flora of North America, USDA FEIS).

## Steps

### 1. Keep stem length scaled to `stemLen = H` without `/ cos(mat)` inflation on prostrate needle shrubs
1. In `src/render/flora/plant.ts` (`buildPlant`), `H = spec.height.mean` is the species' mean vertical height (`stemLen = H`).
2. For upright shrubs (`mat = 0.35 rad`, `cos(0.35) ≈ 0.939`), dividing `stemLen * (0.75 + 0.35 * r())` by `Math.cos(mat)` compensates for the gentle outward lean.
3. For prostrate needle mats (`spec.leaf.shape === 'needle'`, `mat = 1.1 rad`), primary stems tilt by `mat * (0.5 + r())` (`0.55–1.65 rad`) and secondary branches (`bd = tilted(ax, 0.7 + r() * 0.3, ...)`) can tilt back toward `+Y`. Dividing `stemLen` by `Math.cos(1.1) = 0.4536` inflates stem and branch lengths by `2.205×`, causing the mean mesh top (`max.y = 1.088 m`) to reach `2.176 × height.mean` and exceed `height.max = 0.9 m`.
4. Keep needle shrubs on `stemLen = H` (`const stemLen = H, len = stemLen * (.75 + .35 * r()) / (spec.leaf.shape === 'needle' ? 1 : Math.cos(mat))`), which brings juniper variant 0 detail 0 to `max.y = 0.4938 m` (`max.y / height.mean = 0.9876`, within `[0.95, 1.05]`).

### 2. Calibrate and verify with bounding-box measurements (`refs/flora/t0049-juniper/measure.mjs`)
1. Run `npx tsx refs/flora/t0049-juniper/measure.mjs` to compute:
   - `buildPlant(spec, 0, 0).boundingBox.max.y / spec.height.mean` for every row in `FLORA`.
   - Known match: `fireweed` (`1.1170 / 1.1 = 1.0155`, inside `[0.95, 1.05]`).
   - Known mismatch (pre-T-0049): `juniper` with `/ Math.cos(1.1)` (`1.0882 / 0.5 = 2.1765`, outside `[0.95, 1.05]`).
   - Post-fix `juniper`: `0.4938 / 0.5 = 0.9876` (inside `[0.95, 1.05]`).
   - Placed stems on seed 1400 (`STAGES.on = true`), tile `(7, 10)`: all five junipers (`h = 0.48..0.75 m`) have drawn tops `max.y * (h / mean) = 0.4741..0.7407 m <= 0.9 m`.
2. Capture an in-game verification frame at `(145.16, 208.49)` using `node refs/flora/t0049-juniper/capture.mjs 5250` with a preview server on port `5250`.

### 3. Run unit tests
- `npx tsx --test tests/flora.test.ts`
- `npx tsc --noEmit`

## Mistakes to avoid
- **Dividing prostrate stem lengths by `cos(mat)` when `mat > 1 rad`**: When `mat` approaches `π/2`, `1 / cos(mat)` blows up while secondary branches still pitch upward toward `+Y`, making prostrate mats taller than upright shrubs.
- **Changing the species row (`height.max`) to hide a generator overshoot**: `Juniperus communis var. depressa` in boreal shield outcrops is a low mat (`0.25–0.9 m`, mean `0.5 m`); keep the botanical row intact and fix the generator.
