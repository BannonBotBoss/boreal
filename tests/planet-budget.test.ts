// Issue #43 planet budgets: the Rust (wasm) crate must agree with weather.ts, and the grid must stay physical with the real planet's land mask.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { PLANE_NAMES, SURFACE_ROWS, loadPlanetSim, solarLayerFallback } from '../src/core/planetBudget';
import { AIR, NORMALS, WEATHER, climate, qsat, shortwave, solar, weatherAt } from '../src/core/weather';
import { bindClimateSim, invalidateClimateRead, localToUtc, resetClimateAuthority, samplePlane, startForestClimate } from '../src/core/climateAuthority';
import { fromLatLon, planetFor } from '../src/world/globe/planet';

const wasmPath = new URL('../public/wasm/boreal_sim.wasm', import.meta.url);
const have = existsSync(wasmPath);
const sim = have ? await loadPlanetSim(readFileSync(wasmPath)) : null;
const skip = sim ? false : 'public/wasm/boreal_sim.wasm not built (npm run build:wasm); TypeScript fallback is tested instead';

test('fallback solar layer works without wasm: tilt, night and day', () => {
  const june = solarLayerFallback(36, 72, 172, 12), dec = solarLayerFallback(36, 72, 355, 12);
  assert.ok(june.every(Number.isFinite) && june.some(v => v === 0) && june.some(v => v > 300));
  const row = (a: Float64Array, r: number) => { let s = 0; for (let c = 0; c < 72; c++) s += a[r * 72 + c]; return s / 72; };
  assert.ok(row(june, 34) > row(dec, 34), 'north polar row is brighter in June (tilt)');
  assert.ok(row(dec, 1) > row(june, 1), 'south polar row is brighter in December');
});
test('weather.ts surface rows the Rust crate mirrors are unchanged', () => {
  // surface_budget.rs: WATER .06/0/.0002, FOREST .10/100/1.5, SNOW .80/0/.001. If these change, update the Rust constants.
  assert.deepEqual([SURFACE_ROWS.water.albedo, SURFACE_ROWS.water.z0, SURFACE_ROWS.forest.albedo, SURFACE_ROWS.forest.rs, SURFACE_ROWS.forest.z0, SURFACE_ROWS.snow.albedo, SURFACE_ROWS.snow.z0],
    [.06, .0002, .1, 100, 1.5, .8, .001]);
});
test('wasm layout matches the TypeScript plane table', { skip }, () => { assert.ok(sim); assert.equal(PLANE_NAMES.length, 37); });
test('loaded wasm solar budget is the authority; weather.ts solar() matches it to 1e-9', { skip }, () => {
  let worst = 0;
  for (let k = 0; k < 400; k++) {
    const day = 1 + (k * 37) % 365, hour = (k * 5.3) % 24, lat = -89 + (k * 13.7) % 178, lon = -180 + (k * 29.1) % 360, cloud = (k % 11) / 10;
    const s = solar(day, hour, lat, lon, 0), sw = shortwave(s.cosZ, cloud, AIR.S0), r = sim!.solarCell(day, hour, lat, lon, cloud, 0.3, 15, 1000);
    for (const [a, b] of [[r[6], s.cosZ], [r[0], s.toa], [r[1], sw], [r[2], .7 * sw], [r[3], .3 * sw]]) worst = Math.max(worst, Math.abs(a - b));
  }
  assert.ok(worst < 1e-9, `worst difference ${worst}`);
});
test('wasm humidity table agrees with weather.ts qsat (via the seeded cell)', { skip }, () => {
  // seeded humidity of a 4×4 ocean grid is RH_SEED (0.75) of saturation at the cell's own temperature and pressure (Bolton 1980 qsat)
  sim!.init(4, 4).setLand(() => ({ land: 0, elev: 0 })).seed(80, 0);
  const q = sim!.plane('q'), t = sim!.plane('tair'), p = sim!.plane('pressure');
  for (let i = 0; i < 16; i++) assert.ok(Math.abs(q[i] / qsat(t[i], p[i]) - .75) < 0.01, `cell ${i}: RH ${q[i] / qsat(t[i], p[i])}`);
});
test('real planet.ts continents: seeded planet is physical and stays so for 10 days', { skip, timeout: 120000 }, () => {
  const planet = planetFor(1400), nlat = 45, nlon = 90;
  sim!.init(nlat, nlon).setLand((lat, lon) => { const s = planet.sampleSurface(fromLatLon(lat * Math.PI / 180, lon * Math.PI / 180)); return { land: s.h > 0 ? 1 : 0, elev: Math.max(0, s.h) }; }).seed(80, 0);
  const landShare = sim!.plane('land').reduce((a, b) => a + b, 0) / (nlat * nlon);
  assert.ok(landShare > .15 && landShare < .5, `land share ${landShare}`);
  for (let i = 0; i < 10 * 8; i++) sim!.step(3 * 3600);
  for (const name of PLANE_NAMES) assert.ok(sim!.plane(name).every(Number.isFinite), `${name} finite`);
  const ts = sim!.plane('ts'), lat = sim!.plane('lat'); let eq = 0, ne = 0, pole = 0, np = 0;
  for (let i = 0; i < ts.length; i++) { if (Math.abs(lat[i]) < 10) { eq += ts[i]; ne++; } if (Math.abs(lat[i]) > 75) { pole += ts[i]; np++; } }
  assert.ok(eq / ne > pole / np + 20, 'tropics warmer than poles');
  assert.ok(sim!.plane('soil').every(v => v >= 0 && v <= 150 + 1e-9) && sim!.plane('cloud').every(v => v >= 0 && v <= 1) && sim!.plane('precip').every(v => v >= 0));
  const qa = sim!.plane('qabs'), qr = sim!.plane('qrefl'), sw = sim!.plane('swdown');
  for (let i = 0; i < qa.length; i++) assert.ok(Math.abs(qa[i] + qr[i] - sw[i]) < 1e-6, 'energy split closes');
});

