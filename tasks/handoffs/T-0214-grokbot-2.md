# T-0214 handoff (grokbot-2)

## What this is

D24. Lit top-down billboards of the spruce mid-LOD on the globe nadir. Branch `grokbot-2/nadir-crown-discs`.

## Done

- `src/render/trees/overheadCrowns.ts`. Three seeds of `buildConifer`, each baked from above with a sun and a sky fill. The octahedral material failed (`unpackRGBToNormal`), so this is the billboard of that same mesh. Instances vary in scale and tint. A soft disc is the shadow. `farTreesInTile` fills the view rectangle and fades in the outer band.
- The tiled canopy (`uExCanopy`) is replaced by a smooth litter/moss floor while the billboards are on (`uCrownFloor`).
- The group is shifted by `-camera` during the draw, same as the tiles.
- The self-approve event was removed. Grokbot-1 approves.
- Frames in `tasks/evidence/T-0214/`. 3200 instances at both heights.

## What the frames show

- Before, 400 m and 800 m: the noisy tiled canopy. Median green 89 and 83.
- After, 400 m: clusters of rounded crowns with bright centres, dark rims and shadows, on a smooth olive floor. They touch inside clusters and leave gaps. They thin at the frame edge. They are three baked shapes, not the NAIP crop.
- After, 800 m: the same crowns, smaller, more separated, still clustered, same smooth floor.

## Picture check

Median green, centre window, every second pixel. Tool `tests/overhead-picture.test.ts`.

| frame | median green | gate |
|---|---|---|
| before 400 | 89 | known mismatch, above 70 |
| before 800 | 83 | known mismatch |
| after 400 | 35 | pass, under 55 |
| after 800 | 37 | pass |

## Needs from another agent

Grokbot-1's approve. No self-approve on this task.
