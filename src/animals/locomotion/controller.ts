/**
 * Locomotion controller: signals → CPG phases → feet (world-planted, terrain-sampled) → body tilt → limb IK → joint
 * springs. One instance per animal; all state is plain numbers (snapshot-friendly) and nothing is random.
 * LOD (PROJECT-RULES rule 8): 'near' = everything above; 'mid' = the same CPG phases driving the ideal flat
 * trajectory on the tilted body plane (2 ground samples, no foot locks, no springs). Far = no instance at all.
 * M2: planted legs snap to their IK solution (springs smooth only swing legs, so planted paws never trail), a gallop
 * body bounce (Claude's gallopBob on the LH phase), and the jump/pounce state machine (jump.ts) driven by `intent`.
 */
import { WOLF_LEGS, bendsForward, gallopBob, isFrontLeg, limbOf } from '../../core/animalBehavior';
import { LEG_XZ } from '../../core/wolfBody';
import { WOLF_SCALE } from '../../core/wolfModes';
import { createCpg, phases, stepCpg, type Cpg } from './cpg';
import { footState, forceStep, stepFoot, toWorld, type FootState } from './foot';
import { planGait, type GaitPlan } from './gaits';
import { clampLimb, soleOf, solveLimb, type LimbAngles } from './ik';
import { supportPlane, type Tilt } from './balance';
import { spring, springTo, type Spring } from './spring';
import { LEG_NAMES, type LegLayout, type LegPose, type LocoSignals, type Lod, type TerrainFn, type Touchdown, type Vec3 } from './signals';
import { smooth01 } from '../../proc/math';
import { flightFoot, jumpFrame, type Jump, type JumpFrame } from './jump';
import { POSTURE, carryWeight } from './posture';
import { applied } from '../../core/quality';

/** The reference test body: Claude's real-size gray-wolf legs (WOLF_LEGS) and limb positions (LEG_XZ × WOLF_SCALE). Read only. */
export const referenceLayout = (): LegLayout => ({ legs: WOLF_LEGS, hips: LEG_XZ.map(([x, z]) => [x * WOLF_SCALE, z * WOLF_SCALE] as const) });

/** Joint and body spring half-lives (s) at a 0.55 m hip, scaled by √(hip / 0.55) (dynamic similarity; game calibration). */
export const SPRINGS = { joint: .025, body: .08, refHip: .55 };
const KEYS = ['girdle', 'leg', 'knee', 'wrist', 'paw', 'abduct'] as const;
/**
 * Full-detail radius (m): within it an animal runs the 'near' path, beyond it 'mid'. It is the `loco` column of the
 * core/quality.ts LADDER (PROJECT-RULES rule 10: Ultra 40 … Minimum 6 m), so it follows the governor's tier and the
 * manual caps. Beyond INTEREST.mid (core/interest.ts) an animal is not instantiated, so it needs no locomotion at all.
 */
export const LOCO_LOD = { get nearRadius() { return applied().loco; } };
export const lodAt = (distance: number, nearRadius = LOCO_LOD.nearRadius): Lod => distance <= nearRadius ? 'near' : 'mid';

export interface Locomotion {
  update(s: LocoSignals, dt: number, lod?: Lod): LegPose;
  /** called once per paw touchdown (also listed in LegPose.touchdowns); returns an unsubscribe function */
  onTouchdown(fn: (t: Touchdown) => void): () => void;
  readonly feet: FootState[]; readonly cpg: Cpg; plan(): GaitPlan; jumping(): boolean;
}

