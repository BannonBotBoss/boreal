/**
 * Forest climate authority (T-0082, issues #100 and #101).
 *
 * While the Rust planet grid is loaded, the forest reads that grid. Temperature, humidity, wind,
 * rain, and snow at the player are samples of its planes (`planet_fundamentals`, hosted by
 * `planetBudget.ts`). `climateRaw` in `weather.ts` is the fallback only when the wasm will not
 * load. One source per frame: a bound grid is never blended with `climateRaw`.
 * The cloud plane is sampled and kept on the grid. The sky does not paint it on this boot:
 * `update_clouds` at dt = 0 is an instant diagnosis, and the globe spins before it trusts cloud.
 *
 * The grid is the same boot as the globe (`bootGlobe`): land and height come from `planet.ts`,
 * then `grid_boot` fills the planes. The forest stands at the planet's home cell (Kenora's
 * latitude, the seeded home longitude). Above that surface, height uses the published lapse
 * already on `AIR.lapse` (ICAO/ISO 2533). It does not add a second monthly table.
 */
import { AIR, HYDRO, SITE, qsat } from './weather';
import { WORLD_SEED } from './world';
import { gravity } from '../proc/physics';
import type { PlaneName, PlanetSim } from './planetBudget';
import { bootGlobe } from '../world/globe/bootOrder';
import { PLANET, fromLatLon, planetFor, toLatLon } from '../world/globe/planet';

/** Half-degree lattice. The forest is a few kilometres of land, so a coarser cell centre falls in the ocean
 *  beside it and the player would read sea weather. 0.5° puts a cell on that land. One mask, `planet.ts`. */
export const FOREST_NLAT = 360;
export const FOREST_NLON = 720;

export interface BoundClimate {
  tC: number; u: number; v: number; rh: number; p: number;
  cloud: number; rainMmH: number; snow: boolean; sweMm: number; soil: number;
}

let sim: PlanetSim | null = null;
let starting: Promise<PlanetSim | null> | null = null;
let booted = false;
let homeLat = PLANET.home.latDeg;
/** NaN until a bind. Read through `forestLon` so this module's load does not touch `weather.ts` (they import each other). */
let homeLon = Number.NaN;
let cacheKey = '';
let cache: BoundClimate | null = null;
let generation = 0;

function forestLon() { return Number.isNaN(homeLon) ? SITE.lon : homeLon; }

export function climateAuthority(): 'wasm' | 'fallback' { return sim && booted ? 'wasm' : 'fallback'; }
export function climateGeneration() { return generation; }
export function climateSim() { return sim; }

/** Drop the memo so a test that edits planes, or a fresh boot, is what the next read returns. */
export function invalidateClimateRead() { cache = null; cacheKey = ''; generation++; }

export function resetClimateAuthority() {
  sim = null; starting = null; booted = false;
  homeLat = PLANET.home.latDeg; homeLon = Number.NaN;
  invalidateClimateRead();
}

export function bindClimateSim(next: PlanetSim | null, at?: { lat: number; lon: number }) {
  sim = next; booted = !!next;
  if (at) { homeLat = at.lat; homeLon = at.lon; }
  invalidateClimateRead();
}

/** Forest local hour to UTC. `SITE.tz` is hours east of Greenwich (Kenora −6). Rust `solar` takes UTC. */
export function localToUtc(localHour: number) {
  return ((localHour - SITE.tz) % 24 + 24) % 24;
}

function wrapLon(lon: number) { return ((lon + 180) % 360 + 360) % 360 - 180; }

/** The cell whose centre is nearest the point. Longitude wraps. That one cell is the read, not a blend with its neighbours. */
export function samplePlane(s: PlanetSim, name: PlaneName, lat: number, lon: number): number {
  const nlat = s.nlat, nlon = s.nlon;
  const r = Math.max(0, Math.min(nlat - 1, Math.round((lat + 90) / 180 * nlat - 0.5)));
  const c = ((Math.round((wrapLon(lon) + 180) / 360 * nlon - 0.5) % nlon) + nlon) % nlon;
  return s.plane(name)[r * nlon + c];
}

