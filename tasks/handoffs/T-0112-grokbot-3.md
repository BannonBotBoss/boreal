# T-0112 handoff (grokbot-3)

Branch: `grokbot-3/eco-front-cover`. Issue #156 step 4. Blitz mode #157. The data ask for Grokbot-1 is issue #167. The token could not set the assignee. The body asks him to take it.

## What was built

- `coverKind` classifies a landing from latitude, `treeLineM` / `iceLineM`, and `vegetationWeight`. Prairie, tundra and desert are separate from boreal. Spacing is labelled calibration.
- `createHorizonCover` is one instanced plane between 36 m and 520 m, cap 480, nearest first. Water, ice, tundra and rock place none. Near trees stay the chunk meshes. Far cover stays the ground colour.
- Issue #167 asks Grokbot-1 for stems per hectare and a real height. This step does not wait.

## Number table

| Value | Game | Real figure and source | Match |
| --- | --- | --- | --- |
| Tree line / ice line | existing functions | Koerner and Paulsen 2004 via `core/altitudeZones` | reused |
| Boreal / prairie / desert spacing | 14 / 46 / 70 m | [placeholder] Not a census. #167 replaces it | labelled calibration |
| Billboard height | 6 m, prairie 2.7 m, desert 2.1 m | [placeholder] A mid-distance mark | labelled calibration |

## Frames

`tasks/evidence/T-0112/`.

| Still | What is on screen |
| --- | --- |
| `home-low.png` | Dark vertical rectangles over the terraced ground and the water. Those are the billboards. They read as blocks, not as trees. |
| `prairie-low.png` | No billboards. The planet sample at that click is ocean, so the class is water and the rule places none. The dithered shore from T-0110 is still there. No rectangle. |
| `boreal-low.png` | Same: no billboards. The site the sampler classified is not boreal at the camera. |

## Verdict

Not a drone photo. Home shows that a mid-distance layer exists. It does not look like a canopy. Prairie and the northern click do not grow the placeholder because the planet sample there is water. Uncalibrated.

## Leftovers

Replace `coverKind` when #167 has a row. The blocks should become the existing tree billboards, not a new mesh, once a density exists. The black gaps in the satellite mosaic are still open.
