/**
 * Data-driven limb skeleton for the locomotion layer (grok-gait, T-0009): one body plan (a few measured lengths) becomes the
 * limb chains the controller solves, for any quadruped. Nothing here names a species; a host passes its own measurements.
 * Chains follow core/animalBehavior LimbDims (Claude's solver, read only) and SKELETON-RULES.md: fore = shoulder → upper arm →
 * forearm → (manus); hind = hip → thigh → shank → hind foot (metatarsus + toes), hock pointing back.
 * Leg order everywhere: LF, LH, RF, RH (front = even index); body frame x right, y up, z back, origin on the ground under the hip joints.
 */
import type { LegDims, LimbDims } from '../../core/animalBehavior';
import type { LegLayout } from './signals';

/** Measured body: lengths in metres, z in the body frame (+z back). */
export interface BodyPlan {
  /** hip joint height standing at rest */ hip: number;
  /** hip and shoulder joints along the body (+z back) */ hipZ: number; shoulderZ: number;
  /** half the left-right spacing of the fore and hind limbs */ track: { fore: number; hind: number };
  /** shoulder joint to the fore sole, all segments */ foreLeg: number;
  /** hip joint to the hock (thigh + shank) */ hindLeg: number;
  /** hock to the toe tip (metatarsus + toes): long in plantigrade / leaping animals */ hindFoot: number;
  /** fore manus (wrist to toe) as a share of foreLeg; 0 = no separate foot bone */ manus?: number;
  /** upper bone's share of the two IK bones (thigh of hindLeg, upper arm of the rest of foreLeg) */ upperShare?: number;
  /** shoulder joint height at rest as a share of foreLeg (1 = straight leg) */ foreBend?: number;
  /** hip-to-hock chord at rest as a share of hindLeg (knee bend standing) */ hindBend?: number;
  /** hind foot angle for solvers that hold one angle (rad from vertical, + toes ahead of the hock); bounding.ts picks it per frame (hindFoot) */ runFootAngle?: number;
}
/** Defaults for the optional shares [estimate: drawn to the reference photos; SKELETON-RULES "Body proportions ... approximate"]. */
export const PLAN_DEFAULTS = { manus: .2, upperShare: .48, foreBend: .92, hindBend: .8, runFootAngle: .7 };

export interface Skeleton extends LegLayout {
  plan: BodyPlan;
  /** the fore and hind limb chains (fore = legs, hind = legs.hind) */ legs: LegDims & { hind: LimbDims };
  /** hind foot angle standing (rad, + toes ahead of the hock): plantigrade when near π/2 */ restFootAngle: number;
  /** shoulder joint height at rest */ shoulder: number;
  /** distance shoulder to hip along the back */ trunk: number;
}
const req = <K extends keyof typeof PLAN_DEFAULTS>(p: BodyPlan, k: K) => (p[k] ?? PLAN_DEFAULTS[k]) as number;

/**
 * The limb skeleton of a body plan. The hind foot rests at the angle that puts the hip at its measured height with the knee
 * bent to `hindBend` (a plantigrade animal comes out near flat-footed); the shoulder sits at `foreBend` × the fore leg.
 * Throws if the measurements cannot stand (a hip higher than thigh + shank + foot).
 */
export function skeletonOf(plan: BodyPlan): Skeleton {
  const up = req(plan, 'upperShare'), manus = req(plan, 'manus') * plan.foreLeg, foreIk = plan.foreLeg - manus;
  const shoulder = req(plan, 'foreBend') * plan.foreLeg, chord = req(plan, 'hindBend') * plan.hindLeg;
  const hockY = plan.hip - chord; // hock height standing (hip-to-hock chord vertical at rest)
  if (hockY > plan.hindFoot || hockY < 0) throw new Error(`body plan cannot stand: hock at ${hockY.toFixed(3)} m vs foot ${plan.hindFoot} m`);
  const restFootAngle = Math.acos(hockY / plan.hindFoot);
  const fore: LimbDims = { hip: shoulder, upper: up * foreIk, lower: (1 - up) * foreIk, foot: manus, footAngle: 0, footFlex: .6, bend: 'back' };
  const hind: LimbDims = { hip: plan.hip, upper: up * plan.hindLeg, lower: (1 - up) * plan.hindLeg, foot: plan.hindFoot, footAngle: req(plan, 'runFootAngle'),
    footFlex: .5, bend: 'forward', stance: plan.hindFoot * Math.sin(restFootAngle) };
  // origin at the hip joints (the body pitches about them): hind limbs at z 0, fore limbs the trunk ahead
  const fz = plan.shoulderZ - plan.hipZ, hips = [[-plan.track.fore, fz], [-plan.track.hind, 0], [plan.track.fore, fz], [plan.track.hind, 0]] as const;
  return { plan, legs: { ...fore, hind }, hips, restFootAngle, shoulder, trunk: Math.abs(plan.hipZ - plan.shoulderZ) };
}
