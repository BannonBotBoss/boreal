// T-0082: one latitude/longitude read of the Rust grid is the forest weather while wasm is loaded.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { loadPlanetSim, type PlanetSim } from '../src/core/planetBudget';
import { NORMALS, WEATHER, solar, updateWeather, weatherAt, windAt } from '../src/core/weather';
import { FOREST_NLAT, FOREST_SPIN, bindPlanetWeather, notePlanetClockOwner, planetLandSample, utcHourFromLocal, weatherAtLatLon } from '../src/core/planetWeather';
import { SPINUP, globeLandSample } from '../src/world/globe/planetLayers';
import { bootGlobe } from '../src/world/globe/bootOrder';
import { planetFor, toLatLon } from '../src/world/globe/planet';
import { WORLD_SEED } from '../src/core/world';

const wasmPath = new URL('../public/wasm/boreal_sim.wasm', import.meta.url);
const bytes = existsSync(wasmPath) ? readFileSync(wasmPath) : null;
const skip = bytes ? false : 'public/wasm/boreal_sim.wasm not built (npm run build:wasm)';
async function fresh(): Promise<PlanetSim> {
  const sim = await loadPlanetSim(bytes!);
  assert.ok(sim);
  return sim;
}
const savedWeather = () => ({ day: WEATHER.day, hour: WEATHER.hour, steps: WEATHER.steps, on: WEATHER.on });
function restore(s: ReturnType<typeof savedWeather>) {
  bindPlanetWeather(null);
  notePlanetClockOwner('globe'); // follow only runs while the forest owns the clock
  WEATHER.day = s.day; WEATHER.hour = s.hour; WEATHER.steps = s.steps; WEATHER.on = s.on;
}

test('forest spin matches the globe spin, and both land samples are one mask', () => {
  assert.deepEqual(FOREST_SPIN, SPINUP);
  assert.equal(FOREST_NLAT, 45);
  const planet = planetFor(WORLD_SEED), a = planetLandSample(planet), b = globeLandSample(planet);
  for (const [lat, lon] of [[49.77, -94.5], [0, 10], [-42, 120], [80, -179]] as const) assert.deepEqual(a(lat, lon), b(lat, lon));
});

test('weatherAtLatLon is the forest weather, including a point that is not the player', { skip }, async () => {
  const sim = await fresh();
  sim.init(4, 8);
  const fill = (name: 'tair' | 'rh' | 'u' | 'v' | 'precip' | 'snow' | 'q' | 'cloud' | 'soil') => sim.plane(name);
  fill('tair').fill(41); fill('rh').fill(0.5); fill('u').fill(3); fill('v').fill(4);
  fill('precip').fill(48); fill('snow').fill(30); fill('q').fill(0.004); fill('cloud').fill(0.25); fill('soil').fill(75);
  const snap = savedWeather();
  bindPlanetWeather(sim);
  try {
    const anywhere = weatherAtLatLon(-12.5, 40);
    assert.ok(anywhere);
    assert.equal(anywhere.tC, 41);
    assert.equal(anywhere.rh, 0.5);
    assert.equal(anywhere.u, 3);
    assert.equal(anywhere.v, 4);
    assert.equal(anywhere.precipMmDay, 48);
    assert.equal(anywhere.precipMmH, 2);
    assert.equal(anywhere.snow, false);
    assert.equal(anywhere.sweMm, 30);
    assert.equal(anywhere.q, 0.004);
    assert.equal(anywhere.cloud, 0.25);
    const player = weatherAt(0, 0);
    assert.equal(player.tC, 41, 'a sentinel the Kenora column cannot produce');
    assert.equal(player.rainMmH, 2);
    assert.equal(player.snow, false);
    assert.equal(player.sweMm, 30);
    assert.equal(player.wind.x, 3);
    assert.equal(player.wind.z, -4);
    assert.deepEqual(windAt(0, 10, 0), { x: 3, y: 0, z: -4 });
    WEATHER.on = false;
    assert.notEqual(weatherAt(0, 0).tC, 41, 'the weather toggle still falls back to the climatology');
    WEATHER.on = true;
    assert.equal(weatherAt(0, 0).tC, 41);
    const low = windAt(0, 0.6, 0);
    assert.ok(low.x > 0 && low.x < 3 && low.z < 0 && low.z > -4);
    fill('tair').fill(-8); fill('precip').fill(24); fill('snow').fill(12);
    const cold = weatherAtLatLon(70, 10);
    assert.equal(cold!.snow, true);
    assert.equal(cold!.sweMm, 12);
    assert.equal(cold!.precipMmH, 1);
    assert.equal(weatherAt(12, -8).snow, true);
    const steps = WEATHER.steps;
    updateWeather(1, 12, 15, 12);
    assert.equal(WEATHER.day, 15);
    assert.equal(WEATHER.hour, 12);
    assert.equal(WEATHER.steps, steps, 'the Stam column does not step while the planet drives');
    assert.equal(sim.plane('tair')[0], -8);
  } finally { restore(snap); }
});

