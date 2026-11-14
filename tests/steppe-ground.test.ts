/**
 * Day 227 prairie ground against the Akmola steppe photograph.
 * The crop is the ground, not the sky. Mean HSV must sit within 15%.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';

const REF = 'tasks/evidence/T-0218/ref-ground.png';

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

/** Mean HSV. Fractions are the crop; omit them to use the whole picture. */
export function meanHsv(file: string, box = { x0: 0, y0: 0, x1: 1, y1: 1 }) {
  const { width, height, data } = PNG.sync.read(readFileSync(file));
  let n = 0, H = 0, S = 0, V = 0;
  const y0 = Math.floor(height * box.y0), y1 = Math.floor(height * box.y1);
  const x0 = Math.floor(width * box.x0), x1 = Math.floor(width * box.x1);
  for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) {
    const i = (y * width + x) * 4;
    const [h, s, v] = hsv(data[i], data[i + 1], data[i + 2]);
    H += h; S += s; V += v; n++;
  }
  return { h: H / n, s: S / n, v: V / n, n };
}

test('day 227 prairie ground is within 15% of the Akmola steppe', () => {
  const ref = meanHsv(REF);
  const frames = [
    ['tasks/evidence/T-0218/ground-eye1.7.png', { x0: 0.20, y0: 0.62, x1: 0.80, y1: 0.82 }],
    ['tasks/evidence/T-0218/ground-eye40.png', { x0: 0.28, y0: 0.55, x1: 0.90, y1: 0.80 }],
  ] as const;
  for (const [file, box] of frames) {
    const got = meanHsv(file, box);
    for (const k of ['h', 's', 'v'] as const) {
      const rel = Math.abs(got[k] - ref[k]) / Math.max(0.02, Math.abs(ref[k]));
      assert.ok(rel <= 0.15, `${file} ${k} ${got[k].toFixed(3)} vs ${ref[k].toFixed(3)} (${(rel * 100).toFixed(1)}%)`);
    }
  }
});
