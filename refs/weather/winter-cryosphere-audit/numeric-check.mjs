/**
 * Calibrated Rule 11 numeric evaluation for T-0230 (Winter cryosphere, lake ice freeze-up,
 * continuousTerrain snow/wet attributes, active snowfall vs snowpack state, and precipitation physics).
 *
 * Run with: npx tsx refs/weather/winter-cryosphere-audit/numeric-check.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildContinuousMesh } from '../../../src/render/continuousTerrain.ts';
import { waterMaterial } from '../../../src/render/water.ts';
import { heightAt } from '../../../src/core/world.ts';
import { initWeather, getGrid, setNearCellLive, catchUpWeather, weatherAt } from '../../../src/core/weather.ts';
import { strength } from '../../../src/core/deltas.ts';
import { GROUND } from '../../../src/core/ground.ts';
import { loadClock } from '../../../src/core/worldClock.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const obsPath = resolve(__dirname, 'observations.json');
const obsData = JSON.parse(readFileSync(obsPath, 'utf8'));
const [obs0, obs1, obs2] = obsData.observations;

/**
 * Calibrated bounded similarity metrics on [0, 1] (pass threshold >= 0.95, never rounded):
 * - unitScore(measured, target, fullScale): 1 - min(1, |measured - target| / fullScale)
 * - ratioScore(measured, target): min(measured, target) / max(measured, target) for strictly positive ratios
 */
function unitScore(measured, target, fullScale = 1.0) {
  return +(1 - Math.min(1, Math.abs(measured - target) / fullScale)).toFixed(4);
}
function ratioScore(measured, target) {
  if (measured <= 0 || target <= 0) return 0;
  return +(Math.min(measured, target) / Math.max(measured, target)).toFixed(4);
}

// Rule 11 Calibration: verify known match (>= 0.99) and known mismatch (< 0.50)
const calibration = {
  unitScoreKnownMatch: {
    description: 'Snow cover fraction 0.99 vs nature 1.00 (fullScale = 1.0)',
    measured: 0.99,
    target: 1.0,
    score: unitScore(0.99, 1.0, 1.0),
    passes95: unitScore(0.99, 1.0, 1.0) >= 0.95,
  },
  unitScoreKnownMismatch: {
    description: 'Bare summer ground aSnow = 0.00 vs midwinter 34 cm snowpack target 1.00',
    measured: 0.0,
    target: 1.0,
    score: unitScore(0.0, 1.0, 1.0),
    passes95: unitScore(0.0, 1.0, 1.0) >= 0.95,
  },
  ratioScoreKnownMatch: {
    description: 'Equilibrium horizontal wind drift 0.98x vs 1.00x wind speed',
    measured: 0.98,
    target: 1.0,
    score: ratioScore(0.98, 1.0),
    passes95: ratioScore(0.98, 1.0) >= 0.95,
  },
  ratioScoreKnownMismatch: {
    description: 'Rain horizontal wind drift 0.10x vs 1.00x wind speed',
    measured: 0.10,
    target: 1.0,
    score: ratioScore(0.10, 1.0),
    passes95: ratioScore(0.10, 1.0) >= 0.95,
  },
};

// Direct headless verification on live TS modules (cross-checking browser observations.json)
const meshDirect = buildContinuousMesh(-1230, -966, 2.0, heightAt);
let directMaxASnow = 0;
let directMaxAWet = 0;
for (let i = 0; i < meshDirect.snow.length; i++) {
  if (meshDirect.snow[i] > directMaxASnow) directMaxASnow = meshDirect.snow[i];
  if (meshDirect.wet[i] > directMaxAWet) directMaxAWet = meshDirect.wet[i];
}

const wMat = waterMaterial();
const waterHasFreezeUniform = Boolean(wMat.userData?.freezeUniform || /uIce|uFreeze|uSnow/i.test(wMat.customProgramCacheKey()));

// Headless reproduction of clear-winter track decay & bare-ground sub-zero snow flag
loadClock(JSON.stringify({ worldSec: 0, wallMs: Date.now(), rate: 1 }), Date.now(), 0); // Immediate band (1x)
initWeather(15, 12, -1230, -966);
setNearCellLive(true);
const g = getGrid();
g.precip.fill(0);
g.snowfall.fill(0);
g.swe.fill(85);
catchUpWeather(3600);
const wClear = weatherAt(-1230, -966);
const fpStrengthClearWinter = strength(
  { kind: 'footprint', x: -1230, z: -966, t: GROUND.years - 0.5 / 365.25, m: 1 },
  GROUND.years,
);
const fpTargetDryCold = Math.exp(-0.5 / 1.5);

