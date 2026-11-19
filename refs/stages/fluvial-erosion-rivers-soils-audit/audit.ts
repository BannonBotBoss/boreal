/**
 * Live & calibrated Rule 11 audit of Staged Terrain Hydraulic Erosion, River Planform &
 * Breach Continuity, Open-Lake River Mouths, Stage-3 River-Pond Soil Classification, and
 * Flow TWI / Inspector Scale Consistency:
 *  1. src/core/stages/elevation.ts:90-95 — erode() defines dh = gh - h0 (negative downhill)
 *     but updates speed = sqrt(max(0, speed^2 + dh * gravity)) (+ instead of -), inverting
 *     gravity: 57.45% of downhill steps decelerate, 37.40% stall at speed = 0, 292,640 uphill
 *     steps accelerate, mean speed drops 5.08x (0.393 vs 1.996), and total erosion drops 56.3%.
 *  2. src/core/stages/rivers.ts:162-167,207-222 & src/core/stages/riverPlanform.ts:413-414,487-490
 *     — breachUnconfined sets a flat per-cell ceiling R.cap[geo.up] from a single midpoint sample,
 *     clobbering 85 shared `up` IDs across multiple pieces and creating 57/206 (27.7%) vertical
 *     0.50-3.818 m shear cliff drops in both water and carved riverbed (followed by flat shelves
 *     that still report steep slope/speed) plus 3 uphill arc steps.
 *  3. src/core/stages/flow.ts:27 & src/core/stages/riverPlanform.ts:413 — Priority-Flood seeds
 *     outlet cells with raw submerged lake-floor bathymetry h[c] (down to -50.74 m) instead of
 *     waterLevel (-0.25 m), causing 16/60 (26.7%) river mouths to jump > 0.15 m and open-lake
 *     mouths to plunge up to 4.10 m BELOW Lake of the Woods (-4.347 m vs -0.250 m at (6870, 1860)).
 *  4. src/core/stages/riverContain.ts:22-43 & src/core/stages/riverPlanform.ts:538-542 —
 *     riverContainment() tests only the 1 midpoint per piece that breachUnconfined just capped
 *     (false-pass 0.000), missing 114/2,823 (4.04%) unconfined points floating up to +0.386 m
 *     above dry banks; planformReport() deduplicates carrier cells by cell-local coordinates,
 *     over-counting meander pieces 2.67x (104 vs 39 unique) while 51 cells saturate SLOTS = 3.
 *  5. src/core/stages/soils.ts:62,69,83,103-106 — soilGrid ignores riverPondGrid (5,374/5,374 =
 *     100% of pond cells, 483.7 ha = 8.2% of map, 52 bodies up to 102.6 ha & 11.96 m deep),
 *     inflating land[] by +12.69%, pushing true dry-land bedrock share from 11.40% to 12.85%,
 *     skipping ponds in HAND drainage, and making soilAt() report dry peat/clay on 5,991 water
 *     half-cells while reporting 'water' on 543 dry shoreline half-cells.
 *  6. src/core/stages/flow.ts:42-46 & src/core/world.ts:38 — flow.ts twi() computes slope on
 *     unscaled raw grid units (missing g.k = 8.0477 m/unit), inflating TWI by +1.93 mean / +5.46
 *     max on 95.0% of cells (62,273/65,536 off by > 1.0), and world.ts:38 logs raw unscaled
 *     (fl.filled[c] - g.h[c]) labeled 'fill depth (m)' (8.05x too small: 1.89 m vs 15.18 m).
 *
 * Usage:
 *   npx tsx refs/stages/fluvial-erosion-rivers-soils-audit/audit.ts [baseUrl]
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

import {
  ELEV,
  STAGES,
  elevationGrid,
  flowGrid,
  lakeAt,
  lakeGrid,
  toWorld,
} from '../../../src/core/stages/elevation';
import { twi } from '../../../src/core/stages/flow';
import { riverContainment } from '../../../src/core/stages/riverContain';
import { PLANFORM, planformReport } from '../../../src/core/stages/riverPlanform';
import { pondAt, riverAt, riverGrid, riverPlan, riverPondGrid } from '../../../src/core/stages/rivers';
import { soilAt, soilGrid } from '../../../src/core/stages/soils';
import { surfaceAt } from '../../../src/core/stages/surfaceAt';
import { hash, random } from '../../../src/proc/rng';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const BASE = process.argv[2] ?? 'http://127.0.0.1:5259';
const SEED = 1400;

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

// --- Check 1: Inverted gravity in elevation.ts erode() ---
function simulateErosion(sign: 1 | -1) {
  const n = ELEV.n, N = n * n;
  function lattice(period: number, salt: number) {
    const L = new Float32Array(period * period);
    for (let j = 0; j < period; j++) {
      for (let i = 0; i < period; i++) L[j * period + i] = random(hash(`${salt}:${i}:${j}`))();
    }
    return L;
  }
  function vnoise(L: Float32Array, period: number, x: number, y: number) {
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const x0 = xi % period, y0 = yi % period, x1 = (x0 + 1) % period, y1 = (y0 + 1) % period;
    const a = L[y0 * period + x0], b = L[y0 * period + x1], c = L[y1 * period + x0], d = L[y1 * period + x1];
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  }
  const h = new Float32Array(N);
  const oct = Array.from({ length: 6 }, (_, o) => ({ per: 4 << o, L: lattice(4 << o, SEED * 31 + o) }));
  const low = lattice(3, SEED * 31 + 99);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    let amp = 1, sum = 0, norm = 0, weight = 1, o = 0;
    for (const { per, L: lat } of oct) {
      const iso = vnoise(lat, per, i / n * per, j / n * per);
      const s = o++ < ELEV.grainOctaves
        ? iso + (vnoise(lat, per, (i - j + n) / n * per, (i + j) / n * per * ELEV.grain) - iso) * ELEV.grainMix
        : iso;
      const r = (1 - Math.abs(s * 2 - 1)) ** 2;
      sum += r * amp * weight; weight = Math.min(1, r * 1.6); norm += amp; amp *= ELEV.persistence;
    }
    h[j * n + i] = (sum / norm * 0.7 + vnoise(low, 3, i / n * 3, j / n * 3) * ELEV.basins) * ELEV.relief;
  }

  const inertia = 0.05, capacity = 4, minSlope = 0.01, depositK = 0.3, erodeK = 0.3, evaporate = 0.01, gravity = 4, lifeMax = 30;
  const r = random(hash(`erosion:${SEED}`));
  let gx = 0, gy = 0, gh = 0;
  const grad = (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y), u = x - xi, v = y - yi;
    const x0 = ((xi % n) + n) % n, y0 = ((yi % n) + n) % n, x1 = (x0 + 1) % n, y1 = (y0 + 1) % n;
    const nw = h[y0 * n + x0], ne = h[y0 * n + x1], sw = h[y1 * n + x0], se = h[y1 * n + x1];
    gx = (ne - nw) * (1 - v) + (se - sw) * v; gy = (sw - nw) * (1 - u) + (se - ne) * u;
    gh = nw * (1 - u) * (1 - v) + ne * u * (1 - v) + sw * (1 - u) * v + se * u * v;
  };
  let totalSteps = 0, downhillSteps = 0, downhillDecel = 0, zeroSpeed = 0, uphillAccel = 0, totalEroded = 0, speedSum = 0;
  for (let d = 0; d < ELEV.droplets; d++) {
    let x = r() * n, y = r() * n, dx = 0, dy = 0, speed = 1, water = 1, sed = 0;
    for (let life = 0; life < lifeMax; life++) {
      const xi = Math.floor(x), yi = Math.floor(y), u = x - xi, v = y - yi;
      const x0 = ((xi % n) + n) % n, y0 = ((yi % n) + n) % n, x1 = (x0 + 1) % n, y1 = (y0 + 1) % n;
      grad(x, y); const h0 = gh;
      dx = dx * inertia - gx * (1 - inertia); dy = dy * inertia - gy * (1 - inertia);
      const len = Math.hypot(dx, dy); if (len < 1e-9) break; dx /= len; dy /= len; x += dx; y += dy;
      grad(x, y); const dh = gh - h0, cap = Math.max(-dh * speed * water * capacity, minSlope);
      let amt: number;
      if (sed > cap || dh > 0) { amt = dh > 0 ? Math.min(dh, sed) : (sed - cap) * depositK; sed -= amt; }
      else { amt = -Math.min((cap - sed) * erodeK, -dh); sed -= amt; totalEroded += -amt; }
      h[y0 * n + x0] += amt * (1 - u) * (1 - v); h[y0 * n + x1] += amt * u * (1 - v);
      h[y1 * n + x0] += amt * (1 - u) * v; h[y1 * n + x1] += amt * u * v;
      const nextSpeed = Math.sqrt(Math.max(0, speed * speed + sign * dh * gravity));
      totalSteps++;
      if (dh < -1e-6) { downhillSteps++; if (nextSpeed < speed) downhillDecel++; }
      else if (dh > 1e-6 && nextSpeed > speed) uphillAccel++;
      speed = nextSpeed;
      if (speed === 0) zeroSpeed++;
      speedSum += speed;
      water *= 1 - evaporate;
    }
  }
  return {
    totalSteps,
    downhillSteps,
    downhillDecelFrac: downhillDecel / Math.max(1, downhillSteps),
    zeroSpeedFrac: zeroSpeed / Math.max(1, totalSteps),
    uphillAccelCount: uphillAccel,
    uphillAccelFrac: uphillAccel / Math.max(1, totalSteps - downhillSteps),
    meanSpeed: speedSum / Math.max(1, totalSteps),
    totalEroded,
  };
}

function scoreErosionGravity(downhillDecelFrac: number, uphillAccelFrac: number, zeroSpeedFrac: number, erodedRatio: number, sourceHasPhysicalSign: boolean) {
  const sDown = 1 - clamp01(downhillDecelFrac);
  const sUp = 1 - clamp01(uphillAccelFrac);
  const sZero = clamp01(1 - Math.max(0, zeroSpeedFrac - 0.01) / 0.4);
  const sErode = clamp01(erodedRatio);
  const sCode = sourceHasPhysicalSign ? 1 : 0;
  return clamp01((sDown + sUp + sZero + sErode + sCode) / 5);
}

// Helper for exact meander evaluation matching riverPlanform.ts
const TAU = Math.PI * 2;
const SINE_AMP_OVER_W = (() => {
  const crest = PLANFORM.beltOverW / 2, rf = PLANFORM.rcOverW, k = TAU / PLANFORM.lambdaOverW;
  let lo = 0, hi = crest;
  for (let i = 0; i < 50; i++) {
    const a = (lo + hi) / 2, y1 = rf * (1 - Math.cos(Math.atan(a * k)));
    if (y1 + a > crest) hi = a; else lo = a;
  }
  return (lo + hi) / 2;
})();
const LOBE_BETA = Math.atan(SINE_AMP_OVER_W * TAU / PLANFORM.lambdaOverW);
function filletYZ(u: number, radius: number): [number, number] {
  const x = Math.min(radius - 1e-4, Math.max(0, u)), h = Math.sqrt(radius * radius - x * x);
  return [radius - h, x / h];
}
function meanderLateral(dist: number, len: number, wave: number, phase: number): [number, number] {
  const width = wave / PLANFORM.lambdaOverW;
  const radius = PLANFORM.rcOverW * width, k = TAU / wave, a = SINE_AMP_OVER_W * width;
  const y1 = radius * (1 - Math.cos(LOBE_BETA)), s1 = radius * Math.sin(LOBE_BETA), half = wave / 2;
  if (!(s1 > 0.05) || len < 2 * s1 + half) return [0, 0];
  const maxHalf = Math.floor((len - 2 * s1) / half + 1e-6);
  const nHalf = maxHalf % 2 === 1 ? maxHalf : maxHalf - 1;
  if (nHalf < 1) return [0, 0];
  const span = 2 * s1 + nHalf * half, stub = (len - span) / 2, u = dist - stub;
  if (u <= 0 || u >= span) return [0, 0];
  const sign = Math.cos(phase) >= 0 ? 1 : -1;
  let y: number, yp: number;
  if (u <= s1) { const e = filletYZ(u, radius); y = e[0]; yp = e[1]; }
  else if (u >= span - s1) { const e = filletYZ(span - u, radius); y = e[0]; yp = -e[1]; }
  else { const sig = u - s1; y = y1 + a * Math.sin(k * sig); yp = a * k * Math.cos(k * sig); }
  return [sign * y, sign * yp];
}

function scoreJunctionContinuity(cliffShare: number, maxDropM: number, capCollisionShare: number, uphillSteps: number) {
  const sCliff = clamp01(1 - cliffShare / 0.25);
  const sDrop = clamp01(1 - Math.max(0, maxDropM - 0.25) / 2.0);
  const sCap = clamp01(1 - capCollisionShare / 0.30);
  const sUp = uphillSteps === 0 ? 1 : clamp01(1 - uphillSteps / 5);
  return clamp01((sCliff + sDrop + sCap + sUp) / 4);
}

function scoreMouthContinuity(mismatchShare: number, maxSubLakePlungeM: number, maxJumpM: number) {
  const sMis = clamp01(1 - mismatchShare / 0.25);
  const sPlunge = clamp01(1 - Math.max(0, maxSubLakePlungeM - 0.05) / 1.5);
  const sJump = clamp01(1 - Math.max(0, maxJumpM - 0.15) / 2.0);
  return clamp01((sMis + sPlunge + sJump) / 3);
}

function scoreContainmentAndPlanform(denseOpenShare: number, maxLiftM: number, midpointGap: number, meanderOvercountRatio: number, fullSlotShare: number) {
  const sOpen = clamp01(1 - denseOpenShare / 0.04);
  const sLift = clamp01(1 - Math.max(0, maxLiftM - 0.02) / 0.35);
  const sMid = clamp01(1 - midpointGap / 0.04);
  const sDedup = ratioScore(1, meanderOvercountRatio);
  const sSlots = clamp01(1 - fullSlotShare / 0.15);
  return clamp01((sOpen + sLift + sMid + sDedup + sSlots) / 5);
}

function scoreSoilsPondClassification(pondMisclassShare: number, bedrockTrueDryPct: number, waterHalfCellDryShare: number) {
  const sPond = 1 - clamp01(pondMisclassShare);
  const sBedrock = clamp01(1 - Math.abs(bedrockTrueDryPct - 11.4) / 1.5);
  const sAlign = clamp01(1 - waterHalfCellDryShare / 0.25);
  return clamp01((sPond + sBedrock + sAlign) / 3);
}

function scoreFlowTwiAndFillUnits(twiMeanDiff: number, twiGt1Share: number, fillDepthRatio: number) {
  const sMean = clamp01(1 - twiMeanDiff / 1.5);
  const sPct = 1 - clamp01(twiGt1Share);
  const sFill = ratioScore(fillDepthRatio, 1);
  return clamp01((sMean + sPct + sFill) / 3);
}

async function captureLive(outDir: string) {
  if (!EXECUTABLE) throw new Error('No Chromium/Edge executable found');

  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const browser = await chromium.launch({
    executablePath: EXECUTABLE,
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });

  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', err => pageErrors.push(err.message));

    const waitReady = async () => {
      const t0 = Date.now();
      while (Date.now() - t0 < 40000) {
        const ok = await page.evaluate(() => {
          const ld = document.getElementById('loading');
          const ldHidden = !ld || ld.hidden || getComputedStyle(ld).display === 'none' || Number(getComputedStyle(ld).opacity) < 0.05;
          return Boolean(typeof (window as unknown as { borealPlace?: unknown }).borealPlace === 'function' && ldHidden);
        });
        if (ok) break;
        await page.waitForTimeout(300);
      }
    };
    const waitSettle = async (frames = 25) => {
      await page.evaluate(async (n) => {
        for (let i = 0; i < n; i++) await new Promise(r => requestAnimationFrame(r));
      }, frames);
    };

    const gotoShot = async (x: number, z: number, yaw: number, pitch: number, eye: number) => {
      await page.goto(`${BASE}/?view=ground&nomenu=1&stages=1&noprobe=1&hour=13&day=195&at=${x},${z},${yaw.toFixed(3)}&eye=${eye}`, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });
      await page.waitForFunction(() => !document.getElementById('loading'), undefined, { timeout: 90000 });
      await page.waitForTimeout(2500);
      await page.evaluate(({ px, pz, yw, pt }) => {
        const w = window as unknown as { borealPlace?: (a: number, b: number, f?: number, l?: number) => void; borealHold?: (b: boolean) => void };
        w.borealPlace?.(px, pz, yw, pt);
        w.borealHold?.(true);
      }, { px: x, pz: z, yw: yaw, pt: pitch });
      await waitSettle(18);
    };

    // Shot 0: cliff1 (2010, 3930) — 3.82 m vertical staircase cliff drop!
    // Stand downstream-NW at (1998, 3918) looking SE back upstream (yaw = -2.356 rad), eye = 9 m, pitch = +0.36 rad (downward).
    await gotoShot(1998, 3918, -2.356, 0.36, 9);
    await page.screenshot({ path: join(outDir, 'frame-0-river-cliff-staircase-2010-3930.png') });

    // Record live WebGL canvas while smoothly panning along the 3.82 m river cliff staircase
    await page.evaluate(() => {
      const canvas = document.getElementById('world') as HTMLCanvasElement | null ?? document.querySelector('canvas');
      if (!canvas || typeof MediaRecorder === 'undefined') return;
      const stream = canvas.captureStream(15);
      const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp8') ? 'video/webm;codecs=vp8' : 'video/webm';
      const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 1_500_000 });
      const chunks: Blob[] = [];
      rec.ondataavailable = e => { if (e.data && e.data.size > 0) chunks.push(e.data); };
      rec.start(100);
      (window as unknown as Record<string, unknown>).__auditRec = { rec, chunks };
    });

    for (let k = 0; k < 16; k++) {
      await page.evaluate((i) => {
        const w = window as unknown as { borealPlace?: (x: number, z: number, f?: number, l?: number) => void };
        w.borealPlace?.(1998 + i * 0.85, 3918 + i * 0.85, -2.356 + i * 0.045, 0.36 + i * 0.012);
      }, k);
      await waitSettle(4);
    }

    let recordingBytes = 0;
    const b64Video: string | null = await page.evaluate(async () => {
      const r = (window as unknown as { __auditRec?: { rec: MediaRecorder; chunks: Blob[] } }).__auditRec;
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
      const buf = Buffer.from(b64Video, 'base64');
      writeFileSync(join(outDir, 'recording.webm'), buf);
      recordingBytes = buf.length;
    }

    // Shot 1: back-to-back -3.46 m and -3.27 m staircase cliffs at (4294.5, 4140) -> (4323.2, 4143.2)
    await gotoShot(4335, 4150, 1.25, 0.38, 10);
    await page.screenshot({ path: join(outDir, 'frame-1-river-double-cliff-4295-4140.png') });

    // Shot 2: plunging -4.35 m underwater river mouth at (6870, 1860) meeting Lake of the Woods (-0.25 m)
    await gotoShot(6882, 1874, 0.78, 0.36, 9);
    await page.screenshot({ path: join(outDir, 'frame-2-plunging-river-mouth-6870-1860.png') });

    // Shot 3: shoreline of the 102.6 ha, 11.96 m-deep river pond #16 near (3030, 2760)
    const P = riverPondGrid(SEED);
    let pondX = 3030, pondZ = 2760, dryX = 3000, dryZ = 2760;
    const n = 256, s = 30;
    outer: for (let c = 0; c < n * n; c++) {
      if (P.id[c] !== 16) continue;
      const ci = c % n, cj = (c / n) | 0;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ni = (ci + di + n) % n, nj = (cj + dj + n) % n;
        const nc = nj * n + ni;
        if (P.id[nc] < 0) {
          const sx = ni * s, sz = nj * s;
          const sp = surfaceAt(sx, sz, SEED);
          if (!sp.lake && !sp.river) {
            dryX = sx; dryZ = sz; pondX = ci * s; pondZ = cj * s;
            break outer;
          }
        }
      }
    }
    const pondYaw = Math.atan2(-(pondX - dryX), -(pondZ - dryZ));
    await gotoShot(dryX, dryZ, pondYaw, 0.28, 7);
    await page.screenshot({ path: join(outDir, 'frame-3-river-pond-shoreline-soil-mismatch.png') });

    await context.close();
    return { consoleErrors, pageErrors, recordingBytes, pondDryCoord: [dryX, dryZ], pondWaterCoord: [pondX, pondZ] };
  } finally {
    await browser.close();
  }
}

async function main() {
  STAGES.on = true;
  STAGES.seed = SEED;

  const g = elevationGrid(SEED);
  const f = flowGrid(SEED);
  const L = lakeGrid(SEED);
  const R = riverGrid(SEED);
  const P = riverPondGrid(SEED);
  const plan = riverPlan(SEED)!;
  const S = soilGrid(SEED);

  const n = g.n, N = n * n, s = g.cell, SLOTS = 3, STRIDE = 16;

  // --- 1. Erosion gravity check ---
  const elevSrc = readFileSync(join(ROOT, 'src', 'core', 'stages', 'elevation.ts'), 'utf8');
  const hasPhysicalSign = /speed\s*\*\s*speed\s*-\s*dh\s*\*\s*gravity/.test(elevSrc);
  const erodeCur = simulateErosion(1);
  const erodePhys = simulateErosion(-1);
  const erodedRatio = erodeCur.totalEroded / Math.max(1e-6, erodePhys.totalEroded);

  // --- 2 & 4. Dense river audit (junctions, cliffs, uphill, containment, slots, dedup) ---
  let slotsFull = 0, nonEmptyCells = 0, uniquePieces = 0, uniqueMeander = 0;
  let denseTotal = 0, denseOpen = 0, maxDenseLift = 0, uphillWithin = 0;
  let junctionChecks = 0, cliffJunctions = 0, maxCliffDrop = 0, uphillJunctions = 0;
  const upCounts = new Map<number, number>();
  const seen = new Set<string>();

  for (let c = 0; c < N; c++) {
    let used = 0;
    for (let slot = 0; slot < SLOTS; slot++) if (plan.kind[c * SLOTS + slot]) used++;
    if (used > 0) nonEmptyCells++;
    if (used === SLOTS) slotsFull++;
  }

  for (let c = 0; c < N; c++) {
    for (let slot = 0; slot < SLOTS; slot++) {
      const at = c * SLOTS + slot, k = plan.kind[at]; if (!k) continue;
      const o = at * STRIDE, up = plan.up[at], down = plan.down[at];
      const ox = (c % n) * s, oz = ((c / n) | 0) * s;
      const key = `${k}:${up}:${down}:${(ox + plan.data[o]).toFixed(1)}:${(oz + plan.data[o + 1]).toFixed(1)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      uniquePieces++;
      upCounts.set(up, (upCounts.get(up) ?? 0) + 1);

      const pts: { x: number; z: number }[] = [];
      let ex = 0, ez = 0, dxEnd = 0, dzEnd = 0;
      if (k === 1) {
        const ax = plan.data[o], az = plan.data[o + 1], bx = plan.data[o + 2], bz = plan.data[o + 3];
        const amp = plan.data[o + 5], wave = plan.data[o + 6], phase = plan.data[o + 7];
        if (amp > 1e-4) uniqueMeander++;
        const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz) || 1;
        const ux = dx / len, uz = dz / len, nx = -uz, nz = ux;
        const steps = Math.max(4, Math.ceil(len / 3));
        for (let i = 0; i <= steps; i++) {
          const dist = (i / steps) * len;
          let lx = ax + ux * dist, lz = az + uz * dist;
          if (amp > 1e-4 && wave > 1e-3) { const [off] = meanderLateral(dist, len, wave, phase); lx += nx * off; lz += nz * off; }
          pts.push({ x: ox + lx, z: oz + lz });
        }
        ex = ox + bx; ez = oz + bz; dxEnd = ux; dzEnd = uz;
      } else {
        const cx = plan.data[o], cz = plan.data[o + 1], Rarc = plan.data[o + 2], a0 = plan.data[o + 3], sweep = plan.data[o + 4];
        const steps = Math.max(4, Math.ceil(Math.abs(Rarc * sweep) / 3));
        for (let i = 0; i <= steps; i++) {
          const a = a0 + sweep * (i / steps);
          pts.push({ x: ox + cx + Rarc * Math.cos(a), z: oz + cz + Rarc * Math.sin(a) });
        }
        const a1 = a0 + sweep, sign = sweep >= 0 ? 1 : -1;
        ex = ox + cx + Rarc * Math.cos(a1); ez = oz + cz + Rarc * Math.sin(a1);
        dxEnd = -Math.sin(a1) * sign; dzEnd = Math.cos(a1) * sign;
      }

      // Junction check across endpoint
      const hBefore = riverAt(SEED, ex - dxEnd * 0.5, ez - dzEnd * 0.5);
      const hAfter = riverAt(SEED, ex + dxEnd * 0.5, ez + dzEnd * 0.5);
      if (hBefore && hAfter && hBefore.d < 0.5 && hAfter.d < 0.5) {
        junctionChecks++;
        const diff = hAfter.surface - hBefore.surface;
        if (diff > 0.05) uphillJunctions++;
        if (diff < -0.5) { cliffJunctions++; maxCliffDrop = Math.max(maxCliffDrop, -diff); }
      }

      // Dense containment & internal uphill check
      let prevSurf: number | null = null;
      for (const pt of pts) {
        const h = riverAt(SEED, pt.x, pt.z);
        denseTotal++;
        if (!h || h.d > 0.5) { prevSurf = null; continue; }
        if (prevSurf !== null && h.surface - prevSurf > 0.02) uphillWithin++;
        prevSurf = h.surface;
        let worst = -Infinity;
        for (const side of [1, -1]) {
          const off = h.half + h.bank + 1;
          const sp = surfaceAt(pt.x - h.dirZ * side * off, pt.z + h.dirX * side * off, SEED);
          if (!sp.lake && !sp.river) worst = Math.max(worst, h.surface - sp.height);
        }
        if (worst > 0.02) { denseOpen++; maxDenseLift = Math.max(maxDenseLift, worst); }
      }
    }
  }
  let upCollisions = 0;
  for (const [, cnt] of upCounts) if (cnt > 1) upCollisions++;
  const pfRep = planformReport(R, f.dir, plan);
  const midContain = riverContainment(SEED);

  // --- 3. Mouth continuity ---
  let mouthChecks = 0, mouthMismatch = 0, maxMouthJump = 0, maxSubLakePlunge = 0;
  for (let c = 0; c < N; c++) {
    if (!R.drawn[c]) continue;
    const r = f.dir[c];
    if (r < 0 || R.drawn[r]) continue;
    const wx = (r % n) * s, wz = ((r / n) | 0) * s;
    const cx = (c % n) * s, cz = ((c / n) | 0) * s;
    const lk = lakeAt(SEED, wx, wz), pd = pondAt(SEED, wx, wz);
    const targetSurf = lk ? lk.surface : pd ? pd.surface : -0.25;
    const hEnd = riverAt(SEED, cx * 0.1 + wx * 0.9, cz * 0.1 + wz * 0.9);
    const hNode = riverAt(SEED, wx, wz);
    const surf = hEnd ? hEnd.surface : hNode?.surface;
    if (surf !== undefined) {
      mouthChecks++;
      const diff = surf - targetSurf;
      if (Math.abs(diff) > 0.15) mouthMismatch++;
      maxMouthJump = Math.max(maxMouthJump, Math.abs(diff));
      if (!lk && !pd && hNode && hNode.surface < -0.25) maxSubLakePlunge = Math.max(maxSubLakePlunge, -0.25 - hNode.surface);
      if (!lk && !pd && surf < -0.25) maxSubLakePlunge = Math.max(maxSubLakePlunge, -0.25 - surf);
    }
  }

  // --- 5. Soils river-pond exclusion & WorldCover calibration ---
  let pondCells = 0, pondNotWater = 0, trueDryLand = 0, bedrockOnTrueDry = 0;
  let waterHalfCells = 0, waterHalfDrySoil = 0, dryHalfWaterSoil = 0;
  for (let c = 0; c < N; c++) {
    if (P.id[c] >= 0) { pondCells++; if (S.kind[c] !== 5) pondNotWater++; }
    if (!f.outlet[c] && L.id[c] < 0 && P.id[c] < 0) {
      trueDryLand++;
      if (S.kind[c] === 0) bedrockOnTrueDry++;
    }
  }
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = (i + 0.45) * s, z = (j + 0.45) * s;
    const sp = surfaceAt(x, z, SEED), so = soilAt(SEED, x, z);
    if (sp.lake || sp.river) { waterHalfCells++; if (so.kind !== 'water') waterHalfDrySoil++; }
    else if (so.kind === 'water') dryHalfWaterSoil++;
  }
  const bedrockTrueDryPct = 100 * bedrockOnTrueDry / Math.max(1, trueDryLand);

  // --- 6. flow.ts twi() & world.ts fill-depth scale ---
  let twiDiffSum = 0, twiDiffMax = 0, twiGt1 = 0;
  for (let c = 0; c < N; c++) {
    const d = Math.abs(twi(f, c) - S.twi[c]);
    twiDiffSum += d;
    if (d > twiDiffMax) twiDiffMax = d;
    if (d > 1.0) twiGt1++;
  }
  const twiMeanDiff = twiDiffSum / N;
  const worldSrc = readFileSync(join(ROOT, 'src', 'core', 'world.ts'), 'utf8');
  const worldFillUnscaled = /f\('hydrology',\s*'fill depth \(m\)',\s*fl\.filled\[c\]\s*-\s*g\.h\[c\]\)/.test(worldSrc);
  const fillDepthScale = worldFillUnscaled ? 1 / g.k : 1;

  // --- Assemble 6 calibrated Rule 11 checks ---
  const checks: CheckResult[] = [
    {
      id: 'elevation-erosion-gravity-sign',
      label: 'elevation.ts erode() downhill gravity sign (+dh*g vs -dh*g)',
      measured: `downhillDecel=${(erodeCur.downhillDecelFrac * 100).toFixed(2)}%, zeroSpeed=${(erodeCur.zeroSpeedFrac * 100).toFixed(2)}%, uphillAccel=${erodeCur.uphillAccelCount}, eroded=${erodeCur.totalEroded.toFixed(1)} vs ${erodePhys.totalEroded.toFixed(1)} (-${((1 - erodedRatio) * 100).toFixed(1)}%)`,
      expected: `downhillDecel=0.00%, zeroSpeed<=1%, uphillAccel=0, erodedRatio=1.00 (-dh*gravity)`,
      score: +scoreErosionGravity(erodeCur.downhillDecelFrac, erodeCur.uphillAccelFrac, erodeCur.zeroSpeedFrac, erodedRatio, hasPhysicalSign).toFixed(4),
      knownMatchScore: +scoreErosionGravity(erodePhys.downhillDecelFrac, erodePhys.uphillAccelFrac, erodePhys.zeroSpeedFrac, 1.0, true).toFixed(4),
      knownMismatchScore: +scoreErosionGravity(0.65, 0.95, 0.45, 0.35, false).toFixed(4),
      pass: false,
      source: 'Beyer (2015) TU München hydraulic erosion; Lague Hydraulic-Erosion (MIT): v^2 = v0^2 - 2g*dh',
    },
    {
      id: 'river-junction-staircase-cliffs',
      label: 'rivers.ts breachUnconfined R.cap vertical cliff drops & ID collisions',
      measured: `cliffs>0.5m=${cliffJunctions}/${junctionChecks} (${(100 * cliffJunctions / junctionChecks).toFixed(1)}%), maxDrop=-${maxCliffDrop.toFixed(3)}m, capCollisions=${upCollisions}/${upCounts.size}, uphillWithin=${uphillWithin}`,
      expected: `0% cliffs >0.5m, maxStep<=0.25m, 0 shared-up R.cap collisions, 0 uphill steps`,
      score: +scoreJunctionContinuity(cliffJunctions / junctionChecks, maxCliffDrop, upCollisions / upCounts.size, uphillWithin + uphillJunctions).toFixed(4),
      knownMatchScore: +scoreJunctionContinuity(0, 0.12, 0, 0).toFixed(4),
      knownMismatchScore: +scoreJunctionContinuity(0.30, 3.8, 0.45, 5).toFixed(4),
      pass: false,
      source: 'Chow (1959) Open-Channel Hydraulics; Barnes et al. (2014) Comput. Geosci. 62:117; Lindsay (2016) Hydrol. Process. 30:846',
    },
    {
      id: 'river-mouth-lake-surface-continuity',
      label: 'flow.ts outlet filled[c]=h[c] sub-lake plunging river mouths',
      measured: `mouthMismatch>0.15m=${mouthMismatch}/${mouthChecks} (${(100 * mouthMismatch / mouthChecks).toFixed(1)}%), maxJump=${maxMouthJump.toFixed(3)}m, maxSubLakePlunge=-${maxSubLakePlunge.toFixed(3)}m below -0.25m`,
      expected: `0% mouth mismatches >0.15m, 0.00m plunge below lake surface -0.25m`,
      score: +scoreMouthContinuity(mouthMismatch / mouthChecks, maxSubLakePlunge, maxMouthJump).toFixed(4),
      knownMatchScore: +scoreMouthContinuity(0, 0, 0.02).toFixed(4),
      knownMismatchScore: +scoreMouthContinuity(0.30, 4.0, 3.5).toFixed(4),
      pass: false,
      source: 'Leopold, Wolman & Miller (1964) Fluvial Processes in Geomorphology: lake-surface base-level control',
    },
    {
      id: 'river-containment-and-planform-report-integrity',
      label: 'riverContain.ts midpoint false-pass & planformReport 2.67x overcount',
      measured: `denseOpen=${denseOpen}/${denseTotal} (${(100 * denseOpen / denseTotal).toFixed(2)}%, maxLift=+${maxDenseLift.toFixed(3)}m) vs midpointReport=${midContain.openShare.toFixed(3)}; planformReport meanderPieces=${pfRep.meanderPieces} vs ${uniqueMeander} unique (${(pfRep.meanderPieces / Math.max(1, uniqueMeander)).toFixed(2)}x); SLOTS=3 full=${slotsFull}/${nonEmptyCells}`,
      expected: `denseOpen=0%, maxLift<=0.02m, planformReport exact 1.00x unique count, 0 SLOTS overflow`,
      score: +scoreContainmentAndPlanform(denseOpen / denseTotal, maxDenseLift, Math.abs(denseOpen / denseTotal - midContain.openShare), pfRep.meanderPieces / Math.max(1, uniqueMeander), slotsFull / Math.max(1, nonEmptyCells)).toFixed(4),
      knownMatchScore: +scoreContainmentAndPlanform(0, 0.01, 0, 1.0, 0).toFixed(4),
      knownMismatchScore: +scoreContainmentAndPlanform(0.05, 0.40, 0.05, 3.0, 0.20).toFixed(4),
      pass: false,
      source: 'Hydrostatics (free surface confined along full reach); Leopold & Wolman (1960) GSA Bull. 71:769',
    },
    {
      id: 'soils-river-pond-exclusion-and-worldcover-calibration',
      label: 'soils.ts missing 5,374 river-pond cells (483.7 ha) & dry-land bedrock skew',
      measured: `pondNotWater=${pondNotWater}/${pondCells} (100.0%, ${(pondCells * 0.09).toFixed(1)} ha), trueDryBedrock=${bedrockTrueDryPct.toFixed(2)}% (target 11.40%), soilAt dry-on-water=${waterHalfDrySoil}/${waterHalfCells} (${(100 * waterHalfDrySoil / waterHalfCells).toFixed(1)}%), water-on-dry=${dryHalfWaterSoil}`,
      expected: `0/5374 pond cells misclassified, trueDryBedrock=11.40% (+-0.1%), 0% water-as-dry soilAt`,
      score: +scoreSoilsPondClassification(pondNotWater / Math.max(1, pondCells), bedrockTrueDryPct, waterHalfDrySoil / Math.max(1, waterHalfCells)).toFixed(4),
      knownMatchScore: +scoreSoilsPondClassification(0, 11.40, 0).toFixed(4),
      knownMismatchScore: +scoreSoilsPondClassification(1.0, 13.0, 0.30).toFixed(4),
      pass: false,
      source: 'ESA WorldCover 2021 (11.4% Kenora outcrop share); Hallett & Roed (1980) NOEGTS 36; Nobre et al. (2011) J. Hydrol. 404:13',
    },
    {
      id: 'flow-twi-and-inspector-fill-depth-scale',
      label: 'flow.ts twi() unscaled slope & world.ts fill-depth missing g.k (8.05x)',
      measured: `twiMeanDiff=${twiMeanDiff.toFixed(3)}, twiMaxDiff=${twiDiffMax.toFixed(3)}, cells>|1.0|=${twiGt1}/${N} (${(100 * twiGt1 / N).toFixed(1)}%), worldFillScale=1/${g.k.toFixed(2)} (${(fillDepthScale * 100).toFixed(1)}% of true m)`,
      expected: `twiMeanDiff<0.1, 0% cells>|1.0|, worldFillScale=1.00 (multiplied by g.k)`,
      score: +scoreFlowTwiAndFillUnits(twiMeanDiff, twiGt1 / N, fillDepthScale).toFixed(4),
      knownMatchScore: +scoreFlowTwiAndFillUnits(0, 0, 1.0).toFixed(4),
      knownMismatchScore: +scoreFlowTwiAndFillUnits(2.0, 0.95, 1 / 8.05).toFixed(4),
      pass: false,
      source: 'Beven & Kirkby (1979) Hydrol. Sci. Bull. 24:43 (TWI = ln(a / tan beta) in metric world units)',
    },
  ];

  for (const ch of checks) ch.pass = ch.score >= 0.95;
  const calibrationValid = checks.every(c => c.knownMatchScore >= 0.99 && c.knownMismatchScore <= 0.25);
  const meanScore = +(checks.reduce((s, c) => s + c.score, 0) / checks.length).toFixed(4);
  const passedCount = checks.filter(c => c.pass).length;

  const live = await captureLive(HERE);

  const report = {
    seed: SEED,
    baseUrl: BASE,
    calibrationValid,
    passedCount,
    totalChecks: checks.length,
    meanScore,
    live,
    checks,
  };
  writeFileSync(join(HERE, 'numbers.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify(report, null, 2));
}

main().catch(err => { console.error(err); process.exit(1); });
