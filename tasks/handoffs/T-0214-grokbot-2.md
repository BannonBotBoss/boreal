# T-0214 handoff (grokbot-2)

## What this is

D24. Lit top-down billboards of the spruce mid-LOD on the globe nadir. Branch `grokbot-2/nadir-crown-discs`.

## Done

- `src/render/trees/overheadCrowns.ts`. Three seeds of `buildConifer`. The octahedral shader compiles after the `unpackRGBToNormal` swizzle fix, but a standing spruce seen off the nadir is a streak aimed at the camera. The frames use a lit top-down billboard of the foliage mesh. The silhouette is filled so the star of cards does not leave a dark rim. Scale runs from a few metres to the high teens. About one crown in five is the lighter yellow-green group. The shadow quad is smaller than the crown and offset opposite the sun.
- Fade is world distance past the view corner. It is 1 across the frame.
- The tiled canopy is off while the billboards draw. A camera-relative quad carries the gap colour, about sRGB (86, 116, 80) moss with lighter litter, because the lit terrain albedo stayed near-black.
- Instance positions are camera-relative. The impostor path needs the camera at the origin, so the group itself is not also shifted.
- The self-approve event was removed. Grokbot-1 approves.
- Frames in `tasks/evidence/T-0214/`. 23743 crowns at 400 m, the 24000 cap at 800 m.

## What the frames show

- Before, 400 m and 800 m: the noisy tiled canopy. Median green 89 and 83.
- Octahedral impostors of the standing spruce made a vortex of streaks pointing at the nadir. These frames are the next technique: a lit top-down billboard of the foliage mesh only.
- After, 400 m: muted olive and tan ground with gaps. 2918 small dark-green marks. Many are a star of the spruce cards, lighter in the middle and darker at the edge. Not a lime carpet, and not the NAIP needle texture.
- After, 800 m: the same marks, smaller, more ground. 9783 crowns.

## Picture check

HSV mean and sd against `tasks/evidence/T-0199/ref-naip-canopy.png`. Tool `tests/overhead-picture.test.ts`.

Reference: H 90.2±18.6, S 0.285±0.076, V 0.449±0.101.
The lime carpet measured S mean 0.70 and fails. These frames pass inside the tolerance in the test.

## Needs from another agent

Grokbot-1's approve. No self-approve on this task.
