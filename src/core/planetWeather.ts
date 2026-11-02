/**
 * One weather read of the Rust planet grid (T-0082, issues #99 #100 #101).
 *
 * `weatherAtLatLon(latDeg, lonDeg)` samples the live `PlanetSim` (the wasm grid from
 * `planet_fundamentals`, booted by `bootGlobe`). The forest player is not a special
 * case: `weatherAt` turns game metres into latitude and longitude with the existing
 * gnomonic frame (`planet.fromLocal`) and calls the same function.
 *
 * While that grid is bound, it is the climate the near weather cell relaxes toward.
 * The cell is the air around the player. `climateRaw` remains only where wasm did not
 * load, and the near grid does not call it while this climate is bound.
 * The cell still steps (Kessler, the bucket, degree-day melt). The planet is the target, not a second column.
 *
 * Snow is the split already in the grid: precipitation below 0 °C is snow
 * (`precipitation.rs`). Issue #101's 35 °C and ±15 °C sketches are not used.
 */
import { AIR, HYDRO, SITE, SURFACE, WEATHER, registerPlanetRead, setNearCellLive, snowDepthCm, type CellClimate, type PointWeather, type SurfaceKind } from './weather';
import { gravity } from '../proc/physics';
import { loadPlanetSim, type PlanetSim } from './planetBudget';
import { bootGlobe } from '../world/globe/bootOrder';
import { PLANET, fromLatLon, planetFor, toLatLon, type Vec3 } from '../world/globe/planet';
import { SITE as LANDING, siteDirection } from './sitePhase';
import { WORLD_SEED } from './world';

/**
 * Rows of the forest boot. Columns are twice that.
 * One degree. The playable landmass is about a hundred kilometres across, and a four-degree cell is wider than that,
 * so its centre fell in the ocean and the bilinear read was mostly sea. A one-degree centre on that landmass is land.
 */
export const FOREST_NLAT = 180;

/** What the climate mask keeps. Inland lakes are land even when the bed is below sea level. Only the ocean is water. */
export function landSampleFromSurface(s: { h: number; kind?: '' | 'ocean' | 'lake'; level?: number }) {
  const lake = s.kind === 'lake';
  const ocean = s.kind === 'ocean' || (!lake && s.h <= 0);
  const elev = ocean ? 0 : lake ? Math.max(0, s.level ?? 0, s.h) : Math.max(0, s.h);
  return { land: ocean ? 0 : 1, elev };
}
/**
 * The globe's post-boot spin (`planetLayers.ts` `SPINUP`): 8 steps of 6 h.
 * `boot` leaves precipitation at 0 because `update_moisture` is called with dt = 0.
 * This spin is that same spin, so rain and cloud are the stepped planes.
 */
export const FOREST_SPIN = { steps: 8, dtS: 21600 };
/** Height (m) at which the reported wind equals the grid's u and v. Below it, the existing log profile scales them. */
export const WIND_REF_M = 10;

export interface PlanetPointWeather {
  /** degrees north, −90..90 */ latDeg: number;
  /** degrees east, −180..180 */ lonDeg: number;
  /** air temperature °C, plane `tair` */ tC: number;
  /** relative humidity 0..1, plane `rh` */ rh: number;
  /** specific humidity kg/kg, plane `q` */ q: number;
  /** eastward wind m/s, plane `u` */ u: number;
  /** northward wind m/s, plane `v` */ v: number;
  /** precipitation mm/day, plane `precip` */ precipMmDay: number;
  /** precipitation intensity mm/h (`precipMmDay / 24`). The sky uses this for both rain and snow. */ precipMmH: number;
  /** precipitating as snow: air below 0 °C and precipMmDay > 0 */ snow: boolean;
  /** snow water equivalent mm, plane `snow` */ sweMm: number;
  /** snow cover 0..1, plane `snowfrac` */ snowFrac: number;
  /** cloud fraction 0..1, plane `cloud` */ cloud: number;
  /** surface pressure Pa, plane `pressure` */ pressurePa: number;
  /** soil water mm, plane `soil` */ soilMm: number;
  /** sea-ice fraction 0..1, plane `ice` */ ice: number;
}

/** Same land mask the globe writes: one `sampleSurface`. Ocean is water. An inland lake stays land. */
export function planetLandSample(planet: { sampleSurface(d: Vec3): { h: number; kind?: '' | 'ocean' | 'lake'; level?: number } }) {
  return (lat: number, lon: number) => landSampleFromSurface(planet.sampleSurface(fromLatLon(lat * Math.PI / 180, lon * Math.PI / 180)));
}

/** Local hour at Kenora to the UTC hour the Rust solar routine stores (`tz` 0). */
export function utcHourFromLocal(localHour: number, tz = SITE.tz) {
  return ((localHour - tz) % 24 + 24) % 24;
}

function wrapDay(day: number) {
  return ((day - 1) % 365 + 365) % 365 + 1;
}

