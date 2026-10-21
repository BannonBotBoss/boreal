/**
 * One limb by analytic IK. Same chain and rules as core/animalBehavior quadrupedPose (Claude): optional shoulder blade
 * that swings with the paw, two-bone solve to the carpus/hock with Claude's solveLeg, then a foot bone whose angle is a
 * rule (stance angle folding back by footFlex as the paw lifts). Added here: a sideways hip swing (`abduct`) so feet
 * can sit off the sagittal plane on side slopes and turns (pivot at the girdle top), and a clamp to the goniometric limits (skeleton.ts R6).
 */
import { solveChain, type LimbDims } from '../../core/animalBehavior';
import { CANID_LIMB } from '../../core/skeleton';
import type { Vec3 } from './signals';

export interface LimbAngles { girdle: number; leg: number; knee: number; wrist: number; paw: number; abduct: number; joint: { z: number; y: number } }
/** T-0003 reach inputs (core/animalBehavior solveChain): all optional; without them the limb solves exactly as before. */
export interface LimbReach {
  /** chain top (blade pivot or hip joint) in the limb frame; default (0, hip + girdle). The pelvis moves the hind tops. */ top?: { z: number; y: number };
  /** absolute shoulder-blade angle (rest + reachTargets scapula); default the girdleSwing rule */ blade?: number;
  /** turn the foot bone toward the leg only as far as the two IK bones need to reach */ fit?: boolean;
}

/**
 * `foot` is the sole relative to the limb's ground point in the body frame (x right, y up, z back). `liftFrac` 0..1 is
 * how far through its lift the paw is (folds the foot bone). The chain top sits at `reach.top` (default L.hip + girdle).
 */
export function solveLimb(L: LimbDims, forward: boolean, foot: Vec3, liftFrac: number, reach: LimbReach = {}): LimbAngles {
  // Sideways swing pivots at the top of the chain (the girdle pivot, where the rig's girdle bone sits), so the planar
  // solve below happens in the swung plane and the foot lands exactly on target.
  const top = reach.top ?? { z: 0, y: L.hip + (L.girdle ?? 0) };
  const drop = Math.hypot(top.y - foot.y, foot.x), abduct = Math.atan2(foot.x, top.y - foot.y), fy = top.y - drop;
  const psi0 = (L.footAngle ?? 0) - (L.footFlex ?? 0) * liftFrac;
  const c = solveChain(L, forward, { z: foot.z, y: fy }, psi0, top, reach.blade, !!reach.fit);
  return { girdle: c.girdle, leg: c.leg, knee: c.knee, wrist: c.wrist, paw: c.paw, abduct, joint: c.joint };
}

/** Sole position of a solved limb (sagittal FK, before abduction), for tests and debug overlays. */
export function soleOf(L: LimbDims, a: LimbAngles) {
  const dir = (t: number) => ({ z: -Math.sin(t), y: -Math.cos(t) });
  const a1 = a.girdle + a.leg, a2 = a1 + a.knee, a3 = a2 + a.wrist, M = L.foot ?? 0;
  const u = dir(a1), l = dir(a2), f = dir(a3);
  return { z: a.joint.z + L.upper * u.z + L.lower * l.z + M * f.z, y: a.joint.y + L.upper * u.y + L.lower * l.y + M * f.y };
}

const RAD = Math.PI / 180;
/** Range of one joint as goniometric interior angles (deg, 180 = straight). `flex` (+1 / -1) is the sign solveChain gives the
 * joint when it folds; it is needed only when `max` < 180 (then the joint may not straighten past max, nor bend the other way). */
export interface JointRange { min: number; max: number; flex?: 1 | -1 }
/** One limb's ranges: the middle joint (elbow / stifle), the lower one (carpus / tarsus), and optionally the angle of the foot
 * bone to the ground in stance (deg: ~0 flat with the hock behind the toes, 90 vertical, > 90 hock ahead of the toes). */
export interface LimbLimits { knee: JointRange; wrist: JointRange; foot?: { min: number; max: number } }
/** Per-body joint ranges: data a body plan carries (bodyPlan.ts BodyPlan.limits), never a species branch here. */
export interface JointLimits { front: LimbLimits; hind: LimbLimits }
/** Dog goniometry (Formenton et al. 2019 via skeleton.ts CANID_LIMB): only the minimum (largest flexion) clamps, either way —
 * exactly the clamp this module always had; the default for every body that names no limits. */
