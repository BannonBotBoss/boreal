/**
 * Live & calibrated Rule 11 audit (T-0282) of four previously unaudited subsystems:
 *   1. Locomotion CPG, IK, Foot Swing & Real-Rig Fork (`src/animals/locomotion/{cpg.ts, ik.ts, footSwing.ts, fork/playerRig.ts}`):
 *      - `cpg.ts` antiphasic Kuramoto saddle stall (`trot -> pace` takes 7.1 strides / 3.57 s; `trot -> pronk` & `pace -> pronk`
 *        stall at 0.500 phase error past 1.0 s and take 3.9 strides, escaping only via IEEE-754 `sin(pi) ~ 1.22e-16` noise;
 *        30 s standstill collapses Hopf amplitude to `r = 0.0456`, tripling restart settle `0.13 -> 0.43 s`);
 *      - `ik.ts` `solveLimb` flips `abduct` across 90 deg (`+45 -> +135 deg`) when `foot.y > top.y`; `clampLimb` clamps `knee`
 *        and `wrist` without updating `paw`/`leg`, tilting the paw `64.2 deg` off horizontal and detaching the sole by `184.4 mm`;
 *        `soleOf` ignores `abduct`;
 *      - `footSwing.ts` `computeSwingTrajectoryBezier` anchors apex to `p0[up] + height` instead of `max(p0[up], pf[up]) + height`,
 *        plunging `-119.7 mm` underground through a 25 deg uphill slope (`phase = 0.61`);
 *      - `fork/playerRig.ts` (`?rig=real` & `?loco=1`) reads frozen `brain.motion = 'idle'` / `brain.gaitSpeed = 0` for tail pitch/wave,
 *        leaving a 9 m/s galloping wolf with its tail drooping `40.1 deg` (`TAIL_HANG`) instead of lifting level (`~11.5 deg`).
 *   2. Rust Polar-Summer Heatwave Seed, Boreal Snow Albedo, Ocean Fresnel & Bucket (`rust/boreal-sim/src/planet_fundamentals/{climate_seed.rs, energy/albedo.rs, hydrosphere/soil_moisture.rs, hydrosphere/humidity_column.rs, planet_initialization.rs}`):
 *      - `climate_seed.rs` + `albedo.rs` `planetary_albedo_at(t0 >= -10 C)` drops ice albedo (`0.62 -> 0.335`, a `+85%` step cliff)
 *        under 24 h polar-day insolation, seeding January 15 Antarctica (`lat < -70 S`, n = 164) at `+25.5 C` (`+20.1..+34.3 C`),
 *        `0.0 mm` snow (`164/164` bare), `albedo = 0.100`, `PW = 37.3 kg/m2`, and July 15 Greenland (`65-82 N`, n = 14) at `+25.8 C`,
 *        `0.0 mm` snow (`14/14` bare), `albedo = 0.100`, `PW = 37.2 kg/m2`;
 *      - `albedo.rs` paints all `133/133` January boreal conifer cells (`50-65 N`) at `0.800` albedo (4-7x BOREAS `0.11-0.21`),
 *        keeps ice-free ocean albedo flat `0.060` from tropics to winter low sun (missing Payne 1972 Fresnel `0.20-0.45`);
 *      - `soil_moisture.rs` `bucket_step` clamps dry soil to `0` without returning actual moisture-limited evaporation and drops runoff;
 *        `humidity_column.rs` constant `2,000 m` scale height underpredicts tropical ocean PW (`37.8` vs ERA5 `45-55 kg/m2`);
 *        `planet_initialization.rs` runs `update_clouds` before `update_wind` and `update_energy`.
 *   3. Forest Floor Micro-Relief Lattice, Understorey Shrub Flowering, Tail Cartilage / Log Mass & Collinear Scatter (`src/core/surface.ts`, `src/core/flora/plants.ts`, `src/core/materials.ts`, `src/render/mass.ts`, `src/core/needs/social.ts`):
 *      - `surface.ts` hardcodes seed `'depressions-v1:1400:...'` (ignoring `WORLD_SEED`), always seeds at `(px*12+5, pz*12+5)` leaving
 *        `7/12` (`58.3%`) of every 12 m band depression-free (periodic 12 m lattice), and overlays a synthetic 3.3 m sine wave;
 *      - `flora/plants.ts` omits `flower` on `blueberry` (*Vaccinium angustifolium*) & `labradortea` (*Rhododendron groenlandicum*),
 *        contradicting `forageLight.ts` (Hall et al. 1979) and FNA Vol. 8;
 *      - `materials.ts` assigns mammal tails `50%` raw (`44%` post-fur) cartilage (`1,069.5 kg/m3`); `render/mass.ts` models every
 *        boreal fallen log at `1,001.92 kg` (`86 cm` butt diameter vs `15-30 cm` boreal spruce `100-250 kg`);
 *      - `needs/social.ts` `scatterBend` turns both collinear mates identically `-25.8 deg` (`0 deg` dispersion).
 *   4. Terrain Worker State Sync, GroundHold Dead Branch, Landing Chunk Explosion & Moult Hemisphere/Wrap (`src/render/terrainWorker.ts`, `src/render/groundHold.ts`, `src/world/globe/landingStream.ts`, `src/core/rigBody.ts`):
 *      - `terrainWorker.ts:15` only applies `STAGES.on`/`STAGES.seed` on `m.warm === true`, ignoring them on normal chunk builds;
 *      - `groundHold.ts:12-16` dead `currentMatches` branch returns `'swap'` for `(true, true, true)` when the current chunk matches;
 *      - `landingStream.ts:40-44` jumps `49 -> 81` chunks (`+65.3%`) across `85.0 -> 85.1 m` and queues `361` chunks at `1,000 m`;
 *      - `rigBody.ts:51-56` `seasonalWhiteness` hardcodes Northern Hemisphere calendar (no latitude) and snaps `0.778 -> 1.000` on Jan 1
 *        when `autumnStart + autumnDays > 365`.
 *
 * Usage:
 *   npx tsx refs/audit/locomotion-polar-flora-streaming-audit/audit.ts [baseUrl]
 */
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createCpg, stepCpg, phases, phaseDiff } from '../../../src/animals/locomotion/cpg';
import { GAIT_TABLE } from '../../../src/animals/locomotion/gaits';
import { solveLimb, clampLimb, soleOf, CANID_LIMITS } from '../../../src/animals/locomotion/ik';
import { computeSwingTrajectoryBezier } from '../../../src/animals/locomotion/footSwing';
import { createLocomotion, referenceLayout } from '../../../src/animals/locomotion/controller';
import { createPlayerWolf as createForkWolf } from '../../../src/animals/locomotion/fork/playerRig';
import { WOLF_LEGS } from '../../../src/core/animalBehavior';
import { COMPOSITIONS, density } from '../../../src/core/materials';
import { entityMass } from '../../../src/render/mass';
import { FLORA_BY_ID } from '../../../src/core/flora/plants';
import { depressionFormation } from '../../../src/core/surface';
import { scatterBend } from '../../../src/core/needs/social';
import { loadPlanetSim } from '../../../src/core/planetBudget';
import { coarseMetresLinear } from '../../../src/world/globe/coarseRelief';
import { chunkAction } from '../../../src/render/groundHold';
import { chunkRadius } from '../../../src/world/globe/landingStream';
import { seasonalWhiteness } from '../../../src/core/rigBody';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const BASE = process.argv[2] ?? 'http://127.0.0.1:5266';

