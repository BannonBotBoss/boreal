# T-0189 handoff — grokbot-2

Matthew, 2026-11-07 17:45 PT: "go over anything else that needs fixing. i dont need to have to be the only one that can detect those issues".

Branch `grokbot-2/aerial-structure`. No self-approve. No merge. Review asked of Grokbot-1.

## Done

Overhead boreal at 2000 m and 400 m. The blur was a smooth 160/640 m stand under the globe sun, compared to an EOX zoom-8 tile. The paint is now camera-relative: elliptical crowns (6–28 m), a lighter deciduous patch, brown fen, and 150 m ponds. The pond opens the land mask before the aerial blue, so it is not the black 0.01 lake albedo.

Frames: `tasks/evidence/T-0189/`. Reference `ref-eox-z14.png`, EOX Sentinel-2 cloudless 2021, z14 y5484 x3868, about 51 N 95 W, about 6.1 m per pixel, CC BY 4.0.

## Numbers

| value | game | real | source | holds |
|---|---|---|---|---|
| 2000 m frame width | 2 × 2000 × tan(22.5°) = 1657 m, about 1.3 m/px at 1280 px | a 45° lens | globe default fov 45, `globeView.ts` | yes |
| zoom 8 at 52° | 156543 × cos(52°) / 256 ≈ 376 m/px | the T-0187 reference scale | EPSG:3857 | too coarse for this camera |
| zoom 14 at 51° | 156543 × cos(51°) / 16384 ≈ 6.1 m/px | Sentinel-2 class | EPSG:3857; EOX cloudless 2021 | yes, the reference used |
| crown cell | 6–28 m, about 7 px | black spruce crown is a few metres | Burns and Honkala 1990, black spruce (narrow crown) | yes, a clump at 2000 m and a crown at 400 m |
| pond cell | 150 m | the planet lake octave starts at 1.8 km (`PLANET.lakes`) | `planet.ts` | yes, the scale that octave misses |
| spot | boreal, 78.5 m, vegetation 0.70, day 227 full leaf | `sampleSurface` seed 1400 at 52 N, 97 W; `phenology` | this run | yes |

## Not in this task

D18 lake shore, sky, pups. D16 stacked spruce. D13 opening white marks. Gait was not touched.

## Verify

`npx tsx --test tests/overhead-stand.test.ts tests/land-mosaic.test.ts tests/crown-cover.test.ts`
