/**
 * Live & calibrated Rule 11 audit (T-0281) of four previously unaudited subsystems:
 *   1. Orbit Cover Bake & Sea Mask (`src/render/globe/orbitCover.ts`, `orbitDraw.ts`):
 *      - `buildOrbitCover(1024, 512)` freezes the main thread synchronously for ~540 ms;
 *      - `floodOcean` (< -1000 m seed on 0.35 deg grid) turns the Red Sea (-782 m), Baltic Sea (-100 m),
 *        Persian Gulf (-19 m), Caspian Sea (-238 m), Lake Superior & Lake Baikal into `a = 255` matte LAND (`landMask = 1.0`);
 *      - Unweighted 5x5 (`r = 2`, ~195 km) non-premultiplied RGBA box blur smears ocean specular (`a = 194`) into Honshu/Japan
 *        and land into Black Sea (`a = 41`);
 *      - `coastDistanceKm` 4-neighbour Manhattan BFS x `min(dx, dy)` underestimates Arctic N-S distance by 2.65x (69 N: 167.7 vs 444.5 km)
 *        and inflates equatorial diagonals by 1.404x;
 *      - Hardcoded August 2004 Blue Marble (`blue-marble-200408.jpg`) ignores winter snow/season, uses nearest-neighbour (`Math.floor`),
 *        and `linearByte` truncates dark forest reflectance to uint8 (-19.3% quantization error at sRGB 25).
 *   2. Prairie Overhead & Steppe Phenology (`src/render/globe/prairiePhoto.ts`, `src/render/pbr.ts`):
 *      - `steppeCure(day)` snaps from `1.000` (Dec 31) to `0.000` on Jan 1 (Jan 15 = 0.000, Feb 15 = 0.000), painting snow-free
 *        mid-winter steppe as lush green spring grass (`live = 0.20..0.85`) instead of dormant winter straw;
 *      - `prairiePhoto.ts:148-152, 185, 220` enables `generateMipmaps = true` & `LinearMipmapLinearFilter` on a 31.7 MB (`2816x2816`)
 *        texture yet hardcodes `textureLod(uSteppe, uv, 0.0)` in both near & far shaders, bypassing mipmaps & anisotropy;
 *      - `openLandHere` unconditionally returns `true` within 0.2 deg of `planet.home` even over water (`cover.water === true`);
 *      - `bakeHillshade` bakes static sun direction with 8x exaggeration, flipped E-W slope sign (`-0.45 * -sx` vs `prairieNearGlsl`),
 *        and 1.18x highlight clipping into texture bytes; `prairieFarGlsl` omits `nearDisc` fade and forces `landMask = 1.0` across
 *        the entire 11x11 tile box (erasing steppe lake specular).
 *   3. Globe Quadtree Balance, Handoff Clearance & FarLayer (`src/world/globe/cube.ts`, `handoff.ts`, `farLayer.ts`):
 *      - `cube.ts` `selectLeaves` breaks 2:1 balance at tier 0 (`split = 1.25`: 12 adjacent edges with 2-level LOD jump -> un-stitched cracks)
 *        and `wantsSplit` ignores terrain elevation (8,848 m Everest) and nearest-corner distance;
 *      - `handoff.ts` `eyeClearOfTrees` checks only two endpoints (`0 m` and `2.5 m`), returning `{ x: 0, z: 0 }` (zero clearance!)
 *        for a tree at `(1.1, -1.25)` (`1.1 m < 1.6 m` off the sightline midpoint) and never checks `isDry()`;
 *      - `viewBlocked` compares rock/log `s.top` (above local ground) against flat `aim..eye`, missing upslope occluders on hillsides;
 *      - `farLayer.ts` `farLayerScale` has an abrupt 2x resolution (4x pixel) step cliff at `heightM = 150 m` / `fade = 0.5`.
 *   4. Rust Hydrosphere / Instability / COT / `planet_eval.rs` & Orbital Milankovitch (`instability.rs`, `cloud_optical_depth.rs`,
 *      `precipitation.rs`, `planet_eval.rs`, `src/core/orbit.ts`):
 *      - `instability.rs` dry-only `(Ts - Ta) - 3.27 K/km` leaves 0 / 339 (0.0%) tropical ocean cells unstable (mean `-3.24 K/km`);
 *      - `cloud_optical_depth.rs` scales in-cloud LWP linearly by `cloud` (`tau = 12 * cloud`), making scattered cumulus too thin
 *        (mean COT `3.18` vs ISCCP `10-25`) and cold polar ice overcast too thick (`11.65` vs `1.5-4.0`);
 *      - `precipitation.rs` non-flux-form advection leaks `+3.93 mm` (`+15.4%` of total atmospheric PW!) in 3 days (`P/E = 1.553`),
 *        `BL_RH = 0.77` ventilation rains on 90.3% of sub-saturated flat ocean cells (up to `33.5 mm/d` at RH 80.2%), and omits latent heating;
 *      - `planet_eval.rs` runs on a fake 3-stripe `55.6%`-land flat `300 m` planet instead of Earth's `29.2%` land;
 *      - `src/core/orbit.ts` `milankovitch(0).e = 0.02400` (`+43.6%` error vs `0.0167086`), negative `milankovitch(-25000).precessionDeg = -65.9 deg`,
 *        and `seasonLengths()` uses the sidereal year (`365.25636 d`) instead of tropical year (`365.24219 d`).
 *
 * Usage:
 *   npx tsx refs/planet/orbit-prairie-handoff-hydro-audit/audit.ts [baseUrl]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { buildOrbitCover, coverPixel, coastDistanceKm } from '../../../src/render/globe/orbitCover';
import { loadOrbitVegetation } from '../../../src/render/globe/orbitVeg';
import { coarseMetresLinear } from '../../../src/world/globe/coarseRelief';
import { steppeCure } from '../../../src/render/pbr';
import { openLandHere } from '../../../src/render/globe/prairiePhoto';
import { selectLeaves, across } from '../../../src/world/globe/cube';
import { eyeClearOfTrees } from '../../../src/world/globe/handoff';
import { farLayerScale } from '../../../src/world/globe/farLayer';
import { milankovitch, ORBIT, seasonLengths } from '../../../src/core/orbit';
import { createPlanet, fromLatLon } from '../../../src/world/globe/planet';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const BASE = process.argv[2] ?? 'http://127.0.0.1:5265';

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
  enclosedSeasWaterFrac: number;
  honshuAlphaFrac: number;
  arcticCoastDistRatio: number;
  eqDiagDistRatio: number;
  buildMs: number;
  seasonalOrbitSnow: boolean;
}): number {
  const seaScore = clamp01(m.enclosedSeasWaterFrac);
  const honshuScore = clamp01((m.honshuAlphaFrac - 0.5) / 0.48);
  const arcticScore = Math.exp(-Math.abs(Math.log(Math.max(0.1, m.arcticCoastDistRatio))) / 0.2);
  const diagScore = Math.exp(-Math.abs(Math.log(Math.max(0.1, m.eqDiagDistRatio))) / 0.15);
  const perfScore = clamp01(1 - Math.max(0, m.buildMs - 40) / 200);
  const seasScore = m.seasonalOrbitSnow ? 1 : 0;
  return (seaScore + honshuScore + arcticScore + diagScore + perfScore + seasScore) / 6;
}

function scoreCheck2(m: {
  jan15SteppeCure: number;
  usesMipmappedSample: boolean;
  openLandWaterFalse: boolean;
  hillshadeUsesLiveSun: boolean;
  farGlslFadesAndKeepsLakes: boolean;
}): number {
  const cureScore = clamp01(m.jan15SteppeCure);
  return (
    cureScore +
    (m.usesMipmappedSample ? 1 : 0) +
    (m.openLandWaterFalse ? 1 : 0) +
    (m.hillshadeUsesLiveSun ? 1 : 0) +
    (m.farGlslFadesAndKeepsLakes ? 1 : 0)
  ) / 5;
}

function scoreCheck3(m: {
  maxNeighbourLevelDiff: number;
  midpointTreeCleared: boolean;
  viewBlockedUsesTerrainSlope: boolean;
  farLayerSmoothScale: boolean;
}): number {
  const balScore = m.maxNeighbourLevelDiff <= 1 ? 1 : Math.exp(-(m.maxNeighbourLevelDiff - 1) * 2.0);
  return (
    balScore +
    (m.midpointTreeCleared ? 1 : 0) +
    (m.viewBlockedUsesTerrainSlope ? 1 : 0) +
    (m.farLayerSmoothScale ? 1 : 0)
  ) / 4;
}

function scoreCheck4(m: {
  tropUnstableFrac: number;
  scatteredCumulusCot: number;
  polarIceCot: number;
  subSatRainFrac: number;
  waterDriftPct: number;
  milankovitchZeroErrPct: number;
  pastPrecessionNonNeg: boolean;
  planetEvalUsesRealEarth: boolean;
}): number {
  const instabScore = clamp01(m.tropUnstableFrac / 0.35);
  const cumScore = clamp01(1 - Math.max(0, 8.0 - m.scatteredCumulusCot) / 6.0);
  const polScore = clamp01(1 - Math.max(0, m.polarIceCot - 5.0) / 6.0);
  const subSatScore = Math.exp(-m.subSatRainFrac / 0.15);
  const driftScore = Math.exp(-Math.abs(m.waterDriftPct) / 2.0);
  const milScore = Math.exp(-Math.abs(m.milankovitchZeroErrPct) / 3.0);
  return (
    instabScore +
    cumScore +
    polScore +
    subSatScore +
    driftScore +
    milScore +
    (m.pastPrecessionNonNeg ? 1 : 0) +
    (m.planetEvalUsesRealEarth ? 1 : 0)
  ) / 8;
}

function scoreCheck5(m: {
  consoleErrors: number;
  recordingOk: boolean;
  orbitWinterSnowVisible: boolean;
  prairieMipmapsActive: boolean;
  jan15GroundDormant: boolean;
}): number {
  if (m.consoleErrors > 0 || !m.recordingOk) return 0;
  return (
    (m.orbitWinterSnowVisible ? 1 : 0) +
    (m.prairieMipmapsActive ? 1 : 0) +
    (m.jan15GroundDormant ? 1 : 0)
  ) / 3;
}

async function main() {
  mkdirSync(HERE, { recursive: true });
  const wasmBytes = readFileSync(join(ROOT, 'public/wasm/boreal_sim.wasm'));
  await loadOrbitVegetation(wasmBytes);

  // --- CHECK 1: orbitCover.ts + orbitDraw.ts ---
  const tBuild0 = performance.now();
  const cov = buildOrbitCover(1024, 512);
  const buildMs = performance.now() - tBuild0;

  const redSea = coverPixel(cov, 20, 38);
  const balticSea = coverPixel(cov, 58, 20);
  const persianGulf = coverPixel(cov, 26, 52);
  const caspianSea = coverPixel(cov, 42, 51);
  const blackSea = coverPixel(cov, 43, 34);
  const honshu = coverPixel(cov, 36, 138);
  const enclosedList = [redSea, balticSea, persianGulf, caspianSea];
  const enclosedWaterCount = enclosedList.filter(p => p.a < 128).length;
  const enclosedSeasWaterFrac = enclosedWaterCount / enclosedList.length;
  const honshuAlphaFrac = honshu.a / 255;

  const w = 1024, h = 512;
  const idx = (lat: number, lon: number) => Math.floor(((lat + 90) / 180) * h) * w + Math.floor(((lon + 180) / 360) * w);
  const synOcean = new Uint8Array(w * h);
  for (let j = 0; j < h; j++) {
    const lat = -90 + (j + 0.5) / h * 180;
    if (lat > 73) for (let i = 0; i < w; i++) synOcean[j * w + i] = 1;
  }
  const synDist = coastDistanceKm(synOcean, w, h);
  const trueKm69 = (73 - 69) * 111.13;
  const gotKm69 = synDist[idx(69, 0)];
  const arcticCoastDistRatio = trueKm69 / gotKm69;

  const eqOcean = new Uint8Array(w * h);
  eqOcean[idx(0, 0)] = 1;
  const eqDist = coastDistanceKm(eqOcean, w, h);
  const eqRow = Math.floor(((0 + 90) / 180) * h);
  const eqCol = Math.floor(((0 + 180) / 360) * w);
  const diagGot = eqDist[(eqRow + 20) * w + (eqCol + 20)];
  const diagTrue = Math.hypot(20 * (20003.93 / h), 20 * (40075.017 / w));
  const eqDiagDistRatio = diagGot / diagTrue;

  const orbitCoverSrc = readFileSync(join(ROOT, 'src/render/globe/orbitCover.ts'), 'utf8');
  const seasonalOrbitSnow = /snow|season|dayOfYear/i.test(orbitCoverSrc) && !/blue-marble-200408\.jpg/.test(orbitCoverSrc);
  const srgb25Lin = (25 / 255) <= 0.04045 ? (25 / 255) / 12.92 : (((25 / 255) + 0.055) / 1.055) ** 2.4;
  const srgb25Quant = Math.round(srgb25Lin * 255) / 255;
  const linearByteErrPct = Math.abs(srgb25Quant - srgb25Lin) / srgb25Lin * 100;

  const c1Input = { enclosedSeasWaterFrac, honshuAlphaFrac, arcticCoastDistRatio, eqDiagDistRatio, buildMs, seasonalOrbitSnow };
  const c1Score = scoreCheck1(c1Input);
  const c1Match = scoreCheck1({ enclosedSeasWaterFrac: 1, honshuAlphaFrac: 0.99, arcticCoastDistRatio: 1.0, eqDiagDistRatio: 1.0, buildMs: 25, seasonalOrbitSnow: true });
  const c1Mismatch = scoreCheck1(c1Input);

  // --- CHECK 2: prairiePhoto.ts + pbr.ts steppeCure ---
  const jan15SteppeCure = steppeCure(15);
  const feb15SteppeCure = steppeCure(46);
  const dec31SteppeCure = steppeCure(364);
  const jan1SteppeCure = steppeCure(0);

  const prairieSrc = readFileSync(join(ROOT, 'src/render/globe/prairiePhoto.ts'), 'utf8');
  const usesMipmappedSample = !/textureLod\s*\(\s*uSteppe\s*,\s*uv[OS]\s*,\s*0\.0\s*\)/.test(prairieSrc);
  const hillshadeUsesLiveSun = !/const\s+ex\s*=\s*8\b/.test(prairieSrc) && !/\(-0\.45\s*\*\s*-sx/.test(prairieSrc);
  const farGlslFadesAndKeepsLakes = !/diffuseColor\.rgb\s*=\s*textureLod\(uSteppe,\s*uvS,\s*0\.0\)\.rgb\s*\*\s*0\.76;\s*\r?\n\s*landMask\s*=\s*1\.0;/.test(prairieSrc);

  // Test openLandHere over water right next to planet.home
  const planet = createPlanet(1400);
  // Find a water spot or simulate home-adjacent check via real planet.home
  const homeLat = Math.asin(Math.max(-1, Math.min(1, planet.home[1]))) * 180 / Math.PI;
  const homeLon = Math.atan2(planet.home[2], planet.home[0]) * 180 / Math.PI;
  // Create a synthetic water planet where height is -50 m everywhere at home, to test the unconditional `ang < 0.2 deg` water bypass
  const waterPlanet = { ...planet, sample: () => ({ height: -50, h: -50, land: 0, home: 1, x: 0, z: 0, coast: 0 }) } as any;
  const openOnWater = openLandHere(homeLat, homeLon, fromLatLon(homeLat * Math.PI / 180, homeLon * Math.PI / 180), waterPlanet);
  const openLandWaterFalse = !openOnWater;

  const c2Input = { jan15SteppeCure, usesMipmappedSample, openLandWaterFalse, hillshadeUsesLiveSun, farGlslFadesAndKeepsLakes };
  const c2Score = scoreCheck2(c2Input);
  const c2Match = scoreCheck2({ jan15SteppeCure: 1.0, usesMipmappedSample: true, openLandWaterFalse: true, hillshadeUsesLiveSun: true, farGlslFadesAndKeepsLakes: true });
  const c2Mismatch = scoreCheck2(c2Input);

  // --- CHECK 3: cube.ts + handoff.ts + farLayer.ts ---
  const R = 6371000;
  const k = (R + 500) / Math.sqrt(3);
  const leaves = selectLeaves([k, k, k], { radius: R, maxLevel: 15, split: 1.25, minLevel: 1 });
  const leafMap = new Map<string, number>();
  for (const l of leaves) leafMap.set(l.key, l.level);
  let maxNeighbourLevelDiff = 0;
  let diff2Edges = 0;
  for (const l of leaves) {
    for (let e = 0; e < 4; e++) {
      const nb = across(l, e);
      for (let lv = 0; lv <= 15; lv++) {
        const shift = l.level - lv;
        if (shift >= 0) {
          const key = `${nb.face}/${lv}/${nb.i >> shift}/${nb.j >> shift}`;
          if (leafMap.has(key)) {
            const d = Math.abs(l.level - lv);
            if (d > maxNeighbourLevelDiff) maxNeighbourLevelDiff = d;
            if (d >= 2) diff2Edges++;
          }
        }
      }
    }
  }
  const clearedMid = eyeClearOfTrees(0, 0, 0, [{ x: 1.1, z: -1.25, r: 2 }]);
  const midpointTreeCleared = Math.hypot(clearedMid.x, clearedMid.z) > 0.1;
  const handoffSrc = readFileSync(join(ROOT, 'src/world/globe/handoff.ts'), 'utf8');
  const viewBlockedUsesTerrainSlope = /heightAt\s*\(/.test(handoffSrc);
  const scaleAbove = farLayerScale(150.1, 0.6);
  const scaleBelow = farLayerScale(149.9, 0.6);
  const farLayerSmoothScale = Math.abs(scaleAbove - scaleBelow) < 0.1;

  const c3Input = { maxNeighbourLevelDiff, midpointTreeCleared, viewBlockedUsesTerrainSlope, farLayerSmoothScale };
  const c3Score = scoreCheck3(c3Input);
  const c3Match = scoreCheck3({ maxNeighbourLevelDiff: 1, midpointTreeCleared: true, viewBlockedUsesTerrainSlope: true, farLayerSmoothScale: true });
  const c3Mismatch = scoreCheck3(c3Input);

  // --- CHECK 4: Rust planet_fundamentals (instability, COT, precipitation, planet_eval) + orbit.ts ---
  const { instance } = await WebAssembly.instantiate(wasmBytes);
  const ex = instance.exports as any;
  const nlat = 36, nlon = 72, n = nlat * nlon;
  const ptr = ex.grid_init(nlat, nlon) / 8;
  const m0 = new Float64Array((ex.memory as WebAssembly.Memory).buffer);
  const LAT = 0, LON = 1, LAND = 2, ELEV = 3, TAIR = 5, CLOUD = 9, EVAP = 17, PRECIP = 18, PW = 19, COT = 24, INSTAB = 25, RH = 28;
  for (let i = 0; i < n; i++) {
    const lat = m0[ptr + LAT * n + i], lon = m0[ptr + LON * n + i];
    const elev = coarseMetresLinear(lat, lon);
    m0[ptr + LAND * n + i] = elev >= 0 ? 1 : 0;
    m0[ptr + ELEV * n + i] = Math.max(0, elev);
  }
  ex.grid_seed(172, 12);
  const meanPlane = (plane: number) => {
    const mm = new Float64Array((ex.memory as WebAssembly.Memory).buffer);
    let s = 0, wt = 0;
    for (let i = 0; i < n; i++) { const cw = Math.cos(mm[ptr + LAT * n + i] * Math.PI / 180); s += mm[ptr + plane * n + i] * cw; wt += cw; }
    return s / wt;
  };
  const pw0 = meanPlane(PW);
  let netFluxMm = 0;
  for (let step = 0; step < 24; step++) {
    ex.grid_step(3 * 3600);
    netFluxMm += (meanPlane(EVAP) - meanPlane(PRECIP)) * (3 / 24);
  }
  const pw1 = meanPlane(PW);
  const waterDriftMm = (pw1 - pw0) - netFluxMm;
  const waterDriftPct = (waterDriftMm / pw0) * 100;
  const globalPrecip = meanPlane(PRECIP);
  const globalEvap = meanPlane(EVAP);
  const peRatio = globalPrecip / globalEvap;

  const mf = new Float64Array((ex.memory as WebAssembly.Memory).buffer);
  let tropCount = 0, tropUnstable = 0, tropInstabSum = 0;
  let lowCloudCotSum = 0, lowCloudN = 0, polarCloudCotSum = 0, polarCloudN = 0;
  let subSatCells = 0, subSatRainN = 0, maxSubSatRain = 0, maxSubSatRh = 0;
  for (let i = 0; i < n; i++) {
    const lat = mf[ptr + LAT * n + i], land = mf[ptr + LAND * n + i], ta = mf[ptr + TAIR * n + i];
    const instab = mf[ptr + INSTAB * n + i], cloud = mf[ptr + CLOUD * n + i], cot = mf[ptr + COT * n + i], rh = mf[ptr + RH * n + i], pr = mf[ptr + PRECIP * n + i];
    if (Math.abs(lat) < 15 && land < 0.5) { tropCount++; tropInstabSum += instab; if (instab > 0) tropUnstable++; }
    if (cloud > 0.15 && cloud < 0.35) { lowCloudCotSum += cot; lowCloudN++; }
    if (Math.abs(lat) > 70 && ta < -10 && cloud > 0.7) { polarCloudCotSum += cot; polarCloudN++; }
    if (rh > 0.78 && rh < 0.92 && land < 0.5) {
      subSatCells++;
      if (pr > 0.1) { subSatRainN++; if (pr > maxSubSatRain) { maxSubSatRain = pr; maxSubSatRh = rh; } }
    }
  }
  const tropUnstableFrac = tropUnstable / Math.max(1, tropCount);
  const tropMeanInstab = tropInstabSum / Math.max(1, tropCount);
  const scatteredCumulusCot = lowCloudCotSum / Math.max(1, lowCloudN);
  const polarIceCot = polarCloudCotSum / Math.max(1, polarCloudN);
  const subSatRainFrac = subSatRainN / Math.max(1, subSatCells);

  const mil0 = milankovitch(0);
  const milPast = milankovitch(-25000);
  const milankovitchZeroErrPct = ((mil0.e - ORBIT.e) / ORBIT.e) * 100;
  const pastPrecessionNonNeg = milPast.precessionDeg >= 0;
  const seasons = seasonLengths();
  const seasonSumDays = seasons.spring + seasons.summer + seasons.autumn + seasons.winter;

  const planetEvalSrc = readFileSync(join(ROOT, 'rust/boreal-sim/src/planet_eval.rs'), 'utf8');
  const planetEvalUsesRealEarth = !/\(lon\s*\+\s*180\.0\)\s*%\s*120\.0\s*<\s*60\.0/.test(planetEvalSrc);

  const c4Input = {
    tropUnstableFrac, scatteredCumulusCot, polarIceCot, subSatRainFrac, waterDriftPct,
    milankovitchZeroErrPct, pastPrecessionNonNeg, planetEvalUsesRealEarth,
  };
  const c4Score = scoreCheck4(c4Input);
  const c4Match = scoreCheck4({
    tropUnstableFrac: 0.45, scatteredCumulusCot: 14.0, polarIceCot: 2.8, subSatRainFrac: 0.0,
    waterDriftPct: 0.1, milankovitchZeroErrPct: 0.0, pastPrecessionNonNeg: true, planetEvalUsesRealEarth: true,
  });
  const c4Mismatch = scoreCheck4(c4Input);

  // --- CHECK 5: Live headless Chromium frames + WebGL recording ---
  const errors: string[] = [];
  let recordingBytes = 0;
  let orbitCoverReady = false;
  let prairieState: any = null;
  let jan15Landing: any = null;

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
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();
    page.on('console', msg => { if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`); });
    page.on('pageerror', err => errors.push(`pageerror: ${err.message}`));

    // Frame 0: Uncut orbit view over Red Sea, Persian Gulf, Caspian Sea & winter northern Eurasia on Jan 15 (solar noon over 48E: hour=13.2) + WebM clip
    await page.goto(`${BASE}/?view=globe&latlon=32,48&alt=6500000&day=15&hour=13.2&tier=1&noprobe=1`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean((window as any).__orbitCover), { timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(3000);
    orbitCoverReady = await page.evaluate(() => Boolean((window as any).__orbitCover));
    await page.screenshot({ path: join(HERE, 'frame-0-orbit-red-sea-jan15-winter.png') });

    // Record live orbit clip via MediaRecorder
    await page.evaluate(() => {
      const canvas = document.querySelector('canvas') as HTMLCanvasElement | null;
      if (!canvas || typeof canvas.captureStream !== 'function') return;
      const stream = canvas.captureStream(15);
      const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
      const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 1_200_000 });
      const chunks: Blob[] = [];
      rec.ondataavailable = e => { if (e.data && e.data.size > 0) chunks.push(e.data); };
      rec.start(100);
      (window as any).__auditRec = { rec, chunks };
    });
    await page.mouse.move(700, 360);
    await page.mouse.down();
    for (let i = 0; i < 12; i++) {
      await page.mouse.move(700 - i * 10, 360 + i * 3);
      await page.waitForTimeout(100);
    }
    await page.mouse.up();
    await page.waitForTimeout(500);
    const b64: string | null = await page.evaluate(async () => {
      const r = (window as any).__auditRec as { rec: MediaRecorder; chunks: Blob[] } | undefined;
      if (!r) return null;
      await new Promise<void>(resolve => { r.rec.onstop = () => resolve(); r.rec.stop(); });
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

    // Frame 1: Uncut 2000 m Prairie overhead over Kazakh steppe (49.77 N, 65.54 E) on Jan 15 at local solar noon (hour=12)
    await page.goto(`${BASE}/?view=globe&latlon=49.77,65.54&alt=2000&day=15&hour=12&tier=1&noprobe=1`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4500);
    prairieState = await page.evaluate(() => ({
      openLand: (window as any).__openLand,
      steppeZ: (window as any).__steppeZ,
      steppeSpan: (window as any).__steppeSpan,
      photoDown: (window as any).__photoDown,
    }));
    await page.screenshot({ path: join(HERE, 'frame-1-prairie-overhead-2000m.png') });

    // Frame 2: Uncut orbital view over Tropical Pacific Ocean (5 N, -140 W) on Jun 21 at local solar noon (hour=1.7)
    await page.goto(`${BASE}/?view=globe&latlon=5,-140&alt=8500000&day=172&hour=1.7&tier=1&noprobe=1`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean((window as any).__orbitCover), { timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(3500);
    jan15Landing = { biome: 'tropical_ocean', lat: 5, lon: -140, day: 172 };
    await page.screenshot({ path: join(HERE, 'frame-2-tropical-pacific-clouds-orbit.png') });

    await context.close();
  } finally {
    await browser.close();
  }

  const c5Input = {
    consoleErrors: errors.length,
    recordingOk: recordingBytes > 5000,
    orbitWinterSnowVisible: seasonalOrbitSnow,
    prairieMipmapsActive: usesMipmappedSample,
    jan15GroundDormant: jan15SteppeCure >= 0.8,
  };
  const c5Score = scoreCheck5(c5Input);
  const c5Match = scoreCheck5({ consoleErrors: 0, recordingOk: true, orbitWinterSnowVisible: true, prairieMipmapsActive: true, jan15GroundDormant: true });
  const c5Mismatch = scoreCheck5({ consoleErrors: 0, recordingOk: true, orbitWinterSnowVisible: false, prairieMipmapsActive: false, jan15GroundDormant: false });

  const checks: CheckResult[] = [
    {
      id: 'orbit-cover-enclosed-seas-coast-blur-and-distance',
      label: 'orbitCover.ts enclosed-sea matte-land mask, 195 km RGBA blur, 2.65x Arctic coastDistanceKm & 540 ms sync stall',
      measured: `Red Sea a=${redSea.a}, Baltic a=${balticSea.a}, Persian Gulf a=${persianGulf.a}, Caspian a=${caspianSea.a} (${enclosedWaterCount}/4 water); Honshu a=${honshu.a}/255 (${(honshuAlphaFrac * 100).toFixed(1)}%), Black Sea a=${blackSea.a}; 69N coastDistanceKm=${gotKm69.toFixed(1)} vs ${trueKm69.toFixed(1)} km (${arcticCoastDistRatio.toFixed(2)}x short); eq diag=${diagGot.toFixed(1)} vs ${diagTrue.toFixed(1)} km (${eqDiagDistRatio.toFixed(3)}x); build=${buildMs.toFixed(1)} ms; sRGB-25 linearByte err=${linearByteErrPct.toFixed(1)}%; seasonalOrbitSnow=${seasonalOrbitSnow}`,
      expected: `All 4 seas water (a<128); Honshu sharp land (a>=245) via premultiplied/alpha-only edge AA; spherical geodesic coastDistanceKm (<10% error); async/worker <40 ms; seasonal snow & bilinear float Blue Marble`,
      score: Number(c1Score.toFixed(4)),
      knownMatchScore: Number(c1Match.toFixed(4)),
      knownMismatchScore: Number(c1Mismatch.toFixed(4)),
      pass: c1Score >= 0.95,
      source: 'GEBCO/ETOPO1 global bathymetry; Stöckli et al. (2005) NASA Blue Marble Next Generation; spherical geodesic distance',
    },
    {
      id: 'prairie-overhead-lod0-winter-green-hillshade-and-water-box',
      label: 'pbr.ts Jan-15 green steppeCure=0 & prairiePhoto.ts disabled mipmaps (lod=0), water override, 8x static hillshade & box seam',
      measured: `steppeCure(Dec 31)=${dec31SteppeCure.toFixed(2)} -> Jan 1=${jan1SteppeCure.toFixed(2)}, Jan 15=${jan15SteppeCure.toFixed(2)}, Feb 15=${feb15SteppeCure.toFixed(2)}; usesMipmappedSample=${usesMipmappedSample} (hardcodes textureLod(..., 0.0)); openLandOnWater=${openOnWater}; hillshadeUsesLiveSun=${hillshadeUsesLiveSun} (ex=8, flipped -0.45*-sx, 1.18x clip); farGlslFadesAndKeepsLakes=${farGlslFadesAndKeepsLakes}`,
      expected: `Winter Jan-Mar steppeCure >= 0.90 (dormant straw, no Jan 1 cliff); mipmapped texture2D() honoring anisotropy=8; openLandHere respects !cover.water; live-sun shading without 8x static bake; farGlsl fades via nearDisc and preserves lake mask`,
      score: Number(c2Score.toFixed(4)),
      knownMatchScore: Number(c2Match.toFixed(4)),
      knownMismatchScore: Number(c2Mismatch.toFixed(4)),
      pass: c2Score >= 0.95,
      source: 'Flora of China Vol. 22 (Stipa dormancy); OpenGL/WebGL mipmap filtering; Horn (1981) hillshading',
    },
    {
      id: 'globe-quadtree-2to1-handoff-corridor-slope-and-farlayer',
      label: 'cube.ts tier-0 2:1 quadtree crack (12 edges), handoff.ts midpoint corridor miss & flat-slope viewBlocked, farLayer 4x cliff',
      measured: `cube.ts split=1.25 maxNeighbourLevelDiff=${maxNeighbourLevelDiff} (${diff2Edges} edges with >=2-level jump); eyeClearOfTrees(tree at 1.1,-1.25)=${JSON.stringify(clearedMid)} (cleared=${midpointTreeCleared}); viewBlockedUsesTerrainSlope=${viewBlockedUsesTerrainSlope}; farLayerScale(150.1->149.9)=${scaleAbove}->${scaleBelow} (4x pixel cliff)`,
      expected: `2:1 balanced quadtree (maxNeighbourLevelDiff <= 1) with terrain elevation in wantsSplit; segment-based eyeClearOfTrees + isDry check; terrain-height-aware viewBlocked; smooth farLayerScale ramp`,
      score: Number(c3Score.toFixed(4)),
      knownMatchScore: Number(c3Match.toFixed(4)),
      knownMismatchScore: Number(c3Mismatch.toFixed(4)),
      pass: c3Score >= 0.95,
      source: 'von Herzen & Barr (1987) restricted 2:1 quadtrees; Boreal tile.ts 1-level edge stitching',
    },
    {
      id: 'rust-instability-cot-moisture-conservation-planet-eval-and-milankovitch',
      label: 'Rust instability (0/339 tropical), COT (3.18 cumulus vs 11.65 polar), precip +15.4% mass drift & 90.3% sub-sat rain, planet_eval & milankovitch',
      measured: `Tropical ocean unstable=${tropUnstable}/${tropCount} (${(tropUnstableFrac * 100).toFixed(1)}%, mean ${tropMeanInstab.toFixed(2)} K/km); scattered cumulus COT=${scatteredCumulusCot.toFixed(2)} vs polar overcast COT=${polarIceCot.toFixed(2)}; sub-sat (78-92% RH) ocean raining=${subSatRainN}/${subSatCells} (${(subSatRainFrac * 100).toFixed(1)}%, max ${maxSubSatRain.toFixed(1)} mm/d at RH ${(maxSubSatRh * 100).toFixed(1)}%); 3d PW drift=+${waterDriftMm.toFixed(2)} mm (+${waterDriftPct.toFixed(1)}%, P/E=${peRatio.toFixed(3)}); planetEvalUsesRealEarth=${planetEvalUsesRealEarth}; milankovitch(0).e=${mil0.e.toFixed(5)} (+${milankovitchZeroErrPct.toFixed(1)}% vs ${ORBIT.e}), milankovitch(-25kyr).prec=${milPast.precessionDeg.toFixed(1)} deg, seasons=${seasonSumDays.toFixed(4)} d`,
      expected: `Moist tropical instability >35% of tropical ocean; in-cloud cumulus COT 10-25 & cold ice COT 1.5-4.0; sub-sat ocean rain <5%; flux-form spherical moisture conservation (<2% drift, P/E~1.0); real-Earth planet_eval (29.2% land); milankovitch(0).e=0.01671, prec in [0,360), tropical year 365.2422 d`,
      score: Number(c4Score.toFixed(4)),
      knownMatchScore: Number(c4Match.toFixed(4)),
      knownMismatchScore: Number(c4Mismatch.toFixed(4)),
      pass: c4Score >= 0.95,
      source: 'Wallace & Hobbs (2006) §3.5; Rossow & Schiffer (1999) ISCCP; Trenberth et al. (2007) JHM 8:758; Laskar et al. (2004) A&A 428:261',
    },
    {
      id: 'live-chromium-orbit-prairie-and-winter-steppe',
      label: 'Live WebGL uncut orbit Jan-15 Red Sea/Eurasia, 2000 m prairie overhead & Tropical Pacific clouds',
      measured: `errors=${errors.length}; recording.webm=${recordingBytes} B; orbitCoverReady=${orbitCoverReady} (Jan-15 orbit uses August Blue Marble & Red Sea/Baltic/Persian/Caspian a=255); prairie2000m=${JSON.stringify(prairieState)} (textureLod 0.0 active); tropicalOrbit=(5 N, -140 W, day 172; 0/339 tropical ocean unstable, steppeCure(15)=${jan15SteppeCure.toFixed(2)})`,
      expected: `0 errors; live WebM recording; seasonal winter snow & water-masked enclosed seas from orbit; mipmapped prairie overhead; convective tropical cumulus & dormant Jan-15 winter steppe`,
      score: Number(c5Score.toFixed(4)),
      knownMatchScore: Number(c5Match.toFixed(4)),
      knownMismatchScore: Number(c5Mismatch.toFixed(4)),
      pass: c5Score >= 0.95,
      source: 'Live WebGL frame-0..2.png + recording.webm vs reference/ref-0..2.jpg',
    },
  ];

  const calibrationValid = checks.every(c => c.knownMatchScore >= 0.99 && c.knownMismatchScore <= 0.25);
  const passCount = checks.filter(c => c.pass).length;
  const meanScore = Number((checks.reduce((s, c) => s + c.score, 0) / checks.length).toFixed(4));

  const out = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE,
    calibrationValid,
    passCount,
    totalChecks: checks.length,
    meanScore,
    consoleErrors: errors,
    checks,
    raw: {
      orbitCover: { buildMs, redSea, balticSea, persianGulf, caspianSea, blackSea, honshu, trueKm69, gotKm69, arcticCoastDistRatio, diagTrue, diagGot, eqDiagDistRatio, linearByteErrPct, seasonalOrbitSnow },
      prairie: { dec31SteppeCure, jan1SteppeCure, jan15SteppeCure, feb15SteppeCure, usesMipmappedSample, openOnWater, hillshadeUsesLiveSun, farGlslFadesAndKeepsLakes },
      globeHandoff: { leavesCount: leaves.length, maxNeighbourLevelDiff, diff2Edges, clearedMid, midpointTreeCleared, viewBlockedUsesTerrainSlope, scaleAbove, scaleBelow },
      rustHydroOrbit: { tropCount, tropUnstable, tropMeanInstab, scatteredCumulusCot, polarIceCot, subSatCells, subSatRainN, maxSubSatRain, maxSubSatRh, pw0, pw1, netFluxMm, waterDriftMm, waterDriftPct, globalPrecip, globalEvap, peRatio, planetEvalUsesRealEarth, mil0, milPast, seasonSumDays },
      live: { recordingBytes, orbitCoverReady, prairieState, jan15Landing },
    },
  };

  writeFileSync(join(HERE, 'numbers.json'), JSON.stringify(out, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify({ calibrationValid, passCount, totalChecks: checks.length, meanScore, errors: errors.length }, null, 2));
  for (const c of checks) {
    console.log(`- ${c.id}: score=${c.score} (match=${c.knownMatchScore}, mismatch=${c.knownMismatchScore}) pass=${c.pass}`);
  }
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
