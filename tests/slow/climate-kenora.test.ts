// T-0094 (issue #100), split out for issue #198: the Kenora cell's accumulated climate year.
// It boots the one-degree forest grid and steps a whole year, over ten minutes on CI, so it is not in `npm test`.
// Run it with `npm run test:slow`; CI runs it in the parallel `slow` job.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { loadPlanetSim, type PlanetSim } from '../../src/core/planetBudget';
import { FOREST_NLAT, FOREST_SPIN, planetLandSample, weatherAtLatLon } from '../../src/core/planetWeather';
import { bootGlobe } from '../../src/world/globe/bootOrder';
import { planetFor, toLatLon } from '../../src/world/globe/planet';
import { WORLD_SEED } from '../../src/core/world';
import { CLIMATE_MONTH_DAYS, CLIMATE_SAMPLE_DAY, PEEL, climateClass, climateYearAt } from '../../src/core/climateClass';

const wasmPath = new URL('../../public/wasm/boreal_sim.wasm', import.meta.url);
const bytes = existsSync(wasmPath) ? readFileSync(wasmPath) : null;
const skip = bytes ? false : 'public/wasm/boreal_sim.wasm not built (npm run build:wasm)';
const DESERT = new Set(['BWh', 'BWk']);

function heldRateYear(sim: PlanetSim, lat: number, lon: number) {
  const tempC: number[] = [];
  const precipMm: number[] = [];
  for (const day of CLIMATE_SAMPLE_DAY) {
    sim.seed(day, 12);
    sim.step(FOREST_SPIN.dtS);
    const w = weatherAtLatLon(lat, lon, sim);
    if (!w) throw new Error('held-rate year needs a booted planet grid');
    tempC.push(w.tC);
    precipMm.push(w.precipMmDay * CLIMATE_MONTH_DAYS);
  }
  return { tempC, precipMm, climate: climateClass(tempC, precipMm) };
}

test('the Kenora cell is not a desert once the month is accumulated', { skip, timeout: 2400000 }, async () => {
  const s = await loadPlanetSim(bytes!) as PlanetSim;
  assert.ok(s);
  const planet = planetFor(WORLD_SEED);
  const home = toLatLon(planet.fromLocal(0, 0));
  const lat = home.lat * 180 / Math.PI;
  const lon = home.lon * 180 / Math.PI;
  // The one-degree forest grid is the grid whose cell centre on this stand is land. Coarser centres fall in the ocean.
  bootGlobe(s, FOREST_NLAT, FOREST_NLAT * 2, planetLandSample(planet), CLIMATE_SAMPLE_DAY[6], 12);
  const before = heldRateYear(s, lat, lon);
  const after = climateYearAt(s, lat, lon);
  const july = after.tempC[6];
  console.log(`T-0094 Kenora ${lat.toFixed(2)}N ${lon.toFixed(2)}E before ${before.climate.id} ${before.climate.mapMm.toFixed(1)} mm July ${before.tempC[6].toFixed(2)} °C; after ${after.climate.id} ${after.climate.mapMm.toFixed(1)} mm July ${july.toFixed(2)} °C months ${after.precipMm.map(v => v.toFixed(1)).join(',')}`);
  assert.equal(before.climate.id, 'Dfa');
  assert.ok(!DESERT.has(before.climate.id));
  assert.ok(!DESERT.has(after.climate.id), `accumulated Kenora class ${after.climate.id} is still desert`);
  assert.deepEqual(after.tempC, before.tempC);
  // Environment and Climate Change Canada 1981–2010, Kenora A, climate id 6034075: July 19.7 °C (climate_seed.rs).
  // The class is not corrected to that station. Peel’s hot summer is a hottest month at or above 22 °C, so 27.5 °C is not Dfb.
  assert.ok(july > 27 && july < 28, `July ${july} should stay about 27.5 °C`);
  assert.ok(july >= PEEL.hotSummerC);
  assert.notEqual(after.climate.id, 'Dfb');
  assert.equal(after.climate.id[0], 'D');
  assert.equal(after.climate.id[2], 'a');
});
