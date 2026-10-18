import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeFlow } from '../src/core/stages/flow';
import { flowGrid, elevationGrid, lakeGrid, toWorld } from '../src/core/stages/elevation';
import { RIVER, extractRivers, riverGrid, riverAt, carve } from '../src/core/stages/rivers';

test('Strahler on a synthetic Y: two order-1 branches make order 2; an order-1 side stream keeps order 2', () => {
  // 1-D-ish hand network on a 6x6 torus: channel = every cell (initKm2 tiny), receivers set by hand.
  const n = 6, N = n * n, dir = new Int32Array(N).fill(-1), acc = new Float32Array(N).fill(10), outlet = new Uint8Array(N), filled = new Float32Array(N);
  const at = (x: number, y: number) => y * n + x; outlet.fill(1);
  for (const c of [at(0, 0), at(1, 1), at(2, 0), at(1, 2), at(1, 3), at(0, 3)]) outlet[c] = 0;
  dir[at(0, 0)] = at(1, 1); dir[at(2, 0)] = at(1, 1); dir[at(1, 1)] = at(1, 2); dir[at(1, 2)] = at(1, 3); dir[at(0, 3)] = at(1, 3); dir[at(1, 3)] = at(1, 4);
  const R = extractRivers({ n, cell: 1000, filled, dir, acc, outlet, ms: 0 });
  assert.equal(R.order[at(0, 0)], 1); assert.equal(R.order[at(2, 0)], 1);
  assert.equal(R.order[at(1, 1)], 2, 'two order-1 inflows -> 2');
  assert.equal(R.order[at(1, 3)], 2, 'order-2 + order-1 -> stays 2'); assert.equal(R.maxOrder, 2);
  assert.equal(R.channel[at(1, 4)], 0, 'outlets are open water, not channel');
});
test('channel extraction is exactly the area threshold; geometry follows Bieger et al. 2015', () => {
  const f = flowGrid(7), R = riverGrid(7), km2 = f.cell * f.cell / 1e6;
  let count = 0;
  for (let c = 0; c < f.acc.length; c++) {
    assert.equal(R.channel[c], !f.outlet[c] && f.acc[c] * km2 >= RIVER.initKm2 ? 1 : 0);
    if (R.channel[c]) { count++; assert.ok(Math.abs(R.width[c] - 4.15 * R.areaKm2[c] ** .308) < 1e-4); assert.ok(Math.abs(R.depth[c] - .31 * R.areaKm2[c] ** .202) < 1e-4); }
  }
  assert.ok(count > 50, `some channels (${count})`); assert.ok(R.maxOrder >= 2, `order ${R.maxOrder}`); assert.ok(R.ms < 500, `${R.ms} ms`);
});
test('rivers never run uphill, order never decreases downstream, width grows downstream, lakes are not drawn', () => {
  const f = flowGrid(7), R = riverGrid(7), L = lakeGrid(7);
  for (let c = 0; c < f.acc.length; c++) {
    if (L.id[c] >= 0) assert.equal(R.drawn[c], 0, 'lake cell drawn as river');
    const r = f.dir[c]; if (!R.channel[c] || r < 0 || !R.channel[r]) continue;
    assert.ok(f.filled[r] < f.filled[c], 'downhill'); assert.ok(R.order[r] >= R.order[c], 'Strahler monotone'); assert.ok(R.width[r] >= R.width[c], 'width monotone');
  }
});
test('riverAt + carve: on a centreline the bed is below the water surface, carving only lowers, deterministic', () => {
  const f = flowGrid(7), R = riverGrid(7), g = elevationGrid(7), n = R.n, s = R.cell; let checked = 0;
  for (let c = 0; c < R.drawn.length && checked < 200; c += 7) {
    if (!R.drawn[c] || f.dir[c] < 0) continue;
    const x = (c % n) * s, z = ((c / n) | 0) * s, hit = riverAt(7, x, z); assert.ok(hit, 'node on a channel has a river'); checked++;
    assert.ok(hit!.d < 1e-6 || hit!.d < hit!.half, 'inside the channel');
    const h = toWorld(g, g.h[c]) + 5, bed = carve(h, hit!); assert.ok(bed < hit!.surface, `bed ${bed} below surface ${hit!.surface}`);
    assert.ok(carve(-50, hit!) === -50, 'never raises'); assert.deepEqual(riverAt(7, x, z), hit);
    if (hit!.half === Math.min(.4 * s, R.width[c] / 2)) assert.ok(hit!.surface <= toWorld(g, f.filled[c]) + 1e-6, 'surface follows the filled surface');
  }
  assert.ok(checked > 20, `checked ${checked}`);
});
test('far from any channel there is no river', () => {
  const n = 8, h = new Float32Array(n * n).fill(1); h[0] = 0; const f = computeFlow({ n, cell: 30, h }, 0); // 64 cells x 900 m^2 << 0.5 km^2
  const R = extractRivers(f); assert.equal(R.channel.reduce((a, b) => a + b, 0), 0);
});
