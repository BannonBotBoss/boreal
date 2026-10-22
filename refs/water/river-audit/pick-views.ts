// Picks three river sites nearest spawn for recording (claude loop): a slow order-1 reach (< 0.1 m/s, the flat-fill speed
// floor), a fast order-1 reach (at the 3 m/s clamp) and the nearest order-2 reach. Each gets a dry bank point and game
// headings (proc/math stepForward: heading 0 faces -z, pi/2 faces -x) across the river and downstream along it.
// npx tsx refs/water/river-audit/pick-views.ts > refs/water/river-audit/views.json
import { riverAt } from '../../../src/core/stages/rivers';
import { surfaceAt } from '../../../src/core/stages/surfaceAt';
import { STAGES } from '../../../src/core/stages/elevation';
import { LEVEL } from '../../../src/core/tuning';

const seed = STAGES.seed, spawn = [30, 0], R = 3840, step = 10;
const heading = (dx: number, dz: number) => +Math.atan2(-dx, -dz).toFixed(3);
const dry = (x: number, z: number) => { const p = surfaceAt(x, z); return !p.lake && !p.river && p.height > LEVEL.waterSurface + .6; };
const sites: Record<string, (r: NonNullable<ReturnType<typeof riverAt>>) => boolean> = {
  slow1: r => r.order === 1 && r.speed < .1, fast1: r => r.order === 1 && r.speed >= 2.99, order2: r => r.order === 2,
};
const out: Record<string, unknown> = {};
for (const [name, ok] of Object.entries(sites)) {
  let best: { d: number; v: unknown } | undefined;
  for (let x = spawn[0] - R; x <= spawn[0] + R; x += step) for (let z = spawn[1] - R; z <= spawn[1] + R; z += step) {
    const d = Math.hypot(x - spawn[0], z - spawn[1]); if (best && d >= best.d) continue;
    const r = riverAt(seed, x, z); if (!r || r.d > 1 || !ok(r)) continue;
    // the reach must keep this character 15 m up and down stream, so the frame shows one kind of water
    const up = riverAt(seed, x - r.dirX * 15, z - r.dirZ * 15), dn = riverAt(seed, x + r.dirX * 15, z + r.dirZ * 15);
    if (!up || !dn || !ok(up) || !ok(dn)) continue;
    for (const side of [1, -1]) {
      const nx = -r.dirZ * side, nz = r.dirX * side, off = r.half * 1.5 + 3, vx = x + nx * off, vz = z + nz * off;
      if (!dry(vx, vz)) continue;
      best = { d, v: { river: { x, z, order: r.order, widthM: +(2 * r.half).toFixed(2), depthM: +r.depth.toFixed(2), speed: +r.speed.toFixed(2), areaKm2: +r.areaKm2.toFixed(2), dir: [r.dirX, r.dirZ] },
        view: { x: +vx.toFixed(1), z: +vz.toFixed(1), across: heading(x - vx, z - vz), downstream: heading(r.dirX, r.dirZ), upstream: heading(-r.dirX, -r.dirZ) }, distFromSpawn: Math.round(d) } };
      break;
    }
  }
  out[name] = best?.v ?? null;
}
console.log(JSON.stringify(out, null, 1));
