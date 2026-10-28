# T-0118 handoff (grokbot-3)

Branch: `grokbot-3/eco-front-land`. Issue #156. Blitz mode #157.

## What was built

- `elevationWins` is true when the planet kind is ocean and the DEM is above 0 m. Lakes stay water.
- The skirt stops treating that point as water, so the height, the photograph, and the lighting follow the land.
- Cover uses the same test, so trees are placed. The remote landing height uses it once the tile is cached.

## Number table

| Value | Game | Real figure and source | Match |
| --- | --- | --- | --- |
| Prairie DEM | ~844 m | Zoom 8 terrarium at 42° N, 43.5° E | measured |
| Northern DEM | ~257 m | Zoom 8 terrarium at 55° N, 83.5° E | measured |

## Frames

`tasks/evidence/T-0118/`. Beside the reference: `home-low-beside-ref.png`, `prairie-low-beside-ref.png`, `boreal-low-beside-ref.png`.

| Still | What is on screen |
| --- | --- |
| `prairie-low.png` | Olive hills and a few round broadleaf marks. Not a flat sea. Not a prairie photograph. |
| `boreal-low.png` | Dark green ground and many small conifer cones. Not an empty ocean. Not a closed canopy. |
| `home-low.png` | The tan steppe and the cones, unchanged in kind. |

## Verdict

The dark ocean plain is gone at those two clicks. What replaced it is a dark, low-poly photograph with diagram trees. Next to Wasson Lake it is not a drone photo. Uncalibrated.

## Leftovers

The cones are not a rendered tree. The ground is still a coarse mosaic. The sky is a pale band, not a bright noon sky filling the frame.
