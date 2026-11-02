/**
 * Planet budgets (issue #43; solar, hydrosphere, atmosphere, surface) — the TypeScript side of the Rust crate `rust/boreal-sim`.
 * The Rust formulas live under `rust/boreal-sim/src/planet_fundamentals/` (issue #46). `lib.rs` re-exports the old module names.
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
  'evap', 'precip', 'pw', 'pressure', 'psl', 'u', 'v', 'cot', 'instab', 'albedo', 'sst', 'rh', 'heatcap', 'rough', 'snowfrac', 'seafrac', 'reflsw', 'absatm', 'olr', 'pmean'] as const;
export type PlaneName = typeof PLANE_NAMES[number];
export const LAYOUT_VERSION = 3;

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
  reflsw: { unit: 'W/m²', budget: 'solar', label: 'shortwave reflected to space' }, absatm: { unit: 'W/m²', budget: 'atmosphere', label: 'shortwave absorbed by the air' }, pmean: { unit: 'mm/day', budget: 'hydrosphere', label: 'precipitation, 12 h running mean' }, olr: { unit: 'W/m²', budget: 'atmosphere', label: 'outgoing longwave (Budyko A + B T)' },
};

/** cover.rs class ids, in order. */
export const COVER_CLASSES = ['water', 'ice', 'rock', 'tundra', 'desert', 'prairie', 'boreal', 'tropical', 'wetland'] as const;

