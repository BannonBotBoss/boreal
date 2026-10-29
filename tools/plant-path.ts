// T-0044 run 14 (grok-gait): why fore touchdowns skip the plan. Per cell: planting frames by path (band = planned pair tracked
// in band; noband = tracked out of band; unlocked = no window solve; unplanned = no plan reached the plant; planOff), the
// touchdown forearm range per path (deg below horizontal, every planting frame) and planned-vs-actual landing error.
// npx tsx tools/plant-path.ts [env VS, HZ, SET as elbow-pop]
import { createBounding, GIRDLE, selectRow, FORE_LOCK, FORE_JOINT, FORE_SOFT, FORE_PLAN, FORE_PLAN_DIAG, FORE_PLAN_STATS, FORE_STANCE } from '../src/animals/locomotion/bounding';
import { HOST_GAIT, planFor, poseFor } from './bound-plans';
import { limbToWorld } from '../src/animals/locomotion/controller';
import { forearmBelowDeg } from '../src/animals/locomotion/touchdownPlan';
for (const kv of (process.env.SET ?? '').split(',').filter(Boolean)) { const [k, x] = kv.split('='); if (k.startsWith('soft.')) (FORE_SOFT as any)[k.slice(5)] = Number(x); else if (k.startsWith('stance.')) (FORE_STANCE as any)[k.slice(7)] = Number(x); else if (k.startsWith('plan.')) (FORE_PLAN as any)[k.slice(5)] = Number(x); else if (k in FORE_LOCK) (FORE_LOCK as any)[k] = Number(x); else if (k in FORE_JOINT) (FORE_JOINT as any)[k] = Number(x); }
const foreDeg = (f: any, a: any) => { const a1 = a.girdle + a.leg, a2 = a1 + a.knee; const k = { x: 0, z: a.joint.z - .07 * Math.sin(a1), y: a.joint.y - .07 * Math.cos(a1) }, w = { x: 0, z: k.z - .08 * Math.sin(a2), y: k.y - .08 * Math.cos(a2) };
  const K = limbToWorld(k, f.x, f.z, f.heading, f.tilt, [0, 0]), W = limbToWorld(w, f.x, f.z, f.heading, f.tilt, [0, 0]); return forearmBelowDeg(K.x, K.y, K.z, W.x, W.y, W.z); };
FORE_PLAN_DIAG.on = 1;
const V = (process.env.VS ?? '5,8.5,10,11.6').split(',').map(Number), H = (process.env.HZ ?? '60,120,240').split(',').map(Number);
for (const v of V) for (const hz of H) {
  FORE_PLAN_DIAG.log.length = 0; const st0 = { ...FORE_PLAN_STATS };
  const c = createBounding(planFor('hare'), HOST_GAIT, () => 0, { x: 0, z: 0, heading: 0 }, GIRDLE, { pose: poseFor('hare'), foreLock: true });
  const byPath: Record<string, { n: number; lo: number; hi: number; dW: number; dZ: number; nW: number; sp: number; e: Record<string, number> }> = {}; let last: any;
  for (let n = 0; n / hz < 4; n++) { const k0 = FORE_PLAN_DIAG.log.length; const f: any = c.update(1 / hz, Math.min(v, v * n / hz / 1.5), 0, null, selectRow(v));
    if (n / hz > 2 && last) for (const r of FORE_PLAN_DIAG.log.slice(k0)) { const d = foreDeg(f, f.limbs[r.leg]), b = (byPath[r.path] ??= { n: 0, lo: 999, hi: -999, dW: 0, dZ: 0, nW: 0, sp: 0, e: {} });
      b.n++; b.lo = Math.min(b.lo, d); b.hi = Math.max(b.hi, d); b.sp += r.sp ?? 0; if (r.dW !== undefined) { b.dW += r.dW * 1000; b.dZ += (r.dRelZ ?? 0) * 1000; b.nW++; for (const k of ['dRelY', 'dBody', 'dPitch', 'dHeight', 'dTop', 'dFloor'] as const) b.e[k] = (b.e[k] ?? 0) + ((r as any)[k] ?? 0) * (k === 'dPitch' ? 180 / Math.PI : 1000); } }
    last = f; }
  console.log(`${v} ${hz} | ` + Object.entries(byPath).map(([k, b]) => `${k} ${b.n} fore ${b.lo.toFixed(1)}..${b.hi.toFixed(1)} lastSp ${(b.sp / b.n).toFixed(2)}` + (b.nW ? ` dLand ${(b.dW / b.nW).toFixed(1)}mm dRelZ ${(b.dZ / b.nW).toFixed(1)}mm ` + Object.entries(b.e).map(([k, x]) => `${k} ${(x / b.nW).toFixed(1)}`).join(' ') : '')).join(' ; ') + ` | plans ${FORE_PLAN_STATS.plans - st0.plans} fails ${FORE_PLAN_STATS.fails - st0.fails} holds ${FORE_PLAN_STATS.holds - st0.holds}`);
}