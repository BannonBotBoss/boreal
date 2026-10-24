// Twilight sky: hemisphere integral of the Schaefer sky model against tabulated horizontal illuminance (Bond & Henderson 1963 / USNO)
import test from 'node:test'; import assert from 'node:assert/strict';
import { twilightIlluminance } from '../src/core/skyVisibility';
test('twilight illuminance: 3.4 lx at civil, ~0.008 lx at nautical, few hundred lx at sunset; falls monotonically', () => {
  const e6 = twilightIlluminance(-6), e12 = twilightIlluminance(-12), e0 = twilightIlluminance(0);
  assert.ok(Math.abs(Math.log10(e6 / 3.4)) < .05, `civil ${e6}`); assert.ok(Math.abs(Math.log10(e12 / .008)) < .4, `nautical ${e12}`);
  assert.ok(e0 > 300 && e0 < 1500, `sunset ${e0}`); let p = Infinity; for (let h = 0; h >= -18; h--) { const e = twilightIlluminance(h); assert.ok(e < p); p = e; }
});
