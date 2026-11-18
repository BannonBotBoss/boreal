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
import { peachFill, retiredPeachFill } from '../src/world/globe/atmosphere';
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
  const fn = src.slice(src.indexOf('vec3 atmWarmSun'), src.indexOf('vec3 atmWarmSun') + 400);
  assert.ok(fn.includes('return sunT'), fn);
  assert.equal(src.includes('TERMINATOR.gain'), false);
  assert.equal(src.includes('whiteAt: .52'), false);
});
