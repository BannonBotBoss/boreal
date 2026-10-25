/**
 * Surface budget of one globe cell (T-0058). Land and sea come from sampleSurface. Roughness and the
 * surface kind's albedo row are SURFACE (Oke 1987; Stull 1988; Raupach 1994). Heat capacity is the
 * cited volumetric capacity times the layer that stores it. Vegetation is vegetationWeight (the forest
 * share surfaceColour already paints). Snow is the hydrosphere seed. No second continent generator.
 */
import { HYDRO, SURFACE, type SurfaceKind } from '../weather';
import { planetFor, toLatLon, vegetationWeight, type Surface, type Vec3 } from '../../world/globe/planet';
import { cellWater, hydrosphereFrom, surfaceElev, type HydrosphereBudget } from './hydrosphereBudget';

const DEG = 180 / Math.PI;
/** Joules per square metre per kelvin. Water: 4.18e6 J/m³/K (Wallace & Hobbs 2006) × 50 m mixed layer
 *  (Levitus 1982; Kara et al. 2003 global mean ~50–60 m). Land: wet mineral soil 2.0e6 J/m³/K
 *  (Oke 1987, Boundary Layer Climates, Table 2.1, low end of the saturated range) × 0.5 m.
 *  The 0.5 m depth is game calibration (Oke's diurnal damping depth is nearer 0.1–0.2 m).
 *  Snow: HYDRO.snowDensity 250 kg/m³ × ice 2100 J/kg/K (Wallace & Hobbs 2006) [verify] × 0.2 m
 *  (game calibration of a thin seasonal cover). */
export const HEAT_JM2K: Record<SurfaceKind, number> = {
  water: 4.18e6 * 50,
  forest: 2.0e6 * 0.5,
  moss: 2.0e6 * 0.5,
  snow: 250 * 2100 * 0.2,
};

export interface SurfaceBudget {
  land: number; sea: number; heatCap: number; roughness: number; snow: number; vegetation: number; kind: SurfaceKind;
}

export function surfaceFrom(s: Surface, veg: number, hydro: HydrosphereBudget): SurfaceBudget {
  const water = cellWater(s.kind, s.h, s.level);
  const land = water ? 0 : 1;
  const sea = s.kind === 'ocean' || (s.h < 0 && s.kind !== 'lake') ? 1 : 0;
  return {
    land, sea, heatCap: HEAT_JM2K[hydro.kind], roughness: SURFACE[hydro.kind].z0,
    snow: hydro.snow, vegetation: water ? 0 : veg, kind: hydro.kind,
  };
}

/** One cell, sampled once. */
export function budgetsAt(seed: number, day: number, hour: number, dir: Vec3) {
  const s = planetFor(seed).sampleSurface([dir[0], dir[1], dir[2]]);
  const ll = toLatLon(dir), veg = vegetationWeight(s, dir);
  const hydro = hydrosphereFrom(day, hour, ll.lat * DEG, ll.lon * DEG, surfaceElev(s), cellWater(s.kind, s.h, s.level), veg);
  return { hydro, surface: surfaceFrom(s, veg, hydro) };
}

export function surfaceBudget(seed: number, day: number, hour: number, dir: Vec3): SurfaceBudget {
  return budgetsAt(seed, day, hour, dir).surface;
}
