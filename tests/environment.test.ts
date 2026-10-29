// T-0089 (issues #111, #110): one environment record filled from the existing weather reads, and the planet shell's
// cloud drift and Mie haze driven by it. No second wind and no climate is computed here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { PlanetSim } from '../src/core/planetBudget';
import { WEATHER, SITE, solar, weatherAt } from '../src/core/weather';
import { bindPlanetWeather, weatherAtLatLon } from '../src/core/planetWeather';
import { observationRecord } from '../src/core/observation';
import { SCALE_BOUNDS, clockRate, gameSecondsPerWorldSecond, setClockRate } from '../src/core/worldClock';
import { phenology } from '../src/core/treeSpecies';
import { WIND_UNIFORMS } from '../src/render/trees';
import { ENV, ENV_FORCE, ENV_UNIFORMS, GAME_SEC_PER_WORLD_SEC, fillEnvironmentGlobe, fillEnvironmentGround } from '../src/render/environment';
import { CLOUDS, DRIFT_HOLD, HYGRO, cloudDriftRate, driftWeight, mieGrowth, stepCloudDrift } from '../src/world/globe/atmosphere';
import { PLANET } from '../src/world/globe/planet';

/** A grid stand-in with the PlanetSim shape weatherAtLatLon reads (no wasm needed). */
function fakeSim(values: Record<string, number>): PlanetSim {
  const nlat = 4, nlon = 8, n = nlat * nlon, planes = new Map<string, Float64Array>();
  return { n, nlat, nlon, plane: (name: string) => { if (!planes.has(name)) planes.set(name, new Float64Array(n).fill(values[name] ?? 0)); return planes.get(name)!; } } as unknown as PlanetSim;
}
const humid = { tair: 12, rh: 0.9, q: 0.008, u: 15, v: -4, precip: 24, snow: 0, snowfrac: 0, cloud: 0.7, pressure: 100500, soil: 80, ice: 0 };

test('globe record equals weatherAtLatLon at the sub-point, plus phenology, solar and the observation rate', () => {
  const sim = fakeSim(humid), day = 200, hour = 14, lat = 49.77, lon = -94.5;
  const savedRate = clockRate(); setClockRate(37);
  try {
    assert.equal(fillEnvironmentGlobe(lat, lon, day, hour, sim), true);
    const w = weatherAtLatLon(lat, lon, sim)!, ph = phenology(day);
    assert.equal(ENV.source, 'globe');
    assert.equal(ENV.tC, w.tC); assert.equal(ENV.rh, w.rh); assert.equal(ENV.rainMmH, w.precipMmH);
    assert.equal(ENV.windE, w.u); assert.equal(ENV.windN, w.v); assert.equal(ENV.latDeg, w.latDeg);
    assert.deepEqual(ENV.season, ph);
    assert.equal(ENV.sunlight, solar(day, hour, lat, lon, SITE.tz).toa);
    assert.equal(ENV.rate, clockRate()); assert.ok(Math.abs(ENV.rate - 37) < 1e-6, `rate ${ENV.rate}`);
    // uniforms carry the same numbers
    assert.equal(ENV_UNIFORMS.uEnvTemp.value, w.tC); assert.equal(ENV_UNIFORMS.uEnvHumidity.value, w.rh);
    assert.equal(ENV_UNIFORMS.uEnvRain.value, w.precipMmH); assert.equal(ENV_UNIFORMS.uEnvRate.value, ENV.rate);
    assert.equal(ENV_UNIFORMS.uEnvSeason.value.x, ph.colour); assert.equal(ENV_UNIFORMS.uEnvSeason.value.y, ph.off);
    assert.equal(ENV_UNIFORMS.uEnvSun.value, ENV.sunlight);
  } finally { setClockRate(savedRate); }
});

test('no grid booted: the globe record says so and keeps no stale wind', () => {
  fillEnvironmentGlobe(10, 10, 200, 12, fakeSim(humid));
  assert.equal(fillEnvironmentGlobe(10, 10, 200, 12, null), false);
  assert.equal(ENV.source, null);
});

