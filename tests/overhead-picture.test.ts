/**
 * Picture check for overhead crowns (T-0214).
 *
 * HSV of the frame against the NAIP canopy crop. The carpet of lime discs
 * (c86d3e68 after-400.png) measured saturation 0.70 against the reference
 * 0.285, and this tolerance rejects that frame.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';

const REF = 'tasks/evidence/T-0199/ref-naip-canopy.png';

function hsv(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d > 1e-6) {
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, mx === 0 ? 0 : d / mx, mx];
}

export function hsvStats(file: string) {
  const { width, height, data } = PNG.sync.read(readFileSync(file));
  const acc: number[][] = [[], [], []];
  const y0 = Math.floor(height * 0.08), y1 = Math.floor(height * 0.9);
  const x0 = Math.floor(width * 0.05), x1 = Math.floor(width * 0.95);
  for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) {
    const i = (y * width + x) * 4;
    const [h, s, v] = hsv(data[i], data[i + 1], data[i + 2]);
    acc[0].push(h); acc[1].push(s); acc[2].push(v);
  }
  const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
  const sd = (a: number[], m: number) => Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length);
  return [0, 1, 2].map(i => ({ mean: mean(acc[i]), sd: sd(acc[i], mean(acc[i])) }));
}

const TOL = {
  hMean: 10, hSd: 7,
  sMean: 0.07, sSd: 0.04,
  vMean: 0.06, vSd: 0.04,
};

test('the nadir frame matches the NAIP canopy in hue, saturation and value', () => {
  const ref = hsvStats(REF);
  for (const alt of [400, 800]) {
    const got = hsvStats(`tasks/evidence/T-0214/after-${alt}.png`);
    const names = ['H', 'S', 'V'];
    const tol = [
      [TOL.hMean, TOL.hSd],
      [TOL.sMean, TOL.sSd],
      [TOL.vMean, TOL.vSd],
    ];
    for (let i = 0; i < 3; i++) {
      const dm = Math.abs(got[i].mean - ref[i].mean);
      const ds = Math.abs(got[i].sd - ref[i].sd);
      assert.ok(dm <= tol[i][0], `${alt} ${names[i]} mean ${got[i].mean.toFixed(3)} vs ${ref[i].mean.toFixed(3)} (off ${dm.toFixed(3)})`);
      assert.ok(ds <= tol[i][1], `${alt} ${names[i]} sd ${got[i].sd.toFixed(3)} vs ${ref[i].sd.toFixed(3)} (off ${ds.toFixed(3)})`);
    }
  }
});
