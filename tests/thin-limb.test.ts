/**
 * The orbit limb is a thin reddening plus the blue scatter, not a peach wash.
 *
 * The old fill was smoothstep(0.52, -0.04, mu). At mu 0.3 (sun still 73° up
 * from the horizon... N·L = 0.3 is solar zenith 73°) that curve was already
 * about 0.4, so the day side went peach. Apollo 17 AS17-148-22727 shows a
 * thin blue limb. The reddening that remains is the Rayleigh/ozone
 * transmittance (composition.ts; Hillaire 2020 Table 1 is the same Rayleigh
 * set the aerial shader cites).
 *
 * Calibration: retiredPeachFill(0.3) is the known mismatch (above 0.3).
 * peachFill is 0 everywhere, the known match for "do not paint the day side".
 * limbRedness at mu 0.5 stays near neutral; at mu 0.05 it is redder.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { peachFill, retiredPeachFill, TWILIGHT } from '../src/world/globe/atmosphere';
import { COMPOSITION, ozoneEquivPerKm, rayleighPerKm, scaleHeightKm } from '../src/world/globe/composition';

/** Kasten & Young 1989 relative airmass, then Rayleigh + ozone transmittance. */
export function limbRedness(mu: number) {
  const H = scaleHeightKm();
  const betaR = COMPOSITION.wavelengthsNm.map(rayleighPerKm);
  const betaO = ozoneEquivPerKm();
  const sza = Math.acos(Math.max(-1, Math.min(1, mu))) * 180 / Math.PI;
  const m = 1 / (Math.max(mu, 0) + 0.50572 * (96.07995 - sza) ** -1.6364);
  const T = betaR.map((b, i) => Math.exp(-Math.min(40, (b + betaO[i]) * H * m)));
  return { m, rb: T[0] / Math.max(1e-6, T[2]) };
}

test('the day side is not painted peach, and the old curve was', () => {
  assert.ok(retiredPeachFill(0.3) > 0.3, 'the retired band was already warm on the day side');
  assert.equal(peachFill(0.3), 0);
  assert.equal(peachFill(0.8), 0);
  assert.equal(peachFill(0), 0);
});

test('Rayleigh plus ozone reddens only near the limb', () => {
  const day = limbRedness(0.5);
  const limb = limbRedness(0.05);
  assert.ok(day.rb < 1.8, `day side red/blue ${day.rb.toFixed(2)} (airmass ${day.m.toFixed(2)})`);
  assert.ok(limb.rb > day.rb * 2, `limb red/blue ${limb.rb.toFixed(2)} should be much redder than ${day.rb.toFixed(2)}`);
});

test('the shader returns the physical sunlight and does not mix an orange gain', () => {
  const src = readFileSync('src/world/globe/atmosphere.ts', 'utf8');
  const fn = src.slice(src.indexOf('vec3 atmWarmSun'), src.indexOf('float atmSkyF'));
  assert.ok(fn.includes('mix(vec3(1.0), sunT, band)'), fn);
  assert.ok(fn.includes('TWILIGHT.innerDeg') && fn.includes('TWILIGHT.outerDeg'), fn);
  assert.equal(TWILIGHT.innerDeg, 6);
  assert.equal(TWILIGHT.outerDeg, 8);
  assert.equal(src.includes('TERMINATOR.gain'), false);
  assert.equal(src.includes('whiteAt: .52'), false);
});

/** Lit-disc pixels whose hue is the salmon band (10–40°) and whose saturation is above 0.25. */
export function salmonFrac(file: string) {
  const { width: W, height: H, data } = PNG.sync.read(readFileSync(file));
  const sum = (x: number, y: number) => { const i = (y * W + x) * 4; return data[i] + data[i + 1] + data[i + 2]; };
  let sx = 0, sy = 0, n = 0;
  const yMax = Math.min(H - 20, 640), xMax = Math.min(W - 20, 1100);
  for (let y = 20; y < yMax; y++) for (let x = 20; x < xMax; x++) if (sum(x, y) > 40) { sx += x; sy += y; n++; }
  const cx = sx / n, cy = sy / n;
  const rads: number[] = [];
  for (let y = 20; y < yMax; y += 2) for (let x = 20; x < xMax; x += 2) if (sum(x, y) > 40) rads.push(Math.hypot(x - cx, y - cy));
  rads.sort((a, b) => a - b);
  const rad = rads[Math.floor(rads.length * 0.995)];
  let lit = 0, warm = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (Math.hypot(x - cx, y - cy) > rad * 0.92) continue;
    const i = (y * W + x) * 4;
    const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255;
    if ((r + g + b) / 3 < 0.12) continue;
    lit++;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    const sat = mx < 1e-4 ? 0 : d / mx;
    let h = 0;
    if (d > 1e-4) {
      if (mx === r) h = ((g - b) / d) % 6;
      else if (mx === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60; if (h < 0) h += 360;
    }
    if (h >= 10 && h <= 40 && sat > 0.25) warm++;
  }
  return warm / lit;
}

test('the before frame is a wide salmon band and the after frame is under 3%', () => {
  const before = salmonFrac('tasks/evidence/T-0255/before-home.png');
  const after = salmonFrac('tasks/evidence/T-0255/after-home.png');
  assert.ok(before > 0.03, `before salmon ${before}`);
  assert.ok(after < 0.03, `after salmon ${after}`);
});
