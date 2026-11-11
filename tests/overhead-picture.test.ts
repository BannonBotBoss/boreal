/**
 * Picture check for the lit nadir crowns (T-0217).
 * The frame has to be a dark green stand with a few sunlit tips,
 * not a black field and not the saturated lime carpet (value mean about 0.53,
 * saturation mean about 0.70).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';

function hsv(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  return [mx === 0 ? 0 : d / mx, mx];
}

function stats(file: string) {
  const { width, height, data } = PNG.sync.read(readFileSync(file));
  const sat: number[] = [], val: number[] = [];
  let bright = 0, n = 0;
  const y0 = Math.floor(height * 0.08), y1 = Math.floor(height * 0.9);
  const x0 = Math.floor(width * 0.05), x1 = Math.floor(width * 0.95);
  for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) {
    const i = (y * width + x) * 4;
    const [s, v] = hsv(data[i], data[i + 1], data[i + 2]);
    sat.push(s); val.push(v); n++;
    if (v > 0.55 && data[i + 1] > data[i]) bright++;
  }
  const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
  return { s: mean(sat), v: mean(val), bright: bright / n };
}

test('the nadir stand is dark green with sunlit tips, not a lime carpet or a black field', () => {
  for (const alt of [400, 800]) {
    const g = stats(`tasks/evidence/T-0217/after-${alt}.png`);
    assert.ok(g.v > 0.18 && g.v < 0.4, `${alt} value mean ${g.v.toFixed(3)}`);
    assert.ok(g.s > 0.35 && g.s < 0.7, `${alt} saturation mean ${g.s.toFixed(3)}`);
    assert.ok(g.bright > 0.002 && g.bright < 0.12, `${alt} sunlit share ${g.bright.toFixed(3)}`);
  }
});
