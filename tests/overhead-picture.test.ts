/**
 * Picture check for overhead crowns (T-0205).
 * Centre window y 0.20–0.80, x 0.25–0.75. A crown pixel is luma under 45
 * and green at least as strong as red and blue (the dark disc, not a shadow
 * in the tile noise).
 * Calibration, SwiftShader 1280×720, nadir at 52 N, 97 W:
 *   before 400 m and 800 m: 0.027 and 0.023 (the tile noise)
 *   after: 0.206 and 0.206
 * Pass is above 0.12. The known mismatch is under 0.06.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';

export function crownShare(file: string) {
  const { width, height, data } = PNG.sync.read(readFileSync(file));
  const x0 = Math.floor(width * 0.25), x1 = Math.floor(width * 0.75);
  const y0 = Math.floor(height * 0.2), y1 = Math.floor(height * 0.8);
  let n = 0, dark = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = (y * width + x) * 4;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    n++;
    if (luma < 45 && g + 8 >= r && g + 8 >= b) dark++;
  }
  return dark / n;
}

test('overhead frames gain dark crown discs and the old noise does not', () => {
  for (const alt of [400, 800]) {
    const before = crownShare(`tasks/evidence/T-0205/before-${alt}.png`);
    const after = crownShare(`tasks/evidence/T-0205/after-${alt}.png`);
    assert.ok(before < 0.06, `before ${alt} ${before}`);
    assert.ok(after > 0.12, `after ${alt} ${after}`);
  }
});
