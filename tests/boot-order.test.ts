// Issue #47: the globe boot order is a contract. Reordering the list, or integrating Ts inside the boot, fails here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { PLANE_NAMES, loadPlanetSim } from '../src/core/planetBudget';
import { AIR, qsat } from '../src/core/weather';
import { GLOBE_BOOT_ORDER, RUST_BOOT_ORDER, bootGlobe } from '../src/world/globe/bootOrder';

const ISSUE_47 = [
  'land_sea_mask', 'elevation_roughness', 'climate_bands', 'sst_soil_humidity', 'cloud_seed', 'solar_budget',
  'surface_absorption', 'pressure', 'wind', 'hydrosphere_flows', 'atmosphere_updates', 'finalize', 'render_globe',
];

test('issue #47 order is the boot contract, and the rust list is the same middle', () => {
  assert.deepEqual([...GLOBE_BOOT_ORDER], ISSUE_47);
  assert.deepEqual([...RUST_BOOT_ORDER], ISSUE_47.slice(1, -1));
  const rust = readFileSync(new URL('../rust/boreal-sim/src/boot_order.rs', import.meta.url), 'utf8');
  const body = rust.slice(rust.indexOf('pub const RUST_BOOT_STEPS'), rust.indexOf('pub fn boot'));
  const steps = [...body.matchAll(/"([a-z_]+)"/g)].map(m => m[1]);
  assert.deepEqual(steps, [...RUST_BOOT_ORDER]);
  assert.ok(rust.includes('for step in RUST_BOOT_STEPS'), 'the const is the call order');
  assert.ok(!/update_energy\s*\(/.test(rust), 'boot does not call update_energy');
  const ts = readFileSync(new URL('../src/world/globe/bootOrder.ts', import.meta.url), 'utf8');
  const iLand = ts.indexOf('land.set'), iElev = ts.indexOf('elev.set'), iBoot = ts.indexOf('sim.boot');
  assert.ok(iLand > 0 && iLand < iElev && iElev < iBoot, 'land plane, then elevation, then rust boot');
  const view = readFileSync(new URL('../src/world/globe/globeView.ts', import.meta.url), 'utf8');
  const startAt = view.indexOf('start() {');
  const start = view.slice(startAt, view.indexOf('attachInput(on', startAt));
  assert.ok(start.indexOf('bootP') !== -1 && start.indexOf('bootP') < start.indexOf('requestAnimationFrame'), 'standalone first frame waits for boot');
  const stepAt = view.indexOf('function step(');
  const step = view.slice(stepAt, view.indexOf('function tick', stepAt));
  assert.ok(step.indexOf('!booted') !== -1 && step.indexOf('!booted') < step.indexOf('renderTo'), 'shared first render is after finalize');
  const layers = readFileSync(new URL('../src/world/globe/planetLayers.ts', import.meta.url), 'utf8');
  assert.ok(layers.includes('bootGlobe('), 'layer fill uses the boot');
  assert.ok(!layers.includes('.seed('), 'layer fill does not use the old seed order');
});

const wasmPath = new URL('../public/wasm/boreal_sim.wasm', import.meta.url);
const sim = existsSync(wasmPath) ? await loadPlanetSim(readFileSync(wasmPath)) : null;
const skip = sim ? false : 'public/wasm/boreal_sim.wasm not built (npm run build:wasm)';

test('boot fills planes without advancing time or moving Ts', { skip }, () => {
  const trace = bootGlobe(sim!, 12, 24, (lat, lon) => {
    const land = ((lon + 180) % 120 < 60 && Math.abs(lat) < 70) || lat < -70 ? 1 : 0;
    return { land, elev: land ? 300 : 0 };
  }, 80, 15);
  assert.deepEqual([...trace], ISSUE_47.filter(s => s !== 'render_globe'));
  assert.equal(sim!.day, 80);
  assert.equal(sim!.hour, 15);
  const ts = sim!.plane('ts'), tair = sim!.plane('tair'), land = sim!.plane('land'), rough = sim!.plane('rough');
  const soil = sim!.plane('soil'), sst = sim!.plane('sst'), p = sim!.plane('pressure'), q = sim!.plane('q');
  const sw = sim!.plane('swdown'), qa = sim!.plane('qabs'), qr = sim!.plane('qrefl');
  let ocean = false, sun = false, wind = false;
  for (let i = 0; i < sim!.n; i++) {
    assert.equal(ts[i], tair[i]);
    assert.ok(Number.isFinite(rough[i]) && rough[i] > 0);
    if (land[i] > 0.5) {
      assert.ok(Math.abs(soil[i] - 75) < 1e-9, `soil ${soil[i]}`);
      assert.equal(sst[i], -999);
      assert.ok(rough[i] < 0.05, `roughness ran before the bucket seed, got ${rough[i]}`);
    } else {
      ocean = true;
      assert.equal(sst[i], ts[i]);
      assert.ok(Math.abs(p[i] - AIR.p0) < 1e-6, `sea-level pressure ${p[i]}`);
      assert.ok(Math.abs(rough[i] - 0.0002) < 1e-12);
      assert.ok(Math.abs(q[i] / qsat(tair[i], p[i]) - 0.75) < 1e-6);
    }
    assert.ok(Math.abs(qa[i] + qr[i] - sw[i]) < 1e-6);
    if (sw[i] > 1) sun = true;
    if (Math.hypot(sim!.plane('u')[i], sim!.plane('v')[i]) > 0.1) wind = true;
    assert.ok(sim!.plane('cloud')[i] >= 0 && sim!.plane('cloud')[i] <= 1);
    assert.ok(sim!.plane('pw')[i] >= 0 && sim!.plane('evap')[i] >= 0 && sim!.plane('precip')[i] >= 0);
  }
  for (const name of PLANE_NAMES) assert.ok(sim!.plane(name).every(Number.isFinite), name);
  assert.ok(ocean && sun && wind, `ocean ${ocean} sun ${sun} wind ${wind}`);
});
