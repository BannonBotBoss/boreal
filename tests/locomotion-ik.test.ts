import test from 'node:test';
import assert from 'node:assert/strict';
import { quadrupedPose, gaitFor, limbOf, bendsForward, isFrontLeg, WOLF_LEGS, type Motion } from '../src/core/animalBehavior';
import { solveLimb, soleOf, clampLimb, FLEX_LIMIT, createLocomotion, referenceLayout } from '../src/animals/locomotion';
import { stream } from '../src/proc/rng';

test('solveLimb reproduces quadrupedPose exactly on flat ground (walk, trot, gallop)', () => {
  for (const [motion, v] of [['walk', .8], ['walk', 2], ['run', 4], ['run', 7]] as [Motion, number][]) for (let k = 0; k < 16; k++) {
    const phase = k / 16, pose = quadrupedPose(motion, phase, 0, WOLF_LEGS, v), gait = gaitFor(motion, v, WOLF_LEGS)!;
    for (let i = 0; i < 4; i++) {
      const L = limbOf(WOLF_LEGS, i), f = pose.feet[i], lift = Math.min(1, f.y / gait.lift);
      const a = solveLimb(L, bendsForward(WOLF_LEGS, i), { x: 0, y: f.y - pose.bob, z: f.z }, lift);
      for (const [mine, theirs] of [[a.girdle, pose.girdles[i]], [a.leg, pose.legs[i]], [a.knee, pose.knees[i]], [a.wrist, pose.wrists[i]], [a.paw, pose.paws[i]]])
        assert.ok(Math.abs(mine - theirs) < 1e-9, `${motion} ${v} phase ${phase} leg ${i}: ${mine} vs ${theirs}`);
    }
  }
});

test('reachable targets are reached exactly (FK of the solution lands on the target)', () => {
  const r = stream(7, 'ik-test');
  for (let n = 0; n < 400; n++) {
    const i = n % 4, L = limbOf(WOLF_LEGS, i), reach = L.upper + L.lower;
    const target = { x: 0, y: .05 + r() * .15, z: (r() - .5) * reach * .8 };
    const lift = r(), a = solveLimb(L, bendsForward(WOLF_LEGS, i), target, lift);
    const s = soleOf(L, a);
    // only check when the carpus/hock target is inside the two-bone reach (solveLeg clamps otherwise)
    const M = L.foot ?? 0, psi = (L.footAngle ?? 0) - (L.footFlex ?? 0) * lift, d = Math.hypot(target.z + M * Math.sin(psi) - a.joint.z, target.y + M * Math.cos(psi) - a.joint.y);
    if (d < reach * .98) assert.ok(Math.hypot(s.z - target.z, s.y - target.y) < 1e-6, `leg ${i} miss ${Math.hypot(s.z - target.z, s.y - target.y)}`);
  }
});

test('abduction swings the foot sideways by atan(x / drop)', () => {
  const L = limbOf(WOLF_LEGS, 0), a = solveLimb(L, bendsForward(WOLF_LEGS, 0), { x: .1, y: 0, z: 0 }, 0);
  assert.ok(Math.abs(a.abduct - Math.atan2(.1, L.hip)) < 1e-12);
});

test('controller output stays inside the goniometric flexion limits at every gait and speed', () => {
  const layout = referenceLayout();
  for (const v of [.8, 2.5, 5, 9]) { let z = 0; const loco = createLocomotion(layout, () => 0, { x: 0, z, heading: 0 });
    for (let t = 0; t < 3; t += 1 / 120) { z -= v / 120; const p = loco.update({ x: 0, z, heading: 0, speed: v }, 1 / 120);
      for (let i = 0; i < 4; i++) { const lim = isFrontLeg(i) ? FLEX_LIMIT.front : FLEX_LIMIT.hind;
        assert.ok(Math.abs(p.knees[i]) <= lim.knee + 1e-9 && Math.abs(p.wrists[i]) <= lim.wrist + 1e-9); } } }
  const c = clampLimb({ girdle: 0, leg: 0, knee: 3, wrist: -3, paw: 0, abduct: 0, joint: { z: 0, y: 0 } }, true);
  assert.equal(c.knee, FLEX_LIMIT.front.knee); assert.equal(c.wrist, -FLEX_LIMIT.front.wrist);
});
