/**
 * The free-fly camera from photo mode (src/photo/photoMode.ts createPhotoMode().update).
 * Photo mode is the only free-flight in this repo (commit b4a2ace). The globe handoff calls this
 * same move. It does not invent a second flight model.
 *
 * Speeds are the ones that function already used: 6 m/s, 25 m/s while Shift is held.
 * Axes match it: f = W−S, r = D−A, u = (E or Space) − (Q or Ctrl).
 * The Xbox pad uses the drone bindings: left stick moves, right stick turns, RT climbs, LT descends.
 */
import { heightAt } from '../core/world';
import { atomValues, resolveContext, type Bindings, type PadState } from '../core/bindings';

export const PHOTO_FLY_SPEED = 6;
export const PHOTO_FLY_FAST = 25;
/** Radians per second at a full stick. [game calibration] Mouse look stays photo mode's pixel scale. */
export const PHOTO_FLY_LOOK = 1.2;

export interface FlyCam { x: number; y: number; z: number; yaw: number; pitch: number }
export interface FlyVel { x: number; y: number; z: number }

/**
 * One photo-mode move, including the turn. Yaw and pitch are radians for this frame
 * (a stick step or a drag). Does not touch velocity and does not clamp to the ground.
 */
export function photoFlyMove(cam: FlyCam, dt: number, f: number, r: number, u: number, fast: boolean, yaw = 0, pitch = 0) {
  cam.yaw += yaw;
  cam.pitch = Math.max(-1.55, Math.min(1.55, cam.pitch + pitch));
  const speed = (fast ? PHOTO_FLY_FAST : PHOTO_FLY_SPEED) * dt;
  const cp = Math.cos(cam.pitch);
  cam.x += (-Math.sin(cam.yaw) * cp * f + Math.cos(cam.yaw) * r) * speed;
  cam.z += (-Math.cos(cam.yaw) * cp * f - Math.sin(cam.yaw) * r) * speed;
  cam.y += (Math.sin(cam.pitch) * f + u) * speed;
}

/** Stick and trigger signs for this fly, from the drone binding values. Each axis is about −1..1. */
export function photoFlyStick(V: Record<string, number | undefined>) {
  return {
    f: (V.droneForward ?? 0) - (V.droneBack ?? 0),
    r: (V.droneRight ?? 0) - (V.droneLeft ?? 0),
    u: (V.droneClimb ?? 0) - (V.droneDescend ?? 0),
    yaw: (V.droneYawRight ?? 0) - (V.droneYawLeft ?? 0),
    pitch: (V.dronePitchUp ?? 0) - (V.dronePitchDown ?? 0),
  };
}

/** Xbox move, turn, climb and descend. Yaw and pitch are radians this frame. No pad means zeros. */
export function photoFlyPad(pad: PadState | undefined, dt: number, b: Bindings) {
  if (!pad) return { f: 0, r: 0, u: 0, yaw: 0, pitch: 0 };
  const s = photoFlyStick(resolveContext(b, atomValues([], pad), new Set(), 'drone').value);
  return { f: s.f, r: s.r, u: s.u, yaw: s.yaw * PHOTO_FLY_LOOK * dt, pitch: s.pitch * PHOTO_FLY_LOOK * dt };
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
  photoFlyMove(cam, dt, a.f, a.r, a.u, a.fast, a.yaw, a.pitch);
  if (cam.y < minY) cam.y = minY;
  return cam;
}
