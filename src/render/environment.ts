/**
 * Environment record (T-0089, issues #111 and #110). ONE small record of the air where the viewer is looking, and the
 * shader uniforms that carry it, so the atmosphere (and later the fur and foliage shaders) read one source.
 * It copies existing reads and owns none of them:
 *   tC, rh, rainMmH, windE/N = weatherAt(observation point) on the ground, weatherAtLatLon(camera sub-point) on the globe
 *                              (T-0082: both are one read of the Rust planet grid; this module never reads the grid)
 *   season                   = phenology(day) (core/treeSpecies), the same leaf-out / colour the trees use
 *   sunlight                 = solar(day, hour, lat, lon).toa, W/m² at the top of the air (NOAA, core/weather)
 *   rate                     = observationRecord().rate (T-0081: the one clock's rate)
 * Uniforms follow three.js UniformsLib: plain { value } objects merged into many materials. The wind uniforms are the
 * trees' WIND_UNIFORMS objects by reference, so there is no second wind.
 */
import * as THREE from 'three';
import { WIND_UNIFORMS } from './trees';
import { SITE, WEATHER, solar, weatherAt } from '../core/weather';
import { weatherAtLatLon } from '../core/planetWeather';
import type { PlanetSim } from '../core/planetBudget';
import { observationRecord } from '../core/observation';
import { phenology } from '../core/treeSpecies';
import { REAL_SECONDS_PER_GAME_HOUR } from '../core/timeOfDay';

export interface Environment {
  /** air °C */ tC: number; /** relative humidity 0..1 */ rh: number; /** precipitation mm/h */ rainMmH: number;
  /** wind m/s, east and north */ windE: number; windN: number;
  /** latitude (deg) the record was read at: the globe's sub-point, or the home site */ latDeg: number;
  /** phenology(day) */ season: { colour: number; off: number };
  /** top-of-air sunlight W/m² */ sunlight: number; /** clock rate (observationRecord) */ rate: number;
  /** who filled it this frame; null = nothing (no grid booted), readers use their fallback */ source: 'ground' | 'globe' | null;
}
export const ENV: Environment = { tC: 0, rh: 0, rainMmH: 0, windE: 0, windN: 0, latDeg: SITE.lat, season: { colour: 0, off: 0 }, sunlight: 0, rate: 1, source: null };
/** Dev hook (frames for rule 6): fields set here replace the read values after every fill. */
export const ENV_FORCE: Partial<Pick<Environment, 'tC' | 'rh' | 'rainMmH' | 'windE' | 'windN'>> = {};
/** Game seconds per world-clock second (300 real s per game hour = x12). */
export const GAME_SEC_PER_WORLD_SEC = 3600 / REAL_SECONDS_PER_GAME_HOUR;

export const ENV_UNIFORMS = {
  uEnvTemp: { value: 0 }, uEnvHumidity: { value: 0 }, uEnvRain: { value: 0 },
  /** x = autumn colour, y = leaf-off (phenology) */ uEnvSeason: { value: new THREE.Vector2() },
  uEnvSun: { value: 0 }, uEnvRate: { value: 1 },
  uWindDir: WIND_UNIFORMS.uWindDir, uWindAmp: WIND_UNIFORMS.uWindAmp,
};

function finish(source: 'ground' | 'globe', day: number, sunlight: number, rate: number) {
  Object.assign(ENV, ENV_FORCE);
  ENV.season = phenology(day); ENV.sunlight = sunlight; ENV.rate = rate; ENV.source = source;
  const u = ENV_UNIFORMS; u.uEnvTemp.value = ENV.tC; u.uEnvHumidity.value = ENV.rh; u.uEnvRain.value = ENV.rainMmH;
  u.uEnvSeason.value.set(ENV.season.colour, ENV.season.off); u.uEnvSun.value = ENV.sunlight; u.uEnvRate.value = ENV.rate;
}

/** Forest: weatherAt at the observation point. Game +z is south, so north = −wind.z. */
export function fillEnvironmentGround(day = WEATHER.day, hour = WEATHER.hour) {
  const o = observationRecord(), w = weatherAt(o.x, o.z);
  ENV.tC = w.tC; ENV.rh = w.rh; ENV.rainMmH = w.rainMmH; ENV.windE = w.wind.x; ENV.windN = -w.wind.z; ENV.latDeg = SITE.lat;
  finish('ground', day, solar(day, hour).toa, o.rate);
}

/** Globe: T-0082's weatherAtLatLon at the camera's sub-point. `hour` is the game clock's local hour (SITE tz).
 *  False (and source = null) while no grid is booted. */
export function fillEnvironmentGlobe(latDeg: number, lonDeg: number, day: number, hour: number, sim?: PlanetSim | null) {
  const w = weatherAtLatLon(latDeg, lonDeg, sim);
  if (!w) { ENV.source = null; return false; }
  ENV.tC = w.tC; ENV.rh = w.rh; ENV.rainMmH = w.precipMmH; ENV.windE = w.u; ENV.windN = w.v; ENV.latDeg = w.latDeg;
  finish('globe', day, solar(day, hour, w.latDeg, w.lonDeg, SITE.tz).toa, observationRecord().rate);
  return true;
}
