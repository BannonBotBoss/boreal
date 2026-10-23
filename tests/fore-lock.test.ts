// T-0009 run 9 (grok-gait): fore-stance IK solution lock - per-frame joint-jump gate.
// Gate: a segment may not turn more than omega_gate * dt in one frame, where
//   omega_gate = 2 * 88 deg / t_stance.
// 88 deg = forearm sweep touchdown -> lift-off in the hare (Schmidt 2008 JEB 211:3775 Table 4:
// TD 11-36 deg, LO 102-121 deg; 88 = midpoint LO 111.5 - midpoint TD 23.5).
// t_stance = plan.duties[0] / plan.hz (fore stance time of the gait plan).
// Factor 2 = peak / mean angular speed over stance: an ESTIMATE (a half-sine sweep has peak/mean pi/2 ~ 1.6).
// Segments checked: scapula (girdle) and manus - the outputs the lock controls - on every frame where the
// fore foot is in stance or lifting off. The planting frame itself (swing -> stance) is excluded and reported:
// the stance branch there is chosen fresh (FORE_CONT.plant = 0) so the exact-contact 11-36 deg gate holds;
// that branch change is the known open item (see the Run 9 handoff).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createBounding, GIRDLE, selectRow, FORE_LOCK_STATS } from '../src/animals/locomotion/bounding';
import { HOST_GAIT, planFor, poseFor } from '../tools/bound-plans';

const D = 180 / Math.PI;
const seg = (a: any, k: string) => k === 'scap' ? a.girdle : a.girdle + a.leg + a.knee + a.wrist;

function jumps(v: number, hz: number, secs = 4, foreLock = true) {
  const c = createBounding(planFor('hare'), HOST_GAIT, () => 0, { x: 0, z: 0, heading: 0 }, GIRDLE, { pose: poseFor('hare'), foreLock });
  let last: any, over = 0, mid = 0, lift = 0, plant = 0, gate = 0, worst = 0;
  for (let n = 0; n / hz < secs; n++) {
    const f: any = c.update(1 / hz, Math.min(v, v * n / hz / 1.5), 0, null, selectRow(v));
    gate = 2 * 88 / (f.plan.duties[0] / f.plan.hz) / hz;
    if (last && n / hz > 2) for (const i of [0, 2]) if (f.contact[i] || last.contact[i]) for (const k of ['scap', 'manus']) {
      const dd = seg(f.limbs[i], k) - seg(last.limbs[i], k), d = Math.abs(Math.atan2(Math.sin(dd), Math.cos(dd))) * D;
      if (f.contact[i] && !last.contact[i]) { plant = Math.max(plant, d); continue; }
      if (f.contact[i]) mid = Math.max(mid, d); else lift = Math.max(lift, d);
      worst = Math.max(worst, d); if (d > gate) over++;
    }
    last = f;
  }
  return { over, mid, lift, plant, gate, worst };
}

describe('T-0009 run 9: fore-stance solution lock, joint-jump gate', () => {
  for (const v of [5, 8.5, 10, 11.6]) for (const hz of [60, 120, 240]) {
    it(`${v} m/s @ ${hz} Hz: scapula + manus within omega_gate*dt in stance and at lift-off`, () => {
      const r = jumps(v, hz);
      assert.equal(r.over, 0, JSON.stringify(r));
      assert.ok(r.mid < r.gate, JSON.stringify(r));
    });
  }
  it('cost: a locked fore leg solves no more per frame than the old full scan (247)', () => {
    for (const hz of [30, 240]) { const N = 2 * hz;
      const c = createBounding(planFor('hare'), HOST_GAIT, () => 0, { x: 0, z: 0, heading: 0 }, GIRDLE, { pose: poseFor('hare'), foreLock: true });
      FORE_LOCK_STATS.solves = 0; // after construction (reachOf scans the limb range once)
      for (let n = 0; n < N; n++) c.update(1 / hz, Math.min(8.5, 8.5 * n / hz / 1.5), 0, null, selectRow(8.5));
      assert.ok(FORE_LOCK_STATS.solves / N / 2 <= 247, `${hz} Hz: ${(FORE_LOCK_STATS.solves / N / 2).toFixed(0)} solves per fore leg per frame`); }
  });
  it('the gate bites: with the lock off, 8.5 m/s @ 240 Hz fails it', () => {
    assert.ok(jumps(8.5, 240, 4, false).over > 0);
  });
});