test('ground record equals weatherAt at the observation point (east = +x, north = -z)', () => {
  bindPlanetWeather(null);
  const o = observationRecord(), w = weatherAt(o.x, o.z);
  fillEnvironmentGround();
  assert.equal(ENV.source, 'ground');
  assert.equal(ENV.tC, w.tC); assert.equal(ENV.rh, w.rh); assert.equal(ENV.rainMmH, w.rainMmH);
  assert.equal(ENV.windE, w.wind.x); assert.equal(ENV.windN, -w.wind.z);
  assert.deepEqual(ENV.season, phenology(WEATHER.day));
  assert.equal(ENV.sunlight, solar(WEATHER.day, WEATHER.hour).toa);
});

test('ENV_UNIFORMS shares the trees wind objects: no second wind', () => {
  assert.equal(ENV_UNIFORMS.uWindDir, WIND_UNIFORMS.uWindDir);
  assert.equal(ENV_UNIFORMS.uWindAmp, WIND_UNIFORMS.uWindAmp);
  assert.ok(!('uEnvWind' in ENV_UNIFORMS));
});

test('dev force overrides only the named fields', () => {
  ENV_FORCE.rh = 0.2;
  try { fillEnvironmentGlobe(49, -94, 200, 12, fakeSim(humid)); assert.equal(ENV.rh, 0.2); assert.equal(ENV.windE, humid.u); }
  finally { delete ENV_FORCE.rh; }
});

test('drift angle after 1 game hour = u x 3600 / (R cos lat)', () => {
  const R = PLANET.radius;
  for (const [u, lat] of [[15, 49.77], [-8, 0], [30, -60]]) {
    const want = u * 3600 / (R * Math.cos(lat * Math.PI / 180));
    assert.ok(Math.abs(cloudDriftRate(u, lat, R) * 3600 - want) < 1e-9);
    // integrated over one game hour of world seconds in 60 frames at rate 1
    let ang = 0; const dW = 3600 / GAME_SEC_PER_WORLD_SEC / 60;
    for (let i = 0; i < 60; i++) ang = stepCloudDrift(ang, dW, u, lat, R, 1);
    assert.ok(Math.abs(ang - want) < 1e-9, `${ang} vs ${want}`);
  }
  assert.equal(GAME_SEC_PER_WORLD_SEC, gameSecondsPerWorldSecond); assert.equal(GAME_SEC_PER_WORLD_SEC, 12);
});

test('drift holds above the Behavioral scale and blends across its band', () => {
  const edge = SCALE_BOUNDS.find(b => b.above === 'ecological')!; // the one clock's band, not a copy
  assert.equal(DRIFT_HOLD.exit, edge.exit); assert.equal(DRIFT_HOLD.enter, edge.enter);
  assert.equal(driftWeight(1), 1); assert.equal(driftWeight(DRIFT_HOLD.exit), 1);
  assert.equal(driftWeight(DRIFT_HOLD.enter), 0); assert.equal(driftWeight(1e6), 0); assert.equal(driftWeight(-1e6), 0);
  const mid = driftWeight((DRIFT_HOLD.exit + DRIFT_HOLD.enter) / 2); assert.ok(mid > 0.49 && mid < 0.51);
  assert.equal(stepCloudDrift(0.5, 1e6, 20, 45, PLANET.radius, 1e9), 0.5, 'a geological step does not move the shell');
  // fallback wind is the old constant, only when nothing fills the record
  assert.equal(CLOUDS.windMs, 12);
});

test('Hanel f(RH) = (1 - RH)^-gamma, capped at the top RH', () => {
  const g = HYGRO.gamma;
  for (const rh of [0, 0.3, 0.5, 0.8, 0.9, 0.95]) assert.ok(Math.abs(mieGrowth(rh) - (1 - rh) ** -g) < 1e-12);
  assert.equal(mieGrowth(1), mieGrowth(HYGRO.rhCap)); assert.ok(Number.isFinite(mieGrowth(1)));
  assert.equal(mieGrowth(-1), 1);
  // continental f(85 %) ~ 1.8 (Titos et al. 2016 survey); gamma 0.3 gives 1.77
  assert.ok(Math.abs(mieGrowth(0.85) - 1.8) < 0.1);
});
