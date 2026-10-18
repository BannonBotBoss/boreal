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
/** Staged materials as ALBEDO (sRGB-encoded hex; three decodes to linear). Sentinel-2 L2A (30 Jul 2024, Kenora window) median per
 *  ESA WorldCover 2021 class, converted from TCI to surface reflectance (Sen2Cor TCI is linear and saturates at 25 % reflectance:
 *  refl = TCI / 255 * 0.25; Sen2Cor team, ESA STEP forum) and then sRGB-encoded:
 *  - bedrock = 'bare' 0.136 / 0.125 / 0.110 -> #67635d
 *  - till = 'grassland' (open ground, moss/litter) 0.041 / 0.065 / 0.040 -> #394838
 *  - peat = 'herbaceous wetland' 0.039 / 0.052 / 0.039 -> #384038
 *  - sand / clay: no WorldCover class; the old tints scaled by the bedrock / till ratios [game estimate, verify].
 *  The old values used the TCI byte directly as sRGB colour, about 2.5x too bright in linear terms; that was a large part of the
 *  pale mint ground. The legacy bands (water/shore/upland/forest) are unchanged. */
const BAND_COLOR = { water: 0x929771, shore: 0x929771, upland: 0x8d9582, forest: 0x788e60, bedrock: 0x67635d, till: 0x394838, sand: 0x746d4e, clay: 0x3c4639, peat: 0x384038 };
/** Terrain mesh for a chunk, as a sliced job (yields every few rows) so building is spread over frames (core/interest).
 * `segments`/`groundColour` come from the interest tier: mid-tier chunks are coarse and skip the layered-ground colour. */
export function* terrainJob(cx: number, cz: number, segments = RENDER.terrainSegments, groundColour = true) {
  const geometry = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, segments, segments);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.attributes.position, colors = new Float32Array(positions.count * 3), wet = new Float32Array(positions.count), snow = new Float32Array(positions.count), color = new THREE.Color(), tmp = new THREE.Color();
  const row = segments + 1, slice = Math.max(16, row >> 2); // yield every quarter row: one slice stays ~1 ms of heightAt/soil/ground work
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i) + (cx + .5) * CHUNK_SIZE;
    const z = positions.getZ(i) + (cz + .5) * CHUNK_SIZE;
    const y = heightAt(x, z);
    positions.setXYZ(i, x, y, z);
    const band = terrainBand(y, x, z), staged = band === 'bedrock' || band === 'till' || band === 'sand' || band === 'clay' || band === 'peat'; color.set(BAND_COLOR[band]);
    if (staged) { // measured albedo (BAND_COLOR) plus a light tint from the top layer; the art tints in core/ground are read as sRGB
      const s = groundColour && y > LEVEL.waterSurface ? surfaceColor(column(x, z)) : STAGED_TOP; // mid tier: the mean tint, so near and mid chunks match
      color.lerp(tmp.setRGB(s[0], s[1], s[2], THREE.SRGBColorSpace), band === 'bedrock' ? .1 : .2); }
    if (groundColour && y > LEVEL.waterSurface) { const c = column(x, z); if (!staged) { const s = surfaceColor(c); color.lerp(tmp.setRGB(s[0], s[1], s[2]), .55); } // top-layer composition (layered terrain)
      const top = c.layers[0]; snow[i] = top?.id === 'snow' ? Math.min(1, top.thickness / .05) : 0; wet[i] = c.layers.find(l => l.moisture !== undefined && l.id !== 'snow')?.moisture ?? 0; }
    colors.set([color.r, color.g, color.b], i * 3);
    if (i % slice === slice - 1) yield;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3)); geometry.setAttribute('aWet', new THREE.BufferAttribute(wet, 1)); geometry.setAttribute('aSnow', new THREE.BufferAttribute(snow, 1));
  // Normals by central differences on the height grid, sliced per row (computeVertexNormals ran in one go, ~6 ms per near chunk).
  // Border vertices sample heightAt one step outside the chunk, so neighbouring chunks get identical border normals (no seams).
  const d = CHUNK_SIZE / segments, nrm = new Float32Array(positions.count * 3), h = (ix: number, iz: number, x: number, z: number) =>
    ix < 0 || ix > segments || iz < 0 || iz > segments ? heightAt(x, z) : positions.getY(iz * row + ix);
  for (let iz = 0; iz <= segments; iz++) {
    for (let ix = 0; ix <= segments; ix++) {
      const i = iz * row + ix, x = positions.getX(i), z = positions.getZ(i);
      const gx = (h(ix + 1, iz, x + d, z) - h(ix - 1, iz, x - d, z)) / (2 * d), gz = (h(ix, iz + 1, x, z + d) - h(ix, iz - 1, x, z - d)) / (2 * d), l = Math.hypot(gx, 1, gz);
      nrm[i * 3] = -gx / l; nrm[i * 3 + 1] = 1 / l; nrm[i * 3 + 2] = -gz / l; }
    if (iz % 4 === 3) yield; }
  geometry.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  return geometry;
}
/** Mean top-layer tint (moss + fresh litter, core/ground SURFACE) for chunks that skip the per-vertex ground column. */
const STAGED_TOP = [.39, .41, .22];
export const terrainGeometry = (cx: number, cz: number) => finish(terrainJob(cx, cz));