interface Exports {
  memory: WebAssembly.Memory; layout_version(): number; plane_count(): number;
  grid_init(nlat: number, nlon: number): number; grid_seed(day: number, hour: number): void; grid_boot(day: number, hour: number): void; grid_step(dt: number): void;
  grid_day(): number; grid_hour(): number; alloc_f64(n: number): number;
  landing_population(lat: number, lon: number, elevM: number, vegetation: number, water: number, year: number, sideM: number, out: number, cap: number): number;
  cover_cell(lat: number, lon: number, elevM: number, vegetation: number, water: number, out: number): void;
  cover_cell_at(lat: number, lon: number, elevM: number, vegetation: number, water: number, coastM: number, out: number): void;
  grid_coast_at(lat: number, lon: number): number;
  solar_cell(day: number, hour: number, lat: number, lon: number, cloud: number, albedo: number, tC: number, ePa: number, out: number): void;
  radial_profile(rKm: number, mpRe: number, out: number): void;
  gas_column(body: number, hKm: number, qSurf: number, co2ppm: number, out: number): void;
  earth_figure(out: number): void;
  figure_gravity(rM: number, latDeg: number): number;
  gas_above(hKm: number, qSurf: number, co2ppm: number, out: number): void;
  rt_point(year: number, cosZ: number, cosV: number, phi: number, wind: number, cloud: number, tau: number, surf: number, landAlbedo: number, hKm: number, qSurf: number, co2ppm: number, out: number): void;
  emergent_demo(n: number, mode: number, out: number): void;
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
  /** Issue #47 boot (`boot_order.rs`). LAND and ELEV are already on the grid. Does not advance time or integrate Ts. */
  boot(day: number, utcHour = 0) { this.x.grid_boot(day, utcHour); return this; }
  step(dtSeconds: number) { this.x.grid_step(dtSeconds); return this; }
  get day() { return this.x.grid_day(); } get hour() { return this.x.grid_hour(); }
  /** One cell's solar budget: [toa, swDown, qAbsorbed, qReflected, qLongwaveOut, lwNet, cosZenith]. */
  solarCell(day: number, utcHour: number, lat: number, lon: number, cloud: number, albedo: number, tC: number, ePa: number) {
    const p = this.x.alloc_f64(7); this.x.solar_cell(day, utcHour, lat, lon, cloud, albedo, tC, ePa, p);
    return Array.from(new Float64Array(this.x.memory.buffer, p, 7));
  }
  private scratch = 0;
  private buf() { if (!this.scratch) this.scratch = this.x.alloc_f64(16); return this.scratch; }
  /** Through-planet profile at signed radius r km (interior.rs): layer index (INTERIOR_LAYERS), density kg/m³, T K, P Pa, g m/s². */
  radialProfile(rKm: number, magnetopauseRe = 10) {
    const p = this.buf(); this.x.radial_profile(rKm, magnetopauseRe, p); const o = new Float64Array(this.x.memory.buffer, p, 5);
    return { layer: o[0], rho: o[1], T: o[2], P: o[3], g: o[4] };
  }
  /** Emergent figure (interior.rs): surface radius km, C/MR², flattening f, equatorial a km, polar c km. */
  earthFigure() { const p = this.buf(); this.x.earth_figure(p); const o = new Float64Array(this.x.memory.buffer, p, 5); return { rSurfKm: o[0], moi: o[1], f: o[2], aKm: o[3], cKm: o[4] }; }
  /** Normal gravity of the rotating oblate figure (J2 + centrifugal) at r m, geocentric latitude deg; outside the body. */
  figureGravity(rM: number, latDeg: number) { return this.x.figure_gravity(rM, latDeg); }
  /** Column above h km: number column m^-2, ozone DU, precipitable water mm, air mass kg/m², thermal layer (ATM_LAYERS). */
  gasAbove(hKm: number, qSurf = 0, co2ppm = 422.8) { const p = this.buf(); this.x.gas_above(hKm, qSurf, co2ppm, p); const o = new Float64Array(this.x.memory.buffer, p, 5);
    return { nCol: o[0], o3DU: o[1], pwMm: o[2], mass: o[3], layer: o[4] }; }
  /** Gas-fed shortwave column at a point (rt.rs); surf 0 ocean 1 sea ice 2 snow 3 land. */
  rtPoint(a: { year: number; cosZ: number; cosV: number; phi: number; wind?: number; cloud?: number; tau?: number; surf: number; landAlbedo?: number; hKm: number; qSurf?: number; co2ppm?: number }) {
    const p = this.buf(); this.x.rt_point(a.year, a.cosZ, a.cosV, a.phi, a.wind ?? 7, a.cloud ?? 0, a.tau ?? 9, a.surf, a.landAlbedo ?? .2, a.hKm, a.qSurf ?? .0115, a.co2ppm ?? 422.8, p);
    const o = new Float64Array(this.x.memory.buffer, p, 8); return { toa: o[0], reflAtm: o[1], reflSurf: o[2], absAtm: o[3], absSurf: o[4], albedo: o[5], glint: o[6], tsi: o[7] }; }
  /** Emergent-object finder demo (emergent.rs): mode 0 relaxed PREM Earth, 1 unbound, 2 Earth + Moon. */
  emergentDemo(n: number, mode: number) { const p = this.buf(); this.x.emergent_demo(n, mode, p); const o = Array.from(new Float64Array(this.x.memory.buffer, p, 13));
    return { count: o[0], mass: o[1], com: [o[2], o[3], o[4]], spinZ: o[5], members: o[6], trusted: o[7] > 0, extent: o[8], layers: o[9], insideHill: o[10] > 0, outsideRoche: o[11] > 0 }; }
  private popScratch = 0;
  /** Issue #162 bridge: the simulation's local population list at a landing, as { species, count } for every species
   *  with at least one animal in a square patch `sideM` wide. Species ids follow LANDING_SPECIES. Empty on water. */
  landingPopulation(lat: number, lon: number, elevM: number, vegetation: number, water: boolean, year: number, sideM = 5000) {
    const cap = LANDING_SPECIES.length, p = this.popScratch ||= this.x.alloc_f64(2 * cap);
    const n = this.x.landing_population(lat, lon, elevM, vegetation, water ? 1 : 0, year, sideM, p, cap);
    const o = new Float64Array(this.x.memory.buffer, p, 2 * n), out: { species: (typeof LANDING_SPECIES)[number]; count: number }[] = [];
    for (let i = 0; i < n; i++) out.push({ species: LANDING_SPECIES[o[2 * i]], count: o[2 * i + 1] });
    return out;
  }
  /** #192 wildlife lane: landingPopulation plus density (animals per km2 of the patch) and each species' habitat
   *  tags (SPECIES_HABITAT), so the spawner can place every animal in fitting ground without a second sim call. */
  landingPopulationDetail(lat: number, lon: number, elevM: number, vegetation: number, water: boolean, year: number, sideM = 5000) {
    const km2 = (sideM / 1000) ** 2;
    return this.landingPopulation(lat, lon, elevM, vegetation, water, year, sideM)
      .map(p => ({ ...p, perKm2: p.count / km2, habitat: SPECIES_HABITAT[p.species] }));
  }
  /** Issue #167 cover row (cover.rs): class name, stems per hectare, billboard height (m). Deterministic per place. */
  coverCell(lat: number, lon: number, elevM: number, vegetation: number, water: boolean) {
    const p = this.buf(); this.x.cover_cell(lat, lon, elevM, vegetation, water ? 1 : 0, p); const o = new Float64Array(this.x.memory.buffer, p, 3);
    return { kind: COVER_CLASSES[o[0]], stemsPerHa: o[1], heightM: o[2] };
  }
  /** coverCell with the landing's distance to the coast in metres (cover.rs cover_row_at; NaN = unknown = coverCell). */
  coverCellAt(lat: number, lon: number, elevM: number, vegetation: number, water: boolean, coastM: number) {
    const p = this.buf(); this.x.cover_cell_at(lat, lon, elevM, vegetation, water ? 1 : 0, coastM, p); const o = new Float64Array(this.x.memory.buffer, p, 3);
    return { kind: COVER_CLASSES[o[0]], stemsPerHa: o[1], heightM: o[2] };
  }
  /** Metres from (lat, lon) to open ocean on the live grid (grid.rs coast_at); NaN before `init`. Feed it to coverCellAt. */
  coastAt(lat: number, lon: number): number { return this.x.grid_coast_at(lat, lon); }
  /** Gas column (gas.rs) at altitude h km; body 0 Earth, 1 Venus, 2 Mercury. x = mole fractions in GAS_SPECIES order. */
  gasColumn(hKm: number, body = 0, qSurf = 0, co2ppm = 422.8) {
    const p = this.buf(); this.x.gas_column(body, hKm, qSurf, co2ppm, p); const o = Array.from(new Float64Array(this.x.memory.buffer, p, 13));
    return { T: o[0], p: o[1], rho: o[2], n: o[3], x: o.slice(4) };
  }
}
/** Species ids of the Rust species table (species.rs `Species`), in id order. */
export const LANDING_SPECIES = ['snowshoe_hare', 'white_tailed_deer', 'moose', 'canada_lynx', 'gray_wolf', 'caribou', 'american_black_bear', 'grizzly_bear', 'bald_eagle', 'beaver', 'red_fox', 'arctic_fox'] as const;
/** Where each landing species lives, from the notes in data/earth/species-density.json. Placement hints for the viewer. */
export const SPECIES_HABITAT: Record<(typeof LANDING_SPECIES)[number], readonly string[]> = {
  snowshoe_hare: ['conifer forest', 'shrub'], white_tailed_deer: ['forest edge', 'mixed forest', 'meadow'],
  moose: ['wetland', 'shoreline', 'conifer forest'], canada_lynx: ['conifer forest'], gray_wolf: ['forest', 'tundra'],
  caribou: ['tundra', 'open conifer forest'], american_black_bear: ['forest'], grizzly_bear: ['forest', 'tundra', 'meadow'],
  bald_eagle: ['shoreline', 'tall trees by water'], beaver: ['shoreline', 'stream'], red_fox: ['forest edge', 'meadow', 'tundra'], arctic_fox: ['tundra', 'coast'],
};
export const INTERIOR_LAYERS = ['inner core', 'outer core', 'mantle', 'crust', 'ocean', 'atmosphere', 'magnetosphere', 'solar wind'] as const;
export const ATM_LAYERS = ['troposphere', 'stratosphere', 'mesosphere', 'thermosphere', 'exosphere'];
export const GAS_SPECIES = ['N2', 'O2', 'Ar', 'CO2', 'H2O', 'O3', 'O', 'Na', 'He'] as const;

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
