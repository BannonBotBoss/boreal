---
id: T-0169
title: Globe close-up realism - convective clouds, a soft warm terminator, a deep ocean with sun glint
author: grok-globe
scratch: false
research: true
skill: globe-surface-optics
tags: [globe, clouds, ocean, lighting, render]
credits: 65
---
# T-0169 Globe close-up realism

Matthew, 2026-11-06 about 1:08 AM PT (America/Vancouver), sent from omen through Grok Bot (grok, id a043d186). He called the
current globe "an excellent starting point" and asked for a next pass that removes the artificial close-up look by reworking
the fine noise structure and the way the atmosphere responds to light. The drop shadows under the clouds and the start of the
limb halo are already there and stay as they are. He then added a more detailed ocean brief (originally written partly in French) and
a direct instruction on the glint: "do the sun glint HIS way", with roughness and metalness, not a non-metallic-only GGX.

Matthew asked for this directly, so under RULES.md 16 it is pre-approved. A relay (grok / grokbot-1..3) records the approve-plan
with `"for": "matthew"`. grok-globe does not approve its own plan. **Status: proposed. Not claimed. No code yet.**

**Credits: 65** (= 10 x 5 objectives x (1 + 0.3 research), rule 14). `scratch` is false: every change extends an existing shader.

## Reference frames (acceptance refs)

Both are Matthew's screenshots of the running game, attached 2026-11-06 about 1:10 AM PT. They are copied to
`refs/T-0169/` (JPEG) and the PNG originals are on the box in `/workspace/globe-refs/`.

- `refs/T-0169/closeup-clouds.jpg` (box: `/workspace/globe-refs/closeup-clouds.png`). Looking straight down at
  `http://127.0.0.1:5173/?start=sphere&stages=1&trees=v2` (`SPHERE_START`, src/world/globe/startView.ts:9). What is visible:
  long, stretched, smooth "liquid" marble bands with streaked edges (raw value-noise fBm pulled along by the domain warp),
  a flat saturated blue ocean, no sun glint. The close-up recapture uses the same URL and view.
- `refs/T-0169/full-globe.jpg` (box: `/workspace/globe-refs/full-globe.png`). This is Matthew's "second image". What is visible: the
  limb halo and the cloud drop shadows (keep these). On the left limb, the clouds stay white or cream and the ocean stays bright blue right up to
  where the disc goes dark. There is no orange or red band and no soft penumbra. The ocean looks painted and flat, with no dazzling
  glint. The swirls still read as liquid filaments at planetary scale.

No other reference images are used. A generated reference (rule 6) comes later, from the frame gate's own prompt.

## What the code does now (read 2026-11-06 at main 65848898)

- **Clouds** are not a mesh. They come from an analytic shell in the atmosphere patch. `cloudDensity()`
  (src/world/globe/atmosphere.ts:189-220) takes 8 octaves of `cloudBase3` value noise at persistence .6. The noise sits under a two-level vector
  domain warp at 2600 km cells. That warp is twisted by latitude (`twistRad` 2.2) and stretched east-west (`zonalStretch` 1.4). The noise is then
  thresholded by `edgeCentre` and `edgeHalf` for each governor row (`CLOUDS`, atmosphere.ts:49-77). The single smooth warp at full amplitude
  (`warpAmp` .35) is what draws the long bands. Nothing in the field is cellular or billowed.
- **Cloud lighting** is `atmClouds()` (atmosphere.ts:228-252). It sets `lit = (0.35 + 0.65 lamC) * self * smoothstep(-0.12, 0.08, mu)`.
  The sun colour is forced to its own luminance (white) wherever `mu > 0.35` and turns red only inside `smoothstep(0.35, -0.05, mu)`.
  `atmSunlight()` already gives the Rayleigh transmittance, so the warm colour is already in the model. The band is narrow, and the
  ground and ocean get three's hard `max(dot(N, L), 0)` Lambert term.
- **Ocean** is drawn by the globe tile `MeshStandardMaterial` (`globeMaterial`, src/world/globe/tile.ts:203-283). It has metalness 0 and
  roughness `glintRoughness()` = Cox-Munk at 7 m/s = 0.444. The water specular F0 is 0.020 (tile.ts:121-129, tests/glint.test.ts).
  Deep water uses `GLOBE_COLOURS.deep` [.012, .045, .11] linear, about #1d3c5d in sRGB (src/world/globe/planet.ts:188), and shallow water
  [.022, .08, .135]. Both are mixed by depth (tile.ts:235). There is no normal chop on the water: the derivative bump at tile.ts:277-280 is the
  land detail height.
- **Cloud shadow on the ground and ocean** is analytic, not a shadow map. `patch()` (atmosphere.ts:347-350) gets `cs` from one
  base-octave lookup up the sun ray (`shadow` .75, `shadowCentre` .74, `shadowHalf` .08) and multiplies **both** `directDiffuse`
  and `directSpecular` by it. The clouds and the ocean are not separate meshes, so `oceanMesh.receiveShadow` does not apply. That one
  soft octave is weaker and blurrier than the visible deck, so a sharp glint would leak under clouds.

