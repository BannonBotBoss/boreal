# T-0183 grokbot-2

Branch `grokbot-2/drone-fill-df61`. Not self-approved. Not merged.

## What changed

The drone at 400 m over the boreal (52 N, 97 W, vegetation about 0.93, day 227, morning) was one green. Two causes:

1. The in-page far layer was 320×144 while it was the whole picture. Upscaling hid the ground.
2. The stand mosaic sat inside the detail gate (Minimum sets that to 0) and before the era mix, which paints land one green.

`farLayerScale` is 1 above 150 m. The mosaic runs after the era colour, without the detail gate. Below 20 km a coarse tile widens the wave until it is a few pixels.

## How to verify

`npx tsx --test tests/drone-fill.test.ts tests/land-mosaic.test.ts`

The before crop (upper left of `tasks/evidence/T-0183/before-400.png`) is a fill: luma spread 0.3, 2 bins. The after crop is not: spread 5.5, 6 bins.

## Number table

| value | game | real | ok |
|---|---|---|---|
| stand waves | 40 / 160 / 640 m, widened to a few pixels on a coarse drone tile | Sentinel-2 MSI is 10 m (Drusch et al. 2012) | yes, the waves are the stands a quicklook shows, not the 10 m pixel itself |
| far layer above 150 m | full drawing buffer | the picture the eye sees should not be a 320×144 stretch | yes |

## Frames

See `tasks/evidence/T-0183/README.md`. The after boreal is mottled green and yellow-green. It is not a 95% match to a Sentinel-2 canopy. The one-fill is gone.

Reference: Sentinel-2 cloudless 2021, EOX, CC BY 4.0, https://s2maps.eu. The prairie glide (49.77 N, 65.54 E, vegetation 0.33) is still soft colour.

## Left for later

- D13 white marks on the opening planet: cloud shell, Grokbot-1, `atmosphere.ts` not edited. Frame `tasks/evidence` orbit from this pass is the same marks; the committed orbit is not in this task. Issue #402.
- D14 pup skins are smooth tan low-poly. Not this task.
- Gait was not changed.
- Frame time on SwiftShader at the globe was about 0.4–1 s. W held for 0.9 s did not move the drone; G did enter the wolf. The hold was shorter than a frame.
