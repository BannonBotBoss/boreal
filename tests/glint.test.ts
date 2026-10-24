import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fresnelF0, coxMunkSigma2, glintRoughness } from '../src/world/globe/tile';
test('sun glint: water Fresnel 0.020 (n 1.33), Cox-Munk slope variance, roughness from it', () => {
  assert.ok(Math.abs(fresnelF0() - 0.0201) < 1e-3);
  assert.ok(Math.abs(coxMunkSigma2(10) - 0.0542) < 1e-9);
  const r = glintRoughness(7); assert.ok(r > 0.4 && r < 0.48, `${r}`); assert.ok(glintRoughness(0) < glintRoughness(15));
});
