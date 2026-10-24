/**
 * Planet budgets (issue #43; solar, hydrosphere, atmosphere, surface) — the TypeScript side of the Rust crate `rust/boreal-sim`.
 * The Rust compiled to WebAssembly owns the per-cell maths; this file loads it, hands it the land mask from the existing
 * `world/globe/planet.ts` (continents are not regenerated in Rust) and exposes each layer as a `Float64Array` over wasm memory.
 * No second climate: the formulas are ports of `weather.ts` (`solar`, `shortwave`, `surfaceBalance`, `qsat`, the Manabe bucket) and
 * `tests/planet-budget.test.ts` checks the wasm against those TypeScript functions to 1e-9.
 * If the wasm is not built or cannot load, `loadPlanetSim` resolves `null` and `solarLayerFallback` still gives the solar layer from `weather.ts`,
 * so `npm test` and `npx vite` work without Rust installed. Build it with `npm run build:wasm` (see rust/README.md).
 */
import { AIR, SURFACE, shortwave, solar } from './weather';

/** Plane order of `rust/boreal-sim/src/grid.rs` (NAMES). `layout_version()` and `plane_count()` are checked at load. */
export const PLANE_NAMES = ['lat', 'lon', 'land', 'elev', 'ts', 'tair', 'soil', 'snow', 'q', 'cloud', 'ice', 'qabs', 'qrefl', 'lwout', 'lwnet', 'swdown', 'toa',
  'evap', 'precip', 'pw', 'pressure', 'psl', 'u', 'v', 'cot', 'instab', 'albedo', 'sst', 'rh', 'heatcap', 'rough', 'snowfrac', 'seafrac', 'reflsw', 'absatm', 'olr'] as const;
export type PlaneName = typeof PLANE_NAMES[number];
export const LAYOUT_VERSION = 2;

/** What each plane is, for UI legends: unit and the issue #43 budget it belongs to. */
export const PLANE_INFO: Record<PlaneName, { unit: string; budget: 'input' | 'state' | 'solar' | 'hydrosphere' | 'atmosphere' | 'surface'; label: string }> = {
  lat: { unit: '°', budget: 'input', label: 'latitude' }, lon: { unit: '°', budget: 'input', label: 'longitude' },
  land: { unit: '0..1', budget: 'input', label: 'land fraction' }, elev: { unit: 'm', budget: 'input', label: 'height above sea level' },
  ts: { unit: '°C', budget: 'state', label: 'surface temperature' }, tair: { unit: '°C', budget: 'state', label: 'air temperature' },
  soil: { unit: 'mm', budget: 'hydrosphere', label: 'soil moisture' }, snow: { unit: 'mm w.e.', budget: 'hydrosphere', label: 'snow water equivalent' },
  q: { unit: 'kg/kg', budget: 'hydrosphere', label: 'specific humidity' }, cloud: { unit: '0..1', budget: 'atmosphere', label: 'cloud fraction' },
  ice: { unit: '0..1', budget: 'hydrosphere', label: 'sea-ice fraction' },
  qabs: { unit: 'W/m²', budget: 'solar', label: 'Q absorbed' }, qrefl: { unit: 'W/m²', budget: 'solar', label: 'Q reflected' },
  lwout: { unit: 'W/m²', budget: 'solar', label: 'Q longwave out' }, lwnet: { unit: 'W/m²', budget: 'solar', label: 'net longwave' },
  swdown: { unit: 'W/m²', budget: 'solar', label: 'surface shortwave down' }, toa: { unit: 'W/m²', budget: 'solar', label: 'top-of-atmosphere insolation' },
  evap: { unit: 'mm/day', budget: 'hydrosphere', label: 'evaporation' }, precip: { unit: 'mm/day', budget: 'hydrosphere', label: 'precipitation' },
  pw: { unit: 'kg/m²', budget: 'hydrosphere', label: 'humidity column (precipitable water)' }, pressure: { unit: 'Pa', budget: 'atmosphere', label: 'surface pressure' },
  psl: { unit: 'Pa', budget: 'atmosphere', label: 'sea-level pressure' }, u: { unit: 'm/s', budget: 'atmosphere', label: 'wind east' }, v: { unit: 'm/s', budget: 'atmosphere', label: 'wind north' },
  cot: { unit: '', budget: 'atmosphere', label: 'cloud optical depth' }, instab: { unit: 'K/km', budget: 'atmosphere', label: 'vertical instability' },
  albedo: { unit: '0..1', budget: 'surface', label: 'surface albedo' }, sst: { unit: '°C', budget: 'hydrosphere', label: 'sea-surface temperature (−999 on land)' },
  rh: { unit: '0..1', budget: 'atmosphere', label: 'relative humidity' }, heatcap: { unit: 'J/m²/K', budget: 'surface', label: 'surface heat capacity' },
  rough: { unit: 'm', budget: 'surface', label: 'roughness length' }, snowfrac: { unit: '0..1', budget: 'surface', label: 'snow fraction' }, seafrac: { unit: '0..1', budget: 'surface', label: 'sea fraction' },
  reflsw: { unit: 'W/m²', budget: 'solar', label: 'shortwave reflected to space' }, absatm: { unit: 'W/m²', budget: 'atmosphere', label: 'shortwave absorbed by the air' }, olr: { unit: 'W/m²', budget: 'atmosphere', label: 'outgoing longwave (Budyko A + B T)' },
};

