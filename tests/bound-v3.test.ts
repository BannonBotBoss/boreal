/**
 * T-0009 run 3 (grok-gait, on 9527d2c): split hind foot (metatarsus + toes) and the rabbit knee range (ik.ts LEPORID_KNEE),
 * the shoulder blade in the fore chain with the level-trunk posture (bodyPlan.ts BodyPlan.scapula, bounding.ts RUN_POSE_LEVEL),
 * the stance-swing reach rule (bounding.ts STANCE_SWING) and turning in place by re-planting the feet (bounding.ts TURN).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { clampJoint, solveLimb, toeTarget, LEPORID_LIMITS, LEPORID_KNEE } from '../src/animals/locomotion/ik';
import { skeletonOf } from '../src/animals/locomotion/bodyPlan';
import { createBounding, limbPoints, boundPlan, selectRow, pitchCurve, reachOf, runTilt, GIRDLE, TURN, BOUND_PITCH, STANCE_SWING, RUN_POSE_LEVEL, type BoundFrame } from '../src/animals/locomotion/bounding';
import { HOST_GAIT, planFor, poseFor, SPLIT_PLAN, SPLIT, BLADE } from '../tools/bound-plans';
import { runScore, SCORE_SPEEDS } from '../tools/bound-score';

const RAD = Math.PI / 180;
function run(plan: string, v: number, seconds = 4, dt = 1 / 240) {
  const sk = planFor(plan), c = createBounding(sk, HOST_GAIT, () => 0, { x: 0, z: 0, heading: 0 }, GIRDLE, { pose: poseFor(plan) }), out: { t: number; f: BoundFrame }[] = [];
  for (let t = 0; t < seconds; t += dt) out.push({ t, f: c.update(dt, Math.min(v, v * t / 1.5), 0, null, selectRow(v)) });
  return { sk, c, out };
}

test('split hind foot: the IK foot bone is the metatarsus (hindFoot - toes), the toes lie flat ahead of the MTP', () => {
  const sk = skeletonOf(SPLIT_PLAN);
  assert.equal(sk.toes, SPLIT.hindToes);
  assert.ok(Math.abs(sk.legs.hind.foot! - (SPLIT_PLAN.hindFoot - SPLIT.hindToes)) < 1e-12);
  const m = toeTarget({ x: 1, y: 0, z: 2 }, { x: 0, z: -1 }, .05, () => 0);
  assert.deepEqual(m, { x: 1, y: 0, z: 2.05 }); // MTP `toes` behind the tip (forward is -z)
  assert.deepEqual(toeTarget({ x: 1, y: .3, z: 2 }, { x: 0, z: -1 }, 0), { x: 1, y: .3, z: 2 });
});

test('rabbit knee: 30-166.8° interior, folding the way solveChain bends the hind knee', () => {
  assert.deepEqual(LEPORID_LIMITS.hind.knee, LEPORID_KNEE);
  const sk = skeletonOf(SPLIT_PLAN), H = { ...sk.legs.hind, footAngle: sk.restFootAngle };
  const a = solveLimb(H, true, { x: 0, y: 0, z: -(H.stance ?? 0) }, 0, { top: { z: 0, y: H.hip } });
  assert.ok(Math.sign(a.knee) === LEPORID_KNEE.flex, `standing knee ${a.knee}`);
  for (let v = -3; v <= 3; v += .01) { const c = clampJoint(v, LEPORID_KNEE), interior = 180 - Math.abs(c) / RAD;
    assert.ok(c < 0 && interior >= 30 - 1e-9 && interior <= 166.8 + 1e-9, `${v} -> ${c}`); }
});

test('split-foot leporid run: planted ankle, knee and metatarsus-to-ground inside the ranges, the toe tip on its print', () => {
  for (const v of [3, 8.5]) { const { sk, out } = run('v3:level', v); let n = 0;
    for (const { t, f } of out) { if (t < 2.5) continue;
      for (const i of [1, 3]) { if (!f.contact[i]) continue; n++;
        const P = limbPoints(sk, f, i); assert.equal(P.length, 6);
        const hock = P[3], mtp = P[4], foot = Math.atan2(hock.y - mtp.y, hock.z - mtp.z) / RAD; // the paper's foot: ankle -> MTP
        const ankle = 180 - Math.abs(f.limbs[i].wrist) / RAD, knee = 180 - Math.abs(f.limbs[i].knee) / RAD;
        assert.ok(ankle >= 66.4 - .01 && ankle <= 137.2 + .01, `${v}: ankle ${ankle}`);
        assert.ok(knee >= 30 - .01 && knee <= 166.8 + .01, `${v}: knee ${knee}`);
        assert.ok(foot >= 17.2 - 3 && foot <= 123.3 + 3, `${v}: foot ${foot}`); // 3° = the foot scan step
        assert.ok(Math.abs(Math.hypot(P[5].z - mtp.z, P[5].y - mtp.y) - SPLIT.hindToes) < 2e-3 && Math.abs(P[5].y - mtp.y) < 2e-3, 'toes flat');
      } }
    assert.ok(n > 100);
    const steady = out.filter(o => o.t > 2.5);
    assert.equal(steady[steady.length - 1].f.leashes - steady[0].f.leashes, 0, `${v} leashes`);
    assert.ok(Math.max(...steady.flatMap(o => o.f.slip)) < .01, `${v} slip`);
  }
});

test('stance-swing rule: each pair\'s stance only sees the pitch swing STANCE_SWING allows (game and v3 bodies, every score speed)', () => {
  for (const plan of ['canid-limits', 'v3:level']) { const sk = planFor(plan), r = reachOf(sk, GIRDLE, poseFor(plan), HOST_GAIT), q = STANCE_SWING.opposite * BOUND_PITCH.max;
    for (const v of SCORE_SPEEDS) { const p = boundPlan(HOST_GAIT, v, r, selectRow(v)), c = pitchCurve(p, sk), N = c.length;
      for (let s = 0; s < N; s++) for (let i = 0; i < 4; i++) { const ph = ((s / N + p.offsets[i]) % 1 + 1) % 1; if (ph >= p.duties[i]) continue;
        if (i % 2 === 0) assert.ok(c[s] <= q + 1e-9, `${plan} ${v} fore ${c[s]}`); else assert.ok(c[s] >= -q - 1e-9, `${plan} ${v} hind ${c[s]}`); } } }
});

test('blade + level trunk: neutral pitch 0, the fore chord is kept (vs .09 m without the blade before run 3), game body unchanged', () => {
  const v3 = planFor('v3:level'), r = reachOf(v3, GIRDLE, RUN_POSE_LEVEL, HOST_GAIT);
  assert.equal(v3.legs.girdle, BLADE.scapula);
  assert.ok(Math.abs(v3.legs.hip + v3.legs.girdle! - v3.plan.hip) < 1e-12); // blade pivot at hip height (Fischer et al. 2002)
  assert.equal(runTilt(v3, r.rise, 1, 0, RUN_POSE_LEVEL).pitch, 0);
  assert.ok(r.foreBlade && r.fore.chord > .3, `fore ${r.fore.chord}`);
  const game = planFor('game'); assert.equal(game.legs.girdle, undefined); assert.equal(game.toes, 0);
});

test('bound-checks: game body stays >= 95 %, split foot + rabbit limits + blade + level trunk >= 95 %', () => {
  for (const plan of ['game', 'v3:level']) { const s = runScore(plan); assert.ok(s.score >= 95, `${plan} ${s.score}`); }
});

test('turning in place: the feet re-plant in sequence (a fore and a hind always down), slip <= 1 cm, the body yaws at TURN.rate', () => {
  for (const plan of ['game', 'v3:level']) for (const target of [Math.PI / 2, -Math.PI]) {
    const sk = planFor(plan), c = createBounding(sk, HOST_GAIT, () => 0, { x: 0, z: 0, heading: 0 }, GIRDLE, { pose: poseFor(plan), turnInPlace: true }), dt = 1 / 240;
    let prev = 0, slip = 0, done = -1, f!: BoundFrame;
    for (let t = 0; t < 5; t += dt) { f = c.update(dt, 0, t > .5 ? target : 0, null);
      assert.ok(Math.abs(f.heading - prev) <= TURN.rate * dt + 1e-9, 'rate'); prev = f.heading;
      assert.ok((f.contact[0] || f.contact[2]) && (f.contact[1] || f.contact[3]), `${plan} a pair lifted at ${t}`);
      slip = Math.max(slip, ...f.slip); if (t > .5 && done < 0 && !f.turning && Math.abs(f.heading - target) < 1e-6) done = t - .5; }
    assert.ok(slip <= .01, `${plan} slip ${slip}`);
    assert.ok(done > 0 && done < Math.abs(target) / TURN.rate + .6, `${plan} ${target}: done at ${done}`);
    assert.ok(f.turnSteps >= 4 && f.x === 0 && f.z === 0, `${plan} steps ${f.turnSteps}`);
    // every foot ends near where it stands for the new heading (within the re-plant distance)
    const c2 = createBounding(sk, HOST_GAIT, () => 0, { x: 0, z: 0, heading: target }, GIRDLE, { pose: poseFor(plan) }), rest = c2.update(dt, 0, target, null);
    for (let i = 0; i < 4; i++) assert.ok(Math.hypot(f.feet[i].x - rest.feet[i].x, f.feet[i].z - rest.feet[i].z) <= TURN.replant + 1e-6, `${plan} foot ${i}`);
  }
  // off by default: the heading is taken at once, no steps (the old behaviour, until the host draws the frame's heading)
  const c = createBounding(planFor('game'), HOST_GAIT, () => 0, { x: 0, z: 0, heading: 0 }); let f = c.update(1 / 240, 0, 0, null);
  f = c.update(1 / 240, 0, 1, null); assert.equal(f.heading, 1); for (let k = 0; k < 480; k++) f = c.update(1 / 240, 0, 1, null); assert.equal(f.turnSteps, 0);
});
