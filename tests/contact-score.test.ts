/**
 * T-0009 run 8 (Gait Builder): touchdown forearm at the EXACT contact instant (src/animals/locomotion/contactScore.ts), hare
 * plan, both fore legs, 5 / 8.5 / 10 / 11.6 m/s, drawn at 60 / 120 / 240 Hz: 11-36 deg below the horizontal (Schmidt 2008,
 * JEB 211:3775, Table 4; whole degrees). The reads sit within 1e-4 cycles of contact, and at 240 Hz their range agrees with
 * the 1 kHz reference within CONTACT_TOL deg (handoff run 8: worst 6.7 deg at 5 m/s; the gap is the controller's
 * frame-rate-dependent state - scan grid and continuity - not the read).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createBounding, GIRDLE, selectRow } from '../src/animals/locomotion/bounding';
import { foreContacts, range, inTouchdownRange } from '../src/animals/locomotion/contactScore';
import { HOST_GAIT, planFor, poseFor } from '../tools/bound-plans';

const sk = planFor('hare'), make = () => createBounding(sk, HOST_GAIT, () => 0, { x: 0, z: 0, heading: 0 }, GIRDLE, { pose: poseFor('hare') });
const CONTACT_TOL = 7;

test('contact scorer (run 8): touchdown forearm 11-36 deg at the contact instant, 60 / 120 / 240 Hz (Schmidt 2008 Table 4)', () => {
  for (const v of [5, 8.5, 10, 11.6]) for (const hz of [60, 120, 240]) {
    const c = foreContacts(make, sk, { speed: v, hz, row: selectRow(v), perFrame: false }), r = range(c.exact);
    assert.ok(r.n > 20, `${v} m/s ${hz} Hz: ${r.n} contacts`);
    assert.ok(Math.max(...c.residual) < 1e-4, `${v} m/s ${hz} Hz: read ${Math.max(...c.residual)} cycles past contact`);
    assert.ok(inTouchdownRange(r.min) && inTouchdownRange(r.max), `${v} m/s ${hz} Hz: touchdown forearm ${r.min.toFixed(2)}-${r.max.toFixed(2)} deg`);
  }
});

test('contact scorer (run 8): 240 Hz contact range agrees with the 1 kHz reference within 7 deg', () => {
  for (const v of [5, 8.5, 10, 11.6]) {
    const a = range(foreContacts(make, sk, { speed: v, hz: 240, row: selectRow(v), perFrame: false }).exact);
    const b = range(foreContacts(make, sk, { speed: v, hz: 1000, row: selectRow(v), perFrame: false }).exact);
    const d = Math.max(Math.abs(a.min - b.min), Math.abs(a.max - b.max));
    assert.ok(d <= CONTACT_TOL, `${v} m/s: 240 Hz ${a.min.toFixed(1)}-${a.max.toFixed(1)} vs 1 kHz ${b.min.toFixed(1)}-${b.max.toFixed(1)} (${d.toFixed(1)} deg)`);
  }
});
