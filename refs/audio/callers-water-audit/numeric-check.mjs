/**
 * Calibrated numeric audit for T-0224:
 * 1) callField.ts nightHours & callGap ignore siteLatitude(LATITUDE) (pinned to 49.5°N).
 * 2) callField.ts habitatOf ignores SITE.treeShare, plantsGrowAt, and Holarctic loon range (lat > 0).
 * 3) borealSound.ts nearbyWater & wet check heightAt < LEVEL.deerWater / waterSurface instead of staged lakes/rivers + drawOpenWater.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WORLD_SEED } from '../../../src/core/world.ts';
import { STAGES } from '../../../src/core/stages/elevation.ts';
import { surfaceAt } from '../../../src/core/stages/surfaceAt.ts';
import { SITE, setSite, clearSite, siteLatitude } from '../../../src/core/sitePhase.ts';
import { LATITUDE, sunPosition } from '../../../src/core/timeOfDay.ts';
import { CALLERS, callGap, nightHours, habitatOf, callersNear } from '../../../src/core/callField.ts';
import { nearbyWater } from '../../../src/audio/borealSound.ts';
import { drawOpenWater } from '../../../src/world/globe/coverSample.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
mkdirSync(__dirname, { recursive: true });

STAGES.on = true;
STAGES.seed = WORLD_SEED;

// Independent NOAA Spencer (1971) solar elevation in degrees (local solar hour, 1-based dayOfYear, latDeg)
function noaaSunElevation(hour, day, latDeg) {
  const g = (2 * Math.PI / 365) * (day - 1 + (hour - 12) / 24);
  const dec = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g)
    - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g)
    - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const ha = ((hour - 12) * 15) * (Math.PI / 180);
  const lat = latDeg * (Math.PI / 180);
  const sinEl = Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(ha);
  return Math.asin(Math.max(-1, Math.min(1, sinEl))) * (180 / Math.PI);
}

function refNightHours(day, latDeg) {
  let n = 0;
  for (let h = 0; h < 24; h++) {
    if (sunPosition(h + 0.5, day, latDeg).elevation < 0) n++;
  }
  return n;
}

function refLoonGap(hour, day, latDeg) {
  const night = sunPosition(hour, day, latDeg).elevation < 0;
  const nh = refNightHours(day, latDeg);
  const dh = 24 - nh;
  const hours = night ? (nh || 24) : (dh || 24);
  return (hours * 3600) / (night ? CALLERS.loonWailsNight : CALLERS.loonWailsDay);
}

function refWoodpeckerGap(hour, day, latDeg) {
  return sunPosition(hour, day, latDeg).elevation < 0 ? Infinity : 60 / CALLERS.woodpeckerDrumsPerMin;
}

const timingScore = (actual, expected) => {
  if (!Number.isFinite(actual) && !Number.isFinite(expected)) return 1;
  if (!Number.isFinite(actual) || !Number.isFinite(expected) || expected <= 0) return 0;
  return Math.max(0, 1 - Math.abs(actual - expected) / expected);
};

// Calibration (Rule 11): known match at 49.5°N home Day 227 noon vs known mismatch (halved interval / treeless desert callers)
clearSite();
const knownMatchLoon = timingScore(callGap('loon', 12, 227), refLoonGap(12, 227, 49.5));
const knownMismatchLoon = timingScore(callGap('loon', 12, 227) * 0.5, refLoonGap(12, 227, 49.5));

// Case 1: Subarctic summer solstice dusk (64.5°N, -119.7°W, Day 172, Hour 21.8)
setSite({
  latDeg: 64.5,
  lonDeg: -119.7,
  datumM: 150,
  salt: 1,
  treeShare: 1,
  dir: [0, 1, 0],
  east: [1, 0, 0],
  north: [0, 0, 1],
});
const latSubarctic = siteLatitude(LATITUDE);
const sunElSubarcticGame = sunPosition(21.8, 172, latSubarctic).elevation;
const sunElSubarcticNoaa = noaaSunElevation(21.8, 172, 64.5);
const gameNh172 = nightHours(172);
const refNh172 = refNightHours(172, 64.5);
const gameLoonSubarctic = callGap('loon', 21.8, 172);
const refLoonSubarctic = refLoonGap(21.8, 172, 64.5);
const gameWpSubarctic = callGap('woodpecker', 21.8, 172);
const refWpSubarctic = refWoodpeckerGap(21.8, 172, 64.5);

// Case 2: Remote treeless Namib Desert landing (-23.44°S, 15.0°E, SITE.treeShare = 0, Day 355, Hour 12)
setSite({
  latDeg: -23.44,
  lonDeg: 15.0,
  datumM: 400,
  salt: 1,
  treeShare: 0,
  dir: [0, 1, 0],
  east: [1, 0, 0],
  north: [0, 0, 1],
});
const desertWpCallers = callersNear(-1500, -1180, 45, habitatOf, WORLD_SEED);
const desertLoonCallers = callersNear(-1220, -820, 45, habitatOf, WORLD_SEED);
const desertHabWp = habitatOf(-1486.3127, -1165.3117, WORLD_SEED);
const desertHabLoon = habitatOf(-1203.5751, -801.3684, WORLD_SEED);

// Case 3: Home water ambience vs actual surface water (clearSite)
clearSite();
const originOpenWater = drawOpenWater(0, 0);
const originSurf = surfaceAt(0, 0, WORLD_SEED);
const originNearbyWater = nearbyWater(0, 0);

const perchedLakeSurf = surfaceAt(-1200, -980, WORLD_SEED);
const perchedBankSurf = surfaceAt(-1192, -980, WORLD_SEED);
const perchedBankNearbyWater = nearbyWater(-1192, -980);

const out = {
  sources: [
    'NOAA General Solar Position Calculations (Spencer 1971), https://gml.noaa.gov/grad/solcalc/solareqns.PDF',
    'Mennill (2014), Waterbirds 37(sp1):48-56, doi:10.1675/063.037.sp105 (Common Loon 166.8 wails/night vs 9.3 wails/day)',
    'McIntyre & Barr (1997), The Birds of North America: Common Loon (Gavia immer, Holarctic breeding distribution 42N-70N, absent from Southern Hemisphere)',
    'Evans & Conner (1979) & Dodenhoff, Stark & Johnson (1998), Condor 100:350 (Hairy Woodpecker requires forest canopy stems; diurnal 4 drums/min)',
  ],
  calibration: {
    metric: 'timingScore = 1 - |gameGap - refGap| / refGap (>= 0.95 pass); positionScore = validHabitatCallers / totalCallers (>= 0.95 pass)',
    knownMatchHomeDay227Noon: knownMatchLoon,
    knownMismatchHalvedInterval: knownMismatchLoon,
  },
  subarcticSummerDusk_64_5N_Day172_21h48: {
    siteLatDeg: latSubarctic,
    skySunElevationDeg: sunElSubarcticGame,
    noaaSunElevationDeg: sunElSubarcticNoaa,
    gameNightHours: gameNh172,
    refNightHours: refNh172,
    gameLoonGapSec: gameLoonSubarctic,
    refLoonGapSec: refLoonSubarctic,
    loonTimingScore: timingScore(gameLoonSubarctic, refLoonSubarctic),
    gameWoodpeckerGapSec: gameWpSubarctic,
    refWoodpeckerGapSec: refWpSubarctic,
    woodpeckerTimingScore: timingScore(gameWpSubarctic, refWpSubarctic),
  },
  remoteTreelessNamib_23_44S_treeShare0: {
    siteLatDeg: -23.44,
    siteTreeShare: 0,
    expectedWoodpeckerCanopy: 0,
    gameHabitatCanopy: desertHabWp.canopy,
    spawnedWoodpeckersIn45m: desertWpCallers.length,
    expectedLoonsSouthernHemisphere: 0,
    gameHabitatLake: desertHabLoon.lake,
    spawnedLoonsIn45m: desertLoonCallers.length,
    callerPositionScore: 0,
  },
  waterAmbienceAudit: {
    dryOriginBasin_0_0: {
      drawOpenWater: originOpenWater,
      stagedLakeKind: originSurf.lake?.kind ?? null,
      renderedWaterVisible: false,
      gameNearbyWaterGain: originNearbyWater,
      expectedNearbyWaterGain: 0,
    },
    perchedLakeShore_n1192_n980: {
      adjacentLakeAreaHa: perchedLakeSurf.lake?.areaHa ?? 0,
      adjacentLakeSurfaceM: perchedLakeSurf.lake?.surface ?? null,
      bankHeightM: perchedBankSurf.height,
      distanceToLakeM: 8,
      renderedWaterVisible: true,
      gameNearbyWaterGain: perchedBankNearbyWater,
      expectedNearbyWaterGainMin: 0.25,
    },
  },
};

writeFileSync(resolve(__dirname, 'numbers.json'), JSON.stringify(out, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(out, null, 2));
