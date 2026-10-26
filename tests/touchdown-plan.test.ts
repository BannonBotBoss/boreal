// T-0044 run 11 (grok-gait): planned fore touchdown (FORE_PLAN, bounding.ts; swing blend by the ported MIT Cheetah cubicBezier,
// footSwing.ts). The touchdown frame is back in the run-9 joint-jump gate: scapula + manus within 2 * 88 deg / t_stance * dt on
// the planting frame, in stance and at lift-off (88 deg: Schmidt 2008 JEB 211:3775 Table 4; factor 2 an estimate), fore lock on,
// 5 / 8.5 / 10 / 11.6 m/s at 60 / 120 / 240 Hz (tools/touchdown-pop.ts). And the exact-contact forearm with the lock on stays
// 11-36 deg below the horizontal (Schmidt 2008 Table 4; contactScore.ts reads it at the contact instant).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createBounding, GIRDLE, selectRow } from '../src/animals/locomotion/bounding';
import { foreContacts, range, inTouchdownRange } from '../src/animals/locomotion/contactScore';
import { HOST_GAIT, planFor, poseFor } from '../tools/bound-plans';
import { popCell } from '../tools/touchdown-pop';

const sk = planFor('hare'), make = () => createBounding(sk, HOST_GAIT, () => 0, { x: 0, z: 0, heading: 0 }, GIRDLE, { pose: poseFor('hare'), foreLock: true });
for (const v of [5, 8.5, 10, 11.6]) for (const hz of [60, 120, 240]) {
  test(`T-0044 planned touchdown ${v} m/s @ ${hz} Hz: 0 frames over the gate incl. the planting frame; contact 11-36 deg`, () => {
    const p = popCell(v, hz, true);
    assert.ok(p.plants > 10, JSON.stringify(p));
    assert.equal(p.overPlant + p.overRest, 0, JSON.stringify(p));
    const r = range(foreContacts(make, sk, { speed: v, hz, row: selectRow(v), perFrame: false }).exact);
    assert.ok(r.n > 20 && inTouchdownRange(r.min) && inTouchdownRange(r.max), `contact ${r.min.toFixed(1)}-${r.max.toFixed(1)} deg, n ${r.n}`);
  });
}