interface Exports {
  memory: WebAssembly.Memory; layout_version(): number; plane_count(): number;
  grid_init(nlat: number, nlon: number): number; grid_seed(day: number, hour: number): void; grid_step(dt: number): void;
  grid_day(): number; grid_hour(): number; alloc_f64(n: number): number;
  solar_cell(day: number, hour: number, lat: number, lon: number, cloud: number, albedo: number, tC: number, ePa: number, out: number): void;
}

export class PlanetSim {
  nlat = 0; nlon = 0; n = 0; private base = 0;
  constructor(private x: Exports) {}
  /** Allocate a grid (rows south→north, columns west→east, cell centres). Replaces any earlier grid. */
  init(nlat: number, nlon: number) { this.nlat = nlat; this.nlon = nlon; this.n = nlat * nlon; this.base = this.x.grid_init(nlat, nlon); return this; }
  /** A live view of one plane (re-take it after `init`; wasm memory may grow). */
  plane(name: PlaneName): Float64Array { return new Float64Array(this.x.memory.buffer, this.base + PLANE_NAMES.indexOf(name) * this.n * 8, this.n); }
  /** Fill the land fraction and height from a sampler (the globe's `planet.sampleSurface`). */
  setLand(sample: (latDeg: number, lonDeg: number) => { land: number; elev: number }) {
    const lat = this.plane('lat'), lon = this.plane('lon'), land = this.plane('land'), elev = this.plane('elev');
    for (let i = 0; i < this.n; i++) { const s = sample(lat[i], lon[i]); land[i] = s.land; elev[i] = s.elev; }
    return this;
  }
  seed(day: number, utcHour = 0) { this.x.grid_seed(day, utcHour); return this; }
  step(dtSeconds: number) { this.x.grid_step(dtSeconds); return this; }
  get day() { return this.x.grid_day(); } get hour() { return this.x.grid_hour(); }
  /** One cell's solar budget: [toa, swDown, qAbsorbed, qReflected, qLongwaveOut, lwNet, cosZenith]. */
  solarCell(day: number, utcHour: number, lat: number, lon: number, cloud: number, albedo: number, tC: number, ePa: number) {
    const p = this.x.alloc_f64(7); this.x.solar_cell(day, utcHour, lat, lon, cloud, albedo, tC, ePa, p);
    return Array.from(new Float64Array(this.x.memory.buffer, p, 7));
  }
}

/** Instantiate the wasm. `bytes` is for tests and workers; in the browser it fetches `<base>wasm/boreal_sim.wasm`. Resolves null on any failure. */
export async function loadPlanetSim(bytes?: BufferSource): Promise<PlanetSim | null> {
  try {
    let buf = bytes;
    if (!buf) {
      const base = (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';
      const r = await fetch(`${base}wasm/boreal_sim.wasm`); if (!r.ok) return null;
      buf = await r.arrayBuffer();
    }
    const { instance } = await WebAssembly.instantiate(buf, {});
    const x = instance.exports as unknown as Exports;
    if (x.layout_version() !== LAYOUT_VERSION || x.plane_count() !== PLANE_NAMES.length) return null; // stale build: use the fallback
    return new PlanetSim(x);
  } catch { return null; }
}

/** Fallback solar layer when the wasm is absent: Q absorbed (W/m²) per cell from `weather.ts` `solar()` and `shortwave()` (uniform cloud and albedo).
 *  Same grid layout as the wasm (rows south→north). */
export function solarLayerFallback(nlat: number, nlon: number, day: number, utcHour: number, cloud = 0.5, albedo = 0.3): Float64Array {
  const out = new Float64Array(nlat * nlon);
  for (let r = 0; r < nlat; r++) for (let c = 0; c < nlon; c++) {
    const lat = -90 + (r + .5) * 180 / nlat, lon = -180 + (c + .5) * 360 / nlon, s = solar(day, utcHour, lat, lon, 0);
    out[r * nlon + c] = (1 - albedo) * shortwave(s.cosZ, cloud, AIR.S0);
  }
  return out;
}
/** The surface rows the Rust surface budget mirrors (so a change to `SURFACE` in weather.ts shows up in a failing test). */
export const SURFACE_ROWS = SURFACE;
