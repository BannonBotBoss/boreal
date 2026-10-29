---
id: T-0089
title: One environment record that the atmosphere, fur and foliage shaders read, and planet air and clouds driven by it
author: grok-globe
scratch: false
research: true
skill: environment-record
tags: [render, globe, atmosphere, weather]
credits: 39
---

# T-0089 Environment record and simulation-driven planet air

Issues #111 (one environment buffer that every shader reads) and #110 (atmosphere, haze and fog from simulation values, not
painted). Matthew, direct chat 2026-10-26 2:45 AM PT: the last 20 issues (#99 to #119) take precedence. grokbot-2 (backend
owner, running T-0082) agreed this piece goes to grok-globe and asked that it read the weather T-0082 exposes, not the Rust
grid directly, so there is one reader. A direct request for precedence is not an approval of this plan: it needs another
agent's approve-plan (rules 2 and 10). Not claimed.

**Credits: 39** (= 10 x 3 objectives x (1 + 0.3 research)). Matthew can change it.

## Plain-English summary

The weather already decides the forest sky: clouds, haze and fog come from the air cell over you.
From space, the clouds' amount already comes from the planet model, but they all drift east at a fixed 12 m/s, and the haze never changes.
This task makes one small record of the air where you are looking: temperature, humidity, rain, wind, season, sunlight and how fast time runs.
The planet's clouds then drift with the real wind, and the haze thickens when the air is humid.
Fur and plant shaders can read the same record later. This task does not change them.

## What already exists (reused, not rebuilt)

- **Per-place weather:** `weatherAt(x, z)` and `windAt` (`src/core/weather.ts` lines 316-339) already return temperature,
  humidity, cloud, rain, snow, soil, snow water, fog and wind for rendering, sound, ground and the inspector. T-0082 moves
  the authority under them to the Rust grid. This record reads them; it adds no climate.
- **Shared shader uniforms:** `WIND_UNIFORMS` (`src/render/trees.ts` line 48) is already one set of `{ value }` objects shared by
  trees, grass and flora; the trees set it each frame from `windAt` and `phenology` (lines 213-214). The record owns no second
  wind: it re-exports those same objects and adds the missing fields beside them (three's `UniformsLib` pattern).
- **Forest sky:** `src/render/sky.ts` lines 127-149 already turn the cell's cloud, humidity, fog and rain into cover, drift
  (from the real wind), Preetham turbidity and Koschmieder visibility (Kunkel 1984). Left alone: T-0078 phase 6 removes that
  sky once the planet shell reaches the ground, so the same humidity relation has to live in the planet shell. That is objective 3.
- **Planet clouds:** `src/world/globe/atmosphere.ts` cover already follows the sim's cloud fraction (`uCloudSim`, lines 147-149,
  baked by `planetLayers.ts` `bakeLayers`). Only the drift (`CLOUDS.windMs: 12`, line 57, used at line 230) and the Mie haze
  (`ATMOS.mie`, a constant) ignore the weather.
- **Planet point reads today:** `globeView.ts` line 542 samples the grid under the camera with `columnAt` (localClouds.ts line 25)
  for the local cloud box. After T-0082 the record takes the globe-side value from T-0082's planet query; if T-0082 exposes
  no lat/lon query, this task asks grokbot-2 for one rather than adding a third grid reader.
- **Where and how fast:** `observationRecord()` (`src/core/observation.ts`, T-0081) gives position, altitude and the time rate.
- **Season and sun:** `phenology(day)` (`src/core/treeSpecies.ts` line 95) and `solar(day, hour)` (`src/core/weather.ts` line 82).

## Overlap check

- `notes/design-roadmap.md` covers #100-#109; no step or task covers #110 or #111. Step 26 (environmental cues on perception)
  and step 33 (height x time picture) are different work.
- T-0078 (grokbot-3, one picture from space to the forest floor) moves where the air is drawn (phase 6 "One air", one sky
  shell to the ground) and which layers show. This task changes only what the shell is fed (two uniforms) and adds no sky,
  no cloud layer and no second picture. It does not touch `inpage.ts`, the camera flight, `sky.ts` or the clock files that
  T-0078 lists as left alone.
- T-0082 (grokbot-2) owns the weather values. This task is downstream of it and writes no weather.
- T-0073 local clouds (grokbot-1) stay as they are; their column input may later come from the same record.

## Plan

Files:
- `src/render/environment.ts` (new, small): `ENV` record `{ tC, rh, rainMmH, windE, windN, season, sunlight, rate }` and
  `ENV_UNIFORMS` (`uEnvTemp`, `uEnvHumidity`, `uEnvRain`, `uEnvSeason`, `uEnvSun`, `uEnvRate`, plus the existing
  `WIND_UNIFORMS.uWindDir` / `uWindAmp` objects by reference). `updateEnvironment(source)` fills it once per frame from
  `weatherAt` at the observation point (ground) or T-0082's planet query at the camera's sub-point (globe).
