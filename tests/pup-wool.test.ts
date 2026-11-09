/** A four-week pup reads as wool, not a smooth tan tube. */
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

const tan = (rgb: Uint8Array, i: number) => {
  const R = rgb[i], G = rgb[i + 1], B = rgb[i + 2];
  return R > 90 && R < 200 && G > 50 && G < 170 && R > G + 6 && G > B + 4 && B < 130;
};

/**
 * Share of the lower-frame tan pixels darker than luma 90.
 * The smooth pale pups sit near 0.09. The woolly darker coat sits near 0.32.
 */
export function pupDark(file: string) {
  const { w, h, rgb } = readPng(file);
  let n = 0, dark = 0;
  for (let y = Math.floor(h * 0.55); y < h - 1; y += 2) for (let x = 2; x < w - 2; x += 2) {
    const i = (y * w + x) * 3;
    if (!tan(rgb, i)) continue;
    n++;
    const L = 0.2126 * rgb[i] + 0.7152 * rgb[i + 1] + 0.0722 * rgb[i + 2];
    if (L < 90) dark++;
  }
  return { n, darkFrac: n ? +(dark / n).toFixed(3) : 0 };
}

export function smoothPup(s: { n: number; darkFrac: number }) {
  return s.n > 400 && s.darkFrac < 0.15;
}

test('the pup coat is wool cards and body bands, not 720 smooth cards', () => {
  const wolf = readFileSync('src/render/playerWolf.ts', 'utf8');
  const coat = readFileSync('src/render/coatFinish.ts', 'utf8');
  assert.ok(wolf.includes('? 480 : 4200'));
  assert.ok(!wolf.includes('? 220 : 720'));
  assert.ok(coat.includes('furBand'));
  assert.ok(coat.includes('vPupLocal'));
});

test('the litter before the wool is a pale smooth tan', () => {
  const s = pupDark('tasks/evidence/T-0186/before-pups.png');
  assert.equal(smoothPup(s), true, JSON.stringify(s));
});

test('the litter after the wool is not a pale smooth tan', () => {
  const s = pupDark('tasks/evidence/T-0186/after-pups.png');
  assert.equal(smoothPup(s), false, JSON.stringify(s));
  assert.ok(s.darkFrac > 0.25 && s.n > 400, JSON.stringify(s));
});
