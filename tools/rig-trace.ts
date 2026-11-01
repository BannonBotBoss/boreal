// T-0044 run 15 (grok-gait): rig trace for stick-figure slow motion (main hides the procedural hare body, so the close-up page shows no
// hare): the hare plan with the fore lock on, at 240 Hz, limbPoints of each leg + contacts per frame, as JSON.
// npx tsx tools/rig-trace.ts <V m/s> <out.json> [from=2.5] [to=4]
import { writeFileSync } from 'node:fs';
import { createBounding, GIRDLE, selectRow, limbPoints } from '../src/animals/locomotion/bounding';
import { HOST_GAIT, planFor, poseFor } from './bound-plans';
const [vA, out, fromA = '2.5', toA = '4'] = process.argv.slice(2), v = Number(vA), hz = 240, sk = planFor('hare');
const c = createBounding(sk, HOST_GAIT, () => 0, { x: 0, z: 0, heading: 0 }, GIRDLE, { pose: poseFor('hare'), foreLock: true }), frames: any[] = [];
for (let n = 0; n / hz < Number(toA); n++) { const t = n / hz, f: any = c.update(1 / hz, Math.min(v, v * t / 1.5), 0, null, selectRow(v));
  if (t >= Number(fromA)) frames.push({ t: +t.toFixed(4), x: f.x, z: f.z, legs: [0, 1, 2, 3].map(i => limbPoints(sk, f, i).map(p => [+p.x.toFixed(5), +p.y.toFixed(5), +p.z.toFixed(5)])), contact: f.contact, soles: f.soles.map((p: any) => [p.x, p.y, p.z]) }); }
writeFileSync(out, JSON.stringify({ v, hz, frames })); console.log(out, frames.length);