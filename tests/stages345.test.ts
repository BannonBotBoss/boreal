// T-0070 stages 3-5 across the JS boundary: gas column above a point, gas-fed shortwave column, emergent objects.
import { test } from 'node:test'; import assert from 'node:assert/strict'; import { readFileSync, existsSync } from 'node:fs';
import { loadPlanetSim, ATM_LAYERS } from '../src/core/planetBudget';
const w = new URL('../public/wasm/boreal_sim.wasm', import.meta.url), sim = existsSync(w) ? await loadPlanetSim(readFileSync(w)) : null;
test('stage 3: column above sea level = p0/g, ~345 DU, layer names; upper air within 4 % of US76', { skip: !sim }, () => {
  const a = sim!.gasAbove(0, .0115); assert.ok(Math.abs(a.mass * 9.82 / 101325 - 1) < .01 && Math.abs(a.o3DU - 345) < 15 && Math.abs(a.pwMm - 25) < 4);
  assert.equal(ATM_LAYERS[sim!.gasAbove(30).layer], 'stratosphere'); assert.equal(ATM_LAYERS[sim!.gasAbove(300).layer], 'thermosphere');
  assert.ok(Math.abs(sim!.gasColumn(120).p / 2.5381e-3 - 1) < .04 && Math.abs(sim!.gasColumn(300).rho / 1.916e-11 - 1) < .04);
  assert.ok(Math.abs(sim!.figureGravity(6378137, 0) - 9.780) < .003 && Math.abs(sim!.figureGravity(6356752, 90) - 9.832) < .003);
});
test('stage 4: overhead sun over clear ocean conserves energy; glint only toward the mirror point', { skip: !sim }, () => {
  const k = sim!.rtPoint({ year: 2020, cosZ: 1, cosV: .8, phi: Math.PI, surf: 0, hKm: 0 });
  assert.ok(Math.abs(k.toa - k.tsi) < 1e-9 && Math.abs(k.toa - k.reflAtm - k.reflSurf - k.absAtm - k.absSurf) < 1e-6 && k.albedo < .04);
  assert.ok(sim!.rtPoint({ year: 2020, cosZ: .8, cosV: .8, phi: Math.PI, surf: 0, hKm: 0 }).glint > .2 && sim!.rtPoint({ year: 2020, cosZ: .8, cosV: .8, phi: 0, surf: 0, hKm: 0 }).glint < 1e-3);
});
test('stage 5: a relaxed Earth is exactly one object, unbound particles none, the Moon exists untrusted inside its Hill sphere', { skip: !sim }, () => {
  const e = sim!.emergentDemo(2000, 0); assert.equal(e.count, 1); assert.ok(e.trusted && Math.abs(e.mass / 5.972e24 - 1) < .01 && Math.hypot(...e.com) < 3e5);
  assert.equal(sim!.emergentDemo(2000, 1).count, 0);
  const m = sim!.emergentDemo(2000, 2); assert.equal(m.count, 2); assert.ok(m.insideHill && m.outsideRoche);
});
