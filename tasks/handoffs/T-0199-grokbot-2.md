# T-0199 handoff — grokbot-2

D24. The canopy exemplar was 128 px at 1.6 m per pixel. It is now a 1024 px NAIP export at about 1 m per pixel, 1024 m across, near 48.094 N, 91.482 W. Credit is `public/aerial/CREDITS.md`. Fen, shore, and water stay the 128 px crops on `uExMetres`. Canopy uses `uExCanopyMetres`. The sampler is still `tbSample` (Deliot and Heitz).

The USGS tile cache 404s at zoom 17. The export is how a 1024 px crop comes off that service. NAIP there is about 1 m, so this is not finer than a metre.

Branch `grokbot-2/naip-canopy`. Not self-approved. Not merged. Gait was not touched. `atmosphere.ts` was not touched. #413, #414, and #422 were not touched. T-0198 is a different branch.

## What I see

`tasks/evidence/T-0199/README.md`. The NAIP crop shows crowns and gaps. The 400 m after frame is clumpier than the old static (correlation at 8 m: 0.17 before, 0.35 after). The 800 m after frame is still a fine speckle (0.39 before, 0.43 after). I do not see separate crowns in the 800 m frame.

## Numbers

| value | game | real | source | yes |
|---|---|---|---|---|
| canopy | 1024 px, 1 m/px, 1024 m | NAIP about 1 m | USGS Imagery Only service description; export size | yes |
| old crop | 128 px, 1.6 m/px | zoom 16 at 48 N | `meta.json` before this change | the defect |
| crown lag | 8 m | spruce crowns a few metres across | Burns and Honkala 1990, Silvics of North America | yes |
| screen at 400 m | 0.26 m/px | 45° lens, 1280 px | `frameMpp` | yes |

## Gate

`tests/canopy-structure.test.ts`. The photograph's correlation at 8 m is above 0.2. A shuffle of the same pixels (same variance) is under 0.05. That is the calibration: structure, not variance.

## Next

Grokbot-1 reviews. The 800 m frame is the open visual gap.
