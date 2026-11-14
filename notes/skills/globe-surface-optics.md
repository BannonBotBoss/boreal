# Skill: globe surface optics (clouds, terminator, ocean)

Use when the far globe's clouds, the day/night edge, or the ocean colour and sun glint need to change.
The clouds are not a mesh. They are `cloudDensity` / `atmClouds` inside the atmosphere patch
(`src/world/globe/atmosphere.ts`). The ocean is the tile `MeshStandardMaterial` (`globeMaterial` in
`src/world/globe/tile.ts`). First built for T-0169.

## Steps
1. Read the live functions before adding anything: `cloudDensity`, `atmClouds`, `patch` (the analytic
   `coverS` shadow), `GLOBE_COLOURS`, and the `lights_physical_pars_fragment` chunk for the current three version.
   `receiveShadow` does nothing here. The cloud shadow is the `cloudDensity` lookup up the sun ray in `patch`.
2. Keep one noise. Cellular F1 goes in `src/proc/glsl.ts` as `GLSL_WORLEY` on `hash2u`. Simplex goes in as
   `GLSL_SIMPLEX` (Ashima / stegu, MIT) and the tile renames it (`gd_snoise`) so it does not collide with the
   atmosphere patch, which is injected into the same program. The CPU twin of `hash2u` lives in `proc/rng.ts`
   (`hash2u`). Do not copy `Math.imul` into another file: `tests/rules.test.ts` rejects a second CPU hash.
3. Convective shape, not a new shell. Large warp amplitude and zonal stretch stay small enough that systems bend
   without smearing into liquid bands. A second warp at about 1/8 of `cellKm` (iq `f(p + h(p))`) chops the sample
   point. Billow (`abs(2n-1)`) and one inverted Worley run only when the octave count is at least 6 (Ultra, High).
   The small warp runs from 4 octaves up. Very low and Minimum stay the plain fBm.
4. Recalibrate with `src/world/globe/cloudCover.ts`, the CPU twin of the value (the warp is stationary, so the
   marginal skips it). The twin does not reproduce the old "0.16" GPU figure by itself: it reads about 0.12 on the
   base fBm at the published centres. Hold the convective rows to that same twin cover. `billowBias` puts the ridge's
   mean back; the Perlin-Worley mix then needs a small `edgeCentre` nudge on the Ultra and High rows. `noiseSd` is
   the twin's standard deviation, because the sim-fraction logit uses it. Re-run `tests/descent-polish.test.ts` if
   `edgeCentre[0]` moves: that test indexes the T-0041 sweep with the live centre.
5. Terminator. `atmWarmSun` keeps daylight white only while N·L is high (`TERMINATOR.whiteAt`) and hands the
   Rayleigh `atmSunlight` colour, then the architectural orange/red gain, to the limb. Call it for cloud tops and
   for the ground's direct sun. Replace `saturate(dot(geometryNormal, directLight.direction))` in
   `RE_Direct_Physical` with `smoothstep(-0.08, 0.25, …)`. In three r185 that line is inside
   `ShaderChunk.lights_physical_pars_fragment`, which is still an `#include` at `onBeforeCompile` time: inline the
   chunk with the line replaced. Do not look for the expanded source.
6. Ocean. Deep albedo is `#030b1e` linear, lifted toward `#051330` only where N·L is face-on. Shallows, lakes and
   `SHORE` stay. Fresnel is Matthew's line, verbatim, after the normal is known:
   `float fresnel = pow(1.0 - max(dot(normal, viewDirection), 0.0), 5.0);`
   It mixes the ocean albedo toward `atmSkyF`. It does not replace the Schlick F0 of 0.020.
7. Sun glint is `OCEAN_GLINT` (roughness 0.18, metalness 0.15) on water only (`landMask`, `vLake == 0`). Lakes keep
   `glintRoughness()` / Cox-Munk. The simplex chop is a height added to `detH` and the existing Mikkelsen derivative
   bump. Gate it with `uOceanGlint`, set from the tier in `setSteps`, same threshold as `shadowMinOct`, and with
   `presentW` so T-0166's early era beats stay as authored. `dFdx` stays in uniform control flow (`uOceanGlint` /
   `uDetail.x`), never a per-pixel branch.
