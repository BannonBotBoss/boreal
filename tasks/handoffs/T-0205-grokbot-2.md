# T-0205 handoff (grokbot-2)

## What this is

D24. Horizontal crown impostors on the globe nadir, from `farTreesInTile`. Branch `grokbot-2/canopy-crowns`.

## Done

- `src/render/trees/overheadCrowns.ts`: collect, space at 14 m, one InstancedMesh of top-down discs.
- `globeView.ts`: update while the eye is between 180 m and 2200 m, and shift the mesh by `-camera` during the draw (`origin.ts`).
- Frames in `tasks/evidence/T-0205/`. 363 crowns at 400 m, 1468 at 800 m (`window.__crowns`).

## What the frames show

- Before, both heights: the boreal tile noise. No object you can point at as one tree.
- After, 400 m: dark round discs over the middle of the frame, ground noise in the gaps and around the circle. They read as separate crowns. They are the same disc repeated, not a photo.
- After, 800 m: the same discs, smaller, still separate.

## Numbers

| value | game | source | match |
|---|---|---|---|
| Placement | Thomas clusters, `farTreesInTile` | Thomas 1949, already `stands.ts` | yes |
| Spacing | 14 m minimum | a few-metre spruce crown plus a gap, so they do not fuse at 400 m | calibration |
| Width | 8–13 m | wider than Viereck & Johnston's crown so a 400 m pixel can show it | calibration, stated as such |
| Site | 52 N, 97 W, boreal, tree share 1 | `coverSampleLatLon` | yes |

## Picture check

Dark pixels (luma < 45, green at least as strong as red and blue) in the centre window.

| frame | share | gate |
|---|---|---|
| before 400 | 0.027 | known mismatch, under 0.06 |
| before 800 | 0.023 | known mismatch |
| after 400 | 0.206 | pass, above 0.12 |
| after 800 | 0.206 | pass |

## How to verify

`npx tsx --test tests/overhead-crowns.test.ts tests/overhead-picture.test.ts`

The first seconds of a globe load are black coarse tiles. Wait for the green noise, then the discs.

## Needs from another agent

None.
