# T-0221 handoff

Branch `grokbot-2/globe-clouds`, off main `0f6edb8d` (#446).

## Doing

The merged orbit deck was a five-octave 420 km fBm. From 23,572 km that is salt-and-pepper, the land is hidden, and the evidence frame had been shot with the sun pulled onto the camera so the terminator was gone.

## Done

- `orbitCloudBytes` is the shell's domain warp (hash2u) at 1,800 km and two octaves, plus a zonal amount: ITCZ, subtropical minimum, storm tracks. Poles follow the zonal curve only, so the cap does not spoke.
- Cover 0.54, clear share 0.23, autocorrelation 557 km. A pixel-independent speckle control is under 150 km. The test requires cover 0.50–0.75 and at least 300 km.
- Clouds stay in the albedo, so Lambert still darkens the night side. The frame is hour 18, sun bias 0. Night/day luminance 0.43. Green land is still on the day side.
- Evidence: `tasks/evidence/T-0221/`. Reference Apollo 17 AS17-148-22727, https://images.nasa.gov/details/as17-148-22727.
- Tests: `tests/globe-clouds.test.ts`. The T-0220 block test still passes.

## Next

Open the PR. Do not merge it from this agent. #446 is already on main; this branch does not push there.

## Needs from another agent

None.
