// T-0009 run 11 (grok-gait): fore touchdown pop probe. Per speed x rate cell: the worst per-frame scapula / humerus / forearm / manus
// turn on the PLANTING frame (swing -> stance) and in stance + lift-off, against the run-9 gate 2*88deg/t_stance*dt
// (88 deg: Schmidt 2008 JEB 211:3775 Table 4; factor 2 an estimate). npx tsx tools/touchdown-pop.ts [env VS, HZ, LOCK=0|1, VERBOSE=1]
import { createBounding, GIRDLE, selectRow, FORE_LOCK, FORE_JOINT, FORE_SOFT, FORE_PLAN, FORE_STANCE } from '../src/animals/locomotion/bounding';
// run 14: SET="k=v,..." as tools/elbow-pop.ts (soft.* FORE_SOFT, plan.* FORE_PLAN, stance.* FORE_STANCE, else FORE_LOCK / FORE_JOINT)
import { HOST_GAIT, planFor, poseFor } from './bound-plans';
const D = 180 / Math.PI, wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const SEG = { scap: (a: any) => a.girdle, hum: (a: any) => a.girdle + a.leg, fore: (a: any) => a.girdle + a.leg + a.knee, manus: (a: any) => a.girdle + a.leg + a.knee + a.wrist } as const;
export function popCell(v: number, hz: number, foreLock = true, secs = 4, verbose = false) {
  const c = createBounding(planFor('hare'), HOST_GAIT, () => 0, { x: 0, z: 0, heading: 0 }, GIRDLE, { pose: poseFor('hare'), foreLock });
  let last: any, gate = 0; const plant: Record<string, number> = { scap: 0, hum: 0, fore: 0, manus: 0 }, rest: Record<string, number> = { scap: 0, hum: 0, fore: 0, manus: 0 }; let overPlant = 0, overRest = 0, plants = 0;
  for (let n = 0; n / hz < secs; n++) {
    const f: any = c.update(1 / hz, Math.min(v, v * n / hz / 1.5), 0, null, selectRow(v));
    gate = 2 * 88 / (f.plan.duties[0] / f.plan.hz) / hz;
    if (last && n / hz > 2) for (const i of [0, 2]) if (f.contact[i] || last.contact[i]) {
      const isPlant = f.contact[i] && !last.contact[i]; if (isPlant) plants++;
      let o = false;
      for (const k of Object.keys(SEG) as (keyof typeof SEG)[]) { const d = Math.abs(wrap(SEG[k](f.limbs[i]) - SEG[k](last.limbs[i]))) * D;
        const tgt = isPlant ? plant : rest; tgt[k] = Math.max(tgt[k], d);
        if ((k === 'scap' || k === 'manus') && d > gate) o = true; }
      if (o) { if (isPlant) overPlant++; else overRest++; }
      if (verbose && isPlant) { const s = (a: any) => (Object.keys(SEG) as (keyof typeof SEG)[]).map(k => `${k} ${(SEG[k](a) * D).toFixed(0)}`).join(' ');
        console.log(`  t ${(n / hz).toFixed(3)} leg ${i}: swing[${s(last.limbs[i])}] -> stance[${s(f.limbs[i])}]`); }
    }
    last = f;
  }
  return { gate, plants, overPlant, overRest, plant, rest };
}
if (process.argv[1]?.includes('touchdown-pop')) {
  // SET applies only when this file is run as a script (run 14: an inherited SET must not change a test that imports popCell / elbowCell)
  for (const kv of (process.env.SET ?? '').split(',').filter(Boolean)) { const [k, x] = kv.split('='); const n = Number(x); if (k.startsWith('soft.')) (FORE_SOFT as any)[k.slice(5)] = n; else if (k.startsWith('plan.')) (FORE_PLAN as any)[k.slice(5)] = n; else if (k.startsWith('stance.')) (FORE_STANCE as any)[k.slice(7)] = n; else if (k in FORE_LOCK) (FORE_LOCK as any)[k] = n; else if (k in FORE_JOINT) (FORE_JOINT as any)[k] = n; }
  const V = (process.env.VS ?? '5,8.5,10,11.6').split(',').map(Number), H = (process.env.HZ ?? '60,120,240').split(',').map(Number), lock = process.env.LOCK !== '0', f = (x: number) => x.toFixed(1);
  console.log(`lock ${lock} | v hz | gate | plants overPlant overRest | plant max scap hum fore manus | stance+lift max scap hum fore manus (deg/frame)`);
  for (const v of V) for (const hz of H) { const r = popCell(v, hz, lock, 4, process.env.VERBOSE === '1');
    console.log(`${v} ${hz} | ${f(r.gate)} | ${r.plants} ${r.overPlant} ${r.overRest} | ${f(r.plant.scap)} ${f(r.plant.hum)} ${f(r.plant.fore)} ${f(r.plant.manus)} | ${f(r.rest.scap)} ${f(r.rest.hum)} ${f(r.rest.fore)} ${f(r.rest.manus)}`); }
}
