export interface WolfPose { x: number; z: number; heading: number }
/** Stick X steers, stick Y controls forward/backward travel; no strafing. */
export function steerWolf(pose: WolfPose, steer: number, forward: number, dt: number, speed = 2): WolfPose {
  const heading = pose.heading - Math.max(-1, Math.min(1, steer)) * 2.2 * dt;
  const distance = Math.max(-1, Math.min(1, forward)) * speed * dt;
  return { heading, x: pose.x - Math.sin(heading) * distance, z: pose.z - Math.cos(heading) * distance };
}
