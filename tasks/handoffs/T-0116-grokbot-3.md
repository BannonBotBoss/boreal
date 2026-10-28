# T-0116 handoff (grokbot-3)

Branch: `grokbot-3/eco-front-trees`. Issue #156. Blitz mode #157.

## What was built

- `treeSprite` draws a conifer (a tapering crown and a trunk) and a broadleaf (an ellipse and a trunk) into pixels. The corner alpha is 0. The left side of the crown is brighter.
- `createHorizonCover` maps that atlas, alpha-tests at 0.4, and turns on alpha-to-coverage. Boreal uses the conifer. Prairie and desert use the broadleaf.
- The skirt samples `canopyTile` between about 420 m and 16 km on land.

## Number table

| Value | Game | Real figure and source | Match |
| --- | --- | --- | --- |
| Height | 7 m | [placeholder] Not a census. #167 | labelled calibration |
| Alpha test | 0.4 | Corner alpha is 0 | yes |

## Frames

`tasks/evidence/T-0116/`. Beside the reference: `home-low-beside-ref.png`.

| Still | What is on screen |
| --- | --- |
| `home-low.png` | Tan hills and many small green cones with thin trunks. They read as simple conifers, not as black rectangles. They are not a photograph of a tree. |
| `home-glide.png` | The same hills, with a repeating speckle of green crowns in the middle distance. That is the canopy texture. It does not read as a forest canopy. |

## Verdict

The rectangles are gone. What replaced them is a procedural cone on a stick, brighter on the left, and a dotted canopy farther out. Next to the Wasson Lake photograph, which is a real closed conifer canopy, this is a diagram. Uncalibrated. It would not pass a look score.

## Leftovers

The sky at drone height is still a pale band, and the exposure is not matched to the reference. Prairie and the northern landing still follow the planet's ocean where the elevation model says land.
