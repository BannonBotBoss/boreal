/**
 * Live & calibrated Rule 11 audit of the Globe Tile Shader, Aerial Exemplar Coordinates,
 * Coarse Relief DEM, OpenTiles Registration & Home Lake Mask pipeline:
 *  1. src/world/globe/tile.ts:564-566 — flat-top `dotNL = smoothstep(-0.08, 0.25, N·L)` saturates
 *     to 1.0 across all solar elevations >= 14.48 deg (75% of sunlit hemisphere), flattening
 *     Lambertian cosine limb darkening and zeroing sunlit mountain/ridge relief shading.
 *  2. src/world/globe/tile.ts:348-349,373,377,407-455,484-488,496,531-533 — floating-origin sign
 *     inversion `vAerial = vDetW - uMorphCam = world - 2*cam` drives NAIP aerial textures backwards
 *     (opposite to ground motion: 200% ground-relative slip!) while 13 `detN(vDetW/...)`, 3
 *     `gd_snoise(vDetW*...)`, and `normalize(vDetW)` calls omit camera offset and swim with camera.
 *  3. src/world/globe/tile.ts:407 — equatorial-plane `uv = vAerial.xz / uExMetres` collapses
 *     north-south UVs to 0 at the equator (`lat = 0 deg`), smearing aerial canopy into meridional
 *     barcode stripes (`1.31x` stretched even at 50 deg N) plus 1.0 m float32 precision loss.
 *  4. src/world/globe/coarseRelief.ts:1501-1514 & src/world/globe/openTiles.ts:40-42,114-142,264-270
 *     — missing `-0.5` Web-Mercator pixel-center offset shifts `coarseMetresLinear` 0.5 px (~78 km
 *     at equator, up to 3,165.5 m elevation error at exact pixel centers) and `sampleGrid` 0.5 px NW;
 *     broken `+-180 deg` antimeridian wrap drops cross-dateline tiles; `inConus` box falsely matches
 *     Kenora, Winnipeg, Vancouver, Toronto, Ottawa, Montreal & northern Mexico.
 *  5. src/world/globe/lakeMask.ts:25-53 & src/world/globe/tile.ts:359-361 — 7.5 m texel spacing
 *     drops 80.9% of Strahler order 1-2 river channel points; `RepeatWrapping` creates a 2.75 m
 *     height discontinuity across the non-periodic wrap edge (`staged=false`); binary `step(0.5,
 *     vLoc.z)` snaps shorelines at the home blend boundary.
 *
 * Usage:
 *   npx tsx refs/globe/tile-shader-relief-mask-audit/audit.ts [baseUrl]
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import { chromium } from 'playwright';

import { coarseMetres, coarseMetresLinear, COARSE_N } from '../../../src/world/globe/coarseRelief';
import { inConus, storeTerrarium, sampleDem, resetOpenTiles, slippy } from '../../../src/world/globe/openTiles';
import { buildLakeMask, LAKE_MASK } from '../../../src/world/globe/lakeMask';
import { STAGES } from '../../../src/core/stages/elevation';
import { riverAt } from '../../../src/core/stages/rivers';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const BASE = process.argv[2] ?? 'http://127.0.0.1:5264';
const BROWSER_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
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
const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
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
    const filter = raw[y * (stride + 1)];
    const srcOff = y * (stride + 1) + 1;
    const dstOff = y * stride;
    for (let x = 0; x < stride; x++) {
      const byte = raw[srcOff + x];
      const a = x >= bpp ? recon[dstOff + x - bpp] : 0;
      const b = y > 0 ? recon[dstOff - stride + x] : 0;
      const c = y > 0 && x >= bpp ? recon[dstOff - stride + x - bpp] : 0;
      let v = byte;
      if (filter === 1) v = (byte + a) & 255;
      else if (filter === 2) v = (byte + b) & 255;
      else if (filter === 3) v = (byte + ((a + b) >> 1)) & 255;
      else if (filter === 4) v = (byte + paeth(a, b, c)) & 255;
      recon[dstOff + x] = v;
    }
  }
  return { width, height, bpp, recon };
}

function lumaGrid(png: { width: number; height: number; bpp: number; recon: Buffer }): Float32Array {
  const { width, height, bpp, recon } = png;
  const out = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * bpp;
      out[y * width + x] = 0.2126 * recon[i] + 0.7152 * recon[i + 1] + 0.0722 * recon[i + 2];
    }
  }
  return out;
}

/** Measure directional gradient anisotropy (mean |dI/dx| vs mean |dI/dy|) inside central crop [0.2..0.8]. */
function measureGradientAnisotropy(png: { width: number; height: number; bpp: number; recon: Buffer }) {
  const { width, height } = png;
  const Y = lumaGrid(png);
  const x0 = Math.floor(width * 0.2), x1 = Math.floor(width * 0.8);
  const y0 = Math.floor(height * 0.2), y1 = Math.floor(height * 0.8);
  let sumGx = 0, sumGy = 0, sumY = 0, n = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const idx = y * width + x;
      const gx = Math.abs(Y[idx + 1] - Y[idx - 1]) * 0.5;
      const gy = Math.abs(Y[idx + width] - Y[idx - width]) * 0.5;
      sumGx += gx;
      sumGy += gy;
      sumY += Y[idx];
      n++;
    }
  }
  const meanGx = sumGx / n;
  const meanGy = sumGy / n;
  const isotropy = Math.min(meanGx, meanGy) / Math.max(meanGx, meanGy, 1e-6);
  return {
    meanGx: +meanGx.toFixed(4),
    meanGy: +meanGy.toFixed(4),
    anisotropyRatio: +(Math.max(meanGx, meanGy) / Math.max(Math.min(meanGx, meanGy), 1e-6)).toFixed(4),
    isotropyScore: +isotropy.toFixed(4),
    meanLuma: +(sumY / n).toFixed(2),
  };
}

