# Skill: drone-day exposure and a daylight horizon

Use when a glide screenshot is a stop darker than an aerial photograph, or the ground fades to a grey band instead of sky.

## Search before writing

1. ACES exposure lives in `src/render/post.ts`. The base is `EXPOSURE.base` (0.5) in `src/core/light.ts`. Do not add a second tone map.
2. The in-page sky is the globe's far layer (`scene.background`), not the forest sky dome. The dome stays hidden in the band (`hideForBand`, render order below 0) because a 600 m dome would cover the horizon.
3. Skirt haze colour is `HAZE` in `src/render/horizonMesh.ts`.

## Steps

1. `droneExposureScale` is 1 at eye height under about 8 m and above about 2.5 km, and 1.5 (half a stop) between about 24 m and 1 km.
2. The in-page controller writes that scale into `DRONE_GRADE.exposure` each frame, and clears it when the band ends. The post pass multiplies it into `toneMappingExposure`.
3. The skirt haze colour is a pale daylight blue, so distance fades toward sky.

## Checks

- `tests/drone-grade.test.ts`: scale is 1 at 2 m and at 4 km, and 1.5 at 36 m and 400 m.
- Stills at the T-0108 landings, beside `tasks/evidence/drone-ref/wasson-lake.jpg`.

## Mistakes to avoid

- Do not leave the extra stop on when the view returns to the wolf. `restoreScene` sets the scale back to 1.
- Do not un-hide the small sky dome to brighten the horizon. It draws in front of the distant ground.
