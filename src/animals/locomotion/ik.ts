/**
 * One limb by analytic IK. Same chain and rules as core/animalBehavior quadrupedPose (Claude): optional shoulder blade
 * that swings with the paw, two-bone solve to the carpus/hock with Claude's solveLeg, then a foot bone whose angle is a
 * rule (stance angle folding back by footFlex as the paw lifts). Added here: a sideways hip swing (`abduct`) so feet
 * can sit off the sagittal plane on side slopes and turns (pivot at the girdle top), and a clamp to the goniometric limits (skeleton.ts R6).
 */
import { solveLeg, type LimbDims } from '../../core/animalBehavior';
import { CANID_LIMB } from '../../core/skeleton';
import type { Vec3 } from './signals';

export interface LimbAngles { girdle: number; leg: number; knee: number; wrist: number; paw: number; abduct: number; joint: { z: number; y: number } }

/**
 * `foot` is the sole relative to the limb's ground point in the body frame (x right, y up, z back). `liftFrac` 0..1 is
 * how far through its lift the paw is (folds the foot bone). The top joint sits at height L.hip.
 */
export function solveLimb(L: LimbDims, forward: boolean, foot: Vec3, liftFrac: number): LimbAngles {
  const S = L.girdle ?? 0, M = L.foot ?? 0;
  // Sideways swing pivots at the top of the chain (the girdle pivot, L.hip + S, where the rig's girdle bone sits), so the
  // planar solve below happens in the swung plane and the foot lands exactly on target.
  const top = L.hip + S, drop = Math.hypot(top - foot.y, foot.x), abduct = Math.atan2(foot.x, top - foot.y), fy = top - drop;
  const psi = (L.footAngle ?? 0) - (L.footFlex ?? 0) * liftFrac;
  const hz = foot.z + M * Math.sin(psi), hy = fy + M * Math.cos(psi);
  const jointAt = (g: number) => ({ z: -S * Math.sin(g), y: L.hip + S - S * Math.cos(g) });
  let g = 0;
  if (S) { const j0 = jointAt(L.girdleRest ?? 0); g = (L.girdleRest ?? 0) + (L.girdleSwing ?? 0) * Math.atan2(-(hz - j0.z), -(hy - j0.y)); }
  const J = jointAt(g), sol = solveLeg(hz - J.z, hy - J.y, L.upper, L.lower, forward);
  return { girdle: g, leg: sol.hip - g, knee: sol.knee, wrist: M ? psi - (sol.hip + sol.knee) : 0, paw: M ? -psi : -(sol.hip + sol.knee), abduct, joint: J };
}

/** Sole position of a solved limb (sagittal FK, before abduction), for tests and debug overlays. */
export function soleOf(L: LimbDims, a: LimbAngles) {
  const dir = (t: number) => ({ z: -Math.sin(t), y: -Math.cos(t) });
  const a1 = a.girdle + a.leg, a2 = a1 + a.knee, a3 = a2 + a.wrist, M = L.foot ?? 0;
  const u = dir(a1), l = dir(a2), f = dir(a3);
  return { z: a.joint.z + L.upper * u.z + L.lower * l.z + M * f.z, y: a.joint.y + L.upper * u.y + L.lower * l.y + M * f.y };
}

const RAD = Math.PI / 180;
/** Largest flexion of the middle and lower joints: 180° − the goniometric minimum (Formenton et al. 2019 via skeleton.ts). */
export const FLEX_LIMIT = {
  front: { knee: (180 - CANID_LIMB.elbow.min) * RAD, wrist: (180 - CANID_LIMB.carpus.min) * RAD },
  hind: { knee: (180 - CANID_LIMB.stifle.min) * RAD, wrist: (180 - CANID_LIMB.tarsus.min) * RAD },
};
export function clampLimb(a: LimbAngles, front: boolean): LimbAngles {
  const lim = front ? FLEX_LIMIT.front : FLEX_LIMIT.hind, c = (v: number, m: number) => Math.max(-m, Math.min(m, v));
  return { ...a, knee: c(a.knee, lim.knee), wrist: c(a.wrist, lim.wrist) };
}
