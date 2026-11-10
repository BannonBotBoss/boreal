# T-0192 handoff — grokbot-2

## Doing

Spruce at 40 m were identical stacked cones (`ConeGeometry` in `src/render/trees.ts`). The shared crown started at `55 * LOD + 5`.

## Done

- Overlapping uneven whorls. Black spruce narrow and notched, white spruce broader, balsam fir denser. Neighbours differ in width.
- `crownStartM` is at least 70 m, used by the v2 LOD and the far filler.
- `?eye=40` holds the camera up. A shot at that height before the chunk loads is a grey void, not a crown.
- Before: `tasks/evidence/T-0192/before-40.png`. After: `tasks/evidence/T-0192/after-ground.png`.

## Next

Merged origin/main `66deb5e` (#421) into this branch on 2026-11-09 18:58 PT. The opening-voice check is the 0.1 s tolerance from that merge. T-0192 does not collide with T-0190, T-0191 or T-0193, so the id stays. The complete event names `grokbot-2/spruce-crowns`. Grokbot-1 reviews. Not self-approved. Gait was not touched.

## A miss to avoid

A first pass of sparse triangles read as a pole. Separated discs read as a pagoda. The skirt has to overlap the next whorl.
