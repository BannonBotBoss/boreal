/**
 * T-0009 v7 (Gait Builder): the fore forearm (elbow -> wrist) AT TOUCHDOWN stays inside the sourced small-therian touchdown
 * range, 11-36 deg below the horizontal (Schmidt 2008, JEB 211:3775, Table 4), hare plan, both fore legs, 5 / 8.5 / 11.6 m/s.
 * Run 8: touchdown is read at the exact contact instant by the contact scorer (src/animals/locomotion/contactScore.ts; was a
 * straight line between the last swing and first stance frames, which measured the frame rate - handoff run 8); the 60 / 120
 * Hz gates are in tests/contact-score.test.ts. FORE_TOUCH (the landing point moved forward) is off at and below 8.5 m/s (the
 * lookscore stride sheets) and full from 10 m/s (run 8; was 11.6).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createBounding, selectRow, GIRDLE, FORE_TOUCH, foreTouchAhead } from '../src/animals/locomotion/bounding';
import { foreContacts, range, inTouchdownRange } from '../src/animals/locomotion/contactScore';
import { HOST_GAIT, planFor, poseFor } from '../tools/bound-plans';

const sk = planFor('hare'), make = () => createBounding(sk, HOST_GAIT, () => 0, { x: 0, z: 0, heading: 0 }, GIRDLE, { pose: poseFor('hare') });

test('touchdown (v7/run 8): the fore forearm at contact is 11-36 deg below the horizontal at 240 Hz (Schmidt 2008 Table 4)', () => {
  for (const v of [5, 8.5, 10, 11.6]) {
    const c = foreContacts(make, sk, { speed: v, hz: 240, row: selectRow(v), perFrame: false }), r = range(c.exact);
    assert.ok(r.n > 20, `${v} m/s: touchdowns ${r.n}`);
    assert.ok(inTouchdownRange(r.min) && inTouchdownRange(r.max), `${v} m/s: touchdown forearm ${r.min.toFixed(1)}-${r.max.toFixed(1)} deg below the horizontal`);
  }
});

test('touchdown (v7/run 8): FORE_TOUCH is off up to 8.5 m/s and full from 10 m/s', () => {
  for (const v of [0, 1.68, 5, 8.5]) assert.equal(foreTouchAhead(v), 0, `${v} m/s`);
  for (const v of [10, 11.6, 13]) assert.ok(Math.abs(foreTouchAhead(v) - FORE_TOUCH.ahead) < 1e-12, `${v} m/s`);
  assert.ok(foreTouchAhead(9.25) > 0 && foreTouchAhead(9.25) < FORE_TOUCH.ahead);
});
