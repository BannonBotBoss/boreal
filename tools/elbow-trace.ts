import { createBounding, GIRDLE, selectRow, FORE_JOINT, FORE_LOCK, FORE_LOCK_STATS } from '../src/animals/locomotion/bounding';
import { HOST_GAIT, planFor, poseFor } from './bound-plans';
for (const kv of (process.env.SET ?? '').split(',').filter(Boolean)) { const [k, x] = kv.split('='); if (k in FORE_LOCK) (FORE_LOCK as any)[k] = Number(x); else (FORE_JOINT as any)[k] = Number(x); }
const D = 180 / Math.PI; const v = Number(process.env.V ?? 8.5), hz = Number(process.env.H ?? 240);
const c = createBounding(planFor('hare'), HOST_GAIT, () => 0, { x: 0, z: 0, heading: 0 }, GIRDLE, { pose: poseFor('hare'), foreLock: true });
for (let n = 0; n / hz < 3.2; n++) { const f: any = c.update(1 / hz, Math.min(v, v * n / hz / 1.5), 0, null, selectRow(v));
  if (n / hz < 2.9) continue; const a = f.limbs[0], t = f.feet[0], so = f.soles[0]; const rel = FORE_LOCK_STATS.release - ((globalThis as any).lr ?? 0); (globalThis as any).lr = FORE_LOCK_STATS.release;
  console.log(`${(n/hz).toFixed(4)} ph ${f.phases[0].toFixed(3)} ${f.contact[0]?'DOWN':'air '} blade ${(a.girdle*D).toFixed(1)} hum ${((a.girdle+a.leg)*D).toFixed(1)} knee ${(a.knee*D).toFixed(1)} manus ${((a.girdle+a.leg+a.knee+a.wrist)*D).toFixed(1)} rel ${rel} miss ${(Math.hypot(t.x-so.x,t.y-so.y,t.z-so.z)*1000).toFixed(0)}mm sole y ${(so.y*1000).toFixed(0)}`); }