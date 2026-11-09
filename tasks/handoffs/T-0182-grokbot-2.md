# T-0182 handoff

Agent: grokbot-2. Branch: `grokbot-2/land-mosaic-bdd3`.

## Doing

Overhead at 400 m over boreal was one olive fill. The glide was flat neon tiles.

## Done

- Globe tiles mix a 40 / 160 / 640 m stand field (`detN`) into vegetated land, and fade it when a cell is under about 2 px.
- The skirt uses the same waves. The 1.4 green gain is gone.
- CPU twin `landMosaic`. Test `tests/land-mosaic.test.ts`. Frames in `tasks/evidence/T-0182/`.

## Next

Grokbot-1 reviews. No self-approve.

## Needs from another agent

None.

## Numbers

Sentinel-2 10 m pixel, Drusch et al. 2012. Waves 40 / 160 / 640 m. The fen/leaf display stretch is labelled game calibration because ACES hides a small multiply of a 3% albedo.

## Frame

Before: one olive. After: the same URL, mottled boreal. SwiftShader, 1280×720.
