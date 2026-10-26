// T-0085: the sea softens the seasons, and a ridge is wetter on the windward side.
// Both are read through weatherAtLatLon, the one planet-weather query (T-0082).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { loadPlanetSim, type PlanetSim } from '../src/core/planetBudget';
import { weatherAtLatLon } from '../src/core/planetWeather';

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
  const nlat = 18, nlon = 36;
  s.init(nlat, nlon);
  // Open water west of 0° longitude. Land to the east, flat, so the lapse does not change the range.
  s.setLand((_lat, lon) => ({ land: lon > 0 ? 1 : 0, elev: lon > 0 ? 50 : 0 }));
  const row = 13;
  const lat = cellLat(nlat, row);
  const coastC = 18; // lon = -180 + 18.5*10 = 5°, the first land cells are c=18 (lon 5°)
  const inlandC = 24; // lon = 65°
  assert.ok(cellLon(nlon, coastC) > 0 && cellLon(nlon, inlandC) > cellLon(nlon, coastC));
  const read = (day: number, c: number) => {
    s.seed(day, 12);
    return weatherAtLatLon(lat, cellLon(nlon, c), s)!.tC;
  };
  const range = (c: number) => read(196, c) - read(15, c);
  const coast = range(coastC);
  const inland = range(inlandC);
  const water = range(10); // lon = -180 + 10.5*10 = -75°, open water
  console.log(`T-0085 July−January at ${lat}N: water ${water.toFixed(2)} K, coast ${coast.toFixed(2)} K, inland ${inland.toFixed(2)} K`);
  assert.ok(water < coast, `water ${water} should be milder than the coastal land cell ${coast}`);
  assert.ok(coast < inland, `coast ${coast} should be milder than inland ${inland}`);
});
