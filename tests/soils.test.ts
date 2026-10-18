import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ELEV, elevationGrid, flowGrid, lakeGrid, lakeAt, toWorld, sampleGrid } from '../src/core/stages/elevation';
import { riverGrid } from '../src/core/stages/rivers';
import { SOIL, SOIL_KINDS, soilGrid, soilAt } from '../src/core/stages/soils';

test('stage 1 relief is real metres: land p99 = ELEV.reliefM above base water, base water at the water plane', () => {
  const g = elevationGrid(7), z = Array.from(g.h, v => toWorld(g, v)).sort((a, b) => a - b);
  assert.ok(Math.abs(z[Math.floor(z.length * .99)] - toWorld(g, g.pw) - ELEV.reliefM) < .5, 'p99 above base water');
  assert.ok(Math.abs(z[Math.floor(z.length * ELEV.waterPct)] - toWorld(g, g.pw)) < 1e-3);
});
test('stage 1 grain: gradients are oriented NE-SW (structure tensor) but not axis-aligned (lattice hash decorrelated)', () => {
  const g = elevationGrid(7), n = g.n; let xx = 0, zz = 0, xz = 0;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const c = j * n + i, gx = g.h[j * n + (i + 1) % n] - g.h[c], gz = g.h[((j + 1) % n) * n + i] - g.h[c]; xx += gx * gx; zz += gz * gz; xz += gx * gz; }
  const ang = .5 * Math.atan2(2 * xz, xx - zz) * 180 / Math.PI, coh = Math.hypot(xx - zz, 2 * xz) / (xx + zz);
  assert.ok(ang > 20 && ang < 70, `gradient direction ${ang.toFixed(1)} deg (x east, z south): ridges strike NE`);
  assert.ok(coh > .1 && coh < .6, `coherence ${coh.toFixed(2)}`);
});
test('lakeAt uses grid nodes (no half-cell offset) and the shoreline contour', () => {
  const L = lakeGrid(7), g = elevationGrid(7), n = g.n; let checked = 0;
  for (let c = 0; c < L.id.length && checked < 200; c += 3) { if (L.id[c] < 0) continue; const x = (c % n) * g.cell, z = ((c / n) | 0) * g.cell, lk = lakeAt(7, x, z);
    if (toWorld(g, sampleGrid(g, x, z)) < L.bodies[L.id[c]].level) { assert.ok(lk, 'a wet lake node is lake'); assert.equal(lk!.body, L.id[c]); checked++; } }
  assert.ok(checked > 10);
});
test('soils: HAND is 0 on drainage and never negative; classes follow Gharari thresholds; bedrock share calibrated', () => {
  const S = soilGrid(7), f = flowGrid(7), R = riverGrid(7), L = lakeGrid(7);
  for (let c = 0; c < S.hand.length; c++) {
    assert.ok(S.hand[c] >= 0); if (f.outlet[c] || L.id[c] >= 0 || R.channel[c]) assert.equal(S.dist[c], 0);
    const k = SOIL_KINDS[S.kind[c]];
    if (k === 'water') continue;
    if (S.slope[c] > SOIL.slope && S.hand[c] > SOIL.hand) assert.equal(k, 'bedrock', 'hillslope = bedrock');
    if (k === 'peat' || k === 'clay') assert.ok(S.slope[c] <= SOIL.slope && S.hand[c] <= SOIL.hand, 'organic/clay only on flat wetland');
  }
  assert.ok(Math.abs(S.frac.bedrock - SOIL.bedrockFrac) < .01, `bedrock ${S.frac.bedrock}`);
  for (const k of ['till', 'peat', 'clay', 'sand'] as const) assert.ok(S.frac[k] > 0, `${k} present`);
  assert.ok(Math.abs(Object.values(S.frac).reduce((a, b) => a + b, 0) - 1) < 1e-6);
});
test('soilAt is deterministic and wetness orders bedrock < till < peat', () => {
  const S = soilGrid(7), n = S.n, by: Record<string, number[]> = {};
  for (let c = 0; c < S.kind.length; c += 11) { const s = soilAt(7, (c % n) * S.cell, ((c / n) | 0) * S.cell); (by[s.kind] ??= []).push(s.wet); assert.deepEqual(s, soilAt(7, (c % n) * S.cell, ((c / n) | 0) * S.cell)); }
  const m = (k: string) => by[k].reduce((a, b) => a + b, 0) / by[k].length;
  assert.ok(m('bedrock') < m('till') && m('till') < m('peat'));
});
