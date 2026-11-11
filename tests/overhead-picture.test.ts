/**
 * Canopy check for T-0217.
 * A green-canopy pixel has green at least as high as red and blue, green above 40,
 * and no channel at 220 or more. The reference is the lake-free crop of the Esri
 * stand at 52.05 N, 96.94 W. Coverage must be within 10 points. Mean RGB and HSV
 * of those pixels must be within 15%. The standard deviations are reported; several
 * are still outside 15%, so this test does not treat them as a pass.
 * No 8×8 block in a frame may have a mean luminance below the reference's
 * 1st percentile. That is the pure-black floor defect.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';

const REF = 'tasks/evidence/T-0217/ref-stand-forest.png';

function canopy(r: number, g: number, b: number) {
  return g >= r && g >= b && g > 40 && Math.max(r, g, b) < 220;
}

function hsv(r: number, g: number, b: number) {
  const R = r / 255, G = g / 255, B = b / 255;
  const mx = Math.max(R, G, B), mn = Math.min(R, G, B), d = mx - mn;
  let h = 0;
  if (d > 1e-6) {
    if (mx === R) h = ((G - B) / d) % 6;
    else if (mx === G) h = (B - R) / d + 2;
    else h = (R - G) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, mx === 0 ? 0 : d / mx, mx];
}

export function canopyStats(file: string) {
  const { width, height, data } = PNG.sync.read(readFileSync(file));
  let n = 0, c = 0;
  const ch: Record<string, number[]> = { r: [], g: [], b: [], h: [], s: [], v: [] };
  for (let y = 4; y < height - 40; y++) for (let x = 4; x < width - 4; x++) {
    const i = (y * width + x) * 4;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    n++;
    if (!canopy(r, g, b)) continue;
    c++;
    const [h, s, v] = hsv(r, g, b);
    ch.r.push(r); ch.g.push(g); ch.b.push(b); ch.h.push(h); ch.s.push(s); ch.v.push(v);
  }
  const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
  const sd = (a: number[], m: number) => Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length);
  const pack = (a: number[]) => ({ mean: mean(a), sd: sd(a, mean(a)) });
  return { coverage: c / n, r: pack(ch.r), g: pack(ch.g), b: pack(ch.b), h: pack(ch.h), s: pack(ch.s), v: pack(ch.v) };
}

function luminance(r: number, g: number, b: number) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** 1st percentile of per-pixel luminance, same crop as the canopy stats. */
export function luminancePercentile(file: string, p: number) {
  const { width, height, data } = PNG.sync.read(readFileSync(file));
  const ls: number[] = [];
  for (let y = 4; y < height - 40; y++) for (let x = 4; x < width - 4; x++) {
    const i = (y * width + x) * 4;
    ls.push(luminance(data[i], data[i + 1], data[i + 2]));
  }
  ls.sort((a, b) => a - b);
  return ls[Math.min(ls.length - 1, Math.floor(ls.length * p))];
}

/** Darkest mean luminance of non-overlapping 8×8 blocks in that crop. */
export function darkestBlock(file: string, block = 8) {
  const { width, height, data } = PNG.sync.read(readFileSync(file));
  let min = Infinity;
  const y1 = height - 40, x1 = width - 4;
  for (let y = 4; y + block <= y1; y += block) for (let x = 4; x + block <= x1; x += block) {
    let s = 0;
    for (let dy = 0; dy < block; dy++) for (let dx = 0; dx < block; dx++) {
      const i = ((y + dy) * width + (x + dx)) * 4;
      s += luminance(data[i], data[i + 1], data[i + 2]);
    }
    const m = s / (block * block);
    if (m < min) min = m;
  }
  return min;
}

test('canopy coverage is within 10 points of the stand photo and the means are within 15%', () => {
  const ref = canopyStats(REF);
  for (const alt of [400, 800]) {
    const got = canopyStats(`tasks/evidence/T-0217/after-${alt}.png`);
    assert.ok(Math.abs(got.coverage - ref.coverage) <= 0.10, `${alt} coverage ${got.coverage.toFixed(3)} vs ${ref.coverage.toFixed(3)}`);
    for (const k of ['r', 'g', 'b', 'h', 's', 'v'] as const) {
      const rel = Math.abs(got[k].mean - ref[k].mean) / Math.max(0.02, Math.abs(ref[k].mean));
      assert.ok(rel <= 0.15, `${alt} ${k} mean ${got[k].mean.toFixed(2)} vs ${ref[k].mean.toFixed(2)}`);
    }
  }
});

test('no 8x8 block is darker than the reference 1st percentile luminance', () => {
  const floor = luminancePercentile(REF, 0.01);
  assert.ok(floor > 8, `reference p01 ${floor.toFixed(2)} is itself a black floor`);
  for (const alt of [400, 800]) {
    const min = darkestBlock(`tasks/evidence/T-0217/after-${alt}.png`);
    assert.ok(min >= floor, `${alt} m darkest 8x8 is ${min.toFixed(2)}, reference p01 is ${floor.toFixed(2)}`);
  }
});
