import * as THREE from 'three';
import { column, surfaceColor } from '../core/ground';
import { finish } from '../core/interest';
import { CHUNK_SIZE, heightAt, terrainBand } from '../core/world';
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
/** Staged materials: bedrock = Sentinel-2 TCI mean over ESA WorldCover 'bare' in the Kenora reference window (#928575); peat/clay/till/
 *  sand are game tints in the same family (the canopy hides most mineral ground in the imagery) [verify]. */
const BAND_COLOR = { water: 0x929771, shore: 0x929771, upland: 0x8d9582, forest: 0x788e60, bedrock: 0x928575, till: 0x788e60, sand: 0xa59a6e, clay: 0x7f8a62, peat: 0x5a6340 };
/** Terrain mesh for a chunk, as a sliced job (yields every few rows) so building is spread over frames (core/interest).
 * `segments`/`groundColour` come from the interest tier: mid-tier chunks are coarse and skip the layered-ground colour. */
export function* terrainJob(cx: number, cz: number, segments = RENDER.terrainSegments, groundColour = true) {
  const geometry = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, segments, segments);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.attributes.position, colors = new Float32Array(positions.count * 3), wet = new Float32Array(positions.count), snow = new Float32Array(positions.count), color = new THREE.Color(), tmp = new THREE.Color();
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i) + (cx + .5) * CHUNK_SIZE;
    const z = positions.getZ(i) + (cz + .5) * CHUNK_SIZE;
    const y = heightAt(x, z);
    positions.setXYZ(i, x, y, z);
    const band = terrainBand(y, x, z); color.set(BAND_COLOR[band]);
    if (groundColour && y > LEVEL.waterSurface) { const c = column(x, z), s = surfaceColor(c); color.lerp(tmp.setRGB(s[0], s[1], s[2]), band === 'bedrock' ? .15 : .55); // top-layer composition (outcrop rock stays mostly bare)
      const top = c.layers[0]; snow[i] = top?.id === 'snow' ? Math.min(1, top.thickness / .05) : 0; wet[i] = c.layers.find(l => l.moisture !== undefined && l.id !== 'snow')?.moisture ?? 0; }
    colors.set([color.r, color.g, color.b], i * 3);
    if (i % ((segments + 1) * 2) === 0) yield;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3)); geometry.setAttribute('aWet', new THREE.BufferAttribute(wet, 1)); geometry.setAttribute('aSnow', new THREE.BufferAttribute(snow, 1));
  geometry.computeVertexNormals();
  return geometry;
}
export const terrainGeometry = (cx: number, cz: number) => finish(terrainJob(cx, cz));
