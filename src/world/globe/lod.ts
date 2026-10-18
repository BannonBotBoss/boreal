/**
 * Globe LOD tiers (Grok Bot): the globe's knobs per quality-ladder tier (core/quality LADDER order, Ultra → Minimum).
 * One data table; the governor picks the row, `applied().lod` scales the split distance like every other LOD in the game.
 */
import { applied, GOVERNOR } from '../../core/quality';

export const GLOBE_LOD = [
  // segments per tile edge, split factor (× tile edge), shallowest + deepest level, tile cache cap  [game calibration]
  { name: 'Ultra',    segments: 48, split: 1.8, minLevel: 2, maxLevel: 19, cache: 1400 },
  { name: 'High',     segments: 40, split: 1.7, minLevel: 2, maxLevel: 18, cache: 1100 },
  { name: 'Medium',   segments: 32, split: 1.6, minLevel: 2, maxLevel: 18, cache: 900 },
  { name: 'Low',      segments: 28, split: 1.5, minLevel: 1, maxLevel: 17, cache: 700 },
  { name: 'Very low', segments: 24, split: 1.4, minLevel: 1, maxLevel: 16, cache: 500 },
  { name: 'Minimum',  segments: 16, split: 1.25, minLevel: 1, maxLevel: 15, cache: 350 },
];
/** Knobs for the governor's current tier, with the player's LOD multiplier (renderSettings caps) folded in. */
export function globeLod(tier = GOVERNOR.tier) {
  const row = GLOBE_LOD[Math.max(0, Math.min(GLOBE_LOD.length - 1, tier))], t = applied(tier);
  return { ...row, split: row.split * t.lod, resScale: t.resScale };
}