function normLon(lonDeg: number) {
  let x = ((lonDeg + 180) % 360 + 360) % 360 - 180;
  if (x === 180) x = -180;
  return x;
}

function axis(f: number, n: number, wrap: boolean) {
  let x = wrap ? ((f % n) + n) % n : Math.min(Math.max(f, 0), n - 1);
  const nearest = Math.round(x);
  if (Math.abs(x - nearest) <= 1e-8) {
    let i = nearest;
    if (wrap) i = ((i % n) + n) % n;
    else i = Math.min(Math.max(i, 0), n - 1);
    return { i0: i, i1: i, t: 0 };
  }
  let i0 = Math.floor(x), t = x - i0, i1 = i0 + 1;
  if (wrap) { i0 = ((i0 % n) + n) % n; i1 = ((i1 % n) + n) % n; }
  else {
    i0 = Math.min(Math.max(i0, 0), n - 1);
    i1 = Math.min(Math.max(i1, 0), n - 1);
    if (i0 === i1) t = 0;
  }
  return { i0, i1, t };
}

function samplePlane(plane: Float64Array, latDeg: number, lonDeg: number, nlat: number, nlon: number) {
  const r = axis((latDeg + 90) * nlat / 180 - 0.5, nlat, false);
  const c = axis((normLon(lonDeg) + 180) * nlon / 360 - 0.5, nlon, true);
  const at = (row: number, col: number) => plane[row * nlon + col];
  const a = at(r.i0, c.i0) * (1 - c.t) + at(r.i0, c.i1) * c.t;
  const b = at(r.i1, c.i0) * (1 - c.t) + at(r.i1, c.i1) * c.t;
  return a * (1 - r.t) + b * r.t;
}

let shared: Promise<PlanetSim | null> | null = null;
/** The one wasm instance. The globe and the forest both take this, so a page does not boot a second grid. */
export function sharedPlanetSim() {
  if (!shared) shared = loadPlanetSim();
  return shared;
}

let bound: PlanetSim | null = null;
/** Who last booted the shared grid. The forest does not reboot a grid the globe is drawing. */
let clockOwner: 'forest' | 'globe' | null = null;

export function planetWeatherSim() { return bound; }
/** Metres to open ocean at (lat, lon) on the bound grid (PlanetSim.coastAt, #235); undefined before a grid is bound or
 *  when the grid says NaN, so cover keeps its zonal tree and ice lines. Feed it to coverRow / coverKind (#192). */
export function liveCoastM(lat: number, lon: number): number | undefined {
  const c = bound?.coastAt(lat, lon);
  return c != null && Number.isFinite(c) ? c : undefined;
}
export function bindPlanetWeather(sim: PlanetSim | null) {
  bound = sim;
  setNearCellLive(false); // a new grid is not the cell that was seeded from the previous one
}
export function notePlanetClockOwner(owner: 'forest' | 'globe') { clockOwner = owner; }

/**
 * Weather at any geographic point. `source` defaults to the bound grid.
 * Returns null when that grid is absent (wasm did not load, or it has not been booted).
 * Cell centres return that cell. Anywhere else is bilinear, with longitude wrapped.
 */
export function weatherAtLatLon(latDeg: number, lonDeg: number, source?: PlanetSim | null): PlanetPointWeather | null {
  const sim = source === undefined ? bound : source;
  if (!sim || sim.n <= 0) return null;
  const lat = Math.max(-90, Math.min(90, latDeg));
  const lon = normLon(lonDeg);
  const tC = samplePlane(sim.plane('tair'), lat, lon, sim.nlat, sim.nlon);
  const q = samplePlane(sim.plane('q'), lat, lon, sim.nlat, sim.nlon);
  const precipMmDay = Math.max(0, samplePlane(sim.plane('precip'), lat, lon, sim.nlat, sim.nlon));
  return {
    latDeg: lat, lonDeg: lon, tC, q,
    rh: samplePlane(sim.plane('rh'), lat, lon, sim.nlat, sim.nlon),
    u: samplePlane(sim.plane('u'), lat, lon, sim.nlat, sim.nlon),
    v: samplePlane(sim.plane('v'), lat, lon, sim.nlat, sim.nlon),
    precipMmDay, precipMmH: precipMmDay / 24,
    snow: tC < 0 && precipMmDay > 0,
    sweMm: Math.max(0, samplePlane(sim.plane('snow'), lat, lon, sim.nlat, sim.nlon)),
    snowFrac: samplePlane(sim.plane('snowfrac'), lat, lon, sim.nlat, sim.nlon),
    cloud: samplePlane(sim.plane('cloud'), lat, lon, sim.nlat, sim.nlon),
    pressurePa: samplePlane(sim.plane('pressure'), lat, lon, sim.nlat, sim.nlon),
    soilMm: samplePlane(sim.plane('soil'), lat, lon, sim.nlat, sim.nlon),
    ice: samplePlane(sim.plane('ice'), lat, lon, sim.nlat, sim.nlon),
  };
}

