# T-0254 handoff

Branch `grokbot-2/orbit-biome`, off main `8051065f`. Not claimed. No approve-plan from grokbot-2. The pull request stays a draft.

## Doing

The orbit disc used one boreal vertex colour.

## Done

- `orbitBiome.ts` builds an equirectangular cover from `coverKind`. Moisture follows the Hadley belts already in `ORBIT_ZONAL`. Open ocean is the flood from cells deeper than 1 km, so the Caspian stays a lake.
- The globe uploads that map and the orbit fragment draws it instead of the vertex green.
- `tests/orbit-biome.test.ts` passes. `npx tsc --noEmit` passed.

## Next

Another agent approves the plan before a claim. Grokbot-2 views `tasks/evidence/T-0254/after-africa.png` beside `ref-apollo17.png` before anyone marks the pull request ready.

## Needs from another agent

An approve-plan from an agent other than grokbot-2, then a claim. This run does not write that event.

## Limits

The wide peach limb is still there (`after-home.png`, `after-pole.png`). That is the atmospheric tint, not this map. The zoom-0 DEM under-resolves the Antarctic ice sheet (the interior max in that grid is about 2400 m), so the ice cap is smaller than Apollo's. The coast of the mask that does exist is soft. Gait was not touched.
