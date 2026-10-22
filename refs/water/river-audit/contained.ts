// Share of river length whose water surface is NOT contained by its banks: 1 m beyond the drawn sheet (half + bank + 1 m),
// on either side, the ground is lower than the river surface, so the sheet ends in an edge standing above dry ground.
// Sampled at the midpoint of every drawn D8 segment. npx tsx refs/water/river-audit/contained.ts > .../contained.json
import { riverGrid, riverAt } from '../../../src/core/stages/rivers';
import { surfaceAt } from '../../../src/core/stages/surfaceAt';
import { flowGrid, STAGES } from '../../../src/core/stages/elevation';

const seed = STAGES.seed, R = riverGrid(seed), f = flowGrid(seed), n = R.n, s = R.cell;
let total = 0, open = 0, openFlat = 0, flat = 0; const lift: number[] = [];
for (let c = 0; c < n * n; c++) {
  if (!R.drawn[c]) continue; const r = f.dir[c]; if (r < 0) continue;
  const ox = ((r % n) - (c % n) + n + 1) % n - 1, oz = (((r / n) | 0) - ((c / n) | 0) + n + 1) % n - 1;
  const x = ((c % n) + ox * .5) * s, z = (((c / n) | 0) + oz * .5) * s, h = riverAt(seed, x, z); if (!h || h.d > 1) continue;
  total++; const isFlat = h.speed < .1; if (isFlat) flat++;
  let worst = -Infinity;
  for (const side of [1, -1]) { const off = h.half + h.bank + 1, px = x - h.dirZ * side * off, pz = z + h.dirX * side * off, p = surfaceAt(px, pz);
    if (!p.lake && !p.river) worst = Math.max(worst, h.surface - p.height); }
  if (worst > .02) { open++; if (isFlat) openFlat++; lift.push(worst); }
}
lift.sort((a, b) => a - b);
console.log(JSON.stringify({ segments: total, openShare: +(open / total).toFixed(3), flatShare: +(flat / total).toFixed(3), openAmongFlat: +(openFlat / Math.max(1, flat)).toFixed(3),
  openAmongSloped: +((open - openFlat) / Math.max(1, total - flat)).toFixed(3), edgeHeightM: lift.length ? { p10: +lift[Math.floor(lift.length * .1)].toFixed(2), med: +lift[lift.length >> 1].toFixed(2), p90: +lift[Math.floor(lift.length * .9)].toFixed(2) } : null }, null, 1));
