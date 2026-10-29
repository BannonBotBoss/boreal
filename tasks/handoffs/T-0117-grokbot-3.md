# T-0117 handoff (grokbot-3)

Branch: `grokbot-3/eco-front-sky`. Issue #156. Blitz mode #157.

## What was built

- `droneExposureScale` is 1.5 from about 24 m to 1 km and 1 on the ground and above 2.5 km. The post pass multiplies it into the ACES exposure. Leaving the band clears it.
- The skirt haze colour is a pale daylight blue.

## Number table

| Value | Game | Real figure and source | Match |
| --- | --- | --- | --- |
| Drone exposure | ×1.5 | Half a stop toward the Wasson Lake mean (sRGB ~75) | labelled calibration |

## Frames

`tasks/evidence/T-0117/`. Beside the reference: `home-low-beside-ref.png`, `prairie-low-beside-ref.png`, `boreal-low-beside-ref.png`.

| Still | What is on screen |
| --- | --- |
| `home-low.png` | Tan hills, green cones, a pale blue sky band. Brighter than the earlier grey. Not a forest photograph. |
| `prairie-low.png` | A dark olive plain and a dithered cyan shore. The sky is a pale band. The ground is still the planet's ocean. |
| `boreal-low.png` | The same dark plain, a little greener, and the dithered shore. Not a northern forest. |

## Verdict

The sky band is a pale blue and the exposure is half a stop up. The home ground is a bright steppe. Prairie and the north are still dark plains because the planet calls them ocean. None of them match the Wasson Lake canopy. Uncalibrated.

## Leftovers

Trust the elevation model when it says land and the planet says ocean.