export function createLocomotion(layout: LegLayout, ground: TerrainFn, start: { x: number; z: number; heading: number }): Locomotion {
  const { legs, hips } = layout;
  // the fore wrist folds further through the swing (POSTURE.swingWristFlex); the sole target is unchanged, so contacts stay exact
  const limbs = [0, 1, 2, 3].map(i => { const L = limbOf(legs, i); return isFrontLeg(i) ? { ...L, footFlex: (L.footFlex ?? 0) + POSTURE.swingWristFlex, footAngle: (L.footAngle ?? 0) + POSTURE.foreFootAngle } : { ...L, footAngle: (L.footAngle ?? 0) + POSTURE.hindFootAngle }; });
  const restBody = (i: number) => [hips[i][0] * POSTURE.track, hips[i][1] - (limbs[i].stance ?? 0) - (isFrontLeg(i) ? 0 : POSTURE.hindReach * legs.hip)] as const;
  const restWorld = (x: number, z: number, h: number, i: number) => toWorld(x, z, h, ...restBody(i));
  const wheelbase = Math.abs((hips[1][1] + hips[3][1]) / 2 - (hips[0][1] + hips[2][1]) / 2);
  const track = Math.abs((hips[2][0] + hips[3][0]) / 2 - (hips[0][0] + hips[1][0]) / 2);
  let plan = planGait(0, legs, 'walk');
  const cpg = createCpg(plan.offsets);
  const feet = [0, 1, 2, 3].map(i => { const p = restWorld(start.x, start.z, start.heading, i); return footState({ x: p.x, y: ground(p.x, p.z), z: p.z }); });
  const joints = [0, 1, 2, 3].map(() => Object.fromEntries(KEYS.map(k => [k, spring()])) as Record<typeof KEYS[number], Spring>);
  const body = { height: spring(ground(start.x, start.z)), pitch: spring(), roll: spring() };
  let first = true, jump: Jump | undefined, lastStage = '', landed = false;
  const wasDown = [true, true, true, true], listeners = new Set<(t: Touchdown) => void>();
  const scale = Math.sqrt(legs.hip / SPRINGS.refHip);

  function update(s: LocoSignals, dt: number, lod: Lod = 'near'): LegPose {
    const moving = Math.abs(s.speed) > .05;
    plan = planGait(s.speed, legs, s.gait);
    stepCpg(cpg, plan.offsets, moving ? Math.abs(s.speed) / plan.cycle : 0, dt, moving ? 1 : 0);
    const ph = phases(cpg), h = s.heading;
    const hipGround = hips.map(([bx, bz]) => { const p = toWorld(s.x, s.z, h, bx, bz); return ground(p.x, p.z); });
    // mid LOD samples the ground only at the front and hind pair centres
    const t: Tilt = lod === 'near' ? supportPlane(hipGround, wheelbase, track) : (() => {
      const f = toWorld(s.x, s.z, h, 0, (hips[0][1] + hips[2][1]) / 2), b = toWorld(s.x, s.z, h, 0, (hips[1][1] + hips[3][1]) / 2);
      const hf = ground(f.x, f.z), hb = ground(b.x, b.z); return { height: (hf + hb) / 2, pitch: Math.atan2(hf - hb, wheelbase), roll: 0 };
    })();
    const near = lod === 'near' && !first, hl = SPRINGS.body * scale;
    const base = near ? { height: springTo(body.height, t.height, hl, dt), pitch: springTo(body.pitch, t.pitch, hl, dt), roll: springTo(body.roll, t.roll, hl, dt) }
      : (body.height.x = t.height, body.pitch.x = t.pitch, body.roll.x = t.roll, t);
    // jump / pounce: an intent starts one when none is running (callers send it on the frame the jump begins)
    if (!jump && (s.intent?.kind === 'jump' || s.intent?.kind === 'pounce')) jump = { t: 0, kind: s.intent.kind };
    let jf: JumpFrame | undefined;
    if (jump) { jump.t += dt; jf = jumpFrame(jump, legs.hip); if (jf.done) { jump = undefined; jf = undefined; } }
    const bounce = !jf && moving && plan.id === 'gallop' ? gallopBob(ph[1], legs.hip, plan.duty) : 0;
    const crouch = jf ? 0 : POSTURE.bodyDrop * legs.hip * carryWeight(s.speed);
    const tilt: Tilt = { height: base.height + bounce - crouch + (jf?.heightOff ?? 0), pitch: base.pitch + (jf ? 0 : POSTURE.bodyPitch * carryWeight(s.speed)) + (jf?.pitchOff ?? 0), roll: base.roll };
    const stage = jf?.stage ?? '';
    if (stage === 'flight' && lastStage !== 'flight') feet.forEach(f => { f.planted = false; f.forced = false; f.from = { ...f.at }; });
    landed = stage === 'land' && lastStage === 'flight';
    if (landed) feet.forEach(f => { f.planted = true; f.forced = false; f.at = { x: f.at.x, y: ground(f.at.x, f.at.z), z: f.at.z }; });
    lastStage = stage;
    const fwd = { x: -Math.sin(h), z: -Math.cos(h) };
    const pose: LegPose = { girdles: [], legs: [], knees: [], wrists: [], paws: [], abduct: [], feet: [], contacts: [], height: tilt.height, pitch: tilt.pitch, roll: tilt.roll,
      gait: plan.id, phases: ph, duty: plan.duty, cycle: plan.cycle, froude: plan.froude, touchdowns: [] };
    const cw = jf ? 0 : carryWeight(s.speed); pose.carry = { head: POSTURE.headPitch * cw, drop: POSTURE.headDrop * cw, tail: POSTURE.tailDrop * cw };
    for (let i = 0; i < 4; i++) {
      const L = limbs[i], front = isFrontLeg(i);
      let rel: Vec3, lift: number, contact: boolean;
      if (jf?.stage === 'flight' || (jf && lod !== 'near')) {
        const restZ = restBody(i)[1] - hips[i][1];
        const ff = jf.stage === 'flight' ? flightFoot(front, jf.air, L.hip, jump!.kind, restZ) : { x: 0, y: 0, z: restZ, lift: 0 };
        rel = { x: ff.x + restBody(i)[0] - hips[i][0], y: ff.y, z: ff.z }; lift = ff.lift; contact = jf.stage !== 'flight';
        const w = limbToWorld(rel, s.x, s.z, h, tilt, hips[i]); pose.feet.push(w); feet[i].at = w;
      } else if (lod === 'near') {
        const r = stepFoot(feet[i], { phase: ph[i], duty: plan.duty, cycle: plan.cycle, lift: plan.lift * (front ? 1 + (POSTURE.foreLift - 1) * carryWeight(s.speed) : 1), moving: moving && !jf, reverse: plan.reverse, dt, speed: Math.abs(s.speed), rest: restWorld(s.x, s.z, h, i), fwd }, ground);
        rel = worldToLimb(r.at, s.x, s.z, h, tilt, hips[i]); lift = r.lift; contact = feet[i].planted; pose.feet.push({ ...r.at });
      } else {
        // ideal distance-phased trajectory (core/animalBehavior footTarget), on the tilted body plane
        const stride = plan.duty * plan.cycle, dir = plan.reverse ? -1 : 1, p = ph[i], [, rz] = restBody(i);
        contact = !moving || p < plan.duty; const sw = (p - plan.duty) / (1 - plan.duty);
        rel = moving ? (contact ? { x: 0, y: 0, z: dir * stride * (p / plan.duty - .5) } : { x: 0, y: plan.lift * Math.sin(Math.PI * sw), z: dir * stride * (.5 - smooth01(sw)) }) : { x: 0, y: 0, z: 0 };
        rel.z += rz - hips[i][1]; rel.x += restBody(i)[0] - hips[i][0]; lift = moving && !contact ? Math.sin(Math.PI * sw) : 0;
        pose.feet.push(limbToWorld(rel, s.x, s.z, h, tilt, hips[i]));
        if (moving) { feet[i].planted = contact; feet[i].at = pose.feet[i]; }
      }
      let raw = solveLimb(L, bendsForward(legs, i), rel, lift);
      const fits = (r: LimbAngles) => reachError(L, clampLimb(r, front), rel) < 1e-7; // within joint limits and reach
      if (front && lift > 0 && !fits(raw)) { // wrist flick past the joint limits or reach: fold only as far as they allow, keep the paw on target
        let lo = 0, hi = 1; for (let k = 0; k < 6; k++) { const m = (lo + hi) / 2, r = solveLimb(L, bendsForward(legs, i), rel, lift * m); if (fits(r)) { lo = m; raw = r; } else hi = m; }
        if (lo === 0) raw = solveLimb(L, bendsForward(legs, i), rel, 0);
      }
      const a: LimbAngles = clampLimb(raw, front);
      if (lod === 'near' && contact && reachError(L, a, rel) > REACH_TOLERANCE) { forceStep(feet[i]); contact = false; } // leash
      const j = joints[i], hj = Math.min(SPRINGS.joint * scale, SWING_SPRING_SHARE * (moving ? (1 - plan.duty) * plan.cycle / Math.max(Math.abs(s.speed), 1e-3) : Infinity)); // lag stays a small share of the swing, so fast gaits don't trail
      // planted legs snap (exact contact), swing legs follow through the spring ("muscle" lag only in the air)
      const out = near && !contact ? Object.fromEntries(KEYS.map(k => [k, springTo(j[k], a[k], hj, dt)])) as Record<typeof KEYS[number], number>
        : (KEYS.forEach(k => { j[k].x = a[k]; j[k].v = 0; }), a);
      pose.girdles.push(out.girdle); pose.legs.push(out.leg); pose.knees.push(out.knee); pose.wrists.push(out.wrist); pose.paws.push(out.paw); pose.abduct.push(out.abduct);
      pose.contacts.push(contact);
    }
    // touchdowns: contact rising edges (none on the first frame, which starts with all four paws down)
    for (let i = 0; i < 4; i++) {
      if (!first && pose.contacts[i] && !wasDown[i]) pose.touchdowns.push({ leg: i, name: LEG_NAMES[i], worldPos: { ...pose.feet[i] }, speed: Math.abs(s.speed), gait: plan.id,
        strength: landed ? 1 : Math.min(1, .3 + .35 * Math.sqrt(plan.froude)), landing: landed });
      wasDown[i] = pose.contacts[i];
    }
    pose.touchdowns.forEach(t => listeners.forEach(fn => fn(t)));
    first = false;
    return pose;
  }
  return { update, feet, cpg, plan: () => plan, jumping: () => !!jump, onTouchdown: fn => (listeners.add(fn), () => { listeners.delete(fn); }) };
}

