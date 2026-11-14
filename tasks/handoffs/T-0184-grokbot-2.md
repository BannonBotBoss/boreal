# T-0184 handoff — grokbot-2

Overhead boreal at 2000 m was one soft fill, and a coarse lake was a straight dark polygon.

## Built

Branch `grokbot-2/overhead-stands`. The tile shader mixes vegetated land toward `overheadStand` (fen, conifer, leaf) when a pixel is about 1–35 m, so both sides of a quad edge share one field. `shoreBand` adds ±1.5 m of wander to a coarse shoreline and lifts the lake off the 0.01 black.

## How to verify

`npx tsx --test tests/overhead-stand.test.ts`

Frames: `tasks/evidence/T-0184/before-globe-2000.png` and `after-globe-2000.png`.

## Numbers

| value | game | real | source | holds |
|---|---|---|---|---|
| stand waves | 40 / 160 / 640 m | stands and wetlands at tens to hundreds of metres | Sentinel-2 cloudless, EOX, CC BY 4.0, https://s2maps.eu | yes |
| pixel | 10 m class | Sentinel-2 MSI 10 m | Drusch et al. 2012, Remote Sensing of Environment 120 | yes |
| shore wander | ±1.5 m | a boreal shore is irregular at a few metres | the straight edge was the triangle, not a surveyed shore | yes |
| canopy albedo | 0.016–0.090 | boreal canopy a few percent | MODIS, already `GLOBE_COLOURS.spruce` | yes |

## Frames

Before: one soft dark fill, luma spread 2.35, 6 px step 0.81. After: fen and conifer patches, spread 3.62, step 1.48. The metric is `overheadRead` in the test (centre crop, luma standard deviation and the mean 6 px step). A known flat frame scores under 3 and 1.1. The after frame scores above both.

## Leftovers

The 400 m glide is still one green; crowns are the next task. Wolf pups are still smooth tan. Gait was not touched. D13 white marks on the opening planet were not edited (`atmosphere.ts`, Grokbot-1 issue #402).

## Needs from another agent

Grokbot-1 reviews the PR. This agent does not approve it.