// Bare-ground sub-zero snowfall in mixed weatherAt() (early Nov day 315, -5 C, sweMm = 0, Behavioral 10x band -> share = 0.5)
initWeather(315, 6, -1230, -966);
setNearCellLive(true);
const gNov = getGrid();
gNov.swe.fill(0);
gNov.precip.fill(2.8);
gNov.snowfall.fill(1);
loadClock(JSON.stringify({ worldSec: 0, wallMs: Date.now(), rate: 10 }), Date.now(), 0); // blend = 0.5 in [8..12]
const wBareSubzero = weatherAt(-1230, -966);
loadClock(JSON.stringify({ worldSec: 0, wallMs: Date.now(), rate: 1 }), Date.now(), 0);

// Precipitation kinematics from src/render/sky.ts lines 179, 190-193
const rainFallMps = 6.0;
const snowFallMps = 1.0;
const windRainMps = 8.0;
const gameRainHorizFactor = 0.1;
const gameSnowHorizFactor = 0.5;
const natureHorizFactor = 1.0; // tau = v_t / g = 0.10-0.61 s -> full wind coupling within <2 m fall
const gameRainSlantDeg = +(Math.atan2(windRainMps * gameRainHorizFactor, rainFallMps) * 180 / Math.PI).toFixed(2);
const natureRainSlantDeg = +(Math.atan2(windRainMps * natureHorizFactor, rainFallMps) * 180 / Math.PI).toFixed(2);

// At 60 FPS (realDt = 1/60 s) and 15x world clock rate, sky.ts line 179 computes:
// dt = Math.min(0.2, 15 * (1/60)) = 0.20 s per rendered frame -> 12.0 s of fall per real second!
const realFrameDt = 1 / 60;
const skyWorldDtAt15x = Math.min(0.2, 15 * realFrameDt);
const apparentSnowFallSpeedAt15xMps = +(snowFallMps * (skyWorldDtAt15x / realFrameDt)).toFixed(2);

// Boreal ground diffuse albedo in pbr.ts lines 64-83:
// When aSnow = 0, boreal floor mixes litter (0.14,0.08,0.04 -> luma 0.089) and moss (0.045,0.09,0.028 -> luma 0.076) -> ~0.083.
// When aSnow = 1, pbr.ts mixes diffuseColor to vec3(0.80) and suppresses litter cover by (1 - snow).
const gameMidwinterGroundAlbedo = 0.083;
const natureMidwinterSnowAlbedo = 0.80;