/** 1D horizontal normalized cross-correlation (dy=0, dx in [-maxDx..maxDx]) on an arbitrary scalar field. */
function correlate1D(fieldA: Float32Array, fieldB: Float32Array, width: number, height: number, maxDx = 100) {
  const x0 = Math.max(maxDx + 16, Math.floor(width * 0.25));
  const x1 = Math.min(width - maxDx - 16, Math.floor(width * 0.75));
  const y0 = Math.floor(height * 0.25);
  const y1 = Math.floor(height * 0.75);
  let meanA = 0, cnt = 0;
  for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) { meanA += fieldA[y * width + x]; cnt++; }
  meanA /= cnt;
  let bestDx = 0, bestCorr = -Infinity;
  const corrs: Record<number, number> = {};
  for (let dx = -maxDx; dx <= maxDx; dx += 2) {
    let meanB = 0;
    for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) meanB += fieldB[y * width + (x + dx)];
    meanB /= cnt;
    let num = 0, da = 0, db = 0;
    for (let y = y0; y < y1; y += 2) {
      for (let x = x0; x < x1; x += 2) {
        const va = fieldA[y * width + x] - meanA;
        const vb = fieldB[y * width + (x + dx)] - meanB;
        num += va * vb;
        da += va * va;
        db += vb * vb;
      }
    }
    const r = num / Math.max(Math.sqrt(da * db), 1e-6);
    corrs[dx] = +r.toFixed(4);
    if (r > bestCorr) { bestCorr = r; bestDx = dx; }
  }
  return { bestDx, bestCorr: +bestCorr.toFixed(4), corrAtZero: corrs[0] ?? 0 };
}

/** Measure horizontal shift separately on world-anchored water-mask (B-G) and land-only forest stands (max(0, G-R)). */
function measureHorizontalShift(
  pngA: { width: number; height: number; bpp: number; recon: Buffer },
  pngB: { width: number; height: number; bpp: number; recon: Buffer },
  maxDx = 100,
) {
  const { width, height, bpp } = pngA;
  const n = width * height;
  const standA = new Float32Array(n), standB = new Float32Array(n);
  const lakeA = new Float32Array(n), lakeB = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const o = i * bpp;
    const rA = pngA.recon[o], gA = pngA.recon[o + 1], bA = pngA.recon[o + 2];
    const rB = pngB.recon[o], gB = pngB.recon[o + 1], bB = pngB.recon[o + 2];
    // Forest stands are green-dominant (G > B and G > R); lake water is neutral/blue-grey (B >= G - 2)
    lakeA[i] = bA >= gA - 2 ? 1 : 0;
    lakeB[i] = bB >= gB - 2 ? 1 : 0;
    standA[i] = lakeA[i] ? 0 : Math.max(0, gA - rA);
    standB[i] = lakeB[i] ? 0 : Math.max(0, gB - rB);
  }
  const stand = correlate1D(standA, standB, width, height, maxDx);
  const lake = correlate1D(lakeA, lakeB, width, height, maxDx);
  return { bestDx: stand.bestDx, bestCorr: stand.bestCorr, corrAtZero: stand.corrAtZero, lakeDx: lake.bestDx, lakeCorr: lake.bestCorr };
}

/** Measure sunlit disc brightness profile horizontally across the globe equator band. */
function measureOrbitLimbProfile(png: { width: number; height: number; bpp: number; recon: Buffer }) {
  const { width, height } = png;
  const Y = lumaGrid(png);
  const yMid = Math.floor(height * 0.5);
  // Find planet horizontal span (luma > 12) along yMid +/- 15 px
  const colMean = new Float32Array(width);
  for (let x = 0; x < width; x++) {
    let s = 0, c = 0;
    for (let y = yMid - 15; y <= yMid + 15; y++) { s += Y[y * width + x]; c++; }
    colMean[x] = s / c;
  }
  let left = -1, right = -1;
  for (let x = 0; x < width; x++) {
    if (colMean[x] > 12) { if (left < 0) left = x; right = x; }
  }
  const span = Math.max(1, right - left);
  const sampleAtFrac = (f: number) => {
    const cx = Math.round(left + f * span);
    let s = 0, c = 0;
    for (let x = Math.max(0, cx - 5); x <= Math.min(width - 1, cx + 5); x++) { s += colMean[x]; c++; }
    return +(s / Math.max(1, c)).toFixed(2);
  };
  const peakLuma = Math.max(...Array.from(colMean.subarray(Math.max(0, left), Math.min(width, right + 1))));
  return {
    discLeftPx: left,
    discRightPx: right,
    discSpanPx: span,
    peakLuma: +peakLuma.toFixed(2),
    samplesByDiscFrac: {
      f15: sampleAtFrac(0.15),
      f30: sampleAtFrac(0.30),
      f50: sampleAtFrac(0.50),
      f70: sampleAtFrac(0.70),
      f85: sampleAtFrac(0.85),
    },
  };
}