export const CANID_LIMITS: JointLimits = {
  front: { knee: { min: CANID_LIMB.elbow.min, max: 180 }, wrist: { min: CANID_LIMB.carpus.min, max: 180 } },
  hind: { knee: { min: CANID_LIMB.stifle.min, max: 180 }, wrist: { min: CANID_LIMB.tarsus.min, max: 180 } },
};
/**
 * Leporid hind ankle and foot in stance: ankle (shank-to-metatarsus) 66.4 ± 13.4° at most dorsiflexed (38 % stance) to
 * 137.2 ± 4.8° at toe-off; foot (metatarsus-to-ground) 17.2 ± 6.3° (10 % stance) to 123.3 ± 3.6° (toe-off). Six New Zealand
 * White rabbits, 49 trials, stance 0.40 ± 0.15 s (Crouch et al. 2022, "Rabbit hindlimb kinematics and ground contact
 * kinetics during the stance phase of gait", PeerJ 10:e13611, doi:10.7717/peerj.13611, PMC9208372; Results and Table 1,
 * checked against the paper 2026-10-21). These are the means of the measured STANCE range of slow domestic-rabbit gait, not
 * anatomical end-ranges, so they apply to the gait (bounding.ts phases them in with motion), not to a sitting body. The paper's
 * foot is ankle-to-MTP marker; the rig's foot bone is hock-to-toe tip. Knee and fore limb: no lagomorph goniometry found, so
 * the dog values stand [placeholder].
 */
export const LEPORID_LIMITS: JointLimits = {
  front: CANID_LIMITS.front,
  hind: { knee: CANID_LIMITS.hind.knee, wrist: { min: 66.4, max: 137.2, flex: 1 }, foot: { min: 17.2, max: 123.3 } },
};
/** Largest flexion of the middle and lower joints: 180° − the goniometric minimum (Formenton et al. 2019 via skeleton.ts). */
export const FLEX_LIMIT = {
  front: { knee: (180 - CANID_LIMB.elbow.min) * RAD, wrist: (180 - CANID_LIMB.carpus.min) * RAD },
  hind: { knee: (180 - CANID_LIMB.stifle.min) * RAD, wrist: (180 - CANID_LIMB.tarsus.min) * RAD },
};
/** solveChain angle (rad, 0 = straight) clamped to a joint range. */
export function clampJoint(v: number, r: JointRange) {
  const hi = (180 - r.min) * RAD, lo = (180 - Math.min(180, r.max)) * RAD;
  if (lo <= 0 || !r.flex) return Math.max(-hi, Math.min(hi, v));
  return r.flex * Math.max(lo, Math.min(hi, r.flex * v));
}
export function clampLimb(a: LimbAngles, front: boolean, limits: JointLimits = CANID_LIMITS): LimbAngles {
  const lim = front ? limits.front : limits.hind;
  return { ...a, knee: clampJoint(a.knee, lim.knee), wrist: clampJoint(a.wrist, lim.wrist) };
}
/** A range part-way (t 0..1) from `a` to `b` (used to phase gait-stance ranges in with motion). */
export function blendLimits(a: JointLimits, b: JointLimits, t: number): JointLimits {
  if (t <= 0) return a; if (t >= 1) return b;
  const l = (x: number, y: number) => x + (y - x) * t;
  const j = (p: JointRange, q: JointRange): JointRange => ({ min: l(p.min, q.min), max: l(p.max, q.max), flex: q.flex ?? p.flex });
  const f = (p?: { min: number; max: number }, q?: { min: number; max: number }) => !q ? p : { min: l(p?.min ?? -90, q.min), max: l(p?.max ?? 270, q.max) };
  const limb = (p: LimbLimits, q: LimbLimits): LimbLimits => ({ knee: j(p.knee, q.knee), wrist: j(p.wrist, q.wrist), foot: f(p.foot, q.foot) });
  return { front: limb(a.front, b.front), hind: limb(a.hind, b.hind) };
}
