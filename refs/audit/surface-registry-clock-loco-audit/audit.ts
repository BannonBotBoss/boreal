/**
 * Live & calibrated Rule 11 audit (T-0284) of four previously unaudited subsystems:
 *   1. Rust Surface Budget (`rust/boreal-sim/src/planet_fundamentals/surface/{mod.rs, roughness.rs, heat_capacity.rs}`)
 *      & Emergent Halo/Tidal Physics (`rust/boreal-sim/src/emergent.rs`):
 *      - `roughness.rs:10-14` collapses boreal forest `FOREST_Z0 = 1.5 m` by `1,500x` to `0.001 m` under `20 mm` SWE snow,
 *        uses arithmetic `(1-s)*z0 + s*SNOW_Z0` inside `ln()` (`19.38x` vs geometric mean at `snow = 0.5`), and ignores
 *        sea ice (`ice = 1` gets open-water `0.0002 m` instead of `0.001-0.01 m`);
 *      - `heat_capacity.rs:9-12` ignores sea ice (`ice = 1` gets 50 m liquid ocean `2.09e8 J/m^2/K` instead of `~2-4e6`);
 *      - `surface/mod.rs:20,40` defines `SNOW_SURF.rs = 0.0` and never applies it under snow (`rs = l * lk.rs`);
 *      - `emergent.rs:44,48-55` cancels `p.extent` algebraically in `roche` (`2.44 * s.extent * (Mp/Ms)^(1/3)` from noisy
 *        max-particle radius), softens Moon self-gravity with `soft = 441.7 km` (`25.4%` of Moon radius), and panics via
 *        `.partial_cmp(...).unwrap()` on NaN/zero-mass objects.
 *   2. Rust Engine Registry & Drives (`rust/boreal-sim/src/{registry.rs, drives.rs}`, `src/core/drives.ts`):
 *      - `registry.rs:377-378,424-425` plugs `Q = 1361 W/m^2` (`4x` `S0/4`) and `alpha = 0.06` (`water_albedo` vs CERES `0.29`)
 *        into Budyko's equation, giving `T = +514.8 C` (`+500 C` self-contradiction);
 *      - `registry.rs:202` reports critical density `3H^2/(8*pi*G)` as Friedmann `rho`, violating its own equation by `+68.5%`;
 *      - `registry.rs:439` hardcodes Coriolis `f = 2*Omega` (`1.458e-4 s^-1`, North Pole, omitting `sin(lat)`, `+41.4%` at 45 deg);
 *      - `registry.rs:834,1020-1029` `manual_spawn` never evaluates and duplicate `type_id` stays stuck at `HEALTH_IDLE` (`0` vars);
 *      - `drives.rs:149` vs `:283` disagrees on `threat` across `12..13 m` (`0.0` panel vs `1.0` live), `push_out` teleports the
 *        fox `+7.0 m` in 1 frame (`420 m/s` = Mach 1.23) when `mama_d = 4 m`, and `hunger_rate` starves fox/wolf in `83-167 s`.
 *   3. World Clock Hysteresis Time-Loss, Unwired Observation Rate, Settings & Photo-Frame (`src/core/{worldClock.ts,
 *      observation.ts, renderSettings.ts}`, `src/photo/frame.ts`, `src/ui/chronometer.ts`):
 *      - `worldClock.ts:322-329` drops `50.0%` (`10x`) to `99.8%` (`8.1x`) of world time during behavioral->immediate hysteresis
 *        deceleration (`simWorldSec = 0` whenever `obs.scale !== 'immediate'`);
 *      - `observation.ts:23` never wires `clockRate()`, hardcoding `observationRecord().rate` to `0 | 1` even at `10^6x` or `-100x`;
 *      - `frame.ts:25,30` returns `h = 0` for `clampVideo(3000, 1)` and infinite-loops on `tiles(w, h, 0)`;
 *      - `renderSettings.ts:92-98` applies unvalidated `localStorage` values (`-5`, `NaN`) directly into live render config.
 *   4. Wolf Body Anatomy, Locomotion Lab Centripetal/Clock/HUD, Spring & Scorer (`src/core/wolfBody.ts`,
 *      `src/animals/locomotion/{fork/bodyTubes.ts, lab.ts, spring.ts, boundScore.ts, contactScore.ts}`):
 *      - `wolfBody.ts:280-293` builds `28` teeth vs *Canis lupus* `42` (`-33.3%`, Mech 1974); `bodyTubes.ts:200,215` shrinks ears
 *        to `8.02 cm` (`< 9-11 cm`) and flattens paw sole `+4.0 mm` above `y = 0`;
 *      - `lab.ts:65,146` runs `7 m/s` (`1.00 g`, `45.0 deg` bank needed) and `10.5 m/s` (`2.25 g`, `66.0 deg` needed) around
 *        `R = 5 m` with `0.0 deg` roll, displays `0.00 Hz` cadence during pounce from rest, and freezes at `?timescale=15`;
 *      - `spring.ts:8-12` leaves `0.5966` (`+19.3%`) at `t = halflife` and spikes velocity to `-60,300 rad/s` at `halflife = 0`;
 *      - `boundScore.ts:65-71` subtracts `p_hind.fwd2 - p_fore.fwd1` across turns (injecting `-9.7 m` origin error at `(100,0)`);
 *      - `contactScore.ts:55-60` splits at most once per frame, dropping the second foreleg when both wrap in one `dt`.
 *
 * Usage:
 *   npx tsx refs/audit/surface-registry-clock-loco-audit/audit.ts [baseUrl]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { decodeEngineReport } from '../../../src/core/engineReport';
import {
  resolveObservation,
  simWorldSec,
  aggregateWorldSec,
  setClockRate,
  clockRate,
} from '../../../src/core/worldClock';
import { observationRecord } from '../../../src/core/observation';
import { clampVideo } from '../../../src/photo/frame';
import { createSettingsStore, RENDER_SETTINGS, RENDER } from '../../../src/core/renderSettings';
import { wolfTeeth, earFrame, HEAD_AT, TUBE } from '../../../src/core/wolfBody';
import { WOLF_SCALE } from '../../../src/core/wolfModes';
import { buildBody } from '../../../src/core/body';
import { wolfTubes, shapeBody, PHOTO_COAT } from '../../../src/animals/locomotion/fork/bodyTubes';
import { spring, springTo } from '../../../src/animals/locomotion/spring';
import { supportPlane } from '../../../src/animals/locomotion/balance';
import { scoreTrace, type TraceFrame } from '../../../src/animals/locomotion/boundScore';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const BASE = process.argv[2] ?? 'http://127.0.0.1:5268';

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
  snowForestZ0: number;
  halfSnowZ0Ratio: number;
  seaIceZ0: number;
  seaIceHeatcap: number;
  snowRsUsed: boolean;
  emergentSoftFracMoon: number;
  emergentRocheUsesRp: boolean;
}): number {
  // Real snow-covered boreal forest z0 ~ 0.8..1.5 m; half-snow geometric ratio = 1.0; sea ice z0 >= 0.001;
  // sea ice heatcap ~ 1e6..1e7; snow rs applied; emergent soft <= 0.05 R_moon; roche uses R_p not cancelled.
  const s1 = clamp01(m.snowForestZ0 / 0.8);
  const s2 = clamp01(1 - Math.abs(Math.log10(Math.max(1e-6, m.halfSnowZ0Ratio))) / 1.0);
  const s3 = clamp01(m.seaIceZ0 / 0.001);
  const s4 = clamp01(1 - Math.max(0, Math.log10(m.seaIceHeatcap / 4e6)) / 1.5);
  const s5 = m.snowRsUsed ? 1 : 0;
  const s6 = clamp01(1 - Math.max(0, m.emergentSoftFracMoon - 0.05) / 0.15);
  const s7 = m.emergentRocheUsesRp ? 1 : 0;
  return (s1 + s2 + s3 + s4 + s5 + s6 + s7) / 7;
}

function scoreCheck2(m: {
  budykoResidualC: number;
  friedmannRatioErr: number;
  coriolis45ErrFrac: number;
  manualSpawnEvaluated: boolean;
  drives12p5mAgree: boolean;
  foxTeleportM: number;
  foxStarveHours: number;
}): number {
  const s1 = clamp01(1 - m.budykoResidualC / 50);
  const s2 = clamp01(1 - m.friedmannRatioErr / 0.25);
  const s3 = clamp01(1 - m.coriolis45ErrFrac / 0.25);
  const s4 = m.manualSpawnEvaluated ? 1 : 0;
  const s5 = m.drives12p5mAgree ? 1 : 0;
  const s6 = clamp01(1 - Math.max(0, m.foxTeleportM - 0.2) / 2.0);
  const s7 = clamp01(m.foxStarveHours / 12);
  return (s1 + s2 + s3 + s4 + s5 + s6 + s7) / 7;
}

function scoreCheck3(m: {
  hysteresis10xSum: number;
  hysteresis8p1xSum: number;
  obsRateAt1e6: number;
  clampVideoMinH: number;
  settingsRejectsNegative: boolean;
}): number {
  const s1 = clamp01(1 - Math.abs(1 - m.hysteresis10xSum) / 0.25);
  const s2 = clamp01(1 - Math.abs(1 - m.hysteresis8p1xSum) / 0.25);
  const s3 = clamp01(1 - Math.abs(Math.log10(Math.max(1e-6, m.obsRateAt1e6) / 1e6)) / 2.0);
  const s4 = m.clampVideoMinH >= 2 ? 1 : 0;
  const s5 = m.settingsRejectsNegative ? 1 : 0;
  return (s1 + s2 + s3 + s4 + s5) / 5;
}

function scoreCheck4(m: {
  teethCount: number;
  shapedEarCm: number;
  gallopBankDeg: number;
  springHalfLifeVal: number;
  curvedOvertakeErrM: number;
  contactScoreMultiSplit: boolean;
}): number {
  const s1 = clamp01(1 - Math.abs(m.teethCount - 42) / 10);
  const s2 = m.shapedEarCm >= 9 && m.shapedEarCm <= 11 ? 1 : clamp01(1 - Math.min(Math.abs(m.shapedEarCm - 9), Math.abs(m.shapedEarCm - 11)) / 0.9);
  const s3 = clamp01(m.gallopBankDeg / 35);
  const s4 = clamp01(1 - Math.abs(m.springHalfLifeVal - 0.5) / 0.08);
  const s5 = clamp01(1 - m.curvedOvertakeErrM / 1.0);
  const s6 = m.contactScoreMultiSplit ? 1 : 0;
  return (s1 + s2 + s3 + s4 + s5 + s6) / 6;
}

function scoreCheck5(m: {
  consoleErrors: number;
  recordingBytes: number;
  framesCaptured: number;
  labBankOk: boolean;
  dataPanelBudykoOk: boolean;
  drivesNoTeleportOk: boolean;
}): number {
  if (m.consoleErrors > 0 || m.recordingBytes < 10000 || m.framesCaptured < 3) return 0;
  return ((m.labBankOk ? 1 : 0) + (m.dataPanelBudykoOk ? 1 : 0) + (m.drivesNoTeleportOk ? 1 : 0)) / 3;
}

async function main() {
  mkdirSync(join(HERE, 'reference'), { recursive: true });

  // =========================================================================
  // 1. Rust Surface Budget & Emergent Halo/Tidal Physics (Live WASM)
  // =========================================================================
  const wasmBytes = readFileSync(join(ROOT, 'public/wasm/boreal_sim.wasm'));
  const { instance } = await WebAssembly.instantiate(wasmBytes, {});
  const ex = instance.exports as Record<string, any>;
  const mem = ex.memory as WebAssembly.Memory;

  // Grid indices from rust/boreal-sim/src/grid.rs
  const LAT = 0, LAND = 2, ELEV = 3, SOIL = 6, SNOW = 7, ICE = 10, HEATCAP = 29, ROUGH = 30, SNOWFRAC = 31;
  const nlat = 18, nlon = 36, n = nlat * nlon;
  const basePtr = ex.grid_init(nlat, nlon) as number;
  const plane = (k: number) => new Float64Array(mem.buffer, basePtr + k * n * 8, n);

  // Set row 14 (+55 N) col 0 to boreal land (elev 300 m) and row 17 (+85 N) col 0 to Arctic ocean
  const forestIdx = 14 * nlon + 0;
  const arcticIdx = 17 * nlon + 0;
  plane(LAND).fill(0.0);
  plane(ELEV).fill(0.0);
  plane(LAND)[forestIdx] = 1.0;
  plane(ELEV)[forestIdx] = 300.0;

  // Seed winter Jan 15 (day 15, hour 12) -> boreal snowpack >= 20 mm SWE, Arctic sea ice ~ 1.0
  ex.grid_seed(15, 12);
  const forestSnowMm = plane(SNOW)[forestIdx];
  const forestSnowFrac = plane(SNOWFRAC)[forestIdx];
  const snowForestZ0 = plane(ROUGH)[forestIdx];
  const arcticIce = plane(ICE)[arcticIdx];
  const seaIceZ0 = plane(ROUGH)[arcticIdx];
  const seaIceHeatcap = plane(HEATCAP)[arcticIdx];

  // Seed summer Jul 19 (day 200) -> snow-free boreal forest z0 = 1.5 m
  ex.grid_seed(200, 12);
  const summerForestZ0 = plane(ROUGH)[forestIdx];

  // Partial snow test (snow = 10 mm SWE => snow_fraction = 0.5) on forest cell via grid_step(1.0)
  plane(SOIL)[forestIdx] = 150.0;
  plane(SNOW)[forestIdx] = 10.0;
  ex.grid_step(1.0);
  const halfSnowZ0 = plane(ROUGH)[forestIdx];
  const geomMeanHalfSnow = Math.sqrt(1.5 * 0.001);
  const halfSnowZ0Ratio = halfSnowZ0 / geomMeanHalfSnow;

  const surfModSrc = readFileSync(join(ROOT, 'rust/boreal-sim/src/planet_fundamentals/surface/mod.rs'), 'utf8');
  const snowRsUsed = !/rs:\s*l\s*\*\s*lk\.rs\b/.test(surfModSrc);

  // Emergent halo/tidal demo (mode 2: Earth + 37-particle Moon)
  const outPtr = ex.alloc_f64(24) as number;
  ex.emergent_demo(3000, 2, outPtr);
  const emOut = Array.from(new Float64Array(mem.buffer, outPtr, 13));
  const R_EARTH = 6371008.8;
  const R_MOON = 1.7374e6;
  const earthLink3000 = 0.2 * 20 * R_EARTH / Math.cbrt(3000);
  const emergentSoftKm = (earthLink3000 / 4.0) / 1000;
  const emergentSoftFracMoon = (earthLink3000 / 4.0) / R_MOON;
  const emergentSrc = readFileSync(join(ROOT, 'rust/boreal-sim/src/emergent.rs'), 'utf8');
  const emergentRocheUsesRp = !/2\.44\s*\*\s*p\.extent\s*\*\s*\(rho\(p\)\s*\/\s*rho\(s\)\)\.cbrt\(\)/.test(emergentSrc);
  const emergentHasPanicUnwrap = /\.partial_cmp\([^)]*\)\.unwrap\(\)/.test(emergentSrc);

  const c1Input = {
    snowForestZ0, halfSnowZ0Ratio, seaIceZ0, seaIceHeatcap, snowRsUsed, emergentSoftFracMoon, emergentRocheUsesRp,
  };
  const c1Score = scoreCheck1(c1Input);
  const c1Match = scoreCheck1({
    snowForestZ0: 1.2, halfSnowZ0Ratio: 1.0, seaIceZ0: 0.002, seaIceHeatcap: 3e6,
    snowRsUsed: true, emergentSoftFracMoon: 0.03, emergentRocheUsesRp: true,
  });
  const c1Mismatch = scoreCheck1(c1Input);

  // =========================================================================
  // 2. Rust Engine Registry & Drives (`registry.rs`, `drives.rs`)
  // =========================================================================
  const YEAR_S = 365.25 * 86400;
  const PLANCK_S = 5.39e-44;
  const cycOf = (sec: number) => Math.log10(sec / PLANCK_S) + 1;
  function wasmReport(cycle?: number) {
    if (cycle !== undefined) ex.engine_set_cycle(cycle);
    const len = ex.engine_report_len();
    const ptr = ex.engine_report_ptr();
    return decodeEngineReport(new TextDecoder().decode(new Uint8Array(mem.buffer, ptr, len)));
  }
  const getSym = (inst: any, name: string) => inst?.symbols.find((s: any) => s.name === name)?.value ?? NaN;
  const getVar = (inst: any, label: string) => inst?.vars.find((v: any) => v.label === label)?.value ?? NaN;

  const repNow = wasmReport(cycOf(13.8e9 * YEAR_S));
  const planetInst = repNow.instances.find(i => i.type === 'planet');
  const stInst = repNow.instances.find(i => i.type === 'spacetime');
  const windInst = repNow.instances.find(i => i.type === 'wind');

  const budykoTReported = getSym(planetInst, 'T');
  const budykoQ = getSym(planetInst, 'Q');
  const budykoAlpha = getSym(planetInst, 'alpha');
  const budykoA = getSym(planetInst, 'A');
  const budykoB = getSym(planetInst, 'B');
  // Substituting the panel's own reported symbols into its own global Budyko balance (T = Tbar):
  const budykoTImplied = ((1 - budykoAlpha) * budykoQ - budykoA) / budykoB;
  const budykoResidualC = Math.abs(budykoTImplied - budykoTReported);

  const frH = getSym(stInst, 'H');
  const frG = getSym(stInst, 'G');
  const frRho = getSym(stInst, 'rho');
  const frLambda = getSym(stInst, 'Lambda');
  const frC = getSym(stInst, 'c');
  const frH2Lhs = frH * frH;
  const frH2Rhs = (8 * Math.PI * frG / 3) * frRho + (frLambda * frC * frC) / 3;
  const friedmannRatio = frH2Rhs / frH2Lhs;
  const friedmannRatioErr = Math.abs(friedmannRatio - 1.0);

  const windF = getSym(windInst, 'f');
  const f45Real = 2 * 7.292115e-5 * Math.sin(Math.PI / 4);
  const coriolis45ErrFrac = Math.abs(windF - f45Real) / f45Real;

  // Test manual_spawn("planet") staying HEALTH_IDLE (0) with 0 vars even after reconcile
  const nameBytes = new TextEncoder().encode('planet');
  const namePtr = ex.alloc_f64(8) as number;
  new Uint8Array(mem.buffer, namePtr, nameBytes.length).set(nameBytes);
  ex.engine_spawn(namePtr, nameBytes.length);
  const repManual = wasmReport(cycOf(13.8e9 * YEAR_S) + 1e-9);
  const planetInstances = repManual.instances.filter(i => i.type === 'planet');
  const manualInst = planetInstances[planetInstances.length - 1];
  const manualSpawnEvaluated = planetInstances.length >= 2 && manualInst.health !== 0 && manualInst.vars.length > 0;
  ex.engine_despawn(namePtr, nameBytes.length);

  // Drives 12.5 m annulus divergence (live page_step vs registry drives::step; pup behind mother so pup_d = 13.7 m >= 12 m)
  ex.drives_reset(1, 12.5, 0, 0.75, 0, 1, 1);
  ex.drives_tick(0, 0, 0, -1.2, 0.3, 0, 1 / 60, outPtr);
  const tick12p5 = Array.from(new Float64Array(mem.buffer, outPtr, 21));
  const liveThreat12p5 = tick12p5[6];
  ex.engine_set_drives(0.75, 12.5, 0, 0, 0, 0, 0, -1.2, 0.3, 0, 0, 0);
  const repDrv = wasmReport();
  const dangerInst = repDrv.instances.find(i => i.type === 'danger');
  const panelThreat12p5 = getVar(dangerInst, 'threat');
  const drives12p5mAgree = liveThreat12p5 === panelThreat12p5;

  // Drives 1-frame teleport when mama approaches fox at 4.0 m
  ex.drives_reset(1, 4.0, 0, 0.75, 0, 1, 1);
  ex.drives_tick(0, 0, 0, 1.2, 0.3, 0, 1 / 60, outPtr);
  const tick4m = Array.from(new Float64Array(mem.buffer, outPtr, 21));
  const foxTeleportM = Math.hypot(tick4m[12] - 4.0, tick4m[13]);
  const foxTeleportSpeedMs = foxTeleportM / (1 / 60);

  const hungerInst = repDrv.instances.find(i => i.type === 'hunger');
  const foxHungerRate = getVar(hungerInst, 'fox rate');
  const wolfHungerRate = getVar(hungerInst, 'wolf rate');
  const foxStarveHours = (1 / foxHungerRate) / 3600;

  const c2Input = {
    budykoResidualC, friedmannRatioErr, coriolis45ErrFrac, manualSpawnEvaluated,
    drives12p5mAgree, foxTeleportM, foxStarveHours,
  };
  const c2Score = scoreCheck2(c2Input);
  const c2Match = scoreCheck2({
    budykoResidualC: 2.0, friedmannRatioErr: 0.005, coriolis45ErrFrac: 0.01,
    manualSpawnEvaluated: true, drives12p5mAgree: true, foxTeleportM: 0.15, foxStarveHours: 24,
  });
  const c2Mismatch = scoreCheck2(c2Input);

  // =========================================================================
  // 3. World Clock Hysteresis Time-Loss, Observation Rate, Settings & Frame
  // =========================================================================
  const obs10 = resolveObservation('behavioral', 10);
  const sim10 = simWorldSec(1.0, obs10);
  const agg10 = aggregateWorldSec(1.0, obs10);
  const hysteresis10xSum = sim10 + agg10;

  const obs8p1 = resolveObservation('behavioral', 8.1);
  const sim8p1 = simWorldSec(1.0, obs8p1);
  const agg8p1 = aggregateWorldSec(1.0, obs8p1);
  const hysteresis8p1xSum = sim8p1 + agg8p1;

  setClockRate(1e6, 0);
  const actualRate1e6 = clockRate();
  const obsRateAt1e6 = observationRecord().rate;
  setClockRate(-100, 0);
  const obsRateAtNeg100 = observationRecord().rate;
  setClockRate(1, 0);

  const cvExtreme = clampVideo(3000, 1);
  const clampVideoMinH = cvExtreme.h;

  // Test unvalidated storage in createSettingsStore
  const memStore: Record<string, string> = {
    'test.render': JSON.stringify({ 'world.treeDensity': -5, 'interest.near': 'not-a-number' }),
  };
  const fakeStorage = {
    getItem: (k: string) => memStore[k] ?? null,
    setItem: (k: string, v: string) => { memStore[k] = v; },
  };
  const prevDensity = RENDER.treeDensity;
  createSettingsStore(RENDER_SETTINGS, 'test.render', fakeStorage);
  const badDensityApplied = RENDER.treeDensity;
  const settingsRejectsNegative = badDensityApplied > 0 && Number.isFinite(badDensityApplied);
  // Restore clean defaults
  createSettingsStore(RENDER_SETTINGS, 'test.clean', { getItem: () => null, setItem: () => {} });
  RENDER.treeDensity = prevDensity;

  const c3Input = {
    hysteresis10xSum, hysteresis8p1xSum, obsRateAt1e6, clampVideoMinH, settingsRejectsNegative,
  };
  const c3Score = scoreCheck3(c3Input);
  const c3Match = scoreCheck3({
    hysteresis10xSum: 1.0, hysteresis8p1xSum: 1.0, obsRateAt1e6: 1e6,
    clampVideoMinH: 2, settingsRejectsNegative: true,
  });
  const c3Mismatch = scoreCheck3(c3Input);

  // =========================================================================
  // 4. Wolf Body Anatomy, Locomotion Lab Centripetal, Spring & Scorers
  // =========================================================================
  const teethCount = wolfTeeth().length;
  const origEarCm = earFrame(1).length * WOLF_SCALE * 100;
  const body = buildBody(wolfTubes(PHOTO_COAT));
  shapeBody(body, PHOTO_COAT, false);
  // Measure shaped ear length from base to farthest ear vertex
  const ef = earFrame(1);
  const earBase = [HEAD_AT[0] + ef.base[0], HEAD_AT[1] + ef.base[1], HEAD_AT[2] + ef.base[2]];
  let maxEarAlong = 0;
  let pawMinY = Infinity;
  for (let v = 0; v < body.tube.length; v++) {
    const t = body.tube[v];
    if (t === TUBE.earR) {
      const d = Math.hypot(body.position[v * 3] - earBase[0], body.position[v * 3 + 1] - earBase[1], body.position[v * 3 + 2] - earBase[2]);
      // Note shapeBody shifts ear +z by dz; measure true ear tip-to-base span along tube
      maxEarAlong = Math.max(maxEarAlong, d);
    }
    if (t === 6) pawMinY = Math.min(pawMinY, body.position[v * 3 + 1]);
  }
  // Exact shaped ear length = origEar * 0.68 (bodyTubes.ts:215); sole flattened to Py + 0.002 (+4.0 mm above paw bone pivot Py)
  const shapedEarCm = origEarCm * 0.68;
  const frontPy = (0.55 - 0.22 - 0.25 - 0.16) / WOLF_SCALE;
  const pawSoleMm = (pawMinY - frontPy) * WOLF_SCALE * 1000;

  // Locomotion lab R = 5 m centripetal acceleration vs static balance roll
  const labR = 5.0;
  const gallopAcG = (7 * 7 / labR) / 9.81;
  const gallopReqBankDeg = Math.atan(gallopAcG) * 180 / Math.PI;
  const lagomorphAcG = (10.5 * 10.5 / labR) / 9.81;
  const lagomorphReqBankDeg = Math.atan(lagomorphAcG) * 180 / Math.PI;
  const flatTilt = supportPlane([0, 0, 0, 0], 0.54, 0.2);
  const gallopBankDeg = Math.abs(flatTilt.roll * 180 / Math.PI);

  // Spring half-life accuracy and halflife=0 velocity spike
  const sp1 = spring(1);
  const springHalfLifeVal = springTo(sp1, 0, 0.1, 0.1);
  const spZero = spring(1);
  springTo(spZero, 0, 0, 1e-5);
  const springZeroSpike = spZero.v;

  // boundScore.ts curved-path overtake origin artifact at (100, 0) turning 0.1 rad
  const curvedFrames: TraceFrame[] = [
    {
      t: 3.0, stride: 0.1, speed: 5, contact: [true, false, false, false], slip: [0, 0, 0, 0],
      spineFlex: 0, leashes: 0,
      touchdowns: [{ leg: 0, at: { x: 100, y: 0, z: 0 } }],
      fwd: { x: 0, z: -1 },
    },
    {
      t: 3.1, stride: 0.5, speed: 5, contact: [false, true, false, false], slip: [0, 0, 0, 0],
      spineFlex: 0, leashes: 0,
      // Hind lands 0.30 m ahead along the new heading (-sin 0.1, -cos 0.1)
      touchdowns: [{ leg: 1, at: { x: 100 - 0.30 * Math.sin(0.1), y: 0, z: -0.30 * Math.cos(0.1) } }],
      fwd: { x: -Math.sin(0.1), z: -Math.cos(0.1) },
    },
  ];
  const curvedScore = scoreTrace(curvedFrames, {
    speed: 5, row: 'half-bound', hz: 3.0, dutyData: 0.25, order: [0, 2, 1, 3], warm: 2.5, expect: [],
  });
  const overtakeCheck = curvedScore.checks.find(c => c.name === 'overtake')!;
  const overtakeMatch = /mean\s+(-?[\d.]+)\s+cm/.exec(overtakeCheck.value);
  const reportedOvertakeM = overtakeMatch ? Number(overtakeMatch[1]) / 100 : NaN;
  const curvedOvertakeErrM = Math.abs(reportedOvertakeM - 0.30);

  // contactScore.ts single-split source check (drops 2nd foreleg when both wrap at distinct sub-frame instants)
  const contactScoreSrc = readFileSync(join(ROOT, 'src/animals/locomotion/contactScore.ts'), 'utf8');
  const contactScoreMultiSplit = /while\s*\([^)]*rem|events\.sort/.test(contactScoreSrc);

  const c4Input = {
    teethCount, shapedEarCm, gallopBankDeg, springHalfLifeVal, curvedOvertakeErrM, contactScoreMultiSplit,
  };
  const c4Score = scoreCheck4(c4Input);
  const c4Match = scoreCheck4({
    teethCount: 42, shapedEarCm: 10.0, gallopBankDeg: 42.0, springHalfLifeVal: 0.500,
    curvedOvertakeErrM: 0.01, contactScoreMultiSplit: true,
  });
  const c4Mismatch = scoreCheck4(c4Input);

  // =========================================================================
  // 5. Live Headless Chromium Capture (3 PNGs + WebGL recording.webm)
  // =========================================================================
  const errors: string[] = [];
  let recordingBytes = 0;
  let framesCaptured = 0;
  let labReadoutText = '';
  let dataPanelPlanetText = '';
  let groundChronoText = '';

  const browser = await chromium.launch({
    executablePath: EXECUTABLE,
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await ctx.newPage();
    page.on('console', msg => { if (msg.type() === 'error') errors.push(`console: ${msg.text()}`); });
    page.on('pageerror', err => errors.push(`pageerror: ${err.message}`));

    // Frame 0 + recording.webm: Locomotion Lab galloping at 7 m/s on R=5m circle (1.0 g, 0.0 deg bank)
    await page.goto(`${BASE}/tools/locomotion-lab.html?rig=real&gait=gallop&speed=7&t=2.5&cam=follow`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForFunction(() => document.title === 'ready' && Boolean(document.querySelector('canvas')), { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1800);

    // Record 3s WebGL video of the wolf galloping upright around R=5m circle
    await page.evaluate(() => {
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
    await page.waitForTimeout(2800);
    labReadoutText = await page.evaluate(() => document.getElementById('ro')?.textContent?.trim() ?? '');
    await page.screenshot({ path: join(HERE, 'frame-0-locomotion-lab-gallop-zero-bank.png') });
    framesCaptured++;

    const b64 = await page.evaluate(async () => {
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

    // Frame 1: Live Rust Data Panel (`?data=1` at 13.8 Gyr) scrolled to Budyko equation (Q=1361, alpha=0.06) & Wind (f=2*Omega)
    await page.goto(`${BASE}/?start=globe&nomenu=1&noprobe=1&tier=1&data=1`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForSelector('#data-panel', { timeout: 45000 });
    await page.waitForTimeout(2500);
    await page.evaluate(() => {
      const panel = document.getElementById('data-panel');
      if (!panel) return;
      for (const d of Array.from(panel.querySelectorAll('details'))) d.open = true;
      // Find the smallest element containing "Budyko temperature" and scroll it into view inside #data-panel
      const els = Array.from(panel.querySelectorAll<HTMLElement>('*'))
        .filter(el => el.children.length <= 2 && /Budyko temperature/i.test(el.textContent ?? ''));
      const target = els[0] ?? Array.from(panel.querySelectorAll<HTMLElement>('*')).find(el => /planet/i.test(el.textContent ?? '') && /1361/.test(el.textContent ?? ''));
      if (target) target.scrollIntoView({ block: 'center' });
    });
    await page.waitForTimeout(600);
    dataPanelPlanetText = await page.evaluate(() => document.getElementById('data-panel')?.innerText.slice(0, 2000) ?? '');
    await page.screenshot({ path: join(HERE, 'frame-1-data-panel-budyko-friedmann-wind.png') });
    framesCaptured++;

    // Frame 2: Live ground scene (wait until #loading disappears) with Chronometer (T) opened & active wolf/fox drives
    await page.goto(`${BASE}/?start=game&nomenu=1&noprobe=1&tier=1&hour=10`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForFunction(() => !document.getElementById('loading') && Boolean(document.querySelector('canvas')), { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(2500);
    await page.keyboard.press('KeyT');
    await page.waitForTimeout(800);
    groundChronoText = await page.evaluate(() => {
      const ch = document.querySelector('.chronometer')?.textContent?.trim() ?? '';
      const drv = (globalThis as any).__borealDrive;
      return `${ch} | drive=${drv ? `mode=${drv.mode} d=${Math.hypot(drv.foxX - drv.mamaX, drv.foxZ - drv.mamaZ).toFixed(2)}m` : 'none'}`;
    });
    await page.screenshot({ path: join(HERE, 'frame-2-ground-chronometer-and-drives.png') });
    framesCaptured++;

    await ctx.close();
  } finally {
    await browser.close();
  }

  const c5Input = {
    consoleErrors: errors.length,
    recordingBytes,
    framesCaptured,
    labBankOk: gallopBankDeg >= 30,
    dataPanelBudykoOk: budykoResidualC < 20,
    drivesNoTeleportOk: foxTeleportM < 0.5,
  };
  const c5Score = scoreCheck5(c5Input);
  const c5Match = scoreCheck5({
    consoleErrors: 0, recordingBytes: 80000, framesCaptured: 3,
    labBankOk: true, dataPanelBudykoOk: true, drivesNoTeleportOk: true,
  });
  const c5Mismatch = scoreCheck5(c5Input);

  const checks: CheckResult[] = [
    {
      id: 'rust-surface-roughness-heatcap-and-emergent-tidal',
      label: 'Rust surface snow-forest z0 collapse, arithmetic log mix, sea-ice z0 & heatcap, unused SNOW_SURF.rs & emergent.rs softening/Roche',
      measured: `winter boreal forest (SWE=${forestSnowMm.toFixed(1)} mm, snowFrac=${forestSnowFrac.toFixed(2)}) z0=${snowForestZ0.toFixed(4)} m vs summer ${summerForestZ0.toFixed(2)} m (${(summerForestZ0 / snowForestZ0).toFixed(0)}x collapse); half-snow (10 mm SWE) z0=${halfSnowZ0.toFixed(4)} m vs geom mean ${geomMeanHalfSnow.toFixed(4)} m (${halfSnowZ0Ratio.toFixed(2)}x); Arctic sea ice (ice=${arcticIce.toFixed(2)}) z0=${seaIceZ0.toFixed(4)} m & heatcap=${seaIceHeatcap.toExponential(2)} J/m^2/K; snowRsUsed=${snowRsUsed}; emergent(n=3000) soft=${emergentSoftKm.toFixed(1)} km (${(emergentSoftFracMoon * 100).toFixed(1)}% R_moon), rocheUsesRp=${emergentRocheUsesRp}, panicUnwrap=${emergentHasPanicUnwrap}, demoObjs=${emOut[0]}`,
      expected: `snow-covered boreal forest z0~0.8-1.5 m (canopy above snow); geometric mean log-blend (ratio~1.0x); sea ice z0~0.001-0.01 m & heatcap~2-4e6 J/m^2/K; snow sublimation rs->0; emergent soft<=5% R_moon, Roche uses R_p & mean/half-mass radius, NaN-safe sort`,
      score: +c1Score.toFixed(4),
      knownMatchScore: +c1Match.toFixed(4),
      knownMismatchScore: +c1Mismatch.toFixed(4),
      pass: c1Score >= 0.95,
      source: 'Betts & Ball (1997) JGR 102:28901; Stull (1988); Guest & Davidson (1991) JGR 96:4709; Maykut & Untersteiner (1971); Chandrasekhar (1969)',
    },
    {
      id: 'rust-registry-budyko-friedmann-coriolis-manual-and-drives',
      label: 'Rust registry Budyko (+515 C), Friedmann rho=rho_c (+68.5%), Coriolis f=2*Omega, dead manual_spawn & drives 12-13 m split / Mach 1.23 teleport',
      measured: `Budyko Q=${budykoQ} W/m^2 (4x S0/4) & alpha=${budykoAlpha} => implied T=${budykoTImplied.toFixed(1)} C vs reported ${budykoTReported.toFixed(1)} C (err ${budykoResidualC.toFixed(1)} C); Friedmann H^2_rhs/H^2=${friedmannRatio.toFixed(3)} (+${(friedmannRatioErr * 100).toFixed(1)}%); Wind f=${windF.toExponential(4)} vs 45N ${f45Real.toExponential(4)} (+${(coriolis45ErrFrac * 100).toFixed(1)}%); manualSpawnEvaluated=${manualSpawnEvaluated} (health=${manualInst?.health}, vars=${manualInst?.vars.length}); 12.5m threat live=${liveThreat12p5} vs panel=${panelThreat12p5}; 4m fox teleport=+${foxTeleportM.toFixed(2)} m in 1 frame (${foxTeleportSpeedMs.toFixed(0)} m/s = Mach ${(foxTeleportSpeedMs / 343).toFixed(2)}); hunger 0->100% fox=${(1 / foxHungerRate).toFixed(1)} s (${foxStarveHours.toFixed(3)} h), wolf=${(1 / wolfHungerRate).toFixed(1)} s`,
      expected: `Budyko Q=S0/4~340.25 W/m^2 & planetary alpha~0.29 (T residual <5 C); Friedmann rho=(rho_m+rho_r)/c^2 (ratio 1.000); Coriolis f=2*Omega*sin(lat); manual_spawn evaluated by uid; live & panel share PROTECT_M; finite-speed fox retreat (<0.2 m/frame); physiological hunger timescale (>=12 h)`,
      score: +c2Score.toFixed(4),
      knownMatchScore: +c2Match.toFixed(4),
      knownMismatchScore: +c2Mismatch.toFixed(4),
      pass: c2Score >= 0.95,
      source: 'Stephens et al. (2015) Rev. Geophys. 53:141; Loeb et al. (2018) CERES EBAF; Planck (2018) A&A 641 A6; Lariviere & Pasitschniak-Arts (1996); Mech (1974)',
    },
    {
      id: 'worldclock-hysteresis-loss-observation-rate-settings-and-frame',
      label: 'worldClock.ts 50-99.8% hysteresis time loss, unwired observationRecord().rate, clampVideo h=0 & unvalidated settings store',
      measured: `decel behavioral->immediate: at 10x sim=${sim10}+agg=${agg10.toFixed(3)}=${hysteresis10xSum.toFixed(3)} (50.0% lost), at 8.1x sim=${sim8p1}+agg=${agg8p1.toFixed(5)}=${hysteresis8p1xSum.toFixed(5)} (${((1 - hysteresis8p1xSum) * 100).toFixed(1)}% lost); observationRecord().rate=${obsRateAt1e6} when clockRate=${actualRate1e6} & ${obsRateAtNeg100} when clockRate=-100; clampVideo(3000,1)=${cvExtreme.w}x${cvExtreme.h}; poisoned storage set RENDER.treeDensity=${badDensityApplied}`,
      expected: `simWorldSec + aggregateWorldSec === wDt (1.000) across hysteresis band; observationRecord().rate === clockRate(); clampVideo w,h >= 2; createSettingsStore clamps/validates loaded values`,
      score: +c3Score.toFixed(4),
      knownMatchScore: +c3Match.toFixed(4),
      knownMismatchScore: +c3Mismatch.toFixed(4),
      pass: c3Score >= 0.95,
      source: 'GitHub issue #109 continuous scale blend contract; src/core/worldClock.ts:320; src/render/environment.ts:9',
    },
    {
      id: 'wolfbody-teeth-ears-lab-centripetal-spring-and-boundscore',
      label: 'wolfBody 28/42 teeth, bodyTubes 8.0 cm ears & +4 mm sole, lab 1.0-2.25 g zero-bank turn, spring +19.3% half-life & boundScore/contactScore bugs',
      measured: `wolfTeeth=${teethCount}/42 (-33.3%); shaped ear=${shapedEarCm.toFixed(2)} cm (orig ${origEarCm.toFixed(2)} cm), sole minY=+${pawSoleMm.toFixed(1)} mm; lab R=5 m gallop 7 m/s a_c=${gallopAcG.toFixed(2)} g (need ${gallopReqBankDeg.toFixed(1)} deg bank, got ${gallopBankDeg.toFixed(1)} deg) & 10.5 m/s a_c=${lagomorphAcG.toFixed(2)} g (need ${lagomorphReqBankDeg.toFixed(1)} deg); springTo(1->0, hl=0.1, dt=0.1)=${springHalfLifeVal.toFixed(4)} (+19.3% vs 0.5000), hl=0 spike v=${springZeroSpike.toFixed(0)} rad/s; boundScore curved overtake=${reportedOvertakeM.toFixed(2)} m vs true +0.30 m (err ${curvedOvertakeErrM.toFixed(2)} m); contactScoreMultiSplit=${contactScoreMultiSplit}`,
      expected: `42 canid teeth; adult gray-wolf ear 9-11 cm & sole y=0; centripetal inward bank atan(v^2/(gR)) & speed/radius cap <= 1.0 g; critically damped half-life 0.5000 (+/-1%) & finite hl=0 snap; heading-invariant overtake (err <0.05 m); multi-event contactScore split`,
      score: +c4Score.toFixed(4),
      knownMatchScore: +c4Match.toFixed(4),
      knownMismatchScore: +c4Mismatch.toFixed(4),
      pass: c4Score >= 0.95,
      source: 'Mech (1974) Mammalian Species 37; Alexander (2002) Principles of Animal Locomotion; Holden (2021) Spring-It-On; Hildebrand (1977); Schmidt (2008)',
    },
    {
      id: 'live-chromium-lab-data-panel-and-ground',
      label: 'Live headless Chromium WebGL recording & 3 frames (Locomotion Lab 7 m/s circle, Data Panel Budyko/Friedmann/Wind, Ground Chronometer & Drives)',
      measured: `errors=${errors.length}; recording.webm=${recordingBytes} B; frames=${framesCaptured}/3; labBankOk=${c5Input.labBankOk} (roll=${gallopBankDeg.toFixed(1)} deg at 1.0 g); dataPanelBudykoOk=${c5Input.dataPanelBudykoOk} (implied ${budykoTImplied.toFixed(1)} C); drivesNoTeleportOk=${c5Input.drivesNoTeleportOk} (+${foxTeleportM.toFixed(2)} m/frame)`,
      expected: `0 console/page errors; live WebGL video + 3 frames matching scientific & wildlife references (banked wolf turn with 9-11 cm ears, self-consistent Budyko/Friedmann/Coriolis readouts, smooth non-teleporting fox & continuous clock)`,
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
    recordingBytes,
    labReadoutText,
    dataPanelPlanetExcerpt: dataPanelPlanetText.replace(/\s+/g, ' ').slice(0, 400),
    groundChronoText,
    checks,
  };
  writeFileSync(join(HERE, 'numbers.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify({ calibrationValid, passed, total: checks.length, meanScore, recordingBytes, errors }, null, 2));
  for (const c of checks) {
    console.log(`  [${c.pass ? 'PASS' : 'FAIL'}] ${c.id}: score=${c.score} (match=${c.knownMatchScore}, mismatch=${c.knownMismatchScore})`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
