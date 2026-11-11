/**
 * One terrain surface from the camera to the geometric horizon.
 *
 * Chunked LOD with skirts (Ulrich 2002, "Rendering Massive Terrains using
 * Chunked Level of Detail"; the same crack fill Proland uses). This is not a
 * second mesh past the chunks. The leaf squares tile one root, every vertex
 * samples the caller's height function (the game passes heightAt), and a
 * dropped skirt on each edge hides the T-junction where a coarse neighbour
 * meets a fine one. Earth curvature is the gnomonic drop already used by the
 * horizon distance, so the outer edge meets the sky at eye level.
 */
import * as THREE from 'three';
import { heightAt, terrainBand } from '../core/world';
import { curvatureDrop, horizonMetres } from '../world/globe/horizonSkirt';
import { BAND_COLOR, groundColor, isStaged } from './terrainCore';
import { terrainMaterial } from './pbr';
import { addAerialPerspective } from './aerial';
import type { SoilKind } from '../core/stages/soils';

/** Quads along one leaf edge. 8 keeps a 16 m leaf at 2 m spacing. */
export const TERRAIN_GRID = 8;
/**
 * Split a node when the 3D distance to it is under size / this.
 * 0.72 keeps about one ring of leaves per octave (Ulrich's screen-space split,
 * with the eye height in the distance so a high camera does not refine the
 * whole disc).
 */
export const TERRAIN_SPLIT = 0.72;
/** Skirt drop as a fraction of the leaf size, and a floor so a fine edge still covers one coarse step. */
export const SKIRT_FRAC = 0.35;
export const SKIRT_FLOOR_M = 8;

export interface TerrainLeaf { x0: number; z0: number; size: number }

export interface ContinuousMesh {
  position: Float32Array;
  normal: Float32Array;
  color: Float32Array;
  uv: Float32Array;
  wet: Float32Array;
  snow: Float32Array;
  index: Uint32Array;
  triangles: number;
  leaves: number;
  /** Metres from the camera to the farthest vertex, before curvature. */
  outerM: number;
  root: TerrainLeaf;
}

function minLeaf(eyeM: number) {
  if (eyeM > 400) return 64;
  if (eyeM > 120) return 32;
  return 8;
}

function rootSize(eyeM: number) {
  const need = horizonMetres(Math.max(1, eyeM)) * 2 * 1.08;
  let size = 256;
  while (size < need && size < 1_048_576) size *= 2;
  return size;
}

/** 3D distance from the eye to the closest point of an axis-aligned square on the ground. */
function nodeDist(x0: number, z0: number, size: number, camX: number, camZ: number, eyeM: number) {
  const dx = Math.max(x0 - camX, 0, camX - (x0 + size));
  const dz = Math.max(z0 - camZ, 0, camZ - (z0 + size));
  return Math.hypot(dx, dz, Math.max(eyeM, 1));
}

/**
 * Leaves of one quadtree. They tile `root` exactly. A second pass splits any
 * leaf whose neighbour is more than twice as large, so a skirt only has to
 * hide a single LOD step (the restricted quadtree in Ulrich 2002).
 */
export function selectTerrainLeaves(camX: number, camZ: number, eyeM: number, split = TERRAIN_SPLIT): { leaves: TerrainLeaf[]; root: TerrainLeaf } {
  const eye = Math.max(1, eyeM);
  const size = rootSize(eye);
  const floor = minLeaf(eye);
  const root: TerrainLeaf = {
    x0: Math.round(camX / floor) * floor - size / 2,
    z0: Math.round(camZ / floor) * floor - size / 2,
    size,
  };
  const leaves: TerrainLeaf[] = [];
  const walk = (x0: number, z0: number, s: number) => {
    const dist = nodeDist(x0, z0, s, camX, camZ, eye);
    if (s > floor && dist < s / split) {
      const h = s / 2;
      walk(x0, z0, h); walk(x0 + h, z0, h); walk(x0, z0 + h, h); walk(x0 + h, z0 + h, h);
    } else leaves.push({ x0, z0, size: s });
  };
  walk(root.x0, root.z0, root.size);
  // Restricted quadtree. A map from the corner of every leaf, rebuilt when one splits.
  let guard = 0;
  while (guard++ < 24) {
    const cover = (x: number, z: number) => {
      for (const leaf of leaves) if (x >= leaf.x0 && z >= leaf.z0 && x < leaf.x0 + leaf.size && z < leaf.z0 + leaf.size) return leaf;
      return undefined;
    };
    const splitThese = new Set<TerrainLeaf>();
    for (const leaf of leaves) {
      const mid = [
        [leaf.x0 + leaf.size / 2, leaf.z0 - leaf.size * 0.25],
        [leaf.x0 + leaf.size / 2, leaf.z0 + leaf.size + leaf.size * 0.25],
        [leaf.x0 - leaf.size * 0.25, leaf.z0 + leaf.size / 2],
        [leaf.x0 + leaf.size + leaf.size * 0.25, leaf.z0 + leaf.size / 2],
      ];
      for (const [x, z] of mid) {
        const n = cover(x, z);
        if (n && n.size > leaf.size * 2 + 0.01) splitThese.add(n);
      }
    }
    if (!splitThese.size) break;
    for (let i = leaves.length - 1; i >= 0; i--) if (splitThese.has(leaves[i])) {
      const n = leaves[i], h = n.size / 2;
      leaves.splice(i, 1, { x0: n.x0, z0: n.z0, size: h }, { x0: n.x0 + h, z0: n.z0, size: h }, { x0: n.x0, z0: n.z0 + h, size: h }, { x0: n.x0 + h, z0: n.z0 + h, size: h });
    }
  }
  return { leaves, root };
}