## Plan (incremental; every step is procedural, with no baked textures)

1. **Convective clouds, not liquid bands** (atmosphere.ts `cloudDensity`, `CLOUDS`):
   - Keep the cloud pipeline. Add a **billow** term (`abs(2n-1)`, iq fBm article) and an inverted **Worley/cellular F1** term
     (Worley 1996; Perlin-Worley as in Schneider & Vos 2015, Nubis). These go on the octaves below the synoptic scale. The
     cumuliform clumps come from them, and the base fBm still sets the cover.
   - Keep the ridged form from `planet.ts` (Musgrave 1989, already in the repo) for the frontal edges.
   - **Wind disturbance.** Add a second warp at small scale (about 1/8 of `cellKm`), driven by a higher-frequency noise. It
     perturbs the sampling point locally, so the edges break into wind-blown filaments (iq "warp" article, the f(p + h(p)) form at a
     second scale). The large warp's amplitude and its zonal stretch drop, so it bends the systems without smearing them into straight lines.
   - Add a cellular function to `src/proc/glsl.ts` once. It is shared (no second hash) and ported from iq's MIT voronoi with attribution.
   - Recalibrate `edgeCentre` and `noiseSd` on the CPU twin so the mean cover stays 0.16 and P(noise > c) still follows the sim fraction.
     That covers the sim lookup at atmosphere.ts:202-213 and the `cloudSimF` path.
   - The cloud shadow (`shadowCentre`) is retuned to the same field.
2. **A soft, warm terminator** (atmosphere.ts `atmClouds` + `patch`; tile.ts):
   - Widen the band where the sun is not forced to white. Tint the cloud sides with `atmSunlight`'s own Rayleigh transmittance plus a labelled warm
     gain [game calibration], keyed on `dot(normal, lightDirection)` as it approaches 0.
   - Apply the same tint to the ocean's and land's direct light.
   - Replace the hard Lambert cut on the globe tiles with a smoothstep penumbra on the diffuse N.L term (for example `smoothstep(-0.08, 0.25, NdotL)`),
     inside `globeMaterial`'s `lights_physical` hook. The planet shadow and the refracted ring (atmosphere.ts:125-130) stay as they are.
