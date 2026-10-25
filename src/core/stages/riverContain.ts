/**
 * Share of drawn river length whose surface stands above unconfined ground (T-0029).
 * 1 m beyond the drawn sheet (half + bank + 1 m), on either side: if that point is not already water, the ground
 * there must be within 2 cm of the surface. Hydrostatics: a free surface over unconfined ground spreads until it
 * meets the ground (the same test as refs/water/river-audit/contained.ts).
 */
import { STAGES } from './elevation';
import { riverAt, riverAuditPoints, riverGrid } from './rivers';
import { surfaceAt } from './surfaceAt';

export interface Containment {
  segments: number;
  openShare: number;
  flatShare: number;
  openAmongFlat: number;
  openAmongSloped: number;
  edgeHeightM: { p10: number; med: number; p90: number } | null;
}

/** One point on each curved centreline piece. `open` = surface more than 2 cm above dry ground 1 m beyond the sheet.
 *  A sample the centreline query misses (d > 0.5 m) counts as open: skipping it would hide a planform bug. */
export function riverContainment(seed = STAGES.seed): Containment {
  riverGrid(seed);
  let total = 0, open = 0, openFlat = 0, flat = 0; const lift: number[] = [];
  for (const s of riverAuditPoints(seed)) {
    const h = riverAt(seed, s.x, s.z);
    total++;
    if (!h || h.d > 0.5) { open++; continue; }
    const isFlat = h.speed < .1; if (isFlat) flat++;
    let worst = -Infinity;
    for (const side of [1, -1]) {
      const off = h.half + h.bank + 1, px = s.x - h.dirZ * side * off, pz = s.z + h.dirX * side * off, p = surfaceAt(px, pz, seed);
      if (!p.lake && !p.river) worst = Math.max(worst, h.surface - p.height);
    }
    if (worst > .02) { open++; if (isFlat) openFlat++; lift.push(worst); }
  }
  lift.sort((a, b) => a - b);
  const q = (p: number) => +lift[Math.min(lift.length - 1, Math.floor(lift.length * p))].toFixed(2);
  return {
    segments: total, openShare: +(open / Math.max(1, total)).toFixed(3), flatShare: +(flat / Math.max(1, total)).toFixed(3),
    openAmongFlat: +(openFlat / Math.max(1, flat)).toFixed(3), openAmongSloped: +((open - openFlat) / Math.max(1, total - flat)).toFixed(3),
    edgeHeightM: lift.length ? { p10: q(.1), med: q(.5), p90: q(.9) } : null,
  };
}
