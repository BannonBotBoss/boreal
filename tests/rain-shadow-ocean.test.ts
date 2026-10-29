// T-0085: the sea softens the seasons, and a ridge is wetter on the windward side.
// Both are read through weatherAtLatLon, the one planet-weather query (T-0082).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { loadPlanetSim, type PlanetSim } from '../src/core/planetBudget';
import { FOREST_NLAT, FOREST_SPIN, landSampleFromSurface, planetLandSample, utcHourFromLocal, weatherAtLatLon } from '../src/core/planetWeather';
import { bootGlobe } from '../src/world/globe/bootOrder';
import { planetFor, toLatLon } from '../src/world/globe/planet';
import { WORLD_SEED } from '../src/core/world';

const wasmPath = new URL('../public/wasm/boreal_sim.wasm', import.meta.url);
const bytes = existsSync(wasmPath) ? readFileSync(wasmPath) : null;
const skip = bytes ? false : 'public/wasm/boreal_sim.wasm not built (npm run build:wasm)';

function cellLat(nlat: number, r: number) { return -90 + (r + 0.5) * 180 / nlat; }
function cellLon(nlon: number, c: number) { return -180 + (c + 0.5) * 360 / nlon; }

async function sim(): Promise<PlanetSim> {
  const s = await loadPlanetSim(bytes!);
  assert.ok(s);
  return s;
}

test('weatherAtLatLon: windward rain is greater than leeward rain on a test ridge', { skip, timeout: 120000 }, async () => {
  const s = await sim();
  const nlat = 18, nlon = 36;
  s.init(nlat, nlon);
  const row = 13; // 45°N, inside the westerlies
  s.setLand((lat, lon) => {
    const onRidge = Math.abs(lat - cellLat(nlat, row)) < 12 && Math.abs(lon) < 40;
    const crest = Math.exp(-(lon * lon) / (2 * 6 * 6));
    return { land: 1, elev: onRidge ? 100 + 1800 * crest : 100 };
  }).seed(196, 12);
  for (let i = 0; i < 4; i++) s.step(6 * 3600);
  const lat = cellLat(nlat, row);
  const west = weatherAtLatLon(lat, cellLon(nlon, 17), s)!; // lon −5°, windward of the crest at 0° when the wind is from the west
  const east = weatherAtLatLon(lat, cellLon(nlon, 18), s)!; // lon +5°, leeward
  assert.ok(west.u > 0, `expected westerlies at 45N, u=${west.u}`);
  console.log(`T-0085 ridge u=${west.u.toFixed(2)} windward ${west.precipMmDay.toFixed(3)} mm/day leeward ${east.precipMmDay.toFixed(3)} ratio ${east.precipMmDay > 0 ? (west.precipMmDay / east.precipMmDay).toFixed(2) : 'lee-dry'}`);
  assert.ok(west.precipMmDay > east.precipMmDay, `windward ${west.precipMmDay} leeward ${east.precipMmDay}`);
});

test('weatherAtLatLon: seasonal range grows with distance from the sea', { skip, timeout: 120000 }, async () => {
  const s = await sim();
  // Half a degree, so the first land cell is a fraction of a boundary-layer fetch from the water, not already inland.
  const nlat = 36, nlon = 720;
  s.init(nlat, nlon);
  // Open water west of 0° longitude. Land to the east, flat, so the lapse does not change the range.
  s.setLand((_lat, lon) => ({ land: lon > 0 ? 1 : 0, elev: lon > 0 ? 50 : 0 }));
  const row = 26; // near 45°N
  const lat = cellLat(nlat, row);
  const coastC = 360; // centre longitude 0.25°, the first land column
  const inlandC = 400; // about 20° east of that shore
  assert.ok(cellLon(nlon, coastC) > 0 && cellLon(nlon, coastC) < 1);
  assert.ok(cellLon(nlon, inlandC) > cellLon(nlon, coastC) + 10);
  const read = (day: number, c: number) => {
    s.seed(day, 12);
    return weatherAtLatLon(lat, cellLon(nlon, c), s)!.tC;
  };
  const range = (c: number) => read(196, c) - read(15, c);
  const coast = range(coastC);
  const inland = range(inlandC);
  const water = range(300); // open water, west of the shore
  console.log(`T-0085 July−January at ${lat}N: water ${water.toFixed(2)} K, coast ${coast.toFixed(2)} K, inland ${inland.toFixed(2)} K`);
  assert.ok(water < coast, `water ${water} should be milder than the coastal land cell ${coast}`);
  assert.ok(coast < inland, `coast ${coast} should be milder than inland ${inland}`);
});

test('an inland lake is land, and the ocean is water', () => {
  assert.deepEqual(landSampleFromSurface({ h: -900, kind: 'ocean', level: 0 }), { land: 0, elev: 0 });
  assert.deepEqual(landSampleFromSurface({ h: -4, kind: 'lake', level: 18 }), { land: 1, elev: 18 });
  assert.deepEqual(landSampleFromSurface({ h: 370, kind: '', level: 0 }), { land: 1, elev: 370 });
  const planet = planetFor(WORLD_SEED);
  const mask = planetLandSample(planet);
  const home = toLatLon(planet.fromLocal(0, 0));
  const at = mask(home.lat * 180 / Math.PI, home.lon * 180 / Math.PI);
  assert.equal(at.land, 1, 'the forest stand is land');
  assert.ok(at.elev > 0);
});

test('Kenora January stays below freezing with snow, and is no warmer than the grid before the sea term', { skip, timeout: 180000 }, async () => {
  // Main, before this branch's sea term, was −6.36 °C at the stand with snow falling (tasks/evidence/T-0085/observations-before.json).
  const mainJanuary = -6.36;
  const planet = planetFor(WORLD_SEED);
  const ll = toLatLon(planet.fromLocal(0, 0));
  const lat = ll.lat * 180 / Math.PI, lon = ll.lon * 180 / Math.PI;
  const s = await sim();
  const read = async (day: number) => {
    const utc = utcHourFromLocal(12);
    const back = FOREST_SPIN.steps * FOREST_SPIN.dtS / 86400;
    const start = ((day - back - 1) % 365 + 365) % 365 + 1;
    bootGlobe(s, FOREST_NLAT, FOREST_NLAT * 2, planetLandSample(planet), start, utc);
    for (let i = 0; i < FOREST_SPIN.steps; i++) s.step(FOREST_SPIN.dtS);
    return weatherAtLatLon(lat, lon, s)!;
  };
  const jan = await read(15);
  const jul = await read(196);
  console.log(`T-0085 Kenora stand January ${jan.tC.toFixed(2)} °C snow ${jan.snow} precip ${jan.precipMmDay.toFixed(3)} mm/day swe ${jan.sweMm.toFixed(1)}; July ${jul.tC.toFixed(2)} °C snow ${jul.snow}`);
  assert.ok(jan.tC < 0, `January ${jan.tC} should be below freezing`);
  assert.ok(jan.tC <= mainJanuary, `January ${jan.tC} should be no warmer than main's ${mainJanuary}`);
  assert.equal(jan.snow, true);
  assert.ok(jan.precipMmDay > 0);
  assert.ok(jul.tC > 8 && jul.tC < 35, `July ${jul.tC} should be a summer temperature`);
  assert.equal(jul.snow, false);
});
