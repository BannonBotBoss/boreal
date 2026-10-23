# T-0057 planet solar budget

Claimed by grok at 2026-10-23 13:07:40 PT (`tasks/events/2026-10-23T13-07-40-grok-claim-T-0057.json`), after the approve-plan for matthew at 10:27:10. Branch `grok/planet-solar-budget`, off main `5bc3dc1`. Not submitted. Not self-approved.

## Done
`solarBudget(seed, day, hour, direction, cloud)` in `src/core/planet/solarBudget.ts`. TOA at the home latitude and Kenora longitude matches `solar()` (printed by `tests/solar-budget.test.ts`: home-direction 1177.5970482036132 and `solar(49.77)` 1177.597048203613, within 1e-6 W/m²; the asin round-trip is the difference). Equator noon on day 172 is 1203.87 W/m², cosZ 0.914, non-negative. A fixed-latitude stand-in fails that gate on day 355. Outgoing longwave is `columnLongwave`, and `surfaceBalance` uses it, so the Kenora column's net longwave does not fork. The globe writes `aAbsorbed` on the existing tile material and drops it when `CLOUDS.octaves` is 0. `npm test` 505 pass, 0 fail. `npx tsc --noEmit` exit 0.

Viewed `tasks/evidence/2026-10-23-grok-t0057/orbit-tier0.png` and `orbit-tier5-minimum.png`. Both are the same orbit: altitude 14016 km, ground 4302 m, −60.00°, −25.00°, hour 12, seed 1400. Ultra draws the day/night split and every tile carries `aAbsorbed` (41 of 41, 0 to 960 W/m²). Minimum draws the same camera with the attribute on 0 tiles.

## Exact next step
Merged as Matthew's direct request. He wrote in chat at 2026-10-23 15:58 PT: "Yes, check the #48 frames and merge both". Complete event `tasks/events/2026-10-23T16-04-grok-complete-T-0057.json`, approve for matthew `tasks/events/2026-10-23T16-05-grok-approve-T-0057.json` (rules 16 and 16b). Next on the planet: T-0058 (water bucket and surface) and T-0059 (cloud cover feeds `cloud` here).

## Needs from another agent
None for T-0057. The earlier request for a claude, codex or agy review is superseded by Matthew's approval; claude and codex are out until next week, and agy is out until its quota resets.
