/**
 * Canopy exemplar structure (T-0199).
 * The old crop was 128 px at 1.6 m per pixel, so a crown was a texel or two.
 * This crop is 1024 px at 1 m per pixel. The score is the correlation of luminance
 * with itself 8 m away (a crown diameter). A shuffle of the same pixels keeps the
 * variance and destroys the correlation. Variance is not the gate.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

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

/** Correlation of luminance with a copy shifted by `lag` pixels. 1 is a flat field. 0 is unstructured. */
export function lumaCorr(rgb: Uint8Array, w: number, h: number, lag: number, step = 4) {
  let s0 = 0, s1 = 0, s00 = 0, s11 = 0, s01 = 0, n = 0;
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x + lag < w; x += step) {
      const i = (y * w + x) * 3, j = (y * w + x + lag) * 3;
      const a = 0.2126 * rgb[i] + 0.7152 * rgb[i + 1] + 0.0722 * rgb[i + 2];
      const b = 0.2126 * rgb[j] + 0.7152 * rgb[j + 1] + 0.0722 * rgb[j + 2];
      s0 += a; s1 += b; s00 += a * a; s11 += b * b; s01 += a * b; n++;
    }
  }
  const m0 = s0 / n, m1 = s1 / n;
  const v0 = s00 / n - m0 * m0, v1 = s11 / n - m1 * m1;
  return (s01 / n - m0 * m1) / Math.sqrt(Math.max(1e-12, v0 * v1));
}

function shuffle(rgb: Uint8Array, w: number, h: number) {
  const n = w * h;
  const order = new Uint32Array(n);
  for (let i = 0; i < n; i++) order[i] = i;
  let s = 0x9e3779b9;
  const rnd = () => { s = Math.imul(s ^ (s >>> 16), 0x7feb352d); s = Math.imul(s ^ (s >>> 15), 0x846ca68b); s ^= s >>> 16; return (s >>> 0) / 4294967296; };
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const t = order[i]; order[i] = order[j]; order[j] = t;
  }
  const out = new Uint8Array(rgb.length);
  for (let i = 0; i < n; i++) out.set(rgb.subarray(order[i] * 3, order[i] * 3 + 3), i * 3);
  return out;
}

test('the canopy crop is at least 1024 px at about 1 m per pixel', () => {
  const photo = readPng('public/aerial/source/canopy.png');
  const gauss = readPng('public/aerial/canopy.png');
  assert.ok(photo.w >= 1024 && photo.h >= 1024, `${photo.w}x${photo.h}`);
  assert.equal(gauss.w, photo.w);
  assert.equal(gauss.h, photo.h);
  const meta = JSON.parse(readFileSync('public/aerial/meta.json', 'utf8'));
  assert.equal(meta.canopyPixels, 1024);
  assert.equal(meta.canopyMetresPerPixel, 1);
  assert.equal(meta.canopyMetres, 1024);
  // Fen, shore, and water keep the 128 px repeat. One world size for those.
  assert.ok(Math.abs(meta.metres - 204.21) < 0.1);
  const shader = readFileSync('src/world/globe/tile.ts', 'utf8');
  assert.ok(shader.includes('uExCanopyMetres'), 'the canopy repeat is its own metres, not the 128 px crop');
  assert.ok(shader.includes('tbSample'), 'tiling and blending stays the Deliot and Heitz sampler');
  assert.ok(shader.includes('tbSampleOne'), 'the crown band is one tap, not three blended offsets');
});

test('crown-scale correlation is structure, and a same-variance shuffle is not', () => {
  const photo = readPng('public/aerial/source/canopy.png');
  // 8 px at 1 m per pixel is 8 m, a boreal crown (Burns and Honkala 1990, spruce crowns a few metres).
  const real = lumaCorr(photo.rgb, photo.w, photo.h, 8);
  const noise = lumaCorr(shuffle(photo.rgb, photo.w, photo.h), photo.w, photo.h, 8);
  assert.ok(real > 0.2, `photo correlation at 8 m is ${real.toFixed(3)}`);
  assert.ok(noise < 0.05, `shuffled correlation at 8 m is ${noise.toFixed(3)}`);
  assert.ok(real > noise * 4, `structure ${real.toFixed(3)} vs shuffled ${noise.toFixed(3)}`);
});
