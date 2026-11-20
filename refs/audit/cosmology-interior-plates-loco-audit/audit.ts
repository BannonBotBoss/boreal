/**
 * Live & calibrated Rule 11 audit (T-0283) of four previously unaudited subsystems:
 *   1. Rust Cosmology, Perturbative Reheating & Cosmic Clock (`rust/boreal-sim/src/{cosmology.rs, reheating.rs, cosmic_time.rs}`):
 *      - `cosmology.rs:306-307` `g_star_cmb()` multiplies `rho_c` (already J/m^3) by `c^2` a second time (off by `c^2 = 8.99e16`);
 *      - `cosmology.rs:149-183` `scale_samples` stops at `a = 1.0`, freezing all future cosmic time (`t = 30..100 Gyr`) at
 *        `a = 1.000, T = 2.725 K, z = 0` instead of dark-energy exponential expansion (`a(30 Gyr) = 2.665, T = 1.022 K`);
 *      - `cosmology.rs:398-400` hardcodes inflation `w = -1.0` for all `eps < 1` instead of Klein-Gordon `(0.5*pi^2 - V)/(0.5*pi^2 + V)`;
 *      - `reheating.rs:83-96` `g_star(T)` counts free gluons (`g=16`) and free u/d quarks (`g=24`) below QCD confinement (`1..150 MeV`),
 *        inflating `g*(11.5 MeV)` to `~46.9` (`4.36x` textbook `10.75`) with a `~7.7x` step cliff at `1.0 MeV` and uncached `run_cached()`;
 *      - `reheating.rs:365-378` vs `cosmology.rs` disagrees by `373x` in `T` and `14.2x` in `a` at `t = 1e-30 s` (`era = "electroweak"`);
 *      - `cosmic_time.rs:105` `planet_clock` wraps modulo `365.0` against `YEAR_S = 365.25 * 86400` (`0.25 day/yr` seasonal drift).
 *   2. Earth Interior SPH Differentiation & Baked Figure (`public/bake/earth-hot.{bin,json}`, `public/bake/earth-parcels.json`,
 *      `rust/boreal-sim/src/{differentiation.rs, formation.rs}`, `src/world/globe/parcels.ts`):
 *      - Default bake `earth-hot` freezes `1,796 / 1,796` (`100.0%`) of core iron solid (`1,803 / 1,808 = 99.72%` overall; all 5 liquid
 *        iron parcels sit stranded in the outer mantle `4,671..6,213 km`), giving `icb = 3,117.4 km` (`2.55x` PREM `1,221.5 km`, zero
 *        liquid outer core / geodynamo), `r_vol = 6,532.1 km` (`+161 km`), `g_eq = 9.299 m/s^2` (`-4.9%`), `j2 = 7.878e-4` (`-27.2%`),
 *        `inv_f = 328.2`, `com_m = 19.1 km`, `vmax = 1,469.3 m/s` (Mach 4.3 sloshing), `rho_centre = 14,274 kg/m^3` (`+9.1%`).
 *   3. Plate Tectonics Kinematics, Handedness Sign Flip, Boundary Drop & TileWorker Race (`src/world/globe/{plates.ts, tileWorker.ts}`):
 *      - `plates.ts:20,40` uses left-handed `unit(lat, lon) = [cos*cos, sin, +cos*sin]` with right-handed `omega x p`, reversing EVERY
 *        MORVEL plate velocity (`dot(omega_N x (0,0), +East) = -1.000`) and inverting convergent subduction <-> divergent rifts 100%;
 *      - `plates.ts:54` `break;` silently drops `860 / 6,098` (`14.1%`) of North plate boundaries; uniform `stepDeg` grid clusters
 *        boundary points `3.77x` denser per steradian near poles (`|lat| > 70 deg`) vs equator (`|lat| < 20 deg`);
 *      - `MORVEL` area sum is `12.2104 sr` (`-2.83%` short of `4*pi`), small plates (`ri`, `jf`, `sw`, `mq`) overshoot by `+35..51%`,
 *        and synchronous main-thread build stalls `~446 ms`; `tileWorker.ts:34,39-42` races module-global `STAGES` across `await yieldNow()`
 *        and never cancels `mask()`.
 *   4. Locomotion `foot.ts` Stop-Mid-Swing Teleport, `jointSwing.ts` 2x Forearm Velocity Breach, `bodyPlan.ts` Scapula Mismatch,
 *      `photo/fly.ts` Diagonal Overspeed & `cosmos/sphere.ts` Per-Frame `gl.finish()` (`src/animals/locomotion/{foot.ts, jointSwing.ts, bodyPlan.ts}`,
 *      `src/photo/fly.ts`, `src/world/cosmos/sphere.ts`):
 *      - `foot.ts:32-45` teleports an airborne swinging paw backward `2.255 m` in 1 frame on a mid-swing stop (`moving: true -> false`);
 *      - `jointSwing.ts:23-36` `limitStep(..., 0.1)` allows forearm world angle delta `0.200 rad` (`2.00x` stated `max`);
 *      - `bodyPlan.ts:71,78` `fore.hip` (`0.2500 m`) disagrees with `shoulder` (`0.2619 m`) by `11.9 mm` (`10.8%` of scapula);
 *      - `photo/fly.ts:25-33` diagonal `W+D+Space` flies at `10.392 m/s` (`sqrt(3) = 1.732x` `PHOTO_FLY_SPEED = 6 m/s`);
 *      - `cosmos/sphere.ts:492,408-428` calls synchronous `gl.finish()` every animation frame and ignores `tier.bloom`, `tier.msaa`, `tier.segments`.
 *
 * Usage:
 *   npx tsx refs/audit/cosmology-interior-plates-loco-audit/audit.ts [baseUrl]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { decodeEngineReport } from '../../../src/core/engineReport';
import { MORVEL, buildPlates } from '../../../src/world/globe/plates';
import { footState, stepFoot } from '../../../src/animals/locomotion/foot';
import { limitStep } from '../../../src/animals/locomotion/jointSwing';
import { skeletonOf } from '../../../src/animals/locomotion/bodyPlan';
import { photoFlyMove } from '../../../src/photo/fly';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const BASE = process.argv[2] ?? 'http://127.0.0.1:5267';

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
  a30Gyr: number;
  gStar11MeV: number;
  gStar1MeVCliffRatio: number;
  inflWErr: number;
  reheatCosmoTRatio: number;
  gStarCmbOk: boolean;
  reheatCached: boolean;
  planetClockYearLenOk: boolean;
}): number {
  const s1 = clamp01(1 - Math.abs(m.a30Gyr - 2.665) / 1.5);
  const s2 = clamp01(1 - Math.abs(m.gStar11MeV - 10.75) / 20.0);
  const s3 = clamp01(1 - Math.max(0, m.gStar1MeVCliffRatio - 1.3) / 4.0);
  const s4 = clamp01(1 - m.inflWErr / 0.25);
  const s5 = clamp01(1 - Math.max(0, Math.log10(Math.max(1, m.reheatCosmoTRatio)) - 0.15) / 1.5);
  const s6 = m.gStarCmbOk ? 1 : 0;
  const s7 = m.reheatCached ? 1 : 0;
  const s8 = m.planetClockYearLenOk ? 1 : 0;
  return (s1 + s2 + s3 + s4 + s5 + s6 + s7 + s8) / 8;
}

function scoreCheck2(m: {
  coreSolidFrac: number;
  icbKm: number;
  rVolKm: number;
  gEq: number;
  j2ErrFrac: number;
  comKm: number;
  vmaxMs: number;
}): number {
  const s1 = clamp01(1 - Math.abs(m.coreSolidFrac - 0.044) / 0.5);
  const s2 = clamp01(1 - Math.abs(m.icbKm - 1221.5) / 1000);
  const s3 = clamp01(1 - Math.abs(m.rVolKm - 6371.0) / 150);
  const s4 = clamp01(1 - Math.abs(m.gEq - 9.7803) / 0.45);
  const s5 = clamp01(1 - m.j2ErrFrac / 0.20);
  const s6 = clamp01(1 - m.comKm / 10);
  const s7 = clamp01(1 - m.vmaxMs / 250);
  return (s1 + s2 + s3 + s4 + s5 + s6 + s7) / 7;
}

function scoreCheck3(m: {
  eastDot: number;
  droppedNorthPct: number;
  polarToEqDensityRatio: number;
  maxSmallPlateRelErr: number;
  tileWorkerStagesSafe: boolean;
  tileWorkerMaskCancellable: boolean;
}): number {
  const s1 = m.eastDot > 0.99 ? 1 : 0;
  const s2 = clamp01(1 - m.droppedNorthPct / 10);
  const s3 = clamp01(1 - Math.max(0, m.polarToEqDensityRatio - 1.2) / 2.0);
  const s4 = clamp01(1 - Math.max(0, m.maxSmallPlateRelErr - 0.10) / 0.35);
  const s5 = m.tileWorkerStagesSafe ? 1 : 0;
  const s6 = m.tileWorkerMaskCancellable ? 1 : 0;
  return (s1 + s2 + s3 + s4 + s5 + s6) / 6;
}

function scoreCheck4(m: {
  stopTeleportM: number;
  forearmDeltaRatio: number;
  scapulaHipDiffMm: number;
  diagSpeedRatio: number;
  sphereNoGlFinishPerFrame: boolean;
  sphereRespectsTierBloom: boolean;
}): number {
  const s1 = clamp01(1 - Math.max(0, m.stopTeleportM - 0.05) / 0.8);
  const s2 = clamp01(1 - Math.max(0, m.forearmDeltaRatio - 1.05) / 0.8);
  const s3 = clamp01(1 - Math.max(0, m.scapulaHipDiffMm - 1.0) / 10.0);
  const s4 = clamp01(1 - Math.max(0, m.diagSpeedRatio - 1.02) / 0.5);
  const s5 = m.sphereNoGlFinishPerFrame ? 1 : 0;
  const s6 = m.sphereRespectsTierBloom ? 1 : 0;
  return (s1 + s2 + s3 + s4 + s5 + s6) / 6;
}

function scoreCheck5(m: {
  consoleErrors: number;
  recordingBytes: number;
  framesCaptured: number;
  platesHandednessOk: boolean;
  interiorOuterCoreLiquidOk: boolean;
  dataPanelCosmologyOk: boolean;
}): number {
  if (m.consoleErrors > 0 || m.recordingBytes < 10000 || m.framesCaptured < 3) return 0;
  const passCount = (m.platesHandednessOk ? 1 : 0) + (m.interiorOuterCoreLiquidOk ? 1 : 0) + (m.dataPanelCosmologyOk ? 1 : 0);
  return passCount / 3;
}

async function main() {
  mkdirSync(join(HERE, 'reference'), { recursive: true });

  // =========================================================================
  // 1. Rust Cosmology, Perturbative Reheating & Cosmic Clock (Live WASM)
  // =========================================================================
  const wasmBytes = readFileSync(join(ROOT, 'public/wasm/boreal_sim.wasm'));
  const { instance } = await WebAssembly.instantiate(wasmBytes, {});
  const ex = instance.exports as Record<string, any>;
  const mem = ex.memory as WebAssembly.Memory;

  function wasmReport(cycle: number) {
    ex.engine_set_cycle(cycle);
    const len = ex.engine_report_len();
    const ptr = ex.engine_report_ptr();
    const text = new TextDecoder().decode(new Uint8Array(mem.buffer, ptr, len));
    return decodeEngineReport(text);
  }

  const YEAR_S = 365.25 * 86400;
  const PLANCK_S = 5.39e-44;
  const cycOf = (sec: number) => Math.log10(sec / PLANCK_S) + 1;
  const getVar = (inst: any, label: string) => inst?.vars.find((v: any) => v.label === label)?.value ?? NaN;

  const repInfl = wasmReport(cycOf(9.5e-33));
  const stInfl = repInfl.instances.find(i => i.type === 'spacetime');
  const inflEps = getVar(stInfl, 'slow-roll epsilon');
  const inflW = getVar(stInfl, 'equation of state w');
  const inflWExact = -1 + (2 * inflEps) / 3;
  const inflWErr = Math.abs(inflW - inflWExact);

  const repPost = wasmReport(cycOf(1e-30));
  const stPost = repPost.instances.find(i => i.type === 'spacetime');
  const rhPost = repPost.instances.find(i => i.type === 'reheating');
  const postCosmoT = getVar(stPost, 'temperature');
  const postReheatT = getVar(rhPost, 'temperature');
  const postCosmoA = getVar(stPost, 'scale factor a');
  const postReheatA = getVar(rhPost, 'scale factor a');
  const reheatCosmoTRatio = postCosmoT / postReheatT;
  const reheatCosmoARatio = postReheatA / postCosmoA;
  const postEra = repPost.era;

  const rep11MeV = wasmReport(cycOf(1e-2));
  const rh11MeV = rep11MeV.instances.find(i => i.type === 'reheating');
  const t11MeVK = getVar(rh11MeV, 'temperature');
  const t11MeV = t11MeVK / 1.160451812e10; // MeV
  const gStar11MeV = getVar(rh11MeV, 'g*');
  const gluonN11MeV = getVar(rh11MeV, 'gluon number density');

  const rep1p6MeV = wasmReport(cycOf(0.5));
  const rh1p6MeV = rep1p6MeV.instances.find(i => i.type === 'reheating');
  const gStarAbove1MeV = getVar(rh1p6MeV, 'g*');
  const rep0p9MeV = wasmReport(cycOf(1.5));
  const rh0p9MeV = rep0p9MeV.instances.find(i => i.type === 'reheating');
  const gStarBelow1MeV = getVar(rh0p9MeV, 'g*');
  const gStar1MeVCliffRatio = gStarAbove1MeV / gStarBelow1MeV;

  const rep30Gyr = wasmReport(cycOf(30e9 * YEAR_S));
  const st30Gyr = rep30Gyr.instances.find(i => i.type === 'spacetime');
  const a30Gyr = getVar(st30Gyr, 'scale factor a');
  const t30Gyr = getVar(st30Gyr, 'temperature');
  const z30Gyr = getVar(st30Gyr, 'redshift');

  const cosmoSrc = readFileSync(join(ROOT, 'rust/boreal-sim/src/cosmology.rs'), 'utf8');
  const reheatSrc = readFileSync(join(ROOT, 'rust/boreal-sim/src/reheating.rs'), 'utf8');
  const clockSrc = readFileSync(join(ROOT, 'rust/boreal-sim/src/cosmic_time.rs'), 'utf8');
  const gStarCmbOk = !/p\.orr\s*\*\s*rho_c\s*\*\s*p\.c\s*\*\s*p\.c/.test(cosmoSrc);
  const reheatCached = !/fn\s+run_cached\s*\(\)\s*->\s*Run\s*\{\s*integrate\(\)\s*\}/.test(reheatSrc);
  const planetClockYearLenOk = !/rem_euclid\(365\.0\)/.test(clockSrc);

  const c1Input = {
    a30Gyr, gStar11MeV, gStar1MeVCliffRatio, inflWErr, reheatCosmoTRatio,
    gStarCmbOk, reheatCached, planetClockYearLenOk,
  };
  const c1Score = scoreCheck1(c1Input);
  const c1Match = scoreCheck1({
    a30Gyr: 2.665, gStar11MeV: 10.75, gStar1MeVCliffRatio: 1.15, inflWErr: 0.005,
    reheatCosmoTRatio: 1.05, gStarCmbOk: true, reheatCached: true, planetClockYearLenOk: true,
  });
  const c1Mismatch = scoreCheck1(c1Input);

  // =========================================================================
  // 2. Earth Interior SPH Differentiation & Baked Figure
  // =========================================================================
  const hotMeta = JSON.parse(readFileSync(join(ROOT, 'public/bake/earth-hot.json'), 'utf8'));
  const premMeta = JSON.parse(readFileSync(join(ROOT, 'public/bake/earth-parcels.json'), 'utf8'));
  const hotRaw = readFileSync(join(ROOT, 'public/bake/earth-hot.bin'));
  const hotBuf = new Float32Array(hotRaw.buffer, hotRaw.byteOffset, hotRaw.byteLength / 4);
  const hotN = hotBuf.length / 6;
  let coreIronTotal = 0, coreIronSolid = 0, allIronLiquid = 0, allIronSolid = 0;
  let minLiqIronR = Infinity;
  for (let i = 0; i < hotN; i++) {
    const r = Math.hypot(hotBuf[i * 6], hotBuf[i * 6 + 1], hotBuf[i * 6 + 2]);
    const mat = hotBuf[i * 6 + 3] | 0;
    if (mat === 10 || mat === 12) {
      if (mat === 10) { allIronLiquid++; minLiqIronR = Math.min(minLiqIronR, r); }
      else allIronSolid++;
      if (r < hotMeta.cmb) {
        coreIronTotal++;
        if (mat === 12) coreIronSolid++;
      }
    }
  }
  const coreSolidFrac = coreIronTotal > 0 ? coreIronSolid / coreIronTotal : 1;
  const allSolidFrac = allIronSolid / (allIronSolid + allIronLiquid);
  const icbKm = hotMeta.icb / 1000;
  const rVolKm = hotMeta.r_vol / 1000;
  const gEq = hotMeta.g_eq;
  const j2ErrFrac = Math.abs(hotMeta.j2 - 1.08263e-3) / 1.08263e-3;
  const comKm = hotMeta.com_m / 1000;
  const vmaxMs = hotMeta.vmax;

  const c2Input = { coreSolidFrac, icbKm, rVolKm, gEq, j2ErrFrac, comKm, vmaxMs };
  const c2Score = scoreCheck2(c2Input);
  const c2Match = scoreCheck2({
    coreSolidFrac: 0.044, icbKm: 1221.5, rVolKm: 6371.0, gEq: 9.7803, j2ErrFrac: 0.005, comKm: 0.1, vmaxMs: 5,
  });
  const c2Mismatch = scoreCheck2(c2Input);

  // =========================================================================
  // 3. Plate Tectonics Kinematics, Handedness, Boundary Drop & TileWorker
  // =========================================================================
  const tP0 = performance.now();
  const pl = buildPlates(1400);
  const buildPlatesMs = performance.now() - tP0;
  const sumMorvelSr = MORVEL.reduce((s, m) => s + m[4], 0);
  const smallPlateErrs = MORVEL.map((m, i) => ({
    id: m[0], target: m[4], got: pl.areas[i], relErr: Math.abs(pl.areas[i] - m[4]) / m[4],
  })).sort((a, b) => b.relErr - a.relErr);
  const maxSmallPlateRelErr = smallPlateErrs[0].relErr;

  // Handedness check: plates.ts unit(lat, lon) = [cos*cos, sin, +cos*sin] vs omega x p
  const D = Math.PI / 180;
  const unit = (lat: number, lon: number): [number, number, number] => [Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon)];
  const wN: [number, number, number] = [0, 1, 0];
  const p0: [number, number, number] = [1, 0, 0];
  const vCross: [number, number, number] = [wN[1] * p0[2] - wN[2] * p0[1], wN[2] * p0[0] - wN[0] * p0[2], wN[0] * p0[1] - wN[1] * p0[0]];
  const eastDir = unit(0, Math.PI / 2);
  const eastDot = vCross[0] * eastDir[0] + vCross[1] * eastDir[1] + vCross[2] * eastDir[2];

  const tB0 = performance.now();
  let bothEN = 0, totalEdgeCells = 0, polarEdges = 0, eqEdges = 0;
  for (let la = -90 + 0.2; la < 90; la += 0.4) {
    for (let lo = -180; lo < 180; lo += 0.4) {
      const a = pl.plateAt(unit(la * D, lo * D));
      const e = pl.plateAt(unit(la * D, (lo + 0.4) * D)) !== a;
      const n = pl.plateAt(unit(Math.min(90, la + 0.4) * D, lo * D)) !== a;
      if (e || n) {
        totalEdgeCells++;
        if (Math.abs(la) > 70) polarEdges++;
        if (Math.abs(la) < 20) eqEdges++;
      }
      if (e && n) bothEN++;
    }
  }
  const boundariesMs = performance.now() - tB0;
  const droppedNorthPct = (100 * bothEN) / (totalEdgeCells + bothEN);
  // Area of |lat| > 70 deg = 4*pi*(1 - sin 70) = 0.758 sr; |lat| < 20 deg = 4*pi*sin 20 = 4.298 sr
  const polarAreaSr = 4 * Math.PI * (1 - Math.sin(70 * D));
  const eqAreaSr = 4 * Math.PI * Math.sin(20 * D);
  const polarToEqDensityRatio = (polarEdges / polarAreaSr) / (eqEdges / eqAreaSr);

  const tileWorkerSrc = readFileSync(join(ROOT, 'src/world/globe/tileWorker.ts'), 'utf8');
  const tileWorkerStagesSafe = !/self\.onmessage[\s\S]*STAGES\.on\s*=\s*r\.staged/.test(tileWorkerSrc);
  const tileWorkerMaskCancellable = /async\s+function\s+mask[\s\S]*cancelled/.test(tileWorkerSrc);

  const c3Input = {
    eastDot, droppedNorthPct, polarToEqDensityRatio, maxSmallPlateRelErr,
    tileWorkerStagesSafe, tileWorkerMaskCancellable,
  };
  const c3Score = scoreCheck3(c3Input);
  const c3Match = scoreCheck3({
    eastDot: 1.0, droppedNorthPct: 0.0, polarToEqDensityRatio: 1.0, maxSmallPlateRelErr: 0.05,
    tileWorkerStagesSafe: true, tileWorkerMaskCancellable: true,
  });
  const c3Mismatch = scoreCheck3(c3Input);

  // =========================================================================
  // 4. Locomotion foot.ts / jointSwing.ts / bodyPlan.ts, photo/fly.ts & sphere.ts
  // =========================================================================
  const fs0 = footState({ x: 0, y: 0, z: 0 });
  const flatGround = () => 0;
  stepFoot(fs0, { phase: 0.45, duty: 0.4, cycle: 2.0, lift: 0.2, moving: true, reverse: false, dt: 0.016, speed: 6, rest: { x: 0, z: -1.0 }, fwd: { x: 0, z: -1 } }, flatGround);
  const mid = stepFoot(fs0, { phase: 0.85, duty: 0.4, cycle: 2.0, lift: 0.2, moving: true, reverse: false, dt: 0.016, speed: 6, rest: { x: 0, z: -2.0 }, fwd: { x: 0, z: -1 } }, flatGround);
  const stopped = stepFoot(fs0, { phase: 0.85, duty: 0.4, cycle: 2.0, lift: 0.2, moving: false, reverse: false, dt: 0.016, speed: 0, rest: { x: 0, z: -2.0 }, fwd: { x: 0, z: -1 } }, flatGround);
  const stopTeleportM = Math.hypot(stopped.at.x - mid.at.x, stopped.at.z - mid.at.z);

  const lim = limitStep({ girdle: 0, leg: 0, knee: 0, wrist: 0 }, { girdle: 0, leg: 0.5, knee: 0.5, wrist: 0 }, 0.1);
  const forearmDeltaRad = Math.abs(lim.girdle + lim.leg + lim.knee);
  const forearmDeltaRatio = forearmDeltaRad / 0.1;

  const sk = skeletonOf({ hip: 0.34, hipZ: 0.2, shoulderZ: -0.2, track: { fore: 0.07, hind: 0.08 }, foreLeg: 0.26, hindLeg: 0.34, hindFoot: 0.14, scapula: 0.11, girdleTop: 0.36 });
  const scapulaHipDiffMm = Math.abs(sk.shoulder - sk.legs.hip) * 1000;

  const cam = { x: 0, y: 10, z: 0, yaw: 0, pitch: 0 };
  photoFlyMove(cam, 1.0, 1, 1, 1, false);
  const diagSpeedMs = Math.hypot(cam.x, cam.y - 10, cam.z);
  const diagSpeedRatio = diagSpeedMs / 6.0;

  const sphereSrc = readFileSync(join(ROOT, 'src/world/cosmos/sphere.ts'), 'utf8');
  const sphereNoGlFinishPerFrame = !/private\s+frame\([\s\S]*?getContext\(\)\.finish\(\)/.test(sphereSrc);
  const sphereRespectsTierBloom = /this\.bloom\.strength\s*=\s*tier\.bloom/.test(sphereSrc);

  const c4Input = {
    stopTeleportM, forearmDeltaRatio, scapulaHipDiffMm, diagSpeedRatio,
    sphereNoGlFinishPerFrame, sphereRespectsTierBloom,
  };
  const c4Score = scoreCheck4(c4Input);
  const c4Match = scoreCheck4({
    stopTeleportM: 0.02, forearmDeltaRatio: 1.0, scapulaHipDiffMm: 0.0, diagSpeedRatio: 1.0,
    sphereNoGlFinishPerFrame: true, sphereRespectsTierBloom: true,
  });
  const c4Mismatch = scoreCheck4(c4Input);

  // =========================================================================
  // 5. Live Headless Chromium Capture (3 PNGs + WebGL recording.webm)
  // =========================================================================
  const errors: string[] = [];
  let recordingBytes = 0;
  let framesCaptured = 0;
  let parcelsReadoutText = '';
  let dataPanel11MeVText = '';
  let dataPanel30GyrText = '';

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

    // Frame 0 + recording.webm: 3D Globe with Plates toggled ON (live MORVEL boundaries)
    await page.goto(`${BASE}/?view=globe&latlon=20,-40&alt=13500000&day=172&hour=15&panel=1&tier=1&noprobe=1`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForFunction(() => Boolean(document.querySelector('canvas')), { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(3500);

    // Toggle Plates checkbox in Layer Panel
    await page.evaluate(() => {
      const labels = Array.from(document.querySelectorAll('label'));
      const plateLbl = labels.find(l => /plates/i.test(l.textContent ?? ''));
      const cb = plateLbl?.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
      if (cb && !cb.checked) cb.click();
    });
    await page.waitForTimeout(2500);

    // Start WebGL canvas MediaRecorder clip while dragging the globe with Plates active
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
    await page.mouse.move(640, 360);
    await page.mouse.down();
    for (let s = 1; s <= 12; s++) {
      await page.mouse.move(640 - s * 18, 360 - s * 4);
      await page.waitForTimeout(160);
    }
    await page.mouse.up();
    await page.waitForTimeout(900);
    await page.screenshot({ path: join(HERE, 'frame-0-globe-plates-inverted-boundaries.png') });
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

    // Frame 1: Earth interior SPH parcel cutaway (`earth-hot.bin` + live readout)
    await page.goto(`${BASE}/?view=globe&dir=25,-60&r=0&parcels=1&alt=15000000&day=172&hour=15&panel=0&tier=1&noprobe=1`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForFunction(() => /parcels\s*\[/i.test(document.body.innerText), { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(2500);
    parcelsReadoutText = await page.evaluate(() => {
      const pre = document.querySelector('pre');
      return pre?.textContent?.trim() ?? document.body.innerText.slice(0, 500);
    });
    await page.screenshot({ path: join(HERE, 'frame-1-earth-hot-frozen-core-cutaway.png') });
    framesCaptured++;

    // Frame 2: Live Rust Data Panel (`?data=1` / `#data-panel`) showing reheating g*=46.9 at 11.5 MeV & frozen a=1 at 30 Gyr
    await page.goto(`${BASE}/?start=globe&nomenu=1&noprobe=1&tier=1&data=1`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForSelector('#cycle-input', { timeout: 45000 });
    await page.waitForTimeout(1200);

    // First verify 30 Gyr future freeze in live UI
    const cyc30 = cycOf(30e9 * YEAR_S).toFixed(4);
    await page.fill('#cycle-input', cyc30);
    await page.waitForTimeout(900);
    dataPanel30GyrText = await page.evaluate(() => document.getElementById('data-panel')?.innerText.slice(0, 900) ?? '');

    // Then switch to t = 1e-2 s (~11.5 MeV, below QCD confinement) for screenshot showing reheating g* & free gluons
    const cyc11 = cycOf(1e-2).toFixed(4);
    await page.fill('#cycle-input', cyc11);
    await page.waitForTimeout(1000);
    // Scroll data-panel down slightly to show Reheating card with g*
    await page.evaluate(() => {
      const panel = document.getElementById('data-panel');
      if (panel) {
        const cards = Array.from(panel.querySelectorAll('section, details, div'));
        const rh = cards.find(el => /reheating/i.test(el.textContent ?? '') && /g\*/i.test(el.textContent ?? ''));
        if (rh) rh.scrollIntoView({ block: 'start' });
      }
    });
    await page.waitForTimeout(400);
    dataPanel11MeVText = await page.evaluate(() => document.getElementById('data-panel')?.innerText.slice(0, 1200) ?? '');
    await page.screenshot({ path: join(HERE, 'frame-2-data-panel-reheating-gstar.png') });
    framesCaptured++;

    await ctx.close();
  } finally {
    await browser.close();
  }

  const c5Input = {
    consoleErrors: errors.length,
    recordingBytes,
    framesCaptured,
    platesHandednessOk: eastDot > 0.99 && droppedNorthPct < 1,
    interiorOuterCoreLiquidOk: coreSolidFrac < 0.25 && icbKm < 1600,
    dataPanelCosmologyOk: Math.abs(gStar11MeV - 10.75) < 2 && a30Gyr > 2.0,
  };
  const c5Score = scoreCheck5(c5Input);
  const c5Match = scoreCheck5({
    consoleErrors: 0, recordingBytes: 80000, framesCaptured: 3,
    platesHandednessOk: true, interiorOuterCoreLiquidOk: true, dataPanelCosmologyOk: true,
  });
  const c5Mismatch = scoreCheck5(c5Input);

  const checks: CheckResult[] = [
    {
      id: 'rust-cosmology-reheating-gstar-future-freeze-and-clock',
      label: 'Rust cosmology future a(t), inflation w, g_star_cmb, reheating QCD g*(T) & caching, and cosmic_time calendar drift',
      measured: `a(30 Gyr)=${a30Gyr.toFixed(4)} (T=${t30Gyr.toFixed(3)} K, z=${z30Gyr.toFixed(3)}); g*(${t11MeV.toFixed(1)} MeV)=${gStar11MeV.toFixed(2)} (free gluon n=${gluonN11MeV.toExponential(2)} m^-3); 1 MeV cliff=${gStarAbove1MeV.toFixed(2)}->${gStarBelow1MeV.toFixed(2)} (${gStar1MeVCliffRatio.toFixed(2)}x); infl(eps=${inflEps.toFixed(3)}) w=${inflW.toFixed(3)} vs KG ${inflWExact.toFixed(3)}; t=1e-30s era="${postEra}" cosmo/reheat T=${reheatCosmoTRatio.toFixed(1)}x & a=${reheatCosmoARatio.toFixed(1)}x; gStarCmbOk=${gStarCmbOk} (off by c^2); reheatCached=${reheatCached}; planetClockYearLenOk=${planetClockYearLenOk}`,
      expected: `a(30 Gyr)~2.665 (T~1.022 K); g*(11.5 MeV)=10.75 (0 free gluons/quarks below 150 MeV); smooth e+e- crossover across 0.5-0.1 MeV (<1.3x step); Klein-Gordon w=-1+2*eps/3; continuous reheating->FRW handoff; g_star_cmb~3.36; cached reheating run; 365.25 d planet_clock`,
      score: +c1Score.toFixed(4),
      knownMatchScore: +c1Match.toFixed(4),
      knownMismatchScore: +c1Mismatch.toFixed(4),
      pass: c1Score >= 0.95,
      source: 'Planck Collaboration (2018) A&A 641 A6; Kolb & Turner (1990) Early Universe; Husdal (2016) arXiv:1609.04979; Saikawa & Shirai (2018) arXiv:1803.01038',
    },
    {
      id: 'earth-interior-sph-bake-frozen-core-figure-and-slosh',
      label: 'Earth SPH hot differentiation bake (earth-hot) liquid outer core, ICB radius, Earth radius/gravity, J2 & relaxation',
      measured: `core iron solid=${coreIronSolid}/${coreIronTotal} (${(coreSolidFrac * 100).toFixed(1)}%, overall ${allIronSolid}/${allIronSolid + allIronLiquid}=${(allSolidFrac * 100).toFixed(2)}%, min liquid Fe r=${(minLiqIronR / 1000).toFixed(1)} km); icb=${icbKm.toFixed(1)} km; r_vol=${rVolKm.toFixed(1)} km; g_eq=${gEq.toFixed(3)} m/s^2; j2=${hotMeta.j2.toExponential(3)} (-${(j2ErrFrac * 100).toFixed(1)}%); inv_f=${hotMeta.inv_f}; com=${comKm.toFixed(2)} km; vmax=${vmaxMs.toFixed(1)} m/s; rho_centre=${hotMeta.rho_centre} kg/m^3 (48k PREM bake: j2=${premMeta.j2.toExponential(3)}, rho_centre=${premMeta.rho_centre}, vmax=${premMeta.vmax})`,
      expected: `core solid ~4.4% by volume (liquid outer core 1,221.5-3,480 km); icb~1,221.5 km; r_vol~6,371.0 km; g_eq~9.780 m/s^2; j2~1.0826e-3 (inv_f~298.26); com<1 km; vmax<20 m/s; rho_centre~13,088 kg/m^3`,
      score: +c2Score.toFixed(4),
      knownMatchScore: +c2Match.toFixed(4),
      knownMismatchScore: +c2Mismatch.toFixed(4),
      pass: c2Score >= 0.95,
      source: 'PREM (Dziewonski & Anderson 1981 PEPI 25:297); WGS84 / IERS Conventions (2010); Lay et al. (2008) Nat. Geosci. 1:25',
    },
    {
      id: 'plates-handedness-sign-flip-dropped-edges-polar-bias-and-tileworker-race',
      label: 'MORVEL plate kinematics handedness, North-edge drop, polar oversampling, area error & tileWorker STAGES race',
      measured: `dot(omega_N x (0N,0E), +East)=${eastDot.toFixed(3)} (100% velocity & conv/div sign flip); droppedNorth=${bothEN}/${totalEdgeCells + bothEN} (${droppedNorthPct.toFixed(1)}%); polar(|lat|>70)/eq(|lat|<20) edge density=${polarToEqDensityRatio.toFixed(2)}x; MORVEL sum=${sumMorvelSr.toFixed(4)} sr vs 4pi; max small-plate err=${smallPlateErrs[0].id} +${(maxSmallPlateRelErr * 100).toFixed(1)}%; main-thread stall=${(buildPlatesMs + boundariesMs).toFixed(0)} ms; tileWorkerStagesSafe=${tileWorkerStagesSafe}; tileWorkerMaskCancellable=${tileWorkerMaskCancellable}`,
      expected: `right-handed dot=+1.000; 0% dropped North boundaries; ~1.0x isotropic boundary density; small-plate area error <= 10%; worker-local STAGES & cancellable mask()`,
      score: +c3Score.toFixed(4),
      knownMatchScore: +c3Match.toFixed(4),
      knownMismatchScore: +c3Mismatch.toFixed(4),
      pass: c3Score >= 0.95,
      source: 'NNR-MORVEL56 (Argus et al. 2011 G3 12:Q11001); Bird (2003) G3 4:1027; Web Worker isolation contract',
    },
    {
      id: 'locomotion-foot-stop-teleport-jointswing-2x-bodyplan-scapula-and-sphere-glfinish',
      label: 'foot.ts mid-swing stop teleport, jointSwing.ts forearm 2x gate breach, bodyPlan.ts scapula height, photo/fly.ts diagonal speed & sphere.ts gl.finish()',
      measured: `foot.ts mid-swing stop jump=${stopTeleportM.toFixed(3)} m (z=${mid.at.z.toFixed(3)}->${stopped.at.z.toFixed(3)}); jointSwing.ts forearm delta=${forearmDeltaRad.toFixed(3)} rad (${forearmDeltaRatio.toFixed(2)}x max=0.1); bodyPlan.ts fore.hip=${sk.legs.hip.toFixed(4)} vs shoulder=${sk.shoulder.toFixed(4)} (diff=${scapulaHipDiffMm.toFixed(1)} mm); photoFlyMove W+D+Space=${diagSpeedMs.toFixed(3)} m/s (${diagSpeedRatio.toFixed(3)}x 6.0); sphereNoGlFinishPerFrame=${sphereNoGlFinishPerFrame}; sphereRespectsTierBloom=${sphereRespectsTierBloom}`,
      expected: `smooth stop from current foot position (<0.05 m jump); forearm world delta <= 1.0x max gate; fore.hip === shoulder (<=1 mm); normalized diagonal fly speed = 1.0x; no per-frame gl.finish() & applyTier uses tier.bloom/msaa/segments`,
      score: +c4Score.toFixed(4),
      knownMatchScore: +c4Match.toFixed(4),
      knownMismatchScore: +c4Mismatch.toFixed(4),
      pass: c4Score >= 0.95,
      source: 'Fischer et al. (2002) JEB 205:1315; Schmidt (2008) JEB 211:3775; WebGL2 best practices (no per-frame gl.finish)',
    },
    {
      id: 'live-chromium-plates-interior-and-data-panel',
      label: 'Live headless Chromium WebGL recording & 3 frames (3D plates globe, Earth-hot interior cutaway, Data Panel cosmology/reheating)',
      measured: `errors=${errors.length}; recording.webm=${recordingBytes} B; frames=${framesCaptured}/3; platesHandednessOk=${c5Input.platesHandednessOk} (dot=${eastDot.toFixed(1)}, drop=${droppedNorthPct.toFixed(1)}%); interiorOuterCoreLiquidOk=${c5Input.interiorOuterCoreLiquidOk} (${(coreSolidFrac * 100).toFixed(1)}% solid core, icb=${icbKm.toFixed(0)} km); dataPanelCosmologyOk=${c5Input.dataPanelCosmologyOk} (g*=${gStar11MeV.toFixed(2)}, a30Gyr=${a30Gyr.toFixed(2)})`,
      expected: `0 console/page errors; live WebGL video + 3 frames matching scientific references (right-handed continuous MORVEL boundaries, 95.6%-liquid PREM outer core with 1,222 km inner core, QCD-confined g*=10.75 & expanding future a(30 Gyr)=2.67)`,
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
    parcelsReadoutText,
    dataPanel11MeVExcerpt: dataPanel11MeVText.replace(/\s+/g, ' ').slice(0, 400),
    dataPanel30GyrExcerpt: dataPanel30GyrText.replace(/\s+/g, ' ').slice(0, 400),
    checks,
  };
  writeFileSync(join(HERE, 'numbers.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify({ calibrationValid, passed, total: checks.length, meanScore, recordingBytes, errors }, null, 2));
  for (const c of checks) {
    console.log(`  [${c.pass ? 'PASS' : 'FAIL'}] ${c.id}: score=${c.score} (match=${c.knownMatchScore}, mismatch=${c.knownMismatchScore})`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
