# T-0089 handoff (grok-globe): environment record + simulation-driven planet air

Branch `grok-globe/env-record-impl`. T-0082 (#129) is on main; this branch merged origin/main on 2026-10-28.
Matthew, direct chat 2026-10-28 7:10 PM PT: "push yourr work to the main" (rule 16 direct request).

## What was built
- `src/render/environment.ts`: `ENV` record (tC, rh, rainMmH, windE/N, latDeg, season, sunlight, rate, source) and `ENV_UNIFORMS`
  (uEnvTemp, uEnvHumidity, uEnvRain, uEnvSeason, uEnvSun, uEnvRate + the trees' WIND_UNIFORMS by reference). Filled from
  `weatherAt` (ground) or `weatherAtLatLon` (globe sub-point), `phenology`, `solar().toa` and the one clock's `clockRate()`.
- `src/world/globe/atmosphere.ts`: cloud drift integrates the record's east wind, u / (R cos lat), on simulation seconds, and holds
  across the clock's behavioral -> ecological SCALE_BOUNDS band (800..1200x). 12 m/s only while no grid is booted. Mie scattering and
  extinction x Hanel f(RH) = (1 - RH)^-0.3, RH capped at 0.95.
- `src/world/globe/globeView.ts`: fills the record where the sub-point weather was already sampled (every 60 frames), now also when
  local clouds are off. `?envrh=` / `?envu=` dev hooks.

## Merge with main (2026-10-28)
- One conflict, globeView.ts frame loop: kept main's `refreshHydroLayer(seed, dayAt(...))` and `atmos.update(..., R + ground)`,
  re-applied the record fill on top.
- #92 (one clock) is now on main, so the copied 800/1200 hold band now reads `SCALE_BOUNDS`, the game-seconds factor is
  `gameSecondsPerWorldSecond`, and the rate is `clockRate()` (observationRecord().rate is still 0/1 on main, so it could never hold).

## How to verify
`npm test`, `npx tsc --noEmit`, `npx tsx --test tests/environment.test.ts`. Frames: `?view=globe&shot&hour=10&day=200&latlon=49.77,-94.5&alt=3000000&tier=0&envrh=0.1` vs `envrh=0.95`.

## Numbers table
refs/T-0089/numbers.md (gamma 0.30, cap 0.95, f(RH) at 0/.5/.8/.9/.95/1 = 1.000/1.231/1.621/1.995/2.457/2.457; drift weight by rate).

## Evidence
- refs/T-0089/t0089-orbit-ultra-dry.jpg, t0089-orbit-ultra-humid.jpg (box SwiftShader, branch fbfb490 before the main merge;
  stills-log.txt has the record values). Drift clip and post-merge frames follow in a later commit if made.
- GPU smoke on omen: see the complete event / notes; open if not run.

## Leftovers / next owner
- One sub-point wind turns the whole shell; per-latitude zonal drift needs the layer texture's u plane.
- Fur and foliage owners can adopt ENV_UNIFORMS; nothing in their shaders changed.
- observationRecord().rate should register clockRate (T-0081 owner).