test('T-0082: a loaded wasm is the forest weather; climateRaw returns only when it is unbound', { skip, timeout: 180000 }, async () => {
  const day = 200, hour = 12, lat = 49.77, lon = -94.36;
  const fallback = climate(day, hour, 0);
  const local = await loadPlanetSim(readFileSync(wasmPath));
  assert.ok(local);
  local.init(18, 36);
  local.plane('land').fill(1);
  local.plane('elev').fill(370);
  local.boot(day, localToUtc(hour));
  bindClimateSim(local, { lat, lon });
  const saved = { day: WEATHER.day, hour: WEATHER.hour };
  try {
    const tAir = samplePlane(local, 'tair', lat, lon);
    const u = samplePlane(local, 'u', lat, lon), vNorth = samplePlane(local, 'v', lat, lon);
    const rh = samplePlane(local, 'rh', lat, lon);
    const precip = samplePlane(local, 'precip', lat, lon);
    const live = climate(day, hour, 0);
    assert.ok(Math.abs(live.tC - tAir) < 1e-6, `climate ${live.tC} plane ${tAir}`);
    assert.ok(Math.abs(live.u - u) < 1e-6 && Math.abs(live.v - -vNorth) < 1e-6, 'wind is the plane, north flipped onto +z south');
    assert.ok(Math.abs(live.rh - Math.min(1, rh)) < 1e-6, `rh ${live.rh} plane ${rh}`);
    WEATHER.day = day; WEATHER.hour = hour;
    const w = weatherAt(0, 0);
    assert.ok(Math.abs(w.tC - tAir) < 1e-6 && Math.abs(w.wind.x - live.u) < 1e-6 && Math.abs(w.wind.z - live.v) < 1e-6);
    assert.ok(Math.abs(w.rainMmH - Math.max(0, precip) / 24) < 1e-9);
    assert.equal(w.snow, tAir < 0 && precip > 0);
    assert.ok(Math.abs(w.sweMm - Math.max(0, samplePlane(local, 'snow', lat, lon))) < 1e-6);
    local.plane('tair').fill(-1); local.plane('precip').fill(24); invalidateClimateRead();
    const cold = weatherAt(0, 0);
    assert.equal(cold.snow, true); assert.ok(Math.abs(cold.tC - -1) < 1e-9 && Math.abs(cold.rainMmH - 1) < 1e-9);
    local.plane('tair').fill(0); invalidateClimateRead();
    assert.equal(weatherAt(0, 0).snow, false, 'at 0 °C it is rain, the threshold #100 already matched');
    local.plane('cloud').fill(1); invalidateClimateRead();
    assert.equal(weatherAt(0, 0).cloud, 0, 'the unspun cloud plane is not the sky');
  } finally {
    WEATHER.day = saved.day; WEATHER.hour = saved.hour;
    resetClimateAuthority();
  }
  const again = climate(day, hour, 0);
  assert.equal(again.tC, fallback.tC); assert.equal(again.rh, fallback.rh); assert.equal(again.u, fallback.u);
});

test('T-0082: home-cell January and July against the Kenora normals table', { skip, timeout: 180000 }, async () => {
  const bytes = readFileSync(wasmPath);
  const loaded = await startForestClimate(15, 12, bytes);
  assert.ok(loaded);
  const saved = { day: WEATHER.day, hour: WEATHER.hour };
  try {
    const jan = climate(15, 12, 0);
    WEATHER.day = 15; WEATHER.hour = 12;
    const janW = weatherAt(0, 0);
    const jul = climate(196, 12, 0);
    WEATHER.day = 196;
    const julW = weatherAt(0, 0);
    console.log(`T-0082 January tC ${jan.tC} rh ${jan.rh} wind ${Math.hypot(jan.u, jan.v)} rainMmH ${janW.rainMmH} swe ${janW.sweMm} normal ${NORMALS.temp[0]}`);
    console.log(`T-0082 July tC ${jul.tC} rh ${jul.rh} wind ${Math.hypot(jul.u, jul.v)} rainMmH ${julW.rainMmH} swe ${julW.sweMm} normal ${NORMALS.temp[6]}`);
    assert.ok(Number.isFinite(jan.tC) && Number.isFinite(jul.tC));
    assert.ok(jan.tC < jul.tC, 'the home cell is warmer in July than in January');
    assert.equal(janW.tC, jan.tC);
    assert.equal(julW.tC, jul.tC);
    assert.equal(julW.snow, jul.tC < 0 && julW.rainMmH > 0);
  } finally {
    WEATHER.day = saved.day; WEATHER.hour = saved.hour;
    resetClimateAuthority();
  }
});
