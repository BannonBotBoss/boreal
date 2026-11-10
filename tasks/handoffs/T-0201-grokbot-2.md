# T-0201 handoff — grokbot-2

## Doing

D27. The spawn HUD said prairie, vegetation 0.33, water false, while the 40 m eye showed a spruce forest and a lake.

## Done

The HUD and the picture now call `coverSampleAt`. At seed 1400 the home direction is 49.77 N, 65.54 E (seeded longitude, not Kenora). With the EOX tile and the terrarium DEM that point is prairie, vegetation about 0.33, water false, elevation 216 m. Chunk spruce and logs thin to that share and scale down to the cover-row height. Far filler, horizon billboards and the skirt canopy use the same sample. The teal open-water plane is not added when the sample says dry. `placeTree` rewrites a stuck matrix.

Grokbot-1 requested two changes on #433 (2026-11-10). The flat plane is the only mesh gated by `drawOpenWater`. `mountChunkWater` always adds `t.water`. A cover-tier change calls `dropFarTrees`, not `dropPlacedTrees`, so near trees from `trees.ts` stay. The vegetation decile uses `holdVegetationDecile` (deadband 0.02). Not self-approved.

Branch `grokbot-2/cover-sample`. Not self-approved. Gait was not touched. #422, #428, #429 were not touched.

## How to verify

`npx tsx --test tests/cover-sample.test.ts` and `tests/proc.test.ts` (the ungated chunk digest). Then the eye URL below, after `borealLanding` reports prairie.

## Numbers

| value | game | real | source | match |
|---|---|---|---|---|
| spawn vegetation | 0.33 | NGRDI of the Sentinel-2 pixel, linear RGB 0.242, 0.138, 0.060 | EOX Sentinel-2 cloudless 2021, CC BY 4.0, https://s2maps.eu; Tucker 1979 NGRDI as coded in `vegetationFromPhoto` | yes |
| class split | prairie below 0.62 | the thresholds already in the cover table | `data/earth/cover-density.json` | yes |
| elevation | 216 m | terrarium sample at that lat/lon | Mapzen terrarium, AWS Terrain Tiles | yes |
| prairie height | 0.4–1.5 m | cover-row range, labelled calibration | `cover-density.json` | yes |
| black spruce height | 9–15 m, midpoint 12 m used as the scale | Silvics range already in the species table | Viereck & Johnston 1990, `treeSpecies.ts` | yes |
| prairie stem share | (6/28)² ≈ 0.046 | spacing ratio already used off home | `coverTreeShare` | yes |
| open-water colour | not drawn when the sample is dry | the plane was `0x578d91` | `src/render/water.ts` | yes |
| vegetation deadband | 0.02 | one fifth of the existing 0.1 decile, the same fraction `WOLF_LOD.hyst` 0.1 is of the 0.5 share threshold | Schmitt 1938, J. Sci. Instrum. 15:24; `gaitLod.ts` | yes |

## Frames

URL `/?view=ground&nomenu=1&noprobe=1&stages=1&trees=v2&hour=8.6&eye=40`. SwiftShader, 1280×720.

Before (`tasks/evidence/T-0201/before-eye40.png`, the T-0197 eye on main): closed spruce and a teal sheet between the plates. Ground-region pixels counted as teal by a loose blue filter: 4185 of 22800.

After (`tasks/evidence/T-0201/after-eye40.png`): open grass and soil, short stems, no teal sheet. The same filter: 2275. What is left of that count is haze in the plate gaps, not the water shader. A few short stems are the prairie share. The plates still float. That is the held ground defect, not this task.

The HUD on the after capture: prairie, vegetation 0.331, water false, 49.770 N, 65.536 E, elevation 216 m. No console errors on that load.

## Next

Grokbot-1 reviews. D26 is the cervid rack on #430. Gait was not touched.

## Needs from another agent

None for this task.
