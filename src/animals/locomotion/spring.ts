/**
 * Critically damped spring with a half-life (D. Holden, "Spring-It-On: The Game Developer's Spring-Roll-Call", 2021,
 * theorangeduck.com/page/spring-roll-call). Used as the "muscle" between an IK target angle and the joint: no overshoot,
 * a size-dependent lag, and smooth recovery when the target jumps. Formulas only; no code copied.
 */
export interface Spring { x: number; v: number }
export const spring = (x = 0): Spring => ({ x, v: 0 });
const damping = (halflife: number) => (4 * Math.LN2) / (halflife + 1e-5);
export function springTo(s: Spring, goal: number, halflife: number, dt: number) {
  const y = damping(halflife) / 2, j0 = s.x - goal, j1 = s.v + j0 * y, e = Math.exp(-y * dt);
  s.x = e * (j0 + j1 * dt) + goal; s.v = e * (s.v - j1 * y * dt);
  return s.x;
}
