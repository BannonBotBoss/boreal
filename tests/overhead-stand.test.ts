/** Overhead boreal is a stand field, not one olive quad. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { overheadStand } from '../src/world/globe/landMosaic';

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

/** Centre crop. std is luma spread, hf is the mean step across 6 px. */
export function overheadRead(file: string) {
  const { w, h, rgb } = readPng(file);
  const x0 = Math.floor(w * 0.2), x1 = Math.floor(w * 0.8);
  const y0 = Math.floor(h * 0.2), y1 = Math.floor(h * 0.75);
  let n = 0, s = 0, s2 = 0, hf = 0, hfN = 0;
  for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) {
    const i = (y * w + x) * 3;
    const L = 0.2126 * rgb[i] + 0.7152 * rgb[i + 1] + 0.0722 * rgb[i + 2];
    s += L; s2 += L * L; n++;
    if (x + 6 < x1) {
      const i2 = (y * w + x + 6) * 3;
      const L2 = 0.2126 * rgb[i2] + 0.7152 * rgb[i2 + 1] + 0.0722 * rgb[i2 + 2];
      hf += Math.abs(L - L2); hfN++;
    }
  }
  const mean = s / n;
  return {
    std: +Math.sqrt(Math.max(0, s2 / n - mean * mean)).toFixed(2),
    hf: +(hf / hfN).toFixed(2),
    mean: +mean.toFixed(1),
  };
}

/** The before globe is one soft dark fill. A stand field spreads both numbers. */
export function flatOverhead(s: { std: number; hf: number }) {
  return s.std < 3 && s.hf < 1.1;
}

/**
 * Centre-crop colour against a real August boreal frame.
 * Reference: EOX Sentinel-2 cloudless 2021, tile z8 / y84 / x59 (covers 52 N, 97 W),
 * CC BY 4.0, https://s2maps.eu — measured in this test from tasks/evidence/T-0187/ref-eox-z8.png.
 * That tile's mid land is about sRGB luma 40, red-dominant share 0. The broken overhead
 * (T-0184 after) is luma 19.7 with red patches and no blue water, and a luma-spread test
 * still passed it. Noise can raise `std`. It cannot land in this band.
 */
export function aerialStats(file: string) {
  const { w, h, rgb } = readPng(file);
  const x0 = Math.floor(w * 0.15), x1 = Math.floor(w * 0.85);
  const y0 = Math.floor(h * 0.12), y1 = Math.floor(h * 0.88);
  let n = 0, s = 0, red = 0, green = 0, blue = 0;
  for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) {
    const i = (y * w + x) * 3;
    const r = rgb[i], g = rgb[i + 1], b = rgb[i + 2];
    const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    s += L; n++;
    if (r > g + 8 && r > b + 8) red++;
    else if (b > r + 6 && b > g) blue++;
    else if (g >= r && g >= b) green++;
  }
  return {
    mean: +(s / n).toFixed(1),
    redPct: +(100 * red / n).toFixed(2),
    greenPct: +(100 * green / n).toFixed(1),
    bluePct: +(100 * blue / n).toFixed(2),
  };
}

/**
 * Readable August boreal land. The EOX tile's centre crop is luma about 39, red-dominant 0, green-dominant.
 * The broken overhead was luma 19.7 and 6% red, and a luma-spread test passed it.
 * Open water is the height field below its level (`aH`), and the aerial band no longer forces that to land.
 * `aLake` is "level > 0.5 m", which is most dry land, so it is not a water test.
 */
export function daylightBoreal(s: { mean: number; redPct: number; greenPct: number; bluePct: number }, floor = 34) {
  return s.mean >= floor && s.mean <= 110 && s.redPct < 2 && s.greenPct > 55;
}

test('the overhead stand is one colour at one point and not one colour across a few hundred metres', () => {
  const a = overheadStand(1000, 2000);
  assert.deepEqual(overheadStand(1000, 2000), a);
  let minG = Infinity, maxG = 0;
  for (let i = 0; i < 200; i++) {
    const g = overheadStand(i * 37.1, (i * 91.7) % 8000)[1];
    minG = Math.min(minG, g); maxG = Math.max(maxG, g);
  }
  // The authored leaf/fen greens are 0.140 / 0.076. A few hundred samples of the field reach most of that.
  assert.ok(maxG / minG > 1.5, `green ${minG.toFixed(3)}..${maxG.toFixed(3)}`);
  const tile = readFileSync('src/world/globe/tile.ts', 'utf8');
  assert.ok(tile.includes('shoreBand'), 'the lake edge wanders off the quad');
  assert.ok(tile.includes('OVERHEAD_STAND.fen'), 'fen albedo comes from the daylight table');
  assert.ok(tile.includes('OVERHEAD_STAND.conifer'), 'conifer albedo comes from the daylight table');
  assert.ok(tile.includes('uHideLake * (1.0 - aerial)'), 'an aerial lake is not forced to land');
  assert.ok(!tile.includes('vec3(0.020, 0.034, 0.016)'), 'the 2% conifer reflectance is gone');
  assert.ok(!tile.includes('vec3(0.090, 0.062, 0.028)'), 'the red fen reflectance is gone');
});

test('the 2000 m globe before the stand field is one soft fill', () => {
  const s = overheadRead('tasks/evidence/T-0184/before-globe-2000.png');
  assert.equal(flatOverhead(s), true, JSON.stringify(s));
});

test('the 2000 m globe after the stand field is not one fill', () => {
  const s = overheadRead('tasks/evidence/T-0184/after-globe-2000.png');
  assert.equal(flatOverhead(s), false, JSON.stringify(s));
  assert.ok(s.hf > 1.2 && s.std > 3.2, JSON.stringify(s));
});

test('the EOX reference of this region is mid-dark green, not red', () => {
  const s = aerialStats('tasks/evidence/T-0187/ref-eox-z8.png');
  // Measured once from that tile: mean luma about 40, red-dominant 0. The bounds are the tile, not a guess.
  assert.ok(s.mean >= 35 && s.mean <= 50, JSON.stringify(s));
  assert.ok(s.redPct < 1, JSON.stringify(s));
  assert.ok(s.greenPct > 80, JSON.stringify(s));
});

test('the 2000 m frame that only raised luma spread is still not daylight boreal', () => {
  const s = aerialStats('tasks/evidence/T-0184/after-globe-2000.png');
  assert.equal(daylightBoreal(s), false, JSON.stringify(s));
});

test('overhead boreal at 2000 m and 400 m is in the EOX daylight band and is not red', () => {
  const far = aerialStats('tasks/evidence/T-0187/after-globe-2000.png');
  const near = aerialStats('tasks/evidence/T-0187/after-globe-400.png');
  // 2000 m matches the EOX tile (luma about 39). 400 m is the same land a little darker, still far above the broken luma 19.7.
  assert.equal(daylightBoreal(far, 36), true, JSON.stringify(far));
  assert.equal(daylightBoreal(near, 32), true, JSON.stringify(near));
});
