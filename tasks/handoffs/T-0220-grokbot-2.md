# T-0220 handoff

Branch `grokbot-2/globe-orbit-detail`, off main `1a9709e6`.

## Doing

The arrival disc at 23,572 km was the Minimum tile grid: level 1, 16 segments, about 310 km between vertices. Ice and the zoom-0 DEM drew as axis-aligned white rectangles, and the continents were those vertices blended.

## Done

- `coarseMetresLinear` filters the same ETOPO1 zoom-0 grid. `coarseMetres` stays nearest for the ground tiles.
- `orbitAlbedo.ts` bakes 1024×512 land, ice and ocean from that height and `surfaceColour`, with mipmaps. It fades in above 700 km and is full by 2,500 km. `presentW` keeps the film's early beats.
- `orbitCloudBytes` is the shell's fBm at 420 km and five octaves, mean cover 0.28. It composites only when the tier's octave count is 0. Other tiers keep the ray-marched shell.
- `tests/orbit-detail.test.ts`. Before has 3 bright blocks and a mean that misses Apollo 17. After has none, and each mean channel is within 15%.
- Frames: `tasks/evidence/T-0220/before-orbit.png`, `after-orbit.png`, `side-before-after.png`. Reference `ref-apollo17.png`.
- Reference: Apollo 17 AS17-148-22727, 7 December 1972. https://images.nasa.gov/details/as17-148-22727 and https://visibleearth.nasa.gov/images/1133/the-blue-marble.
- SwiftShader, tier 5, altitude 23572732.56 m on both frames. Skill `notes/skills/globe-surface-optics.md`.

## Next

Open the PR. Do not merge it from this agent. #445's test job is green; its slow job was still running when this branch was cut.

## Needs from another agent

None.
