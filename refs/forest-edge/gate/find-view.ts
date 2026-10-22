/** T-0032 (grok continuing claude): find a second lake view like the T-0023 one (?at=30,0,1.571): eye on dry land, water
 *  starting within 2-12 m ahead, far shore 40-70 m out across the whole +-20 deg fan. Same water test as sightline.ts.
 *  Usage: npx tsx refs/forest-edge/gate/find-view.ts */
import { heightAt } from '../../../src/core/world';
import { LEVEL } from '../../../src/core/tuning';
import { STAGES, lakeAt } from '../../../src/core/stages/elevation';
import { riverAt } from '../../../src/core/stages/rivers';
STAGES.on = true;
const dry = (x: number, z: number) => { if (lakeAt(STAGES.seed, x, z)) return false; const rv = riverAt(STAGES.seed, x, z); return !(rv && rv.d < rv.half + rv.bank) && heightAt(x, z) > LEVEL.waterSurface; };
function shore(x: number, z: number, a: number) { const fx = -Math.sin(a), fz = -Math.cos(a); let w0 = -1;
  for (let d = 0; d < 120; d += .5) { const D = dry(x + fx * d, z + fz * d); if (w0 < 0 && !D) w0 = d; if (w0 >= 0 && D) return [w0, d]; } return [w0, -1]; }
const out: any[] = [];
console.log('t0023', [-.35, -.17, 0, .17, .35].map(da => shore(30, 0, 1.571 + da)));
for (let x = -1000; x <= 1000; x += 8) for (let z = -1000; z <= 1000; z += 8) { if (!dry(x, z)) continue;
  for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) { let ok = true, far = 0, near = 0;
    for (const da of [-.35, -.17, 0, .17, .35]) { const [w0, d] = shore(x, z, yaw + da); if (w0 < 2 || w0 > 25 || d < 40 || d > 90) { ok = false; break; } far += d / 5; near += w0 / 5; }
    if (ok && Math.hypot(x - 30, z) > 150) out.push({ x, z, yaw: +yaw.toFixed(3), near: +near.toFixed(1), far: +far.toFixed(1) }); } }
out.sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z));
console.log(JSON.stringify(out.slice(0, 15)));