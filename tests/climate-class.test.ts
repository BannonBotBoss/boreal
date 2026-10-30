// T-0094, roadmap step 8, issue #100. The class is an output of temperature, rain, and the seasons.
// Boundaries are Peel, Finlayson and McMahon 2007, Hydrol. Earth Syst. Sci. 11:1633, Table 1.
// doi:10.5194/hess-11-1633-2007. Issue #100's four names are not given numeric bounds, so they are not used.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { loadPlanetSim, type PlanetSim } from '../src/core/planetBudget';
import { FOREST_SPIN, weatherAtLatLon } from '../src/core/planetWeather';
import { NORMALS } from '../src/core/weather';
import {
  CLIMATE_MONTH_DAYS, CLIMATE_SAMPLE_DAY, KOPPEN_IDS, KOPPEN_NAME, PEEL, climateClass, climateYearAt,
  type KoppenId,
} from '../src/core/climateClass';

const wasmPath = new URL('../public/wasm/boreal_sim.wasm', import.meta.url);
const bytes = existsSync(wasmPath) ? readFileSync(wasmPath) : null;
const skip = bytes ? false : 'public/wasm/boreal_sim.wasm not built (npm run build:wasm)';

/** Peel et al. 2007 Table 2, Herberton Post Office. January first. Annual figures in the paper are 1146 mm and 19.9 °C. */
const HERBERTON_T = [23.2, 22.8, 21.9, 20.0, 17.9, 16.0, 15.5, 16.5, 18.6, 21.0, 22.4, 23.3];
const HERBERTON_P = [238.4, 229.7, 214.4, 86.0, 46.9, 33.3, 22.0, 18.2, 16.5, 25.3, 77.3, 137.9];

function fill(temp: number, precip: number) {
  return { temp: Array<number>(12).fill(temp), precip: Array<number>(12).fill(precip) };
}
function expectId(temp: number[], precip: number[], id: KoppenId) {
  const c = climateClass(temp, precip);
  assert.equal(c.id, id, `expected ${id}, got ${c.id} (mat ${c.matC}, map ${c.mapMm}, range ${c.seasonRangeC})`);
  assert.equal(c.name, KOPPEN_NAME[id]);
  assert.ok((KOPPEN_IDS as readonly string[]).includes(c.id));
}

test('the published thresholds are the Peel table, not round stand-ins', () => {
  assert.equal(KOPPEN_IDS.length, 30);
  assert.equal(Object.keys(KOPPEN_NAME).length, 30);
  assert.equal(PEEL.tropicalColdC, 18);
  assert.equal(PEEL.rainforestDryMm, 60);
  assert.equal(PEEL.monsoonOffsetMm, 100);
  assert.equal(PEEL.monsoonMapDivisor, 25);
  assert.equal(PEEL.aridFactor, 10);
  assert.equal(PEEL.desertFactor, 5);
  assert.equal(PEEL.hotMeanC, 18);
  assert.equal(PEEL.concentrationTenths, 7);
  assert.equal(PEEL.pthPerDegree, 2);
  assert.equal(PEEL.pthSummerAddMm, 28);
  assert.equal(PEEL.pthEvenAddMm, 14);
  assert.equal(PEEL.temperateHotAboveC, 10);
  assert.equal(PEEL.coldMonthAboveC, 0);
  assert.equal(PEEL.coldMonthBelowC, 18);
  assert.equal(PEEL.drySummerMm, 40);
  assert.equal(PEEL.drySummerWinterRatio, 3);
  assert.equal(PEEL.dryWinterSummerRatio, 10);
  assert.equal(PEEL.hotSummerC, 22);
  assert.equal(PEEL.warmSummerMonths, 4);
  assert.equal(PEEL.monthAboveC, 10);
  assert.equal(PEEL.veryColdBelowC, -38);
  assert.match(readFileSync('src/core/climateClass.ts', 'utf8'), /10\.5194\/hess-11-1633-2007/);
  // The paper's own check: Herberton 1146 mm is above 10 × (2 × 19.9 + 28) = 678 mm.
  assert.equal(10 * (2 * 19.9 + 28), 678);
  assert.ok(1146 > 678);
});

test('Herberton Post Office is Cwa, the station Peel used to show the summer-winter tie', () => {
  // Both dry-summer and dry-winter match. Summer (October–March) is wetter, so the letter is w, then a because the hottest month is 23.3 °C.
  const c = climateClass(HERBERTON_T, HERBERTON_P);
  assert.equal(c.id, 'Cwa');
  assert.equal(c.name, 'Temperate, dry winter, hot summer');
  assert.equal(c.seasonRangeC, 23.3 - 15.5);
});