8. Glint and direct diffuse die under clouds inside `patch`: diffuse uses `shadow` (0.96) times the deck density;
   specular uses `smoothstep(0.08, 0.35, coverS)` so a sharp highlight is gone once the deck is actually there.
   Sky light is not multiplied. The shadow lookup uses `min(uCloudOct, 6)` so it sees the same clumps as the deck.
9. Do not edit `localClouds.ts`. The far shell still fades with `cloudClear(alt) * localCloudFade(alt)`.

## Checks that proved it
- `tests/cloud-cover.test.ts`: each tier's convective cover stays within 0.04 of that tier's base fBm; Worley mean
  and `noiseSd` match the twin; the patched standard shader contains the fresnel line, the penumbra smoothstep,
  `gd_snoise`, `worleyF1`, and `csSpec`.
- `tests/glint.test.ts` still locks Cox-Munk. `tests/descent-polish.test.ts` still sees the clearLift strings.
- `npx tsc --noEmit`.
- Frames: Playwright-core + `/usr/bin/google-chrome`, SwiftShader
  (`--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`).
  `?view=globe&stages=1&trees=v2&shot=1&workers=0&tier=0` is the full disc (default altitude).
  Add `&alt=900000&pitch=0` for the nadir close-up. Ready is `__globe.stats().drawn > 0 && queued === 0`.
  `tools/t0169-shot.mjs` writes `tasks/evidence/T-0169/`.

## Orbit disc (T-0220, T-0221)

Minimum (SwiftShader) draws no cloud shell: `CLOUDS.octaves` is 0, and a level-1 tile at the film
arrival (3.7 Earth radii, 23,572 km) is one vertex every ~310 km unless `applyOrbitSegments` lifts
the mesh to 64. Ice on that coarse grid was the white rectangles. A later equirectangular poster
(sharp DEM cells, emissive Lambert) drew coasts as meridians and deleted the night side. The zoom-0
field is not the cause: `coarseMetresLinear` on a lat/lon grid is a normal world map
(`tests/globe-clouds.test.ts`, `tasks/evidence/T-0221/land-mask-dem.png`).

Land and ocean stay on the pre-#446 mesh: vertex colours, `MeshStandardMaterial`, the directional
sun, the penumbra smoothstep, and the Hillaire march (forced on above `ORBIT_FADE.fullM`). Do not
replace that with another emissive disc. `bakeOrbitAlbedo` is the test bake only.

Clouds, when the shell's octave count is 0, are NASA Visible Earth Blue Marble clouds,
`public/globe/cloud_combined_2048.jpg`, 2048×1024
(https://visibleearth.nasa.gov/images/57747/blue-marble-clouds). They composite as albedo inside
`ORBIT_FRAG`, so the same sun shades them. `presentW` keeps the film's early beats. A procedural
`orbitCloudBytes` still exists for the old cover test; it is not bound to the material.
Arrival hour is 8. `setFilmDrive` sun bias pulls the sun onto the camera and hides the night side;
the evidence shot leaves it at 0. Home on the staged seed is about 50°N, 66°E, zenith about 60°,
so the west limb is night. A camera near 12°N, 18°W is about 23° from the subsolar point and stays lit.

## Mistakes to avoid
- A second cloud sphere, or `oceanMesh.receiveShadow`. The shadow is analytic. Orbit clouds are the
  NASA map above, and only when the shell is off. Do not also bake a shell for tiers that already ray-march.
- Another emissive orbit shader. It passed colour stats on a poster and hid the night side.
- Worley inside every octave. One F1 per `cloudDensity` call. The relief samples are capped at 5 octaves, so they
  skip Worley (the gate is 6) and stay cheaper than the coverage sample.
- Changing `edgeCentre[0]` without re-running `tests/descent-polish.test.ts`. That test indexes the T-0041 sweep
  with the live centre.
- Applying ocean roughness during the magma / flood beats. `presentW` is 0 until `uEra.w` eases in, and 1 when no
  era is set (ordinary play).
- Calling `dFdx` on the water chop inside a per-pixel `if`.
