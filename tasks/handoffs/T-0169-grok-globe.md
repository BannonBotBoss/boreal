# T-0169 handoff — grok-globe

Claimed. Implemented on `grok-globe/globe-closeup-realism` from main `e7173084`. Not submitted: the rule 6 frame gate is not a calibrated 95% score.

## Doing

Evidence is in. Tests are the check before the PR.

## Done

- Claim `tasks/events/2026-11-06T00-31-30-grok-globe-claim-T-0169.json` at `2026-11-06T00:31:30-08:00`, after grokbot-2 approve-plan `2026-11-06T01:21:23-07:00`.
- Clouds (`atmosphere.ts` `cloudDensity`): large warp amplitude 0.35 → 0.10 and zonal stretch 1.4 → 0.30 so the synoptic swirl bends without smearing. A second warp at 8× the base cell (`chopFrom` 4, Ultra through Low) chops the sample point. Billow plus a squared ridge on the fine octaves, and one inverted Worley mixed Perlin-Worley style, run only at 6+ octaves (Ultra, High). Very low and Minimum stay the base fBm.
- Cover: `src/world/globe/cloudCover.ts` is the CPU twin of the value (the warp is stationary, so the marginal skips it). `hash2u` on the CPU is `proc/rng.ts`, so there is not a second hash implementation. The twin reads about 0.11 on the base fBm at these centres and about 0.123 with the convective terms (Ultra and High). It does not reproduce the old GPU "0.16" by itself. `edgeCentre` is 0.619 / 0.621 there. `noiseSd` is 0.17. `tests/cloud-cover.test.ts` locks the delta under 0.04.
- Terminator: `atmWarmSun` (`TERMINATOR`, white while N·L > 0.78, architectural orange/red by 0.02) on cloud tops and on the ground's direct sun. Lambert in `RE_Direct_Physical` is `smoothstep(-0.08, 0.25, N·L)`.
- Ocean: `GLOBE_COLOURS.deep` is #030b1e linear, `deepSun` is #051330 where N·L is face-on. Shallows, lakes, shore unchanged. Fresnel is Matthew's line, verbatim, mixing toward `atmSkyF`. It does not replace F0 0.020 on lakes. Ocean glint keeps three's metalness mix; lakes are forced back to the dielectric F0.
- Glint: `OCEAN_GLINT` roughness 0.18, metalness 0.15, simplex chop on `detH` through the existing Mikkelsen bump. `uOceanGlint` follows `shadowMinOct` (off at Very low and Minimum). `presentW` keeps T-0166's early era beats on the old water. `localClouds.ts` is not edited. The shell still fades with `cloudClear * localCloudFade`.
- Cloud shadow: same field up the sun ray, octaves capped at 6. Direct diffuse loses 0.96 of the cover. Specular uses `smoothstep(0.08, 0.35, coverS)`, so a sharp glint is gone once the deck is actually there. Sky light is not multiplied. No `receiveShadow`.

## Number table

| Value | Game now | Real / source | Match |
| --- | --- | --- | --- |
| Deep ocean | #030b1e linear `[.00091, .00335, .01298]`, face-on #051330 | Matthew 2026-11-06. Payne 1972 albedo was not re-derived here | his call |
| Ocean roughness / metalness | 0.18 / 0.15 | Matthew 2026-11-06, labelled art choice | his call |
| Lake roughness | Cox-Munk at 7 m/s, `glintRoughness()` ~0.44 | Cox & Munk 1954, unchanged, `tests/glint.test.ts` | yes |
| Water F0, lakes | 0.020 | n = 1.33 | yes |
| Fresnel exponent | 5 | Matthew's GLSL, Schlick 1994 | yes |
| Mean cloud cover | twin: convective within 0.04 of the base fBm at the same centre (~0.10–0.12 on the twin). The published 0.16 is the existing GPU calibration this twin does not reproduce on its own | existing calibration, held relatively | relative yes; absolute 0.16 not re-measured on the GPU |
| Terminator band | white above N·L 0.78, full orange/red by 0.02 | `atmSunlight` Rayleigh plus `TERMINATOR.gain` [1.25, 0.36, 0.09], game calibration | to look at |

## Frames

SwiftShader, Playwright-core, `/usr/bin/google-chrome`, 1280×720. `tools/t0169-shot.mjs`. Ready never reached `queued === 0` within 100 s, so the close-ups still show coarse tile facets. The cloud field is analytic and does not wait on those tiles.

- `tasks/evidence/T-0169/full-globe-ultra.png` — `?view=globe&stages=1&trees=v2&shot=1&tier=0&hour=15`. Whole disc, limb halo kept, night side black, a wide orange/red band on the lit limb instead of white clouds cut hard to black. Ocean reads dark blue, not royal blue.
- `tasks/evidence/T-0169/closeup-ultra.png` — same with `&alt=420000&pitch=0`. Nadir. Clouds are cellular clumps and hooks, not the long liquid bands in `refs/T-0169/closeup-clouds.jpg`. Open water in the lower left carries a grey-white sheen. A sampled dark water pixel was about (6, 20, 41), next to #030b1e (3, 11, 30). Water under the deck stays dark.
- `tasks/evidence/T-0169/glint-noon.png` — `latlon=25,-40&hour=12&alt=1800000`. This longitude is not local noon, so the frame is the terminator itself: orange cellular clouds grading into black, no white day-side and no glint on the night side.
- `tasks/evidence/T-0169/full-globe-medium.png` — tier 2 (Medium, 5 octaves: small warp, no Worley).

Glint under clouds: the shader sets `csSpec = 1 - smoothstep(0.08, 0.35, coverS)`. Above cover 0.35 the specular term is 0. Direct diffuse is multiplied by `1 - 0.96 * coverS`. Sky light is left on. That is what the close-up's dark gaps under the deck are.

## Cost (SwiftShader, tiles still queuing)

Not a desktop GPU, and not a delta against main. Samples are `requestAnimationFrame` gaps, so a few milliseconds is an empty frame and the long ones are the render.

| Tier | Samples (ms) |
| --- | --- |
| Ultra, full disc | 759, 3840, 1081, 2616, 7728 |
| Ultra, close-up | 519, 3960, 7399, 1989, 4004 |
| Ultra, terminator close-up | 4496, 11, 4353, 4104, 4683 |
| Medium, full disc | 875, 6080, 22, 2847, 2938 |

Worley runs only at 6+ octaves, so Medium (5) does not pay it. On this software GL the two tiers land in the same few-second range. The relief samples stay capped at 5 octaves and skip Worley.

## Verified

- `tests/cloud-cover.test.ts`, `tests/descent-polish.test.ts`, `tests/glint.test.ts`, `tests/globe.test.ts`: pass.
- `npx tsc --noEmit`: pass.
- Full `npm test`: 1132 passed, 0 failed, 14 todo. `npx tsc --noEmit` passed in the same run.

## Leftovers

- The task stays claimed. No complete event. A calibrated 95% frame score was not made.
- SwiftShader did not drain the tile queue, so close-ups show facets. A desktop capture at the same URLs would show the same shader on a finer mesh.
- `?start=sphere` is the cinematic entry. These stills use `?view=globe`, which is the same globe material and the nadir camera the close-up ref describes.
- Skill: `notes/skills/globe-surface-optics.md`.

## Needs from another agent

A non-author can look at the three stills against `refs/T-0169/`. Nothing else is blocked.
