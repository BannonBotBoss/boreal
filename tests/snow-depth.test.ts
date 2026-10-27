// T-0087: depth is the snow-water store divided by the cited density. The 0 °C split stays.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { column } from '../src/core/ground';
import { loadPlanetSim } from '../src/core/planetBudget';
import { bindPlanetWeather } from '../src/core/planetWeather';
import { AIR, DY, HYDRO, NY, WEATHER, climate, getGrid, initWeather, kessler, precipFallsAsSnow, qsat, snowDepthCm, theta, weatherAt } from '../src/core/weather';

test('snow depth in centimetres is the store divided by the cited density', () => {
  // Sturm et al. 2010 eq. 1, rearranged: depth_cm = SWE_cm / density_g_cm3.
  // 10 mm of water is 1 cm. At 0.250 g/cm³ that is 4 cm of snow. 250 mm is 1 m, 100 cm.
  assert.equal(HYDRO.snowDensity, 250);
  assert.equal(snowDepthCm(0), 0);
  assert.equal(snowDepthCm(10), 4);
  assert.equal(snowDepthCm(HYDRO.snowDensity), 100);
  assert.equal(snowDepthCm(86), 86 * 100 / HYDRO.snowDensity);
  assert.equal(HYDRO.ddf, 3);
  assert.equal(precipFallsAsSnow(-0.01), true);
  assert.equal(precipFallsAsSnow(0), false);
  assert.equal(precipFallsAsSnow(0.01), false);
});

/** Potential temperature whose reconstructed surface temperature has the same sign as `tC`, including exactly 0 °C. */
function thFor(tC: number, p: number) {
  let th = theta(tC, p);
  const temp = (v: number) => v * (p / AIR.p0) ** (AIR.Rd / AIR.cp) - 273.15;
  if (tC < 0) { while (!(temp(th) < 0)) th -= 1e-3; }
  else { while (temp(th) < 0) th += 1e-3; }
  return th;
}
function lay(tC: number) {
  const g = initWeather(15, 12, 0, 0, 4);
  const n = 4;
  for (let k = 0; k < NY; k++) {
    const p = climate(WEATHER.day, WEATHER.hour, (k + 0.5) * DY).p;
    const th = k === 0 ? thFor(tC, p) : theta(tC, p), qs = qsat(tC, p);
    for (let c = 0; c < n * n; c++) {
      const i = k * n * n + c;
      g.th[i] = th; g.q[i] = qs; g.qc[i] = 0; g.qr[i] = 0;
    }
  }
  for (let c = 0; c < n * n; c++) g.qr[c] = 1e-4;
  g.swe.fill(0); g.soil.fill(50); g.snowfall.fill(0);
  return g;
}
function phase(tC: number) {
  const g = lay(tC);
  const swe = g.swe.reduce((s, v) => s + v, 0), soil = g.soil.reduce((s, v) => s + v, 0);
  kessler(2000);
  return {
    swe: g.swe.reduce((s, v) => s + v, 0) - swe,
    soil: g.soil.reduce((s, v) => s + v, 0) - soil,
    snow: g.snowfall.every(v => v === (precipFallsAsSnow(tC) ? 1 : 0)),
    fell: g.precip.some(v => v > 0),
  };
}

test('Kessler snow is below 0 °C and rain is at and above 0 °C', () => {
  WEATHER.on = true;
  const cold = phase(-5), freezing = phase(0), warm = phase(3);
  assert.equal(cold.fell, true);
  assert.ok(cold.swe > 0, `cold swe ${cold.swe}`);
  assert.equal(cold.soil, 0);
  assert.equal(cold.snow, true);
  for (const hit of [freezing, warm]) {
    assert.equal(hit.fell, true);
    assert.equal(hit.swe, 0);
    assert.ok(hit.soil > 0, `soil ${hit.soil}`);
    assert.equal(hit.snow, true);
  }
});

test('the player read and the ground column use that depth', () => {
  WEATHER.on = true;
  bindPlanetWeather(null);
  const g = initWeather(15, 12, 0, 0, 4);
  g.swe.fill(25);
  const here = weatherAt(0, 0);
  assert.equal(here.sweMm, 25);
  assert.equal(here.depthCm, snowDepthCm(25));
  assert.equal(here.depthCm, 10);
  const col = column(0, 0);
  const snow = col.layers.find(l => l.id === 'snow');
  assert.ok(snow);
  assert.ok(Math.abs(snow.thickness * 100 - here.depthCm) < 1e-6, `thickness ${snow.thickness}`);
  const bare = weatherAt(100000, 100000);
  assert.equal(bare.sweMm, 0);
  assert.equal(bare.depthCm, 0);
  assert.equal(getGrid(), g);
});

const wasmPath = new URL('../public/wasm/boreal_sim.wasm', import.meta.url);
const bytes = existsSync(wasmPath) ? readFileSync(wasmPath) : null;
const skip = bytes ? false : 'public/wasm/boreal_sim.wasm not built (npm run build:wasm)';

test('the forest read of the Rust snow store is the same centimetre depth', { skip }, async () => {
  const sim = await loadPlanetSim(bytes!);
  assert.ok(sim);
  sim.init(4, 8);
  sim.plane('snow').fill(30);
  sim.plane('tair').fill(-8);
  sim.plane('precip').fill(24);
  sim.plane('q').fill(0.004);
  sim.plane('rh').fill(0.8);
  sim.plane('cloud').fill(0.4);
  sim.plane('soil').fill(75);
  sim.plane('u').fill(0);
  sim.plane('v').fill(0);
  const snap = WEATHER.on;
  bindPlanetWeather(sim);
  WEATHER.on = true;
  try {
    const cold = weatherAt(0, 0);
    assert.equal(cold.snow, true);
    assert.equal(cold.sweMm, 30);
    assert.equal(cold.depthCm, 12);
    assert.equal(cold.depthCm, snowDepthCm(cold.sweMm));
    sim.plane('tair').fill(0);
    const freezing = weatherAt(0, 0);
    assert.equal(freezing.snow, false);
    assert.equal(freezing.depthCm, snowDepthCm(30));
    sim.plane('tair').fill(4);
    assert.equal(weatherAt(0, 0).snow, false);
  } finally {
    bindPlanetWeather(null);
    WEATHER.on = snap;
  }
});