/** Swing-leg spring half-life is capped at this share of the swing duration. */
export const SWING_SPRING_SHARE = .1;
/** A planted foot further than this (m) from where the limb can reach is lifted (leash). */
export const REACH_TOLERANCE = 1e-6;
/** Distance between a limb target and where the solved, clamped limb actually puts the sole. */
function reachError(L: ReturnType<typeof limbOf>, a: LimbAngles, rel: Vec3) {
  const top = L.hip + (L.girdle ?? 0), s = soleOf(L, a);
  return Math.hypot(s.z - rel.z, s.y - (top - Math.hypot(top - rel.y, rel.x)));
}

/** World point → limb frame (x right, y up from the tilted body plane, z back, origin at the limb's ground point). */
export function worldToLimb(p: Vec3, x: number, z: number, h: number, t: Tilt, hip: readonly [number, number]): Vec3 {
  const vx = p.x - x, vy = p.y - t.height, vz = p.z - z;
  const bx = vx * Math.cos(h) - vz * Math.sin(h), bz = vx * Math.sin(h) + vz * Math.cos(h); // undo heading (rotation.y)
  const y1 = vy * Math.cos(t.pitch) + bz * Math.sin(t.pitch), z1 = -vy * Math.sin(t.pitch) + bz * Math.cos(t.pitch); // undo pitch (x)
  const x2 = bx * Math.cos(t.roll) + y1 * Math.sin(t.roll), y2 = -bx * Math.sin(t.roll) + y1 * Math.cos(t.roll); // undo roll (z)
  return { x: x2 - hip[0], y: y2, z: z1 - hip[1] };
}
/** Inverse of worldToLimb (tilt group = rotation.x pitch, rotation.z roll inside a rotation.y heading group). */
export function limbToWorld(r: Vec3, x: number, z: number, h: number, t: Tilt, hip: readonly [number, number]): Vec3 {
  const bx0 = r.x + hip[0], by0 = r.y, bz0 = r.z + hip[1];
  const x1 = bx0 * Math.cos(t.roll) - by0 * Math.sin(t.roll), y1 = bx0 * Math.sin(t.roll) + by0 * Math.cos(t.roll); // roll
  const y2 = y1 * Math.cos(t.pitch) - bz0 * Math.sin(t.pitch), z2 = y1 * Math.sin(t.pitch) + bz0 * Math.cos(t.pitch); // pitch
  const w = toWorld(x, z, h, x1, z2);
  return { x: w.x, y: y2 + t.height, z: w.z };
}
