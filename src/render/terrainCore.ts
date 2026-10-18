/**
 * Chunk terrain + water-sheet arrays from the pure world functions (core/world heightAt / terrainBand, core/stages lakeAt /
 * riverAt), with no scene access: render/terrainWorker runs it off the main thread, and render/math runs the same generator
 * on the main thread when workers are unavailable (tests, node, inspector what-ifs). Both produce identical bytes.
 *
 * Positions are written in world space directly. This replaces a PlaneGeometry + rotateX + translate, which ran applyMatrix4
 * over every vertex. The arithmetic matches that path bit for bit: the relative grid coordinate is rounded to float32 exactly
 * as PlaneGeometry stored it, then offset in double precision, so heightAt sees the same (x, z) as before.
 * The per-cell layered-ground tint (core/ground column: weather, deposits, game years) is NOT applied here; that state lives on
 * the main thread. render/math applies it per 2 m cell after the worker returns (`band` marks vertices above the water plane).
 */
import * as THREE from 'three';
import { CHUNK_SIZE, heightAt, terrainBand } from '../core/world';
import { LEVEL } from '../core/tuning';
import { STAGES, lakeAt } from '../core/stages/elevation';
import { riverAt } from '../core/stages/rivers';
import type { SoilKind } from '../core/stages/soils';

/** Staged materials as ALBEDO (sRGB-encoded hex; three decodes to linear). Sentinel-2 L2A (30 Jul 2024, Kenora window) median per
 *  ESA WorldCover 2021 class, converted from TCI to surface reflectance (Sen2Cor TCI is linear and saturates at 25 % reflectance:
 *  refl = TCI / 255 * 0.25; Sen2Cor team, ESA STEP forum) and then sRGB-encoded:
 *  - bedrock = 'bare' 0.136 / 0.125 / 0.110 -> #67635d
 *  - till = 'grassland' (open ground, moss/litter) 0.041 / 0.065 / 0.040 -> #394838
 *  - peat = 'herbaceous wetland' 0.039 / 0.052 / 0.039 -> #384038
 *  - sand / clay: no WorldCover class; the old tints scaled by the bedrock / till ratios [game estimate, verify].
 *  The old values used the TCI byte directly as sRGB colour, about 2.5x too bright in linear terms; that was a large part of the
 *  pale mint ground. The legacy bands (water/shore/upland/forest) are unchanged. */
export const BAND_COLOR = { water: 0x929771, shore: 0x929771, upland: 0x8d9582, forest: 0x788e60, bedrock: 0x67635d, till: 0x394838, sand: 0x746d4e, clay: 0x3c4639, peat: 0x384038 };
export type Band = keyof typeof BAND_COLOR;
/** Band codes in the `band` array (low 7 bits); bit 0x80 = vertex above the water plane (heightAt > LEVEL.waterSurface). */
export const BANDS = Object.keys(BAND_COLOR) as Band[];
export const ABOVE = 0x80;
export const isStaged = (b: Band) => b === 'bedrock' || b === 'till' || b === 'sand' || b === 'clay' || b === 'peat';
/** Mean top-layer tint (moss + fresh litter, core/ground SURFACE, sRGB) for chunks that skip the per-vertex ground column. */
export const STAGED_TOP: readonly number[] = [.39, .41, .22];
const tintTmp = new THREE.Color();
/** Ground colour of a staged soil class, exactly as the terrain mesh paints it: the Sentinel-2 albedo (BAND_COLOR, sRGB hex)
 *  lerped 20 % (bedrock 10 %) toward the top-layer tint. `top` is an sRGB [r, g, b] tint: core/ground surfaceColor(column(x, z))
 *  for the per-point colour, or the default STAGED_TOP (the mean tint the mid-tier chunks use). Returns linear RGB in three's
 *  working colour space, written into `target` (no allocation when one is passed). 'water' returns the shore/water band colour.
 *  For grass and flora: read soil with soilAt(STAGES.seed, x, z).kind and call this instead of copying constants. */
export function groundColor(soil: SoilKind, target = new THREE.Color(), top: readonly number[] = STAGED_TOP): THREE.Color {
  target.set(BAND_COLOR[soil]); if (soil === 'water') return target;
  return target.lerp(tintTmp.setRGB(top[0], top[1], top[2], THREE.SRGBColorSpace), soil === 'bedrock' ? .1 : .2);
}

export interface TerrainRequest { cx: number; cz: number; segments: number; /** water sheet segments, 0 = none (layered terrain) */ waterSeg: number; stagesOn: boolean; stagesSeed: number }
export interface Sheet { position: Float32Array; normal: Float32Array; uv: Float32Array; index: Uint16Array | Uint32Array; sphere: Float64Array }
export interface TerrainData extends Sheet {
  /** linear RGB with no per-cell ground tint (staged bands carry STAGED_TOP; final for mid-tier chunks) */ color: Float32Array;
  band: Uint8Array;
  water: (Sheet & { flow: Float32Array }) | null;
}
/** Relative grid coordinate of column/row k as PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, seg, seg).rotateX(-PI/2) stores it (float32). */
export const gridRel = (k: number, seg: number) => Math.fround(k * (CHUNK_SIZE / seg) - CHUNK_SIZE / 2);

