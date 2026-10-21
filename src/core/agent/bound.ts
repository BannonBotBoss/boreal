/**
 * Asymmetric bounding gaits (half-bound / bound) for the shared agent pipeline's animals (Grok Bot, T-0009). Pure: no three.js.
 * Footfall timing per stride phase (0..1), duty factor and stride frequency from species data; the body's airborne arcs are
 * ballistic (h = g T^2 / 8 for an airborne gap of T seconds), so lift is not a tuned number.
 * Leg order everywhere: [left fore, right fore, left hind, right hind].
 */
import { gravity } from '../../proc/physics';

export interface BoundGait {
  /** stride phase (0..1) of each foot's touchdown, [LF, RF, LH, RH] */ touchdown: readonly [number, number, number, number];
  /** duty factor at <= transition speed and at top speed (linear in between) */ duty: readonly [number, number];
  /** stride frequency: Hz at the transition speed and at top speed (linear between); below it f = fT x (v / vT)^slowExp */
  cadence: { transitionSpeed: number; transitionHz: number; topSpeed: number; topHz: number; slowExp: number };
}
const lerp = (a: number, b: number, t: number) => a + (b - a) * Math.min(1, Math.max(0, t));
export function boundCadence(g: BoundGait, speed: number) {
  const c = g.cadence, v = Math.max(.02, Math.abs(speed));
  return v <= c.transitionSpeed ? c.transitionHz * (v / c.transitionSpeed) ** c.slowExp : lerp(c.transitionHz, c.topHz, (v - c.transitionSpeed) / (c.topSpeed - c.transitionSpeed));
}
export const boundStride = (g: BoundGait, speed: number) => Math.abs(speed) / boundCadence(g, speed);
export function boundDuty(g: BoundGait, speed: number) {
  const c = g.cadence; return lerp(g.duty[0], g.duty[1], (Math.abs(speed) - c.transitionSpeed) / (c.topSpeed - c.transitionSpeed));
}
const wrap = (x: number) => ((x % 1) + 1) % 1;
/** Foot `leg` at stride `phase`: in stance (u = 0 at touchdown .. 1 at lift-off) or in swing (u = 0 at lift-off .. 1 at the next touchdown). */
export function footState(g: BoundGait, phase: number, leg: number, duty: number) {
  const s = wrap(phase - g.touchdown[leg]);
  return s < duty ? { stance: true, u: s / duty } : { stance: false, u: (s - duty) / (1 - duty) };
}
/** Airborne gap at `phase` (no foot down): its length (stride share) and how far through it we are; null while supported. */
export function airborne(g: BoundGait, phase: number, duty: number) {
  const p = wrap(phase);
  if ([0, 1, 2, 3].some(l => footState(g, p, l, duty).stance)) return null;
  // walk back to the last lift-off and forward to the next touchdown (1/400 stride steps: exact enough for drawing)
  let back = 0, fwd = 0; const step = 1 / 400;
  while (back < 1 && ![0, 1, 2, 3].some(l => footState(g, p - back - step, l, duty).stance)) back += step;
  while (fwd < 1 && ![0, 1, 2, 3].some(l => footState(g, p + fwd + step, l, duty).stance)) fwd += step;
  const gap = back + fwd + step; return { gap, u: (back + step / 2) / gap };
}
/** Height (m) of the body above its standing height at `phase`: a ballistic arc over each airborne gap. */
export function boundLift(g: BoundGait, phase: number, speed: number) {
  const duty = boundDuty(g, speed), air = airborne(g, phase, duty); if (!air) return 0;
  const T = air.gap / boundCadence(g, speed), h = gravity() * T * T / 8; return 4 * h * air.u * (1 - air.u);
}