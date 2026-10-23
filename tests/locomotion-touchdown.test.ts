import test from 'node:test';
import assert from 'node:assert/strict';
import { createLocomotion, referenceLayout, type GaitId, type LegPose, type Touchdown } from '../src/animals/locomotion';
import { WOLF_LEGS, gaitFor, limbOf, quadrupedPose } from '../src/core/animalBehavior';
import { canidPlan } from '../src/core/gaitData';

const DT = 1 / 120, layout = referenceLayout(), flat = () => 0;
const SPEED: Record<GaitId, number> = { walk: 1, trot: 2.6, pace: 2.2, canter: 4.5, gallop: 7, 'half-bound': 6, 'gallop-lagomorph': 6, pronk: 3.5 };

function run(gait: GaitId | undefined, speed: number, seconds: number, pounceAt = -1) {
  let z = 0; const loco = createLocomotion(layout, flat, { x: 0, z: 0, heading: 0 }), poses: LegPose[] = [], heard: Touchdown[] = [];
  loco.onTouchdown(t => heard.push(t));
  for (let k = 0, t = 0; t < seconds; k++, t += DT) {
    z -= speed * DT;
    poses.push(loco.update({ x: 0, z, heading: 0, speed, gait, intent: k === Math.round(pounceAt / DT) ? { kind: 'pounce' } : undefined }, DT));
  }
  return { poses, heard };
}

test('touchdowns fire exactly once per stance, for every leg, in each gait; the subscribe API sees the same events', () => {
  for (const gait of Object.keys(SPEED) as GaitId[]) {
    const { poses, heard } = run(gait, SPEED[gait], 6);
    assert.equal(heard.length, poses.reduce((n, p) => n + p.touchdowns.length, 0), `${gait}: listener vs pose list`);
    for (let i = 0; i < 4; i++) {
      let stances = 0, events = 0, wraps = 0;
      for (let k = 1; k < poses.length; k++) {
        const p = poses[k], q = poses[k - 1], ev = p.touchdowns.filter(t => t.leg === i);
        assert.ok(ev.length <= 1, `${gait} leg ${i}: two touchdowns in one frame`);
        if (p.contacts[i] && !q.contacts[i]) { stances++; assert.equal(ev.length, 1, `${gait} leg ${i}: stance without a touchdown`); }
        else assert.equal(ev.length, 0, `${gait} leg ${i}: touchdown without a new stance`);
        events += ev.length; if (p.phases[i] < q.phases[i] - .5) wraps++;
        for (const t of ev) { assert.equal(t.gait, gait); assert.ok(t.strength > 0 && t.strength <= 1); assert.deepEqual(t.worldPos, p.feet[i]); }
      }
      assert.equal(events, stances);
      assert.ok(Math.abs(stances - wraps) <= 1, `${gait} leg ${i}: ${stances} stances in ${wraps} cycles`);
      assert.ok(stances >= 3, `${gait} leg ${i}: only ${stances} stances`);
    }
  }
});

test('a pounce landing gives one landing touchdown per paw at strength 1', () => {
  const { poses } = run(undefined, 1, 4, 1);
  const land = poses.flatMap(p => p.touchdowns).filter(t => t.landing);
  assert.deepEqual(land.map(t => t.leg).sort(), [0, 1, 2, 3]);
  assert.ok(land.every(t => t.strength === 1));
});

test('standing still gives no touchdowns', () => {
  assert.equal(run(undefined, 0, 3).poses.reduce((n, p) => n + p.touchdowns.length, 0), 0);
});

/*
 * T-0003 acceptance (wolf reach): with the measured canid cadence (canidPlan), every paw lands each stride, no stance
 * IK target lies beyond (upper + lower)·√0.97 of its pivot (no overstep), planted paws do not slip (< 1 cm), and the stance
 * sweep matches Walter & Carrier 2007 (JEB 210:208: about 0.67 m at 9.2 m/s; ≥ 0.55 m at 6 m/s).
 */
const frac = (v: number) => v - Math.floor(v);
const REACH_K = Math.sqrt(.97);
const dir = (t: number) => ({ z: -Math.sin(t), y: -Math.cos(t) });
/** One stride of the default rig (core quadrupedPose) at speed v, checked by forward kinematics in the level body frame. */
function defaultStride(v: number, n = 400) {
  const gait = gaitFor('run', v, WOLF_LEGS)!;
  let worst = 0, slip = 0;
  for (let k = 0; k < n; k++) {
    const phase = k / n, pose = quadrupedPose('run', phase, 0, WOLF_LEGS, v);
    for (let i = 0; i < 4; i++) {
      if (frac(phase + gait.offsets[i]) >= gait.duty) continue; // stance legs only
      const L = limbOf(WOLF_LEGS, i), J = pose.joints[i], M = L.foot ?? 0;
      // absolute (level-frame) angle of the upper bone = girdle + leg
      const a1 = pose.girdles[i] + pose.legs[i], a2 = a1 + pose.knees[i], a3 = a2 + pose.wrists[i];
      const w = { z: J.z + L.upper * dir(a1).z + L.lower * dir(a2).z, y: J.y + L.upper * dir(a1).y + L.lower * dir(a2).y };
      worst = Math.max(worst, Math.hypot(w.z - J.z, w.y - J.y) / ((L.upper + L.lower) * REACH_K));
      const sole = { z: w.z + M * dir(a3).z, y: w.y + M * dir(a3).y };
      slip = Math.max(slip, Math.hypot(sole.z - pose.feet[i].z, sole.y - pose.feet[i].y));
    }
  }
  return { gait, worst, slip, sweep: gait.duty * gait.cycle };
}

