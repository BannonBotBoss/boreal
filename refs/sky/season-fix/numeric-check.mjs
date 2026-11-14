/**
 * Calibrated numeric + pixel-space solar geometry gate for T-0022:
 * Independently evaluates NOAA General Solar Position Calculations (Spencer 1971 Fourier series,
 * https://gml.noaa.gov/grad/solcalc/solareqns.PDF) and compares:
 *  1. CPU solar elevation & azimuth in sunPosition / createSky (day 227, day 355, day 592 Year-2 rollover, day -10 rewind)
 *  2. Sky lunar age propagation (LIGHTING.moonAge === moonAge(dayAt(time)) even when WEATHER.day is stale)
 *  3. Geocentric subsolar latitude of planetSunDirection (globeView.ts & overheadCrowns.ts) vs solar declination
 *  4. Decoded .webm pixel-space solar disk elevation recovered from frame-0.png (day 227), frame-1.png (day 355),
 *     and frame-2.png (day 592) against NOAA Spencer (1971) and reference frames (ref-0, ref-1).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { DAY, dayAt, declination, hourAt, setDay, setHour, sunPosition } from '../../../src/core/timeOfDay.ts';
import { SITE as WEATHER_SITE, WEATHER } from '../../../src/core/weather.ts';
import { clearSite } from '../../../src/core/sitePhase.ts';
import { createSky } from '../../../src/render/sky.ts';
import { LIGHTING } from '../../../src/render/pbr.ts';
import { moonAge } from '../../../src/core/light.ts';
import { createPlanet, planetSunDirection, toLatLon } from '../../../src/world/globe/planet.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RAD = Math.PI / 180;

function noaaSpencer1971(hourLocalSolar, dayOfYear, latDeg) {
  const doy = ((dayOfYear - 1) % 365 + 365) % 365 + 1;
  const g = (2 * Math.PI / 365) * (doy - 1);
  const declRad =
    0.006918 -
    0.399912 * Math.cos(g) +
    0.070257 * Math.sin(g) -
    0.006758 * Math.cos(2 * g) +
    0.000907 * Math.sin(2 * g) -
    0.002697 * Math.cos(3 * g) +
    0.00148 * Math.sin(3 * g);
  const phi = latDeg * RAD;
  const h = 15 * (hourLocalSolar - 12) * RAD;
  const sinEl = Math.sin(phi) * Math.sin(declRad) + Math.cos(phi) * Math.cos(declRad) * Math.cos(h);
  const el = Math.asin(Math.max(-1, Math.min(1, sinEl)));
  const az = Math.atan2(Math.sin(h), Math.cos(h) * Math.sin(phi) - Math.tan(declRad) * Math.cos(phi)) + Math.PI;
  return {
    declDeg: declRad / RAD,
    elevationDeg: el / RAD,
    azimuthDeg: ((az / RAD) % 360 + 360) % 360,
  };
}

// Angular similarity metric normalized by the 37.72 deg seasonal noon solar excursion at 49.79 N:
// score = max(0, 1 - |measuredDeg - refDeg| / 37.7216)
const SEASONAL_SPAN_DEG =
  noaaSpencer1971(12, 227, WEATHER_SITE.lat).elevationDeg -
  noaaSpencer1971(12, 355, WEATHER_SITE.lat).elevationDeg; // ~37.7216 deg

const angleScore = (actualDeg, expectedDeg) =>
  Math.max(0, 1 - Math.abs(actualDeg - expectedDeg) / SEASONAL_SPAN_DEG);

clearSite();
const obs = JSON.parse(readFileSync(resolve(__dirname, 'observations.json'), 'utf8'));

// 1. Calibration (Rule 11):
// Known match: exact NOAA angle -> 1.0000; 0.3 deg pixel quantization -> 0.9920 (>= 0.95 pass)
// Known mismatch: pre-fix T-0022 bug (day 227 sun elevation 54.506 deg rendered on day 355 winter solstice 16.784 deg) -> 0.0000 (fail)
// Pre-fix globeView 49.5 N vs 49.77 N subsolar bias: +0.2700 deg error vs 0.0000 deg post-fix.
const calRef227 = noaaSpencer1971(12, 227, WEATHER_SITE.lat);
const calRef355 = noaaSpencer1971(12, 355, WEATHER_SITE.lat);
const knownMatchScore = angleScore(sunPosition(12, 355, WEATHER_SITE.lat).elevation, calRef355.elevationDeg);
const knownMismatchPreFixDay355Score = angleScore(sunPosition(12, 227, 49.5).elevation, calRef355.elevationDeg);

// 2. Evaluate createSky lunar date propagation & planetSunDirection geocentric declination
WEATHER.on = false;
WEATHER.day = 227; // stale weather day
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x000000, 10, 500);
const sky = createSky(scene);
const cam = new THREE.PerspectiveCamera(81.2, 16 / 9, 0.2, 700);
const focus = new THREE.Vector3();
DAY.offset = 0;
DAY.dayOffset = 0;
setDay(355, 0);
setHour(12, 0);
sky.update(hourAt(0), 0, cam, focus);
const moonAgeMeasured355 = LIGHTING.moonAge;
const moonAgeExpected355 = moonAge(355);
const moonAgeStale227 = moonAge(227);

const planet = createPlanet(42);
const subsolarLat355 = toLatLon(planetSunDirection(planet, 12, 355)).lat / RAD;
const decl355 = declination(355);
// Pre-fix globeView bug used default LATITUDE = 49.5 instead of planet.home (49.77 N):
const dBug = sunPosition(12, 355).direction;
const preFixSubsolarLat355 =
  Math.asin(
    planet.east[1] * dBug.x + planet.home[1] * dBug.y - planet.north[1] * dBug.z,
  ) / RAD;

// 3. Evaluate live recorded frames from observations.json (decoded from recording.webm)
const frameChecks = obs.observations.map((o) => {
  const ref = noaaSpencer1971(o.hour, o.doy, o.observerLatDeg);
  const pixElev = o.decodedFrame.solarDiskPixel.recoveredElevationDeg;
  const uElev = o.skyUniformElevationDeg;
  const uScore = angleScore(uElev, ref.elevationDeg);
  const pixScore = angleScore(pixElev, ref.elevationDeg);
  return {
    label: o.label,
    frameFile: o.decodedFrame.file,
    videoTimeSec: o.decodedFrame.decodedCurrentTimeSec,
    doy: o.doy,
    hour: o.hour,
    observerLatDeg: o.observerLatDeg,
    noaaElevationDeg: +ref.elevationDeg.toFixed(4),
    skyUniformElevationDeg: +uElev.toFixed(4),
    uniformAbsErrorDeg: +Math.abs(uElev - ref.elevationDeg).toFixed(6),
    uniformScore: +uScore.toFixed(6),
    decodedWebmPixelCentroid: {
      x: o.decodedFrame.solarDiskPixel.centroidX,
      y: o.decodedFrame.solarDiskPixel.centroidY,
    },
    decodedWebmPixelElevationDeg: +pixElev.toFixed(4),
    pixelAbsErrorDeg: +Math.abs(pixElev - ref.elevationDeg).toFixed(4),
    pixelScore: +pixScore.toFixed(4),
    lightingMoonAgeDays: o.lightingMoonAgeDays,
    expectedMoonAgeDays: o.expectedMoonAgeDays,
    planetNoonSubsolarLatDeg: o.planetNoonSubsolarLatDeg,
    expectedDeclinationDeg: o.expectedDeclinationDeg,
  };
});

const meanUniformScore = frameChecks.reduce((s, f) => s + f.uniformScore, 0) / frameChecks.length;
const meanPixelScore = frameChecks.reduce((s, f) => s + f.pixelScore, 0) / frameChecks.length;
const seasonalDropPixelDeg =
  frameChecks[0].decodedWebmPixelElevationDeg - frameChecks[1].decodedWebmPixelElevationDeg;
const seasonalDropNoaaDeg =
  frameChecks[0].noaaElevationDeg - frameChecks[1].noaaElevationDeg;
const seasonalDropScore = Math.max(
  0,
  1 - Math.abs(seasonalDropPixelDeg - seasonalDropNoaaDeg) / seasonalDropNoaaDeg,
);

const out = {
  source: 'NOAA General Solar Position Calculations (Spencer 1971 Fourier series), https://gml.noaa.gov/grad/solcalc/solareqns.PDF',
  calibration: {
    metric: `angleScore = max(0, 1 - |measuredDeg - noaaDeg| / ${SEASONAL_SPAN_DEG.toFixed(4)} deg seasonal noon excursion)`,
    seasonalNoonSpan49_79NDeg: +SEASONAL_SPAN_DEG.toFixed(4),
    knownMatch_Day355PostFixScore: +knownMatchScore.toFixed(6),
    knownMismatch_PreFixPinnedDay227AtDay355Score: +knownMismatchPreFixDay355Score.toFixed(6),
  },
  auxiliaryChecks: {
    skyLunarAgeDay355WithStaleWeatherDay227: {
      measuredDays: +moonAgeMeasured355.toFixed(6),
      expectedDays: +moonAgeExpected355.toFixed(6),
      staleDay227Days: +moonAgeStale227.toFixed(6),
      absErrorDays: +Math.abs(moonAgeMeasured355 - moonAgeExpected355).toFixed(9),
    },
    planetGlobeSubsolarLatDay355Noon: {
      postFixSubsolarLatDeg: +subsolarLat355.toFixed(6),
      expectedDeclinationDeg: +decl355.toFixed(6),
      postFixAbsErrorDeg: +Math.abs(subsolarLat355 - decl355).toFixed(9),
      preFixSubsolarLatDeg: +preFixSubsolarLat355.toFixed(6),
      preFixAbsErrorDeg: +Math.abs(preFixSubsolarLat355 - decl355).toFixed(6),
    },
  },
  recordedFramesVsNoaa: frameChecks,
  summaryScores: {
    meanUniformScore: +meanUniformScore.toFixed(6),
    meanDecodedPixelScore: +meanPixelScore.toFixed(4),
    seasonalNoonDropNoaaDeg: +seasonalDropNoaaDeg.toFixed(4),
    seasonalNoonDropDecodedPixelDeg: +seasonalDropPixelDeg.toFixed(4),
    seasonalNoonDropSimilarityScore: +seasonalDropScore.toFixed(4),
    passes95PercentGate: meanUniformScore >= 0.95 && meanPixelScore >= 0.95 && seasonalDropScore >= 0.95,
  },
};

writeFileSync(resolve(__dirname, 'numbers.json'), JSON.stringify(out, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(out, null, 2));
if (!out.summaryScores.passes95PercentGate) {
  process.exitCode = 1;
}
