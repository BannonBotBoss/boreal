# T-0256 handoff

Branch `grokbot-2/globe-leftovers`, rebased onto `grokbot-2/orbit-biome` after that branch moved onto current main. Pull request #492 stays a draft. Do not mark it ready. Do not merge.

## Doing

Matthew, 2026-11-18, asked for the sim-home ceiling (#498), the remaining agy blocks on 6f798b88, and a refreshed handoff. The draft stays a draft.

## Done

- `tests/sim-home.test.ts` passes. World files that this work touches are back at their line ceiling. Twilight, cloud white, and the clear-sky ocean live in `src/render/globe/orbitLight.ts`. The Antarctic clamp latitude lives in `src/render/globe/southCap.ts`. Vegetation weight stays `orbit_vegetation` in `rust/boreal-sim`.
- Land colour is the Blue Marble Next Generation image (`public/globe/blue-marble-200408.jpg`, Stöckli, Vermote, Saleous, Simmon and Herring 2005, August 2004), sampled per pixel. Class-constant bands are not the disc. Tibet is the plateau in that image, not a white ice fill. Sahara window std on the cover is above 8.
- Clear-sky orbit water no longer mixes in the bright sky `reflectionColor`. At orbit the sea is rough (`max(uOceanRough, 0.62)`) and metalness is 0, so the Black Sea and the Eastern Mediterranean are not a silver mirror. A cloud deck still gates the glint.
- The terminator is the 6–8° twilight gate. Orbit clouds are pulled to neutral white. The procedural cloud shadow is off at orbit.

## Measured

Sahara window std is 13.6 on the cover bake (24°N 8°E, 24 px window, luminance 0.2126/0.7152/0.0722). The tool is `tests/globe-leftovers.test.ts`. A flat class band scores near 0, which is the mismatch. The gate is above 8.

Warm clouds on `tasks/evidence/T-0256/after-orbit.png` are 0 of 15,531 pixels with luma above 0.85, hue 10–40°, and saturation above 0.12. The same test counts them. The review's mismatch was 0.46%. This frame scores 0.

The `bisect-*.png` and `smear-clouds-off.png` files were removed. They were the class-constant cover. The shader no longer has a bisect switch, so those names are not reshot.

## Next

Matthew viewed the disc at `a7fcf6d4` and accepted the look. The pull request stays a draft, stacked on #488 until that merges. Then retarget onto main.

## Needs from another agent

A non-author `agent-review` is still required before a merge. This agent does not review its own branch.

## Limits

#488 has not merged. Gait was not touched. The Blue Marble grab is 1024×512, so a texel is about 40 km.