test('arid is decided before tropical, and the 70% season changes the threshold', () => {
  const hot = fill(25, 100 / 12);
  expectId(hot.temp, hot.precip, 'BWh');
  expectId(fill(25, 400 / 12).temp, fill(25, 400 / 12).precip, 'BSh');
  expectId(fill(17, 100 / 12).temp, fill(17, 100 / 12).precip, 'BWk');
  expectId(fill(18, 100 / 12).temp, fill(18, 100 / 12).precip, 'BWh');

  const temp = [15, 15, 15, 25, 25, 25, 25, 25, 25, 15, 15, 15];
  const seasonal = [30, 30, 30, 70, 70, 70, 70, 70, 70, 30, 30, 30];
  const even = Array<number>(12).fill(50);
  expectId(temp, seasonal, 'BSh');
  expectId(temp, even, 'Cfa');
});

test('tropical, temperate, cold, and polar sit on the published boundaries', () => {
  expectId(fill(20, 100).temp, fill(20, 100).precip, 'Af');
  const monsoon = [50, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 200];
  expectId(fill(25, 0).temp, monsoon, 'Am');
  const savannah = [49, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 201];
  expectId(fill(25, 0).temp, savannah, 'Aw');

  const warm = [0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 15, 0.1, 0.1, 0.1, 0.1, 0.1];
  const freezing = [0, 0, 0, 0, 0, 0, 15, 0, 0, 0, 0, 0];
  const rain = Array<number>(12).fill(100);
  expectId(warm, rain, 'Cfc');
  expectId(freezing, rain, 'Dfc');

  // A month at exactly 10 °C is not "above 10", so four such months do not make a warm summer.
  const counted = [11, 10, 10, 10, 10, 0, 0, 0, 0, 0, 0, 0];
  expectId(counted, rain, 'Dfc');

  const veryCold = [-40, 15, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40];
  const at38 = veryCold.map((t, i) => i === 1 ? 15 : -38);
  expectId(veryCold, rain, 'Dfd');
  expectId(at38, rain, 'Dfc');

  // Hot summer outranks a very cold winter.
  const hotWinter = [23, -40, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  expectId(hotWinter, rain, 'Dfa');

  expectId(fill(10, 100).temp, fill(10, 100).precip, 'ET');
  expectId(fill(0, 100).temp, fill(0, 100).precip, 'EF');
  expectId(fill(10.1, 100).temp, fill(10.1, 100).precip, 'Cfb');
});

test('a dry summer and a dry winter use the month tests, and an equal-temperature tie does not invent a summer', () => {
  const temp = [10, 10, 10, 24, 24, 24, 24, 24, 24, 10, 10, 10];
  const drySummer = [80, 80, 80, 10, 100, 100, 100, 100, 100, 80, 80, 80];
  const dryWinter = [5, 50, 50, 100, 100, 100, 100, 100, 100, 50, 50, 50];
  expectId(temp, drySummer, 'Csa');
  expectId(temp, dryWinter, 'Cwa');

  // Both blocks are 15 °C, so neither is summer. 350 mm of the 500 mm sits in April–September (exactly 70%).
  // Applying the summer threshold anyway would make this a cold steppe. The tie does not.
  const tiedTemp = fill(15, 0).temp;
  const tiedRain = [25, 25, 25, 58, 58, 58, 58, 58, 60, 25, 25, 25];
  expectId(tiedTemp, tiedRain, 'Cfb');
});

test('twelve finite months are required', () => {
  assert.throws(() => climateClass([0], [0]), /twelve monthly/);
  assert.throws(() => climateClass(Array(12).fill(Number.NaN), Array(12).fill(0)), /finite/);
});

test('behaviour code does not read the class id', () => {
  const walk = (dir: string): string[] => readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : path.endsWith('.ts') ? [path] : [];
  });
  const behaviour = [
    ...walk('src/core/needs'),
    'src/core/animalBehavior.ts',
    'src/core/agent.ts',
    'src/core/plan.ts',
    'src/core/wolfModes.ts',
    'src/core/behaviourData.ts',
    'src/core/behaviourPose.ts',
    'src/core/sim/index.ts',
  ];
  const readers = behaviour.filter(path => /climateClass|KOPPEN_/.test(readFileSync(path, 'utf8')));
  assert.deepEqual(readers, []);
});

test('surface colours and the picture do not read the class', () => {
  const walk = (dir: string): string[] => readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : path.endsWith('.ts') ? [path] : [];
  });
  const picture = ['src/main.ts', ...walk('src/render'), ...walk('src/world'), ...walk('src/ui')];
  const readers = picture.filter(path => readFileSync(path, 'utf8').includes('climateClass'));
  assert.deepEqual(readers, []);
  const src = readFileSync('src/core/climateClass.ts', 'utf8');
  assert.equal(src.includes('surfaceColour'), false);
  assert.equal(src.includes('BAND_COLOR'), false);
  assert.equal(src.includes('applySurfaceBands'), false);
});

function cellLat(nlat: number, r: number) { return -90 + (r + 0.5) * 180 / nlat; }
function cellLon(nlon: number, c: number) { return -180 + (c + 0.5) * 360 / nlon; }

const DESERT = new Set(['BWh', 'BWk']);

/**
 * The reader this task replaces. One existing 6 h step, then that mm/day held for CLIMATE_MONTH_DAYS.
 * It is here so the test can record the class before the month is accumulated. It is not the classifier.
 */
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

