/** The drone must not paint vegetated land as one fill or a black canvas. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { flatGroundFill, standMosaicActive } from '../src/world/globe/landMosaic';
import { farLayerScale } from '../src/world/globe/farLayer';

function readPng(file: string) {
  const buf = readFileSync(file);
  assert.equal(buf.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  let o = 8, w = 0, h = 0, color = 0;
  const idat: Buffer[] = [];
  while (o < buf.length) {
    const len = buf.readUInt32BE(o); o += 4;
    const type = buf.subarray(o, o + 4).toString('ascii'); o += 4;
    const data = buf.subarray(o, o + len); o += len + 4;
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); color = data[9]; }
    else if (type === 'IDAT') idat.push(data);
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

/** Ground crop, fractions of the frame. Skips the HUD. */
export function cropFill(file: string, box = { x0: 0.08, x1: 0.4, y0: 0.08, y1: 0.42 }) {
  const { w, h, rgb } = readPng(file);
  const x0 = Math.floor(w * box.x0), x1 = Math.floor(w * box.x1);
  const y0 = Math.floor(h * box.y0), y1 = Math.floor(h * box.y1);
  let n = 0, r = 0, g = 0, b = 0, l2 = 0, black = 0;
  const bins = new Set<string>();
  for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) {
    const i = (y * w + x) * 3, R = rgb[i], G = rgb[i + 1], B = rgb[i + 2];
    const L = 0.2126 * R + 0.7152 * G + 0.0722 * B;
    r += R; g += G; b += B; l2 += L * L; n++;
    if (L < 8) black++;
    bins.add(`${R >> 4},${G >> 4},${B >> 4}`);
  }
  const meanL = (0.2126 * r + 0.7152 * g + 0.0722 * b) / n;
  return {
    stdL: +Math.sqrt(Math.max(0, l2 / n - meanL * meanL)).toFixed(2),
    bins: bins.size,
    black: +(black / n).toFixed(3),
    mean: [+(r / n).toFixed(1), +(g / n).toFixed(1), +(b / n).toFixed(1)] as [number, number, number],
  };
}

test('Minimum detail does not turn the stand mosaic off, and a full disk does', () => {
  assert.equal(standMosaicActive(0, 1), true);
  assert.equal(standMosaicActive(1, 1), true);
  assert.equal(standMosaicActive(0, 30), false);
  const tile = readFileSync('src/world/globe/tile.ts', 'utf8');
  const gate = tile.indexOf('if (uDetail.x > 0.001)');
  const mosaic = tile.indexOf('// Stand mosaic.');
  assert.ok(gate > 0 && mosaic > gate);
  assert.ok(tile.slice(gate, mosaic).includes('}'), 'the mosaic is outside the detail gate');
  const skirt = readFileSync('src/render/horizonMesh.ts', 'utf8');
  for (const wave of ['40.0', '160.0', '640.0', '12.0']) assert.ok(skirt.includes(wave), wave);
  assert.ok(!skirt.includes('1.4, 0.96'));
});

test('the drone far layer stays full resolution while it is the picture', () => {
  assert.equal(farLayerScale(400, 1), 1);
  assert.equal(farLayerScale(8000, 1), 1);
  assert.equal(farLayerScale(20, 1), 0.5);
  assert.equal(farLayerScale(20, 0), 1);
});

test('a flat green crop and a black canvas are fills; a mottled crop is not', () => {
  assert.equal(flatGroundFill({ stdL: 1.2, bins: 3, black: 0 }), true);
  assert.equal(flatGroundFill({ stdL: 2, bins: 4, black: 0.98 }), true);
  assert.equal(flatGroundFill({ stdL: 18, bins: 40, black: 0 }), false);
  assert.equal(flatGroundFill({ stdL: 4, bins: 30, black: 0.2 }), false);
});

test('the 400 m boreal frame before the fix is one green fill', () => {
  const s = cropFill('tasks/evidence/T-0183/before-400.png');
  assert.equal(flatGroundFill(s), true, JSON.stringify(s));
  assert.ok(s.mean[1] > s.mean[0] && s.mean[1] > s.mean[2], `green fill ${s.mean}`);
});

test('the 400 m boreal frame after the fix is not one fill', () => {
  const s = cropFill('tasks/evidence/T-0183/after-400.png');
  assert.equal(flatGroundFill(s), false, JSON.stringify(s));
});
