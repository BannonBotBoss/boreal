// River inspection probe (claude loop, 2026-10-21): every drawn river reach within R of spawn, with its Strahler order,
// bankfull width/depth (Bieger 2015 regional curve), Manning speed and slope, plus a dry bank viewpoint for each.
// npx tsx refs/water/river-audit/find-river.ts > refs/water/river-audit/rivers.json
import { riverAt, riverGrid } from '../../../src/core/stages/rivers';
import { surfaceAt } from '../../../src/core/stages/surfaceAt';
import { STAGES } from '../../../src/core/stages/elevation';
import { LEVEL } from '../../../src/core/tuning';

const seed = STAGES.seed, R = +(process.argv[2] ?? 1500), step = +(process.argv[3] ?? 10), spawn = [30, 0];
type Hit = { x: number; z: number; order: number; widthM: number; depthM: number; speed: number; areaKm2: number; dirX: number; dirZ: number; surface: number };
const hits: Hit[] = [];
for (let x = spawn[0] - R; x <= spawn[0] + R; x += step) for (let z = spawn[1] - R; z <= spawn[1] + R; z += step) {
  const r = riverAt(seed, x, z); if (!r || r.d > 1) continue; // on the centreline
  hits.push({ x, z, order: r.order, widthM: +(2 * r.half).toFixed(2), depthM: +r.depth.toFixed(2), speed: +r.speed.toFixed(2), areaKm2: +r.areaKm2.toFixed(2), dirX: r.dirX, dirZ: r.dirZ, surface: +r.surface.toFixed(2) });
}
// one viewpoint per order: the hit nearest spawn, standing on dry ground 1.5 half-widths + 3 m to the side, facing the water
const byOrder: Record<number, unknown> = {};
for (const o of [...new Set(hits.map(h => h.order))].sort()) {
  const hs = hits.filter(h => h.order === o).sort((a, b) => Math.hypot(a.x - spawn[0], a.z - spawn[1]) - Math.hypot(b.x - spawn[0], b.z - spawn[1]));
  for (const h of hs) {
    let view;
    for (const side of [1, -1]) {
      const nx = -h.dirZ * side, nz = h.dirX * side, off = h.widthM * .75 + 3, vx = h.x + nx * off, vz = h.z + nz * off, p = surfaceAt(vx, vz);
      if (!p.lake && !p.river && p.height > LEVEL.waterSurface + .6) { view = { x: +vx.toFixed(1), z: +vz.toFixed(1), yawAcross: +Math.atan2(nx, nz).toFixed(3), groundM: +p.height.toFixed(2) }; break; }
    }
    if (view) { byOrder[o] = { reach: h, view, distFromSpawn: Math.round(Math.hypot(h.x - spawn[0], h.z - spawn[1])) }; break; }
  }
}
const G = riverGrid(seed), drawn = G.drawn.reduce((s, v) => s + v, 0), ords: Record<number, number> = {};
for (let c = 0; c < G.order.length; c++) if (G.drawn[c]) ords[G.order[c]] = (ords[G.order[c]] ?? 0) + 1;
const widths = (o: number) => { const w = hits.filter(h => h.order === o).map(h => h.widthM).sort((a, b) => a - b); return w.length ? { n: w.length, min: w[0], med: w[w.length >> 1], max: w[w.length - 1] } : null; };
const speeds = (o: number) => { const v = hits.filter(h => h.order === o).map(h => h.speed).sort((a, b) => a - b); return v.length ? { min: v[0], med: v[v.length >> 1], max: v[v.length - 1] } : null; };
console.log(JSON.stringify({ seed, R, step, gridCellM: G.cell, gridN: G.n, maxOrder: G.maxOrder, drawnCells: drawn, drawnLengthKm: +(drawn * G.cell / 1000).toFixed(1),
  worldKm2: +((G.n * G.cell / 1000) ** 2).toFixed(1), cellsByOrder: ords,
  near: Object.fromEntries([...new Set(hits.map(h => h.order))].sort().map(o => [o, { width: widths(o), speed: speeds(o) }])), viewpoints: byOrder }, null, 1));
// speed histogram over every centreline sample (m/s bins) and the share of samples at the 3 m/s clamp
const bins = [0, .05, .1, .2, .3, .5, 1, 2, 2.99, 3.01], hist = bins.slice(0, -1).map((b, i) => ({ from: b, to: bins[i + 1], n: hits.filter(h => h.speed >= b && h.speed < bins[i + 1]).length }));
console.error(JSON.stringify({ samples: hits.length, speedHist: hist, byOrder: Object.fromEntries([1, 2, 3].map(o => [o, { width: widths(o), speed: speeds(o), depth: (() => { const d = hits.filter(h => h.order === o).map(h => h.depthM).sort((a, b) => a - b); return d.length ? [d[0], d[d.length >> 1], d[d.length - 1]] : null; })(), areaKm2: (() => { const a = hits.filter(h => h.order === o).map(h => h.areaKm2).sort((a, b) => a - b); return a.length ? [a[0], a[a.length >> 1], a[a.length - 1]] : null; })() }])) }));
