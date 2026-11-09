/** A boreal drone frame has crown clumps, not one smooth green. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { crownCover, CROWN_CELL_M } from '../src/world/globe/landMosaic';

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

/** Centre crop. hf is the mean luma step across 4 px, the crown scale on a 400 m frame. */
export function crownRead(file: string) {
  const { w, h, rgb } = readPng(file);
  const x0 = Math.floor(w * 0.2), x1 = Math.floor(w * 0.8);
  const y0 = Math.floor(h * 0.2), y1 = Math.floor(h * 0.75);
  let n = 0, hf = 0, hfN = 0;
  for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) {
    const i = (y * w + x) * 3;
    n++;
    if (x + 4 < x1) {
      const i2 = (y * w + x + 4) * 3;
      const L = 0.2126 * rgb[i] + 0.7152 * rgb[i + 1] + 0.0722 * rgb[i + 2];
      const L2 = 0.2126 * rgb[i2] + 0.7152 * rgb[i2 + 1] + 0.0722 * rgb[i2 + 2];
      hf += Math.abs(L - L2); hfN++;
    }
  }
  return { hf: +(hf / hfN).toFixed(2), n };
}

/** The mottled 400 m frame is smooth at 4 px. A crown field is not. */
export function smoothCanopy(s: { hf: number }) {
  return s.hf < 0.8;
}

test('a 12 m crown field has centres and gaps', () => {
  assert.equal(CROWN_CELL_M, 12);
  const a = crownCover(0, 0);
  assert.equal(crownCover(0, 0), a);
  let gaps = 0, crowns = 0;
  for (let i = 0; i < 80; i++) {
    const c = crownCover(i * 7.5, i * 4.2);
    if (c === 0) gaps++;
    if (c > 0.55) crowns++;
  }
  assert.ok(gaps > 5, `gaps ${gaps}`);
  assert.ok(crowns > 5, `crowns ${crowns}`);
  const tile = readFileSync('src/world/globe/tile.ts', 'utf8');
  const skirt = readFileSync('src/render/horizonMesh.ts', 'utf8');
  // The globe tile no longer stamps a 12 m dot grid. That grid read as wallpaper at 400 m.
  assert.ok(!tile.includes('max(12.0, px * 3.5)'));
  assert.ok(skirt.includes('xz / 12.0'));
  assert.ok(skirt.includes('mix(0.62, 1.28, crown)'));
});

test('the 400 m frames before crown clumps are smooth', () => {
  for (const file of ['tasks/evidence/T-0185/before-globe-400.png', 'tasks/evidence/T-0185/before-drone-400.png']) {
    const s = crownRead(file);
    assert.equal(smoothCanopy(s), true, `${file} ${JSON.stringify(s)}`);
  }
});

test('the 400 m globe after crown clumps is not smooth', () => {
  const s = crownRead('tasks/evidence/T-0185/after-globe-400.png');
  assert.equal(smoothCanopy(s), false, JSON.stringify(s));
  assert.ok(s.hf > 1.5, JSON.stringify(s));
});
