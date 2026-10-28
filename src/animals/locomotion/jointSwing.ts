// T-0044 run 12 (grok-gait): fore-limb joint-space swing smoothing, the pure part.
// Deterministic, plain numbers in and out: no three.js, no Math.random, no module state, no clock (maps 1:1 onto Rust fns).
// Techniques reused, not invented:
// - joint velocity limits on an IK result (a per-joint step clamp per control tick, as in MoveIt / KDL joint_limits
//   max_velocity), here on the swing frames only; the planted paw stays an exact IK solve;
// - a swing in joint space toward a planned contact configuration, blended along the MIT Cheetah cubic Bezier
//   (footSwing.ts, literal port of mit-biomimetics/Cheetah-Software c54e50b, MIT).
// Angles are the probe's segment angles (tools/touchdown-pop.ts, tools/elbow-pop.ts): scapula = girdle, humerus = girdle + leg,
// elbow = knee, manus = girdle + leg + knee + wrist (rad).
import { cubicBezier } from './footSwing';

export interface ForeJoints { girdle: number; leg: number; knee: number; wrist: number }
const DEG = Math.PI / 180;
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** Per-frame turn gate (rad): k * sweep / t_stance * dt, t_stance = duty / hz. sweep 88 deg = fore TD->LO sweep (Schmidt 2008
 *  JEB 211:3775 Table 4); k = 2 is the run-9 gate factor (an estimate). Same gate as tools/touchdown-pop.ts. */
export function jointGate(duty: number, hz: number, dt: number, sweepDeg = 88, k = 2): number {
  return k * sweepDeg * DEG * hz / Math.max(duty, 1e-6) * dt;
}

/** Segment angles (scapula, humerus, elbow, manus) of a fore limb. */
export function segments(a: ForeJoints): [number, number, number, number] {
  return [a.girdle, a.girdle + a.leg, a.knee, a.girdle + a.leg + a.knee + a.wrist];
}

/** Joints from segment angles (inverse of segments). */
export function fromSegments(s: readonly number[]): ForeJoints {
  return { girdle: s[0], leg: s[1] - s[0], knee: s[2], wrist: s[3] - s[1] - s[2] };
}

/** Move `prev` toward `next` by at most `max` rad per segment angle (wrapped differences). */
export function limitStep(prev: ForeJoints, next: ForeJoints, max: number): ForeJoints {
  const p = segments(prev), n = segments(next);
  return fromSegments(p.map((v, k) => v + Math.max(-max, Math.min(max, wrap(n[k] - v)))));
}

/** Joint-space blend from `a` to `b` along the Cheetah cubic Bezier at u in [0,1] (u <= 0: a, u >= 1: b). */
export function blendJoints(a: ForeJoints, b: ForeJoints, u: number): ForeJoints {
  const t = Math.max(0, Math.min(1, u)), p = segments(a), q = segments(b);
  return fromSegments(p.map((v, k) => cubicBezier(v, v + wrap(q[k] - v), t)));
}

/** Shoulder (glenoid) point in the limb frame for a blade angle: the chain top plus the girdle bone along (-sin, -cos). */
export function shoulderAt(top: { z: number; y: number }, girdleLen: number, girdle: number): { z: number; y: number } {
  return { z: top.z - girdleLen * Math.sin(girdle), y: top.y - girdleLen * Math.cos(girdle) };
}
/** Squared largest per-frame turn of the four segments (scapula, humerus, elbow, manus; rad): the min-max joint-displacement
 *  term for picking among exact IK solutions near the previous configuration (the "closest solution to the seed" rule of
 *  IKFast / TRAC-IK Distance mode, taken as a max norm because the gate is per joint). */
export function jointStep2(dScap: number, dHum: number, dElbow: number, dManus: number): number {
  return Math.max(wrap(dScap) ** 2, wrap(dHum) ** 2, wrap(dElbow) ** 2, wrap(dManus) ** 2);
}
