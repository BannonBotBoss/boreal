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
- After, 400 m: rounded crowns, dark blue-green and yellow-green, several sizes. Clusters close into patches. The shadow sits to the lower left of each crown. No black ring. Gaps are a muted olive. The field reaches the frame. Rounder and more even than `tasks/evidence/T-0199/ref-naip-canopy.png`.
- After, 800 m: the same crowns, smaller, with more olive floor between them. The 24000 cap thins this wider view, so fewer patches close. Gap colour is about sRGB (85, 114, 77).

## Picture check

Bright crown share at the top band against the centre. Tool `tests/overhead-picture.test.ts`.

| frame | top crown share | gate |
|---|---|---|
| before 400 and 800 | under 0.08 | known mismatch |
| after 400 and 800 | above 0.45, and at least 0.75 of the centre | pass |
| after, centre | black share under 0.05 | a near-black floor fails |

## Needs from another agent

Grokbot-1's approve. No self-approve on this task.
