/**
 * T-0009 run 11 (grok): with Gait Builder's late-swing fore reach (FORE_REACH) the reaching forearm (elbow -> wrist) stays inside
 * the sourced fore touchdown range of small therians, 11-36 deg below the horizontal (Schmidt 2008, JEB 211:3775, Table 4), while
 * the reach holds (swing .7-.92), hare plan, both fore legs, 5 / 8.5 / 11.6 m/s.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createBounding, limbPoints, selectRow, GIRDLE, FORE_REACH } from '../src/animals/locomotion/bounding';
import { HOST_GAIT, planFor, poseFor } from '../tools/bound-plans';

test('forearm (run 11): the late-swing reaching forearm stays at or under 36 deg below the horizontal (Schmidt 2008 Table 4)', () => {
  for (const v of [5, 8.5, 11.6]) {
    const sk = planFor('hare'), c = createBounding(sk, HOST_GAIT, () => 0, { x: 0, z: 0, heading: 0 }, GIRDLE, { pose: poseFor('hare') });
    let worst = 0, n = 0;
    for (let t = 0, dt = 1 / 240; t < 5; t += dt) { const f = c.update(dt, Math.min(v, v * t / 1.5), 0, null, selectRow(v)); if (t < 2.5) continue;
      for (const i of [0, 2]) { if (f.contact[i]) continue; const s = (f.phases[i] - f.plan.duties[i]) / (1 - f.plan.duties[i]); if (s < FORE_REACH.full || s > FORE_REACH.hold) continue;
        const P = limbPoints(sk, f, i), k = P[2], w = P[3]; worst = Math.max(worst, Math.atan2(k.y - w.y, Math.hypot(w.z - k.z, w.x - k.x)) * 180 / Math.PI); n++; } }
    assert.ok(n > 20, `${v} m/s: reach frames ${n}`); assert.ok(worst <= 36, `${v} m/s: forearm ${worst.toFixed(1)} deg below the horizontal`);
  }
});
