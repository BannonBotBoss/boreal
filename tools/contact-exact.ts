// T-0044 run 14 (grok-gait): contactScore's split-step "exact" contact range (tests/touchdown-plan.test.ts measure) per cell. SET as elbow-pop.
import { createBounding, GIRDLE, selectRow, FORE_SOFT, FORE_PLAN, FORE_STANCE, FORE_LOCK, FORE_JOINT } from '../src/animals/locomotion/bounding';
import { foreContacts, range } from '../src/animals/locomotion/contactScore';
import { HOST_GAIT, planFor, poseFor } from './bound-plans';
for (const kv of (process.env.SET ?? '').split(',').filter(Boolean)) { const [k, x] = kv.split('='); const n = Number(x); if (k.startsWith('soft.')) (FORE_SOFT as any)[k.slice(5)] = n; else if (k.startsWith('plan.')) (FORE_PLAN as any)[k.slice(5)] = n; else if (k.startsWith('stance.')) (FORE_STANCE as any)[k.slice(7)] = n; else if (k in FORE_LOCK) (FORE_LOCK as any)[k] = n; else if (k in FORE_JOINT) (FORE_JOINT as any)[k] = n; }
const sk = planFor('hare'), make = () => createBounding(sk, HOST_GAIT, () => 0, { x: 0, z: 0, heading: 0 }, GIRDLE, { pose: poseFor('hare'), foreLock: true });
const V = (process.env.VS ?? '5,8.5,10,11.6').split(',').map(Number), H = (process.env.HZ ?? '60,120,240').split(',').map(Number);
for (const v of V) for (const hz of H) { const c = foreContacts(make, sk, { speed: v, hz, row: selectRow(v), perFrame: true }), r = range(c.exact), q = range(c.frame);
  console.log(`${v} ${hz} | exact ${r.min.toFixed(1)}-${r.max.toFixed(1)} n ${r.n} | frame ${q.min.toFixed(1)}-${q.max.toFixed(1)} n ${q.n}`); }