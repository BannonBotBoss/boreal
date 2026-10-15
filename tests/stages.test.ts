import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ELEV, elevationGrid, flowGrid, sampleGrid } from '../src/core/stages/elevation';
import { computeFlow } from '../src/core/stages/flow';

test('stage 1 elevation: deterministic, in range, seamless wrap', () => {
  const a = elevationGrid(7), b = elevationGrid(7); assert.equal(a, b);
  assert.ok(a.h.every(v => v >= 0 && v <= ELEV.relief));
  const W = a.n * a.cell; assert.ok(Math.abs(sampleGrid(a, 10, 20) - sampleGrid(a, 10 + W, 20 - W)) < 1e-6);
  assert.ok(a.ms < 2000, `built in ${a.ms} ms`);
});
test('Priority-Flood + D8: no pits, no uphill flow, every cell reaches an outlet, accumulation conserves cells', () => {
  const f = flowGrid(7), N = f.n * f.n, g = elevationGrid(7);
  for (let c = 0; c < N; c++) {
    assert.ok(f.filled[c] >= g.h[c] - 1e-6, 'filling never lowers');
    if (!f.outlet[c]) { assert.ok(f.dir[c] >= 0, `pit at ${c}`); assert.ok(f.filled[f.dir[c]] < f.filled[c], 'downhill on the filled surface'); }
  }
  let reach = 0; for (let c = 0; c < N; c += 97) { let k = c, steps = 0; while (!f.outlet[k] && steps++ < N) k = f.dir[k]; if (f.outlet[k]) reach++; }
  assert.equal(reach, Math.ceil(N / 97));
  let atOutlets = 0; for (let c = 0; c < N; c++) if (f.outlet[c]) atOutlets += f.acc[c];
  assert.ok(Math.abs(atOutlets - N) < 1e-3 * N, `Σ outlet accumulation ${atOutlets} = cells ${N}`);
});
test('flow on a tiny synthetic bowl: the pit fills to its spill height', () => {
  const n = 5, h = new Float32Array(n * n).fill(5); h[12] = 1; h[0] = 0; // bowl at centre, outlet at a corner
  const f = computeFlow({ n, cell: 1, h }, 0); assert.ok(f.filled[12] >= 5 - 1e-3, `filled ${f.filled[12]}`);
});
import { lakeGrid } from '../src/core/stages/elevation';
test('lakes and ponds: filled depressions labelled and classified', () => {
  const L = lakeGrid(7), f = flowGrid(7), g = elevationGrid(7);
  for (let c = 0; c < L.id.length; c++) if (L.id[c] >= 0) assert.ok(f.filled[c] > g.h[c], 'water only where filled');
  assert.ok(L.bodies.length > 0, 'some water bodies'); for (const b of L.bodies) assert.equal(b.kind, b.areaHa < 2 ? 'pond' : 'lake');
});