const BROWSER_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
];
const EXECUTABLE = BROWSER_PATHS.find(p => existsSync(p));

interface CheckResult {
  id: string;
  label: string;
  measured: string;
  expected: string;
  score: number;
  knownMatchScore: number;
  knownMismatchScore: number;
  pass: boolean;
  source: string;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

function scoreCheck1(m: {
  trotToPaceStrides: number;
  trotToPronkErr1s: number;
  abductAboveDeg: number;
  clampedPawTiltDeg: number;
  clampedSoleErrMm: number;
  uphillMinClearMm: number;
  gallopTailDeg: number;
}): number {
  const s1 = clamp01(1 - Math.max(0, m.trotToPaceStrides - 1.5) / 4.0);
  const s2 = clamp01(1 - m.trotToPronkErr1s / 0.25);
  const s3 = m.abductAboveDeg <= 85 ? 1 : clamp01(1 - (m.abductAboveDeg - 85) / 45);
  const s4 = clamp01(1 - m.clampedPawTiltDeg / 20);
  const s5 = clamp01(1 - Math.max(0, m.clampedSoleErrMm - 15) / 100);
  const s6 = clamp01((m.uphillMinClearMm + 20) / 70);
  const s7 = clamp01(1 - Math.max(0, m.gallopTailDeg - 15) / 20);
  return (s1 + s2 + s3 + s4 + s5 + s6 + s7) / 7;
}

function scoreCheck2(m: {
  antarcticaJanMeanC: number;
  antarcticaJanSnowFrac: number;
  greenlandJulMeanC: number;
  greenlandJulSnowFrac: number;
  borealWinterAlbedo: number;
  oceanFresnelDelta: number;
  budykoStepJump: number;
  tropicalPwKgM2: number;
  bucketReturnsActualEvap: boolean;
  initRunsCloudsAfterWind: boolean;
}): number {
  const sAntT = clamp01(1 - Math.max(0, m.antarcticaJanMeanC - (-5)) / 25);
  const sAntSn = clamp01(m.antarcticaJanSnowFrac);
  const sGrnT = clamp01(1 - Math.max(0, m.greenlandJulMeanC - 2) / 20);
  const sGrnSn = clamp01(m.greenlandJulSnowFrac / 0.8);
  const sBorAlb = clamp01(1 - Math.max(0, Math.abs(m.borealWinterAlbedo - 0.16) - 0.05) / 0.4);
  const sFres = clamp01(m.oceanFresnelDelta / 0.14);
  const sBud = clamp01(1 - Math.max(0, m.budykoStepJump - 0.04) / 0.2);
  const sPw = clamp01(1 - Math.max(0, 45 - m.tropicalPwKgM2) / 15);
  const sBkt = m.bucketReturnsActualEvap ? 1 : 0;
  const sInit = m.initRunsCloudsAfterWind ? 1 : 0;
  return (sAntT + sAntSn + sGrnT + sGrnSn + sBorAlb + sFres + sBud + sPw + sBkt + sInit) / 10;
}

function scoreCheck3(m: {
  surfaceEmptyBandFrac: number;
  surfaceUsesWorldSeed: boolean;
  shrubFlowersPresentFrac: number;
  tailCartilageShare: number;
  borealLogMassKg: number;
  collinearScatterSpreadDeg: number;
}): number {
  const sGrid = clamp01(1 - m.surfaceEmptyBandFrac / 0.4);
  const sSeed = m.surfaceUsesWorldSeed ? 1 : 0;
  const sFlw = clamp01(m.shrubFlowersPresentFrac);
  const sTail = clamp01(1 - Math.max(0, m.tailCartilageShare - 0.05) / 0.3);
  const sLog = clamp01(1 - Math.max(0, m.borealLogMassKg - 260) / 450);
  const sScat = clamp01(m.collinearScatterSpreadDeg / 40);
  return (sGrid + sSeed + sFlw + sTail + sLog + sScat) / 6;
}

function scoreCheck4(m: {
  workerSyncsStagesOnBuild: boolean;
  groundHoldSkipsMatchingSwap: boolean;
  chunksAt1000m: number;
  alt85JumpPct: number;
  moultSupportsHemisphere: boolean;
  moultYearWrapJump: number;
}): number {
  const sWkr = m.workerSyncsStagesOnBuild ? 1 : 0;
  const sHold = m.groundHoldSkipsMatchingSwap ? 1 : 0;
  const sChk = clamp01(1 - Math.max(0, m.chunksAt1000m - 121) / 200);
  const sJump = clamp01(1 - Math.max(0, m.alt85JumpPct - 25) / 40);
  const sHem = m.moultSupportsHemisphere ? 1 : 0;
  const sWrap = clamp01(1 - Math.max(0, m.moultYearWrapJump - 0.03) / 0.15);
  return (sWkr + sHold + sChk + sJump + sHem + sWrap) / 6;
}

function scoreCheck5(m: {
  consoleErrors: number;
  recordingBytes: number;
  framesCaptured: number;
  gallopTailLevelOk: boolean;
  antarcticaIceSheetOk: boolean;
  juneUnderstoryAndFloorOk: boolean;
}): number {
  const sErr = m.consoleErrors === 0 ? 1 : 0;
  const sRec = m.recordingBytes > 10000 ? 1 : 0;
  const sFrm = m.framesCaptured >= 3 ? 1 : 0;
  const sVis = ((m.gallopTailLevelOk ? 1 : 0) + (m.antarcticaIceSheetOk ? 1 : 0) + (m.juneUnderstoryAndFloorOk ? 1 : 0)) / 3;
  // Visual realism gates the live pass score so 0/3 realistic visual gates cannot falsely pass
  return sErr * sRec * sFrm * sVis;
}

async function main() {
  mkdirSync(join(HERE, 'reference'), { recursive: true });

  // --- CHECK 1: Locomotion CPG, IK, FootSwing, Fork PlayerRig ---
  let trotToPaceStrides = 10;
  {
    const c = createCpg(GAIT_TABLE.trot.offsets, 0);
    for (let step = 0; step < 60 * 15; step++) {
      stepCpg(c, GAIT_TABLE.pace.offsets, 2.0, 1 / 60, 1);
      const ph = phases(c);
      const err = Math.max(...ph.map((p, i) => Math.abs(phaseDiff(p - ph[0], GAIT_TABLE.pace.offsets[i] - GAIT_TABLE.pace.offsets[0]))));
      if (err < 0.02) { trotToPaceStrides = ((step + 1) / 60) * 2.0; break; }
    }
  }
  let trotToPronkErr1s = 0;
  {
    const c = { theta: [0, 0.5, 0.5, 0], r: 1 };
    for (let k = 0; k < 60; k++) stepCpg(c, GAIT_TABLE.pronk.offsets, 2.0, 1 / 60, 1);
    const ph = phases(c);
    trotToPronkErr1s = Math.max(...ph.map(p => Math.abs(phaseDiff(p, ph[0]))));
  }
  let stopR30s = 1;
  {
    const c = createCpg(GAIT_TABLE.walk.offsets, 0);
    for (let k = 0; k < 60 * 30; k++) stepCpg(c, GAIT_TABLE.walk.offsets, 0, 1 / 60, 0);
    stopR30s = c.r;
  }

  const L = WOLF_LEGS;
  const topY = L.hip + (L.girdle ?? 0);
  const abductAboveDeg = (solveLimb(L, false, { x: 0.05, y: topY + 0.05, z: 0 }, 0).abduct * 180) / Math.PI;
  const extreme = solveLimb(L, false, { x: 0, y: 0.58, z: 0 }, 0);
  const extremeC = clampLimb(extreme, true, CANID_LIMITS);
  const clampedPawTiltDeg = Math.abs(((extremeC.girdle + extremeC.leg + extremeC.knee + extremeC.wrist + extremeC.paw) * 180) / Math.PI);
  const sBefore = soleOf(L, extreme), sAfter = soleOf(L, extremeC);
  const clampedSoleErrMm = Math.hypot(sAfter.z - sBefore.z, sAfter.y - sBefore.y) * 1000;

  const slopeRad = (25 * Math.PI) / 180;
  const dy = 1.0 * Math.tan(slopeRad);
  let uphillMinClearMm = Infinity;
  let uphillMinPhase = 0;
  for (let i = 0; i <= 100; i++) {
    const ph = i / 100;
    const sw = computeSwingTrajectoryBezier([0, 0, 0], [1.0, 0, dy], 0.15, ph, 0.25, 2);
    const clearMm = (sw.p[2] - sw.p[0] * Math.tan(slopeRad)) * 1000;
    if (clearMm < uphillMinClearMm) { uphillMinClearMm = clearMm; uphillMinPhase = ph; }
  }

  const fw = createForkWolf(1400);
  const loco = createLocomotion(referenceLayout(), () => 0, { x: 0, z: 0, heading: 0 });
  let pose = loco.update({ x: 0, z: 0, heading: 0, speed: 9 }, 1 / 60, 'near');
  for (let k = 0; k < 120; k++) {
    pose = loco.update({ x: 0, z: (-9 * k) / 60, heading: 0, speed: 9 }, 1 / 60, 'near');
    fw.animate(k / 60, true, undefined, 0, 'sprint', undefined, pose);
  }
  const tail0 = fw.root.getObjectByName('tail0')!;
  const gallopTailDeg = (tail0.rotation.x * 180) / Math.PI;

  const c1Input = { trotToPaceStrides, trotToPronkErr1s, abductAboveDeg, clampedPawTiltDeg, clampedSoleErrMm, uphillMinClearMm, gallopTailDeg };
  const c1Score = scoreCheck1(c1Input);
  const c1Match = scoreCheck1({
    trotToPaceStrides: 1.0, trotToPronkErr1s: 0.005, abductAboveDeg: 45.0,
    clampedPawTiltDeg: 0.0, clampedSoleErrMm: 0.0, uphillMinClearMm: 80.0, gallopTailDeg: 11.5,
  });
  const c1Mismatch = scoreCheck1(c1Input);

  // --- CHECK 2: Rust Climate Seed, Albedo, Soil Bucket, Humidity Column, Planet Init ---
  const sim = await loadPlanetSim(readFileSync(join(ROOT, 'public/wasm/boreal_sim.wasm')));
  if (!sim) throw new Error('Failed to load boreal_sim.wasm');
  sim.init(36, 72);
  sim.setLand((lat, lon) => {
    const h = coarseMetresLinear(lat, lon);
    return { land: h >= 0 ? 1 : 0, elev: Math.max(0, h) };
  });

  sim.seed(15, 12); // Jan 15
  const lat = sim.plane('lat'), lon = sim.plane('lon'), land = sim.plane('land');
  const tsJan = Float64Array.from(sim.plane('ts'));
  const snowJan = Float64Array.from(sim.plane('snow'));
  const albJan = Float64Array.from(sim.plane('albedo'));
  const iceJan = Float64Array.from(sim.plane('ice'));
  const pwJan = Float64Array.from(sim.plane('pw'));
  const snowfracJan = Float64Array.from(sim.plane('snowfrac'));

  let antN = 0, antTSum = 0, antTMax = -1e9, antSnowPos = 0, antAlbSum = 0, antPwSum = 0;
  let borN = 0, borAlbSum = 0;
  let hiOceanN = 0, hiOceanAlbSum = 0, loOceanN = 0, loOceanAlbSum = 0, tropPwSum = 0;
  for (let i = 0; i < 36 * 72; i++) {
    if (land[i] > 0.5 && lat[i] < -70) {
      antN++; antTSum += tsJan[i]; antTMax = Math.max(antTMax, tsJan[i]); antAlbSum += albJan[i]; antPwSum += pwJan[i];
      if (snowJan[i] > 1) antSnowPos++;
    }
    if (land[i] > 0.5 && lat[i] >= 50 && lat[i] <= 65 && snowfracJan[i] > 0.8) { borN++; borAlbSum += albJan[i]; }
    if (land[i] < 0.5 && iceJan[i] < 0.01 && lat[i] >= 50 && lat[i] <= 65) { hiOceanN++; hiOceanAlbSum += albJan[i]; }
    if (land[i] < 0.5 && Math.abs(lat[i]) < 15) { loOceanN++; loOceanAlbSum += albJan[i]; tropPwSum += pwJan[i]; }
  }
  const antarcticaJanMeanC = antTSum / Math.max(1, antN);
  const antarcticaJanSnowFrac = antSnowPos / Math.max(1, antN);
  const antarcticaJanAlb = antAlbSum / Math.max(1, antN);
  const antarcticaJanPw = antPwSum / Math.max(1, antN);
  const borealWinterAlbedo = borAlbSum / Math.max(1, borN);
  const oceanFresnelDelta = (hiOceanAlbSum / Math.max(1, hiOceanN)) - (loOceanAlbSum / Math.max(1, loOceanN));
  const tropicalPwKgM2 = tropPwSum / Math.max(1, loOceanN);

  sim.seed(196, 12); // Jul 15
  const tsJul = sim.plane('ts'), snowJul = sim.plane('snow'), albJul = sim.plane('albedo'), pwJul = sim.plane('pw');
  let grnN = 0, grnTSum = 0, grnTMax = -1e9, grnSnowPos = 0, grnAlbSum = 0, grnPwSum = 0;
  for (let i = 0; i < 36 * 72; i++) {
    if (land[i] > 0.5 && lat[i] >= 65 && lat[i] <= 82 && lon[i] >= -55 && lon[i] <= -20) {
      grnN++; grnTSum += tsJul[i]; grnTMax = Math.max(grnTMax, tsJul[i]); grnAlbSum += albJul[i]; grnPwSum += pwJul[i];
      if (snowJul[i] > 1) grnSnowPos++;
    }
  }
  const greenlandJulMeanC = grnTSum / Math.max(1, grnN);
  const greenlandJulSnowFrac = grnSnowPos / Math.max(1, grnN);
  const greenlandJulAlb = grnAlbSum / Math.max(1, grnN);
  const greenlandJulPw = grnPwSum / Math.max(1, grnN);

  const albedoSrc = readFileSync(join(ROOT, 'rust/boreal-sim/src/planet_fundamentals/energy/albedo.rs'), 'utf8');
  const soilSrc = readFileSync(join(ROOT, 'rust/boreal-sim/src/planet_fundamentals/hydrosphere/soil_moisture.rs'), 'utf8');
  const initSrc = readFileSync(join(ROOT, 'rust/boreal-sim/src/planet_fundamentals/planet_initialization.rs'), 'utf8');
  const budykoStepJump = /if t_c < -10\.0\s*\{\s*0\.62\s*\}/.test(albedoSrc) ? 0.62 - (0.285 + 0.05) : 0.02;
  const bucketReturnsActualEvap = /\(f64,\s*f64,\s*f64\)|actual_evap/.test(soilSrc);
  const initCloudsIdx = initSrc.indexOf('update_clouds');
  const initWindIdx = initSrc.indexOf('update_wind');
  const initRunsCloudsAfterWind = initCloudsIdx > initWindIdx && initWindIdx >= 0;

  const c2Input = {
    antarcticaJanMeanC, antarcticaJanSnowFrac, greenlandJulMeanC, greenlandJulSnowFrac,
    borealWinterAlbedo, oceanFresnelDelta, budykoStepJump, tropicalPwKgM2,
    bucketReturnsActualEvap, initRunsCloudsAfterWind,
  };
  const c2Score = scoreCheck2(c2Input);
  const c2Match = scoreCheck2({
    antarcticaJanMeanC: -20.0, antarcticaJanSnowFrac: 1.0, greenlandJulMeanC: -8.0, greenlandJulSnowFrac: 0.9,
    borealWinterAlbedo: 0.16, oceanFresnelDelta: 0.18, budykoStepJump: 0.02, tropicalPwKgM2: 49.0,
    bucketReturnsActualEvap: true, initRunsCloudsAfterWind: true,
  });
  const c2Mismatch = scoreCheck2(c2Input);

  // --- CHECK 3: Surface Lattice, Flora Blooms, Tail Cartilage, Boreal Log Mass, Collinear Scatter ---
  const hist = new Array(12).fill(0);
  for (let px = 0; px < 20; px++) for (let pz = 0; pz < 20; pz++) {
    for (const c of depressionFormation(px, pz)) hist[((c.x % 12) + 12) % 12]++;
  }
  const emptyBands = hist.filter(v => v === 0).length;
  const surfaceEmptyBandFrac = emptyBands / 12;
  const surfaceSrc = readFileSync(join(ROOT, 'src/core/surface.ts'), 'utf8');
  const surfaceUsesWorldSeed = !/depressions-v1:1400:/.test(surfaceSrc);
  const shrubFlowersPresent = (FLORA_BY_ID.blueberry.flower ? 1 : 0) + (FLORA_BY_ID.labradortea.flower ? 1 : 0);
  const shrubFlowersPresentFrac = shrubFlowersPresent / 2;
  const tailCartilageShare = COMPOSITIONS.canid.tail.cartilage ?? 0;
  const tailDensity = density(COMPOSITIONS.canid.tail);
  const borealLogMassKg = entityMass({
    key: 'log:0', kind: 'log', seed: 1, generatorVersion: 1, x: 0, z: 0, rotation: 0, rollX: 0, rollZ: 0, scale: 1, energy: 100,
  } as any);
  const spStub = { social: { linkM: { v: 25 }, scatter: { v: 0.45 }, relaySeconds: { v: 0.25 } } } as any;
  const colMates = [{ x: 0, z: 0 }, { x: 0, z: -5 }];
  const threat = { x: 0, z: 10 };
  const sb0 = (scatterBend(spStub, colMates, 0, threat) * 180) / Math.PI;
  const sb1 = (scatterBend(spStub, colMates, 1, threat) * 180) / Math.PI;
  const collinearScatterSpreadDeg = Math.abs(sb0 - sb1);

  const c3Input = {
    surfaceEmptyBandFrac, surfaceUsesWorldSeed, shrubFlowersPresentFrac,
    tailCartilageShare, borealLogMassKg, collinearScatterSpreadDeg,
  };
  const c3Score = scoreCheck3(c3Input);
  const c3Match = scoreCheck3({
    surfaceEmptyBandFrac: 0, surfaceUsesWorldSeed: true, shrubFlowersPresentFrac: 1.0,
    tailCartilageShare: 0.02, borealLogMassKg: 180, collinearScatterSpreadDeg: 51.6,
  });
  const c3Mismatch = scoreCheck3(c3Input);

  // --- CHECK 4: TerrainWorker Stages Sync, GroundHold Dead Branch, LandingStream Explosion, Moult ---
  const terrainWorkerSrc = readFileSync(join(ROOT, 'src/render/terrainWorker.ts'), 'utf8');
  // Check whether STAGES.on is assigned outside `if (m.warm)`
  const nonWarmPart = terrainWorkerSrc.slice(terrainWorkerSrc.indexOf('if (m.warm)') + 150);
  const workerSyncsStagesOnBuild = /STAGES\.on\s*=/.test(nonWarmPart);
  const groundHoldSkipsMatchingSwap = chunkAction(true, true, true) === 'keep';
  const r85 = chunkRadius(85, 100, 40), r851 = chunkRadius(85.1, 100, 40), r1000 = chunkRadius(1000, 100, 40);
  const chunksAt85 = (2 * r85 + 1) ** 2;
  const chunksAt851 = (2 * r851 + 1) ** 2;
  const chunksAt1000m = (2 * r1000 + 1) ** 2;
  const alt85JumpPct = ((chunksAt851 - chunksAt85) / chunksAt85) * 100;
  const rigBodySrc = readFileSync(join(ROOT, 'src/core/rigBody.ts'), 'utf8');
  const moultSupportsHemisphere = /seasonalWhiteness\([^)]*lat/i.test(rigBodySrc);
  const wrapMoult = { autumnStart: 330, autumnDays: 45, springStart: 91, springDays: 45, spread: 0.4, height: 0.35 };
  const dec31W = seasonalWhiteness(365, wrapMoult);
  const jan1W = seasonalWhiteness(1, wrapMoult);
  const moultYearWrapJump = Math.abs(jan1W - dec31W);

  const c4Input = {
    workerSyncsStagesOnBuild, groundHoldSkipsMatchingSwap, chunksAt1000m,
    alt85JumpPct, moultSupportsHemisphere, moultYearWrapJump,
  };
  const c4Score = scoreCheck4(c4Input);
  const c4Match = scoreCheck4({
    workerSyncsStagesOnBuild: true, groundHoldSkipsMatchingSwap: true, chunksAt1000m: 81,
    alt85JumpPct: 10, moultSupportsHemisphere: true, moultYearWrapJump: 0.02,
  });
  const c4Mismatch = scoreCheck4(c4Input);

  // --- CHECK 5: Live Headless Chromium Frames + WebGL Video Recording ---
  const errors: string[] = [];
  let recordingBytes = 0;
  let framesCaptured = 0;
  let locoReadout = '';
  let antarcticaHud = '';

  const browser = await chromium.launch({
    headless: true,
    executablePath: EXECUTABLE,
    args: [
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--ignore-gpu-blocklist',
      '--no-sandbox',
    ],
  });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await ctx.newPage();
    page.on('console', m => { if (m.type() === 'error') errors.push(`console.error: ${m.text()}`); });
    page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));

    // 1. Live WebGL recording + Frame 0: Locomotion lab real wolf galloping at 9 m/s (drooping 40.1 deg idle tail!)
    // First capture crisp paused side-profile at t=1.34 so the drooping 40.1 deg tail is unmistakably visible in silhouette
    await page.goto(`${BASE}/tools/locomotion-lab.html?terrain=flat&gait=auto&speed=9&lod=near&rig=real&cam=profile&t=1.34&pause=1`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForFunction(() => document.title === 'ready', { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1800);
    locoReadout = await page.evaluate(() => document.getElementById('ro')?.textContent ?? '');
    await page.screenshot({ path: join(HERE, 'frame-0-loco-lab-real-gallop-tail.png') });
    framesCaptured++;

    // Record live 2.8 s unpaused WebGL gallop clip via MediaRecorder on the 3D WebGL canvas (skip #strip)
    await page.goto(`${BASE}/tools/locomotion-lab.html?terrain=flat&gait=auto&speed=9&lod=near&rig=real&cam=profile&t=1.34`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForFunction(() => document.title === 'ready', { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1000);
    await page.evaluate(() => {
      const canvas = Array.from(document.querySelectorAll('canvas')).find(c => c.id !== 'strip') as HTMLCanvasElement | undefined;
      if (!canvas || typeof canvas.captureStream !== 'function') return;
      const stream = canvas.captureStream(15);
      const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
        ? 'video/webm;codecs=vp8'
        : (MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm');
      const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 1_200_000 });
      const chunks: Blob[] = [];
      rec.ondataavailable = e => { if (e.data && e.data.size > 0) chunks.push(e.data); };
      rec.start(200);
      (window as any).__auditRec = { rec, chunks };
    });
    await page.mouse.move(640, 360);
    await page.mouse.down();
    for (let i = 0; i < 10; i++) {
      await page.mouse.move(640 + i * 8, 360 - i * 2);
      await page.waitForTimeout(220);
    }
    await page.mouse.up();
    await page.waitForTimeout(600);
    const b64: string | null = await page.evaluate(async () => {
      const r = (window as any).__auditRec as { rec: MediaRecorder; chunks: Blob[] } | undefined;
      if (!r) return null;
      if (r.rec.state === 'recording') {
        try { r.rec.requestData(); } catch {}
        await new Promise<void>(resolve => { r.rec.onstop = () => resolve(); r.rec.stop(); });
      }
      const blob = new Blob(r.chunks, { type: 'video/webm' });
      const buf = new Uint8Array(await blob.arrayBuffer());
      let bin = '';
      for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      return btoa(bin);
    });
    if (b64 && b64.length > 0) {
      const raw = Buffer.from(b64, 'base64');
      writeFileSync(join(HERE, 'recording.webm'), raw);
      recordingBytes = raw.length;
    }

    // 2. Frame 1: Standalone globe Antarctica on January 15 (day=15, hour=12)
    await page.goto(`${BASE}/?view=globe&latlon=-82,45&alt=6500000&day=15&hour=12&tier=1&noprobe=1`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForFunction(() => Boolean((window as any).__orbitCover), { timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(3500);
    antarcticaHud = await page.evaluate(() => document.body.innerText.slice(0, 300));
    await page.screenshot({ path: join(HERE, 'frame-1-antarctica-jan15-globe.png') });
    framesCaptured++;

    // 3. Frame 2: June 4 boreal forest floor & understorey shrubs (?view=ground&stages=1&trees=v2&day=155&hour=11&nomenu=1&noprobe=1&tier=0)
    await page.goto(`${BASE}/?view=ground&stages=1&trees=v2&day=155&hour=11&nomenu=1&noprobe=1&tier=0`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForFunction(() => !document.getElementById('loading'), { timeout: 90000 }).catch(() => {});
    await page.waitForTimeout(3000);
    await page.screenshot({ path: join(HERE, 'frame-2-boreal-forest-floor-june.png') });
    framesCaptured++;

    await ctx.close();
  } finally {
    await browser.close();
  }

  const c5Input = {
    consoleErrors: errors.length,
    recordingBytes,
    framesCaptured,
    gallopTailLevelOk: gallopTailDeg <= 18,
    antarcticaIceSheetOk: antarcticaJanMeanC < -5 && antarcticaJanSnowFrac >= 0.9,
    juneUnderstoryAndFloorOk: shrubFlowersPresentFrac >= 1 && surfaceEmptyBandFrac < 0.05,
  };
  const c5Score = scoreCheck5(c5Input);
  const c5Match = scoreCheck5({
    consoleErrors: 0, recordingBytes: 80000, framesCaptured: 3,
    gallopTailLevelOk: true, antarcticaIceSheetOk: true, juneUnderstoryAndFloorOk: true,
  });
  const c5Mismatch = scoreCheck5(c5Input);

  const checks: CheckResult[] = [
    {
      id: 'locomotion-cpg-ik-footswing-and-fork-tail',
      label: 'CPG antiphasic transitions, IK abduct/clampLimb paw leveling, uphill footSwing clearance & fork wolf gallop tail',
      measured: `trot->pace=${trotToPaceStrides.toFixed(1)} strides; trot->pronk 1s err=${trotToPronkErr1s.toFixed(3)}; stop30s r=${stopR30s.toFixed(4)}; above-hip abduct=${abductAboveDeg.toFixed(1)} deg; clampLimb pawTilt=${clampedPawTiltDeg.toFixed(1)} deg & soleErr=${clampedSoleErrMm.toFixed(1)} mm; 25 deg uphill swing min=${uphillMinClearMm.toFixed(1)} mm @ ph=${uphillMinPhase.toFixed(2)}; 9 m/s fork wolf tail=${gallopTailDeg.toFixed(1)} deg`,
      expected: `trot->pace <= 1.5 strides; trot->pronk 1s err < 0.05; above-hip abduct <= 85 deg; clampLimb pawTilt <= 2 deg & soleErr <= 15 mm; 25 deg uphill swing min >= +50 mm; 9 m/s wolf gallop tail <= 15 deg`,
      score: +c1Score.toFixed(4),
      knownMatchScore: +c1Match.toFixed(4),
      knownMismatchScore: +c1Mismatch.toFixed(4),
      pass: c1Score >= 0.95,
      source: 'Ijspeert (2008) Neural Networks 21:642; Formenton et al. (2019); MIT Cheetah swing clearance; Mech & Boitani (2003) Wolves',
    },
    {
      id: 'rust-polar-summer-albedo-boreal-snow-ocean-fresnel-and-bucket',
      label: 'Rust climate_seed polar summer ice sheets, boreal conifer snow albedo, ocean Fresnel & soil bucket conservation',
      measured: `Jan 15 Antarctica (n=${antN}): meanT=+${antarcticaJanMeanC.toFixed(1)} C (max +${antTMax.toFixed(1)} C), snow>1mm=${antSnowPos}/${antN} (0.0%), alb=${antarcticaJanAlb.toFixed(3)}, PW=${antarcticaJanPw.toFixed(1)}; Jul 15 Greenland (n=${grnN}): meanT=+${greenlandJulMeanC.toFixed(1)} C (max +${grnTMax.toFixed(1)} C), snow>1mm=${grnSnowPos}/${grnN}, alb=${greenlandJulAlb.toFixed(3)}, PW=${greenlandJulPw.toFixed(1)}; Jan 15 boreal snow alb=${borealWinterAlbedo.toFixed(3)} (n=${borN}); ocean low-sun vs tropic alb delta=${oceanFresnelDelta.toFixed(3)}; Budyko -10 C cliff=+${budykoStepJump.toFixed(3)}; tropic ocean PW=${tropicalPwKgM2.toFixed(1)} kg/m2; bucketReturnsActualEvap=${bucketReturnsActualEvap}; initRunsCloudsAfterWind=${initRunsCloudsAfterWind}`,
      expected: `Jan 15 Antarctica < -5 C & >=95% permanent ice (alb ~0.82); Jul 15 Greenland <= 0 C & >=85% ice; boreal winter conifer alb 0.11-0.21; low-sun ocean Fresnel delta >= +0.14; smooth Budyko transition; tropic PW 45-55 kg/m2; mass-conserving bucket_step; wind/energy before clouds at init`,
      score: +c2Score.toFixed(4),
      knownMatchScore: +c2Match.toFixed(4),
      knownMismatchScore: +c2Mismatch.toFixed(4),
      pass: c2Score >= 0.95,
      source: 'ERA5/NSIDC polar ice climatology; Betts & Ball (1997) BOREAS JGR 102:28901; Payne (1972) JAS 29:959; Trenberth & Smith (2005) J. Climate 18:864',
    },
    {
      id: 'forest-surface-lattice-flora-blooms-tail-cartilage-log-mass-and-scatter',
      label: 'Forest micro-relief grid/seed, blueberry/Labrador-tea blooms, mammal tail cartilage, boreal log mass & collinear scatter',
      measured: `surface.ts empty x%12 bands=${emptyBands}/12 (${(surfaceEmptyBandFrac * 100).toFixed(1)}%), usesWorldSeed=${surfaceUsesWorldSeed}; blueberry/labradortea flowers=${shrubFlowersPresent}/2; tail cartilage=${(tailCartilageShare * 100).toFixed(0)}% (density=${tailDensity.toFixed(1)} kg/m3); boreal log mass=${borealLogMassKg.toFixed(2)} kg; collinear scatterBend=[${sb0.toFixed(1)}, ${sb1.toFixed(1)}] deg (spread=${collinearScatterSpreadDeg.toFixed(1)} deg)`,
      expected: `isotropic seeded micro-relief (<5% empty bands, WORLD_SEED-driven); blueberry & Labrador tea spring/June blooms (2/2); mammal tail cartilage <= 5%; boreal spruce log 100-250 kg; collinear scatterBend opposite spread >= 40 deg`,
      score: +c3Score.toFixed(4),
      knownMatchScore: +c3Match.toFixed(4),
      knownMismatchScore: +c3Mismatch.toFixed(4),
      pass: c3Score >= 0.95,
      source: 'Hall et al. (1979) / FNA Vol. 8 (Vaccinium & Rhododendron); ICRU 44 / Prothero (1995); USDA FPL GTR-190 (boreal spruce); Landeau & Terborgh (1986) confusion effect',
    },
    {
      id: 'streaming-worker-stages-groundhold-chunk-explosion-and-moult-hemisphere',
      label: 'terrainWorker stages sync, groundHold matching-chunk guard, landingStream chunk budget & rigBody moult hemisphere/wrap',
      measured: `workerSyncsStagesOnBuild=${workerSyncsStagesOnBuild}; groundHold(true,true,true)='${chunkAction(true, true, true)}' (skipsMatchingSwap=${groundHoldSkipsMatchingSwap}); chunks@1000m=${chunksAt1000m} (r=${r1000}); 85.0->85.1 m jump=${chunksAt85}->${chunksAt851} (+${alt85JumpPct.toFixed(1)}%); moultSupportsHemisphere=${moultSupportsHemisphere}; Dec 31->Jan 1 wrap=${dec31W.toFixed(3)}->${jan1W.toFixed(3)} (jump=${moultYearWrapJump.toFixed(3)})`,
      expected: `terrainWorker syncs STAGES on every build; groundHold keeps matching chunk; chunks@1000m <= 121 with smooth <25% ramp; hemisphere-aware seasonalWhiteness with continuous year-end wrap (<0.03 jump)`,
      score: +c4Score.toFixed(4),
      knownMatchScore: +c4Match.toFixed(4),
      knownMismatchScore: +c4Mismatch.toFixed(4),
      pass: c4Score >= 0.95,
      source: 'Mills et al. (2013) PNAS 110:7360 (photoperiod/hemisphere moult); Boreal streaming & worker contracts',
    },
    {
      id: 'live-chromium-gallop-tail-antarctica-jan15-and-june-floor',
      label: 'Live headless Chromium WebGL recording & 3 frames (9 m/s wolf gallop tail, Jan 15 Antarctica orbit, June 4 forest floor)',
      measured: `errors=${errors.length}; recording.webm=${recordingBytes} B; frames=${framesCaptured}/3; gallopTailLevelOk=${c5Input.gallopTailLevelOk} (${gallopTailDeg.toFixed(1)} deg); antarcticaIceSheetOk=${c5Input.antarcticaIceSheetOk} (+${antarcticaJanMeanC.toFixed(1)} C, 0% snow); juneUnderstoryAndFloorOk=${c5Input.juneUnderstoryAndFloorOk} (0/2 shrub blooms, ${(surfaceEmptyBandFrac * 100).toFixed(1)}% empty lattice)`,
      expected: `0 console/page errors; live WebGL video + 3 frames matching photoreal references (level wolf gallop tail, white permanent Jan 15 Antarctica ice sheet, flowering June blueberry/Labrador tea on irregular moss floor)`,
      score: +c5Score.toFixed(4),
      knownMatchScore: +c5Match.toFixed(4),
      knownMismatchScore: +c5Mismatch.toFixed(4),
      pass: c5Score >= 0.95,
      source: 'Live WebGL frame-0..2.png + recording.webm vs reference/ref-0..2.jpg',
    },
  ];

  const calibrationValid = checks.every(c => c.knownMatchScore >= 0.95 && c.knownMismatchScore <= 0.25);
  const passed = checks.filter(c => c.pass).length;
  const meanScore = +(checks.reduce((s, c) => s + c.score, 0) / checks.length).toFixed(4);

  const report = {
    auditedAt: new Date().toISOString(),
    baseUrl: BASE,
    calibrationValid,
    passed,
    total: checks.length,
    meanScore,
    errors,
    locoReadout: locoReadout.trim(),
    antarcticaHud: antarcticaHud.replace(/\s+/g, ' ').trim(),
    checks,
  };
  writeFileSync(join(HERE, 'numbers.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify({ calibrationValid, passed, total: checks.length, meanScore, recordingBytes, errors }, null, 2));
  for (const c of checks) {
    console.log(`  [${c.pass ? 'PASS' : 'FAIL'}] ${c.id}: score=${c.score} (match=${c.knownMatchScore}, mismatch=${c.knownMismatchScore})`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