/** Index + uv of a PlaneGeometry grid (same order and winding). */
function planeIndexUv(seg: number) {
  const row = seg + 1, n = row * row, uv = new Float32Array(n * 2), idx: number[] = [];
  for (let iy = 0; iy < row; iy++) for (let ix = 0; ix < row; ix++) { const i = iy * row + ix; uv[i * 2] = ix / seg; uv[i * 2 + 1] = 1 - iy / seg; }
  for (let iy = 0; iy < seg; iy++) for (let ix = 0; ix < seg; ix++) {
    const a = ix + row * iy, b = ix + row * (iy + 1), c = ix + 1 + row * (iy + 1), d = ix + 1 + row * iy; idx.push(a, b, d, b, c, d); }
  return { uv, index: n > 65535 ? new Uint32Array(idx) : new Uint16Array(idx) };
}
const sphereOf = (position: Float32Array) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(position, 3)); g.computeBoundingSphere(); const s = g.boundingSphere!; return Float64Array.of(s.center.x, s.center.y, s.center.z, s.radius); };

/** The chunk's arrays as a generator (yields every quarter row; the worker runs it straight through). */
export function* terrainCore(r: TerrainRequest): Generator<void, TerrainData> {
  STAGES.on = r.stagesOn; STAGES.seed = r.stagesSeed;
  const { cx, cz, segments } = r, row = segments + 1, n = row * row, ox = (cx + .5) * CHUNK_SIZE, oz = (cz + .5) * CHUNK_SIZE;
  const position = new Float32Array(n * 3), color = new Float32Array(n * 3), band = new Uint8Array(n), c = new THREE.Color(), slice = Math.max(16, row >> 2);
  for (let i = 0; i < n; i++) {
    const x = gridRel(i % row, segments) + ox, z = gridRel((i / row) | 0, segments) + oz, y = heightAt(x, z);
    position[i * 3] = x; position[i * 3 + 1] = y; position[i * 3 + 2] = z;
    const b = terrainBand(y, x, z); if (isStaged(b)) groundColor(b as SoilKind, c); else c.set(BAND_COLOR[b]);
    color[i * 3] = c.r; color[i * 3 + 1] = c.g; color[i * 3 + 2] = c.b; band[i] = BANDS.indexOf(b) | (y > LEVEL.waterSurface ? ABOVE : 0);
    if (i % slice === slice - 1) yield;
  }
  // Normals by central differences on the height grid; border vertices sample heightAt one step outside the chunk, so
  // neighbouring chunks get identical border normals (no seams).
  const d = CHUNK_SIZE / segments, normal = new Float32Array(n * 3), h = (ix: number, iz: number, x: number, z: number) =>
    ix < 0 || ix > segments || iz < 0 || iz > segments ? heightAt(x, z) : position[(iz * row + ix) * 3 + 1];
  for (let iz = 0; iz <= segments; iz++) {
    for (let ix = 0; ix <= segments; ix++) {
      const i = iz * row + ix, x = position[i * 3], z = position[i * 3 + 2];
      const gx = (h(ix + 1, iz, x + d, z) - h(ix - 1, iz, x - d, z)) / (2 * d), gz = (h(ix, iz + 1, x, z + d) - h(ix, iz - 1, x, z - d)) / (2 * d), l = Math.hypot(gx, 1, gz);
      normal[i * 3] = -gx / l; normal[i * 3 + 1] = 1 / l; normal[i * 3 + 2] = -gz / l; }
    if (iz % 4 === 3) yield; }
  const { uv, index } = planeIndexUv(segments);
  let water: TerrainData['water'] = null;
  if (r.waterSeg > 0) { // stages 2b/2c: one sheet at the lake level / river surface (per-vertex flow for the water shader), sunk below ground elsewhere
    const seg = r.waterSeg, wr = seg + 1, wn = wr * wr, wp = new Float32Array(wn * 3), flow = new Float32Array(wn * 3); let any = false;
    for (let i = 0; i < wn; i++) {
      const xr = gridRel(i % wr, seg), zr = gridRel((i / wr) | 0, seg), wx = xr + ox, wz = zr + oz, lk = lakeAt(STAGES.seed, wx, wz), rv = lk ? undefined : riverAt(STAGES.seed, wx, wz), inR = !!rv && rv.d < rv.half + rv.bank;
      if (lk || inR) any = true; if (inR) { flow[i * 3] = rv!.dirX * rv!.speed; flow[i * 3 + 1] = rv!.dirZ * rv!.speed; flow[i * 3 + 2] = rv!.speed; }
      // the old path stored the relative position (float32), set y, then translated: x' = fround(xr + ox)
      wp[i * 3] = xr + ox; wp[i * 3 + 1] = Math.fround(lk ? lk.surface : inR ? rv!.surface : heightAt(wx, wz) - .6); wp[i * 3 + 2] = zr + oz;
      if (i % wr === seg) yield;
    }
    if (any) {
      const w = planeIndexUv(seg), g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(wp, 3)); g.setIndex(new THREE.BufferAttribute(w.index, 1)); g.computeVertexNormals();
      water = { position: wp, normal: g.getAttribute('normal').array as Float32Array, uv: w.uv, index: w.index, flow, sphere: sphereOf(wp) };
    }
  }
  return { position, normal, uv, index, color, band, sphere: sphereOf(position), water };
}
/** Transferable buffers of a result (worker -> main, zero-copy). */
export const transferables = (t: TerrainData): Transferable[] => [t.position, t.normal, t.uv, t.index, t.color, t.band, t.sphere,
  ...(t.water ? [t.water.position, t.water.normal, t.water.uv, t.water.index, t.water.flow, t.water.sphere] : [])].map(a => a.buffer);
