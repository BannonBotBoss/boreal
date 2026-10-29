// T-0044 run 12 (grok-gait): elbow / humerus flicker probe. Same cells and gate as tools/touchdown-pop.ts (2*88deg/t_stance*dt;
// 88 deg Schmidt 2008 JEB 211:3775 Table 4, factor 2 an estimate), applied to the elbow joint (|d knee|) and the humerus
// (girdle+leg against the vertical) as well as scapula and manus. DIAG=1 prints each over-gate fore frame with blade / psi / knee.
// npx tsx tools/elbow-pop.ts [env VS, HZ, LOCK=0|1, DIAG=1, SET=k=v,... (FORE_LOCK / FORE_JOINT / FORE_SOFT keys; FORE_SOFT's as soft.k)]
// run 13: also the fore paw-to-target miss (|sole - target| world, mm) per phase, and the smallest elbow bend at plant / stance.
import { createBounding, GIRDLE, selectRow, FORE_LOCK, FORE_JOINT, FORE_SOFT } from '../src/animals/locomotion/bounding';
for (const kv of (process.env.SET ?? '').split(',').filter(Boolean)) { const [k, x] = kv.split('='); if (k.startsWith('soft.')) (FORE_SOFT as any)[k.slice(5)] = Number(x); else if (k in FORE_LOCK) (FORE_LOCK as any)[k] = Number(x); else if (k in FORE_JOINT) (FORE_JOINT as any)[k] = Number(x); } // tuning sweeps only
import { HOST_GAIT, planFor, poseFor } from './bound-plans';
import { limbToWorld } from '../src/animals/locomotion/controller';
import { forearmBelowDeg } from '../src/animals/locomotion/touchdownPlan';
/** forearm angle below horizontal (deg) in the world, the run 11 contact band's measure (the hip offset cancels in the difference) */
const foreDeg = (f: any, a: any) => { const a1 = a.girdle + a.leg, a2 = a1 + a.knee, U = .0712, L = .0803; // the forearm direction depends on a2 only, so these lengths do not change the angle
  const k = { x: 0, z: a.joint.z - U * Math.sin(a1), y: a.joint.y - U * Math.cos(a1) }, w = { x: 0, z: k.z - L * Math.sin(a2), y: k.y - L * Math.cos(a2) };
  const K = limbToWorld(k, f.x, f.z, f.heading, f.tilt, [0, 0]), W = limbToWorld(w, f.x, f.z, f.heading, f.tilt, [0, 0]); return forearmBelowDeg(K.x, K.y, K.z, W.x, W.y, W.z); };