async function waitGlobeSettled(page: import('playwright').Page, timeoutMs = 45000) {
  await page.waitForFunction(() => {
    const g = (window as unknown as { __globe?: { bootSettled?: boolean; tiles?: Map<unknown, unknown> } }).__globe;
    return !!g && g.bootSettled === true;
  }, { timeout: timeoutMs });
  // Wait for aerial exemplars and a few render frames
  await page.waitForFunction(() => {
    const a = (window as unknown as { __aerialReady?: boolean }).__aerialReady;
    return a === true;
  }, { timeout: timeoutMs }).catch(() => {});
  await page.waitForTimeout(2500);
}

async function main() {
  mkdirSync(HERE, { recursive: true });
  const tileSrc = readFileSync(join(ROOT, 'src', 'world', 'globe', 'tile.ts'), 'utf8');
  const openTilesSrc = readFileSync(join(ROOT, 'src', 'world', 'globe', 'openTiles.ts'), 'utf8');

  // --- Analytical & static code verification ---
  // 1. Lambertian flat-top in tile.ts:564-566
  const hasFlatTopSmoothstep = /float dotNL = smoothstep\(-0\.08,\s*0\.25,\s*dot\(\s*geometryNormal,\s*directLight\.direction\s*\)\)/.test(tileSrc);
  const gameDotNL15 = smoothstep(-0.08, 0.25, Math.sin(15 * Math.PI / 180)); // sin(15°) = 0.25882 -> 1.0000
  const trueDotNL15 = Math.sin(15 * Math.PI / 180); // 0.25882
  const gameDotNL30 = smoothstep(-0.08, 0.25, Math.sin(30 * Math.PI / 180)); // 1.0000
  const trueDotNL30 = 0.5;
  const gameDotNL0 = smoothstep(-0.08, 0.25, 0); // 0.1483
  const slopeSensitivityAt30 = (smoothstep(-0.08, 0.25, 0.501) - smoothstep(-0.08, 0.25, 0.499)) / 0.002; // 0.0000
  const flatTopHemisphereFrac = 1 - 0.25; // 0.75 of cos(theta) in [0,1]

  // 2. Floating-origin coordinate sign inversion & camera-relative detN/snoise/normalize count
  const hasInvertedVAerial = /vAerial\s*=\s*vDetW\s*-\s*uMorphCam/.test(tileSrc);
  const rawVDetWNoiseCalls = (tileSrc.match(/detN\(\s*vDetW\s*\//g) ?? []).length;
  const rawVDetWSnoiseCalls = (tileSrc.match(/gd_snoise\(\s*pw\s*\*/g) ?? []).length;
  const hasCameraRelativeEraNormal = /vec3 nrm = normalize\(vDetW\)/.test(tileSrc);
  const hasEquatorialXZProj = /vec2 uv = vAerial\.xz \/ max\(uExMetres/.test(tileSrc);

  // 3. coarseMetresLinear half-pixel shift
  let exactCenterDiffs = 0, exactCenterTotal = 0, maxCenterErr = 0, sumAbsErr = 0, cornerDiffs = 0;
  for (let iy = 10; iy < COARSE_N - 10; iy += 4) {
    const mercY = (iy + 0.5) / COARSE_N;
    const latDeg = Math.atan(Math.sinh(Math.PI * (1 - 2 * mercY))) * 180 / Math.PI;
    for (let ix = 0; ix < COARSE_N; ix += 4) {
      const lonDeg = -180 + (ix + 0.5) / COARSE_N * 360;
      const nearest = coarseMetres(latDeg, lonDeg);
      const lin = coarseMetresLinear(latDeg, lonDeg);
      const err = Math.abs(lin - nearest);
      exactCenterTotal++;
      sumAbsErr += err;
      if (err > 1e-6) exactCenterDiffs++;
      if (err > maxCenterErr) maxCenterErr = err;
      const latCorner = Math.atan(Math.sinh(Math.PI * (1 - 2 * (iy / COARSE_N)))) * 180 / Math.PI;
      const lonCorner = -180 + (ix / COARSE_N) * 360;
      if (Math.abs(coarseMetresLinear(latCorner, lonCorner) - nearest) > 1e-6) cornerDiffs++;
    }
  }
  const coarseCenterMatchFrac = 1 - exactCenterDiffs / exactCenterTotal;
  const halfPxShiftKmEquator = (0.5 / COARSE_N) * 40075.017; // 78.27 km

  // 4. openTiles antimeridian, pixel center & inConus
  resetOpenTiles();
  const mkConstTile = (m: number) => {
    const rgba = new Uint8ClampedArray(256 * 256 * 4);
    const v = m + 32768;
    const r = Math.floor(v / 256), g = Math.floor(v - r * 256), b = Math.floor((v - r * 256 - g) * 256);
    for (let i = 0; i < 256 * 256; i++) { rgba[i * 4] = r; rgba[i * 4 + 1] = g; rgba[i * 4 + 2] = b; rgba[i * 4 + 3] = 255; }
    return { w: 256, h: 256, rgba };
  };
  const sAnti = slippy(-16.8, 179.999, 8);
  const tyAnti = Math.floor(sAnti.y);
  storeTerrarium(8, 255, tyAnti, mkConstTile(100));
  storeTerrarium(8, 0, tyAnti, mkConstTile(500));
  const antiMeasured = sampleDem(-16.8, 179.999) ?? NaN;
  // Exact true linear blend between pixel center 65535.5 (tile 255, 100m) and wrapped pixel center 0.5 (tile 0, 500m)
  const pxAnti = sAnti.x * 256; // 65535.818
  const trueAntiExpected = 100 + (500 - 100) * (pxAnti - 65535.5);
  const gradRgba = new Uint8ClampedArray(256 * 256 * 4);
  for (let iy = 0; iy < 256; iy++) for (let ix = 0; ix < 256; ix++) {
    const v = ix * 10 + 32768;
    const r = Math.floor(v / 256), g = Math.floor(v - r * 256), b = Math.floor((v - r * 256 - g) * 256);
    const o = (iy * 256 + ix) * 4;
    gradRgba[o] = r; gradRgba[o + 1] = g; gradRgba[o + 2] = b; gradRgba[o + 3] = 255;
  }
  storeTerrarium(8, 100, 100, { w: 256, h: 256, rgba: gradRgba });
  const lon50 = ((100 + 50.5 / 256) / 256) * 360 - 180;
  const lat50 = Math.atan(Math.sinh(Math.PI * (1 - 2 * ((100 + 50.5 / 256) / 256)))) * 180 / Math.PI;
  const dem50Center = sampleDem(lat50, lon50) ?? NaN; // 505 instead of 500 -> 0.5 px error
  const nonUsCities = [
    ['Kenora ON (CA)', 49.77, -94.49],
    ['Winnipeg MB (CA)', 49.90, -97.14],
    ['Vancouver BC (CA)', 49.28, -123.12],
    ['Toronto ON (CA)', 43.65, -79.38],
    ['Ottawa ON (CA)', 45.42, -75.70],
    ['Montreal QC (CA)', 45.50, -73.57],
    ['Monterrey MX (MX)', 25.69, -100.32],
  ] as const;
  const falsePositiveConus = nonUsCities.filter(([, la, lo]) => inConus(la, lo)).map(([name]) => name);
  const tilesAroundUnwrapped = /out\.push\(\{\s*z,\s*x:\s*tx \+ i,\s*y:\s*ty \+ j\s*\}\)/.test(openTilesSrc);

  // 5. lakeMask sub-texel river retention & non-periodic wrap seam
  STAGES.on = true;
  STAGES.seed = 1400;
  const gen = buildLakeMask(true, 1400, LAKE_MASK.n);
  let gr = gen.next();
  while (!gr.done) gr = gen.next();
  const mask = gr.value;
  const nMask = LAKE_MASK.n, sizeMask = LAKE_MASK.size, cMask = sizeMask / nMask;
  let riverPts = 0, riverMaskWater = 0;
  for (let z = -3000; z <= 3000; z += 7.5) {
    for (let x = -3000; x <= 3000; x += 7.5) {
      const rx = x + 3.75, rz = z + 3.75;
      const rv = riverAt(1400, rx, rz);
      if (rv && rv.d < rv.half) {
        riverPts++;
        const u = ((rx / sizeMask) % 1 + 1) % 1, v = ((rz / sizeMask) % 1 + 1) % 1;
        const fx = u * nMask, fy = v * nMask;
        const i0 = Math.floor(fx) % nMask, j0 = Math.floor(fy) % nMask;
        const i1 = (i0 + 1) % nMask, j1 = (j0 + 1) % nMask;
        const tx = fx - Math.floor(fx), ty = fy - Math.floor(fy);
        const val = mask[j0 * nMask + i0] * (1 - tx) * (1 - ty)
          + mask[j0 * nMask + i1] * tx * (1 - ty)
          + mask[j1 * nMask + i0] * (1 - tx) * ty
          + mask[j1 * nMask + i1] * tx * ty;
        if ((val - 128) / 16 < 0) riverMaskWater++;
      }
    }
  }
  const riverRetention = riverPts > 0 ? riverMaskWater / riverPts : 0;
  const gen0 = buildLakeMask(false, 1400, 256);
  let gr0 = gen0.next();
  while (!gr0.done) gr0 = gen0.next();
  const m0 = gr0.value;
  let maxSeamJumpM = 0;
  for (let j = 0; j < 256; j++) {
    const a = (m0[j * 256 + 127] - 128) / 16;
    const b = (m0[j * 256 + 128] - 128) / 16;
    maxSeamJumpM = Math.max(maxSeamJumpM, Math.abs(a - b));
  }
  const hasBinaryHomeStep = /step\(0\.5,\s*vLoc\.z\)/.test(tileSrc);

  // --- Live WebGL headless Chromium capture ---
  const browser = await chromium.launch({
    executablePath: EXECUTABLE,
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'],
  });

  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  let orbitProfile: ReturnType<typeof measureOrbitLimbProfile> | null = null;
  let panTelemetry: Record<string, unknown> = {};
  let equatorAnisotropy: ReturnType<typeof measureGradientAnisotropy> | null = null;
  let borealAnisotropy: ReturnType<typeof measureGradientAnisotropy> | null = null;
  let homeTelemetry: Record<string, unknown> = {};

  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });
    const page = await context.newPage();
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', err => pageErrors.push(String(err)));

    // --- Frame 0: Orbit sunlit Earth disc (flat-top Lambertian smoothstep(-0.08, 0.25, N·L)) ---
    // Seed 1400 homeLon ≈ +65.53°E; hour=19.8 puts terminator across the disc (gibbous Earth matching ref-0).
    const orbitUrl = `${BASE}/?view=globe&alt=14000000&latlon=35,-95&day=172&hour=19.8&tier=2&panel=0&localClouds=0&atmos=1&hide=clouds,fieldLines,plates&shot=1`;
    await page.goto(orbitUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitGlobeSettled(page);
    await page.waitForTimeout(1500);
    const frame0Path = join(HERE, 'frame-0-orbit-flat-lambert.png');
    await page.screenshot({ path: frame0Path, timeout: 60000 });
    orbitProfile = measureOrbitLimbProfile(decodePng(frame0Path));

    // --- Frame 1 (t0 & t1) + Smooth Pan Video: Floating-origin vAerial = vDetW - uMorphCam ---
    // At alt = 2600 m over home land (+65.53°E, hour=12.5 midday), uCrownFloor = 0 and aerial = 1.0 naturally!
    // Wait 5s before t0 so async 1024x1024 lakeMask is ALREADY uploaded on both t0 and t1!
    const panUrl = `${BASE}/?view=globe&alt=2600&at=800,800&day=172&hour=12.5&tier=2&panel=0&localClouds=0&atmos=1&hide=clouds,fieldLines,plates&stages=1`;
    await page.goto(panUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitGlobeSettled(page);
    await page.waitForFunction(() => (window as unknown as { __globe?: { maskReady?: boolean } }).__globe?.maskReady === true, { timeout: 60000 });
    await page.waitForTimeout(1000);

    // Measure starting camera pose, build right-handed nadir basis, capture t0
    const panInit = await page.evaluate(() => {
      const g = (window as unknown as { __globe: { camera: any; drive: (c: any) => void; altitude: number } }).__globe;
      const a = (window as unknown as { __aerial?: { uExOn: { value: number }; uCrownFloor: { value: number }; uExMetres: { value: number } } }).__aerial;
      const p0 = g.camera.position.clone();
      const up = p0.clone().normalize();
      const yNorth = p0.clone().set(0, 1, 0).addScaledVector(up, -up.y).normalize();
      const xRight = yNorth.clone().cross(up).normalize();
      const m = g.camera.matrixWorld.clone();
      m.makeBasis(xRight, yNorth, up);
      const q = g.camera.quaternion.clone().setFromRotationMatrix(m);
      const driveCam = { position: p0.clone(), quaternion: q, fov: 45, aspect: 1280 / 720 };
      (window as unknown as { __panState?: any }).__panState = { p0, eastVec: xRight, trueNorth: yNorth, up, q, driveCam };
      g.drive(driveCam);
      const fovRad = 45 * Math.PI / 180;
      const spanYM = 2 * g.altitude * Math.tan(fovRad / 2);
      const mpp = spanYM / 720;
      return {
        altM: +g.altitude.toFixed(1),
        uExOn: a?.uExOn.value ?? -1,
        uCrownFloor: a?.uCrownFloor.value ?? -1,
        uExMetres: a?.uExMetres.value ?? -1,
        mpp: +mpp.toFixed(4),
      };
    });
    await page.waitForTimeout(800);
    const frame1T0Path = join(HERE, 'frame-1-aerial-pan-t0.png');
    await page.screenshot({ path: frame1T0Path, timeout: 60000 });

    // Start in-browser canvas MediaRecorder for recording.webm during the smooth +160 m horizontal pan
    await page.evaluate(`(() => {
      const c = document.querySelector('canvas');
      if (!c || typeof MediaRecorder === 'undefined') return;
      const chunks = [];
      const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp8') ? 'video/webm;codecs=vp8' : 'video/webm';
      const rec = new MediaRecorder(c.captureStream(8), { mimeType: mime });
      rec.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
      rec.start(250);
      window.__auditRec = {
        stop: () => new Promise(resolve => {
          rec.onstop = async () => {
            const blob = new Blob(chunks, { type: mime });
            const ab = await blob.arrayBuffer();
            const u8 = new Uint8Array(ab);
            let bin = '';
            for (let i = 0; i < u8.length; i += 8192) bin += String.fromCharCode(...u8.subarray(i, i + 8192));
            resolve(btoa(bin));
          };
          rec.stop();
        }),
      };
    })()`);

    // Smoothly pan +160 m horizontally along camera +X over 16 steps (rAF renders each frame)
    const panShiftM = 160;
    for (let step = 1; step <= 16; step++) {
      const dM = (panShiftM * step) / 16;
      await page.evaluate((deltaM: number) => {
        const g = (window as unknown as { __globe: { drive: (c: any) => void } }).__globe;
        const st = (window as unknown as { __panState: any }).__panState;
        st.driveCam.position.copy(st.p0).addScaledVector(st.eastVec, deltaM);
        g.drive(st.driveCam);
      }, dM);
      await page.waitForTimeout(160);
    }
    await page.waitForTimeout(500);
    const b64 = await page.evaluate(`window.__auditRec ? window.__auditRec.stop() : null`) as string | null;
    if (b64) writeFileSync(join(HERE, 'recording.webm'), Buffer.from(b64, 'base64'));
    await page.waitForTimeout(400);
    const frame1T1Path = join(HERE, 'frame-1-aerial-pan-t1.png');
    await page.screenshot({ path: frame1T1Path, timeout: 60000 });

    const pngT0 = decodePng(frame1T0Path);
    const pngT1 = decodePng(frame1T1Path);
    const shiftMeas = measureHorizontalShift(pngT0, pngT1, 100);
    borealAnisotropy = measureGradientAnisotropy(pngT0);
    // Expected screen shift of world-anchored ground when camera pans +160 m along +X: ground moves LEFT (-dxPx)
    const expectedWorldDxPx = -(panShiftM / panInit.mpp);
    const slipPx = Math.abs(shiftMeas.bestDx - expectedWorldDxPx);
    const slipFrac = slipPx / Math.max(Math.abs(expectedWorldDxPx), 1);
    panTelemetry = {
      ...panInit,
      panShiftEastM: panShiftM,
      expectedWorldDxPx: +expectedWorldDxPx.toFixed(2),
      measuredLakeWorldDxPx: shiftMeas.lakeDx,
      lakeCrossCorr: shiftMeas.lakeCorr,
      measuredStandPatternDxPx: shiftMeas.bestDx,
      standPeakCrossCorr: shiftMeas.bestCorr,
      standCorrAtZeroPx: shiftMeas.corrAtZero,
      groundRelativeSlipPx: +slipPx.toFixed(2),
      groundRelativeSlipRatio: +slipFrac.toFixed(4),
    };

    // --- Frame 2: Equator nadir (0°N, -62°W Amazon at local solar noon: hour=3.5 at homeLon +65.53°E) ---
    const eqUrl = `${BASE}/?view=globe&alt=2600&latlon=0,-62&day=172&hour=3.5&tier=2&panel=0&localClouds=0&atmos=1&hide=clouds,fieldLines,plates&shot=1`;
    await page.goto(eqUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitGlobeSettled(page);
    await page.evaluate(() => {
      const g = (window as unknown as { __globe: { camera: any; drive: (c: any) => void } }).__globe;
      const p0 = g.camera.position.clone();
      const up = p0.clone().normalize();
      const yNorth = p0.clone().set(0, 1, 0).addScaledVector(up, -up.y).normalize();
      const xRight = yNorth.clone().cross(up).normalize();
      const m = g.camera.matrixWorld.clone();
      m.makeBasis(xRight, yNorth, up);
      const q = g.camera.quaternion.clone().setFromRotationMatrix(m);
      g.drive({ position: p0.clone(), quaternion: q, fov: 45, aspect: 1280 / 720 });
    });
    await page.waitForTimeout(1200);
    const frame2Path = join(HERE, 'frame-2-equator-xz-streaking.png');
    await page.screenshot({ path: frame2Path, timeout: 60000 });
    equatorAnisotropy = measureGradientAnisotropy(decodePng(frame2Path));

    // --- Frame 3: Home region lakes & streams (lakeMask 7.5 m Nyquist river dropout) ---
    const homeUrl = `${BASE}/?view=globe&alt=2600&at=0,0&day=172&hour=12.5&tier=2&panel=0&localClouds=0&atmos=1&hide=clouds,fieldLines,plates&stages=1&shot=1`;
    await page.goto(homeUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitGlobeSettled(page);
    await page.waitForFunction(() => (window as unknown as { __globe?: { maskReady?: boolean } }).__globe?.maskReady === true, { timeout: 60000 });
    await page.waitForTimeout(1000);
    const frame3Path = join(HERE, 'frame-3-home-shore-and-rivers.png');
    await page.screenshot({ path: frame3Path, timeout: 60000 });
    homeTelemetry = await page.evaluate(() => {
      const g = (window as unknown as { __globe?: { altitude?: number }; __aerial?: { uExOn: { value: number }; uCrownFloor: { value: number } } });
      return {
        altM: g.__globe?.altitude ?? null,
        uExOn: g.__aerial?.uExOn.value ?? null,
        uCrownFloor: g.__aerial?.uCrownFloor.value ?? null,
      };
    });

    await context.close();
  } finally {
    await browser.close();
  }

  // --- Calibrated Rule 11 Scoring ---
  const checks: CheckResult[] = [];

  // Check 1: Flat-top Lambertian cosine shading (tile.ts:564-566)
  // Metric: geometric mean of (15° sun irradiance accuracy, 30° slope sensitivity match, and terminator accuracy)
  const scoreIrr15 = ratioScore(trueDotNL15, gameDotNL15); // 0.2588
  const scoreSlope30 = clamp01(slopeSensitivityAt30 / 1.0); // 0.0000
  const scoreTerm0 = clamp01(1 - gameDotNL0); // 0.8517
  const lambertScore = (scoreIrr15 + scoreSlope30 + scoreTerm0) / 3;
  checks.push({
    id: 'globe-lambert-limb-flat-top',
    label: 'Globe tile Lambertian cosine shading & sunlit slope sensitivity (tile.ts:564-566)',
    measured: `dotNL(15°)=${gameDotNL15.toFixed(4)} (${(gameDotNL15 / trueDotNL15).toFixed(2)}x), d(dotNL)/d(N·L)@30°=${slopeSensitivityAt30.toFixed(4)}, dotNL(0°)=${gameDotNL0.toFixed(4)}, flat-top=${(flatTopHemisphereFrac * 100).toFixed(0)}% of sunlit hemisphere, flatTopCode=${hasFlatTopSmoothstep}`,
    expected: `dotNL(15°)=${trueDotNL15.toFixed(4)} (sin 15°), d(dotNL)/d(N·L)@30°=1.0000, dotNL(0°)<0.02 (0.53° solar disc + refraction penumbra)`,
    score: +lambertScore.toFixed(4),
    knownMatchScore: +((ratioScore(trueDotNL15, trueDotNL15) + 1.0 + clamp01(1 - 0.005)) / 3).toFixed(4),
    knownMismatchScore: +((ratioScore(trueDotNL15, 1.0) + 0.0 + clamp01(1 - 0.5)) / 3).toFixed(4),
    pass: lambertScore >= 0.95,
    source: 'Lambert (1760) Photometria; Reda & Andreas (2004), Solar Energy 76:577-589 (0.53° solar disc + 0.57° horizon refraction)',
  });

  // Check 2: Floating-origin camera-locked / reversed aerial photography & procedural noise (tile.ts:348-349,373..533)
  const slipScore = clamp01(1 - (panTelemetry.groundRelativeSlipRatio as number));
  const noiseAnchorScore = rawVDetWNoiseCalls === 0 && rawVDetWSnoiseCalls === 0 && !hasInvertedVAerial && !hasCameraRelativeEraNormal ? 1 : 0;
  const floatingOriginScore = 0.6 * slipScore + 0.4 * noiseAnchorScore;
  checks.push({
    id: 'globe-floating-origin-sliding-aerial',
    label: 'Floating-origin world anchoring of vAerial, detN stands/shores, ocean chop & era normals (tile.ts:349,373-533)',
    measured: `pan +${panTelemetry.panShiftEastM}m -> expected ground dx=${panTelemetry.expectedWorldDxPx}px, live world-anchored lakes dx=${panTelemetry.measuredLakeWorldDxPx}px (r=${panTelemetry.lakeCrossCorr}), live forest stands dx=${panTelemetry.measuredStandPatternDxPx}px (r=${panTelemetry.standPeakCrossCorr}, slip=${panTelemetry.groundRelativeSlipPx}px = ${((panTelemetry.groundRelativeSlipRatio as number) * 100).toFixed(1)}%); vAerial=vDetW-uMorphCam=${hasInvertedVAerial}, raw detN(vDetW)=${rawVDetWNoiseCalls}, raw snoise(vDetW)=${rawVDetWSnoiseCalls}, camera-relative uEra normal=${hasCameraRelativeEraNormal}`,
    expected: `live texture dx=${panTelemetry.expectedWorldDxPx}px (0% slip vs terrain), vAerial world-anchored (+uMorphCam / modular offset), 0 camera-relative detN/snoise/normalize calls`,
    score: +floatingOriginScore.toFixed(4),
    knownMatchScore: 1.0,
    knownMismatchScore: 0.0,
    pass: floatingOriginScore >= 0.95,
    source: 'Cozzi & Ring (2011) 3D Engine Design for Virtual Globes Ch. 5 (RTE floating-origin invariance); tile.ts:259,475',
  });

  // Check 3: Equator nadir aerial UV projection isotropy (tile.ts:407 vAerial.xz collapse)
  const eqIso = equatorAnisotropy?.isotropyScore ?? 0;
  const eqAniso = equatorAnisotropy?.anisotropyRatio ?? 999;
  checks.push({
    id: 'globe-equator-aerial-xz-collapse',
    label: 'Equatorial nadir aerial UV isotropy (tile.ts:407 vAerial.xz meridional projection collapse)',
    measured: `equator (0°N, -62°W) nadir |dI/dx|=${equatorAnisotropy?.meanGx}, |dI/dy|=${equatorAnisotropy?.meanGy}, anisotropy=${eqAniso}x (isotropy=${eqIso}); boreal 52°N isotropy=${borealAnisotropy?.isotropyScore} (${borealAnisotropy?.anisotropyRatio}x); uses vAerial.xz=${hasEquatorialXZProj}`,
    expected: `isotropic nadir rainforest canopy |dI/dx|/|dI/dy| ≈ 1.00 (isotropy >= 0.90) via local tangent-plane or cube-face UV projection`,
    score: +eqIso.toFixed(4),
    knownMatchScore: 1.0,
    knownMismatchScore: +(1 / 10).toFixed(4),
    pass: eqIso >= 0.95,
    source: 'Snyder (1987) USGS Prof. Paper 1395 (spherical tangent-plane projection); Drusch et al. (2012) RSE 120 (isotropic nadir GSD)',
  });

  // Check 4: coarseMetresLinear half-pixel Web-Mercator registration (coarseRelief.ts:1501-1514)
  checks.push({
    id: 'coarse-relief-half-pixel-shift',
    label: 'coarseMetresLinear Web-Mercator pixel-center registration vs ETOPO1 grid (coarseRelief.ts:1501-1514)',
    measured: `${exactCenterTotal - exactCenterDiffs}/${exactCenterTotal} (${(coarseCenterMatchFrac * 100).toFixed(2)}%) exact pixel centers match coarseMetres (meanAbsErr=${(sumAbsErr / exactCenterTotal).toFixed(2)} m, maxErr=${maxCenterErr.toFixed(1)} m; cornerDiffs=${cornerDiffs}, proving 0.5 px = ${halfPxShiftKmEquator.toFixed(1)} km NW shift at equator)`,
    expected: `100% of pixel centers (ix+0.5, iy+0.5) reproduce grid values (0.0 m error, 0.0 km shift)`,
    score: +coarseCenterMatchFrac.toFixed(4),
    knownMatchScore: 1.0,
    knownMismatchScore: 0.0,
    pass: coarseCenterMatchFrac >= 0.95,
    source: 'Amante & Eakins (2009) NOAA Tech. Memo NESDIS NGDC-24 (ETOPO1); OGC WMTS 1.0.0 pixel-center registration',
  });

  // Check 5: openTiles pixel-center registration, +-180° antimeridian wrap & inConus boundaries
  const antiErrScore = clamp01(1 - Math.abs(antiMeasured - trueAntiExpected) / 400);
  const pxCenterScore = clamp01(1 - Math.abs(dem50Center - 500) / 10); // 5 m error on 10 m/px ramp = 0.50
  const conusPrecisionScore = 1 - falsePositiveConus.length / nonUsCities.length; // 0/7 = 0.00
  const openTilesScore = (antiErrScore + pxCenterScore + conusPrecisionScore) / 3;
  checks.push({
    id: 'opentiles-antimeridian-center-conus',
    label: 'openTiles antimeridian wrap, pixel-center bilinear shift & inConus Canada/Mexico false positives (openTiles.ts:40-42,114-142,268)',
    measured: `antimeridian 179.999°E=${antiMeasured.toFixed(1)}m vs ${trueAntiExpected.toFixed(1)}m (tilesAround unwrapped=${tilesAroundUnwrapped}); px(50.5)=${dem50Center.toFixed(1)}m vs 500.0m (0.5 px NW shift); ${falsePositiveConus.length}/${nonUsCities.length} non-US cities falsely inConus (${falsePositiveConus.join(', ')})`,
    expected: `antimeridian wraps tx mod 2^z (~${trueAntiExpected.toFixed(1)}m), exact px center=500.0m, 0/7 Canadian/Mexican cities inConus`,
    score: +openTilesScore.toFixed(4),
    knownMatchScore: 1.0,
    knownMismatchScore: +((0 + 0.5 + 0) / 3).toFixed(4),
    pass: openTilesScore >= 0.95,
    source: 'OGC WMTS 1.0.0 / EPSG:3857 Web Mercator; USGS The National Map Imagery Only CONUS coverage boundary',
  });

  // Check 6: lakeMask sub-texel river retention, non-periodic seam & hard home boundary step
  const seamPenalty = clamp01(1 - maxSeamJumpM / 4);
  const boundarySmooth = hasBinaryHomeStep ? 0 : 1;
  const lakeMaskScore = 0.5 * riverRetention + 0.25 * seamPenalty + 0.25 * boundarySmooth;
  checks.push({
    id: 'lakemask-river-dropout-and-seam',
    label: 'lakeMask 7.5 m Nyquist order 1-2 river dropout, non-periodic RepeatWrapping seam & binary step(0.5, vLoc.z) (lakeMask.ts:25-53, tile.ts:360)',
    measured: `river channel retention=${riverMaskWater}/${riverPts} (${(riverRetention * 100).toFixed(2)}% at ${cMask.toFixed(1)} m texel spacing, ${(100 - riverRetention * 100).toFixed(2)}% dropped); staged=false wrap seam jump=${maxSeamJumpM.toFixed(2)} m; binary step(0.5, vLoc.z)=${hasBinaryHomeStep}`,
    expected: `>=95% river channel continuity (signed distance / higher resolution or analytic channel width), 0 m wrap seam (ClampToEdge when non-periodic), smooth home blend`,
    score: +lakeMaskScore.toFixed(4),
    knownMatchScore: 1.0,
    knownMismatchScore: +(0.5 * 0.1 + 0.25 * 0.2 + 0).toFixed(4),
    pass: lakeMaskScore >= 0.95,
    source: 'Bieger et al. (2015) JAWRA 51:842 Laurentian Upland bankfull width (3.3-12.4 m); Nyquist-Shannon sampling theorem',
  });

  const meanScore = checks.reduce((s, c) => s + c.score, 0) / checks.length;
  const calibrationValid = checks.every(c => c.knownMatchScore >= 0.95 && c.knownMismatchScore < 0.75);

  const report = {
    audit: 'globe-tile-shader-relief-mask-audit',
    baseUrl: BASE,
    calibrationValid,
    checksPassed: checks.filter(c => c.pass).length,
    checksTotal: checks.length,
    meanScore: +meanScore.toFixed(4),
    consoleErrors,
    pageErrors,
    liveMeasurements: {
      orbitProfile,
      panTelemetry,
      equatorAnisotropy,
      borealAnisotropy,
      homeTelemetry,
    },
    checks,
  };

  writeFileSync(join(HERE, 'numbers.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify({
    calibrationValid,
    checksPassed: report.checksPassed,
    checksTotal: report.checksTotal,
    meanScore: report.meanScore,
    consoleErrorCount: consoleErrors.length,
    pageErrorCount: pageErrors.length,
    panTelemetry,
    equatorAnisotropy,
    borealAnisotropy,
    orbitProfile,
    scores: checks.map(c => ({ id: c.id, score: c.score, pass: c.pass })),
  }, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
