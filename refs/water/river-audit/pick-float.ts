// Nearest-to-spawn river segment whose surface stands > 2 m above the ground just beyond the sheet; view from that low
// ground (8 m out) facing the river. Adds site 'float' to views.json. npx tsx refs/water/river-audit/pick-float.ts
import { readFileSync, writeFileSync } from 'node:fs';
import { riverGrid, riverAt } from '../../../src/core/stages/rivers';
import { surfaceAt } from '../../../src/core/stages/surfaceAt';
import { flowGrid, STAGES } from '../../../src/core/stages/elevation';
const seed = STAGES.seed, R = riverGrid(seed), f = flowGrid(seed), n = R.n, s = R.cell, spawn = [30, 0];
let best: any;
for (let c = 0; c < n * n; c++) {
  if (!R.drawn[c]) continue; const r = f.dir[c]; if (r < 0) continue;
  const ox = ((r % n) - (c % n) + n + 1) % n - 1, oz = (((r / n) | 0) - ((c / n) | 0) + n + 1) % n - 1;
  let x = ((c % n) + ox * .5) * s, z = (((c / n) | 0) + oz * .5) * s; const W = n * s; // unwrap to the copy nearest spawn
  x -= Math.round((x - spawn[0]) / W) * W; z -= Math.round((z - spawn[1]) / W) * W;
  const h = riverAt(seed, x, z); if (!h || h.d > 1) continue; const d = Math.hypot(x - spawn[0], z - spawn[1]); if (best && d >= best.d) continue;
  for (const side of [1, -1]) { const nx = -h.dirZ * side, nz = h.dirX * side, off = h.half + h.bank + 1, p = surfaceAt(x + nx * off, z + nz * off);
    const vx = x + nx * (h.half + h.bank + 8), vz = z + nz * (h.half + h.bank + 8), q = surfaceAt(vx, vz);
    if (!p.lake && !p.river && h.surface - p.height > 2 && !q.lake && !q.river) { best = { d, v: { river: { x, z, order: h.order, widthM: +(2 * h.half).toFixed(2), speed: +h.speed.toFixed(2), surface: +h.surface.toFixed(2), groundBeyond: +p.height.toFixed(2), dir: [h.dirX, h.dirZ] },
      view: { x: +vx.toFixed(1), z: +vz.toFixed(1), across: +Math.atan2(nx, nz).toFixed(3), downstream: +Math.atan2(-h.dirX, -h.dirZ).toFixed(3) }, distFromSpawn: Math.round(d) } }; break; } }
}
const views = JSON.parse(readFileSync('refs/water/river-audit/views.json', 'utf8')); views.float = best.v; writeFileSync('refs/water/river-audit/views.json', JSON.stringify(views, null, 1)); console.log(JSON.stringify(best.v));
