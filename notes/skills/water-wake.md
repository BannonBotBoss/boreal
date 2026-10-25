# Skill: water-wake

Use this when a paw in water should raise a ring, or a body moving through water should raise a V wake (T-0024).

## Steps

1. Do not add a second water material. `src/render/water.ts` is the one program. The cache key is `boreal-water-wake`. `fadeOptIn` runs after that key is set and keeps it.
2. Stamp rings with sim time and pass that same time to `updateWaterUniforms(now)`. `shaderClock` only drives the existing flow drift. A ring stamped on one clock and shaded on the other sits at the wrong radius.
3. Drive rings from `touchdownsBetween` on the gait phase (the same stream footsteps use). Do not also subscribe to `onPlayerTouchdown`: that fires only under `?loco=1` and would double the rings.
4. Call `noteGait` after `expend`, once per fixed step, for the player. Call it for deer after their `expend`. Hares are not on `gaitFor`; call `noteTimed` with the hop offsets `[0.5, 0, 0.5, 0]` after `hopPhase` advances. People do not walk; `noteMover` with speed 0 still runs so a visitor in water is the same code path.
5. Begin the contact `wake:<id> | water` (`source: 'water-wake'`) when any sole is below the surface. End it one stride after the last sole leaves, not on the same step. `solidContact` only rewrites records that already exist, so this pair does not create a save row.
6. The wolf's waterline is the published head-and-body length, 1.325 m (Wikipedia "Wolf", 105–160 cm). The hip span (`LEG_XZ` × `WOLF_SCALE` = 0.54 m) puts a 2 m/s walk above Froude 0.5 by enough to miss 19.5 ± 2 deg. Deer, bear and hare use the rig's own fore-to-hind span or the published head-body already in the hare file.
7. Score pixels against `wakeHalfAngle(U / sqrt(g L))` at the speed the wolf is actually walking (the game walk is 2 m/s, not the task's 1.5 m/s example). A correct wake at that speed is about 17.6° and sits inside 19.5 ± 2°. It will not score 95% against a hardcoded 19.47.
8. The bright ridge painted on the water is `smoothstep` of the group-speed packet (and of the wake-angle gaussian), so the white pixels sit on the front, with the crests kept as a dimmer modulation. `fitDisturbance` weights radius samples by 1/r, because a filled ring has more pixels at larger radius. Calibrate on a point list and on `refs/T-0024/synthetic-match.png` (known match ≥ 0.95, known mismatch at 40° and twice the radius < 0.7) before trusting a game frame.
9. Take event times from `TZ=America/Vancouver date`. Do not type them.

## Files

- `src/core/waterWake.ts` — dispersion, rings, Kelvin wake, the GLSL twin, `createWake`.
- `src/render/water.ts` — one program, crest in the albedo, slope in the normal.
- `src/main.ts` — player step, snapshot, `window.wake` when `bench`, `top` or `wake` is in the query.
- `src/render/buildScene.ts` — deer, people, `?top=1` camera.
- `src/animals/hare.ts` — hop touchdowns.
- `src/render/animalRig.ts` — deer hips come from `DEER_HIP_XZ`.

## Dispersion

`c = sqrt(g/k + σ k/ρ)`, `cg = (g + 3 σ k²/ρ) / (2 ω)`, `ω = c k`. λ = 0.10 m. σ = 0.07275 N/m (IAPWS R1-76, 20 °C). ρ = 998.2071 kg/m³ (Tanaka et al. 2001). ν = 1.0034×10⁻⁶ m²/s (Kestin, Sokolov & Wakeham 1978). `g` is `gravity()`.

Kelvin half-angle `asin(1/3)` while `U/sqrt(g L) ≤ 0.5`. Above that, `α = α_K × (0.5/Fr)` (continuous at 0.5; the narrowing is Rabaud & Moisy 2013). The ring's visible fade is the packet `exp(−((r − cg t)/λ)²)` and `1/sqrt(r)`. Viscosity does not fade a 10 cm wave in a few seconds. The wake's time fade is `exp(−age × cg / L)`, one body-length of group travel.

## Metric

`fitDisturbance` then `wakeScore`. Known match: points on the predicted radius and the predicted angle. Known mismatch: 40° and twice the radius. The top camera is `TOP_CAM` (6 m up, 40° vertical fov). `projectTop` / `unprojectTop` use the same axes as the three.js camera (screen up = forward).
