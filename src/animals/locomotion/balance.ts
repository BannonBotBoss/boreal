/**
 * Body balance from the ground under the four limbs: height = mean ground height under the hips/shoulders; pitch and
 * roll from the plane through them (the support-plane fit of threejs-procedural-spider, and the hip-height /
 * counter-roll terms of Malbers' Quadruped Foot, reduced to closed form). Pitch > 0 raises the front (three.js
 * rotation.x), roll > 0 raises the right side (rotation.z).
 */
export interface Tilt { height: number; pitch: number; roll: number }
/** Heights in leg order LF, LH, RF, RH; `wheelbase` = front-to-hind distance, `track` = left-to-right distance. */
export function supportPlane(h: readonly number[], wheelbase: number, track: number, maxTilt = .6): Tilt {
  const c = (v: number) => Math.max(-maxTilt, Math.min(maxTilt, v));
  const front = (h[0] + h[2]) / 2, hind = (h[1] + h[3]) / 2, left = (h[0] + h[1]) / 2, right = (h[2] + h[3]) / 2;
  return { height: (front + hind) / 2, pitch: c(Math.atan2(front - hind, wheelbase)), roll: c(Math.atan2(right - left, Math.max(1e-3, track))) };
}