- `src/world/globe/atmosphere.ts`: cloud drift angle integrates the record's eastward wind over the sub-point latitude
  (angular rate u / (R cos lat)) instead of `CLOUDS.windMs`; Mie density scaled by the hygroscopic growth factor
  f(RH) = (1 - RH)^-gamma (Hanel 1976), gamma and its cap cited, not guessed. The fixed 12 m/s stays only as the fallback
  while no record is filled (wasm not loaded), and both never drive the same frame.
- `src/world/globe/globeView.ts`: one call that feeds the record where `columnAt` is already sampled (line 542), no other change.
- `tests/environment.test.ts`, `notes/skills/environment-record.md`, `tasks/handoffs/T-0089-grok-globe.md`.

Not in scope: fur and foliage shader edits (their owners adopt `ENV_UNIFORMS` later), volumetric ground fog, new cloud
layers, WebGPU or path tracing, Bruneton/takram precomputed scattering (see risks).

## Objectives
- [ ] One environment record and shared uniforms filled from `weatherAt` / T-0082's planet query and the observation record, re-using `WIND_UNIFORMS` by reference; a test locks every field to its live source and shows no second wind or climate is computed
- [ ] Planet cloud drift reads the record's wind (east component over the sub-point latitude) instead of the fixed 12 m/s, with the fixed value kept only as the no-wasm fallback; a test checks the drift rate against u / (R cos lat)
- [ ] Planet haze follows humidity through the Mie term with a cited growth law (Hanel 1976), numbers table against published f(RH) values, and frames of a dry and a humid view at the same hour (rule 6) at Ultra and Minimum within the governor budget

## Test plan

- Unit: `tests/environment.test.ts`: record fields equal `weatherAt` / the T-0082 query / `observationRecord()` at a fixed
  seed and time; `ENV_UNIFORMS.uWindDir === WIND_UNIFORMS.uWindDir` (same object); drift angle after 1 game hour equals
  u x 3600 / (R cos lat) within 1e-9; f(RH) at 0.3, 0.8 and 0.95 matches the cited table.
- `npm test`, `npx tsc --noEmit`, `tools/smoke-tiers.mjs` (Ultra and Minimum fps against the last T-0041 figures, 126 / 241).
- Frames (rule 6): orbit and 2 km stills at the same hour on a dry and a humid sub-point, plus a 10 s clip of cloud drift
  at 1x and at a raised time rate, under `refs/T-0089/`. Headless capture on the box is not a GPU frame-rate measure; the
  fps check runs on omen.

## Prior art

- three.js `UniformsLib` / `UniformsUtils` (shared `{ value }` objects merged into many materials):
  https://github.com/mrdoob/three.js/blob/dev/src/renderers/shaders/UniformsLib.js,
  https://github.com/mrdoob/three.js/blob/dev/src/renderers/shaders/UniformsUtils.js
- wwwtyro/glsl-atmosphere (Unlicense), already the base of `atmosphere.ts`: https://github.com/wwwtyro/glsl-atmosphere
- Bruneton, precomputed atmospheric scattering (BSD-3), the reference for the Mie/Rayleigh model and a later LUT path:
  https://github.com/ebruneton/precomputed_atmospheric_scattering
- takram three-geospatial atmosphere (MIT), Bruneton for three.js; considered again, not added (needs pmndrs postprocessing,
  see atmosphere.ts lines 9-11): https://github.com/takram-design-engineering/three-geospatial/tree/main/packages/atmosphere
- three `Sky` (Preetham), the forest sky's turbidity input: https://github.com/mrdoob/three.js/blob/dev/examples/jsm/objects/Sky.js
- Hanel 1976, aerosol growth with relative humidity, Advances in Geophysics 19:73-188: https://doi.org/10.1016/S0065-2687(08)60142-9

## Depends on

- T-0082 (grokbot-2, `grokbot-2/t0082-planet-weather`, in progress): the weather values and the planet query. Claim waits
  until its PR is up so the record reads its exposed API, not the grid.
- T-0081 (done on main): the observation record.

## Risks

- **T-0082's API is not known yet.** If it exposes only the point at the player, the globe needs a lat/lon query from it;
  this task asks grokbot-2 rather than reading the grid, which would make a third reader.
- **One wind for the whole shell.** The cloud field is one noise turned about the polar axis, so drift from the sub-point wind
  moves every cloud on the planet at that rate; a jet stream elsewhere will look wrong from orbit. A per-latitude zonal drift
  needs the texture's u plane and is a later step, not hidden in this one.
- **Wind reversal makes clouds slide backwards.** Integrating a changing wind is fine; snapping the angle to a new rate is
  not. The drift angle is integrated, never recomputed from time x rate.
- **Haze tuning.** A Mie scale that grows near saturation can white out the view at RH near 1; the growth factor is capped at
  the cited table's top value and the frames gate checks it.
- **Collision with T-0078 phase 6.** If phase 6 lands first and rewrites the shell, the two uniforms move with it; the record
  module does not change.
- **Bruneton / takram LUTs are not adopted here.** They would replace the ray-march and add dependencies; that is a separate
  decision for T-0078 phase 6, not this task.

## Approve-plan

Needs a non-author approve-plan: grokbot-1, grokbot-2, grokbot-3, codex or grok (Matthew may also approve).
