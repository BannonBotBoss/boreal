/**
 * Altitude zones (grokbot-1, T-0072): tree line and permanent-ice line from causes, not fixed heights. Constants and sources:
 * data/earth/altitude-zones.json. Sea-level temperature from latitude (North 1975 energy-balance fit), warm-season mean from
 * the annual cycle (North & Coakley 1979), cooled with height at the US Standard Atmosphere 1976 lapse rate. Trees stop where
 * the growing-season mean drops below 6.4 C (Koerner & Paulsen 2004); ice stays where the warm season never thaws.
 */
import Z from '../../data/earth/altitude-zones.json';
import { PLANET } from '../world/globe/planet';
import { LEVEL } from './tuning';
import { siteDatum, siteLatitude } from './sitePhase';

const rad = (d: number) => d * Math.PI / 180;
/** Annual mean sea-level temperature (C) at latitude (deg). */
export const seaLevelAnnualC = (latDeg: number) => { const x = Math.sin(rad(latDeg)); return Z.T0_C + Z.T2_C * (3 * x * x - 1) / 2; };
/** Mean of the warm half of the year at sea level (C): the growing season. */
export const seaLevelWarmC = (latDeg: number) => seaLevelAnnualC(latDeg) + 2 / Math.PI * Z.seasonal_half_range_pole_K * Math.abs(Math.sin(rad(latDeg)));
/** Mean of the warmest `zone_season_fraction` of the year at sea level (C): the summer quarter that sets tree and ice lines. */
export const seaLevelZoneSeasonC = (latDeg: number) => { const f = Math.PI * Z.zone_season_fraction; return seaLevelAnnualC(latDeg) + Math.sin(f) / f * Z.seasonal_half_range_pole_K * Math.abs(Math.sin(rad(latDeg))); };
/** Height (m a.s.l.) where trees stop. */
export const treeLineM = (latDeg: number) => Math.max(0, (seaLevelZoneSeasonC(latDeg) - Z.tree_line_growing_season_C) / Z.lapse_K_per_m);
/** Height (m a.s.l.) above which snow and ice never melt. */
export const iceLineM = (latDeg: number) => Math.max(0, (seaLevelZoneSeasonC(latDeg) - Z.ice_line_warm_season_C) / Z.lapse_K_per_m);
/**
 * Continentality (#192, mirrors cover.rs continentality_ratio / tree_line_at_m / ice_line_at_m). The seasonal swing is the
 * zonal 15.5 K half-range times the site's land/ocean damping mix over the band's mix (zonal_land_fraction). Damping is the
 * first-order column response 1/sqrt(1+(w tau)^2), tau = (C + air column) / (B + C_tr), with the simulation's constants
 * (surface/heat_capacity.rs, climate_seed.rs, energy/longwave.rs). The weight is exp(-coast / L), L the boundary-layer decay
 * length (atmosphere/wind.rs ocean_decay_length_m: ABL depth / bulk transfer coefficient over forest roughness).
 */
const OCEAN_HEATCAP = 4.18e6 * 50, LAND_HEATCAP = 2.0e6 * 0.5, AIR_COLUMN_HEATCAP = 1.0e7, OLR_B = 2.09, TRANSPORT_C = 3.87;
const KAPPA = 0.41, BULK_WIND_HEIGHT_M = 10, FOREST_Z0 = 1.5, ABL_DEPTH_M = 1000;
const seasonalDamping = (c: number) => { const w = 2 * Math.PI / (365 * 86400); return 1 / Math.sqrt(1 + (w * (c + AIR_COLUMN_HEATCAP) / (OLR_B + TRANSPORT_C)) ** 2); };
/** Ocean influence decay length (m), same as wind.rs ocean_decay_length_m. */
export const oceanDecayLengthM = () => ABL_DEPTH_M / (KAPPA * KAPPA / Math.log(BULK_WIND_HEIGHT_M / FOREST_Z0) ** 2);
/** Maritime weight for a land site coastM from the sea, or null when unknown (NaN, negative, undefined): zonal lines then. */
export const siteMaritimeWeight = (coastM: number | undefined): number | null =>
  coastM == null || !Number.isFinite(coastM) || coastM < 0 ? null : Math.exp(-Math.max(0, coastM) / oceanDecayLengthM());
/** Site seasonal swing over the zonal mean (1.34x deep inland at 60-70 N, ~0.2x on open water). */
export function continentalityRatio(maritimeW: number): number {
  const dl = seasonalDamping(LAND_HEATCAP), dO = seasonalDamping(OCEAN_HEATCAP), w = Math.min(1, Math.max(0, maritimeW)), f = Z.zonal_land_fraction;
  return (w * dO + (1 - w) * dl) / (f * dl + (1 - f) * dO);
}
export const seaLevelZoneSeasonAtC = (latDeg: number, maritimeW: number) => { const f = Math.PI * Z.zone_season_fraction, x = Math.sin(rad(latDeg)); return Z.T0_C + Z.T2_C * (3 * x * x - 1) / 2 + Math.sin(f) / f * Z.seasonal_half_range_pole_K * Math.abs(x) * continentalityRatio(maritimeW); };
/** Tree line (m) with the site's continentality. */
export const treeLineAtM = (latDeg: number, maritimeW: number) => Math.max(0, (seaLevelZoneSeasonAtC(latDeg, maritimeW) - Z.tree_line_growing_season_C) / Z.lapse_K_per_m);
/** Ice line (m) with the site's continentality. */
export const iceLineAtM = (latDeg: number, maritimeW: number) => Math.max(0, (seaLevelZoneSeasonAtC(latDeg, maritimeW) - Z.ice_line_warm_season_C) / Z.lapse_K_per_m);
/** Tree line below this (m) means Arctic: above it is tundra up to the ice line, not bare rock (#192 owner call). Matches cover.rs. */
export const ARCTIC_TREE_LINE_M = 80;
export type Zone = 'forest' | 'tundra' | 'rock' | 'ice';
/** Zone at a height: 'forest' (trees grow), 'tundra' (Arctic, above a near-sea-level tree line: low plants, no trees), 'rock' (mountain above the tree line), 'ice'. */
export function zoneAt(altM: number, latDeg: number): Zone {
  if (altM >= iceLineM(latDeg)) return 'ice';
  const tree = treeLineM(latDeg);
  return altM < tree ? 'forest' : tree < ARCTIC_TREE_LINE_M ? 'tundra' : 'rock';
}
/** Game-local height (core/world heightAt metres) -> metres above sea level. Home uses PLANET.home.elevation. A remote landing uses that site's own datum. */
export const gameAltitudeM = (h: number) => siteDatum(PLANET.home.elevation) + (h - LEVEL.waterSurface);
const localZone = (h: number) => zoneAt(gameAltitudeM(h), siteLatitude(PLANET.home.latDeg));
/** Can trees (and forest animals) grow at this game-local height? Home latitude unless a landing moved the frame. */
export const plantsGrowAt = (h: number) => localZone(h) === 'forest';
/** Can low ground plants (herbs, berries) grow here? Forest or Arctic tundra; never mountain rock or ice. */
export const groundPlantsGrowAt = (h: number) => { const z = localZone(h); return z === 'forest' || z === 'tundra'; };