function paint(x: number, z: number, y: number, target: THREE.Color) {
  const band = terrainBand(y, x, z);
  if (isStaged(band)) groundColor(band as SoilKind, target);
  else target.set(BAND_COLOR[band]);
  return target;
}

/**
 * One indexed mesh. `height(x, z)` is the ground the near chunks already use.
 * Curvature is subtracted from the drawn height only, around (camX, camZ).
 */
export function buildContinuousMesh(
  camX: number, camZ: number, eyeM: number,
  height: (x: number, z: number) => number,
  split = TERRAIN_SPLIT,
): ContinuousMesh {
  const { leaves, root } = selectTerrainLeaves(camX, camZ, eyeM, split);
  const seg = TERRAIN_GRID, row = seg + 1;
  const skirtVerts = 4 * row;
  const per = row * row + skirtVerts;
  const n = leaves.length * per;
  const position = new Float32Array(n * 3);
  const normal = new Float32Array(n * 3);
  const color = new Float32Array(n * 3);
  const uv = new Float32Array(n * 2);
  const wet = new Float32Array(n);
  const snow = new Float32Array(n);
  const idx: number[] = [];
  const tint = new THREE.Color();
  let outer = 0;
  leaves.forEach((leaf, li) => {
    const base = li * per;
    const step = leaf.size / seg;
    const skirt = Math.max(SKIRT_FLOOR_M, leaf.size * SKIRT_FRAC);
    // One height sample per grid point, plus a one-cell border for the normals.
    // The old central-difference sampled heightAt five times a vertex.
    const g = seg + 3, heights = new Float32Array(g * g);
    for (let iz = 0; iz < g; iz++) for (let ix = 0; ix < g; ix++) {
      heights[iz * g + ix] = height(leaf.x0 + (ix - 1) * step, leaf.z0 + (iz - 1) * step);
    }
    const hAt = (ix: number, iz: number) => heights[(iz + 1) * g + (ix + 1)];
    for (let iz = 0; iz < row; iz++) for (let ix = 0; ix < row; ix++) {
      const i = base + iz * row + ix;
      const x = leaf.x0 + ix * step, z = leaf.z0 + iz * step;
      const raw = hAt(ix, iz);
      const r = Math.hypot(x - camX, z - camZ);
      if (r > outer) outer = r;
      position[i * 3] = x; position[i * 3 + 1] = raw - curvatureDrop(r); position[i * 3 + 2] = z;
      const gx = (hAt(ix + 1, iz) - hAt(ix - 1, iz)) / (2 * step);
      const gz = (hAt(ix, iz + 1) - hAt(ix, iz - 1)) / (2 * step);
      const len = Math.hypot(gx, 1, gz) || 1;
      normal[i * 3] = -gx / len; normal[i * 3 + 1] = 1 / len; normal[i * 3 + 2] = -gz / len;
      paint(x, z, raw, tint);
      color[i * 3] = tint.r; color[i * 3 + 1] = tint.g; color[i * 3 + 2] = tint.b;
      uv[i * 2] = ix / seg; uv[i * 2 + 1] = iz / seg;
    }
    for (let iz = 0; iz < seg; iz++) for (let ix = 0; ix < seg; ix++) {
      const a = base + ix + row * iz, b = a + row, c = b + 1, d = a + 1;
      idx.push(a, b, d, b, c, d);
    }
    // Four skirts. Edge order: south, north, west, east. The dropped copy sits
    // just under the surface edge so a coarser neighbour cannot open a gap.
    const edges: [number, number, number, number][] = [
      [0, 1, 0, 0],
      [seg * row, 1, 0, 0],
      [0, row, 0, 0],
      [seg, row, 0, 0],
    ];
    edges.forEach((edge, e) => {
      const skirtBase = base + row * row + e * row;
      for (let k = 0; k < row; k++) {
        const src = base + edge[0] + k * edge[1];
        const i = skirtBase + k;
        position[i * 3] = position[src * 3];
        position[i * 3 + 1] = position[src * 3 + 1] - skirt;
        position[i * 3 + 2] = position[src * 3 + 2];
        normal[i * 3] = normal[src * 3]; normal[i * 3 + 1] = normal[src * 3 + 1]; normal[i * 3 + 2] = normal[src * 3 + 2];
        color[i * 3] = color[src * 3]; color[i * 3 + 1] = color[src * 3 + 1]; color[i * 3 + 2] = color[src * 3 + 2];
        uv[i * 2] = uv[src * 2]; uv[i * 2 + 1] = uv[src * 2 + 1];
        if (k < seg) {
          const a = src, b = src + edge[1], c = skirtBase + k, d = c + 1;
          idx.push(a, c, b, b, c, d);
        }
      }
    });
  });
  return {
    position, normal, color, uv, wet, snow, index: new Uint32Array(idx),
    triangles: idx.length / 3, leaves: leaves.length, outerM: outer, root,
  };
}

