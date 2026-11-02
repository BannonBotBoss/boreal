import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { shFinite } from '../src/render/photoreal';

// T-0127: every landed frame had a black, unlit foreground. The GI light probe held NaN coefficients; intensity 0 does not
// help because 0 x NaN = NaN in the shader, so every lit material went black while the sky (unlit) stayed bright.
test('a GI readback with a NaN or Inf coefficient is rejected', () => {
  const sh = new THREE.SphericalHarmonics3(); assert.equal(shFinite(sh), true);
  sh.coefficients[4].set(.1, NaN, .2); assert.equal(shFinite(sh), false);
  sh.zero(); sh.coefficients[0].set(Infinity, 0, 0); assert.equal(shFinite(sh), false);
});
test('turning GI off zeroes the probe coefficients, not only its intensity', () => {
  const src = readFileSync(new URL('../src/render/photoreal.ts', import.meta.url), 'utf8');
  assert.match(src, /else \{ probe\.intensity = 0; probe\.sh\.zero\(\); \}/);
  assert.match(src, /if \(!shFinite\(p\.sh\)\) \{ probe\.sh\.zero\(\); probe\.intensity = 0; return; \}/);
});
