/**
 * Picture check for overhead crowns (T-0214).
 * Centre window, median green channel.
 * The old frame is the tiled canopy: median green 89 at 400 m and 83 at 800 m.
 * The impostor frame is a smooth darker floor with crowns on it: median 35 and 37.
 * Known mismatch is a median above 70. Pass is a median under 55.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';

export function medianGreen(file: string) {
  const { width, height, data } = PNG.sync.read(readFileSync(file));
  const x0 = Math.floor(width * 0.15), x1 = Math.floor(width * 0.85);
  const y0 = Math.floor(height * 0.15), y1 = Math.floor(height * 0.85);
  const gs: number[] = [];
  for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) gs.push(data[(y * width + x) * 4 + 1]);
  gs.sort((a, b) => a - b);
  return gs[gs.length >> 1];
}

test('the tiled canopy is bright throughout and the impostor frame is a darker floor', () => {
  for (const alt of [400, 800]) {
    const before = medianGreen(`tasks/evidence/T-0214/before-${alt}.png`);
    const after = medianGreen(`tasks/evidence/T-0214/after-${alt}.png`);
    assert.ok(before > 70, `before ${alt} median green ${before}`);
    assert.ok(after < 55, `after ${alt} median green ${after}`);
  }
});