export interface ContinuousTerrain {
  mesh: THREE.Mesh;
  /** Rebuild when the camera crosses a snap cell. Returns true when the geometry changed. */
  update(camX: number, camZ: number, eyeM: number): boolean;
  dispose(): void;
}

let sharedMat: THREE.MeshStandardMaterial | undefined;
/** Smooth-shaded copy of the chunk terrain material. The shared chunk material stays flat. */
export function continuousMaterial() {
  if (sharedMat) return sharedMat;
  const mat = terrainMaterial().clone() as THREE.MeshStandardMaterial;
  mat.flatShading = false;
  mat.fog = false;
  mat.polygonOffset = true;
  mat.polygonOffsetFactor = 2;
  mat.polygonOffsetUnits = 2;
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = function (shader, renderer) {
    prev.call(this, shader, renderer);
    addAerialPerspective(shader);
  };
  mat.customProgramCacheKey = () => 'boreal-continuous-terrain-aerial';
  sharedMat = mat;
  return mat;
}

/** The mesh the ground view draws instead of the chunk plates and the far skirt. */
export function createContinuousTerrain(): ContinuousTerrain {
  const geometry = new THREE.BufferGeometry();
  const mesh = new THREE.Mesh(geometry, continuousMaterial());
  mesh.name = 'continuous-terrain';
  mesh.frustumCulled = false;
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  let key = '';
  let geo = geometry;
  const pub = { leaves: 0, outerM: 0, triangles: 0 };
  (globalThis as { __terrain?: typeof pub }).__terrain = pub;
  function update(camX: number, camZ: number, eyeM: number) {
    const eye = Math.max(1, eyeM);
    const snap = Math.max(24, minLeaf(eye));
    const next = `${Math.round(camX / snap)}:${Math.round(camZ / snap)}:${Math.round(Math.log2(eye) * 4)}`;
    if (next === key && geo.getAttribute('position')) return false;
    key = next;
    const data = buildContinuousMesh(camX, camZ, eye, heightAt);
    geo.dispose();
    geo = new THREE.BufferGeometry();
    mesh.geometry = geo;
    geo.setAttribute('position', new THREE.BufferAttribute(data.position, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(data.normal, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(data.color, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(data.uv, 2));
    geo.setAttribute('aWet', new THREE.BufferAttribute(data.wet, 1));
    geo.setAttribute('aSnow', new THREE.BufferAttribute(data.snow, 1));
    geo.setIndex(new THREE.BufferAttribute(data.index, 1));
    geo.computeBoundingSphere();
    mesh.userData.triangles = pub.triangles = data.triangles;
    mesh.userData.leaves = pub.leaves = data.leaves;
    mesh.userData.outerM = pub.outerM = data.outerM;
    return true;
  }
  return { mesh, update, dispose() { geo.dispose(); } };
}
