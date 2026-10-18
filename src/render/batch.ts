/**
 * Per-chunk batching (Grok Bot). Adopted: three r180 BatchedMesh (MIT): many different geometries, ONE draw call per
 * material via WEBGL_multi_draw, per-instance frustum culling. Every static entity contributes its 3 LOD geometries;
 * LOD is chosen per instance by swapping the geometry id (setGeometryIdAt), so trees + props of a chunk cost one draw
 * per material per pass (main + each shadow cascade) instead of one per object part.
 * Props built with per-part materials are flattened into vertex colours on ONE shared material.
 */
import * as THREE from 'three';
import { GLSL_NOISE } from '../proc/glsl';
import { finish } from '../core/interest';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const PROP_MATERIAL = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95, flatShading: true }); PROP_MATERIAL.userData.shared = true;
/** Rocks: the old 16×16 striped texture can't ride in a batch (one map per material), so the same look is procedural:
 *  horizontal banding (as the old texture's rows) + fBm grain + lichen-free speckle from world position (proc/glsl). */
export const ROCK_MATERIAL = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true, side: THREE.DoubleSide }); ROCK_MATERIAL.userData.shared = true;
ROCK_MATERIAL.onBeforeCompile = shader => {
  shader.vertexShader = 'varying vec3 vRockW;\n' + shader.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n  vec4 rw = vec4(transformed, 1.);\n  #ifdef USE_BATCHING\n    rw = batchingMatrix * rw;\n  #endif\n  vRockW = (modelMatrix * rw).xyz;');
  shader.fragmentShader = `varying vec3 vRockW;\n${GLSL_NOISE}\n` + shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
    float band = .9 + .1 * fract(vRockW.y * 2.3 + vnoise(vRockW.xz * 3., 7.) * .6); // old texture: brighter rows upward + jitter
    float grain = .82 + .3 * fbm(vRockW.xz * 4. + vRockW.y * 2., 3.);
    diffuseColor.rgb *= band * grain;`);
};
type Item = { key: string; pos: THREE.Vector3; levels: Map<THREE.Material, THREE.BufferGeometry>[]; ranges: number[]; shadowFar: number };

/** Flatten one LOD level (a Group of meshes) into one geometry per material (props → PROP_MATERIAL with baked colour). */
function flatten(root: THREE.Object3D) {
  // The root's own rotation/scale (per-entity yaw, size jitter, rock seating) are baked in; its position is the instance's.
  root.position.set(0, 0, 0); root.updateMatrixWorld(true); const parts = new Map<THREE.Material, THREE.BufferGeometry[]>();
  root.traverse(o => {
    const m = o as THREE.Mesh; if (!m.isMesh || Array.isArray(m.material)) return;
    const shared = !!m.userData.shared || m.material === PROP_MATERIAL, mat = shared ? m.material as THREE.Material : m.userData.rock ? ROCK_MATERIAL : PROP_MATERIAL;
    let g = m.geometry.clone().applyMatrix4(m.matrixWorld);
    if (!shared) { // keep position/normal + colour from the part's material, so every prop part merges into one buffer
      g = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
      const c = (m.material as THREE.MeshStandardMaterial).color ?? new THREE.Color(1, 1, 1), n = g.getAttribute('position').count, a = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    }
    if (!m.userData.shared) { m.geometry.dispose(); if (!shared) (m.material as THREE.Material).dispose(); } // source parts are throwaway
    if (!g.index) g.setIndex([...Array(g.getAttribute('position').count).keys()]);
    (parts.get(mat) ?? parts.set(mat, []).get(mat)!).push(g);
  });
  return new Map([...parts].map(([m, gs]) => [m, gs.length === 1 ? gs[0] : mergeGeometries(gs)!] as const));
}

export function createChunkBatch() {
  const items: Item[] = [], meshes: THREE.BatchedMesh[] = [];
  /** instance bookkeeping per material: item index → instance id + its LOD geometry ids */
  const slots = new Map<THREE.BatchedMesh, { item: number; inst: number; geo: number[] }[]>();
  let level: number[] = [];
  return {
    meshes,
    add(key: string, pos: THREE.Vector3, levels: THREE.Object3D[], ranges: number[]) { items.push({ key, pos: pos.clone(), levels: levels.map(flatten), ranges, shadowFar: ranges[1] }); },
    /** Build one BatchedMesh per material; returns them for the chunk root. */
    build() { return finish(this.buildJob()); },
    /** build() as a budgeted job (core/interest): yields per material and every few instances. */
    *buildJob(): Generator<unknown, THREE.BatchedMesh[]> {
      const mats = new Set<THREE.Material>(); for (const it of items) for (const l of it.levels) for (const m of l.keys()) mats.add(m);
      for (const mat of mats) {
        let v = 0, ix = 0, n = 0;
        for (const it of items) { let has = false; for (const l of it.levels) { const g = l.get(mat); if (g) { v += g.getAttribute('position').count; ix += g.index!.count; has = true; } } if (has) n++; }
        if (!n) continue;
        const bm = new THREE.BatchedMesh(n, Math.max(1, v), Math.max(1, ix), mat), list: { item: number; inst: number; geo: number[] }[] = [];
        bm.castShadow = bm.receiveShadow = true; bm.userData.keys = [] as string[]; bm.userData.shadowSet = true;
        for (let i = 0; i < items.length; i++) { const it = items[i];
          const geo = it.levels.map(l => { const g = l.get(mat); return g ? bm.addGeometry(g) : -1; });
          const first = geo.find(x => x >= 0); if (first === undefined) continue;
          const inst = bm.addInstance(first); bm.setMatrixAt(inst, new THREE.Matrix4().makeTranslation(it.pos)); (bm.userData.keys as string[])[inst] = it.key;
          list.push({ item: i, inst, geo }); if (i % 16 === 15) yield;
        } yield;
        for (const it of items) for (const l of it.levels) l.get(mat)?.dispose(); // copied into the batch
        slots.set(bm, list); meshes.push(bm); yield;
      }
      level = items.map(() => -2);
      return meshes;
    },
    /** Pick each instance's LOD from the camera distance (cheap: one pass over a few hundred items, ~4×/s). */
    update(cam: THREE.Vector3, scale: number) {
      const next = items.map((it, i) => { const d = it.pos.distanceTo(cam); let l = -1; for (let k = 0; k < it.ranges.length; k++) if (d >= it.ranges[k] * scale) l = k; return level[i] === -3 ? -3 : l >= it.levels.length ? -1 : l; });
      for (const [bm, list] of slots) for (const s of list) {
        const l = next[s.item]; if (l === level[s.item]) continue;
        const g = l >= 0 ? s.geo[l] : -1; bm.setVisibleAt(s.inst, g >= 0); if (g >= 0) bm.setGeometryIdAt(s.inst, g);
      }
      level = next;
    },
    hide(key: string) { const i = items.findIndex(x => x.key === key); if (i < 0) return; level[i] = -3; for (const [bm, list] of slots) for (const s of list) if (s.item === i) bm.setVisibleAt(s.inst, false); },
    dispose() { for (const m of meshes) m.dispose(); },
  };
}
export type ChunkBatch = ReturnType<typeof createChunkBatch>;
