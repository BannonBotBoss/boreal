/**
 * Seated hand intent for the forest (issue #290's next step, the contest pass/fail).
 * Point and pinch glides toward the point on the ground. The other hand's pinch snaps the heading.
 * No keyboard and no controller. The heading matches the game: forward is (−sin yaw, −cos yaw).
 */

export const HAND = { pinch: 0.9, minStepM: 0.45, snap: Math.PI / 6, reachM: 12, fistM: 0.09, openM: 0.12, openGapM: 0.04 };
/** On-screen words for the hands-only contest. No controller buttons. */
export const HAND_HINT = 'Point and pinch to move. Pinch the other hand to turn. An open paw grabs. A closed paw digs.';

/** Distances between the wrist and the fingertips, in metres, plus the thumb–index gap. */
export interface PawMeasure {
  index: number; middle: number; ring: number; pinky: number; thumbIndex: number; pinch: number;
}
export type Paw = 'point' | 'open' | 'fist' | 'relaxed';

/**
 * Point (pinch, index out) still glides. An open paw is the grab. A closed fist digs or nudges.
 * Pinch wins, so a pointing pinch is not read as a fist.
 */
export function pawOf(m: PawMeasure): Paw {
  const tips = [m.index, m.middle, m.ring, m.pinky];
  if (m.pinch > HAND.pinch) return 'point';
  if (tips.filter(d => d < HAND.fistM).length >= 3) return 'fist';
  if (tips.filter(d => d > HAND.openM).length >= 3 && m.thumbIndex > HAND.openGapM) return 'open';
  return 'relaxed';
}

/** Grab and dig fire once, when the paw first takes that shape. Pointing stays while it is held. */
export function pawEdge(prev: Paw, now: Paw): 'grab' | 'dig' | null {
  if (now === 'open' && prev !== 'open') return 'grab';
  if (now === 'fist' && prev !== 'fist') return 'dig';
  return null;
}

/** Game yaw that faces `to` from `from`, or null when the point is too close to bother moving. */
export function headingToward(from: { x: number; z: number }, to: { x: number; z: number }, minM = HAND.minStepM): number | null {
  const dx = to.x - from.x, dz = to.z - from.z;
  if (Math.hypot(dx, dz) < minM) return null;
  return Math.atan2(-dx, -dz);
}

/** Snap one step. `side` −1 is left, +1 is right. */
export function snapYaw(yaw: number, side: -1 | 1) {
  return yaw + side * HAND.snap;
}

/**
 * Reference-space point into the forest. The origin sits on the ground at the mama,
 * rotated by her heading, and the headset's local −Z is her forward.
 */
export function refToWorld(at: { x: number; y?: number; z: number; yaw: number }, rx: number, ry: number, rz: number) {
  const c = Math.cos(at.yaw), s = Math.sin(at.yaw);
  return { x: at.x + c * rx + s * rz, y: (at.y ?? 0) + ry, z: at.z - s * rx + c * rz };
}

/** Where a world-space ray meets the ground, or null if it does not point down within reach. */
export function groundAhead(origin: { x: number; y: number; z: number }, dir: { x: number; y: number; z: number }, floorY: number, reach = HAND.reachM) {
  if (dir.y > -0.05) return null;
  const t = (floorY - origin.y) / dir.y;
  if (t < 0 || t > reach) return null;
  return { x: origin.x + dir.x * t, z: origin.z + dir.z * t };
}
