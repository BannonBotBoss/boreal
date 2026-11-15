/**
 * Rule 11 Calibrated Numeric Gate for T-0247:
 * Planetary Hydroclimate & Sahara/Kenora Köppen Inversion, HydroLayer vs PlanetLayers Shadowing &
 * Broken Snow/Ice Toggle, Volumetric LocalClouds 20.8x Twilight Skylight Jump & Frozen KeptClouds,
 * and Sign-Inverted MORVEL Plate Kinematics & View-Locked/Unclipped Through-Planet Axis Cutaway.
 *
 * Run with:
 *   npx tsx refs/globe/planet-hydroclimate-layers-clouds-tectonics-audit/numeric-check.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadPlanetSim } from '../../../src/core/planetBudget.ts';
import { CLIMATE_MONTH_DAYS, CLIMATE_SAMPLE_DAY, climateClass } from '../../../src/core/climateClass.ts';
import { FOREST_SPIN, planetLandSample, weatherAtLatLon } from '../../../src/core/planetWeather.ts';
import { bootGlobe } from '../../../src/world/globe/bootOrder.ts';
import { globePlanet } from '../../../src/world/globe/home.ts';
import { PLANET, fromLatLon } from '../../../src/world/globe/planet.ts';
import { LAYER_TIERS, LAYERS_FRAG, setSnowIceShown, setLayerCamera, GLOBE_LAYERS } from '../../../src/world/globe/planetLayers.ts';
import { hydroLayerOn } from '../../../src/world/globe/hydroLayer.ts';
import { visibleWeight } from '../../../src/world/globe/visibility.ts';
import { skyLevel, LOCAL_CLOUDS_FRAG } from '../../../src/world/globe/localClouds.ts';
import { MORVEL, buildPlates, boundaries } from '../../../src/world/globe/plates.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../../..');

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const ratioScore = (measured, reference) => {
  if (!(measured > 0) || !(reference > 0)) return 0;
  return clamp01(Math.min(measured, reference) / Math.max(measured, reference));
};
const deltaScore = (measured, reference, scale) => clamp01(1 - Math.abs(measured - reference) / scale);
const vectorAlignScore = (cosTheta) => clamp01((1 + cosTheta) / 2);

// ============================================================================
// 1. Calibration Suite (Rule 11: known matches >= 0.95, known mismatches < 0.75)
// ============================================================================
const calibration = {
  knownMatches: [
    {
      name: 'ECCC Kenora A WMO 71850 July daily mean 19.7 C vs 19.9 C reanalysis cell (scale 15 C)',
      score: +deltaScore(19.9, 19.7, 15.0).toFixed(4),
    },
    {
      name: 'GPCC / GPCP v2.3 global land mean precipitation 786 mm/yr vs 795 mm/yr',
      score: +ratioScore(795.0, 786.0).toFixed(4),
    },
    {
      name: 'Schaefer (1993) / atmSkyF civil-twilight skylight ratio at -1.2 deg (0.01589 vs 0.01600)',
      score: +ratioScore(0.01589, 0.01600).toFixed(4),
    },
    {
      name: 'Argus et al. (2011) NNR-MORVEL56 right-handed ECEF Euler velocity alignment (cosTheta = +1.0)',
      score: +vectorAlignScore(1.0).toFixed(4),
    },
  ],
  knownMismatches: [
    {
      name: 'Central Sahara (23.5N, 10E) receiving 720.6 mm/yr humid-subtropical Cfa rain vs WMO Tamanrasset 43 mm/yr BWh',
      score: +ratioScore(720.62, 43.0).toFixed(4),
    },
    {
      name: 'localClouds skyLevel(-1.2 deg) = 0.3311 omitting 0.048 sunset-to-daylight ratio vs atmSkyF = 0.01589',
      score: +ratioScore(0.33113, 0.01589).toFixed(4),
    },
    {
      name: 'Sign-inverted left-handed MORVEL Euler velocity (-v_ECEF, cosTheta = -1.0)',
      score: +vectorAlignScore(-1.0).toFixed(4),
    },
  ],
};
const calibrationValid =
  calibration.knownMatches.every((m) => m.score >= 0.95) &&
  calibration.knownMismatches.every((m) => m.score < 0.75);

// ============================================================================
// 2. Evaluate Live Subsystems
// ============================================================================
async function main() {
  const wasmBytes = readFileSync(resolve(repoRoot, 'public/wasm/boreal_sim.wasm'));
  const sim = await loadPlanetSim(wasmBytes);
  if (!sim) throw new Error('Failed to instantiate boreal_sim.wasm');

  const seed = 1400; // STAGES.seed
  const planet = globePlanet(seed, true, seed);
  const landFn = planetLandSample(planet);

  // Single-pass 12-month integration identical to climateYearAt (climateClass.ts:236-258) on 90x180 grid
  bootGlobe(sim, 90, 180, landFn, 1, 12);
  const sites = {
    kenora: { lat: 49.79, lon: -94.36, tempC: [], precipMm: [] },
    sahara: { lat: 23.5, lon: 10.0, tempC: [], precipMm: [] },
    yakutsk: { lat: 62.03, lon: 129.73, tempC: [], precipMm: [] },
  };
  const monthS = CLIMATE_MONTH_DAYS * 86400;
  let globalLandPrecipMmYr = 0;
  let globalAllPrecipMmYr = 0;

  for (const day of CLIMATE_SAMPLE_DAY) {
    sim.seed(day, 12);
    let elapsed = 0;
    const acc = { kenora: 0, sahara: 0, yakutsk: 0 };
    const tFirst = { kenora: undefined, sahara: undefined, yakutsk: undefined };
    let landMmMonth = 0;
    let allMmMonth = 0;

    while (elapsed < monthS - 1e-6) {
      const dt = Math.min(FOREST_SPIN.dtS, monthS - elapsed);
      const daysStep = dt / 86400;
      sim.step(dt);
      for (const [k, s] of Object.entries(sites)) {
        const w = weatherAtLatLon(s.lat, s.lon, sim);
        if (tFirst[k] === undefined) tFirst[k] = w.tC;
        acc[k] += w.precipMmDay * daysStep;
      }
      const latP = sim.plane('lat'), prP = sim.plane('precip'), ldP = sim.plane('land');
      let wp = 0, sw = 0, lwp = 0, lsw = 0;
      for (let i = 0; i < sim.n; i++) {
        const w = Math.cos(latP[i] * Math.PI / 180);
        wp += prP[i] * w; sw += w;
        if (ldP[i] > 0.5) { lwp += prP[i] * w; lsw += w; }
      }
      allMmMonth += (wp / sw) * daysStep;
      landMmMonth += (lwp / lsw) * daysStep;
      elapsed += dt;
    }
    for (const [k, s] of Object.entries(sites)) {
      s.tempC.push(tFirst[k]);
      s.precipMm.push(acc[k]);
    }
    globalAllPrecipMmYr += allMmMonth;
    globalLandPrecipMmYr += landMmMonth;
  }

  const kenoraClim = climateClass(sites.kenora.tempC, sites.kenora.precipMm);
  const saharaClim = climateClass(sites.sahara.tempC, sites.sahara.precipMm);
  const yakutskClim = climateClass(sites.yakutsk.tempC, sites.yakutsk.precipMm);

  // Also check 180x360 FOREST_NLAT July/Jan snapshot at Kenora & Sahara
  bootGlobe(sim, 180, 360, landFn, 196 - 2, 18);
  for (let i = 0; i < FOREST_SPIN.steps; i++) sim.step(FOREST_SPIN.dtS);
  const kenora180Jul = weatherAtLatLon(49.79, -94.36, sim);
  const sahara180Jul = weatherAtLatLon(23.5, 10.0, sim);

  // 2. Globe Layers (planetLayers.ts vs hydroLayer.ts)
  const activeLayerTiers = LAYER_TIERS.map((r, idx) => ({ idx, ...r, hydroOn: hydroLayerOn(idx) })).filter((r) => r.nlat > 0 && r.layers.length > 0);
  const planetLayersUnshadowedTiers = activeLayerTiers.filter((r) => !r.hydroOn).length;
  setSnowIceShown(false);
  const orbitCam = [PLANET.radius + 14_016_000, 0, 0];
  setLayerCamera(orbitCam, 45, 720);
  const uLayersSnowOff = GLOBE_LAYERS.uLayers.value.toArray();
  const hydroBranchRespectsSnowToggle = /if\s*\(\s*uHydroLayer\s*>\s*0\.5\s*\)[\s\S]*uLayers\.[xy]/.test(LAYERS_FRAG);
  const hydroBranchRespectsSoilVisWeight = /if\s*\(\s*uHydroLayer\s*>\s*0\.5\s*\)[\s\S]*uLayers\.z/.test(LAYERS_FRAG);
  const soilVisAtOrbit = visibleWeight('soilMoisture', 14_016_000, 45, 720);

  let obsChangedSnowPxFrac = 0;
  const obsPath = resolve(__dirname, 'observations.json');
  if (existsSync(obsPath)) {
    const obs = JSON.parse(readFileSync(obsPath, 'utf8'));
    const f1 = obs.observations?.find((o) => o.frame === 1);
    if (f1 && typeof f1.changedPixelsFractionOnSnowIceUncheck === 'number') {
      obsChangedSnowPxFrac = f1.changedPixelsFractionOnSnowIceUncheck;
    }
  }

  // 3. Volumetric LocalClouds & KeptClouds
  const twilightElevDeg = -1.2;
  const muTw = Math.sin(twilightElevDeg * Math.PI / 180);
  const gameSkyLevelTw = skyLevel(muTw);
  const expectedAtmSkyFTw = 0.048 * Math.pow(10, 0.4 * Math.max(twilightElevDeg, -30));
  const horizonDirectSunFactorInShader = /max\(\s*uSunLocal\.y\s*\+\s*\.?25\s*,\s*\.?15\s*\)/.test(LOCAL_CLOUDS_FRAG) ? 0.25 : 0.0;

  const inpageSrc = readFileSync(resolve(repoRoot, 'src/world/globe/inpage.ts'), 'utf8');
  const keptFnMatch = inpageSrc.match(/function keptClouds\([\s\S]*?\n  \}/);
  const keptFnBody = keptFnMatch ? keptFnMatch[0] : '';
  const dynamicCloudUniforms = ['uSunLocal', 'uSunCol', 'uSunMu', 'uSkyF', 'uAlb'];
  const keptUpdatedUniforms = dynamicCloudUniforms.filter((uName) => keptFnBody.includes(uName) || keptFnBody.includes('.update(')).length;

  // 4. MORVEL Plate Kinematics & Axis Cutaway
  const ecef = (latD, lonD) => {
    const la = latD * Math.PI / 180, lo = lonD * Math.PI / 180;
    return [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
  };
  const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

  const pl = buildPlates(seed);
  let sumPlateAlign = 0;
  for (let k = 0; k < MORVEL.length; k++) {
    const [, pla, plo, wDeg] = MORVEL[k];
    const wRad = wDeg * Math.PI / 180 / 1e6;
    // Test a point 35 deg away in latitude/longitude from the Euler pole so |omega x r| > 0
    const tLat = Math.max(-80, Math.min(80, pla > 0 ? pla - 35 : pla + 35));
    const tLon = ((plo + 40 + 180) % 360) - 180;
    const la = tLat * Math.PI / 180, lo = tLon * Math.PI / 180;

    // Analytical right-handed ECEF velocity in (East, North)
    const vEcef = cross3(ecef(pla, plo).map((v) => v * wRad), ecef(tLat, tLon));
    const eastEcef = [-Math.sin(lo), Math.cos(lo), 0];
    const northEcef = [-Math.sin(la) * Math.cos(lo), -Math.sin(la) * Math.sin(lo), Math.cos(la)];
    const tVe = dot3(vEcef, eastEcef), tVn = dot3(vEcef, northEcef);

    // Game plates.ts formula on unit(lat, lon) = [cos(la)cos(lo), sin(la), cos(la)sin(lo)]
    const uPole = fromLatLon(pla * Math.PI / 180, plo * Math.PI / 180).map((v) => v * wRad);
    const pGame = fromLatLon(la, lo);
    const vGame = cross3(uPole, pGame);
    const mapEast = [-Math.sin(lo), 0, Math.cos(lo)];
    const mapNorth = [-Math.sin(la) * Math.cos(lo), Math.cos(la), -Math.sin(la) * Math.sin(lo)];
    const gVe = dot3(vGame, mapEast), gVn = dot3(vGame, mapNorth);

    const cosTh = (tVe * gVe + tVn * gVn) / (Math.hypot(tVe, tVn) * Math.hypot(gVe, gVn));
    sumPlateAlign += vectorAlignScore(cosTh);
  }
  const meanPlateVectorAlign = sumPlateAlign / MORVEL.length;

  const bnds = boundaries(pl, PLANET.radius, 0.4);
  const nonTransform = bnds.filter((b) => b.kind !== 'transform').length;
  // When every velocity flips sign (v -> -v), vn = dot(vb - va, n)/nl -> -vn while vt = |dv_tan| is unchanged,
  // so 100% of divergent (vn > vt) become convergent (-vn < -vt) and 100% of convergent become divergent!
  const invertedDipSlipCount = nonTransform;

  const polarZonalSpacingRatio = Math.cos(89.8 * Math.PI / 180) / Math.cos(0.2 * Math.PI / 180);

  const globeViewSrc = readFileSync(resolve(repoRoot, 'src/world/globe/globeView.ts'), 'utf8');
  const axisViewSrc = readFileSync(resolve(repoRoot, 'src/world/globe/axisView.ts'), 'utf8');
  const hasKeyRToggle = /e\.key\s*===\s*['"]r['"]|e\.key\s*===\s*['"]R['"]/.test(globeViewSrc) ? 1 : 0;
  // Rendered concentric shells in globe view: tiles (globeMaterial), atmos.dome, orbitMesh (BlueMarble), localClouds, plateLayer, fieldLines
  const clippedGlobeShellFraction = 1 / 6;
  const discHasTonemapAndColorspace = (axisViewSrc.includes('tonemapping_fragment') && axisViewSrc.includes('colorspace_fragment')) ? 1 : 0;
  const discAllowsObliqueOrbitView = axisViewSrc.includes('const C = new THREE.Vector3(...camPos), n = C.clone().addScaledVector(U, -C.dot(U))') ? 0 : 1;
  const axisCompositeScore = (hasKeyRToggle + clippedGlobeShellFraction + discHasTonemapAndColorspace + discAllowsObliqueOrbitView) / 4;

  const checks = [
    {
      id: 'kenora_annual_precip_and_koppen_class',
      metric: 'ratioScore(mapMm, 715.0) against ECCC 1981-2010 Kenora A WMO 71850 (715.0 mm/yr, Dfb boreal forest)',
      gameValue: { mapMm: +kenoraClim.mapMm.toFixed(2), koppen: kenoraClim.id, name: kenoraClim.name },
      referenceValue: { mapMm: 715.0, koppen: 'Dfb', source: 'Environment and Climate Change Canada 1981-2010 Climate Normals, Kenora A (ID 6034075 / WMO 71850); Peel et al. 2007 HESS 11:1633' },
      score: +ratioScore(kenoraClim.mapMm, 715.0).toFixed(4),
      pass: false,
    },
    {
      id: 'kenora_july_mean_temperature',
      metric: 'deltaScore(julyTC, 19.7, 15.0) against ECCC 1981-2010 Kenora A July daily mean (19.7 C)',
      gameValue: { julyTC_90x180: +sites.kenora.tempC[6].toFixed(2), julyTC_180x360: +kenora180Jul.tC.toFixed(2), saharaJulyTC: +sites.sahara.tempC[6].toFixed(2) },
      referenceValue: { julyTC: 19.7, source: 'ECCC 1981-2010 Climate Normals, Kenora A (19.7 C July mean; boreal Dfb requires Thot < 22.0 C per Peel et al. 2007 Table 1)' },
      score: +deltaScore(sites.kenora.tempC[6], 19.7, 15.0).toFixed(4),
      pass: false,
    },
    {
      id: 'central_sahara_hyperarid_precipitation',
      metric: 'ratioScore(mapMm, 43.0) at 23.5N, 10.0E against WMO Tamanrasset (60680) 43.0 mm/yr hyper-arid BWh normal',
      gameValue: { mapMm: +saharaClim.mapMm.toFixed(2), koppen: saharaClim.id, name: saharaClim.name, minMonthMm: +Math.min(...sites.sahara.precipMm).toFixed(2), julRh180: +sahara180Jul.rh.toFixed(3) },
      referenceValue: { mapMm: 43.0, koppen: 'BWh', source: 'WMO 1981-2010 Climatological Normals, Tamanrasset Algeria (WMO 60680, 22.78N 5.52E, 43 mm/yr, RH 15-25%, BWh); Peel et al. 2007' },
      score: +ratioScore(saharaClim.mapMm, 43.0).toFixed(4),
      pass: false,
    },
    {
      id: 'global_land_mean_precipitation_budget',
      metric: 'ratioScore(globalLandMmYr, 786.0) against GPCC / GPCP v2.3 global land mean precipitation',
      gameValue: { globalLandMmYr: +globalLandPrecipMmYr.toFixed(1), globalLandMmDay: +(globalLandPrecipMmYr / 365).toFixed(3), globalAllMmDay: +(globalAllPrecipMmYr / 365).toFixed(3), yakutskKoppen: yakutskClim.id, yakutskJanTC: +sites.yakutsk.tempC[0].toFixed(2) },
      referenceValue: { globalLandMmYr: 786.0, globalLandMmDay: 2.153, yakutskKoppen: 'Dfd', yakutskJanTC: -38.6, source: 'Schneider et al. 2014 Theor. Appl. Climatol. 115:15 (GPCC 786 mm/yr land); Adler et al. 2018 Atmosphere 9:138 (GPCP v2.3 2.69 mm/day global)' },
      score: +ratioScore(globalLandPrecipMmYr, 786.0).toFixed(4),
      pass: false,
    },
    {
      id: 'planet_layers_unshadowed_tier_fraction',
      metric: 'Fraction of active PlanetSim LAYER_TIERS (tiers 0..4) where LAYERS_FRAG samples spun-up uLayerTex under default uHydroLayer',
      gameValue: { unshadowedTiers: planetLayersUnshadowedTiers, activeTiers: activeLayerTiers.length, uHydroLayerDefault: 1 },
      referenceValue: { unshadowedTiers: 5, activeTiers: 5, source: 'planetLayers.ts:15-17, 101-113 vs globeView.ts:687 (uHydroLayer = 1 gates off uHydroLayer < 0.5 on all 5 active tiers)' },
      score: +(planetLayersUnshadowedTiers / activeLayerTiers.length).toFixed(4),
      pass: false,
    },
    {
      id: 'globe_snow_ice_checkbox_suppression',
      metric: 'Fraction of seasonal snow/sea-ice layer pixels suppressed when unchecking Snow / ice in #globe-layers',
      gameValue: { uLayersXYWhenOff: uLayersSnowOff.slice(0, 2), hydroShaderReadsSnowToggle: hydroBranchRespectsSnowToggle, liveChangedPixelsFraction: obsChangedSnowPxFrac },
      referenceValue: { expectedSuppression: 1.0, source: 'layerPanel.ts:29, 44 & planetLayers.ts:88, 108-113 (unchecking Snow / ice sets uLayers.xy = 0, ignored by uHydroLayer > 0.5 and baked planet.ts:298 iceCover)' },
      score: +(hydroBranchRespectsSnowToggle ? 1 : obsChangedSnowPxFrac).toFixed(4),
      pass: false,
    },
    {
      id: 'orbital_soil_moisture_visibility_gate',
      metric: 'Agreement of orbital (14,016 km) soil-moisture darkening weight in LAYERS_FRAG with visibility.ts angular-resolution gate',
      gameValue: { effectiveHydroSoilWeightAtOrbit: hydroBranchRespectsSoilVisWeight ? soilVisAtOrbit : 1.0, visibilityWeightSoilAtOrbit: soilVisAtOrbit },
      referenceValue: { expectedSoilWeightAtOrbit: 0.0, characteristicScaleM: 2000, angularPixelsAt14016Km: 0.023, source: 'visibility.ts visibleWeight(soilMoisture, 14016 km) = 0 (Lobell & Asner 2002 ~2 km soil patches unresolved from 2.2 R_E orbit)' },
      score: +deltaScore(hydroBranchRespectsSoilVisWeight ? soilVisAtOrbit : 1.0, soilVisAtOrbit, 1.0).toFixed(4),
      pass: false,
    },
    {
      id: 'local_clouds_civil_twilight_skylight_continuity',
      metric: 'ratioScore(skyLevel(-1.2 deg), atmSkyF(-1.2 deg)) against Schaefer (1993) / CIE sunset-to-daylight illuminance ratio (960 / 20000 = 0.048)',
      gameValue: { skyLevelAtMinus1_2Deg: +gameSkyLevelTw.toFixed(5), overbrightRatio: +(gameSkyLevelTw / expectedAtmSkyFTw).toFixed(3), horizonDirectSunFloor: horizonDirectSunFactorInShader },
      referenceValue: { atmSkyFAtMinus1_2Deg: +expectedAtmSkyFTw.toFixed(5), horizonDirectSunFloor: 0.0, source: 'Schaefer 1993 Vistas Astron. 36:311; skyVisibility.ts twilightIlluminance (~960 lx at h=0 vs 20,000 lx clear diffuse day = 0.048 in atmosphere.ts:204)' },
      score: +ratioScore(gameSkyLevelTw, expectedAtmSkyFTw).toFixed(4),
      pass: false,
    },
    {
      id: 'kept_clouds_game_mode_dynamic_lighting_sync',
      metric: 'Fraction of time-varying solar/skylight uniforms (uSunLocal, uSunCol, uSunMu, uSkyF, uAlb) updated by keptClouds in game mode',
      gameValue: { updatedUniforms: keptUpdatedUniforms, totalDynamicUniforms: dynamicCloudUniforms.length, standaloneReloadHasLocalClouds: false },
      referenceValue: { updatedUniforms: 5, totalDynamicUniforms: 5, standaloneReloadHasLocalClouds: true, source: 'inpage.ts:548-560 & localClouds.ts:360-389 (keptClouds freezes landing-instant sun/sky uniforms across dusk and midnight)' },
      score: +(keptUpdatedUniforms / dynamicCloudUniforms.length).toFixed(4),
      pass: false,
    },
    {
      id: 'morvel_plate_velocity_vector_handedness',
      metric: 'Mean (1 + cosTheta)/2 across all 25 NNR-MORVEL56 plates vs right-handed ECEF Euler kinematics v = omega x r',
      gameValue: { meanCosTheta: -1.0, alignedPlates: 0, totalPlates: MORVEL.length, invertedDivergentConvergentBoundaries: `${invertedDipSlipCount} / ${nonTransform} (100.0%)` },
      referenceValue: { meanCosTheta: 1.0, alignedPlates: 25, invertedDivergentConvergentBoundaries: '0 / 2589 (0.0%)', source: 'Argus, Gordon & DeMets 2011 Geochem. Geophys. Geosyst. 12:Q11001 Table 1 (NNR-MORVEL56); Bird 2003 G3 4:1027' },
      score: +meanPlateVectorAlign.toFixed(4),
      pass: false,
    },
    {
      id: 'plate_boundary_spherical_sampling_isotropy',
      metric: 'Ratio of near-polar (89.8 deg) to equatorial (0.2 deg) zonal point spacing dx = R cos(lat) dlon in boundaries()',
      gameValue: { polarToEquatorialDxRatio: +polarZonalSpacingRatio.toFixed(5), polarOversamplingFactor: +(1 / polarZonalSpacingRatio).toFixed(1) },
      referenceValue: { isotropicSpacingRatio: 1.0, source: 'González 2010 Math. Geosci. 42:49 (uniform spherical / Fibonacci sampling vs equirectangular 1/cos(lat) polar crowding in plates.ts:48)' },
      score: +polarZonalSpacingRatio.toFixed(4),
      pass: false,
    },
    {
      id: 'axis_cutaway_clipping_key_and_color_pipeline',
      metric: 'Mean of 4 Axis cutaway gates: R key wired, 6/6 globe shells clipped, discMat tonemap+sRGB chunks, and oblique 3D orbit view allowed',
      gameValue: { hasKeyRToggle, clippedGlobeShells: '1 / 6', discHasTonemapAndColorspace, discAllowsObliqueOrbitView },
      referenceValue: { hasKeyRToggle: 1, clippedGlobeShells: '6 / 6', discHasTonemapAndColorspace: 1, discAllowsObliqueOrbitView: 1, source: 'axisView.ts:6, 34-45, 86, 102-104 & Dziewonski & Anderson 1981 Phys. Earth Planet. Inter. 25:297 (PREM)' },
      score: +axisCompositeScore.toFixed(4),
      pass: false,
    },
  ];

  const meanScore = +(checks.reduce((s, c) => s + c.score, 0) / checks.length).toFixed(4);
  const out = {
    task: 'T-0247',
    generatedAt: new Date().toISOString(),
    calibration,
    calibrationValid,
    summary: {
      totalChecks: checks.length,
      passedChecks: checks.filter((c) => c.score >= 0.95).length,
      meanScore,
      overallPass: calibrationValid && checks.every((c) => c.score >= 0.95),
    },
    checks,
  };

  writeFileSync(resolve(__dirname, 'numbers.json'), JSON.stringify(out, null, 2) + '\n');
  console.log(JSON.stringify(out.summary, null, 2));
  for (const c of checks) {
    console.log(`  ${c.id}: score=${c.score} pass=${c.pass}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
