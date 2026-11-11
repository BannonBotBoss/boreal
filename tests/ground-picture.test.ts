/**
 * Picture check for the continuous ground (T-0203).
 * The ground window is the middle of the frame, under the sky and above the HUD.
 * A tan pixel is the flat brown plane: R > G > B, R − B > 25, R in (90, 190).
 * Calibration on the same pose, SwiftShader, 1280×720:
 *   before eye 40: tan share 0.209 (the plane around the plates) — fails
 *   after eye 40:  tan share 0.001 — passes
 *   before standing: 0.297 — fails
 *   after standing:  0 — passes
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';

export function tanShare(file: string) {
  const png = PNG.sync.read(readFileSync(file));
  const { width, height, data } = png;
  const y0 = Math.floor(height * 0.48), y1 = Math.floor(height * 0.70);
  const x0 = Math.floor(width * 0.28), x1 = Math.floor(width * 0.78);
  let n = 0, tan = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = (y * width + x) * 4;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    n++;
    if (r > g && g > b && r - b > 25 && r > 90 && r < 190) tan++;
  }
  return tan / n;
}

const DIR = 'tasks/evidence/T-0203';

test('the flat brown plane scores high on the before frames and is gone after', () => {
  const beforeEye = tanShare(`${DIR}/before-eye40.png`);
  const afterEye = tanShare(`${DIR}/after-eye40.png`);
  const beforeStand = tanShare(`${DIR}/before-stand.png`);
  const afterStand = tanShare(`${DIR}/after-stand.png`);
  assert.ok(beforeEye > 0.15, `before eye 40 tan ${beforeEye} (known mismatch)`);
  assert.ok(beforeStand > 0.15, `before standing tan ${beforeStand} (known mismatch)`);
  assert.ok(afterEye < 0.04, `after eye 40 tan ${afterEye}`);
  assert.ok(afterStand < 0.04, `after standing tan ${afterStand}`);
});
