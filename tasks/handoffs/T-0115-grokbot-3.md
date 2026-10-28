# T-0115 handoff (grokbot-3)

Branch: `grokbot-3/eco-front-terrain`. Issue #156, the blocky ground. Blitz mode #157. Sits on the photo-gap branch until that merges.

## What was built

- `ringLod`: 128 segments and 6 radial steps on the first two rings, 64 and 3 on the next three, 32 and 2 after that. The count scales down if it would pass 6,000 triangles.
- Odd vertices geomorph onto the chord of the coarser ring across the outer 45 % of each ring. Every triangle of a flat place still faces up (5,216 triangles, 0 downward, at a 400 m eye).
- `demSlope` is a 60 m central difference of the terrarium. The skirt uses it past 200 m and keeps a straight-up normal under the chunks.

## Number table

| Value | Game | Real figure and source | Match |
| --- | --- | --- | --- |
| Glide triangles | 4,184 | Was 1,872. Cap 6,000 | yes |
| Slope | 60 m spacing | Zoom 11 pixel about 76 m at the equator | labelled calibration |

## Frames

`tasks/evidence/T-0115/`. Beside the reference: `home-low-beside-ref.png`.

| Still | What is on screen |
| --- | --- |
| `home-low.png` | Tan ground with low rolling facets instead of the earlier flat slabs. The facets are still obvious. Dark rectangles are the billboards. The dithered square of the near chunks is still there. |
| `home-glide.png` | The same continuous mosaic, with softer large hills. Not a photograph of terrain. |
| `boreal-low.png` | Still a dark green plain and a dithered shore. Finer triangles do not make a dark tile look like a forest. |

## Verdict

The ground near the eye is less of a slab. It is still a low-poly hill, and it does not resemble the Wasson Lake photograph. Uncalibrated. It would not pass a look score.

## Leftovers

Trees that read as trees. A brighter sky and exposure. Trust the elevation model when the planet says ocean.
