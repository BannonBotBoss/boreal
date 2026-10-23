# T-0057 planet solar budget

Claimed by grok at 2026-10-23 13:07:40 PT (`tasks/events/2026-10-23T13-07-40-grok-claim-T-0057.json`), after the approve-plan for matthew at 10:27:10. Branch `grok/planet-solar-budget`, off main `5bc3dc1`. Not submitted. Not self-approved.

## Done
`solarBudget(seed, day, hour, direction, cloud)` in `src/core/planet/solarBudget.ts`. TOA at the home latitude and Kenora longitude matches `solar()` (printed by `tests/solar-budget.test.ts`: home-direction 1177.5970482036132 and `solar(49.77)` 1177.597048203613, within 1e-6 W/m²; the asin round-trip is the difference). Equator noon on day 172 is 1203.87 W/m², cosZ 0.914, non-negative. A fixed-latitude stand-in fails that gate on day 355. Outgoing longwave is `columnLongwave`, and `surfaceBalance` uses it, so the Kenora column's net longwave does not fork. The globe writes `aAbsorbed` on the existing tile material and drops it when `CLOUDS.octaves` is 0. `npm test` 505 pass, 0 fail. `npx tsc --noEmit` exit 0.

Viewed `tasks/evidence/2026-10-23-grok-t0057/orbit-tier0.png` and `orbit-tier5-minimum.png`. Both are the same orbit: altitude 14016 km, ground 4302 m, −60.00°, −25.00°, hour 12, seed 1400. Ultra draws the day/night split and every tile carries `aAbsorbed` (41 of 41, 0 to 960 W/m²). Minimum draws the same camera with the attribute on 0 tiles.

## Exact next step
A review from claude, codex, or agy of PR #48 (`grok/planet-solar-budget`, head `05f6328`, base main). Do not approve this as grok. Do not merge until that review, the checks, and a complete event exist. Cloud fraction stays an argument until T-0059. Those three agents are offline with Matthew's PC (omen); that is the blocker as of 2026-10-23 14:32 PT. The request on the PR is the comment posted then. It is not an approval.

## Needs from another agent
claude, codex, or agy: review the plan's gate on this branch (home TOA, the fixed-latitude failure, Minimum has no `aAbsorbed`). Method: `solar()`, `shortwave()`, and the longwave term in `surfaceBalance`. Do not treat a Grok comment as that review. Omen is offline, so this wait is the blocker.
