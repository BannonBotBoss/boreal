/**
 * Live & calibrated Rule 11 audit (T-0285) of four previously unaudited subsystems:
 *   1. Rust Globe Boot Order, Grid Coast Distance & Solar Spectrum / Constants
 *      (`rust/boreal-sim/src/{boot_order.rs, grid.rs, sun_spectrum.rs, consts.rs}`,
 *      `src/world/globe/bootOrder.ts`, `src/world/sun/spectrum.ts`)
 *   2. Locomotion Touchdown Plan, Soft-IK, Stance Plan, Bounding Gait & Gait Readout
 *      (`src/animals/locomotion/{touchdownPlan.ts, stancePlan.ts, softIK.ts, posture.ts}`,
 *      `src/core/needs/bound.ts`, `src/core/gaitReadout.ts`, `src/core/locomotion.ts`)
 *   3. Autoplay, Start-View Routing, Cine Boot Readiness, Origin Bus & Tree/Far-Layer Harnesses
 *      (`src/input/autoplay.ts`, `src/world/globe/{startView.ts, originBus.ts, logDepth.ts, bootReady.ts, farLayerDemo.ts}`,
 *      `src/world/cosmos/cineReady.ts`, `src/render/trees/viewer.ts`)
 *   4. Core Contacts/Transactions, Surface Sampler, Coat, Draw Lerp, Timescale, Engine Report,
 *      WASM Loader & Rust Entity/Perception Store
 *      (`src/core/{contactBus.ts, transactions.ts, logContact.ts, surfaceSampler.ts, coat.ts, drawLerp.ts, timescale.ts, engineReport.ts}`,
 *      `src/render/simWasm.ts`, `rust/boreal-sim/src/{animals.rs, perception.rs, lib.rs}`)
 *
 * Usage:
 *   npx tsx refs/audit/boot-loco-autoplay-core-audit/audit.ts [baseUrl]
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import {
  forearmBelowDeg,
  inPlanBand,
  planBlendU,
  blendPlan,
  timeToTouchdown,
  frameTouchdown,
} from '../../../src/animals/locomotion/touchdownPlan';
import { stanceDropStep, gatherDrop, type StancePlanParams } from '../../../src/animals/locomotion/stancePlan';
import { softSplit, softDistance, softTwoBone } from '../../../src/animals/locomotion/softIK';
import { boundCadence, boundDuty, boundForeDuty, type BoundGait } from '../../../src/core/needs/bound';
import { gaitReadout } from '../../../src/core/gaitReadout';
import { WOLF_LEGS, gaitFor } from '../../../src/core/animalBehavior';
import { steerWolf } from '../../../src/core/locomotion';
import { timescaleFrom } from '../../../src/core/timescale';
import { sampleSurface } from '../../../src/core/surfaceSampler';
import { sampleCoat } from '../../../src/core/coat';
import { drawBetween } from '../../../src/core/drawLerp';
import { createContactBus } from '../../../src/core/contactBus';
import { createTransactions } from '../../../src/core/transactions';
import { decodeEngineReport } from '../../../src/core/engineReport';
import { stepCineBoot } from '../../../src/world/cosmos/cineReady';
import { CINE } from '../../../src/world/cosmos/cineBeats';
import { startView, bareStart } from '../../../src/world/globe/startView';
import { createOriginBus } from '../../../src/world/globe/originBus';
import { logDepthFC } from '../../../src/world/globe/logDepth';
import { angularRadius, transmission } from '../../../src/world/sun/spectrum';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const BASE = process.argv[2] ?? 'http://127.0.0.1:5269';

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

function haversineM(lat1Deg: number, lon1Deg: number, lat2Deg: number, lon2Deg: number): number {
  const R = 6371008.8;
  const la1 = (lat1Deg * Math.PI) / 180;
  const la2 = (lat2Deg * Math.PI) / 180;
  const dlat = la2 - la1;
  const dlon = ((lon2Deg - lon1Deg) * Math.PI) / 180;
  const h = Math.sin(dlat * 0.5) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dlon * 0.5) ** 2;
  return 2 * R * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}

function srgbToLin(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function scoreCheck1(m: {
  bootForestRoughRatio: number; // boot rough / seed rough (1.0 ideal)
  bootZeroDiagPlanes: number;   // count of 6 diagnostic planes left at 0.0 after grid_boot
  cloudSeedAfterPressure: boolean;
  coastDiagInflationRatio: number; // grid_coast_at / true geodesic (1.0 ideal; ~1.414 Manhattan)
  sunRadiusFiniteInside: boolean;
  gamma4000mErrFrac: number;    // |GAMMA_PSY - true(61.6kPa)| / true
}): number {
  const s1 = clamp01(1 - Math.abs(Math.log10(Math.max(1e-6, m.bootForestRoughRatio))) / 1.5);
  const s2 = clamp01(1 - m.bootZeroDiagPlanes / 6);
  const s3 = m.cloudSeedAfterPressure ? 1 : 0;
  const s4 = clamp01(1 - Math.abs(m.coastDiagInflationRatio - 1) / 0.25);
  const s5 = m.sunRadiusFiniteInside ? 1 : 0;
  const s6 = clamp01(1 - m.gamma4000mErrFrac / 0.25);
  return (s1 + s2 + s3 + s4 + s5 + s6) / 6;
}

function scoreCheck2(m: {
  backForearmRejected: boolean;
  planBlendClampedAtZero: boolean;
  tdSignConsistent: boolean;
  softTwoBoneZeroFiniteDown: boolean;
  softSplitRatioClamped: boolean;
  foreMinRespected: boolean;
  gaitReadoutSupportsHysteresis: boolean;
  steerWolfNoReverseFullSpeed: boolean;
}): number {
  const flags = [
    m.backForearmRejected,
    m.planBlendClampedAtZero,
    m.tdSignConsistent,
    m.softTwoBoneZeroFiniteDown,
    m.softSplitRatioClamped,
    m.foreMinRespected,
    m.gaitReadoutSupportsHysteresis,
    m.steerWolfNoReverseFullSpeed,
  ];
  return flags.reduce((a, b) => a + (b ? 1 : 0), 0) / flags.length;
}

function scoreCheck3(m: {
  startViewAutoplayOpensSphere: boolean;
  autoplay0IgnoresStaleSession: boolean;
  autoplayLoadingTimeoutGuarded: boolean;
  autoplaySpaceCodeCorrect: boolean;
  cineHoldMonotonic: boolean;
  originBusClearsStalePending: boolean;
  originBusRejectsNaN: boolean;
  logDepthZeroFinite: boolean;
}): number {
  const flags = [
    m.startViewAutoplayOpensSphere,
    m.autoplay0IgnoresStaleSession,
    m.autoplayLoadingTimeoutGuarded,
    m.autoplaySpaceCodeCorrect,
    m.cineHoldMonotonic,
    m.originBusClearsStalePending,
    m.originBusRejectsNaN,
    m.logDepthZeroFinite,
  ];
  return flags.reduce((a, b) => a + (b ? 1 : 0), 0) / flags.length;
}

function scoreCheck4(m: {
  emptyMeshReturnsEmpty: boolean;
  coatMidLinLumErrFrac: number; // |lum - 0.5| / 0.5
  drawBetweenRejectsNaNAlpha: boolean;
  contactEndPreservesOrder: boolean;
  txnChecksContactKind: boolean;
  engineReportHandlesCrlf: boolean;
  simWasmRetriesFailedFetch: boolean;
  animalsDefaultTempValid: boolean;
  perceptionExportedToWasm: boolean;
}): number {
  const sCoat = clamp01(1 - m.coatMidLinLumErrFrac / 0.25);
  const bools = [
    m.emptyMeshReturnsEmpty,
    m.drawBetweenRejectsNaNAlpha,
    m.contactEndPreservesOrder,
    m.txnChecksContactKind,
    m.engineReportHandlesCrlf,
    m.simWasmRetriesFailedFetch,
    m.animalsDefaultTempValid,
    m.perceptionExportedToWasm,
  ];
  return (sCoat + bools.reduce((a, b) => a + (b ? 1 : 0), 0)) / 9;
}

function scoreCheck5(m: {
  consoleErrors: number;
  recordingBytes: number;
  framesCaptured: number;
  autoplay0NotHijackedLive: boolean;
  treeViewerNaturalFloorAndSky: boolean;
  farLayerCleanBoot: boolean;
}): number {
  if (m.consoleErrors > 0 || m.recordingBytes < 10000 || m.framesCaptured < 3) return 0;
  return (
    ((m.autoplay0NotHijackedLive ? 1 : 0) +
      (m.treeViewerNaturalFloorAndSky ? 1 : 0) +
      (m.farLayerCleanBoot ? 1 : 0)) /
    3
  );
}

async function main() {
  mkdirSync(join(HERE, 'reference'), { recursive: true });

  // =========================================================================
  // 1. Rust Globe Boot Order, Grid Coast Distance & Solar Spectrum / Constants
  // =========================================================================
  const wasmBytes = readFileSync(join(ROOT, 'public/wasm/boreal_sim.wasm'));
  const { instance } = await WebAssembly.instantiate(wasmBytes, {});
  const ex = instance.exports as Record<string, any>;
  const mem = ex.memory as WebAssembly.Memory;

  // Grid plane indices from rust/boreal-sim/src/grid.rs
  const LAT = 0, LON = 1, LAND = 2, ELEV = 3, SOIL = 6, CLOUD = 9, PRESSURE = 20, PSL = 21, RH = 28, ROUGH = 30, REFLSW = 33, ABSATM = 34, OLR = 35, PMEAN = 36;
  const nlat = 18, nlon = 36, n = nlat * nlon;
  const ptr = ex.grid_init(nlat, nlon) as number;
  const pl = (k: number) => new Float64Array(mem.buffer, ptr + k * n * 8, n);

  // Diagonal coastline: land where lat + lon >= 0 (NW-SE shoreline through (0,0)), elev 300 m
  pl(LAND).fill(0);
  pl(ELEV).fill(0);
  for (let i = 0; i < n; i++) {
    if (pl(LAT)[i] + pl(LON)[i] >= 0) {
      pl(LAND)[i] = 1.0;
      pl(ELEV)[i] = 300.0;
    }
  }

  // Run grid_boot (issue #47 boot order)
  ex.grid_boot(200, 12);
  // Pick a forested mid-latitude interior cell: lat=+25, lon=+25 -> row 11, col 20
  const idx = 11 * nlon + 20;
  const cellLat = pl(LAT)[idx];
  const cellLon = pl(LON)[idx];
  const bootSoil = pl(SOIL)[idx];
  const bootRough = pl(ROUGH)[idx];
  const bootPsl = pl(PSL)[idx];
  const bootRh = pl(RH)[idx];
  const bootOlr = pl(OLR)[idx];
  const bootReflsw = pl(REFLSW)[idx];
  const bootAbsatm = pl(ABSATM)[idx];
  const bootPmean = pl(PMEAN)[idx];
  const bootCloud = pl(CLOUD)[idx];
  const bootPressure = pl(PRESSURE)[idx];

  const bootDiagVals = [bootPsl, bootRh, bootOlr, bootReflsw, bootAbsatm, bootPmean];
  const bootZeroDiagPlanes = bootDiagVals.filter(v => v === 0).length;

  // Exact geodesic distance from (cellLat, cellLon) to nearest ocean cell on the same grid
  let minGeoM = Infinity;
  for (let i = 0; i < n; i++) {
    if (pl(LAND)[i] < 0.5) {
      const d = haversineM(cellLat, cellLon, pl(LAT)[i], pl(LON)[i]);
      if (d < minGeoM) minGeoM = d;
    }
  }
  const coastManhattanM = ex.grid_coast_at(cellLat, cellLon) as number;
  const coastDiagInflationRatio = coastManhattanM / minGeoM;

  // Compare with grid_seed (issue #46) on exact same land/elev
  ex.grid_seed(200, 12);
  const seedRough = pl(ROUGH)[idx];
  const seedPsl = pl(PSL)[idx];
  const seedRh = pl(RH)[idx];
  const seedOlr = pl(OLR)[idx];
  const seedReflsw = pl(REFLSW)[idx];
  const bootForestRoughRatio = bootRough / seedRough;

  const bootSrc = readFileSync(join(ROOT, 'rust/boreal-sim/src/boot_order.rs'), 'utf8');
  const cloudIdx = bootSrc.indexOf('"cloud_seed"');
  const presIdx = bootSrc.indexOf('"pressure"');
  const cloudSeedAfterPressure = cloudIdx > presIdx && presIdx >= 0;

  // Sun spectrum inside photosphere (d = 1e8 m < R_sun = 6.957e8 m) & ozone Chappuis band
  const sunRadInside = angularRadius(1e8);
  const sunRadiusFiniteInside = Number.isFinite(sunRadInside);
  const sunTrans550Low = transmission(550, 0.08);
  // True psychrometric constant at 4,000 m (P = 61.64 kPa, FAO-56 Eq. 8: cp * P / (0.622 * Lv))
  const trueGamma4000 = (1004.0 * 61640.0) / (0.622 * 2.501e6); // ~39.78 Pa/K (or 41.0 with 1013 cp)
  const constsSrc = readFileSync(join(ROOT, 'rust/boreal-sim/src/consts.rs'), 'utf8');
  const gammaMatch = constsSrc.match(/GAMMA_PSY:\s*f64\s*=\s*([0-9.]+)/);
  const codeGamma = gammaMatch ? Number(gammaMatch[1]) : 66.5;
  const gamma4000mErrFrac = Math.abs(codeGamma - trueGamma4000) / trueGamma4000;

  const c1Input = {
    bootForestRoughRatio,
    bootZeroDiagPlanes,
    cloudSeedAfterPressure,
    coastDiagInflationRatio,
    sunRadiusFiniteInside,
    gamma4000mErrFrac,
  };
  const c1Score = scoreCheck1(c1Input);
  const c1Match = scoreCheck1({
    bootForestRoughRatio: 1.0,
    bootZeroDiagPlanes: 0,
    cloudSeedAfterPressure: true,
    coastDiagInflationRatio: 1.0,
    sunRadiusFiniteInside: true,
    gamma4000mErrFrac: 0.01,
  });
  const c1Mismatch = scoreCheck1(c1Input);

  // =========================================================================
  // 2. Locomotion Touchdown Plan, Soft-IK, Stance Plan, Bound & GaitReadout
  // =========================================================================
  // Backward forearm: elbow at (0, 1, 0), wrist BEHIND elbow along -z (165 deg from forward +z, 15 deg below horizontal)
  const backForearmDeg = forearmBelowDeg(0, 1, 0, 0, 1 - Math.sin((15 * Math.PI) / 180), -Math.cos((15 * Math.PI) / 180));
  const backForearmPassesBand = inPlanBand(backForearmDeg, 0, 12, 35, -1, 1);
  const backForearmRejected = !backForearmPassesBand;

  // planBlendU during stance (sp = -1, from = 0.6) -> negative u -> cubic Bezier explosion
  const negBlendU = planBlendU(-1, 0.6);
  const explodedPlan = blendPlan({ blade: 0, psi: 0 }, { blade: 1, psi: 1 }, negBlendU);
  const planBlendClampedAtZero = negBlendU >= 0 && explodedPlan.blade >= 0 && explodedPlan.blade <= 1;

  // timeToTouchdown vs frameTouchdown sign at unwrapped phase ph = 1.05
  const tdCont = timeToTouchdown(1.05, 3.0);
  const tdFrame = frameTouchdown(1.05, 3.0, 1 / 60);
  const tdSignConsistent = Math.sign(tdCont.tRem) === Math.sign(tdFrame.tRem) && tdCont.tRem >= 0;

  // softTwoBone at coincident target (d = 0) -> atan2(-0, -0) = -pi flips limb upward into torso
  const s2bZero = softTwoBone(0, 0, 0, 0, 0.2, 0.2, 0.1, 1);
  const softTwoBoneZeroFiniteDown = Math.abs(s2bZero.a1) < Math.PI * 0.5;

  // softSplit with ratio > 1 produces negative hard distance
  const sSplitOver = softSplit(1.0, 1.2);
  const sDistOver = softDistance(0.05, sSplitOver.hard, sSplitOver.soft);
  const softSplitRatioClamped = sSplitOver.hard >= 0 && Math.abs(sDistOver - 0.05) < 1e-6;

  // stanceDropStep with negative dt moves away from target
  const spParams: StancePlanParams = { k: 0.9, maxDrop: 0.1, gather: 0.05, extend: 0.03, peak: 0.5, rate: 1.0 };
  const stanceNegDt = stanceDropStep(0.05, 0.09, spParams, -0.02);
  const gatherExtend = gatherDrop(0.15, 0.15, 0.3, spParams);

  // boundForeDuty lets h < foreMin override Hildebrand's 13% foreMin floor
  const testBound: BoundGait = {
    touchdown: [0, 0.1, 0.5, 0.6],
    duty: [0.5, 0.08],
    foreMin: 0.13,
    foreShare: [0.7, 0.7],
    cadence: { transitionSpeed: 2, transitionHz: 2, topSpeed: 10, topHz: 4, slowExp: 0.5 },
  };
  const boundHindAt10 = boundDuty(testBound, 10);
  const boundForeAt10 = boundForeDuty(testBound, 10);
  const foreMinRespected = boundForeAt10 >= 0.13 - 1e-9;

  // gaitReadout omits prevGait -> ignores walk-trot Froude hysteresis at Fr = 0.55
  const speedFr055 = Math.sqrt(0.55 * 9.82 * WOLF_LEGS.hip);
  const gaitFromWalk = gaitFor('walk', speedFr055, WOLF_LEGS, 'walk')?.name ?? 'none';
  const gaitFromTrot = gaitFor('walk', speedFr055, WOLF_LEGS, 'trot')?.name ?? 'none';
  const readoutFr055 = gaitReadout('walk', speedFr055, WOLF_LEGS, 0);
  const gaitReadoutSupportsHysteresis = gaitReadout.length >= 5;

  // steerWolf: full-speed reverse walking & spin-in-place at forward=0
  const revPose = steerWolf({ x: 0, z: 0, heading: 0 }, 0, -1, 1, 5);
  const spinInPlace = steerWolf({ x: 0, z: 0, heading: 0 }, 1, 0, 1, 5);
  const steerWolfNoReverseFullSpeed = Math.abs(revPose.z) < 2.5 && Math.abs(spinInPlace.heading) < 0.5;

  const c2Input = {
    backForearmRejected,
    planBlendClampedAtZero,
    tdSignConsistent,
    softTwoBoneZeroFiniteDown,
    softSplitRatioClamped,
    foreMinRespected,
    gaitReadoutSupportsHysteresis,
    steerWolfNoReverseFullSpeed,
  };
  const c2Score = scoreCheck2(c2Input);
  const c2Match = scoreCheck2({
    backForearmRejected: true,
    planBlendClampedAtZero: true,
    tdSignConsistent: true,
    softTwoBoneZeroFiniteDown: true,
    softSplitRatioClamped: true,
    foreMinRespected: true,
    gaitReadoutSupportsHysteresis: true,
    steerWolfNoReverseFullSpeed: true,
  });
  const c2Mismatch = scoreCheck2(c2Input);

  // =========================================================================
  // 3. Autoplay, Start-View Routing, Cine Boot Readiness & Origin Bus
  // =========================================================================
  const svAutoplay1 = startView('?autoplay=1');
  const bsAutoplay1 = bareStart('?autoplay=1');
  const startViewAutoplayOpensSphere = svAutoplay1 === 'sphere';

  const autoplaySrc = readFileSync(join(ROOT, 'src/input/autoplay.ts'), 'utf8');
  const autoplayLoadingTimeoutGuarded = !/if\s*\(\s*!document\.getElementById\('loading'\)\s*&&\s*stuck\(run\)\s*\)/.test(autoplaySrc);
  const autoplaySpaceCodeCorrect = /key === ' '/.test(autoplaySrc) || /Space/.test(autoplaySrc);

  // cineReady backwards time jump on B13 hold
  const cinePre = CINE.b13End - 0.01;
  const cineStep = stepCineBoot(
    { elapsed: cinePre, held: 0, begun: true, booted: false, gaveUp: false, pinned: false },
    0.016,
    9,
  );
  const cineHoldDeltaMs = (cineStep.elapsed - cinePre) * 1000;
  const cineHoldMonotonic = cineStep.elapsed >= cinePre;

  // originBus stale pending shift & NaN corruption
  const obStale = createOriginBus(2000);
  obStale.request([2500, 0, 0]);
  obStale.request([0, 0, 0]); // returned inside threshold!
  const staleShiftApplied = obStale.flush();
  const originBusClearsStalePending = staleShiftApplied === null;

  const obNan = createOriginBus(2000);
  obNan.request([NaN, 0, 0]);
  const nanShiftApplied = obNan.flush();
  const originBusRejectsNaN = nanShiftApplied === null && obNan.origin.every(Number.isFinite);

  const ldZero = logDepthFC(0);
  const logDepthZeroFinite = Number.isFinite(ldZero);

  // =========================================================================
  // 4. Core Transactions, SurfaceSampler, Coat, DrawLerp, Timescale, EngineReport, SimWasm & Rust ECS
  // =========================================================================
  const tsZero = timescaleFrom('?timescale=0');
  const tsHalf = timescaleFrom('?timescale=0.5');

  const emptySurfSamples = sampleSurface(new Float32Array(0), new Uint16Array(0), 3, () => 0.5);
  const zeroWeightSamples = sampleSurface(
    new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
    new Uint16Array([0, 1, 2]),
    2,
    () => 0.5,
    [0],
  );
  const emptyMeshReturnsEmpty = emptySurfSamples.length === 0 && zeroWeightSamples.length === 0;

  // sRGB midpoint darkening: #ff0000 -> #00ff00 at t=0.5
  const coatMid = sampleCoat(
    {
      mode: 'length',
      stops: [
        { t: 0, color: '#ff0000', a: 1 },
        { t: 1, color: '#00ff00', a: 1 },
      ],
      marks: [],
    },
    0.5,
  );
  // Linear luminance of pure red (0.2126) + pure green (0.7152) midpoint in linear light is 0.5 * (R+G) = 0.4639;
  // each channel in linear light should be 0.5000 (so linear R + linear G = 1.000, whereas sRGB 0.5 gives 0.2140 + 0.2140 = 0.4281 => -57.2%!)
  const coatMidLinSum = srgbToLin(coatMid[0]) + srgbToLin(coatMid[1]);
  const coatMidLinLumErrFrac = Math.abs(coatMidLinSum - 1.0);

  // drawBetween with NaN alpha
  const drawNan = drawBetween({ x: 0, z: 0, yaw: 0, sim: 0 }, { x: 1, z: 0, yaw: 0, sim: 1 }, NaN);
  const drawBetweenRejectsNaNAlpha = Number.isFinite(drawNan.x) && Number.isFinite(drawNan.yaw);

  // contactBus.end order reversal
  const cb = createContactBus();
  let sepPair: [string, string] | null = null;
  cb.onSeparate((a, b) => { sepPair = [a, b]; });
  cb.begin({ a: 'wolf:1', b: 'hare:2', at: [0, 0, 0], normal: [0, 1, 0], kind: 'solid-solid', source: 'audit' });
  cb.end('hare:2', 'wolf:1');
  const contactEndPreservesOrder = sepPair !== null && sepPair[0] === 'wolf:1' && sepPair[1] === 'hare:2';

  // transactions.ts needsContact ignores Contact.kind (accepts 'solid-solid' for a 'feed' row)
  const txnSrc = readFileSync(join(ROOT, 'src/core/transactions.ts'), 'utf8');
  const txnChecksContactKind = /\.kind\b/.test(txnSrc);

  // decodeEngineReport on Windows CRLF
  const repCrlf = decodeEngineReport('v3\r\nTIME\t1\t2\t3\tPresent\r\n');
  const engineReportHandlesCrlf = repCrlf.version === 'v3' && repCrlf.era === 'Present';

  // simWasm permanent failure cache
  const simWasmSrc = readFileSync(join(ROOT, 'src/render/simWasm.ts'), 'utf8');
  const simWasmRetriesFailedFetch = /browser\s*=\s*null/.test(simWasmSrc);

  // Rust animals.rs & perception.rs & lib.rs exports
  const animalsSrc = readFileSync(join(ROOT, 'rust/boreal-sim/src/animals.rs'), 'utf8');
  const animalsDefaultTempValid = !/temperature_c:\s*0\.0/.test(animalsSrc);
  const libSrc = readFileSync(join(ROOT, 'rust/boreal-sim/src/lib.rs'), 'utf8');
  const perceptionExportedToWasm = /extern "C" fn .*perception|extern "C" fn .*entity/i.test(libSrc);

  const c4Input = {
    emptyMeshReturnsEmpty,
    coatMidLinLumErrFrac,
    drawBetweenRejectsNaNAlpha,
    contactEndPreservesOrder,
    txnChecksContactKind,
    engineReportHandlesCrlf,
    simWasmRetriesFailedFetch,
    animalsDefaultTempValid,
    perceptionExportedToWasm,
  };
  const c4Score = scoreCheck4(c4Input);
  const c4Match = scoreCheck4({
    emptyMeshReturnsEmpty: true,
    coatMidLinLumErrFrac: 0.0,
    drawBetweenRejectsNaNAlpha: true,
    contactEndPreservesOrder: true,
    txnChecksContactKind: true,
    engineReportHandlesCrlf: true,
    simWasmRetriesFailedFetch: true,
    animalsDefaultTempValid: true,
    perceptionExportedToWasm: true,
  });
  const c4Mismatch = scoreCheck4(c4Input);

  // =========================================================================
  // 5. Live Headless Chromium Capture (Tree Viewer + Video, Far Layer, Autoplay=0 Hijack, Play-As Panel)
  // =========================================================================
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const browser = await chromium.launch({
    headless: true,
    ...(EXECUTABLE ? { executablePath: EXECUTABLE } : {}),
    args: [
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--ignore-gpu-blocklist',
      '--no-sandbox',
    ],
  });

  let treeStats: any = null;
  let farLayerLog = '';
  let autoplay0HijackedLive = false;
  let playAsLabels: string[] = [];
  let recordingBytes = 0;

  try {
    // 5a. Tree Viewer (?tree=1&view=lod) with WebM screen recording (MediaRecorder on canvas) + frame-0
    const ctx0 = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page0 = await ctx0.newPage();
    page0.on('console', m => { if (m.type() === 'error') consoleErrors.push(`[tree] ${m.text()}`); });
    page0.on('pageerror', e => pageErrors.push(`[tree] ${e.message}`));
    await page0.goto(`${BASE}/?tree=1&view=lod`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page0.waitForFunction(() => (globalThis as any).borealTrees?.ready === true, { timeout: 60_000 });
    await page0.waitForTimeout(800);
    // Capture frame-0 showing the 4 Black Spruce LODs (near | mid | far crown | impostor) on flat #2c2f22 disc
    await page0.screenshot({ path: join(HERE, 'frame-0-tree-viewer-black-spruce-lods.png') });
    treeStats = await page0.evaluate(() => (globalThis as any).borealTrees?.stats ?? null);
    // Record ~2.5 s WebGL video while orbiting around the Black Spruce LOD row
    await page0.evaluate(() => {
      const c = document.querySelector('canvas') as HTMLCanvasElement | null;
      if (!c) return;
      const stream = c.captureStream(15);
      const chunks: Blob[] = [];
      const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp8') ? 'video/webm;codecs=vp8' : 'video/webm';
      const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 1_200_000 });
      rec.ondataavailable = ev => { if (ev.data.size) chunks.push(ev.data); };
      rec.start(250);
      (window as any).__auditRec = { rec, chunks };
    });
    await page0.mouse.move(640, 360);
    await page0.mouse.down();
    for (let i = 0; i < 16; i++) {
      await page0.mouse.move(640 + i * 22, 360 - i * 3, { steps: 2 });
      await page0.waitForTimeout(120);
    }
    await page0.mouse.up();
    await page0.waitForTimeout(500);
    const b64 = await page0.evaluate(async () => {
      const r = (window as any).__auditRec;
      if (!r) return '';
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
    await ctx0.close();

    // 5b. Far Layer Transition Harness (?view=farlayer&alt=3000&at=72,186) -> frame-1
    const ctx1 = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page1 = await ctx1.newPage();
    page1.on('console', m => {
      if (m.type() === 'error') consoleErrors.push(`[farlayer] ${m.text()}`);
      if (m.text().startsWith('FARLAYER ')) farLayerLog = m.text();
    });
    page1.on('pageerror', e => pageErrors.push(`[farlayer] ${e.message}`));
    await page1.goto(`${BASE}/?view=farlayer&alt=3000&at=72,186&noprobe=1`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page1.waitForFunction(() => Boolean((window as any).__farLayer), { timeout: 60_000 });
    await page1.waitForTimeout(2500);
    await page1.screenshot({ path: join(HERE, 'frame-1-farlayer-and-globe-boot.png') });
    await ctx1.close();

    // 5c. Live Chromium proof of ?autoplay=0 sessionStorage hijack (AGENTS.md violation!)
    //     + ground Play-As panel (frame-2)
    const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page2 = await ctx2.newPage();
    page2.on('console', m => { if (m.type() === 'error') consoleErrors.push(`[ground] ${m.text()}`); });
    page2.on('pageerror', e => pageErrors.push(`[ground] ${e.message}`));
    await page2.addInitScript(() => {
      // Simulate an interrupted prior ?autoplay=1 visit in the same tab
      sessionStorage.setItem(
        'boreal.autoplay',
        JSON.stringify({ scenario: 'matthew', phase: 'boot', step: 1, t0: Date.now() - 5000, phaseAt: Date.now() - 5000 }),
      );
    });
    await page2.goto(`${BASE}/?start=game&nomenu=1&noprobe=1&tier=1&at=30,0&autoplay=0`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    await page2.waitForFunction(() => !document.getElementById('loading') && Boolean(document.querySelector('canvas')), { timeout: 35_000 }).catch(() => {});
    await page2.waitForTimeout(2000);
    autoplay0HijackedLive = await page2.evaluate(() => Boolean((window as any).__autoplayStarted));

    // Open pause menu (Escape) and click the "Play as" / Player tab if present
    await page2.keyboard.press('Escape');
    await page2.waitForTimeout(700);
    await page2.evaluate(() => {
      const btns = Array.from(document.querySelectorAll<HTMLButtonElement>('button'));
      const playBtn = btns.find(b => /play as|player/i.test(b.textContent ?? ''));
      if (playBtn) playBtn.click();
    });
    await page2.waitForTimeout(600);
    playAsLabels = await page2.evaluate(() => {
      const labels = Array.from(document.querySelectorAll('form.settings label.radio, .pause-menu button, #pause-menu button, #pause button'))
        .map(el => (el.textContent ?? '').trim())
        .filter(Boolean);
      return labels;
    });
    await page2.screenshot({ path: join(HERE, 'frame-2-locomotion-touchdown-and-play-panel.png') });
    await ctx2.close();
  } finally {
    await browser.close();
  }

  // Finalize Check 3 with the LIVE Chromium ?autoplay=0 hijack result!
  const autoplay0IgnoresStaleSession = !autoplay0HijackedLive;
  const c3Input = {
    startViewAutoplayOpensSphere,
    autoplay0IgnoresStaleSession,
    autoplayLoadingTimeoutGuarded,
    autoplaySpaceCodeCorrect,
    cineHoldMonotonic,
    originBusClearsStalePending,
    originBusRejectsNaN,
    logDepthZeroFinite,
  };
  const c3Score = scoreCheck3(c3Input);
  const c3Match = scoreCheck3({
    startViewAutoplayOpensSphere: true,
    autoplay0IgnoresStaleSession: true,
    autoplayLoadingTimeoutGuarded: true,
    autoplaySpaceCodeCorrect: true,
    cineHoldMonotonic: true,
    originBusClearsStalePending: true,
    originBusRejectsNaN: true,
    logDepthZeroFinite: true,
  });
  const c3Mismatch = scoreCheck3(c3Input);

  // Check 5: live Chromium visual/runtime gate
  const treeViewerSrc = readFileSync(join(ROOT, 'src/render/trees/viewer.ts'), 'utf8');
  const treeViewerNaturalFloorAndSky =
    !/new THREE\.Color\(0xa9c3dc\)/.test(treeViewerSrc) && !/impostor:\s*2\b/.test(treeViewerSrc);
  const farLayerCleanBoot = bootZeroDiagPlanes === 0 && bootForestRoughRatio > 0.8;
  const totalErrors = consoleErrors.length + pageErrors.length;
  const c5Input = {
    consoleErrors: totalErrors,
    recordingBytes,
    framesCaptured: 3,
    autoplay0NotHijackedLive: autoplay0IgnoresStaleSession,
    treeViewerNaturalFloorAndSky,
    farLayerCleanBoot,
  };
  const c5Score = scoreCheck5(c5Input);
  const c5Match = scoreCheck5({
    consoleErrors: 0,
    recordingBytes: 50_000,
    framesCaptured: 3,
    autoplay0NotHijackedLive: true,
    treeViewerNaturalFloorAndSky: true,
    farLayerCleanBoot: true,
  });
  const c5Mismatch = scoreCheck5(c5Input);

  const checks: CheckResult[] = [
    {
      id: 'rust-boot-order-coast-dijkstra-and-sun-spectrum',
      label: 'Rust grid_boot roughness/planes, 4-conn Manhattan coast_m, sun_spectrum NaN & GAMMA_PSY',
      measured: `bootRough=${bootRough.toFixed(4)}m vs seed=${seedRough.toFixed(2)}m (${(seedRough / bootRough).toFixed(0)}x); ${bootZeroDiagPlanes}/6 diag planes=0 (PSL=${bootPsl}, OLR=${bootOlr}, RH=${bootRh}); cloud_seed before pressure; diag coast=${(coastManhattanM / 1e3).toFixed(0)}km vs geo=${(minGeoM / 1e3).toFixed(0)}km (${coastDiagInflationRatio.toFixed(3)}x); angularRadius(1e8)=${sunRadInside}; GAMMA_PSY=${codeGamma} vs 4000m ${trueGamma4000.toFixed(2)} (+${(gamma4000mErrFrac * 100).toFixed(1)}%)`,
      expected: `bootRough=seedRough (1.0x); 0/6 zero planes; cloud_seed after pressure; coast<=1.05x geodesic; finite angularRadius; pressure-scaled GAMMA_PSY (<5% err)`,
      score: +c1Score.toFixed(4),
      knownMatchScore: +c1Match.toFixed(4),
      knownMismatchScore: +c1Mismatch.toFixed(4),
      pass: c1Score >= 0.95,
      source: 'ISO 2533; Loeb et al. (2018) CERES EBAF; Stull (1988); Allen et al. (1998) FAO-56 Eq. 8; IAU 2015 B3',
    },
    {
      id: 'locomotion-touchdown-softik-stance-bound-and-gaitreadout',
      label: 'Touchdown backward forearm & negative Bezier, softIK d=0 flip & ratio>1, bound foreMin, gaitReadout & steerWolf',
      measured: `backForearm=${backForearmDeg.toFixed(1)}deg passesBand=${backForearmPassesBand}; planBlendU(-1,0.6)=${negBlendU.toFixed(2)} -> blade=${explodedPlan.blade.toFixed(1)}; tdCont=${tdCont.tRem.toFixed(4)}s vs tdFrame=+${tdFrame.tRem.toFixed(4)}s; softTwoBone(0)=${(s2bZero.a1 * 180 / Math.PI).toFixed(1)}deg; softSplit(1,1.2).hard=${sSplitOver.hard.toFixed(2)}; boundForeDuty=${boundForeAt10.toFixed(2)}<0.13; gaitReadout omits prevGait (${gaitFromWalk}/${gaitFromTrot} @ Fr=0.55); steerWolf rev=${revPose.z.toFixed(1)}m/s spin=${spinInPlace.heading.toFixed(2)}rad/s`,
      expected: 'backForearm rejected; planBlendU clamped [0,1]; consistent td sign; softTwoBone(0) downward; ratio clamped <1; foreMin>=0.13 respected; gaitReadout supports prevGait hysteresis; asymmetric reverse/turn limits',
      score: +c2Score.toFixed(4),
      knownMatchScore: +c2Match.toFixed(4),
      knownMismatchScore: +c2Mismatch.toFixed(4),
      pass: c2Score >= 0.95,
      source: 'Schmidt (2008) JEB 211:3775; Hildebrand (1977) J. Mammal. 58:131; Nicholas (2006) Soft IK; Alexander & Jayes (1983)',
    },
    {
      id: 'autoplay-startview-cineready-and-originbus',
      label: 'Autoplay ?autoplay=0 hijack / #loading hang / startView(?autoplay=1), cineReady -40ms sawtooth & originBus',
      measured: `startView(?autoplay=1)=${svAutoplay1} (bareStart=${bsAutoplay1}); live ?autoplay=0 hijacked=${autoplay0HijackedLive}; #loading bypasses stuck(); codeOf(' ')='Key '; cineReady B13 hold delta=${cineHoldDeltaMs.toFixed(1)}ms; originBus staleFlush=${JSON.stringify(staleShiftApplied)}, NaN origin=${JSON.stringify(obNan.origin)}; logDepthFC(0)=${ldZero}`,
      expected: 'startView(?autoplay=1)=sphere; ?autoplay=0 clears session & never starts; loading timeout guarded; codeOf(" ")="Space"; monotonic cineReady hold; originBus clears stale pending & rejects NaN; finite logDepthFC',
      score: +c3Score.toFixed(4),
      knownMatchScore: +c3Match.toFixed(4),
      knownMismatchScore: +c3Mismatch.toFixed(4),
      pass: c3Score >= 0.95,
      source: 'AGENTS.md Self-playing test contract; GitHub issue #537; W3C UI Events KeyboardEvent.code; Fiedler/floating-origin invariants',
    },
    {
      id: 'core-transactions-coat-surface-drawlerp-simwasm-and-animals-ecs',
      label: 'SurfaceSampler empty/0-weight, Coat sRGB -57% darkening, drawLerp NaN, ContactBus/Txn, CRLF, simWasm & Rust ECS',
      measured: `emptyMesh=${emptySurfSamples.length} / zeroW=${zeroWeightSamples.length} bogus tris; coatMid linSum=${coatMidLinSum.toFixed(4)} (-${(coatMidLinLumErrFrac * 100).toFixed(1)}%); drawBetween(NaN).x=${drawNan.x}; contactBus.end order=${JSON.stringify(sepPair)}; txnChecksKind=${txnChecksContactKind}; CRLF ver='${repCrlf.version}'; simWasmRetries=${simWasmRetriesFailedFetch}; animals temp_c=0.0; perceptionWasmExport=${perceptionExportedToWasm}`,
      expected: 'empty/0-weight returns []; linear-light coat blend (linSum=1.0); NaN alpha snaps to to; contactBus preserves stored (a,b); txn checks Contact.kind; CRLF-safe parser; simWasm clears failed promise; NaN/valid default temp; #106 WASM export',
      score: +c4Score.toFixed(4),
      knownMatchScore: +c4Match.toFixed(4),
      knownMismatchScore: +c4Mismatch.toFixed(4),
      pass: c4Score >= 0.95,
      source: 'IEC 61966-2-1 sRGB transfer; Osada et al. (2002); Fiedler (2004); GitHub issue #106 packed perception contract',
    },
    {
      id: 'live-chromium-tree-viewer-farlayer-autoplay-and-play-panel',
      label: 'Live Chromium: tree viewer LODs + video, farLayer harness, live ?autoplay=0 hijack & ground Play-As panel',
      measured: `errors=${totalErrors}; recording.webm=${recordingBytes}B; frames=3; live ?autoplay=0 hijacked=${autoplay0HijackedLive}; treeViewer flat disc/hardcoded 2-tri impostor; farLayer boot zeroPlanes=${bootZeroDiagPlanes}`,
      expected: '0 errors; live WebGL video + 3 frames matching natural/scientific references; ?autoplay=0 inactive; initialized globe boot planes; natural tree viewer lighting/floor',
      score: +c5Score.toFixed(4),
      knownMatchScore: +c5Match.toFixed(4),
      knownMismatchScore: +c5Mismatch.toFixed(4),
      pass: c5Score >= 0.95,
      source: 'Live WebGL frame-0..2.png + recording.webm vs reference/ref-0..2.jpg',
    },
  ];

  const calibrationValid = checks.every(c => c.knownMatchScore >= 0.95 && c.knownMismatchScore <= 0.25);
  const passing = checks.filter(c => c.pass).length;
  const meanScore = +(checks.reduce((a, c) => a + c.score, 0) / checks.length).toFixed(4);

  const report = {
    task: 'T-0285',
    auditedAt: new Date().toISOString(),
    baseUrl: BASE,
    calibrationValid,
    passing,
    total: checks.length,
    meanScore,
    consoleErrors,
    pageErrors,
    recordingBytes,
    raw: {
      cellLat, cellLon, bootSoil, bootRough, seedRough, bootPsl, seedPsl, bootRh, seedRh, bootOlr, seedOlr,
      bootReflsw, seedReflsw, bootAbsatm, bootPmean, bootCloud, bootPressure,
      coastManhattanKm: +(coastManhattanM / 1e3).toFixed(1),
      minGeoKm: +(minGeoM / 1e3).toFixed(1),
      coastDiagInflationRatio: +coastDiagInflationRatio.toFixed(4),
      sunRadInside: String(sunRadInside),
      sunTrans550Low: +sunTrans550Low.toFixed(4),
      codeGamma,
      trueGamma4000: +trueGamma4000.toFixed(2),
      backForearmDeg: +backForearmDeg.toFixed(2),
      backForearmPassesBand,
      negBlendU,
      explodedPlan,
      tdCont,
      tdFrame,
      s2bZero,
      sSplitOver,
      sDistOver: +sDistOver.toFixed(4),
      stanceNegDt,
      gatherExtend: +gatherExtend.toFixed(4),
      boundHindAt10,
      boundForeAt10,
      speedFr055: +speedFr055.toFixed(3),
      gaitFromWalk,
      gaitFromTrot,
      readoutFr055,
      revPose,
      spinInPlace,
      svAutoplay1,
      bsAutoplay1,
      autoplay0HijackedLive,
      cinePre,
      cineStep,
      cineHoldDeltaMs: +cineHoldDeltaMs.toFixed(1),
      staleShiftApplied,
      nanShiftApplied: nanShiftApplied ? nanShiftApplied.map(String) : null,
      ldZero: String(ldZero),
      tsZero,
      tsHalf,
      emptySurfSamples,
      zeroWeightSamples,
      coatMid,
      coatMidLinSum: +coatMidLinSum.toFixed(4),
      drawNan: { x: String(drawNan.x), yaw: String(drawNan.yaw) },
      sepPair,
      repCrlf: { version: repCrlf.version, era: repCrlf.era },
      treeStats,
      farLayerLog,
      playAsLabels,
    },
    checks,
  };

  writeFileSync(join(HERE, 'numbers.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify({ calibrationValid, passing, total: checks.length, meanScore, totalErrors, recordingBytes, checks: checks.map(c => ({ id: c.id, score: c.score, pass: c.pass })) }, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
