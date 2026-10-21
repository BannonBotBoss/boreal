/**
 * Bound gate score (T-0009, grok-gait): runs the bounding controller headless and prints the bound-checks metric
 * (src/animals/locomotion/boundScore.ts). Usage: npx tsx tools/bound-score.ts [--plan=<name>[:level]] [--json] (names: tools/bound-plans.ts)
 * --plan=host  the host body as given (src/animals/hare.ts HARE_BODY);  --plan=bones  the same body with limb bones from
 * skeletal measurements (lab/bodyPlans BONE_PLAN, see the T-0009 grok-gait handoff).
 */
import { createBounding, boundPlan, selectRow, GIRDLE, type BoundRowId } from '../src/animals/locomotion/bounding';
import { suspensions } from '../src/core/gaitData';
import { scoreTrace, type TraceFrame, type SpeedScore } from '../src/animals/locomotion/boundScore';
import { planFor, poseFor, HOST_GAIT } from './bound-plans';

export const SCORE_SPEEDS = [1.68, 3, 5, 8.5, 11.6];
export const ROW_ORDER: Record<BoundRowId, number[]> = { 'half-bound': [0, 2, 1, 3], 'gallop-lagomorph': [0, 2, 3, 1] };
export function runScore(planName: string, rowOf: (v: number) => BoundRowId = v => selectRow(v)) {
  const sk = planFor(planName), out: SpeedScore[] = [], gait = HOST_GAIT;
  for (const v of SCORE_SPEEDS) {
    const row = rowOf(v), c = createBounding(sk, gait, () => 0, { x: 0, z: 0, heading: 0 }, GIRDLE, { pose: poseFor(planName) }), tr: TraceFrame[] = [], dt = 1 / 240;
    for (let t = 0; t < 5; t += dt) { const sp = Math.min(v, v * t / 1.5), f = c.update(dt, sp, 0, null, row);
      tr.push({ t, stride: f.stride, speed: sp, contact: f.contact, slip: f.slip, spineFlex: f.spineFlex, leashes: f.leashes, touchdowns: f.touchdowns, fwd: { x: 0, z: -1 }, pitch: f.tilt.pitch }); }
    const p = boundPlan(gait, v, c.reach, row);
    out.push(scoreTrace(tr, { speed: v, row, hz: p.hz, dutyData: (p.dutyData + p.foreDutyData) / 2, order: ROW_ORDER[row], warm: 2.5, expect: [...new Set(suspensions(p.offsets, p.dutiesData).map(x => x.kind))] }));
  }
  return { plan: planName, speeds: out, score: out.reduce((s, x) => s + x.score, 0) / out.length };
}
if (process.argv[1]?.endsWith('bound-score.ts')) {
  const plan = (process.argv.find(a => a.startsWith('--plan=')) ?? '--plan=host').slice(7), r = runScore(plan);
  if (process.argv.includes('--json')) console.log(JSON.stringify(r, null, 1));
  else { console.log(`bound-checks, plan ${plan}: ${r.score.toFixed(1)} %`);
    for (const s of r.speeds) { console.log(`  ${s.speed} m/s ${s.row}: ${s.score.toFixed(0)} %`); for (const c of s.checks) console.log(`    ${c.pass ? 'PASS' : 'FAIL'} ${c.name.padEnd(8)} ${c.value}`); } }
}