test('cell centres stay on that cell; the date line and the poles stay finite', { skip }, async () => {
  const sim = await fresh();
  const nlat = 4, nlon = 8;
  sim.init(nlat, nlon);
  const t = sim.plane('tair'); t.fill(0);
  const r = 2, c = 3;
  t[r * nlon + c] = 41;
  const lat = -90 + (r + 0.5) * 180 / nlat, lon = -180 + (c + 0.5) * 360 / nlon;
  assert.equal(weatherAtLatLon(lat, lon, sim)!.tC, 41);
  t.fill(1);
  const east = weatherAtLatLon(0, 180, sim), west = weatherAtLatLon(0, -180, sim);
  assert.equal(east!.tC, west!.tC);
  assert.equal(east!.lonDeg, -180);
  for (const [la, lo] of [[90, 0], [-90, 179], [91, 400], [-100, -190]] as const) {
    const w = weatherAtLatLon(la, lo, sim);
    assert.ok(w && Number.isFinite(w.tC) && Number.isFinite(w.lonDeg));
  }
  assert.equal(weatherAtLatLon(0, 0, null), null);
});

test('Kenora January and July air temperature is the Rust plane, recorded against ECCC normals', { skip, timeout: 120000 }, async () => {
  const planet = planetFor(WORLD_SEED);
  const ll = toLatLon(planet.fromLocal(0, 0));
  const lat = ll.lat * 180 / Math.PI, lon = ll.lon * 180 / Math.PI;
  const snap = savedWeather();
  const rows: { day: number; label: string; game: number; normals: number; matchesNormals: boolean }[] = [];
  try {
    for (const [day, label, normals] of [[15, 'January', NORMALS.temp[0]], [196, 'July', NORMALS.temp[6]]] as const) {
      const sim = await fresh();
      const utc = utcHourFromLocal(12);
      const back = FOREST_SPIN.steps * FOREST_SPIN.dtS / 86400;
      const start = ((day - back - 1) % 365 + 365) % 365 + 1;
      bootGlobe(sim, FOREST_NLAT, FOREST_NLAT * 2, planetLandSample(planet), start, utc);
      if (day === 15) {
        const toa = sim.plane('toa'), la = sim.plane('lat'), lo = sim.plane('lon');
        let worst = 0;
        for (let i = 0; i < sim.n; i += 17) worst = Math.max(worst, Math.abs(toa[i] - solar(start, utc, la[i], lo[i], 0).toa));
        assert.ok(worst < 1e-6, `toa plane vs solar() ${worst}`);
      }
      for (let i = 0; i < FOREST_SPIN.steps; i++) sim.step(FOREST_SPIN.dtS);
      bindPlanetWeather(sim);
      const point = weatherAtLatLon(lat, lon)!;
      const player = weatherAt(0, 0);
      assert.equal(player.tC, point.tC);
      assert.equal(player.rh, point.rh);
      assert.equal(player.sweMm, point.sweMm);
      assert.ok(Number.isFinite(player.tC));
      rows.push({ day, label, game: player.tC, normals, matchesNormals: Math.abs(player.tC - normals) < 0.05 });
    }
    console.log('T-0082 Kenora means ' + JSON.stringify(rows));
  } finally { restore(snap); }
});

test('a forest-owned clock re-spins on a new date and holds still inside the hour window', { skip }, async () => {
  const sim = await fresh();
  sim.init(4, 8);
  sim.boot(10, utcHourFromLocal(12));
  const snap = savedWeather();
  bindPlanetWeather(sim);
  notePlanetClockOwner('forest');
  try {
    sim.plane('tair').fill(41);
    updateWeather(1, 12, 10, 12.2);
    assert.equal(sim.plane('tair')[0], 41, 'a fifth of an hour does not reboot');
    updateWeather(1, 12, 40, 12);
    assert.ok(Math.abs(sim.day - 40) < 1e-6, `day ${sim.day}`);
    assert.ok(sim.plane('tair')[0] !== 41, 'the new date is a new climate seed');
    const ll = toLatLon(planetFor(WORLD_SEED).fromLocal(0, 0));
    assert.equal(weatherAt(0, 0).tC, weatherAtLatLon(ll.lat * 180 / Math.PI, ll.lon * 180 / Math.PI)!.tC);
  } finally { restore(snap); }
});
