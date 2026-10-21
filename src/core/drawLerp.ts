/**
 * Render interpolation for the fixed 30 Hz sim (Grok Bot, wolf walk). main.ts steps the player at 1/30 s but draws every
 * display frame; drawing the latest step alone moved the wolf, its legs and the follow camera in 30 Hz jumps (on a 60-165 Hz
 * screen: 1 of 2..5 frames moves, the rest repeat), which read as vibration. Draw a blend of the state before and after the
 * last step instead, `alpha` = how far the accumulator is into the next step (Fiedler, "Fix Your Timestep!", 2004).
 * Pure: no three/DOM.
 */
export interface DrawState { x: number; z: number; yaw: number; sim: number }
/** A jump larger than this between two steps (m) is a teleport (home, ?at=, rewind, photo restore): draw it, don't glide. */
export const DRAW_SNAP = 2;
/** The state to draw and the blend used (1 = latest step). Yaw takes the short way round. */
export function drawBetween(from: DrawState | undefined, to: DrawState, alpha: number): DrawState & { alpha: number } {
  const a = from && Math.hypot(to.x - from.x, to.z - from.z) <= DRAW_SNAP ? Math.max(0, Math.min(1, alpha)) : 1;
  if (!from || a === 1) return { ...to, alpha: 1 };
  const turn = to.yaw - from.yaw - 2 * Math.PI * Math.round((to.yaw - from.yaw) / (2 * Math.PI));
  return { x: from.x + (to.x - from.x) * a, z: from.z + (to.z - from.z) * a, yaw: from.yaw + turn * a, sim: from.sim + (to.sim - from.sim) * a, alpha: a };
}
