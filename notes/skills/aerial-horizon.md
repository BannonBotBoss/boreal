# Skill: aerial perspective on the horizon

Use when the land meets the sky as a flat blue band, or the daytime sky is a white sheet.

## Search before writing

1. The ground is one mesh (`continuousTerrain.ts`). Do not add a strip or a second ridge.
2. three.js `Sky.js` in this tree is Preetham plus its own cloud layer (`cloudCoverage` default 0.4). The game also draws `createSky`'s cirrus dome. Two cloud layers washed the zenith.
3. Rayleigh 3 in `sky.ts` pushed this morning hour (day 227, 08:40, 49.8°N) to a near-white zenith. Preetham's own coefficient is 1.
4. Transmittance is the exponential-atmosphere integral (Hillaire 2020; Bruneton 2008): optical depth `H * dist / dy * (exp(-y0/H) - exp(-y1/H))`. Rayleigh coefficients are Hillaire Table 1. Mie uses Koschmieder 1924, V = 3.912 / β.
5. A 33 km visibility left a 3-pixel land line, because the last kilometres are foreshortened. β = 2.2e-4 is about 18 km, light summer haze, and the horizon transmittance drops below 0.08.

## Steps

1. Set Sky.js `cloudCoverage` and `cloudDensity` to 0. Keep the cirrus dome. Set turbidity 2.2 and rayleigh 1.15.
2. `addAerialPerspective` on the continuous-terrain material, before tone mapping. The material's `fog` is false so the 200–480 m linear fog is not a second grey wall.
3. Each frame, `sky.update` writes the same sun direction into `AERIAL` and a horizon tint that warms when the sun is low.
4. The fade colour has to be close to the sky at the land line. A darker blue fog draws a new band.

## Checks

- `tests/aerial-perspective.test.ts`: the horizontal integral matches `dist * exp(-h/H)`, visibility is 12–25 km, a 30 m ray stays above 0.95, the horizon ray is below 0.08 in the red.
- `tests/horizon-picture.test.ts`. Zenith window y 0.08–0.16, x 0.42–0.58, blue cast = mean(B − R). Cutout window y 0.36–0.50, x 0.22–0.72.
  - Known mismatch, the plate frame: cutout blue 0.307, white 0.687.
  - Known mismatch, continuous ground without this fade: zenith cast 13.9.
  - Pass: cast above 30, cutout blue under 0.05, white under 0.35. The after eye-40 frame scores 38.6, 0, 0.16.

## Mistakes to avoid

- Do not paint a horizon quad. The mesh already reaches the horizon; the fade is in the shader.
- Do not leave Sky.js's built-in clouds on. They are not the cirrus dome.
- A faint land line can remain. Say so. A 3-pixel step is not a dissolved horizon.
