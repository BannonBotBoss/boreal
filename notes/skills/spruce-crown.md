# Skill: a spruce crown that is not a stack of cones

Use when spruce at playing distance are identical cones.

## Search before writing

1. The stacked cones are `ConeGeometry` in `src/render/trees.ts`, one tier per whorl, for every `form: 'spire'` that trees v2 does not take. Black spruce on `?trees=v2` is `src/render/trees/conifer.ts` (Weber and Penn). White spruce and balsam fir are the cone path.
2. Photos and the species notes are already in the repo: `tools/tree-ref/` (club tops, a stand) and `src/core/treeSpecies.ts` (Viereck and Johnston 1990, Nienstaedt and Zasada 1990, Frank 1990).
3. The shared crown used to start at `55 * LOD + 5`. On Minimum that is 32 m, so a 40 m eye was on the shared crown. `crownStartM` holds the mid mesh out to at least 70 m.

## Steps

1. Replace the cone stack with overlapping drooping whorls. Black spruce is narrower, notched, and club-tipped. White spruce is broader. Balsam fir is a denser spire. A per-tree scale keeps neighbours from one size.
2. Do not leave a gap between tiers. A thin disc on a visible trunk reads as a pole, not a crown. The skirt has to reach the next whorl.
3. `?eye=40` holds the camera that many metres up, the same kind of hook as `?at`.

## Checks

- `tests/spruce-crown.test.ts`: outer radius ratio above 1.25, white spruce widths span more than 0.6 m, and `crownStartM(0.5)` is 70.
- The frame check: green above the horizon. A cone is a flat facet (a pixel and the pixel four steps away are the same green). The T-0189 40 m frame is about 0.28 flat. The filled whorls are under 0.14.

## Mistakes to avoid

- A skipped sector with no fill is a telephone pole.
- Separated discs are a pagoda. Overlap them.
- Do not judge the 40 m frame before the standing chunk has loaded. An unloaded ring is a grey void, not a crown.
