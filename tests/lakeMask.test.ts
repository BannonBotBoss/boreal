import { test } from 'node:test';
import assert from 'node:assert/strict';
import { surfaceAt } from '../src/core/stages/surfaceAt';
import { LAKE_MASK, lakeField } from '../src/world/globe/lakeMask';

// the globe's home shoreline mask (lakeMask.ts) must put water exactly where the game has it (core/stages surfaceAt)
test('lakeMask: field sign matches surfaceAt water (lakes, rivers, base water)', () => {
  const seed = 1400; let bad = 0, wet = 0; const N = 20000;
  for (let k = 0; k < N; k++) { const x = ((k * 7919) % 7680) + .37, z = ((k * 104729) % 7680) + .61, s = surfaceAt(x, z, seed), w = !!(s.lake || s.river); if (w) wet++; if (w !== lakeField(x, z, true, seed) < 0) bad++; }
  assert.ok(wet > N * .1, `some water sampled (${wet})`);
  assert.ok(bad < N * .002, `sign mismatches ${bad} / ${N} (only core/surface micro detail, +-7 cm, may flip a point)`);
});
test('lakeMask: one stage-grid period, so the texture repeats seamlessly', () => {
  assert.equal(LAKE_MASK.size, 7680);
  for (const [x, z] of [[10, 20], [3000, -1500], [-3800, 3700]]) assert.ok(Math.abs(lakeField(x, z, true, 1400) - lakeField(x + LAKE_MASK.size, z - LAKE_MASK.size, true, 1400)) < 1e-6);
});
