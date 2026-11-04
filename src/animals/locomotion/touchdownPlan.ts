// T-0044 run 11 (grok-gait): planned fore touchdown, the pure part.
// Every function here is deterministic. They take and return plain numbers / plain objects: no three.js, no Math.random,
// no module state, no clock. Each maps 1:1 onto a Rust `fn` (f64 in, f64 / struct out). The caller (bounding.ts) owns the
// per-leg state and the IK calls (foreLimb).
// Technique: plan the touchdown pose at the late-swing start and blend into it along the MIT Cheetah cubic Bezier
// (footSwing.ts, a literal port of mit-biomimetics/Cheetah-Software c54e50b, MIT).
// Band: forearm 11-36 deg below horizontal at touchdown (Schmidt 2008 JEB 211:3775, Table 4), used as 12-35 (1 deg margin, an estimate).
import { cubicBezier } from './footSwing';

export interface PlanPair { blade: number; psi: number }

/** Swing progress sp in [0,1) of a leg at CPG phase `ph` with stance duty `duty`; -1 while in stance. */
export function swingProgress(ph: number, duty: number): number {
  return ph >= duty ? (ph - duty) / (1 - duty) : -1;
}

/** True once the swing is at or past the plan start `from` (fraction of swing). */
export function inLateSwing(ph: number, duty: number, from: number): boolean {
  return ph >= duty && (ph - duty) / (1 - duty) >= from;
}

/** Phase and time left to touchdown (touchdown = the leg's phase wrapping to 1). hz = stride frequency. */
export function timeToTouchdown(ph: number, hz: number): { dphi: number; tRem: number } {
  const dphi = 1 - ph;
  return { dphi, tRem: dphi / Math.max(hz, 1e-6) };
}

/** T-0044 run 14: the same, for a fixed control step dt. The paw plants on the first frame at or after the phase wraps, so the
 *  body travels k whole frames (k = ceil(dphi / (hz dt))), not dphi / hz seconds: on average half a frame further (11.6 m/s at
 *  120 Hz: ~48 mm, the measured planned-vs-actual limb-frame landing error). dt <= 0 falls back to the continuous time. */
export function frameTouchdown(ph: number, hz: number, dt: number): { dphi: number; tRem: number } {
  const c = timeToTouchdown(ph, hz); if (!(dt > 0) || !(hz > 0)) return c;
  const k = Math.max(1, Math.ceil(c.dphi / (hz * dt) - 1e-9));
  return { dphi: k * hz * dt, tRem: k * dt };
}

/** Body ground position at touchdown, assuming constant velocity along the heading (fx, fz) for tRem seconds. */
export function bodyAtTouchdown(x: number, z: number, fx: number, fz: number, speed: number, tRem: number): { x: number; z: number } {
  return { x: x + fx * speed * tRem, z: z + fz * speed * tRem };
}

/** Distance ahead of the rest ground point where the paw lands: half the stance sweep plus the touch reach still to come. */
export function landingAhead(duty: number, stride: number, foreTouch: number, touchW: number): number {
  return duty * stride / 2 + foreTouch * (1 - touchW);
}

/** Forearm angle below horizontal, in degrees, from the world elbow K and wrist W positions. */
export function forearmBelowDeg(kx: number, ky: number, kz: number, wx: number, wy: number, wz: number): number {
  return Math.atan2(ky - wy, Math.hypot(wz - kz, wx - kx)) * 180 / Math.PI;
}

/** The plan's acceptance test: forearm inside [lo, hi] deg and the manus angle inside the scan range [psiFrom, psiTo] rad. */
export function inPlanBand(forearmDeg: number, manus: number, lo: number, hi: number, psiFrom: number, psiTo: number): boolean {
  return forearmDeg >= lo && forearmDeg <= hi && manus >= psiFrom - 1e-9 && manus <= psiTo + 1e-9;
}

/** Blend parameter from swing progress: 0 at `from`, 1 at touchdown. */
export function planBlendU(sp: number, from: number): number {
  return Math.min(1, (sp - from) / (1 - from));
}

/** The late-swing (blade, psi): from q0 (the pair at the plan start) to qf (the planned pair) along the Cheetah cubic Bezier. */
export function blendPlan(q0: PlanPair, qf: PlanPair, u: number): PlanPair {
  return { blade: cubicBezier(q0.blade, qf.blade, u), psi: cubicBezier(q0.psi, qf.psi, u) };
}
