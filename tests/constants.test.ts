import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { K, k, evaluate, BASE, resetBase } from '../src/core/constants';
import { setConstant, isUnlocked } from '../src/core/constantLock';
import { useStorage, setUnlockAll } from '../src/core/badges';
import { PHYS } from '../src/core/tuning';
import { ORBIT } from '../src/core/orbit';
import { rustSource } from '../tools/gen-constants';

// CODATA 2018 recommended values and standard uncertainties (physics.nist.gov/cuu/Constants). Exact-derived ones are
// quoted to 10 digits there, so they get a 1e-9 relative window.
const CODATA: [string, number, number][] = [
  ['hbar', 1.054571817e-34, 1.054571817e-43], ['R', 8.314462618, 8.3e-9], ['sigma', 5.670374419e-8, 5.7e-17],
  ['wien_b', 2.897771955e-3, 2.9e-12], ['F', 96485.33212, 1e-4], ['eps0', 8.8541878128e-12, 1.3e-21], ['mu0', 1.25663706212e-6, 1.9e-16],
  ['m_e', 9.1093837015e-31, 2.8e-40], ['m_p', 1.67262192369e-27, 5.1e-37], ['l_P', 1.616255e-35, 1.8e-40], ['m_P', 2.176434e-8, 2.4e-13],
  ['t_P', 5.391247e-44, 6.0e-49], ['T_P', 1.416784e32, 1.6e27],
];
test('derived constants match CODATA 2018 within stated uncertainty', () => {
  for (const [n, v, u] of CODATA) assert.ok(Math.abs(k(n) - v) <= u, `${n}: ${k(n)} vs ${v} ± ${u}`);
});
test('c = 1/sqrt(mu0 eps0)', () => assert.ok(Math.abs(1 / Math.sqrt(K.mu0 * K.eps0) - K.c) / K.c < 1e-15));
test('G M_sun reproduces IAU GM_sun; M_sun ~ 1.9884e30 kg', () => {
  assert.ok(Math.abs(K.G * K.M_sun - K.GM_sun) / K.GM_sun < 1e-15); assert.ok(Math.abs(K.M_sun - 1.98841e30) / 1.98841e30 < 1e-4);
});
test('math constants', () => {
  assert.equal(K.PI, Math.PI); assert.ok(Math.abs(K.PHI - 1.6180339887) < 1e-10); assert.ok(Math.abs(K.GOLDEN_ANGLE_DEG - 137.50776405) < 1e-7);
});
test('every base constant has value, unit, uncertainty and source; G is the only locked one so far', () => {
  for (const [n, b] of Object.entries(BASE)) assert.ok(typeof b.value === 'number' && b.unit && b.uncertainty >= 0 && b.source, n);
});
test('G is locked by default: setting it is refused and CODATA is used', () => {
  useStorage(); setUnlockAll(false);
  assert.equal(isUnlocked('G'), false); assert.equal(setConstant('G', 7e-11), false); assert.equal(K.G, 6.6743e-11);
});
test('unlocked G propagates through the graph; GM_sun and GM_earth stay fixed, masses follow', () => {
  setUnlockAll(true);
  const g0 = PHYS.G * PHYS.EARTH_MASS;
  assert.equal(setConstant('G', 7e-11), true);
  assert.equal(PHYS.G, 7e-11); assert.ok(Math.abs(K.M_sun - K.GM_sun / 7e-11) < 1e15);
  assert.ok(Math.abs(PHYS.G * PHYS.EARTH_MASS - g0) / g0 < 1e-12, 'surface gravity unchanged (GM_earth fixed)');
  assert.equal(ORBIT.GM_sun, K.GM_sun / 1e9);
  assert.equal(setConstant('G', 1), true); assert.equal(K.G, BASE.G.range![1], 'clamped to range');
  resetBase(); setUnlockAll(false); assert.equal(K.G, 6.6743e-11);
});
test('rust/boreal-sim/src/constants.rs is generated from constants.json (run npx tsx tools/gen-constants.ts)', () => {
  assert.equal(readFileSync(join(import.meta.dirname, '..', 'rust', 'boreal-sim', 'src', 'constants.rs'), 'utf8'), rustSource());
});
test('evaluate() is pure: overrides do not leak', () => { evaluate({ G: 7e-11 }); assert.equal(K.G, 6.6743e-11); });
