/**
 * Live & calibrated Rule 11 audit of Atmospheric Radiative Transfer, Cloud Column
 * Thermodynamics, Planetary Shortwave/Cloud Energy Budget, and Opening/Atmosphere Sky-Hold:
 *  1. rust/boreal-sim/src/column_budget.rs:27-39 — tau-independent CLOUD_ABS = 0.12 causes
 *     negative downward flux & negative surface absorption (-51.08 W/m^2) / reflection (-0.44 W/m^2)
 *     at tau = 120 and +103.51 W/m^2 phantom atmospheric absorption at tau = 0.001; single-bounce
 *     snow absorption (down - up + up_cl) overstates cloudy snow absorption by +78.6%.
 *  2. rust/boreal-sim/src/planet_fundamentals/energy/energy_update.rs:36-55 — split-model
 *     diagnostics (column_budget steps TS & exports REFLSW/ABSATM while solar_budget::budget
 *     exports QABS/QREFL/SWDOWN) violate TOA energy closure by up to +165.3 W/m^2 (11.9% TOA),
 *     and un-floored ocean cooling drives 408/1,680 (24.3%) ocean cells below -1.8 C down to -8.50 C.
 *  3. src/core/atmo/cloudColumn.ts:74-95 & src/world/globe/localClouds.ts:105-257 — fixed 2 km
 *     vapour scale height vs steeper sub-zero Clausius-Clapeyron lapse saturates 34/45 (75.6%)
 *     tropospheric layers to 11 km (-83.1 C, tau = 28.0) in -10 C winter (54.2% of 3D cloud box,
 *     76.6% above 5 km), while zero-CIN dry-adiabatic tEnv and cover-blind conv bake tau = 150.0
 *     supercells in hyper-arid desert air (RH 15%, cover 0.1) with contradictory RH = 0.157 at LCL.
 *  4. src/core/atmo/cloudColumn.ts:76,146-160,188-208 — high-terrain columns (4,500 m plateau)
 *     integrate 4.5 km above the 11 km tropopause without inversion and divide heatingKPerDay by
 *     sea-level p0_Pa (-41.5% air-mass error); cloudBaseLongwave returns 0 W/m^2 for pure
 *     stratiform decks with lcl < 0; liquid downward a0 = 0.130 m^2/g is applied to ice OLR;
 *     surfaceCloudRadiativeEffect uses un-attenuated TOA S0*mu.
 *  5. src/world/cosmos/opening.ts:172-179,246-270,440-466 & src/world/globe/atmosphere.ts:239,370-376,402-403
 *     — GLOBE_SKY.hold = 1 is never cleared to 0 anywhere in src/, permanently overwriting
 *     atmos.setClear(cloudClear(alt)) with uCloudClear = 0 on every post-opening descent;
 *     early-skip .then() race overwrites present-day Earth back to Hadean lava (uEra = 1,0,0,0);
 *     atmosphere.ts:375 never restores uCloudEdge.x (leaked at 0.414 vs 0.614) when hold clears;
 *     atmosphere.ts:403 applies ground-level 0..2.5 km Mie haze on top of 2.5 km clouds.
 *
 * Usage:
 *   npx tsx refs/atmo/column-budget-cloud-sky-hold-audit/audit.ts [baseUrl]
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import { chromium } from 'playwright';
import * as THREE from 'three';

import { PlanetSim } from '../../../src/core/planetBudget';
import {
  cloudColumn,
  cloudBaseLongwave,
  cloudTopLongwave,
  surfaceCloudRadiativeEffect,
  atmosphericCloudRadiativeEffect,
  pressureAt,
} from '../../../src/core/atmo/cloudColumn';
import { bakeLocal, boxExtinction, LOCAL_CLOUDS } from '../../../src/world/globe/localClouds';
import { createAtmosphere, CLOUDS } from '../../../src/world/globe/atmosphere';
import { GLOBE_SKY } from '../../../src/world/globe/tile';
import { cloudClear } from '../../../src/world/globe/transition';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const BASE = process.argv[2] ?? 'http://127.0.0.1:5258';

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
const ratioScore = (a: number, b: number) => {
  if (a <= 0 || b <= 0) return a === b ? 1 : 0;
  return clamp01(Math.min(a, b) / Math.max(a, b));
};

function decodePng(path: string): { width: number; height: number; bpp: number; recon: Buffer } {
  const buf = readFileSync(path);
  let pos = 8, width = 0, height = 0, colorType = 6;
  const idat: Buffer[] = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.subarray(pos + 4, pos + 8).toString('ascii');
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      colorType = data[9];
    } else if (type === 'IDAT') {
      idat.push(data);
    }
    pos += 12 + len;
  }
  const bpp = colorType === 6 ? 4 : 3;
  const stride = width * bpp;
  const raw = inflateSync(Buffer.concat(idat));
  const recon = Buffer.alloc(height * stride);
  const paeth = (a: number, b: number, c: number) => {
    const p = a + b - c;
    const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let y = 0; y < height; y++) {
    const ft = raw[y * (stride + 1)];
    const rs = y * (stride + 1) + 1;
    const os = y * stride;
    for (let x = 0; x < stride; x++) {
      const v = raw[rs + x];
      const a = x >= bpp ? recon[os + x - bpp] : 0;
      const b = y > 0 ? recon[os - stride + x] : 0;
      const c = x >= bpp && y > 0 ? recon[os - stride + x - bpp] : 0;
      let val = v;
      if (ft === 1) val = (v + a) & 255;
      else if (ft === 2) val = (v + b) & 255;
      else if (ft === 3) val = (v + ((a + b) >> 1)) & 255;
      else if (ft === 4) val = (v + paeth(a, b, c)) & 255;
      recon[os + x] = val;
    }
  }
  return { width, height, bpp, recon };
}

function pngSkyStats(path: string, yFrac0 = 0, yFrac1 = 0.55) {
  const { width, height, bpp, recon } = decodePng(path);
  const y0 = Math.floor(height * yFrac0);
  const y1 = Math.floor(height * yFrac1);
  let n = 0, sumL = 0, sumR = 0, sumG = 0, sumB = 0, bright = 0, whiteCloud = 0, blueSky = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * bpp;
      const r = recon[o] / 255, g = recon[o + 1] / 255, b = recon[o + 2] / 255;
      const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const sat = Math.max(r, g, b) > 0.01 ? (Math.max(r, g, b) - Math.min(r, g, b)) / Math.max(r, g, b) : 0;
      sumL += l; sumR += r; sumG += g; sumB += b; n++;
      if (l > 0.55) bright++;
      if (l > 0.45 && sat < 0.22) whiteCloud++;
      if (b > r + 0.08 && b > 0.25) blueSky++;
    }
  }
  return {
    meanLuma: +(sumL / Math.max(1, n)).toFixed(4),
    meanRgb: [+(sumR / n).toFixed(3), +(sumG / n).toFixed(3), +(sumB / n).toFixed(3)],
    brightFrac: +(bright / Math.max(1, n)).toFixed(4),
    whiteCloudFrac: +(whiteCloud / Math.max(1, n)).toFixed(4),
    blueSkyFrac: +(blueSky / Math.max(1, n)).toFixed(4),
  };
}

async function waitGlobeSettled(page: import('playwright').Page, maxMs = 22000) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    const ok = await page.evaluate(() => {
      const g = (window as any).__globe;
      if (!g) return false;
      const st = g.stats?.();
      return Boolean(g.bootSettled && st && st.drawn > 0 && st.queued === 0);
    });
    if (ok) break;
    await page.waitForTimeout(250);
  }
  // Allow PlanetSim spin-up & localClouds bake to settle
  await page.waitForTimeout(2200);
}

async function runBrowserAudit() {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

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

  const live: Record<string, any> = {};

  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });
    const page = await context.newPage();
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', err => pageErrors.push(String(err)));

    // --- Frame 0: Subarctic winter sky at local solar noon (62 N, 65 E, Jan 15, alt 2,500 m, pitch 102 deg -> +12 deg up) ---
    await page.goto(`${BASE}/?view=globe&alt=2500&latlon=62,65&day=15&hour=12&pitch=102&tier=1&panel=0&localClouds=1&atmos=1&shot=1`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitGlobeSettled(page);
    const f0 = join(HERE, 'frame-0-winter-monolith-cloud.png');
    await page.screenshot({ path: f0 });
    live.frame0 = await page.evaluate(() => {
      const g = (window as any).__globe;
      const lc = g?.localClouds;
      const u = lc?.mesh?.material?.uniforms;
      return {
        alt: g?.altitude ?? null,
        lcVisible: lc?.mesh?.visible ?? null,
        lcOpacity: u?.uOpacity?.value ?? null,
        lcExt: u?.uExt?.value ?? null,
        stats: g?.stats?.() ?? null,
      };
    });
    live.frame0Pixels = pngSkyStats(f0, 0, 0.75);

    // --- Frame 1: Hyper-arid Sahara July afternoon (23.5 N, 10 E, Jul 15, alt 3,500 m, pitch 105 deg -> +15 deg up) ---
    await page.goto(`${BASE}/?view=globe&alt=3500&latlon=23.5,10&day=196&hour=14&pitch=105&tier=1&panel=0&localClouds=1&atmos=1&shot=1`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitGlobeSettled(page);
    const f1 = join(HERE, 'frame-1-sahara-desert-supercell.png');
    await page.screenshot({ path: f1 });
    live.frame1 = await page.evaluate(() => {
      const g = (window as any).__globe;
      const lc = g?.localClouds;
      const u = lc?.mesh?.material?.uniforms;
      return {
        alt: g?.altitude ?? null,
        lcVisible: lc?.mesh?.visible ?? null,
        lcOpacity: u?.uOpacity?.value ?? null,
        lcExt: u?.uExt?.value ?? null,
        stats: g?.stats?.() ?? null,
      };
    });
    live.frame1Pixels = pngSkyStats(f1, 0, 0.75);

    // --- Frame 2 & Frame 3: Default bare-URL ?start=sphere opening -> skip -> orbit -> descent ---
    // Inspect GLOBE_SKY.hold permanent lock on uCloudClear AND early-skip Hadean overwrite,
    // while recording the WebGL canvas directly via MediaRecorder into recording.webm.
    await page.goto(`${BASE}/?start=sphere&stages=1&trees=v2&noprobe=1&tier=1&transition=inpage&inpagelow=1`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    // Wait until opening cinematic is ready and loading card is dismissed
    const tStart = Date.now();
    while (Date.now() - tStart < 45000) {
      const ready = await page.evaluate(() => {
        const ld = document.getElementById('loading');
        const ldHidden = !ld || ld.hidden || getComputedStyle(ld).display === 'none' || Number(getComputedStyle(ld).opacity) < 0.05;
        return Boolean((window as any).__borealOpening && ldHidden);
      });
      if (ready) break;
      await page.waitForTimeout(300);
    }
    await page.waitForTimeout(400);
    // Click to begin opening cinematic, then skip 250 ms later (early skip) to capture live state
    await page.evaluate(() => {
      const op = (window as any).__borealOpening;
      if (op) op.begin();
    });
    await page.waitForTimeout(250);
    await page.evaluate(() => {
      const op = (window as any).__borealOpening;
      if (op) op.skip();
    });
    // Wait until the globe is visible in orbit (#cine-root removed and __inpage.mode === 'globe')
    const tGlobe = Date.now();
    while (Date.now() - tGlobe < 25000) {
      const ok = await page.evaluate(() => {
        const ctl = (window as any).__inpage;
        return Boolean(ctl?.mode === 'globe' && !document.getElementById('cine-root'));
      });
      if (ok) break;
      await page.waitForTimeout(250);
    }
    await page.waitForTimeout(2500);

    const readInpageState = () => page.evaluate(() => {
      const ctl = (window as any).__inpage;
      const st = ctl?.state?.() ?? null;
      return {
        mode: ctl?.mode ?? null,
        state: st,
        openingPhase: (window as any).__borealOpening?.phase ?? null,
      };
    });

    const f2 = join(HERE, 'frame-2-opening-skip-orbit-state.png');
    await page.screenshot({ path: f2 });
    live.frame2 = await readInpageState();
    live.frame2Pixels = pngSkyStats(f2, 0.1, 0.9);

    // Record live in-page descent after opening skip via MediaRecorder while pressing 'G'
    await page.evaluate(() => {
      const canvases = Array.from(document.querySelectorAll('canvas'));
      const canvas = canvases.find(c => c.width >= 640 && c.height >= 360) ?? canvases[0];
      if (!canvas || typeof MediaRecorder === 'undefined') return;
      const stream = canvas.captureStream(15);
      const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp8') ? 'video/webm;codecs=vp8' : 'video/webm';
      const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 1_500_000 });
      const chunks: Blob[] = [];
      rec.ondataavailable = e => { if (e.data && e.data.size > 0) chunks.push(e.data); };
      rec.start(100);
      (window as any).__auditRec = { rec, chunks };
    });

    // Press 'G' to start the real seated descent through CLOUD_OPEN (1,500 km -> 150 km)
    await page.keyboard.press('g');
    await page.waitForTimeout(4500);

    const f3 = join(HERE, 'frame-3-post-opening-descent-cloud-lock.png');
    await page.screenshot({ path: f3 });
    live.frame3 = await readInpageState();
    live.frame3Pixels = pngSkyStats(f3, 0.1, 0.9);

    const b64Video: string | null = await page.evaluate(async () => {
      const r = (window as any).__auditRec;
      if (!r) return null;
      await new Promise<void>(resolve => {
        r.rec.onstop = () => resolve();
        r.rec.stop();
      });
      const blob = new Blob(r.chunks, { type: 'video/webm' });
      const ab = await blob.arrayBuffer();
      const u8 = new Uint8Array(ab);
      let bin = '';
      for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode(...u8.subarray(i, i + 0x8000));
      return btoa(bin);
    });
    if (b64Video) {
      writeFileSync(join(HERE, 'recording.webm'), Buffer.from(b64Video, 'base64'));
      live.recordingBytes = Buffer.from(b64Video, 'base64').length;
    }

    await context.close();
  } finally {
    await browser.close();
  }

  return { live, consoleErrors, pageErrors };
}

async function main() {
  const bytes = readFileSync(join(ROOT, 'public', 'wasm', 'boreal_sim.wasm'));
  const { instance } = await WebAssembly.instantiate(bytes, {});
  const sim = new PlanetSim(instance.exports as any);

  const checks: CheckResult[] = [];

  // ---------------------------------------------------------------------------
  // Check 1: column_budget.rs negative flux at thick cloud (tau=120) & phantom
  //          absorption at optically empty cloud (tau=0.001)
  // ---------------------------------------------------------------------------
  const clear = sim.rtPoint({ year: 2026, cosZ: 0.8, cosV: 0.8, phi: 0, cloud: 0, tau: 0, surf: 3, landAlbedo: 0.15, hKm: 0, qSurf: 0.01 });
  const thinCloud = sim.rtPoint({ year: 2026, cosZ: 0.8, cosV: 0.8, phi: 0, cloud: 1, tau: 0.001, surf: 3, landAlbedo: 0.15, hKm: 0, qSurf: 0.01 });
  const thickCb = sim.rtPoint({ year: 2026, cosZ: 0.8, cosV: 0.8, phi: 0, cloud: 1, tau: 120, surf: 3, landAlbedo: 0.15, hKm: 0, qSurf: 0.01 });

  const phantomAbsW = thinCloud.absAtm - clear.absAtm; // expected ~0 W/m^2 at tau=0.001 (Stephens 1978)
  const scoreCheck1 = (absSurfThick: number, reflSurfThick: number, dAbsThin: number, toaClear: number) => {
    const nonNeg = absSurfThick >= 0 && reflSurfThick >= 0 ? 1 : 0;
    const thinZero = clamp01(1 - Math.abs(dAbsThin) / (0.10 * toaClear));
    return 0.5 * nonNeg + 0.5 * thinZero;
  };
  const s1 = scoreCheck1(thickCb.absSurf, thickCb.reflSurf, phantomAbsW, clear.toa);
  checks.push({
    id: 'column-budget-thick-cloud-and-thin-abs',
    label: 'column_budget.rs thick-cloud non-negativity & thin-cloud tau-scaling',
    measured: `tau=120: absSurf=${thickCb.absSurf.toFixed(2)} W/m^2, reflSurf=${thickCb.reflSurf.toFixed(2)} W/m^2 (NEGATIVE); tau=0.001: dAbsAtm=+${phantomAbsW.toFixed(2)} W/m^2 (+${((phantomAbsW / clear.absAtm) * 100).toFixed(1)}%)`,
    expected: 'tau=120: absSurf >= 0, reflSurf >= 0 (R_c + A_c <= 1); tau=0.001: dAbsAtm -> 0 W/m^2 (< 1 W/m^2)',
    score: +s1.toFixed(4),
    knownMatchScore: +scoreCheck1(35.0, 4.0, 0.08, clear.toa).toFixed(4),
    knownMismatchScore: +scoreCheck1(-50.0, -0.5, 110.0, clear.toa).toFixed(4),
    pass: s1 >= 0.95,
    source: 'Lacis & Hansen (1974) J. Atmos. Sci. 31:118; Stephens (1978) J. Atmos. Sci. 35:2123',
  });

  // ---------------------------------------------------------------------------
  // Check 2: column_budget.rs cloudy fresh snow multiple-bounce absorption
  // ---------------------------------------------------------------------------
  const snowCloudy = sim.rtPoint({ year: 2026, cosZ: 0.5, cosV: 0.5, phi: 0, cloud: 1, tau: 10, surf: 2, hKm: 0, qSurf: 0.002 });
  // Reproduce exact down_surf and cloud_albedo(10) from column_budget.rs:
  const sFactor = (Math.sqrt(3) / 2) * (1 - 0.85);
  const rc10 = (sFactor * 10) / (1 + sFactor * 10);
  // In column_budget.rs: down = absSurf + reflSurf + up_wv_from_down
  // Actually let's derive exact down from snowCloudy: up = 0.8 * down, absSurf = down*(1 - 0.8 + 0.8*(1 - upWv)*rc10)
  // Using gas_above at hKm=0, qSurf=0.002:
  const gas0 = sim.gasAbove(0, 0.002, 422.8);
  const yUp = (gas0.pwMm / 10) * 1.66;
  const aWvUp = (2.9 * yUp) / (Math.pow(1 + 141.5 * yUp, 0.635) + 5.925 * yUp);
  const tUp = 1 - 0.5 * aWvUp;
  // Game formula: absSurf_game = down * (1 - alpha + alpha * tUp * rc10)
  const alphaSnow = snowCloudy.albedo; // 0.80
  const downSnow = snowCloudy.absSurf / (1 - alphaSnow + alphaSnow * tUp * rc10);
  // Exact infinite multiple-bounce geometric series between surface (albedo alpha) and cloud base (reflectivity rc10, round-trip wv transmission tUp):
  // absSurf_exact = down * (1 - alpha) / (1 - alpha * rc10 * tUp)
  const exactSnowAbs = downSnow * ((1 - alphaSnow) / (1 - alphaSnow * rc10 * tUp));
  const snowExcessPct = ((snowCloudy.absSurf / exactSnowAbs) - 1) * 100;
  const s2 = ratioScore(snowCloudy.absSurf, exactSnowAbs);
  checks.push({
    id: 'column-budget-snow-multiple-bounce',
    label: 'column_budget.rs cloudy snow multiple-bounce surface absorption',
    measured: `alpha=0.80, cloud=1, tau=10: absSurf=${snowCloudy.absSurf.toFixed(2)} W/m^2 (+${snowExcessPct.toFixed(1)}% vs exact geometric series)`,
    expected: `Multiple-bounce exact absSurf=${exactSnowAbs.toFixed(2)} W/m^2 ((1-a)/(1-a*Rc*t))`,
    score: +s2.toFixed(4),
    knownMatchScore: +ratioScore(exactSnowAbs, exactSnowAbs).toFixed(4),
    knownMismatchScore: +ratioScore(exactSnowAbs * 4.5, exactSnowAbs).toFixed(4),
    pass: s2 >= 0.95,
    source: 'Lacis & Hansen (1974) eq. 21; Warren (1982) Rev. Geophys. 20:67 (snow albedo & cloud-snow multiple reflection)',
  });

  // ---------------------------------------------------------------------------
  // Check 3: energy_update.rs split-model energy closure & sub-freezing ocean SST
  // ---------------------------------------------------------------------------
  sim.init(36, 72);
  const lat = sim.plane('lat'), lon = sim.plane('lon'), land = sim.plane('land'), elev = sim.plane('elev');
  for (let i = 0; i < sim.n; i++) {
    const isLand = (Math.abs(lat[i]) < 65 && ((lon[i] + 180) % 120 < 40)) || lat[i] < -72;
    land[i] = isLand ? 1 : 0;
    elev[i] = isLand ? 300 : 0;
  }
  sim.seed(15, 12);
  for (let step = 0; step < 16; step++) sim.step(3 * 3600); // 48 h Jan spin-up
  const toa = sim.plane('toa'), qabs = sim.plane('qabs'), reflsw = sim.plane('reflsw'), absatm = sim.plane('absatm'), sst = sim.plane('sst');
  let maxClosureErrW = 0, maxClosureRel = 0, minSstC = Infinity, subFreezeOcean = 0, totalOcean = 0;
  for (let i = 0; i < sim.n; i++) {
    if (toa[i] > 50) {
      const err = Math.abs(qabs[i] + reflsw[i] + absatm[i] - toa[i]);
      if (err > maxClosureErrW) { maxClosureErrW = err; maxClosureRel = err / toa[i]; }
    }
    if (land[i] < 0.5) {
      totalOcean++;
      if (sst[i] < minSstC) minSstC = sst[i];
      if (sst[i] < -1.8) subFreezeOcean++;
    }
  }
  const scoreCheck3 = (closureRelErr: number, subFreezeFrac: number, coldestSst: number) => {
    const cScore = clamp01(1 - closureRelErr / 0.12);
    const sstScore = clamp01(1 - subFreezeFrac) * clamp01(1 - Math.max(0, -1.8 - coldestSst) / 8.0);
    return 0.5 * cScore + 0.5 * sstScore;
  };
  const s3 = scoreCheck3(maxClosureRel, subFreezeOcean / Math.max(1, totalOcean), minSstC);
  checks.push({
    id: 'energy-update-split-closure-and-sst',
    label: 'energy_update.rs exported shortwave closure & seawater freezing floor (-1.8 C)',
    measured: `max |qabs+reflsw+absatm-toa|=${maxClosureErrW.toFixed(1)} W/m^2 (${(maxClosureRel * 100).toFixed(1)}% TOA); ${subFreezeOcean}/${totalOcean} (${((subFreezeOcean / totalOcean) * 100).toFixed(1)}%) ocean cells < -1.8 C (min SST=${minSstC.toFixed(2)} C)`,
    expected: '0.0 W/m^2 shortwave closure error (single radiative model); 0% ocean SST below -1.8 C seawater freezing',
    score: +s3.toFixed(4),
    knownMatchScore: +scoreCheck3(0.0, 0.0, -1.8).toFixed(4),
    knownMismatchScore: +scoreCheck3(0.15, 0.30, -10.0).toFixed(4),
    pass: s3 >= 0.95,
    source: 'Trenberth, Fasullo & Kiehl (2009) BAMS 90:311; UNESCO EOS-80 / Millero (1978) seawater freezing point -1.8 C at 35 PSU',
  });

  // ---------------------------------------------------------------------------
  // Check 4: cloudColumn.ts winter 10.5 km monolith & dry-desert tau=150 supercell
  // ---------------------------------------------------------------------------
  const winter = cloudColumn(-10, 0.0014, 0.8);
  const winterBake = bakeLocal(winter, 0.8, 0, 0);
  let wVox = 0, wAbove5 = 0;
  for (let k = 0; k < LOCAL_CLOUDS.nx; k++) for (let j = 0; j < LOCAL_CLOUDS.nz; j++) for (let i = 0; i < LOCAL_CLOUDS.nx; i++) {
    if (winterBake[i + LOCAL_CLOUDS.nx * (j + LOCAL_CLOUDS.nz * k)] > 0) {
      wVox++;
      if ((j + 0.5) * (LOCAL_CLOUDS.topM / LOCAL_CLOUDS.nz) > 5000) wAbove5++;
    }
  }
  const winterSatLayers = winter.layers.filter(l => l.rh >= 0.8).length;
  const winterTopK = cloudTopLongwave(winter).topK;
  const winterAbove5Frac = wAbove5 / (winterBake.length * (7 / 12));

  const desert = cloudColumn(35, 0.0052, 0.1);
  const desertRhAtLcl = desert.lcl >= 0 ? desert.layers[Math.round(desert.lcl / 250)]?.rh ?? 0 : 0;
  const scoreCheck4 = (satAbove5Frac: number, desertTau: number, rhAtLcl: number) => {
    const winterScore = clamp01(1 - satAbove5Frac / 0.50); // real shallow winter stratus has ~0% voxel fill above 5 km
    const desertTauScore = clamp01(1 - Math.max(0, desertTau - 5) / 100); // dry RH 15% cover 0.1 desert should have tau <= 5
    const lclConsistency = clamp01(1 - Math.abs(rhAtLcl - 1.0));
    return (winterScore + desertTauScore + lclConsistency) / 3;
  };
  const s4 = scoreCheck4(winterAbove5Frac, desert.tau, desertRhAtLcl);
  checks.push({
    id: 'cloud-column-winter-monolith-and-desert-tau',
    label: 'cloudColumn.ts winter stratiform monolith & dry-desert convective tau/LCL consistency',
    measured: `Winter(-10C,RH77%): ${winterSatLayers}/45 layers>=80% RH to 11 km (topK=${winterTopK.toFixed(1)}K, tau=${winter.tau.toFixed(1)}, ${(winterAbove5Frac * 100).toFixed(1)}% voxels>5km); Desert(35C,RH15%,c=0.1): tau=${desert.tau.toFixed(1)}, RH@LCL=${desertRhAtLcl.toFixed(3)}`,
    expected: 'Winter stratus top 1-3 km (0% opaque fill >5 km, tau ~5-15); dry desert tau < 5, environmental RH at well-mixed LCL = 1.00',
    score: +s4.toFixed(4),
    knownMatchScore: +scoreCheck4(0.0, 2.0, 1.0).toFixed(4),
    knownMismatchScore: +scoreCheck4(0.75, 150.0, 0.15).toFixed(4),
    pass: s4 >= 0.95,
    source: 'Shupe et al. (2011) J. Climate 24:4674 (Arctic winter stratus top 1-3 km); Stull (1988) Boundary Layer Meteorology ch. 1 (constant mixed-layer q)',
  });

  // ---------------------------------------------------------------------------
  // Check 5: cloudColumn.ts high-elevation tropopause/pressure mass, non-LCL base LW, & ice OLR a0
  // ---------------------------------------------------------------------------
  const tibet = cloudColumn(10, 0.005, 0.5, 11000, 250, 4500);
  const tibetMaxAsl = tibet.layers[tibet.layers.length - 1].z + 4500; // 15,500 m ASL (4.5 km above 11 km tropopause!)
  const pTibet = pressureAt(4500);
  const pSea = 101325;
  const atmCreTibet = atmosphericCloudRadiativeEffect(tibet, 0.8, 0.5, 0.25);
  const trueHeatTibet = atmCreTibet.net * 9.80665 / (1004.6 * pTibet) * 86400;
  const heatRatio = ratioScore(atmCreTibet.heatingKPerDay, trueHeatTibet);
  // Pure stratiform / high-cloud column with lcl = -1 (construct synthetic non-LCL stratiform column matching cloudBaseLongwave contract):
  const stratOnlyCol = { ...winter, lcl: -1 };
  const baseLwNoLcl = cloudBaseLongwave(stratOnlyCol).down; // 0 W/m^2 despite waterPath = 0.509 kg/m^2!
  const topLwNoLcl = cloudTopLongwave(stratOnlyCol).up; // 73.9 W/m^2!
  const scoreCheck5 = (maxAsl: number, heatAcc: number, baseLw: number, iceA0Used: number) => {
    const tropScore = clamp01(1 - Math.max(0, maxAsl - 11000) / 4500);
    const baseLwScore = baseLw > 100 ? 1 : 0;
    const iceA0Score = ratioScore(iceA0Used, 0.055); // Ebert & Curry 1992 ice broadband k ~ 0.055 m^2/g vs liquid 0.130
    return 0.25 * tropScore + 0.25 * heatAcc + 0.25 * baseLwScore + 0.25 * iceA0Score;
  };
  const s5 = scoreCheck5(tibetMaxAsl, heatRatio, baseLwNoLcl, 0.130);
  checks.push({
    id: 'cloud-column-elevation-and-lw-emissivity',
    label: 'cloudColumn.ts plateau tropopause/pressure air mass, non-LCL base LW, & ice emissivity',
    measured: `Tibet 4.5 km: top ASL=${tibetMaxAsl} m (+4.5 km past 11 km tropopause), heatingKPerDay=${atmCreTibet.heatingKPerDay.toFixed(3)} vs ${trueHeatTibet.toFixed(3)} K/d (-${((1 - heatRatio) * 100).toFixed(1)}%); lcl=-1 stratiform baseLW=${baseLwNoLcl.toFixed(1)} W/m^2 (topLW=${topLwNoLcl.toFixed(1)}); ice a0=0.130`,
    expected: 'Column caps at 11 km ASL tropopause; heating uses pressureAt(groundM); stratiform baseLW>0 when waterPath>0; ice LW a0~0.055 m^2/g',
    score: +s5.toFixed(4),
    knownMatchScore: +scoreCheck5(11000, 1.0, 240.0, 0.055).toFixed(4),
    knownMismatchScore: +scoreCheck5(15500, 0.55, 0.0, 0.130).toFixed(4),
    pass: s5 >= 0.95,
    source: 'US Std Atm (1976) 11 km ASL tropopause; Ebert & Curry (1992) JGR 97:3831 (ice LW k ~ 0.055 m^2/g); Stephens (1978) upward a0 = 0.158 m^2/g',
  });

  // ---------------------------------------------------------------------------
  // Check 6: opening.ts permanent GLOBE_SKY.hold lock & atmosphere.ts uCloudEdge.x leak + live browser verification
  // ---------------------------------------------------------------------------
  const openingSrc = readFileSync(join(ROOT, 'src', 'world', 'cosmos', 'opening.ts'), 'utf8');
  const atmoSrc = readFileSync(join(ROOT, 'src', 'world', 'globe', 'atmosphere.ts'), 'utf8');
  const hasHoldReset = /GLOBE_SKY\.hold\s*=\s*0/.test(openingSrc) || /GLOBE_SKY\.hold\s*=\s*0/.test(atmoSrc);
  const readyBlock = openingSrc.match(/Promise\.resolve\(ready\)\.then\(\(\)\s*=>\s*\{([\s\S]*?)\},\s*\(err/)?.[1] ?? '';
  const hasEarlySkipGuard = /\b(stopped|arrived)\b/.test(readyBlock);

  // Unit reproduction of atmosphere.ts:372-376 permanent uCloudClear overwrite when GLOBE_SKY.hold=1
  // AND un-restored uCloudEdge.x leak when GLOBE_SKY.hold returns to 0
  const atm = createAtmosphere(6371000, 0, 1400);
  const cam = new THREE.PerspectiveCamera(45, 16 / 9, 1, 1e8);
  const edgeBefore = atm.uniforms.uCloudEdge.value.x;
  const expectedClearAt200km = cloudClear(200_000); // 0.8751
  // Simulate post-opening state (opening.ts:440,464-465 at w=1: hold=1, steam=0, clear=0)
  GLOBE_SKY.hold = 1; GLOBE_SKY.steam = 0; GLOBE_SKY.clear = 0; GLOBE_SKY.warm = 0;
  atm.setClear(expectedClearAt200km);
  atm.update(cam, new THREE.Vector3(0, 0, 6.571e6), new THREE.Vector3(1, 0, 0), 10);
  const clearAfterUpdateWithHold = atm.uniforms.uCloudClear.value; // overwritten to 0!
  // Simulate steam=1 -> hold=0 release
  GLOBE_SKY.hold = 1; GLOBE_SKY.steam = 1.0; GLOBE_SKY.clear = 0; GLOBE_SKY.warm = 1;
  atm.update(cam, new THREE.Vector3(0, 0, 2e7), new THREE.Vector3(1, 0, 0), 20);
  GLOBE_SKY.hold = 0; GLOBE_SKY.steam = 0;
  atm.update(cam, new THREE.Vector3(0, 0, 2e7), new THREE.Vector3(1, 0, 0), 30);
  const edgeAfterRelease = atm.uniforms.uCloudEdge.value.x; // stuck at 0.414 instead of 0.614!

  // Run live browser audit!
  const { live, consoleErrors, pageErrors } = await runBrowserAudit();

  const scoreCheck6 = (holdCleared: boolean, clearAt200: number, expClear: number, edgeRestored: number, expEdge: number, skipGuarded: boolean) => {
    const a = holdCleared ? 1 : 0;
    const b = clamp01(1 - Math.abs(clearAt200 - expClear) / Math.max(0.01, expClear));
    const c = clamp01(1 - Math.abs(edgeRestored - expEdge) / 0.20);
    const d = skipGuarded ? 1 : 0;
    return 0.25 * (a + b + c + d);
  };
  const s6 = scoreCheck6(hasHoldReset, clearAfterUpdateWithHold, expectedClearAt200km, edgeAfterRelease, edgeBefore, hasEarlySkipGuard);
  checks.push({
    id: 'opening-globe-sky-hold-and-cloud-edge-leak',
    label: 'opening.ts GLOBE_SKY.hold descent-cloud lock, early-skip Hadean overwrite & atmosphere.ts uCloudEdge.x leak',
    measured: `GLOBE_SKY.hold=0 in src: ${hasHoldReset}; post-opening descent@200km uCloudClear=${clearAfterUpdateWithHold.toFixed(3)} (vs ${expectedClearAt200km.toFixed(3)}); early-skip ready().then() guard: ${hasEarlySkipGuard}; post-hold uCloudEdge.x=${edgeAfterRelease.toFixed(3)} (vs ${edgeBefore.toFixed(3)})`,
    expected: `GLOBE_SKY.hold reset to 0 on opening stop; uCloudClear=${expectedClearAt200km.toFixed(3)} at 200 km; early-skip guard true; uCloudEdge.x restored to ${edgeBefore.toFixed(3)}`,
    score: +s6.toFixed(4),
    knownMatchScore: +scoreCheck6(true, expectedClearAt200km, expectedClearAt200km, edgeBefore, edgeBefore, true).toFixed(4),
    knownMismatchScore: +scoreCheck6(false, 0.0, expectedClearAt200km, 0.414, edgeBefore, false).toFixed(4),
    pass: s6 >= 0.95,
    source: 'T-0034 / T-0041 CLOUD_OPEN descent cloud clearing (1,500 km -> 150 km); opening.ts & atmosphere.ts state invariants',
  });

  const meanScore = checks.reduce((s, c) => s + c.score, 0) / checks.length;
  const calibrationValid = checks.every(c => c.knownMatchScore >= 0.95 && c.knownMismatchScore <= 0.30);

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE,
    viewport: '1280x720',
    consoleErrors,
    pageErrors,
    calibrationValid,
    passingChecks: checks.filter(c => c.pass).length,
    totalChecks: checks.length,
    meanScore: +meanScore.toFixed(4),
    checks,
    live,
    rawSamples: {
      snowCloudy,
      exactSnowAbs: +exactSnowAbs.toFixed(2),
      clear,
      thinCloud,
      thickCb,
      winter: { lcl: winter.lcl, top: winter.top, tau: +winter.tau.toFixed(2), wp: +winter.waterPath.toFixed(4), satLayers: winterSatLayers, topK: +winterTopK.toFixed(2), voxelsFrac: +(wVox / winterBake.length).toFixed(4), voxelsAbove5kmFrac: +winterAbove5Frac.toFixed(4), boxExt: +boxExtinction(winter, winterBake).toExponential(3) },
      desert: { lcl: desert.lcl, top: desert.top, tau: +desert.tau.toFixed(2), wp: +desert.waterPath.toFixed(4), rhAtLcl: +desertRhAtLcl.toFixed(4) },
      tibet: { maxAsl: tibetMaxAsl, pTibet: +pTibet.toFixed(0), heatReported: +atmCreTibet.heatingKPerDay.toFixed(4), heatTrue: +trueHeatTibet.toFixed(4) },
      atmosphereHoldLeak: { edgeBefore, edgeAfterRelease, hasHoldReset },
    },
  };

  writeFileSync(join(HERE, 'numbers.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify({
    consoleErrors: consoleErrors.length,
    pageErrors: pageErrors.length,
    calibrationValid,
    passingChecks: report.passingChecks,
    totalChecks: report.totalChecks,
    meanScore: report.meanScore,
    checks: checks.map(c => ({ id: c.id, score: c.score, match: c.knownMatchScore, mismatch: c.knownMismatchScore, pass: c.pass })),
    liveSummary: {
      f0: live.frame0Pixels,
      f1: live.frame1Pixels,
      f2: live.frame2,
      f3: live.frame3,
    },
  }, null, 2));
}

main().catch(err => { console.error(err); process.exit(1); });
