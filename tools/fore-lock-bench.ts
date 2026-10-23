// T-0009 run 10 (grok-gait): per-frame cost of one hare bound controller, fore lock off vs on (per instance), with fore IK solve counts. Mirrors C:\dev\forelock-bench.ts. npx tsx tools/fore-lock-bench.ts [env VS, HZ, SECS]
import { createBounding, GIRDLE, selectRow, FORE_LOCK_STATS } from '../src/animals/locomotion/bounding';
import { HOST_GAIT, planFor, poseFor } from './bound-plans';
function run(v: number, hz: number, on: boolean, secs: number) {
  const c = createBounding(planFor('hare'), HOST_GAIT, () => 0, { x: 0, z: 0, heading: 0 }, GIRDLE, { pose: poseFor('hare'), foreLock: on });
  const N = Math.round(secs * hz), warm = Math.round(2 * hz), ts: number[] = []; let solves = 0;
  for (let n = 0; n < N; n++) { const s0 = FORE_LOCK_STATS.solves, t0 = performance.now(); c.update(1 / hz, Math.min(v, v * n / hz / 1.5), 0, null, selectRow(v)); const t1 = performance.now(); if (n >= warm) { ts.push(t1 - t0); solves += FORE_LOCK_STATS.solves - s0; } }
  ts.sort((a, b) => a - b); return { mean: ts.reduce((a, b) => a + b, 0) / ts.length, p95: ts[Math.floor(ts.length * .95)], max: ts[ts.length - 1], solves: solves / ts.length };
}
const S = +(process.env.SECS ?? 3.5), V = (process.env.VS ?? '5,8.5,11.6').split(',').map(Number), H = (process.env.HZ ?? '30,60,120,240').split(',').map(Number), f = (x: number) => x.toFixed(2);
console.log('v hz | OFF mean p95 max solves/frame | ON mean p95 max solves/frame');
for (const v of V) for (const hz of H) { const off = run(v, hz, false, S), on = run(v, hz, true, S);
  console.log(`${v} ${hz} | ${f(off.mean)} ${f(off.p95)} ${f(off.max)} ${off.solves.toFixed(0)} | ${f(on.mean)} ${f(on.p95)} ${f(on.max)} ${on.solves.toFixed(0)}`); }
