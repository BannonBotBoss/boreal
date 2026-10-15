import * as THREE from 'three';
import { CHUNK_SIZE, heightAt } from '../core/world';
import { LEVEL } from '../core/tuning';
import { RENDER } from '../core/renderSettings';

// Aim slightly above the wolf's centre so it appears below screen centre.
export const DEFAULT_PITCH = 10 * Math.PI / 180;
export const LOOK_PITCH_RANGE = 30 * Math.PI / 180;
export function clampLookPitch(pitch: number) {
  return THREE.MathUtils.clamp(pitch, DEFAULT_PITCH - LOOK_PITCH_RANGE, DEFAULT_PITCH + LOOK_PITCH_RANGE);
}
// Exponential spring return: 98% settled in 0.3 seconds, without overshoot.
export function springLookPitch(pitch: number, input: number, dt: number, heldPitch?: number) {
  const target = heldPitch === undefined
    ? DEFAULT_PITCH + THREE.MathUtils.clamp(input, -1, 1) * LOOK_PITCH_RANGE
    : clampLookPitch(heldPitch);
  return clampLookPitch(target + (pitch - target) * Math.exp(-14 * Math.max(0, dt)));
}
export const RIDER_HEIGHT = 1.6;
export const RIDER_DISTANCE = 3;
// Positive pitch looks down; negative pitch looks above the horizon.
export function clampPitch(pitch: number) { return THREE.MathUtils.clamp(pitch, -Math.PI * 80 / 180, Math.PI * 89 / 180); }
export function positionCamera(camera: THREE.PerspectiveCamera, x: number, z: number, altitude: number, yaw: number, pitch = DEFAULT_PITCH, lookYaw = 0) {
  const ground = Math.max(heightAt(x, z), -.2);
  const horizontalDistance = altitude * RIDER_DISTANCE / RIDER_HEIGHT;
  camera.position.set(x + Math.sin(yaw) * horizontalDistance, ground + altitude, z + Math.cos(yaw) * horizontalDistance);
  const angle = clampPitch(pitch);
  // Aim independently of the player; no division by tan(pitch) at the horizon.
  camera.lookAt(camera.position.x - Math.sin(yaw + lookYaw) * Math.cos(angle),
    camera.position.y - Math.sin(angle), camera.position.z - Math.cos(yaw + lookYaw) * Math.cos(angle));
  camera.updateMatrixWorld(true);
}
export function terrainGeometry(cx: number, cz: number) {
  const geometry = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, RENDER.terrainSegments, RENDER.terrainSegments);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.attributes.position, colors: number[] = [];
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i) + (cx + .5) * CHUNK_SIZE;
    const z = positions.getZ(i) + (cz + .5) * CHUNK_SIZE;
    const y = heightAt(x, z);
    positions.setXYZ(i, x, y, z);
    const color = new THREE.Color(y < LEVEL.shore ? 0x929771 : y > LEVEL.upland ? 0x8d9582 : 0x788e60);
    colors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}
