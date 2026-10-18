/**
 * Globe surface data (Grok Bot): the per-point facts the globe's look will be driven by (reference-band look, atmosphere
 * pass). One interface, one sampler, game-local metres (home region). Sources:
 *  - lake, soil, wetness: the rivers/soils owner's lookups (core/stages lakeAt, soilAt). They are pure and DOM-free (they
 *    import only proc/rng and tuning), so they already run in the tile workers; they exist only on the staged path, so
 *    on the layered terrain these fields are null.
 *  - forest density, dominant tree, season, snow: PLACEHOLDERS (constants flagged in `placeholder`) until the flora owner
 *    and the world clock expose worker-safe lookups (requests in AGENT-NOTES.md).
 */
import { lakeAt, STAGES } from '../../core/stages/elevation';
import { heightAt } from '../../core/world';
import { soilAt, type SoilKind } from '../../core/stages/soils';

export interface SurfaceData {
  lake: { kind: 'pond' | 'lake'; depth: number } | null; // water body over this point, depth below its level (m)
  soil: SoilKind | null;
  wetness: number | null; // 0 dry … 1 saturated (soil class + TWI)
  forest: number;         // canopy density 0..1            [PLACEHOLDER]
  tree: 'spruce' | 'pine' | 'birch' | 'aspen' | 'none'; // dominant tree type [PLACEHOLDER]
  season: number;         // 0 midwinter … .5 midsummer … 1 [PLACEHOLDER]
  snow: number;           // snow cover 0..1                [PLACEHOLDER]
  placeholder: { forest: boolean; tree: boolean; season: boolean; snow: boolean };
}
/** Placeholder values: dense boreal spruce in midsummer, no snow (Kenora, July). */
export const SURFACE_PLACEHOLDER = { forest: .75, tree: 'spruce', season: .5, snow: 0 } as const;

/** Surface data at a game-local point (x east, z south, metres). Pure; safe in a worker. */
export function surfaceDataAt(x: number, z: number, seed = STAGES.seed, staged = STAGES.on): SurfaceData { // heightAt follows STAGES: pass the live values
  let lake: SurfaceData['lake'] = null, soil: SoilKind | null = null, wetness: number | null = null;
  if (staged) {
    const lk = lakeAt(seed, x, z);
    if (lk) lake = { kind: lk.kind, depth: Math.max(0, lk.surface - heightAt(x, z)) };
    const so = soilAt(seed, x, z); soil = so.kind; wetness = so.wet;
  }
  return { lake, soil, wetness, ...SURFACE_PLACEHOLDER, placeholder: { forest: true, tree: true, season: true, snow: true } };
}