function windFrom(w: PlanetPointWeather, h: number, kind: SurfaceKind) {
  const z0 = SURFACE[kind].z0;
  const scale = h >= WIND_REF_M ? 1 : Math.max(0, Math.log(Math.max(h, z0 * 1.01) / z0) / Math.log(WIND_REF_M / z0));
  // Grid v is north. Game +z is south (heading 0 faces −z).
  return { x: w.u * scale, y: 0, z: -w.v * scale };
}

function pointUnder(x: number, z: number) {
  if (!bound || bound.n <= 0) return null;
  // Home keeps the Kenora gnomonic frame. A landing off that square reads the click's own direction.
  const ll = toLatLon(LANDING.remote ? siteDirection(x, z, PLANET.radius) : planetFor(WORLD_SEED).fromLocal(x, z));
  return weatherAtLatLon(ll.lat * 180 / Math.PI, ll.lon * 180 / Math.PI, bound);
}

function forestAt(x: number, z: number): PointWeather | null {
  const w = pointUnder(x, z);
  if (!w) return null;
  return {
    tC: w.tC, rh: w.rh, cloud: w.cloud, rainMmH: w.precipMmH, snow: w.snow,
    soil: Math.min(1, Math.max(0, w.soilMm / HYDRO.bucketMm)), sweMm: w.sweMm, depthCm: snowDepthCm(w.sweMm), fog: 0,
    wind: windFrom(w, WIND_REF_M, 'forest'),
  };
}

function spin(sim: PlanetSim, day: number, localHour: number) {
  const utc = utcHourFromLocal(localHour);
  const start = wrapDay(day - FOREST_SPIN.steps * FOREST_SPIN.dtS / 86400);
  sim.boot(start, utc);
  for (let i = 0; i < FOREST_SPIN.steps; i++) sim.step(FOREST_SPIN.dtS);
}

function dayApart(a: number, b: number) {
  let d = ((a - b) % 365 + 365) % 365;
  if (d > 182.5) d -= 365;
  return Math.abs(d);
}

function hourApart(a: number, b: number) {
  let d = ((a - b) % 24 + 24) % 24;
  if (d > 12) d -= 24;
  return Math.abs(d);
}

function followForestClock(day: number, localHour: number) {
  if (clockOwner !== 'forest' || !bound || bound.n <= 0) return false;
  // A half-hour of clock drift, or a new date, re-boots once. Scrubbing inside that window does not spin every frame.
  if (dayApart(bound.day, day) < 0.75 && hourApart(bound.hour, utcHourFromLocal(localHour)) < 0.5) return false;
  spin(bound, day, localHour);
  WEATHER.steps += 64;
  return true;
}
/** Climate the near cell relaxes toward. Wind `v` is south, because the column's +z is south and the planet's v is north. */
function targetAt(x: number, z: number, heightM: number): CellClimate | null {
  if (!WEATHER.on || !bound || bound.n <= 0) return null;
  const w = pointUnder(x, z);
  if (!w) return null;
  const surfaceTC = w.tC;
  const tC = surfaceTC - AIR.lapse * heightM;
  // An unbooted pressure plane is 0. Surface pressure is then AIR.p0, the ISO 2533 standard already on the column.
  const surfaceP = w.pressurePa > 0 ? w.pressurePa : AIR.p0;
  const p = surfaceP * Math.exp(-gravity() * heightM / (AIR.Rd * Math.max(1, tC + 273.15)));
  return {
    tC, surfaceTC, rh: w.rh, u: w.u, v: -w.v, p,
    cloud: w.cloud, precipMmH: w.precipMmH, sweMm: w.sweMm, soilMm: w.soilMm,
    source: 'planet',
  };
}

/**
 * Boot the shared grid for the forest clock, unless the globe already owns it.
 * Resolves false when wasm will not load; the caller keeps `climateRaw`.
 */
export async function openForestPlanet(day: number, localHour: number): Promise<boolean> {
  try {
    const sim = await sharedPlanetSim();
    if (!sim) { bound = null; return false; }
    if (clockOwner === 'globe' && sim.n > 0) { bound = sim; return true; }
    const planet = planetFor(WORLD_SEED);
    bootGlobe(sim, FOREST_NLAT, FOREST_NLAT * 2, planetLandSample(planet), day, utcHourFromLocal(localHour));
    spin(sim, day, localHour);
    bound = sim;
    clockOwner = 'forest';
    WEATHER.steps += 64;
    return true;
  } catch {
    bound = null;
    return false;
  }
}

registerPlanetRead({
  driving: () => WEATHER.on && bound !== null && bound.n > 0,
  at: (x, z) => WEATHER.on ? forestAt(x, z) : null,
  wind: (x, h, z, kind) => { if (!WEATHER.on) return null; const w = pointUnder(x, z); return w ? windFrom(w, h, kind) : null; },
  follow: followForestClock,
  target: targetAt,
});

export const HOME_LAT_DEG = PLANET.home.latDeg;
