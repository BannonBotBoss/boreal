# River water stays inside the ground

Use this when a channel's water surface stands above dry ground: a teal wall beside a meadow, or a bank lower than the sheet. The water is following the Priority-Flood filled surface and is drawn only inside the channel width.

## Steps

1. Measure before changing anything. `npx tsx refs/water/river-audit/contained.ts` prints the share of drawn segments whose surface is more than 2 cm above the ground 1 m beyond the sheet (`half + bank + 1`). That script calls `riverContainment` in `src/core/stages/riverContain.ts`. The old network on seed 1400 was 572 segments, open share 0.615, median lift 1.53 m.
2. Pond the depressions the channel actually crosses. A Priority-Flood residual deeper than `RIVER.freeboard` (0.12 m) is ground below the spill (Barnes, Lehman & Mulla 2014). Flood-fill those cells 8-connected from a channel cell, skipping stage-2b lakes (`lakeMinDepth` 12 m) and outlets. The body's level is the max filled height, the same shoreline test as `lakeAt`. Area under 2 ha is a pond, otherwise a lake (the cut already in `lakeGrid`, Biggs et al. 2005). Set `drawn` to 0 on those cells. The why chain on every body is `filled -> ponded -> spilled`.
3. Leave off-channel pits alone. They are the peat case in `soils.ts`. Do not lower `ELEV.lakeMinDepth`.
4. Breach what is still drawn. For each drawn segment, if a side 1 m past the bank is not already water, cap the segment's surface at that ground plus just under 2 cm. Repeat while carving a neighbour lowers the bank. This is Lindsay 2016's idea (lower the surface to the confining ground). Do not port WhiteboxTools. Slope and Manning speed stay on the filled surface; T-0030 owns them.
5. Draw the sheet from `pondAt` the same way as `lakeAt`. A dry vertex that shares a triangle with water sits on the ground, not 0.6 m under it. A wet vertex beside lower dry ground drops to that ground, so the last cell is the waterline.
6. Teach every wetness check: `surfaceAt`, `terrainBand`, `isDryLand`, `siteAt`, and the globe mask. A pond that only the river code knows about still grows trees.

## Files

- `src/core/stages/rivers.ts` — `pondAt`, `riverPondGrid`, `POND_WHY`, the per-segment cap.
- `src/core/stages/riverContain.ts` — the 2 cm audit.
- `src/core/stages/surfaceAt.ts`, `src/core/world.ts`, `src/core/flora/site.ts`, `src/render/terrainCore.ts`, `src/world/globe/lakeMask.ts`, `src/world/globe/inpage.ts`.
- `refs/water/river-audit/contained.ts` and `slopes.ts` — remeasure after the drawn set changes. Flats leave the channel sample because they are ponds.

## Checks

- `riverContainment(1400)` and `riverContainment(7)` return `openShare` 0 and `edgeHeightM` null. The known mismatch is the pre-change 0.615.
- Every pond body has `why` `['filled', 'ponded', 'spilled']`. Channel cells inside a pond are not drawn.
- A water-sheet vertex that touches a dry vertex is not above that ground, and the dry vertex is at `heightAt`, not `heightAt - 0.6`. `tests/river-contain.test.ts`.
- `npx tsc --noEmit` and `npm test`.

## Mistakes

- Drawing the filled surface inside `half + bank` and sinking every other vertex by 0.6 m builds a curtain wherever the fill is above the meadow. Widening the bank does not fix a depression; the meadow is the pond.
- Porting `BreachDepressionsLeastCost` pulls in Whitebox's licence and a raster rewrite. The cap is the same hydrostatic constraint on the segments the audit samples.
- Starting the pond flood from every pit, not from a channel cell, turns off-channel fens into open water and moves the soil fractions.
- Putting ponds only in `riverAt` leaves `isDryLand` and `siteAt` planting the flooded ground.
- Bumping `GENERATOR_VERSION` to "keep saves valid" reshuffles every chunk seed (the version is in the hash) and rejects forage records, which are stored as `generatorVersion: 1`. Lakes already omit entities through `isDryLand` without a version bump. Ponds use that same skip.
- `slopes.ts` counts drawn cells only. After ponding, the flat-fill share falls because those cells are no longer channels. Report both numbers. Do not retune Manning here.
