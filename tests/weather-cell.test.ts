// T-0103, roadmap step 4, issue #100.
// The near cell relaxes toward the planet climate. climateRaw is not on that path.
// The lapse, Kessler, Manabe bucket, degree-day factor, and the 0 °C split stay.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadPlanetSim } from '../src/core/planetBudget';
import { bindPlanetWeather } from '../src/core/planetWeather';
import {
  AIR, CLOUD_LWP_SAT, DY, HYDRO, KESSLER, WEATHER, cellClimate, climateRawCallCount,
  getGrid, initWeather, nearCellLive, precipFallsAsSnow, relaxToward, snowDepthCm, stepWeather, theta, weatherAt,
} from '../src/core/weather';

const root = join(import.meta.dirname, '..');
const strip = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

test('the near grid does not name climateRaw, and the cited constants stay', () => {
  const src = strip(readFileSync(join(root, 'src/core/weather.ts'), 'utf8'));
  const calls = src.match(/\bclimateRaw\s*\(/g) ?? [];
  assert.equal(calls.length, 2, 'definition plus the one call inside climate()');
  assert.equal(src.includes('function cellClimate'), true);
  assert.equal(AIR.lapse, 0.0065); // ICAO / ISO 2533
  assert.equal(KESSLER.k1, 1e-3);
  assert.equal(KESSLER.qc0, 1e-3);
  assert.equal(KESSLER.k2, 2.2);
  assert.equal(HYDRO.bucketMm, 150);
  assert.equal(HYDRO.ddf, 3);
  assert.equal(HYDRO.snowDensity, 250);
  assert.equal(CLOUD_LWP_SAT, 0.2);
  assert.equal(relaxToward(0, 10, 3600), 10); // the existing 1 h nudge [game calibration]
  assert.equal(relaxToward(0, 10, 3600, true), 2.5); // temperature and humidity keep the quarter rate
  assert.ok(relaxToward(0, 10, 120, true) > 0 && relaxToward(0, 10, 120, true) < 10);
  assert.equal(precipFallsAsSnow(-0.01), true);
  assert.equal(precipFallsAsSnow(0), false);
  assert.equal(precipFallsAsSnow(0.01), false);
});

test('with no planet, the column still has the private fallback', () => {
  bindPlanetWeather(null);
  const before = climateRawCallCount();
  initWeather(15, 12, 0, 0, 4);
  assert.equal(nearCellLive(), false);
  stepWeather(30);
  assert.ok(climateRawCallCount() > before);
});

const wasmPath = new URL('../public/wasm/boreal_sim.wasm', import.meta.url);
const bytes = existsSync(wasmPath) ? readFileSync(wasmPath) : null;
const skip = bytes ? false : 'public/wasm/boreal_sim.wasm not built (npm run build:wasm)';

test('a bound planet is the cell target, and climateRaw is not called', { skip }, async () => {
  const sim = await loadPlanetSim(bytes!);
  assert.ok(sim);
  sim.init(4, 8);
  sim.plane('tair').fill(41);
  sim.plane('rh').fill(0.55);
  sim.plane('u').fill(3);
  sim.plane('v').fill(4);
  sim.plane('precip').fill(24);
  sim.plane('snow').fill(30);
  sim.plane('cloud').fill(0.4);
  sim.plane('soil').fill(75);
  sim.plane('q').fill(0.004);
  const snap = { day: WEATHER.day, hour: WEATHER.hour, on: WEATHER.on };
  bindPlanetWeather(sim);
  WEATHER.on = true;
  const before = climateRawCallCount();
  try {
    const g = initWeather(15, 12, 0, 0, 4);
    assert.equal(nearCellLive(), true);
    const layerZ = 0.5 * DY;
    const target = cellClimate(WEATHER.day, WEATHER.hour, layerZ, 0, 0);
    assert.equal(target.source, 'planet');
    assert.ok(Math.abs(target.surfaceTC - 41) < 1e-6);
    assert.ok(Math.abs(target.tC - (41 - AIR.lapse * layerZ)) < 1e-6, `layer ${target.tC}`);
    assert.equal(target.u, 3);
    assert.equal(target.v, -4);
    for (let n = 0; n < g.u.length; n++) {
      assert.equal(g.u[n], 3);
      assert.equal(g.v[n], -4);
    }
    const here = weatherAt(0, 0);
    assert.ok(Math.abs(here.tC - 41) < 1e-4, `surface ${here.tC}`);
    assert.ok(Math.abs(here.rh - 0.55) < 1e-4, `rh ${here.rh}`);
    assert.equal(here.sweMm, 30);
    assert.equal(here.depthCm, snowDepthCm(30));
    assert.equal(here.depthCm, 12);
    // 41 °C is rain. The store still has depth. Falling snow needs the surface below 0 °C.
    assert.equal(here.snow, false);
    assert.equal(here.rainMmH, 1);
    assert.ok(here.cloud >= 0.4);
    assert.equal(precipFallsAsSnow(here.tC), false);
    // Left alone, a cold cell moves toward the planet target. The private formula is not 41 °C.
    const n0 = 0;
    const thEnv = theta(target.tC, target.p);
    g.th[n0] = thEnv - 30;
    const moved = relaxToward(g.th[n0], thEnv, 120, true) - g.th[n0];
    assert.ok(moved > 0.2 && moved < 0.4, `nudge ${moved}`);
    stepWeather(120);
    assert.ok(getGrid().th[n0] > thEnv - 30, 'the step moved the cell toward the planet');
    assert.equal(sim.plane('tair')[0], 41, 'the cell does not write the planet plane');
    sim.plane('tair').fill(-8);
    initWeather(15, 12, 0, 0, 4);
    const cold = weatherAt(0, 0);
    assert.ok(Math.abs(cold.tC - (-8)) < 1e-4, `cold surface ${cold.tC}`);
    assert.equal(cold.snow, true);
    assert.equal(cold.sweMm, 30);
    assert.equal(cold.depthCm, 12);
    assert.equal(precipFallsAsSnow(cold.tC), true);
    assert.equal(climateRawCallCount(), before);
  } finally {
    bindPlanetWeather(null);
    WEATHER.day = snap.day; WEATHER.hour = snap.hour; WEATHER.on = snap.on;
  }
});