const checks = [
  {
    id: 'continuous_terrain_midwinter_snow_attribute',
    quantity: 'Midwinter continuousTerrain vertex snow cover aSnow (day 15, tC = -18 C, snowpack 34.4 cm)',
    gameMeasured: Math.max(directMaxASnow, obs0.continuousTerrainStats.maxASnow),
    natureTarget: 1.0,
    unit: 'fraction [0..1]',
    metric: 'unitScore(measured, 1.0, 1.0)',
    score: unitScore(Math.max(directMaxASnow, obs0.continuousTerrainStats.maxASnow), 1.0, 1.0),
    passes95: unitScore(Math.max(directMaxASnow, obs0.continuousTerrainStats.maxASnow), 1.0, 1.0) >= 0.95,
    source: 'Sturm et al. 2010 (J. Hydrometeorol. 11:1380, boreal taiga snow depth >20 cm -> ~100% ground cover); Oke 1987 (Boundary Layer Climates, 2nd ed., Table 1.1)',
  },
  {
    id: 'midwinter_ground_surface_albedo',
    quantity: 'Midwinter boreal forest floor broadband diffuse albedo under >30 cm snowpack',
    gameMeasured: gameMidwinterGroundAlbedo,
    natureTarget: natureMidwinterSnowAlbedo,
    unit: 'albedo [0..1]',
    metric: 'ratioScore(measured, 0.80)',
    score: ratioScore(gameMidwinterGroundAlbedo, natureMidwinterSnowAlbedo),
    passes95: ratioScore(gameMidwinterGroundAlbedo, natureMidwinterSnowAlbedo) >= 0.95,
    source: 'Oke 1987 (Boundary Layer Climates, 2nd ed., Table 1.1: dry snow albedo 0.75-0.90; boreal litter/moss 0.08-0.14); Betts & Ball 1997 (JGR 102:28901, BOREAS)',
  },
  {
    id: 'continuous_terrain_rain_wetness_attribute',
    quantity: 'Warm rainstorm continuousTerrain vertex wetness aWet (day 227, 4.5 mm/h rain, saturated soil)',
    gameMeasured: Math.max(directMaxAWet, obs2.continuousTerrainMaxAWetInDownpour),
    natureTarget: 1.0,
    unit: 'fraction [0..1]',
    metric: 'unitScore(measured, 1.0, 1.0)',
    score: unitScore(Math.max(directMaxAWet, obs2.continuousTerrainMaxAWetInDownpour), 1.0, 1.0),
    passes95: unitScore(Math.max(directMaxAWet, obs2.continuousTerrainMaxAWetInDownpour), 1.0, 1.0) >= 0.95,
    source: 'Lekner & Dorf 1988 (Appl. Opt. 27:1278, internal reflection darkening & specular sheen of water-wetted rough rock/soil)',
  },
  {
    id: 'january_boreal_lake_ice_cover_fraction',
    quantity: 'Mid-January (DOY 15, -18 C) 3.06 ha NW Ontario boreal lake ice + snow cover fraction (vs open rippled water)',
    gameMeasured: waterHasFreezeUniform ? 1.0 : 0.0,
    natureTarget: 1.0,
    unit: 'ice cover fraction [0..1]',
    metric: 'unitScore(measured, 1.0, 1.0)',
    score: unitScore(waterHasFreezeUniform ? 1.0 : 0.0, 1.0, 1.0),
    passes95: unitScore(waterHasFreezeUniform ? 1.0 : 0.0, 1.0, 1.0) >= 0.95,
    source: 'Schindler et al. 1990 (Science 250:967, ELA NW Ontario 49.67 N freeze-up mid-Nov DOY ~320, ice-out late Apr/May DOY ~120); Duguay et al. 2006 (Hydrol. Process. 20:781)',
  },
  {
    id: 'rain_wind_slant_angle_at_8mps',
    quantity: 'Raindrop trajectory slant angle from vertical in 8.0 m/s horizontal wind (v_t = 6.0 m/s, D ~ 1.8 mm)',
    gameMeasured: gameRainSlantDeg,
    natureTarget: natureRainSlantDeg,
    unit: 'deg',
    metric: 'unitScore(measured, 53.13, 90.0)',
    score: unitScore(gameRainSlantDeg, natureRainSlantDeg, 90.0),
    passes95: unitScore(gameRainSlantDeg, natureRainSlantDeg, 90.0) >= 0.95,
    source: 'Gunn & Kinzer 1949 (J. Meteorol. 6:243, terminal velocity v_t = 6.0 m/s -> relaxation time tau = v_t/g = 0.61 s -> 1.0x horizontal wind speed, atan2(8, 6) = 53.13 deg)',
  },
  {
    id: 'snow_wind_advection_coupling',
    quantity: 'Snowflake horizontal wind speed coupling ratio u_particle / u_wind (aggregate dendrites v_t = 1.0 m/s)',
    gameMeasured: gameSnowHorizFactor,
    natureTarget: natureHorizFactor,
    unit: 'dimensionless ratio',
    metric: 'ratioScore(0.50, 1.00)',
    score: ratioScore(gameSnowHorizFactor, natureHorizFactor),
    passes95: ratioScore(gameSnowHorizFactor, natureHorizFactor) >= 0.95,
    source: 'Locatelli & Hobbs 1974 (JGR 79:2185, v_t ~ 1.0 m/s -> Stokes/drag relaxation time tau = v_t/g = 0.102 s -> 1.00x wind drift)',
  },
  {
    id: 'precip_world_space_self_motion_parallax',
    quantity: `Precipitation cloud world-space parallax displacement when player runs ${obs1.distanceMovedM} m forward (precip.position.copy(camera.position) locks box to camera)`,
    gameMeasured: 0.0,
    natureTarget: obs1.distanceMovedM,
    unit: 'm',
    metric: `unitScore(0.0, ${obs1.distanceMovedM}, ${Math.max(1, obs1.distanceMovedM)})`,
    score: unitScore(0.0, obs1.distanceMovedM, Math.max(1, obs1.distanceMovedM)),
    passes95: unitScore(0.0, obs1.distanceMovedM, Math.max(1, obs1.distanceMovedM)) >= 0.95,
    source: 'Rigid Euclidean world-frame kinematics: falling hydrometeors are stationary in air frame, producing -v_player optic-flow parallax when running',
  },
  {
    id: 'snow_realtime_fall_speed_under_15x_clock_dial',
    quantity: 'Apparent real-time snowflake fall speed when time-scale dial is at 15x Behavioral band (60 FPS)',
    gameMeasured: apparentSnowFallSpeedAt15xMps,
    natureTarget: snowFallMps,
    unit: 'm/s (screen real time)',
    metric: 'ratioScore(12.0, 1.0)',
    score: ratioScore(apparentSnowFallSpeedAt15xMps, snowFallMps),
    passes95: ratioScore(apparentSnowFallSpeedAt15xMps, snowFallMps) >= 0.95,
    source: 'Locatelli & Hobbs 1974 (JGR 79:2185: unrimed/moderately rimed aggregates fall at 0.8-1.2 m/s, not 12 m/s rain/hail blur)',
  },
  {
    id: 'clear_winter_footprint_half_day_strength',
    quantity: 'Wolf footprint strength after 0.5 days on a clear midwinter day (0 mm/h precip, 85 mm SWE snowpack)',
    gameMeasured: +fpStrengthClearWinter.toFixed(4),
    natureTarget: +fpTargetDryCold.toFixed(4),
    unit: 'strength [0..1]',
    metric: 'ratioScore(measured, 0.7165)',
    score: ratioScore(fpStrengthClearWinter, fpTargetDryCold),
    passes95: ratioScore(fpStrengthClearWinter, fpTargetDryCold) >= 0.95,
    source: 'Rezendes 1999 (Tracking & the Art of Seeing, 2nd ed.: cold dry clear-sky snow preserves crisp tracks for days, tau >= 1.5 d; catchUpWeather falsely sets snowfall=1 when swe>0.5, accelerating decay 4x)',
  },
  {
    id: 'bare_ground_subzero_snowfall_flag',
    quantity: 'Active snowfall flag w.snow during sub-zero snowfall (day 315, -5 C, 2.8 mm/h) onto bare ground (sweMm = 0) in mixed weatherAt()',
    gameMeasured: wBareSubzero.snow ? 1.0 : 0.0,
    natureTarget: 1.0,
    unit: 'boolean [0 or 1]',
    metric: 'unitScore(measured, 1.0, 1.0)',
    score: unitScore(wBareSubzero.snow ? 1.0 : 0.0, 1.0, 1.0),
    passes95: unitScore(wBareSubzero.snow ? 1.0 : 0.0, 1.0, 1.0) >= 0.95,
    source: 'Dai 2008 (J. Climate 21:2803: rain-snow phase transition at surface T < +1.2 C depends on air/wet-bulb temperature, not pre-existing ground SWE)',
  },
];

const meanScore = +(checks.reduce((acc, c) => acc + c.score, 0) / checks.length).toFixed(4);
const passingCount = checks.filter((c) => c.passes95).length;

const report = {
  task: 'T-0230',
  generatedAt: new Date().toISOString(),
  passThreshold: 0.95,
  calibration,
  summary: {
    totalChecks: checks.length,
    passingChecks: passingCount,
    failingChecks: checks.length - passingCount,
    meanScore,
    overallPasses95: passingCount === checks.length,
  },
  browserObservationsSummary: {
    frame0Status: obs0.statusBar,
    frame0LakePixelLuma: obs0.pixelSamples.lakeSurfaceCenter.luma,
    frame0ShorePixelLuma: obs0.pixelSamples.shoreGroundForeground.luma,
    frame0MaxASnow: obs0.continuousTerrainStats.maxASnow,
    frame1DistanceMovedM: obs1.distanceMovedM,
    frame1BareGroundSubzeroSnowFlag: obs1.bareGroundSubzeroSnowMixed.snowFlag,
    frame2MaxAWet: obs2.continuousTerrainMaxAWetInDownpour,
  },
  checks,
};

const outPath = resolve(__dirname, 'numbers.json');
writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(report, null, 2));
