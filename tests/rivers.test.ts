import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeFlow } from '../src/core/stages/flow';
import { flowGrid, lakeGrid } from '../src/core/stages/elevation';
import { RIVER, extractRivers, riverGrid, riverAt, riverAuditPoints, riverPlan, carve } from '../src/core/stages/rivers';
import { PLANFORM, circumradius, planformReport } from '../src/core/stages/riverPlanform';
import { finish } from '../src/core/interest';
import { terrainCore } from '../src/render/terrainCore';

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
  const pts = riverAuditPoints(7); assert.ok(pts.length > 20, `samples ${pts.length}`);
  for (const p of pts) {
    const hit = riverAt(7, p.x, p.z); assert.ok(hit, 'centreline sample is a river');
    assert.ok(hit!.d < 0.05, `on the centreline, d=${hit!.d}`);
    assert.ok(Math.abs(Math.hypot(hit!.dirX, hit!.dirZ) - 1) < 1e-3, 'flow follows the tangent');
    const bed = carve(hit!.surface + 5, hit!); assert.ok(bed < hit!.surface, `bed ${bed} below surface ${hit!.surface}`);
    assert.ok(carve(-50, hit!) === -50, 'never raises'); assert.deepEqual(riverAt(7, p.x, p.z), hit);
  }
});
test('planform radius is at least 2 channel widths; the straight D8 polyline is the known miss', () => {
  // Calibration of circumradius. A 90° corner with 0.5 m legs is a point bend: R = 0.3536 m.
  const kink = circumradius(0, 0, 0.5, 0, 0.5, 0.5);
  assert.ok(Math.abs(kink - 0.353553) < 1e-3, `kink R ${kink}`);
  assert.ok(kink < PLANFORM.rcMinOverW * 4, 'known mismatch: a polyline corner is under 2 widths');
  // Three points on a circle of R = 2.43 * 4 m recover that radius (a known match).
  const R = PLANFORM.rcOverW * 4, a = 0.4, b = 0.9;
  const match = circumradius(R * Math.cos(a), R * Math.sin(a), R * Math.cos((a + b) / 2), R * Math.sin((a + b) / 2), R * Math.cos(b), R * Math.sin(b));
  assert.ok(Math.abs(match - R) / R < 1e-6, `arc R ${match}`);
  assert.ok(match >= PLANFORM.rcMinOverW * 4, 'known match');
  const f = flowGrid(1400), Rnet = riverGrid(1400), plan = riverPlan(1400);
  assert.ok(plan);
  const report = planformReport(Rnet, f.dir, plan!);
  assert.ok(report.d8SharpShare > 0.3, `raw D8 bends ${report.d8SharpShare}`);
  assert.ok(report.meanderPieces > 0, 'pool-riffle reaches carry a lobe');
  assert.equal(report.under2, 0, JSON.stringify(report));
  assert.ok(report.minRcOverW >= PLANFORM.rcMinOverW - 1e-3, `min Rc/W ${report.minRcOverW}`);
  assert.equal(report.steepMeanderPieces, 0);
  assert.ok(Math.abs(report.medianLambdaOverW - PLANFORM.lambdaOverW) < 0.05, `λ/W ${report.medianLambdaOverW}`);
  assert.ok(Math.abs(report.medianHalfAmpOverW - PLANFORM.beltOverW / 2) < 0.05, `a/W ${report.medianHalfAmpOverW}`);
  const also = planformReport(riverGrid(7), flowGrid(7).dir, riverPlan(7)!);
  assert.equal(also.under2, 0, JSON.stringify(also));
  assert.ok(also.meanderPieces > 0 && also.minRcOverW >= PLANFORM.rcMinOverW - 1e-3);
});
test('river chunks share the border height where the centreline crosses', () => {
  const seg = 8, row = seg + 1;
  const a = finish(terrainCore({ cx: 0, cz: 0, segments: seg, waterSeg: 0, stagesOn: true, stagesSeed: 1400 }));
  const b = finish(terrainCore({ cx: 1, cz: 0, segments: seg, waterSeg: 0, stagesOn: true, stagesSeed: 1400 }));
  const c = finish(terrainCore({ cx: 0, cz: 1, segments: seg, waterSeg: 0, stagesOn: true, stagesSeed: 1400 }));
  for (let iz = 0; iz <= seg; iz++) {
    const ia = (iz * row + seg) * 3, ib = (iz * row) * 3;
    assert.ok(Math.abs(a.position[ia + 1] - b.position[ib + 1]) < 1e-4, `x seam ${a.position[ia + 1]} ${b.position[ib + 1]}`);
    assert.ok(Math.abs(a.normal[ia] - b.normal[ib]) < 1e-4 && Math.abs(a.normal[ia + 1] - b.normal[ib + 1]) < 1e-4);
  }
  for (let ix = 0; ix <= seg; ix++) {
    const ia = (seg * row + ix) * 3, ic = ix * 3;
    assert.ok(Math.abs(a.position[ia + 1] - c.position[ic + 1]) < 1e-4, `z seam ${a.position[ia + 1]} ${c.position[ic + 1]}`);
  }
});
test('far from any channel there is no river', () => {
  const n = 8, h = new Float32Array(n * n).fill(1); h[0] = 0; const f = computeFlow({ n, cell: 30, h }, 0); // 64 cells x 900 m^2 << 0.5 km^2
  const R = extractRivers(f); assert.equal(R.channel.reduce((a, b) => a + b, 0), 0);
});
