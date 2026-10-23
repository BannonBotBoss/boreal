/**
 * T-0009 v6 (grok-gait, on 524caea): late-swing fore reach (bounding.ts FORE_REACH / foreReachTarget). An out-of-reach fore
 * swing target is pulled back at its own height onto the reach circle about the protracted glenoid, so the reaching paw keeps
 * the swing's ground clearance instead of riding the ray to the far target (since BodyPlan.girdleTop: 45-58 mm above the
 * ground in the extended flight). Plausibility (posePlausibility) and slip stay as they were.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createBounding, limbPoints, selectRow, GIRDLE, FORE_REACH, foreReachWeight, foreReachTarget, type BoundFrame } from '../src/animals/locomotion/bounding';
import { posePlausibility } from '../src/animals/locomotion/boundScore';
import { HOST_GAIT, planFor, poseFor } from '../tools/bound-plans';

function run(plan: string, v: number, reach = true, seconds = 4, dt = 1 / 240) {
  const saved = { ...FORE_REACH }; if (!reach) FORE_REACH.from = 2;
  try {
    const sk = planFor(plan), c = createBounding(sk, HOST_GAIT, () => 0, { x: 0, z: 0, heading: 0 }, GIRDLE, { pose: poseFor(plan) }), out: { t: number; f: BoundFrame }[] = [];
    for (let t = 0; t < seconds; t += dt) out.push({ t, f: c.update(dt, Math.min(v, v * t / 1.5), 0, null, selectRow(v)) });
    return { sk, out };
  } finally { Object.assign(FORE_REACH, saved); }
}

test('foreReachWeight: 0 through lift-off, gather and push (swing < from), 1 from full to hold, 0 again at touchdown', () => {
  assert.equal(foreReachWeight(0), 0); assert.equal(foreReachWeight(FORE_REACH.from), 0); assert.equal(foreReachWeight(1), 0);
  assert.equal(foreReachWeight((FORE_REACH.full + FORE_REACH.hold) / 2), 1);
  let prev = 0; for (let s = FORE_REACH.from; s <= FORE_REACH.full; s += .01) { const w = foreReachWeight(s); assert.ok(w >= prev - 1e-12); prev = w; }
});

test('foreReachTarget: a reachable target is unchanged; an unreachable one keeps its height and lands on the reach circle', () => {
  const sk = planFor('hare'), L = sk.legs, top = { z: 0, y: L.hip + (L.girdle ?? 0) };
  const swing = { ...FORE_REACH, floor: 0 };
  const near = { x: 0, y: .05, z: -.05 }; assert.deepEqual(foreReachTarget(L, top, near, GIRDLE, swing), near);
  const far = { x: .01, y: .04, z: -.3 }, t = foreReachTarget(L, top, far, GIRDLE, swing), b = (L.girdleRest ?? 0) + GIRDLE.scapulaMax;
  const gz = top.z - (L.girdle ?? 0) * Math.sin(b), gy = top.y - (L.girdle ?? 0) * Math.cos(b), R = FORE_REACH.reach * (L.upper + L.lower + (L.foot ?? 0));
  assert.equal(t.y, far.y); assert.equal(t.x, far.x); assert.ok(t.z > far.z && t.z < gz);
  assert.ok(Math.abs(Math.hypot(t.z - gz, t.y - gy, t.x) - R) < 1e-9);
});

test('foreReachTarget floor: a target inside the floor circle is pushed forward onto that circle', () => {
  const sk = planFor('hare'), L = sk.legs, top = { z: 0, y: L.hip + (L.girdle ?? 0) };
  const near = { x: 0, y: .05, z: -.02 }, b = (L.girdleRest ?? 0) + GIRDLE.scapulaMax;
  const gz = top.z - (L.girdle ?? 0) * Math.sin(b), gy = top.y - (L.girdle ?? 0) * Math.cos(b);
  const Rf = FORE_REACH.floor * (L.upper + L.lower + (L.foot ?? 0));
  const held = foreReachTarget(L, top, near);
  const dy = Math.hypot(near.y - gy, near.x);
  assert.ok(dy < Rf && Math.hypot(near.z - gz, dy) < Rf, 'fixture sits inside the floor circle');
  assert.equal(held.y, near.y); assert.equal(held.x, near.x);
  assert.ok(held.z < near.z, 'pushed forward (−z)');
  assert.ok(Math.abs(Math.hypot(held.z - gz, held.y - gy, held.x) - Rf) < 1e-9);
});

test('hare at 8.5 m/s: in the extended flight the reaching fore paws ride lower (keep the swing clearance), never above the glenoid, no implausible frame', () => {
  const lo = (o: ReturnType<typeof run>) => { let sum = 0, n = 0, worst = -1;
    for (const { t, f } of o.out) { if (t < 2.5) continue; const pl = posePlausibility(o.sk, f); assert.ok(pl.ok, `implausible at ${t}: ${JSON.stringify(pl)}`); worst = Math.max(worst, pl.soleOverHip);
      for (const i of [0, 2]) { const s = (f.phases[i] - f.plan.duties[i]) / (1 - f.plan.duties[i]); if (f.contact[i] || s < FORE_REACH.full || s > FORE_REACH.hold) continue; sum += limbPoints(o.sk, f, i)[4].y; n++; } }
    return { paw: sum / n, worst }; };
  const before = lo(run('hare', 8.5, false)), after = lo(run('hare', 8.5));
  assert.ok(after.paw < before.paw - .01, `late-swing fore paw height ${after.paw} vs ${before.paw}`);
  assert.ok(after.paw > 0, `paw stays above the ground ${after.paw}`);
  assert.ok(after.worst < 0, `highest sole over its own joint ${after.worst}`);
});

test('stance unchanged: the reach acts on swinging fore feet only, so stance slip stays as small as without it', () => {
  for (const v of [5, 8.5, 11.6]) {
    const slip = (o: ReturnType<typeof run>) => Math.max(...o.out.filter(x => x.t > 2.5).flatMap(x => x.f.slip));
    const a = slip(run('hare', v)), b = slip(run('hare', v, false));
    assert.ok(a <= b + 5e-4, `${v} m/s slip ${a} vs ${b}`);
  }
});
