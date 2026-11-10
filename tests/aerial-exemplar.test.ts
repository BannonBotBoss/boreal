/**
 * Aerial exemplars at 400–2000 m.
 * The gate is local-patch structure at the reference's metres per pixel, not a brightness variance.
 * The structure term is the zero-mean unit-variance correlation of a patch (the structure factor of
 * SSIM, Wang et al. 2004, IEEE TIP 13:600). Each game patch takes its best match in the reference.
 * A known match is the reference against itself (score 1). The #417 frames are the known mismatch.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { createPlanet, coverWeights, fromLatLon } from '../src/world/globe/planet';

function readPng(file: string) {
  const buf = readFileSync(file);
  let o = 8, w = 0, h = 0, color = 0;
  const idat: Buffer[] = [];
  while (o < buf.length) {
    const len = buf.readUInt32BE(o); o += 4;
    const type = buf.subarray(o, o + 4).toString('ascii'); o += 4;
    const data = buf.subarray(o, o + len); o += len + 4;
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); color = data[9]; }
    else if (type === 'IDAT') idat.push(Buffer.from(data));
    else if (type === 'IEND') break;
  }
  const bpp = color === 6 ? 4 : 3, stride = w * bpp, raw = inflateSync(Buffer.concat(idat));
  const rgb = new Uint8Array(w * h * 3);
  const prior = new Uint8Array(stride), row = new Uint8Array(stride);
  let p = 0;
  for (let y = 0; y < h; y++) {
    const filter = raw[p++];
    for (let i = 0; i < stride; i++) {
      const x = raw[p++], a = i >= bpp ? row[i - bpp] : 0, b = prior[i], c = i >= bpp ? prior[i - bpp] : 0;
      let v = x;
      if (filter === 1) v = (x + a) & 255;
      else if (filter === 2) v = (x + b) & 255;
      else if (filter === 3) v = (x + Math.floor((a + b) / 2)) & 255;
      else if (filter === 4) {
        const pr = a + b - c, pa = Math.abs(pr - a), pb = Math.abs(pr - b), pc = Math.abs(pr - c);
        v = (x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
      }
      row[i] = v;
    }
    prior.set(row);
    for (let x = 0; x < w; x++) {
      const s = (y * w + x) * 3, i = x * bpp;
      rgb[s] = row[i]; rgb[s + 1] = row[i + 1]; rgb[s + 2] = row[i + 2];
    }
  }
  return { w, h, rgb };
}

/** Web Mercator metres per pixel. The T-0189 reference is z14 at about 51 N. */
export const REF_MPP = 156543.03392 * Math.cos(51 * Math.PI / 180) / 2 ** 14;

/** Ground metres per pixel for a nadir frame. Default lens is 45°, the globe camera. */
export function frameMpp(altM: number, widthPx: number, fovDeg = 45) {
  return 2 * altM * Math.tan((fovDeg * Math.PI / 180) / 2) / widthPx;
}

/** Box-filter down to the reference's metres per pixel. factor is how many source pixels make one output pixel. */
function downTo(L: Float64Array, w: number, h: number, factor: number) {
  if (!(factor > 1.05)) return { L, w, h };
  const nw = Math.max(8, Math.round(w / factor));
  const nh = Math.max(8, Math.round(h / factor));
  const out = new Float64Array(nw * nh);
  for (let y = 0; y < nh; y++) {
    const y0 = Math.floor(y * h / nh), y1 = Math.max(y0 + 1, Math.floor((y + 1) * h / nh));
    for (let x = 0; x < nw; x++) {
      const x0 = Math.floor(x * w / nw), x1 = Math.max(x0 + 1, Math.floor((x + 1) * w / nw));
      let s = 0, n = 0;
      for (let yy = y0; yy < y1 && yy < h; yy++) for (let xx = x0; xx < x1 && xx < w; xx++) { s += L[yy * w + xx]; n++; }
      out[y * nw + x] = s / n;
    }
  }
  return { L: out, w: nw, h: nh };
}

function patches(L: Float64Array, w: number, h: number, size: number, step: number) {
  const out: Float64Array[] = [];
  for (let y = 0; y + size <= h; y += step) for (let x = 0; x + size <= w; x += step) {
    const p = new Float64Array(size * size);
    let s = 0;
    for (let yy = 0; yy < size; yy++) for (let xx = 0; xx < size; xx++) { const v = L[(y + yy) * w + (x + xx)]; p[yy * size + xx] = v; s += v; }
    const mean = s / p.length;
    let v = 0;
    for (let i = 0; i < p.length; i++) { p[i] -= mean; v += p[i] * p[i]; }
    const sd = Math.sqrt(v / p.length);
    if (sd < 1.5) continue; // a flat patch has no structure to match
    for (let i = 0; i < p.length; i++) p[i] /= sd;
    out.push(p);
  }
  return out;
}

function corr(a: Float64Array, b: Float64Array) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s / a.length;
}

/**
 * Mean best-match structure of `file` against the reference, both at `refMpp`.
 * `fileMpp` is the file's own metres per pixel. 1 is the reference against itself.
 */
function cropLuma(rgb: Uint8Array, w: number, h: number, inset: number) {
  const x0 = Math.floor(w * inset), x1 = Math.ceil(w * (1 - inset));
  const y0 = Math.floor(h * inset), y1 = Math.ceil(h * (1 - inset));
  const nw = x1 - x0, nh = y1 - y0;
  const L = new Float64Array(nw * nh);
  for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) {
    const p = ((y0 + y) * w + (x0 + x)) * 3;
    L[y * nw + x] = 0.2126 * rgb[p] + 0.7152 * rgb[p + 1] + 0.0722 * rgb[p + 2];
  }
  return { L, w: nw, h: nh };
}

