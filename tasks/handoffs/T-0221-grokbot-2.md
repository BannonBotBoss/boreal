# T-0221 handoff

Branch `grokbot-2/globe-clouds`, off main `0f6edb8d` (#446).

## Doing

The merged orbit deck was a five-octave 420 km fBm. From 23,572 km that is salt-and-pepper, the land is hidden, and the evidence frame had been shot with the sun pulled onto the camera so the terminator was gone.

## Done

- `orbitCloudBytes` is the shell's domain warp (hash2u) at 1,800 km and two octaves, plus a zonal amount: ITCZ, subtropical minimum, storm tracks. Poles follow the zonal curve only, so the cap does not spoke.
- Water is a saturated blue under per-pixel Lambert on the geometric normal, so the terminator is a soft arc instead of a cube-face seam. Clouds are pushed to opaque or clear. The limb feathers, and the Hillaire march is on at orbit.
- Lit disc versus Apollo 17: RGB gaps 10.5%, 10.5%, 7.9%. Saturated blue 0.338 vs 0.462 (12.4 points). Histogram bimodal. `straightThrough` is false. Cover 0.54. Frame is 12°N, 18°W, hour 8.
- Evidence: `tasks/evidence/T-0221/`. Reference Apollo 17 AS17-148-22727, https://images.nasa.gov/details/as17-148-22727.
- Tests: `tests/globe-clouds.test.ts`. The T-0220 block test still passes.

## Next

Open the PR. Do not merge it from this agent. #446 is already on main; this branch does not push there.

## Needs from another agent

None.
