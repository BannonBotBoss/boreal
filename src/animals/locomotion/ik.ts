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
/** Largest flexion of the middle and lower joints: 180° − the goniometric minimum (Formenton et al. 2019 via skeleton.ts). */
export const FLEX_LIMIT = {
  front: { knee: (180 - CANID_LIMB.elbow.min) * RAD, wrist: (180 - CANID_LIMB.carpus.min) * RAD },
  hind: { knee: (180 - CANID_LIMB.stifle.min) * RAD, wrist: (180 - CANID_LIMB.tarsus.min) * RAD },
};
export function clampLimb(a: LimbAngles, front: boolean): LimbAngles {
  const lim = front ? FLEX_LIMIT.front : FLEX_LIMIT.hind, c = (v: number, m: number) => Math.max(-m, Math.min(m, v));
  return { ...a, knee: c(a.knee, lim.knee), wrist: c(a.wrist, lim.wrist) };
}
