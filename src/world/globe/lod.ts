/**
 * Globe LOD tiers (Grok Bot): the globe's knobs per quality-ladder tier (core/quality LADDER order, Ultra → Minimum).
 * One data table; the governor picks the row, `applied().lod` scales the split distance like every other LOD in the game.
 */
import { applied, GOVERNOR } from '../../core/quality';
import { across, children, type QNode } from './cube';

export const GLOBE_LOD = [
  // segments per tile edge, split factor (× tile edge), shallowest + deepest level, tile cache cap, cap on tiles drawn
  // inside the view (the split shrinks until the view fits; Quest-class devices sit on the bottom rows), ground detail
  // strength (tile.ts DETAIL, a uniform: 0 skips it)  [game calibration]
  { name: 'Ultra',    segments: 48, split: 1.8, minLevel: 2, maxLevel: 19, cache: 1400, draw: 160, detail: 1 },
  { name: 'High',     segments: 40, split: 1.7, minLevel: 2, maxLevel: 18, cache: 1100, draw: 130, detail: 1 },
  { name: 'Medium',   segments: 32, split: 1.6, minLevel: 2, maxLevel: 18, cache: 900, draw: 110, detail: .8 },
  { name: 'Low',      segments: 28, split: 1.4, minLevel: 1, maxLevel: 17, cache: 700, draw: 90, detail: .6 },
  { name: 'Very low', segments: 24, split: 1.25, minLevel: 1, maxLevel: 16, cache: 500, draw: 70, detail: .4 },
  { name: 'Minimum',  segments: 16, split: 1.1, minLevel: 1, maxLevel: 15, cache: 350, draw: 50, detail: 0 },
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
/** Restricted (2:1 balanced) quadtree: the nodes to split so that no leaf is 2+ levels finer than a neighbour, also across
 *  cube faces, which the edge stitching (one level) then closes. `split` is the distance/frustum test, `keep` drops nodes
 *  that are culled (never drawn). A plain distance split leaves such jumps near the ground at the low split factors
 *  (tests); balancing splits the coarse side, a few extra tiles at most. */
export function balancedTree(roots: QNode[], split: (n: QNode) => boolean, keep: (n: QNode) => boolean = () => true) {
  const splits = new Set<string>(), leaves = new Map<string, QNode>();
  const grow = (n: QNode) => { if (!keep(n)) return; if (split(n)) { splits.add(n.key); for (const c of children(n)) grow(c); } else leaves.set(n.key, n); };
  for (const r of roots) grow(r);
  const queue = [...leaves.values()];
  while (queue.length) {
    const n = queue.pop()!; if (!leaves.has(n.key)) continue;
    for (let e = 0; e < 4; e++) {
      const a = across(n, e);
      for (let l = n.level; l >= 0; l--) {
        const k = `${a.face}/${l}/${a.i >> (n.level - l)}/${a.j >> (n.level - l)}`;
        if (splits.has(k)) break; // the neighbour is as fine or finer (or culled under a split node): nothing to do
        const m = leaves.get(k); if (!m) continue;
        if (n.level - l >= 2) { leaves.delete(k); splits.add(k); for (const c of children(m)) if (keep(c)) { leaves.set(c.key, c); queue.push(c); } queue.push(n); }
        break;
      }
    }
  }
  return { splits, leaves };
}
