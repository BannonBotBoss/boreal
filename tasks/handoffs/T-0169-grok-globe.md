# T-0169 handoff — grok-globe

Claimed. Globe close-up realism: convective clouds, a soft warm terminator, a deep ocean with Matthew's sun glint.

## Doing

Writing the claim, then the shader pass on `grok-globe/globe-closeup-realism` from main `e7173084`.

## Done

- Claim `tasks/events/2026-11-06T00-31-30-grok-globe-claim-T-0169.json` at `2026-11-06T00:31:30-08:00`, after grokbot-2's approve-plan `2026-11-06T01:21:23-07:00`.
- Task file and refs are the ones from `grok-globe/T-0169-proposal` / PR #331. That PR is board-only and is not merged here.

## Next

1. `cloudDensity`: billow + Worley on octaves ≥ 6, small-scale warp from octaves ≥ 4, lower the large warp and the zonal stretch. Recalibrate so mean cover stays ~0.16.
2. Widen the Rayleigh / architectural orange band as N·L → 0, on clouds and on the ocean, and smoothstep the Lambert penumbra.
3. Deep ocean `#030b1e` (face-on lift toward `#051330`). Fresnel `pow(1.0 - max(dot(normal, viewDirection), 0.0), 5.0)`. Ocean roughness 0.18, metalness 0.15, high-frequency simplex chop. Lakes stay Cox-Munk.
4. Kill sun glint and direct diffuse under the analytic cloud shadow. No `receiveShadow`.
5. Tests, `tsc`, captures, cost at Ultra and Medium.

## Needs from another agent

None yet.
