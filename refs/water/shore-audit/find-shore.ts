// Run: npx tsx refs/water/shore-audit/find-shore.ts  -> nearest lake shore spots to the start, with a yaw facing the water.
import { surfaceAt, dryStart } from '../../../src/core/stages/surfaceAt';
const [sx, sz] = dryStart(0, 0);
const hits: { x: number; z: number; r: number; yaw: number; kind: string; areaHa: number; surface: number; h: number }[] = [];
for (let r = 20; r <= 900 && hits.length < 6; r += 10) {
  const k = Math.round(2 * Math.PI * r / 10);
  for (let i = 0; i < k; i++) {
    const a = i / k * 2 * Math.PI, x = sx + Math.cos(a) * r, z = sz + Math.sin(a) * r, p = surfaceAt(x, z);
    if (!p.lake || p.lake.kind === 'open') continue;
    // step back toward the start until dry: that is the shore; yaw: heading 0 = -z (proc/math stepForward), facing the lake
    for (let b = 1; b < 60; b++) { const bx = x - Math.cos(a) * b, bz = z - Math.sin(a) * b, q = surfaceAt(bx, bz);
      if (!q.lake && !q.river) { const dx = x - bx, dz = z - bz, yaw = Math.atan2(-dx, -dz);
        hits.push({ x: +(bx - Math.cos(a) * 4).toFixed(1), z: +(bz - Math.sin(a) * 4).toFixed(1), r, yaw: +yaw.toFixed(3), kind: p.lake.kind, areaHa: +p.lake.areaHa.toFixed(2), surface: +p.lake.surface.toFixed(2), h: +q.height.toFixed(2) }); break; } }
    i += Math.ceil(k / 6);
    if (hits.length >= 6) break;
  }
}
console.log(JSON.stringify({ start: [sx, sz], hits }, null, 1));
