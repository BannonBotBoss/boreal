import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dryStart, surfaceAt } from '../src/core/stages/surfaceAt';
import { lakeGrid, elevationGrid, toWorld } from '../src/core/stages/elevation';
import { SOIL_KINDS } from '../src/core/stages/soils';

test('surfaceAt: worker-safe imports (no three, no DOM globals)', () => {
  const s = readFileSync(new URL('../src/core/stages/surfaceAt.ts', import.meta.url), 'utf8');
  assert.ok(!/from 'three'|\bwindow\.|\bdocument\./.test(s));
});

test('surfaceAt: consistent fields, lakes are water, cheap after first call', () => {
  const seed = 1400; surfaceAt(0, 0, seed); // build grids
  const g = elevationGrid(seed), L = lakeGrid(seed), n = g.n;
  const c = L.id.findIndex(v => v >= 0 && L.bodies[v].areaHa >= 1 && toWorld(g, g.h[L.id.indexOf(v)]) < L.bodies[v].level), p = surfaceAt((c % n) * g.cell, ((c / n) | 0) * g.cell, seed);
  assert.ok(p.lake && p.soil === 'water' && p.wetness === 1 && p.height < p.lake.surface);
  let land = 0;
  for (let k = 0; k < 20000; k++) { const q = surfaceAt(k * 37.3 % 7680, k * 91.7 % 7680, seed);
    assert.ok(Number.isFinite(q.height) && q.wetness >= 0 && q.wetness <= 1 && (SOIL_KINDS as readonly string[]).includes(q.soil));
    if (!q.lake && !q.river) land++; }
  assert.ok(land > 10000, 'mostly land');
  // timing is load-sensitive (parallel test files share the CPU): median of 7 untouched runs of 4000 points, same 50 us budget
  const runs: number[] = [];
  for (let r = 0; r < 7; r++) { const t0 = performance.now(); let h = 0;
    for (let k = 0; k < 4000; k++) h += surfaceAt((k + r * 4000) * 37.3 % 7680, (k + r * 4000) * 91.7 % 7680, seed).height;
    runs.push((performance.now() - t0) / 4000); assert.ok(Number.isFinite(h)); }
  runs.sort((a, b) => a - b); assert.ok(runs[3] < .05, `median ${(runs[3] * 1000).toFixed(1)} us per point (under 50)`);
});
test('dryStart: the default start (0, 0) moves to the nearest dry land on every test seed', () => {
  for (const seed of [1400, 7, 99]) { const [x, z] = dryStart(0, 0, seed), p = surfaceAt(x, z, seed);
    assert.ok(!p.lake && !p.river && Math.hypot(x, z) <= 900, `seed ${seed}: (${x.toFixed(0)}, ${z.toFixed(0)})`); }
});
