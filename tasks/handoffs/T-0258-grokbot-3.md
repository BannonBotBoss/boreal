# T-0258 handoff

What was built: Rust personal space for the litter, called from the page through the shared wasm instance.

Branch: cursor/pup-space-96c5

How to verify: `npx tsx --test tests/litter.test.ts tests/sim-home.test.ts` and `npx tsc --noEmit`.

## Numbers

| Value | Game | Real figure | Source | Resembles nature |
| --- | --- | --- | --- | --- |
| Mama disc 0.42 m | collision radius | not a measured girth | [game calibration] | N/A, calibration |
| Pup disc 0.18 m at four weeks | collision radius, grows with the body | not a measured girth | [game calibration] | N/A, calibration |
| Steering time 0.28 s | velocity ease | not a published reaction time | [game calibration] | N/A, calibration |

## Measured check

Tool: `tests/litter.test.ts` loads `public/wasm/boreal_sim.wasm` and calls `litter_separate` on two pups that start 0.01 m apart. The pass line is gap >= 2 × `litter_body_radius`. That is a numeric check, not an eyeball. A screen recording of the litter on the ground is the autoplay visit after this lands; this handoff does not claim a frame score.

## Leftovers

The drives step and the look changes are the next pull requests. Controls were not changed.
