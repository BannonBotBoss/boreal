/**
 * Globe boot order (issue #47, T-0063). The host commits the land/sea mask and the elevation from one
 * `planet.sampleSurface` call (Musgrave 1989 + fBm, land share 0.292 ETOPO1 — not a second mask). `PlanetSim.boot`
 * then runs `RUST_BOOT_STEPS` in `rust/boreal-sim/src/boot_order.rs`. The globe loop renders after that returns.
 * Boot does not advance the clock and does not integrate surface temperature.
 */
import { type PlanetSim } from '../../core/planetBudget';

/** Matthew's list, issue #47. `render_globe` is the caller's first `renderTo` / `requestAnimationFrame`, not this function. */
export const GLOBE_BOOT_ORDER = [
  'land_sea_mask',
  'elevation_roughness',
  'climate_bands',
  'sst_soil_humidity',
  'cloud_seed',
  'solar_budget',
  'surface_absorption',
  'pressure',
  'wind',
  'hydrosphere_flows',
  'atmosphere_updates',
  'finalize',
  'render_globe',
] as const;
export type BootStep = typeof GLOBE_BOOT_ORDER[number];

/** The steps `grid_boot` runs, in that order. Kept in lockstep with `RUST_BOOT_STEPS` (tests/boot-order.test.ts). */
export const RUST_BOOT_ORDER = GLOBE_BOOT_ORDER.filter(s => s !== 'land_sea_mask' && s !== 'render_globe');

export interface BootSample { land: number; elev: number }

/**
 * Init the grid, write land, write elevation, then the rust boot. Returns the steps this call performed.
 * `render_globe` is left to the caller so the first frame is after finalize.
 */
export function bootGlobe(sim: PlanetSim, nlat: number, nlon: number, sample: (latDeg: number, lonDeg: number) => BootSample, day: number, hour: number): readonly BootStep[] {
  sim.init(nlat, nlon);
  const lat = sim.plane('lat'), lon = sim.plane('lon'), land = sim.plane('land'), elev = sim.plane('elev');
  const lands = new Float64Array(sim.n), elevs = new Float64Array(sim.n);
  for (let i = 0; i < sim.n; i++) { const s = sample(lat[i], lon[i]); lands[i] = s.land; elevs[i] = s.elev; }
  land.set(lands); // land_sea_mask
  elev.set(elevs); // elevation, before roughness
  sim.boot(day, hour); // elevation_roughness through finalize
  return GLOBE_BOOT_ORDER.filter(s => s !== 'render_globe');
}
