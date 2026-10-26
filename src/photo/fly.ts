/**
 * The free-fly camera from photo mode (src/photo/photoMode.ts createPhotoMode().update).
 * Photo mode is the only free-flight in this repo (commit b4a2ace). The globe handoff calls this
 * same move. It does not invent a second flight model.
 *
 * Speeds are the ones that function already used: 6 m/s, 25 m/s while Shift is held.
 * Axes match it: f = W−S, r = D−A, u = (E or Space) − (Q or Ctrl).
 */
import { heightAt } from '../core/world';

export const PHOTO_FLY_SPEED = 6;
export const PHOTO_FLY_FAST = 25;

export interface FlyCam { x: number; y: number; z: number; yaw: number; pitch: number }
export interface FlyVel { x: number; y: number; z: number }

/** One photo-mode move. Does not touch velocity and does not clamp to the ground. */
export function photoFlyMove(cam: FlyCam, dt: number, f: number, r: number, u: number, fast: boolean) {
  const speed = (fast ? PHOTO_FLY_FAST : PHOTO_FLY_SPEED) * dt;
  const cp = Math.cos(cam.pitch);
  cam.x += (-Math.sin(cam.yaw) * cp * f + Math.cos(cam.yaw) * r) * speed;
  cam.z += (-Math.cos(cam.yaw) * cp * f - Math.sin(cam.yaw) * r) * speed;
  cam.y += (Math.sin(cam.pitch) * f + u) * speed;
}

/** The floor photo mode already uses: just above the terrain, never through the water plane. */
export function photoFlyFloor(x: number, z: number) {
  return Math.max(heightAt(x, z), -.25) + .3;
}

/**
 * Drone step after the free fall. The carried velocity is applied first and is not replaced.
 * Zero input therefore keeps moving. Photo-mode fly is added on top, with the same axes.
 */
export function stepCarriedFly(cam: FlyCam, vel: FlyVel, dt: number, a: { f: number; r: number; u: number; fast: boolean; yaw: number; pitch: number }, minY: number) {
  cam.x += vel.x * dt; cam.y += vel.y * dt; cam.z += vel.z * dt;
  cam.yaw += a.yaw; cam.pitch = Math.max(-1.55, Math.min(1.55, cam.pitch + a.pitch));
  photoFlyMove(cam, dt, a.f, a.r, a.u, a.fast);
  if (cam.y < minY) cam.y = minY;
  return cam;
}
