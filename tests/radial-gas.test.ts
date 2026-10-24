// Through-planet profile and gas column from the wasm (interior.rs, gas.rs): PREM and USSA76 checks across the JS boundary.
import { test } from 'node:test'; import assert from 'node:assert/strict'; import { readFileSync, existsSync } from 'node:fs';
import { loadPlanetSim, INTERIOR_LAYERS } from '../src/core/planetBudget';
const w = new URL('../public/wasm/boreal_sim.wasm', import.meta.url), sim = existsSync(w) ? await loadPlanetSim(readFileSync(w)) : null;
test('radial profile: PREM centre pressure, layers along the axis, signed r', { skip: !sim }, () => {
  const c = sim!.radialProfile(0); assert.equal(INTERIOR_LAYERS[c.layer], 'inner core'); assert.ok(Math.abs(c.P / 1e9 - 363.85) < 4);
  assert.deepEqual(sim!.radialProfile(-3000), sim!.radialProfile(3000));
  assert.equal(INTERIOR_LAYERS[sim!.radialProfile(6371 + 10).layer], 'atmosphere');
  assert.ok(Math.abs(sim!.radialProfile(6371.0088).g - 9.82) < 0.01);
});
test('gas column: USSA76 sea level and 20 km, dry-air mix, O dominant at 300 km', { skip: !sim }, () => {
  const s = sim!.gasColumn(0); assert.ok(Math.abs(s.p - 101325) < 50 && Math.abs(s.rho - 1.225) < 0.01 && Math.abs(s.T - 288.15) < 0.01);
  assert.ok(Math.abs(sim!.gasColumn(20).p / 5529.3 - 1) < 0.02); assert.ok(Math.abs(s.x[0] - 0.78084) < 3e-4);
  const t = sim!.gasColumn(300); assert.ok(t.x[6] > 0.5); assert.ok(sim!.gasColumn(0, 1).rho > 55);
});
