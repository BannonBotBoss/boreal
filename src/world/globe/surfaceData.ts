/**
 * Globe surface data (Grok Bot): the per-point facts the globe's look will be driven by (reference-band look, atmosphere
 * pass). One interface, one sampler, game-local metres (home region). Sources:
 *  - lake, soil, wetness (+ river): the rivers/soils owner's one-call lookup core/stages/surfaceAt (DOM-free,
 *    worker-safe). Staged path only, so on the layered terrain these fields are null.
 *  - forest density, dominant tree, season, snow: PLACEHOLDERS (constants flagged in `placeholder`) until the flora owner
 *    and the world clock expose worker-safe lookups (requests in AGENT-NOTES.md).
 */
import { STAGES } from '../../core/stages/elevation';
import { surfaceAt } from '../../core/stages/surfaceAt';
import { heightAt } from '../../core/world';
import { zoneAt, gameAltitudeM } from '../../core/altitudeZones';
import { PLANET } from './planet';
import { siteLatitude } from '../../core/sitePhase';
import type { SoilKind } from '../../core/stages/soils';

export interface SurfaceData {
  lake: { kind: 'pond' | 'lake' | 'open'; depth: number } | null; // water body over this point, depth below its surface (m)
  river: { order: number; widthM: number } | null;      // river channel at this point (Strahler order)
  soil: SoilKind | null;
  wetness: number | null; // 0 dry … 1 saturated (soil class + TWI)
  forest: number;         // canopy density 0..1            [PLACEHOLDER]
  tree: 'spruce' | 'pine' | 'birch' | 'aspen' | 'none'; // dominant tree type [PLACEHOLDER]
  season: number;         // 0 midwinter … .5 midsummer … 1 [PLACEHOLDER]
  snow: number;           // snow cover 0..1                [PLACEHOLDER]
  zone: 'forest' | 'rock' | 'ice'; // T-0072 altitude zone (core/altitudeZones): no plants on rock or ice
  placeholder: { forest: boolean; tree: boolean; season: boolean; snow: boolean };
}
/** Placeholder values: dense boreal spruce in midsummer, no snow (Kenora, July). */
export const SURFACE_PLACEHOLDER = { forest: .75, tree: 'spruce', season: .5, snow: 0 } as const;

/** Surface data at a game-local point (x east, z south, metres). Pure; safe in a worker. */
export function surfaceDataAt(x: number, z: number, seed = STAGES.seed, staged = STAGES.on): SurfaceData {
  let lake: SurfaceData['lake'] = null, river: SurfaceData['river'] = null, soil: SoilKind | null = null, wetness: number | null = null;
  if (staged) {
    const s = surfaceAt(x, z, seed);
    if (s.lake) lake = { kind: s.lake.kind, depth: Math.max(0, s.lake.surface - s.height) };
    if (s.river) river = { order: s.river.order, widthM: s.river.widthM };
    soil = s.soil; wetness = s.wetness;
  }
  const zone = zoneAt(gameAltitudeM(heightAt(x, z)), siteLatitude(PLANET.home.latDeg)) /* landed site's latitude, same frame as plantsGrowAt */, bare = zone !== 'forest';
  return { lake, river, soil, wetness, ...SURFACE_PLACEHOLDER, ...(bare ? { forest: 0, tree: 'none' as const } : {}), ...(zone === 'ice' ? { snow: 1 } : {}), zone,
    placeholder: { forest: !bare, tree: !bare, season: true, snow: zone !== 'ice' } };
}
