/**
 * Picture check for the horizon (T-0204).
 * Zenith window: y 0.08–0.16, x 0.42–0.58. Blue cast is mean(B − R).
 * Cutout window: y 0.36–0.50, x 0.22–0.72. A cutout pixel is B > R+12, B > G+4, B > 150.
 * A white pixel is R, G and B all above 210.
 *
 * Calibration, same URL, SwiftShader 1280×720:
 *   tasks/evidence/T-0212/before-eye40.png (the plates frame): cutout 0.307, white 0.687
 *   tasks/evidence/T-0204/before-eye40.png (continuous ground, no aerial fade): zenith blue cast 13.9
 *   after eye 40: blue cast 38.6, cutout 0, white 0.16
 *   after standing: blue cast 54.9, cutout 0, white 0.003
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';

function read(file: string) {
  return PNG.sync.read(readFileSync(file));
}

export function zenithBlueCast(file: string) {
  const { width, height, data } = read(file);
  let n = 0, cast = 0;
  const y0 = Math.floor(height * 0.08), y1 = Math.floor(height * 0.16);
  const x0 = Math.floor(width * 0.42), x1 = Math.floor(width * 0.58);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = (y * width + x) * 4;
    cast += data[i + 2] - data[i];
    n++;
  }
  return cast / n;
}

export function horizonCutout(file: string) {
  const { width, height, data } = read(file);
  const y0 = Math.floor(height * 0.36), y1 = Math.floor(height * 0.50);
  const x0 = Math.floor(width * 0.22), x1 = Math.floor(width * 0.72);
  let n = 0, blue = 0, white = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = (y * width + x) * 4;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    n++;
    if (b > r + 12 && b > g + 4 && b > 150) blue++;
    if (r > 210 && g > 210 && b > 210) white++;
  }
  return { blue: blue / n, white: white / n };
}

test('the blue cutout and the washed zenith fail the old frames and pass the new ones', () => {
  const plates = horizonCutout('tasks/evidence/T-0212/before-eye40.png');
  assert.ok(plates.blue > 0.2, `known cutout blue ${plates.blue}`);
  assert.ok(plates.white > 0.4, `known white band ${plates.white}`);
  const washed = zenithBlueCast('tasks/evidence/T-0204/before-eye40.png');
  assert.ok(washed < 25, `known washed zenith cast ${washed}`);
  for (const name of ['after-eye40.png', 'after-stand.png']) {
    const cast = zenithBlueCast(`tasks/evidence/T-0204/${name}`);
    const band = horizonCutout(`tasks/evidence/T-0204/${name}`);
    assert.ok(cast > 30, `${name} zenith cast ${cast}`);
    assert.ok(band.blue < 0.05, `${name} cutout ${band.blue}`);
    assert.ok(band.white < 0.35, `${name} white ${band.white}`);
  }
});
