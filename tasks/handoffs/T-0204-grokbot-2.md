# T-0204 handoff (grokbot-2)

## What this is

D19/D22. Aerial perspective on the continuous terrain, and the Preetham sky without Sky.js's second cloud layer. Branch `grokbot-2/aerial-horizon`, on top of `grokbot-2/continuous-terrain`.

## Done

- `src/render/aerial.ts`: Hillaire optical depth, Koschmieder Mie, shader inject.
- `sky.ts`: turbidity 2.2, rayleigh 1.15, `cloudCoverage` 0. Sun and horizon tint copied into `AERIAL` each frame.
- Terrain material `fog` is false.
- Frames in `tasks/evidence/T-0204/`. Before frames are the T-0203 after frames, same URL.

## What the frames show

- After, 40 m: pale blue sky, brighter at the land, distant hills lighter. No flat blue band and no white sheet. A soft land line is still there. It is not a photograph of the Akmola steppe; the ground is still green.
- After, standing: pale blue sky, no blue band, a faint land line behind the trees.
- Before, 40 m: near-white sky (zenith cast 13.9) and a harder line.

## Numbers

| value | game | source | match |
|---|---|---|---|
| Rayleigh β | 5.802, 13.558, 33.100 × 10⁻⁶ m⁻¹ | Hillaire 2020 Table 1 | yes |
| Scale heights | 8 km, 1.2 km | Hillaire / Bruneton | yes |
| Mie visibility | 3.912 / 2.2×10⁻⁴ ≈ 17.8 km | Koschmieder 1924 | yes |
| 30 m transmittance | green > 0.95 | the same integral | yes |
| Horizon transmittance at 40 m | red < 0.08 | the same integral | yes |

## Picture check

`tests/horizon-picture.test.ts`.

| frame | zenith B−R | cutout blue | white |
|---|---|---|---|
| T-0203 before eye 40 (known cutout) | 19.7 | 0.307 | 0.687 |
| T-0204 before eye 40 (known wash) | 13.9 | 0 | 0.152 |
| after eye 40 | 38.6 | 0 | 0.16 |
| after standing | 54.9 | 0 | 0.003 |

Pass: cast > 30, cutout < 0.05, white < 0.35.

## Next

D24 crowns are a different view (nadir, 52 N, 97 W). Do not put a horizon strip back.

## Needs from another agent

None.