const D = 180 / Math.PI, wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const J = { scap: (a: any) => a.girdle, hum: (a: any) => a.girdle + a.leg, elbow: (a: any) => a.knee, manus: (a: any) => a.girdle + a.leg + a.knee + a.wrist } as const;
type K = keyof typeof J; const KS = Object.keys(J) as K[];
const zero = () => ({ scap: 0, hum: 0, elbow: 0, manus: 0 }) as Record<K, number>;
export function elbowCell(v: number, hz: number, foreLock = true, secs = 4, diag = false) {
  const c = createBounding(planFor('hare'), HOST_GAIT, () => 0, { x: 0, z: 0, heading: 0 }, GIRDLE, { pose: poseFor('hare'), foreLock });
  const miss = { plant: [0, 0, 0], stance: [0, 0, 0], swing: [0, 0, 0] } as Record<string, number[]>, bend = { plant: 999, stance: 999 }, cont = [999, -999]; // [sum, n, max] mm; min |knee| deg
  const M = (ph: string, f: any, i: number) => { const a = f.soles[i], b = f.feet[i], m = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) * 1000, r = miss[ph]; r[0] += m; r[1]++; r[2] = Math.max(r[2], m); };
  let last: any, gate = 0, plants = 0, under = 0; const plant = zero(), rest = zero(), overP = zero(), overS = zero(), air = zero(), overA = zero();
  for (let n = 0; n / hz < secs; n++) {
    const f: any = c.update(1 / hz, Math.min(v, v * n / hz / 1.5), 0, null, selectRow(v));
    gate = 2 * 88 / (f.plan.duties[0] / f.plan.hz) / hz;
    if (last && n / hz > 2) for (const i of [0, 2]) if (!f.contact[i] && !last.contact[i]) { // swing (both frames in the air): reported, not gated by T-0044
      if (f.soles[i].y < -1e-3) under++; M('swing', f, i);
      for (const k of KS) { const d = Math.abs(wrap(J[k](f.limbs[i]) - J[k](last.limbs[i]))) * D; air[k] = Math.max(air[k], d); if (d > gate) overA[k]++; }
    } else if (last && n / hz > 2 && (f.contact[i] || last.contact[i])) {
      const isPlant = f.contact[i] && !last.contact[i]; if (isPlant) plants++;
      if (f.contact[i]) { const ph = isPlant ? 'plant' : 'stance'; M(ph, f, i); (bend as any)[ph] = Math.min((bend as any)[ph], Math.abs(f.limbs[i].knee) * D); if (isPlant) { const c0 = foreDeg(f, f.limbs[i]); cont[0] = Math.min(cont[0], c0); cont[1] = Math.max(cont[1], c0); } }
      const line: string[] = [];
      for (const k of KS) { const d = Math.abs(wrap(J[k](f.limbs[i]) - J[k](last.limbs[i]))) * D;
        (isPlant ? plant : rest)[k] = Math.max((isPlant ? plant : rest)[k], d);
        if (d > gate) { (isPlant ? overP : overS)[k]++; line.push(`${k} ${d.toFixed(0)}`); } }
      if (diag && line.length) { const a = last.limbs[i], b = f.limbs[i];
        console.log(`  t ${(n / hz).toFixed(3)} leg ${i} ${isPlant ? 'PLANT' : (f.contact[i] ? 'stance' : 'lift')} [${line.join(', ')}] blade ${(a.girdle * D).toFixed(1)}->${(b.girdle * D).toFixed(1)} knee ${(a.knee * D).toFixed(1)}->${(b.knee * D).toFixed(1)} leg ${(a.leg * D).toFixed(1)}->${(b.leg * D).toFixed(1)} wrist ${(a.wrist * D).toFixed(1)}->${(b.wrist * D).toFixed(1)}`); }
    }
    last = f;
  }
  return { gate, plants, plant, rest, overP, overS, air, overA, under, miss, bend, cont };
}
if (process.argv[1]?.includes('elbow-pop')) {
  const V = (process.env.VS ?? '5,8.5,10,11.6').split(',').map(Number), H = (process.env.HZ ?? '60,120,240').split(',').map(Number), lock = process.env.LOCK !== '0', f = (x: number) => x.toFixed(1);
  console.log(`lock ${lock} | v hz | gate | plants | plant max scap hum elbow manus (over) | stance+lift max scap hum elbow manus (over)  deg/frame`);
  for (const v of V) for (const hz of H) { const r = elbowCell(v, hz, lock, 4, process.env.DIAG === '1');
    const row = (m: Record<K, number>, o: Record<K, number>) => KS.map(k => `${f(m[k])}(${o[k]})`).join(' ');
    console.log(`${v} ${hz} | ${f(r.gate)} | ${r.plants} | ${row(r.plant, r.overP)} | ${row(r.rest, r.overS)} | swing ${row(r.air, r.overA)} under ${r.under} | miss mm mean/max plant ${(r.miss.plant[0] / Math.max(1, r.miss.plant[1])).toFixed(2)}/${r.miss.plant[2].toFixed(1)} stance ${(r.miss.stance[0] / Math.max(1, r.miss.stance[1])).toFixed(2)}/${r.miss.stance[2].toFixed(1)} swing ${(r.miss.swing[0] / Math.max(1, r.miss.swing[1])).toFixed(2)}/${r.miss.swing[2].toFixed(1)} | min bend plant ${f(r.bend.plant)} stance ${f(r.bend.stance)} | touchdown forearm ${f(r.cont[0])}-${f(r.cont[1])}`); }
}