test('Kenora station normals are Dfb, and a July of 27.5 °C on that rain is Dfa', () => {
  // NORMALS is the game's Kenora A monthly table (ECCC 1981–2010, tagged verify in weather.ts).
  // July there is 19.2 °C. climate_seed.rs cites the same station, climate id 6034075, July 19.7 °C and January −16.0 °C.
  // Neither July reaches Peel's 22 °C hot-summer line. The model's July does. This test does not change the model temperature.
  const station = climateClass(NORMALS.temp, NORMALS.precip);
  assert.equal(station.id, 'Dfb');
  const atPublishedJuly = NORMALS.temp.slice();
  atPublishedJuly[6] = 19.7;
  assert.equal(climateClass(atPublishedJuly, NORMALS.precip).id, 'Dfb');
  const atModelJuly = NORMALS.temp.slice();
  atModelJuly[6] = 27.5;
  const hot = climateClass(atModelJuly, NORMALS.precip);
  assert.equal(hot.id, 'Dfa');
  assert.ok(Math.max(...atModelJuly) >= PEEL.hotSummerC);
  assert.ok(Math.max(...atPublishedJuly) < PEEL.hotSummerC);
});

test('the planet year feeds the class: the sea shrinks the seasons, and the ridge wets the windward side', { skip, timeout: 180000 }, async () => {
  const s = await loadPlanetSim(bytes!) as PlanetSim;
  assert.ok(s);
  const nlat = 18, nlon = 36;
  s.init(nlat, nlon);
  const row = 13;
  const lat = cellLat(nlat, row);
  assert.equal(lat, 45);
  s.setLand((la, lon) => {
    const onRidge = Math.abs(la - lat) < 12 && lon > 10 && lon < 70;
    const crest = Math.exp(-((lon - 40) * (lon - 40)) / (2 * 6 * 6));
    const land = lon > 0 ? 1 : 0;
    return { land, elev: land ? (onRidge ? 100 + 1800 * crest : 100) : 0 };
  });
  const waterLon = cellLon(nlon, 17);
  const westLon = cellLon(nlon, 21);
  const eastLon = cellLon(nlon, 22);
  const inlandLon = cellLon(nlon, 25);
  assert.ok(waterLon < 0 && westLon > 0 && eastLon > westLon && inlandLon > 70);
  const waterBefore = heldRateYear(s, lat, waterLon);
  const water = climateYearAt(s, lat, waterLon);
  const inland = climateYearAt(s, lat, inlandLon);
  const west = climateYearAt(s, lat, westLon);
  const east = climateYearAt(s, lat, eastLon);
  s.seed(196, 12);
  s.step(FOREST_SPIN.dtS);
  const wind = weatherAtLatLon(lat, westLon, s)!;
  const windward = wind.u >= 0 ? west : east;
  const leeward = wind.u >= 0 ? east : west;
  console.log(`T-0094 ${lat}N u=${wind.u.toFixed(2)} ocean before ${waterBefore.climate.id} ${waterBefore.climate.mapMm.toFixed(1)} mm, after ${water.climate.id} ${water.climate.mapMm.toFixed(1)} mm, July ${water.tempC[6].toFixed(2)} °C, range ${water.climate.seasonRangeC.toFixed(2)} K; inland after ${inland.climate.id} ${inland.climate.mapMm.toFixed(1)} mm range ${inland.climate.seasonRangeC.toFixed(2)} K; windward ${windward.climate.mapMm.toFixed(1)} mm ${windward.climate.id}; leeward ${leeward.climate.mapMm.toFixed(1)} mm ${leeward.climate.id}`);
  assert.equal(waterBefore.climate.id, 'BWk');
  assert.equal(water.climate.id, 'Csb');
  assert.ok(!DESERT.has(water.climate.id));
  assert.ok(water.climate.mapMm > waterBefore.climate.mapMm);
  assert.deepEqual(water.tempC, waterBefore.tempC);
  assert.ok(Math.abs(wind.u) > 0, `expected a wind at 45N, u=${wind.u}`);
  assert.ok(water.climate.seasonRangeC < inland.climate.seasonRangeC, `sea ${water.climate.seasonRangeC} inland ${inland.climate.seasonRangeC}`);
  assert.ok(windward.climate.mapMm > leeward.climate.mapMm, `windward ${windward.climate.mapMm} leeward ${leeward.climate.mapMm}`);
  for (const year of [water, inland, windward, leeward]) {
    assert.equal(climateClass(year.tempC, year.precipMm).id, year.climate.id);
    assert.ok((KOPPEN_IDS as readonly string[]).includes(year.climate.id));
  }
  assert.equal(CLIMATE_SAMPLE_DAY.length, 12);
  assert.equal(CLIMATE_MONTH_DAYS * 12, 365);
});

// The Kenora year on the one-degree forest grid runs for over ten minutes, so it lives in tests/slow/ (npm run test:slow, its own CI job). Issue #198.