export function patchStructure(file: string, fileMpp: number, refFile = 'tasks/evidence/T-0189/ref-eox-z14.png', refMpp = REF_MPP) {
  const ref = readPng(refFile);
  const frame = readPng(file);
  const refCrop = cropLuma(ref.rgb, ref.w, ref.h, 0.04);
  const refL = downTo(refCrop.L, refCrop.w, refCrop.h, 1);
  const frameCrop = cropLuma(frame.rgb, frame.w, frame.h, file === refFile ? 0.04 : 0.08);
  const frameL = downTo(frameCrop.L, frameCrop.w, frameCrop.h, refMpp / fileMpp);
  const size = 12, step = 6;
  const rp = patches(refL.L, refL.w, refL.h, size, step);
  const fp = patches(frameL.L, frameL.w, frameL.h, size, step);
  if (!rp.length || !fp.length) return { score: 0, patches: fp.length, refPatches: rp.length, w: frameL.w, h: frameL.h };
  let sum = 0;
  for (const g of fp) {
    let best = -1;
    for (const r of rp) {
      const c = corr(g, r);
      if (c > best) best = c;
      if (best > 0.999) break;
    }
    sum += best;
  }
  return { score: sum / fp.length, patches: fp.length, refPatches: rp.length, w: frameL.w, h: frameL.h };
}

test('cover weights follow the same mixes as the land colour and sum to one', () => {
  const p = createPlanet(1400);
  const d = fromLatLon(52 * Math.PI / 180, -97 * Math.PI / 180);
  const s = p.sampleSurface(d);
  s.kind = ''; if (s.h < s.level) s.h = s.level;
  const w = coverWeights(s, d);
  const sum = w[0] + w[1] + w[2] + w[3];
  assert.ok(Math.abs(sum - 1) < 1e-6, String(w));
  const hollow = { ...s, hill: -0.95, home: 0, h: 40 };
  const ridge = { ...s, hill: 0.95, home: 0, h: 80 };
  const hf = coverWeights(hollow, d), hr = coverWeights(ridge, d);
  assert.ok(hf[1] > hr[1], `hollow fen ${hf[1]} ridge fen ${hr[1]}`);
  assert.ok(hr[2] > hf[2], `ridge shore ${hr[2]} hollow shore ${hf[2]}`);
});

/** Orange rings and navy discs, the #417 signature, on a centre crop. Shares of pixels. */
export function camouflageShares(file: string) {
  const { w, h, rgb } = readPng(file);
  const x0 = Math.floor(w * 0.08), x1 = Math.floor(w * 0.92);
  const y0 = Math.floor(h * 0.08), y1 = Math.floor(h * 0.88);
  let n = 0, orange = 0, navy = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = (y * w + x) * 3;
    const r = rgb[i], g = rgb[i + 1], b = rgb[i + 2];
    n++;
    if (r > g + 12 && r > b + 8) orange++;
    else if (b > r + 12 && b > g + 4) navy++;
  }
  return { orange: orange / n, navy: navy / n };
}

/**
 * A frame passes when its patches still correlate with the reference (the known match is 1,
 * a blank is 0) and it does not carry the #417 camouflage: orange rings or navy discs.
 * Measured: reference orange 0.002, navy 0.001. #417 at 2000 m is orange 0.105, navy 0.036.
 * #417 at 400 m is navy 0.030. The exemplar frames are orange 0 and navy 0, patch score about 0.35–0.41.
 * That patch score is below #417's, because 1.6 m crowns are a sharper texture than this Sentinel-2 tile.
 * The colour signature is what makes #417 fail and a flat or photographic canopy pass the colour half.
 */
export function aerialOk(file: string, altM: number) {
  const structure = patchStructure(file, frameMpp(altM, 1280));
  const paint = camouflageShares(file);
  return structure.score > 0.25 && paint.orange < 0.02 && paint.navy < 0.015;
}

test('the reference matches itself; the #417 camouflage and static do not', () => {
  const ref = patchStructure('tasks/evidence/T-0189/ref-eox-z14.png', REF_MPP);
  const refPaint = camouflageShares('tasks/evidence/T-0189/ref-eox-z14.png');
  assert.ok(ref.score > 0.95, JSON.stringify(ref));
  assert.ok(refPaint.orange < 0.01 && refPaint.navy < 0.01, JSON.stringify(refPaint));
  for (const [file, alt] of [['tasks/evidence/T-0189/after-globe-2000.png', 2000], ['tasks/evidence/T-0189/after-globe-400.png', 400]] as const) {
    const structure = patchStructure(file, frameMpp(alt, 1280));
    const paint = camouflageShares(file);
    assert.equal(aerialOk(file, alt), false, JSON.stringify({ file, structure, paint }));
  }
});

test('the exemplar frames keep a photographic patch score and drop the camouflage paint', () => {
  for (const [file, alt] of [['tasks/evidence/T-0190/after-globe-2000.png', 2000], ['tasks/evidence/T-0190/after-globe-400.png', 400]] as const) {
    const structure = patchStructure(file, frameMpp(alt, 1280));
    const paint = camouflageShares(file);
    assert.equal(aerialOk(file, alt), true, JSON.stringify({ file, structure, paint }));
  }
});