test('T-0003 default rig: canid cadence, no overstep, planted paws do not slip, measured stance sweep', () => {
  for (const v of [6, 10]) {
    const { gait, worst, slip } = defaultStride(v), hz = v / gait.cycle, want = canidPlan(v).hz;
    assert.ok(Math.abs(hz - want) <= .15 * want, `${v} m/s: ${hz.toFixed(2)} Hz vs canid ${want.toFixed(2)} Hz (±15 %)`);
    assert.ok(worst <= 1 + 1e-6, `${v} m/s: a stance IK target is ${(worst * 100).toFixed(1)} % of the reachable distance (overstep)`);
    assert.ok(slip < .01, `${v} m/s: a planted paw is ${(slip * 100).toFixed(1)} cm off its target`);
  }
  const s92 = defaultStride(9.2).sweep, s6 = defaultStride(6).sweep;
  assert.ok(Math.abs(s92 - .67) <= .15 * .67, `sweep at 9.2 m/s ${s92.toFixed(2)} m vs 0.67 m (±15 %)`);
  assert.ok(s6 >= .55, `sweep at 6 m/s ${s6.toFixed(2)} m, want ≥ 0.55 m`);
});

test('T-0003 ?loco=1: at 6 and 10 m/s each hind paw touches down at the canid cadence', () => {
  for (const v of [6, 10]) {
    const seconds = 6, { poses } = run(undefined, v, seconds), settled = poses.slice(Math.round(1 / DT)); // skip the start-up second
    const want = canidPlan(v).hz;
    for (const leg of [1, 3]) {
      const hz = settled.flatMap(p => p.touchdowns).filter(t => t.leg === leg).length / (seconds - 1);
      assert.ok(Math.abs(hz - want) <= .15 * want, `${v} m/s leg ${leg}: ${hz.toFixed(2)} touchdowns/s vs canid ${want.toFixed(2)} Hz (±15 %)`);
    }
  }
});

test('T-0003 the vault never snaps: body height and pitch change smoothly on both paths at a trot and a gallop', () => {
  // A pop (the body dropping in the frame a paw runs out of reach) shows as metres per second of height change; a canid's
  // body moves vertically at about 1 m/s at most in a gallop. Limits here are a little over what both paths reach today.
  const MAX_RISE = 1.5, MAX_TURN = 5; // m/s, rad/s
  for (const v of [3, 6, 8, 10]) {
    const motion = v < 2 ? 'walk' : 'run', gait = gaitFor(motion, v, WOLF_LEGS)!, period = gait.cycle / v, n = 600;
    let rise = 0, turn = 0, prev = quadrupedPose(motion, 0, 0, WOLF_LEGS, v);
    for (let k = 1; k <= n; k++) {
      const p = quadrupedPose(motion, k / n, 0, WOLF_LEGS, v);
      rise = Math.max(rise, Math.abs(p.bob - prev.bob) * n / period); turn = Math.max(turn, Math.abs(p.pitch - prev.pitch) * n / period); prev = p;
    }
    assert.ok(rise < MAX_RISE && turn < MAX_TURN, `default ${v} m/s: ${rise.toFixed(2)} m/s, ${turn.toFixed(2)} rad/s`);
    const settled = run(undefined, v, 4).poses.slice(Math.round(2 / DT));
    let lr = 0, lt = 0;
    settled.forEach((p, k) => { if (k) { lr = Math.max(lr, Math.abs(p.height - settled[k - 1].height) / DT); lt = Math.max(lt, Math.abs(p.pitch - settled[k - 1].pitch) / DT); } });
    assert.ok(lr < MAX_RISE && lt < MAX_TURN, `?loco=1 ${v} m/s: ${lr.toFixed(2)} m/s, ${lt.toFixed(2)} rad/s`);
    // and every paw lands once per stride (no leash steps at a steady speed)
    const hz = settled.flatMap(p => p.touchdowns).length / 2 / 4;
    assert.ok(Math.abs(hz - v / gait.cycle) <= .05 * v / gait.cycle, `?loco=1 ${v} m/s: ${hz.toFixed(2)} touchdowns per paw per second vs ${(v / gait.cycle).toFixed(2)} strides/s`);
  }
});
