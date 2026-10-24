import { test } from 'node:test'; import assert from 'node:assert/strict';
import { MORVEL, buildPlates, boundaries } from '../src/world/globe/plates';
const R = 6.371e6, pl = buildPlates(1, 8000, 40);
test('MORVEL plates cover 97.2 % of the sphere (the 31 Bird plates hold 2.8 %, Argus et al. 2011)', () => { assert.ok(Math.abs(MORVEL.reduce((s, m) => s + m[4], 0) / (4 * Math.PI) - 0.972) < 0.005); });
test('seeded plates fit the MORVEL areas', () => { const big = MORVEL.map((m, i) => [m[4], pl.areas[i]]).filter(([a]) => a > 0.3);
  for (const [a, b] of big) assert.ok(Math.abs(b - a) / a < 0.35, `area ${b.toFixed(2)} vs ${a}`); });
test('plate speeds are Earth-like (NNR-MORVEL56 RMS 11-75 mm/yr) and boundaries mix all three kinds', () => {
  const b = boundaries(pl, R, 2), mm = b.map(x => x.rate * 1e3), mean = mm.reduce((s, v) => s + v, 0) / mm.length;
  assert.ok(mean > 15 && mean < 120, `mean relative rate ${mean.toFixed(0)} mm/yr`);
  for (const k of ['divergent', 'convergent', 'transform'] as const) { const f = b.filter(x => x.kind === k).length / b.length; assert.ok(f > 0.1, `${k} ${f.toFixed(2)}`); } });