3. **Deep ocean: absorption and Fresnel** (planet.ts `GLOBE_COLOURS`, tile.ts):
   - Matthew: deep water from space is almost black or midnight blue, not saturated royal blue. That contrast with white clouds is what reads as
     "satellite". Deep base colour goes near **#030b1e to #051330** (linear about [.0009, .0033, .013] to [.0015, .0065, .030]).
     Contrast rises, and the colour gets darker where the sun is not face-on.
   - Near-coast sediment and sand stay lighter. That belongs to a later pass, and this pass changes deep water only.
     `shallow`, the lakes and the `SHORE` band are unchanged.
   - Fresnel uses Matthew's GLSL as given: `float fresnel = pow(1.0 - max(dot(normal, viewDirection), 0.0), 5.0);`
     and `vec3 oceanColor = mix(deepOceanColor, reflectionColor, fresnel);`. Here `reflectionColor` is the local sky / atmosphere light
     (`atmSkyF` / sky colour) plus the sun. The edge of the sphere then leaves dark blue and picks up a light blue or white sheen.
     This extends the existing BRDF (three's Schlick on F0 0.020) and does not replace it.
4. **Sun glint Matthew's way** (tile.ts `globeMaterial`):
   - Matthew calls this the most important missing piece in the full-globe image. The ocean should act as a giant mirror, with a dazzling patch
     where the sun, the surface and the camera align.
   - The material is already a `MeshStandardMaterial`. Over water only (via `landMask`, the same way roughness is mixed now), set
     **roughness 0.15-0.2 and metalness 0.1-0.2**, exactly as he specified. This is not a non-metallic-only GGX.
   - Add **very high-frequency simplex noise as a normal/bump** (stegu/ashima webgl-noise, MIT, added once to proc/glsl). It reuses
     the Mikkelsen derivative bump already at tile.ts:277-280, so the highlight stretches into a textured, vibrant patch
     (macro wave chop) and not a billiard-ball dot.
   - `glintRoughness` and the Cox-Munk functions stay for lakes and for tests/glint.test.ts. The ocean values are a separate,
     labelled `OCEAN_GLINT` set ("Matthew 2026-11-06 direction"). The chop fades with the pixel footprint (fwidth), the same way the cloud octaves
     fade, so it does not alias.
5. **Hide the glint and the diffuse light under clouds** (atmosphere.ts `patch`):
   - Clouds already cast drop shadows, so they must also block the sun on the water.
   - The cloud shadow on water becomes as strong as the visible deck. Use the full-octave `cloudDensity` at the sun-ray exit, or a sharper threshold from
     the same field, with a separate stronger factor on `directSpecular`. Glint **and** direct diffuse then vanish where a cloud shadow
     falls. Sky light stays.
   - This is the analytic equivalent of `receiveShadow`, because the clouds are not a separate sphere.
6. **Governor and Photoreal Ultra.** Every new term goes through the existing quality rows. The cloud octaves come from `CLOUDS.octaves` / `uCloudOct`:
   Worley and billow run only on the rows with 6 or more octaves, and the small warp runs from 4 up. The water chop and glint are off at Low and
   Minimum (the same gate as `shadowMinOct`). There are no new render targets and no new meshes. The cost is measured on the box SwiftShader and
   reported as ms per frame at Ultra and at Medium.

## Objectives

- [ ] Clouds: billow + Worley convective clumps and the small-scale wind-disturbance warp in `cloudDensity`. The long smooth bands in
  `closeup-clouds` are gone at the same URL and view. Mean cover stays 0.16 and the sim-fraction mapping still holds (tests updated).
- [ ] Terminator: a warm Rayleigh tint on the cloud sides and the ocean as N.L approaches 0, plus a smoothstep penumbra on the diffuse term. The left limb in
  `full-globe` grades from white through orange/red into night instead of cutting off.
- [ ] Deep ocean: base colour #030b1e to #051330, with higher contrast, darker away from the face-on sun, and Matthew's Fresnel term at the limb. Shallows,
  lakes and the shore are unchanged.
- [ ] Sun glint: water roughness 0.15-0.2 and metalness 0.1-0.2 on the existing MeshStandardMaterial, with a high-frequency simplex normal chop.
  The glint and the direct diffuse light are hidden under the cloud shadow at full strength.
- [ ] Governor-aware (Ultra to Minimum). `npm test` and `npx tsc --noEmit` pass. Frames are recaptured at `?start=sphere&stages=1&trees=v2`
  (close-up and full disc, in the same views as both refs). The rule 6 and rule 11 gates are measured and noted in the handoff.

## Number table (to fill at completion; seeded now)

| Value | Game now | Proposed | Real figure / source | Match |
| --- | --- | --- | --- | --- |
| Deep ocean colour (sRGB) | #1d3c5d | #030b1e-#051330 | Matthew 2026-11-06; deep-ocean albedo ~0.06 at high sun, Payne 1972 JAS 29:959 [verify] | to measure |
| Ocean roughness | 0.444 (Cox-Munk 7 m/s) | 0.15-0.2 | Matthew 2026-11-06 direction (art choice, labelled) | Matthew's call |
| Ocean metalness | 0 | 0.1-0.2 | Matthew 2026-11-06 direction | Matthew's call |
| Water F0 | 0.020 | 0.020 (unchanged) | n = 1.33 | yes |
| Fresnel exponent | three Schlick | 5 (Schlick 1994) | Matthew's GLSL | yes |
| Mean cloud cover (noise) | 0.16 | 0.16 | existing calibration | keep |
| Terminator warm band | mu 0.35 to -0.05 | to calibrate | twilight colour from atmSunlight Rayleigh transmittance | to measure |

## Prior art (searched first; reuse before new code)

- iq, fBm and billow/ridged variants: https://iquilezles.org/articles/fbm/
- iq, domain warping f(p + h(p)): https://iquilezles.org/articles/warp/
- iq, Voronoi / smooth Voronoi (MIT shadertoy code): https://iquilezles.org/articles/smoothvoronoi/
- Worley 1996, "A Cellular Texture Basis Function", SIGGRAPH.
- Schneider & Vos 2015, "The Real-time Volumetric Cloudscapes of Horizon Zero Dawn" (Perlin-Worley):
  https://www.guerrilla-games.com/read/the-real-time-volumetric-cloudscapes-of-horizon-zero-dawn
- stegu / ashima webgl-noise (simplex, MIT): https://github.com/stegu/webgl-noise
- Schlick 1994 (Fresnel approximation); Walter et al. 2007 GGX (three's physical BRDF already uses it).
- Already in the repo: atmosphere.ts (wwwtyro/glsl-atmosphere Rayleigh/Mie, the refracted ring, cloud shadows); planet.ts ridged multifractal;
  tile.ts GLINT / Cox-Munk / Mikkelsen bump; proc/glsl.ts `vnoiseU` / `fbm`; localClouds.ts (T-0073, near field).

## Overlaps and coordination

- T-0068 (Earth from orbit realism): every objective is done. This task builds on its twilight and night-side work and does not reopen it.
- T-0073 local cloud column (2 objectives open), PR #329 (merged) and PR #330 (open, grokbot-1, `localClouds.ts` only). The near-field
  box is not touched. If the far shell's look changes, the T-0073 handover band is rechecked so the two still match at the 60 m handover.
- T-0056 (low-altitude cloud sheet): `setClear` / `cloudClear` and `clearLift` stay as they are.
- T-0070 (particles): this task does not depend on it. The sphere path is still the default.
- T-0166: the cinematic `uEra` / `GLOBE_LAYERS` gating in tile.ts stays as it is. The B14 arrival still has to read as the approved front-lit globe.

## Out of scope

Coast sediment and sand (a later pass, per Matthew). Volumetric ray-marched far clouds. New meshes or render targets. Baked textures.
Anything on the river or animal files.

## Implementation branch (later, after the approve-plan)

`grok-globe/globe-closeup-realism` from main. Handoff `tasks/handoffs/T-0169-grok-globe.md` opens at the claim (rule 9).
