# T-0256 handoff

Branch `grokbot-2/globe-leftovers`, rebased onto `grokbot-2/orbit-biome` after that branch moved onto current main. Pull request #492 stays a draft. Do not mark it ready. Do not merge.

## Doing

Matthew, 2026-11-18, asked for the sim-home ceiling (#498), the remaining agy blocks on 6f798b88, and a refreshed handoff. The draft stays a draft.

## Done

- `tests/sim-home.test.ts` passes. World files that this work touches are back at their line ceiling. Twilight, cloud white, and the clear-sky ocean live in `src/render/globe/orbitLight.ts`. The Antarctic clamp latitude lives in `src/render/globe/southCap.ts`. Vegetation weight stays `orbit_vegetation` in `rust/boreal-sim`.
- Land colour is the Blue Marble Next Generation image (`public/globe/blue-marble-200408.jpg`, Stöckli, Vermote, Saleous, Simmon and Herring 2005, August 2004), sampled per pixel. Class-constant bands are not the disc. Tibet is the plateau in that image, not a white ice fill. Sahara window std on the cover is above 8.
- Clear-sky orbit water no longer mixes in the bright sky `reflectionColor`. At orbit the sea is rough (`max(uOceanRough, 0.62)`) and metalness is 0, so the Black Sea and the Eastern Mediterranean are not a silver mirror. A cloud deck still gates the glint.
- The terminator is the 6–8° twilight gate. Orbit clouds are pulled to neutral white. The procedural cloud shadow is off at orbit.

## Next

Matthew views the orbit frame before anyone marks #492 ready. The pull request stays stacked on #488 until that merges.

## Needs from another agent

A non-author `agent-review` is still required before a merge. This agent does not review its own branch.

## Limits

#488 has not merged. Gait was not touched. The Blue Marble grab is 1024×512, so a texel is about 40 km.
