import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ELEV, elevationGrid, flowGrid, lakeGrid, lakeAt, toWorld, sampleGrid } from '../src/core/stages/elevation';
import { riverGrid } from '../src/core/stages/rivers';
import { SOIL, SOIL_KINDS, soilGrid, soilAt } from '../src/core/stages/soils';

test('stage 1 relief is real metres: land p99 = ELEV.reliefM above base water, base water at the water plane', () => {
  const g = elevationGrid(7), z = Array.from(g.h, v => toWorld(g, v)).sort((a, b) => a - b);
  assert.ok(Math.abs(z[Math.floor(z.length * .99)] - toWorld(g, g.pw) - ELEV.reliefM) < .5, 'p99 above base water');
  const below = z.filter(v => v < toWorld(g, g.pw)).length / z.length; // ELEV.waterPct of the nodes, plus the sieved islets
  assert.ok(below >= ELEV.waterPct - 1e-4 && below < ELEV.waterPct + .002, `share below base water ${below}`);
});
test('stage 1 grain: gradients are oriented NE-SW (structure tensor) but not axis-aligned (lattice hash decorrelated)', () => {
  const g = elevationGrid(7), n = g.n; let xx = 0, zz = 0, xz = 0;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const c = j * n + i, gx = g.h[j * n + (i + 1) % n] - g.h[c], gz = g.h[((j + 1) % n) * n + i] - g.h[c]; xx += gx * gx; zz += gz * gz; xz += gx * gz; }
  const ang = .5 * Math.atan2(2 * xz, xx - zz) * 180 / Math.PI, coh = Math.hypot(xx - zz, 2 * xz) / (xx + zz);
  assert.ok(ang > 20 && ang < 70, `gradient direction ${ang.toFixed(1)} deg (x east, z south): ridges strike NE`);
  assert.ok(coh > .1 && coh < .6, `coherence ${coh.toFixed(2)}`);
});
test('lakeAt uses grid nodes (no half-cell offset) and the shoreline contour', () => {
  const L = lakeGrid(1400), g = elevationGrid(1400), n = g.n; let checked = 0;
  for (let c = 0; c < L.id.length && checked < 200; c++) { if (L.id[c] < 0) continue; const x = (c % n) * g.cell, z = ((c / n) | 0) * g.cell, lk = lakeAt(1400, x, z);
    if (toWorld(g, sampleGrid(g, x, z)) < L.bodies[L.id[c]].level) { assert.ok(lk, 'a wet lake node is lake'); assert.equal(lk!.body, L.id[c]); checked++; } }
  assert.ok(checked > 10);
});
test('soils: HAND is 0 on drainage and never negative; classes follow Gharari thresholds; bedrock share calibrated', () => {
  const S = soilGrid(7), f = flowGrid(7), R = riverGrid(7), L = lakeGrid(7);
  for (let c = 0; c < S.hand.length; c++) {
    assert.ok(S.hand[c] >= 0); if (f.outlet[c] || L.id[c] >= 0 || R.channel[c]) assert.equal(S.dist[c], 0);
    const k = SOIL_KINDS[S.kind[c]];
    if (k === 'water') continue;
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
function waterBodies(seed: number) { // >= 1 ha water bodies (open water + perched lakes), 4-connected with wrap-around
  const L = lakeGrid(seed), f = flowGrid(seed), g = elevationGrid(seed), n = g.n, wet = (c: number) => !!f.outlet[c] || L.id[c] >= 0, lab = new Int32Array(n * n).fill(-1), ha: number[] = [];
  for (let c = 0; c < n * n; c++) if (wet(c) && lab[c] < 0) { const st = [c]; lab[c] = c; let k = 0; while (st.length) { const q = st.pop()!, x = q % n, y = (q / n) | 0; k++;
    for (const m of [y * n + (x + 1) % n, y * n + (x + n - 1) % n, ((y + 1) % n) * n + x, ((y + n - 1) % n) * n + x]) if (wet(m) && lab[m] < 0) { lab[m] = c; st.push(m); } } if (k * g.cell * g.cell / 1e4 >= 1) ha.push(k * g.cell * g.cell / 1e4); }
  return { ha, km2: n * n * g.cell * g.cell / 1e6, L, n };
}
test('stage 1-2b: Kenora-like water bodies over seeds 1400/7/99: ~12-30 per 100 km2 (Kenora 17.6), pooled median < 12 ha (7.2), perched lakes, islands', () => {
  const ha: number[] = [];
  for (const seed of [1400, 7, 99]) { const w = waterBodies(seed), per100 = w.ha.length / w.km2 * 100; ha.push(...w.ha);
    assert.ok(per100 >= 12 && per100 <= 30, `seed ${seed}: ${per100.toFixed(0)} per 100 km2`); }
  ha.sort((a, b) => a - b); assert.ok(ha[ha.length >> 1] < 12, `pooled median ${ha[ha.length >> 1]} ha`);
  const { L, n } = waterBodies(1400);
  assert.ok(L.bodies.filter(b => b.areaHa >= 1).length >= 2, 'perched lakes above base water');
  const land = new Int32Array(n * n).fill(-1); let comps = 0; // land components: > 1 means islands
  for (let c = 0; c < n * n; c++) if (L.id[c] < 0 && land[c] < 0) { const st = [c]; land[c] = comps; while (st.length) { const q = st.pop()!, x = q % n, y = (q / n) | 0;
    for (const m of [y * n + (x + 1) % n, y * n + (x + n - 1) % n, ((y + 1) % n) * n + x, ((y + n - 1) % n) * n + x]) if (L.id[m] < 0 && land[m] < 0) { land[m] = comps; st.push(m); } } comps++; }
  assert.ok(comps > 1, `${comps - 1} islands in perched lakes`);
});
test('islet sieve: no single-node islet left in open water (minimum mapping unit, ELEV.isletMax)', () => {
  const g = elevationGrid(1400), n = g.n; let left = 0;
  for (let c = 0; c < n * n; c++) { if (g.h[c] < g.pw) continue; const x = c % n, y = (c / n) | 0; let land = false;
    for (let dy = -1; dy <= 1 && !land; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && g.h[((y + dy + n) % n) * n + (x + dx + n) % n] >= g.pw) { land = true; break; }
    if (!land) left++; }
  assert.equal(left, 0);
});
test('soils: bedrock is speckled knobs (many small patches), not a few blobs', () => {
  const S = soilGrid(1400), n = S.n, seen = new Uint8Array(n * n), sizes: number[] = [];
  for (let c = 0; c < n * n; c++) if (SOIL_KINDS[S.kind[c]] === 'bedrock' && !seen[c]) { const st = [c]; seen[c] = 1; let k = 0; while (st.length) { const q = st.pop()!, x = q % n, y = (q / n) | 0; k++;
    for (const m of [y * n + (x + 1) % n, y * n + (x + n - 1) % n, ((y + 1) % n) * n + x, ((y + n - 1) % n) * n + x]) if (!seen[m] && SOIL_KINDS[S.kind[m]] === 'bedrock') { seen[m] = 1; st.push(m); } } sizes.push(k * S.cell * S.cell / 1e4); }
  sizes.sort((a, b) => a - b); // WorldCover outcrop at 30 m: ~760 patches per 100 km^2, median 0.18 ha
  assert.ok(sizes.length > 200 && sizes[sizes.length >> 1] < 1, `${sizes.length} patches, median ${sizes[sizes.length >> 1]} ha`);
});
