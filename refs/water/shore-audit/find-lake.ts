// npx tsx refs/water/shore-audit/find-lake.ts : nearest staged (stage 2b) lakes/ponds to spawn, with a dry viewpoint facing each
import { surfaceAt } from '../../../src/core/stages/surfaceAt';
const found: any[] = [];
for (let r = 100; r <= 5000 && found.length < 4; r += 40) { const k = Math.round(2 * Math.PI * r / 40);
  for (let i = 0; i < k && found.length < 4; i++) { const a = i / k * 2 * Math.PI, x = Math.cos(a) * r, z = Math.sin(a) * r, p = surfaceAt(x, z);
    if (!p.lake || p.lake.kind === 'open' || found.some(f => Math.hypot(f.lake[0] - x, f.lake[1] - z) < 400)) continue;
    // walk outward from the lake point along 8 bearings to the first dry ground 3 m past the edge, facing back at the lake
    for (let b = 0; b < 8; b++) { const ba = b / 8 * 2 * Math.PI; let edge = 0;
      for (let s = 2; s < 300; s += 2) { const q = surfaceAt(x + Math.cos(ba) * s, z + Math.sin(ba) * s); if (!q.lake && !q.river) { edge = s; break; } }
      if (!edge) continue; const vx = x + Math.cos(ba) * (edge + 4), vz = z + Math.sin(ba) * (edge + 4), q = surfaceAt(vx, vz);
      if (q.lake || q.river || q.height < p.lake.surface + .3) continue;
      const dx = x - vx, dz = z - vz;
      found.push({ lake: [Math.round(x), Math.round(z)], kind: p.lake.kind, areaHa: +p.lake.areaHa.toFixed(2), surface: +p.lake.surface.toFixed(2), view: [+vx.toFixed(1), +vz.toFixed(1), +Math.atan2(-dx, -dz).toFixed(3)], edgeM: edge, viewH: +q.height.toFixed(2) }); break; } } }
console.log(JSON.stringify(found, null, 1));
