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
