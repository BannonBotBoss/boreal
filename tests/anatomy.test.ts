/**
 * T-0009 run 8 (grok): anatomical plausibility (boundScore.ts posePlausibility, bound-checks v3 check 9 'anatomy'), the gate
 * lookscore v1.3 uses to zero physically impossible poses. Calibration (rule 11): known match = the shipped rig (no sole above
 * its own hip / shoulder joint) grades 1; known mismatch = Gait Builder's foot-over-back fold (SWING.fold.hind 1.5) grades 0.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createBounding, selectRow, GIRDLE, SWING, poseReach, limbPoints } from '../src/animals/locomotion/bounding';
import { posePlausibility, scoreTrace, type TraceFrame } from '../src/animals/locomotion/boundScore';
import { HOST_GAIT, planFor, poseFor } from '../tools/bound-plans';

function highest(fold: number, v = 8.5) {
  const keep = SWING.fold.hind; SWING.fold.hind = fold;
  try {
    const sk = planFor('hare'), c = createBounding(sk, HOST_GAIT, () => 0, { x: 0, z: 0, heading: 0 }, GIRDLE, { pose: poseFor('hare') });
    let top = -1, joint = 0, ok = true;
    for (let t = 0; t < 4; t += 1 / 240) { const f = c.update(1 / 240, Math.min(v, v * t / 1.5), 0, null, selectRow(v)); if (t < 2.5) continue;
      const p = posePlausibility(sk, f); top = Math.max(top, p.soleOverHip); joint = Math.max(joint, p.jointOut); ok &&= p.ok; }
    return { top, joint, ok };
  } finally { SWING.fold.hind = keep; }
}

test('posePlausibility: the shipped bound keeps every sole below its own hip / shoulder and every joint in range; the foot-over-back fold does not', () => {
  const good = highest(SWING.fold.hind), bad = highest(1.5);
  assert.ok(good.ok && good.top < 0 && good.joint <= .5, `shipped: sole ${good.top}, joint ${good.joint}`);
  assert.ok(!bad.ok && bad.top > .05, `fold 1.5: sole ${bad.top}`);
});

test('bound-checks v3 anatomy check: grade 1 with soles below the hip, 0 at 2 cm above, skipped without the field', () => {
  const tr = (above?: number): TraceFrame[] => Array.from({ length: 200 }, (_, k) => ({ t: k / 100, stride: (k / 20) % 1, speed: 5, contact: [false, false, false, false], slip: [0, 0, 0, 0], spineFlex: 0, leashes: 0, touchdowns: [], fwd: { x: 0, z: -1 }, soleOverHip: above }));
  const g = (above?: number) => scoreTrace(tr(above), { speed: 5, row: 'half-bound', hz: 5, dutyData: .3, order: [0, 2, 1, 3], warm: 0, expect: [] }).checks.find(c => c.name === 'anatomy');
  assert.equal(g(-.02)?.grade, 1); assert.equal(g(.02)?.grade, 0); assert.ok(Math.abs((g(.01)?.grade ?? 0) - .5) < 1e-9); assert.equal(g(undefined), undefined);
});

test('graze crouch (run 9/10): with the raised girdle the body lowers the whole asked pitch and drop, plausible, feet planted', () => {
  for (const turnInPlace of [false, true]) {
    const sk = planFor('hare'), c = createBounding(sk, HOST_GAIT, () => 0, { x: 0, z: 0, heading: 0 }, GIRDLE, { pose: poseFor('hare'), turnInPlace });
    assert.equal(poseReach(sk, 'graze-crouch'), 1);
    let f = c.update(1 / 120, 0, 0, null); for (let t = 0; t < .5; t += 1 / 120) f = c.update(1 / 120, 0, 0, null);
    const hip0 = limbPoints(sk, f, 1)[1].y, paw0 = f.soles[0].z; let slip = 0, bad = 0;
    for (let t = 0; t < 2; t += 1 / 120) { f = c.update(1 / 120, 0, 0, { kind: 'graze-crouch' }); slip = Math.max(slip, f.slip[1], f.slip[3]); if (!posePlausibility(sk, f).ok) bad++; }
    const hip = limbPoints(sk, f, 1)[1].y;
    assert.deepEqual(f.contact, [true, true, true, true]); assert.equal(bad, 0, `implausible frames ${bad}`);
    assert.ok(hip0 - hip > .03, `hip lowered ${hip0 - hip}`); assert.ok(Math.abs(paw0 - f.soles[0].z) < .01, `fore paw stays put ${paw0 - f.soles[0].z}`);
    assert.ok(slip < .01 && Math.max(...f.slip) < .002, `slip ${slip} / ${f.slip}`);
  }
});

test('shoulder girdle (run 10): standing, the hare fore limb is not folded in a Z (elbow below the glenoid, off its clamp)', () => {
  const sk = planFor('hare'), c = createBounding(sk, HOST_GAIT, () => 0, { x: 0, z: 0, heading: 0 }, GIRDLE, { pose: poseFor('hare') });
  let f = c.update(1 / 120, 0, 0, null); for (let t = 0; t < .5; t += 1 / 120) f = c.update(1 / 120, 0, 0, null);
  for (const i of [0, 2]) { // fore legs (bounding.ts FRONT: even indices)
    const [, j, k, w] = limbPoints(sk, f, i);
    assert.ok(j.y - k.y > .005, `elbow ${(j.y - k.y).toFixed(3)} m below the glenoid`); // run 11: girdleTop .157 -> 11 mm
    const ux = j.x - k.x, uy = j.y - k.y, uz = j.z - k.z, vx = w.x - k.x, vy = w.y - k.y, vz = w.z - k.z;
    const deg = Math.acos((ux * vx + uy * vy + uz * vz) / Math.hypot(ux, uy, uz) / Math.hypot(vx, vy, vz)) * 180 / Math.PI;
    assert.ok(deg > 60, `elbow interior ${deg.toFixed(1)} deg`);
  }
});
