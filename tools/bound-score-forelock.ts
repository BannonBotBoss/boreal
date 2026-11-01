// T-0044 run 15 (grok-gait): bound-checks v2 (src/animals/locomotion/boundScore.ts scoreTrace, same speeds / trace / options as
// tools/bound-score.ts runScore) with the fore lock ON, the path the T-0044 work runs on (tools/bound-score.ts runs it off).
// npx tsx tools/bound-score-forelock.ts [--plan=host|hare]
import { createBounding, boundPlan, selectRow, GIRDLE } from '../src/animals/locomotion/bounding';
import { suspensions } from '../src/core/gaitData';
import { scoreTrace, posePlausibility, type TraceFrame, type SpeedScore } from '../src/animals/locomotion/boundScore';
import { planFor, poseFor, HOST_GAIT } from './bound-plans';
import { SCORE_SPEEDS, ROW_ORDER } from './bound-score';
const planName = (process.argv.find(a => a.startsWith('--plan=')) ?? '--plan=host').slice(7), sk = planFor(planName), out: SpeedScore[] = [], gait = HOST_GAIT;
for (const v of SCORE_SPEEDS) {
  const row = selectRow(v), c = createBounding(sk, gait, () => 0, { x: 0, z: 0, heading: 0 }, GIRDLE, { pose: poseFor(planName), foreLock: true }), tr: TraceFrame[] = [], dt = 1 / 240;
  for (let t = 0; t < 5; t += dt) { const sp = Math.min(v, v * t / 1.5), f = c.update(dt, sp, 0, null, row);
    tr.push({ t, stride: f.stride, speed: sp, contact: f.contact, slip: f.slip, spineFlex: f.spineFlex, leashes: f.leashes, touchdowns: f.touchdowns, fwd: { x: 0, z: -1 }, pitch: f.tilt.pitch, soleOverHip: posePlausibility(sk, f).soleOverHip }); }
  const p = boundPlan(gait, v, c.reach, row);
  out.push(scoreTrace(tr, { speed: v, row, hz: p.hz, dutyData: (p.dutyData + p.foreDutyData) / 2, order: ROW_ORDER[row], warm: 2.5, expect: [...new Set(suspensions(p.offsets, p.dutiesData).map(x => x.kind))] }));
}
console.log(`bound-checks (fore lock on), plan ${planName}: ${(out.reduce((s, x) => s + x.score, 0) / out.length).toFixed(1)} %`);
for (const s of out) { console.log(`  ${s.speed} m/s ${s.row}: ${s.score.toFixed(0)} %`); for (const c of s.checks) if (!c.pass || /planted|contact|anatomy/.test(c.name)) console.log(`    ${c.pass ? 'PASS' : 'FAIL'} ${c.name.padEnd(8)} ${c.value}`); }