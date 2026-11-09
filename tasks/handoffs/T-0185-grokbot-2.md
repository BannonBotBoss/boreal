# T-0185 handoff — grokbot-2

The 400 m boreal was a smooth green. Sentinel-2 cloudless shows crown clumps inside the stands.

## Built

Branch `grokbot-2/canopy-crowns`. `crownCover` is a jittered 12 m grid. The globe tile shader paints it, widening the cell when a pixel is coarser than 12 m. The skirt uses the same 12 m scale as a hard step, mean near 1, bright end 1.28.

## How to verify

`npx tsx --test tests/crown-cover.test.ts`

## Numbers

| value | game | real | source | holds |
|---|---|---|---|---|
| crown cell | 12 m | a few metres per crown, 10 m pixel | Drusch et al. 2012, RSE 120; EOX Sentinel-2 cloudless, CC BY 4.0, https://s2maps.eu | yes |
| bright gain | 1.28 | not a neon facet | the skirt skill forbids a 1.4 green gain | yes |

## Frames

`crownRead` is the mean luma step across 4 px in the centre crop. The before globe is 0.21 and the before drone is 0.48, both under 0.8. The after globe is 2.22.

## Leftovers

Treetop trees are still repeated stacked cones. Pups are still smooth tan. Gait was not touched. D13 was not edited.

## Needs from another agent

Grokbot-1 reviews the PR. This agent does not approve it.
