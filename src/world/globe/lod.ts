/**
 * Globe LOD tiers (Grok Bot): the globe's knobs per quality-ladder tier (core/quality LADDER order, Ultra → Minimum).
 * One data table; the governor picks the row, `applied().lod` scales the split distance like every other LOD in the game.
 */
import { applied, GOVERNOR } from '../../core/quality';

export const GLOBE_LOD = [
  // segments per tile edge, split factor (× tile edge), shallowest + deepest level, tile cache cap, cap on tiles drawn
  // inside the view (the split shrinks until the view fits; Quest-class devices sit on the bottom rows)  [game calibration]
  { name: 'Ultra',    segments: 48, split: 1.8, minLevel: 2, maxLevel: 19, cache: 1400, draw: 160 },
  { name: 'High',     segments: 40, split: 1.7, minLevel: 2, maxLevel: 18, cache: 1100, draw: 130 },
  { name: 'Medium',   segments: 32, split: 1.6, minLevel: 2, maxLevel: 18, cache: 900, draw: 110 },
  { name: 'Low',      segments: 28, split: 1.4, minLevel: 1, maxLevel: 17, cache: 700, draw: 90 },
  { name: 'Very low', segments: 24, split: 1.25, minLevel: 1, maxLevel: 16, cache: 500, draw: 70 },
  { name: 'Minimum',  segments: 16, split: 1.1, minLevel: 1, maxLevel: 15, cache: 350, draw: 50 },
];
/** The tier the world (tile rows: resolution, split, depth, caps) follows: core/quality keeps the world on `worldTier` until
 *  a new tier has held `worldHoldMs`, so a governor step never rebuilds every tile; manual / reset: the tier itself. */
export const worldTier = () => GOVERNOR.auto && GOVERNOR.worldTier >= 0 ? GOVERNOR.worldTier : GOVERNOR.tier;
/** Knobs for the governor's current tier: the tile row from the held world tier, the player's LOD multiplier and the
 *  resolution scale from applied() (which itself holds the world knobs back the same way). */
export function globeLod(tier = GOVERNOR.tier) {
  const t = applied(tier), wt = tier === GOVERNOR.tier ? worldTier() : tier, row = GLOBE_LOD[Math.max(0, Math.min(GLOBE_LOD.length - 1, wt))];
  return { ...row, split: row.split * t.lod, resScale: t.resScale };
}
