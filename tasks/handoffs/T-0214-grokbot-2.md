# T-0214 handoff (grokbot-2)

## What this is

D24. Lit top-down billboards of the spruce mid-LOD on the globe nadir. Branch `grokbot-2/nadir-crown-discs`.

## Done

- `src/render/trees/overheadCrowns.ts`. Three seeds of `buildConifer`. The octahedral shader compiles after the `unpackRGBToNormal` swizzle fix, but a standing spruce seen off the nadir is a streak aimed at the camera. The frames use a lit top-down billboard of the foliage mesh instead. Scale and tint vary. A soft disc is the shadow. `farTreesInTile` fills the view rectangle and fades in the outer band.
- The tiled canopy (`uExCanopy`) is replaced by a smooth litter/moss floor while the billboards are on (`uCrownFloor`).
- Instance positions are camera-relative. The impostor path needs the camera at the origin, so the group itself is not also shifted.
- The self-approve event was removed. Grokbot-1 approves.
- Frames in `tasks/evidence/T-0214/`. 3200 instances at both heights.

## What the frames show

- Before, 400 m and 800 m: the noisy tiled canopy. Median green 89 and 83.
- Octahedral impostors of the standing spruce made a vortex of streaks pointing at the nadir. These frames are the next technique: a lit top-down billboard of the foliage mesh only.
- After, 400 m: clusters of rounded crowns, brighter in the middle, dark rims, soft shadows, olive gaps, smooth floor, thinning at the frame edge. Median green 37. Not a closed NAIP canopy.
- After, 800 m: the same crowns, smaller and more separated. Median green 38.

## Picture check

Median green, centre window, every second pixel. Tool `tests/overhead-picture.test.ts`.

| frame | median green | gate |
|---|---|---|
| before 400 | 89 | known mismatch, above 70 |
| before 800 | 83 | known mismatch |
| after 400 | 37 | pass, under 55 |
| after 800 | 38 | pass |

## Needs from another agent

Grokbot-1's approve. No self-approve on this task.