/** Re-boot when the forest date has moved. Land and elevation stay. `boot` is the one fill order. */
export function syncClimate(day: number, utcHour: number) {
  if (!sim || !booted) return;
  const dh = ((utcHour % 24) + 24) % 24;
  // Daily climate. Re-boot when the date moves, not every hour: this grid is a long fill, and the
  // hour does not move these planes. The first boot already stored the hour.
  if (Math.abs(sim.day - day) < 0.5) return;
  sim.boot(day, dh);
  invalidateClimateRead();
}

function surfaceSample(): BoundClimate {
  const s = sim!;
  const lon = forestLon();
  const tC = samplePlane(s, 'tair', homeLat, lon);
  const p = samplePlane(s, 'pressure', homeLat, lon);
  const q = samplePlane(s, 'q', homeLat, lon);
  const rhPlane = samplePlane(s, 'rh', homeLat, lon);
  const rh = rhPlane > 0 ? Math.min(1, rhPlane) : Math.min(1, q / Math.max(1e-12, qsat(tC, p)));
  const precip = Math.max(0, samplePlane(s, 'precip', homeLat, lon)); // mm/day
  const falling = precip / 24; // mm/h, the rate weatherAt already uses
  return {
    tC, p, rh,
    u: samplePlane(s, 'u', homeLat, lon),
    v: -samplePlane(s, 'v', homeLat, lon), // rust v is north; world +z is south
    cloud: Math.min(1, Math.max(0, samplePlane(s, 'cloud', homeLat, lon))),
    rainMmH: falling,
    snow: tC < 0 && precip > 0, // #100, same 0 °C split as precipitation.rs. Not replaced.
    sweMm: Math.max(0, samplePlane(s, 'snow', homeLat, lon)),
    soil: samplePlane(s, 'soil', homeLat, lon) / HYDRO.bucketMm,
  };
}

/**
 * Climate at `z` metres above the home surface, or null when the wasm is not bound.
 * `hour` is the forest's local hour. One cached surface sample per boot.
 */
export function boundClimate(day: number, localHour: number, z = 0): BoundClimate | null {
  if (!sim || !booted) return null;
  syncClimate(day, localToUtc(localHour));
  const key = `${sim.day}:${sim.hour}`;
  if (!cache || cacheKey !== key) { cache = surfaceSample(); cacheKey = key; }
  const s = cache;
  if (z === 0) return s;
  const tC = s.tC - AIR.lapse * z;
  const p = s.p * Math.exp(-gravity() * z / (AIR.Rd * (tC + 273.15)));
  return { ...s, tC, p, snow: tC < 0 && s.rainMmH > 0 };
}

/**
 * Load the wasm, boot the home planet, and bind it. Resolves null when the wasm will not load
 * (the forest then keeps `climateRaw`). A second call reuses the first load.
 */
export function startForestClimate(day: number, localHour: number, bytes?: BufferSource): Promise<PlanetSim | null> {
  if (sim && booted) return Promise.resolve(sim);
  if (starting) return starting;
  starting = (async () => {
    const { loadPlanetSim } = await import('./planetBudget');
    const loaded = await loadPlanetSim(bytes);
    if (!loaded) { starting = null; return null; }
    const planet = planetFor(WORLD_SEED);
    const ll = toLatLon(planet.home);
    const lat = ll.lat * 180 / Math.PI, lon = ll.lon * 180 / Math.PI;
    bootGlobe(loaded, FOREST_NLAT, FOREST_NLON, (la, lo) => {
      const s = planet.sampleSurface(fromLatLon(la * Math.PI / 180, lo * Math.PI / 180));
      return { land: s.h > 0 ? 1 : 0, elev: Math.max(0, s.h) };
    }, day, localToUtc(localHour));
    bindClimateSim(loaded, { lat, lon });
    return loaded;
  })();
  return starting;
}
