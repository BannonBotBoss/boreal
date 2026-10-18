import * as THREE from 'three';
import { CELL, column, surfaceColor, type Column } from '../core/ground';
import type { SoilKind } from '../core/stages/soils';
import { WAIT, finish } from '../core/interest';
import { CHUNK_SIZE, heightAt } from '../core/world';
import { STAGES } from '../core/stages/elevation';
import { ABOVE, BANDS, BAND_COLOR, STAGED_TOP, gridRel, groundColor, isStaged, terrainCore, type Sheet, type TerrainData, type TerrainRequest } from './terrainCore';
import { requestTerrain, terrainWorkers } from './terrainPool';
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
/** Chunk terrain as a sliced job (core/interest). With `worker`, heights/normals/positions/water sheet come from a terrain
 *  worker (render/terrainPool) and the job yields WAIT until they arrive; otherwise the same render/terrainCore generator runs
 *  here. Near chunks (`groundColour`) then take the layered-ground tint, snow and wetness per 2 m cell (core/ground column,
 *  main-thread state), one column per cell, time-sliced. Identical output either way. */
export function* chunkTerrainJob(cx: number, cz: number, segments = RENDER.terrainSegments, groundColour = true, waterSeg = 0,
  opts: { worker?: boolean; wanted?: () => boolean } = {}): Generator<unknown, { terrain: THREE.BufferGeometry; water: THREE.BufferGeometry | null }> {
  const req: TerrainRequest = { cx, cz, segments, waterSeg, stagesOn: STAGES.on, stagesSeed: STAGES.seed };
  let data: TerrainData | undefined;
  if (opts.worker && terrainWorkers()) { const h = requestTerrain(req, opts.wanted); while (!h.data && !h.failed) yield WAIT; data = h.data; }
  if (!data) data = yield* terrainCore(req);
  const n = data.band.length, wet = new Float32Array(n), snow = new Float32Array(n);
  if (groundColour) yield* groundTint(data, cx, cz, segments, wet, snow);
  return { terrain: sheetGeometry(data, { color: [data.color, 3], aWet: [wet, 1], aSnow: [snow, 1] }), water: data.water ? sheetGeometry(data.water, { aFlow: [data.water.flow, 3] }) : null };
}
/** Terrain mesh geometry only (inspector what-ifs, tests): main thread, synchronous when run with finish(). */
export function* terrainJob(cx: number, cz: number, segments = RENDER.terrainSegments, groundColour = true) {
  return (yield* chunkTerrainJob(cx, cz, segments, groundColour)).terrain;
}
function sheetGeometry(s: Sheet, extra: Record<string, [Float32Array, number]>) {
  const g = new THREE.BufferGeometry(); g.setIndex(new THREE.BufferAttribute(s.index, 1));
  g.setAttribute('position', new THREE.BufferAttribute(s.position, 3)); g.setAttribute('normal', new THREE.BufferAttribute(s.normal, 3)); g.setAttribute('uv', new THREE.BufferAttribute(s.uv, 2));
  for (const [k, [a, size]] of Object.entries(extra)) g.setAttribute(k, new THREE.BufferAttribute(a, size));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(s.sphere[0], s.sphere[1], s.sphere[2]), s.sphere[3]); // computed by terrainCore from the same float32 positions
  return g;
}
/** Layered-ground tint per vertex above the water plane: one core/ground column per 2 m cell (column() depends only on the
 *  cell), surfaceColor tint, snow and moisture. Yields when a slice passes ~2 ms (columnRaw is the expensive part). */
function* groundTint(data: TerrainData, cx: number, cz: number, segments: number, wet: Float32Array, snow: Float32Array) {
  const row = segments + 1, ox = (cx + .5) * CHUNK_SIZE, oz = (cz + .5) * CHUNK_SIZE, W = CHUNK_SIZE / CELL + 4, gx0 = Math.floor(cx * CHUNK_SIZE / CELL) - 1, gz0 = Math.floor(cz * CHUNK_SIZE / CELL) - 1;
  const cells: ({ col: Column; tint: number[] } | undefined)[] = new Array(W * W), color = new THREE.Color(), tmp = new THREE.Color(), col3 = data.color;
  let t0 = performance.now();
  for (let i = 0; i < data.band.length; i++) {
    const code = data.band[i]; if (!(code & ABOVE)) continue;
    const x = gridRel(i % row, segments) + ox, z = gridRel((i / row) | 0, segments) + oz, k = (Math.floor(x / CELL) - gx0) + (Math.floor(z / CELL) - gz0) * W;
    let cell = cells[k]; if (!cell) { const c = column(x, z); cell = cells[k] = { col: c, tint: surfaceColor(c) }; if (performance.now() - t0 > 2) { yield; t0 = performance.now(); } }
    const b = BANDS[code & 0x7f], s = cell.tint;
    if (isStaged(b)) groundColor(b as SoilKind, color, s); else color.set(BAND_COLOR[b]).lerp(tmp.setRGB(s[0], s[1], s[2]), .55); // top-layer composition (layered terrain)
    col3[i * 3] = color.r; col3[i * 3 + 1] = color.g; col3[i * 3 + 2] = color.b;
    const top = cell.col.layers[0]; snow[i] = top?.id === 'snow' ? Math.min(1, top.thickness / .05) : 0; wet[i] = cell.col.layers.find(l => l.moisture !== undefined && l.id !== 'snow')?.moisture ?? 0;
  }
}
export { BAND_COLOR, STAGED_TOP, groundColor };
export const terrainGeometry = (cx: number, cz: number) => finish(terrainJob(cx, cz));
