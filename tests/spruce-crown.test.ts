/** Spruce crowns are uneven whorls, not a plantation of identical cones. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { crownStartM } from '../src/render/trees/game';
import { spireSpread } from '../src/render/trees';

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

/**
 * Green above the horizon. A stacked cone is a few big flat triangles: a pixel
 * and the pixel four steps away are the same green. Overlapping uneven whorls
 * break that flat.
 */
export function crownFacets(file: string) {
  const { w, h, rgb } = readPng(file);
  const luma = (x: number, y: number) => {
    const i = (y * w + x) * 3;
    return 0.2126 * rgb[i] + 0.7152 * rgb[i + 1] + 0.0722 * rgb[i + 2];
  };
  const green = (x: number, y: number) => {
    const i = (y * w + x) * 3;
    const R = rgb[i], G = rgb[i + 1], B = rgb[i + 2];
    return y < h * 0.55 && G > 40 && G > R + 12 && G > B + 8;
  };
  let n = 0, flat = 0;
  for (let y = 8; y < h * 0.55; y += 2) for (let x = 8; x < w - 8; x += 2) {
    if (!green(x, y) || !green(x + 4, y) || !green(x, y + 4)) continue;
    n++;
    const d = Math.abs(luma(x, y) - luma(x + 4, y)) + Math.abs(luma(x, y) - luma(x, y + 4));
    if (d < 6) flat++;
  }
  return { n, flat: n ? flat / n : 0 };
}

/** A person calls it a plantation of cones when the green is large flat facets. */
export function plantation(s: { n: number; flat: number }) {
  return s.n > 2000 && s.flat > 0.2;
}

test('a spruce whorl is uneven, and neighbours are not one size', () => {
  for (const id of ['black-spruce', 'white-spruce', 'balsam-fir']) {
    for (let v = 0; v < 4; v++) {
      const s = spireSpread(id, v);
      assert.ok(s.ratio > 1.25, `${id} v${v} outer ratio ${s.ratio.toFixed(2)} is a cone`);
    }
  }
  const widths = [0, 1, 2, 3].map(v => spireSpread('white-spruce', v).width);
  const span = Math.max(...widths) - Math.min(...widths);
  assert.ok(span > 0.6, `white spruce widths span ${span.toFixed(2)} m`);
  assert.equal(crownStartM(0.5), 70);
  assert.equal(crownStartM(1), 70);
});

test('the 40 m frame is a plantation of flat cones, and the fix is not', () => {
  const before = crownFacets('tasks/evidence/T-0192/before-40.png');
  assert.equal(plantation(before), true, `before flat ${before.flat.toFixed(3)} n ${before.n}`);
  const after = crownFacets('tasks/evidence/T-0192/after-ground.png');
  assert.equal(plantation(after), false, `after flat ${after.flat.toFixed(3)} n ${after.n}`);
  assert.ok(after.flat < 0.14, `after still flat ${after.flat.toFixed(3)}`);
});
