# T-0190 handoff — grokbot-2

Direct request 2026-11-09 15:30 PT: fix D17c. Stop the procedural shader passes. Real aerial exemplars, biome weights, Heitz and Deliot tiling, hard shoreline from the height field.

Branch `grokbot-2/aerial-exemplars`. No self-approve. No merge. Review asked of @Grokbot-1.

## Done

The 400–2000 m band no longer paints crowns, fen rings, or punched ponds. `coverWeights` repeats the mixes in `surfaceColour` and is stored on the vertex. The fragment blends four NAIP crops (canopy, fen, shore, open water) with the Deliot and Heitz runtime ported from Error-mdl/UnityGaussianTex. Open water is `landMask` from the height field. A shore crop mixes in where the field is within 40 m of the contour.

Frames: `tasks/evidence/T-0190/`. Reference `tasks/evidence/T-0189/ref-eox-z14.png`.

## Numbers

| value | game | real | source | holds |
|---|---|---|---|---|
| 2000 m frame | 1656 m across, 1.29 m/px | 45° lens, 1280 px | `globeView.ts` fov 45 | yes |
| 400 m frame | 331 m across, 0.259 m/px | same lens | same | yes |
| exemplar | 1.60 m/px, 204 m per 128 px crop | NAIP zoom 16 near 48.1 N | USGS Imagery Only, public domain; `public/aerial/meta.json` | yes, inside 1–10 m |
| reference | 6.0 m/px | Sentinel-2 class | EOX cloudless 2021, CC BY 4.0, z14 y5484 x3868 | yes, the comparison tile |
| exposure | `uExGain` 2.5 | the globe sun (3.2, Lambert/π, ACES) crushed the photograph at gain 0.4 (luma ~26) | measured on these stills; the EOX tile's centre luma is ~48 | yes, the stills sit in that range |
| water at this spot | 0.7% of a 6 km grid under the level; centre is 35 m above it | the height field, not a painted pond | `sampleSurface` seed 1400 at 52 N, 97 W | yes, so the frame is canopy |

## Frames

What I see at 2000 m: a continuous canopy of real crowns, green and mottled, with a faint diagonal from the tiling lattice. Not black spots on flat green, and not navy ponds with orange rings.

What I see at 400 m: the same crowns, larger, a bit blocky because the source is 1.6 m per pixel and the camera resolves 0.26 m. Not green static.

The reference beside them is a different place in the same biome: lakes, tan shore, and forest. This coordinate is a ridge, so the height field does not draw those lakes. The right half of `side-400.png` is the Sentinel tile enlarged to 0.26 m per pixel, which is soft because the tile is 6 m data.

## Cold splash (not fixed here)

On a cold start the label stays on "Generating the land around you…" for up to two 20 s ceilings (`settle` while the interest queue is full, then `settleWhenLandReady`), because grass and flora keep `queued()` true (`startup.ts`). It then stays on "Measuring your graphics hardware…" for `getGPUTier` (6 s race), a 10 s settle, `benchFrames` (15 s), and `warmUp` (6 s). SwiftShader hits those ceilings. A click does not dismiss it: `#loading` covers the page until `createLoading().finish()` adds `.fade`, and nothing listens for a click. `opening.ts` ignores clicks inside `#loading`.

## Verify

`npx tsx --test tests/aerial-exemplar.test.ts tests/overhead-stand.test.ts tests/land-mosaic.test.ts`

## Needs from another agent

@Grokbot-1: review the PR. Do not treat this handoff as an approval.
