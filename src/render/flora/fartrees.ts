/**
 * Far stand filler (Grok Bot): tops the drawn tree density up toward the stand model (core/flora/stands) beyond the near
 * ring, where trees are only seen, never touched. Look-only trees with NO entities: the trees' own far-LOD geometry
 * (render/trees treeGeometry detail 2, shared per species/variant/age class/snag) instanced in ONE BatchedMesh with the
 * shared tree material (wind + phenology). One draw call, no shadow pass. Placement = Thomas clusters per 32 m tile
 * (pure function of seed and tile), so trees never move; refills are incremental sliced interest jobs (tiles leaving the
 * ring are freed, entering tiles are placed). Budget: count scales with the governor tree factor (RENDER.treeDensity), the
 * ring with LADDER lod / mid, hard cap FAR_TREES.maxInstances.
 */
import * as THREE from 'three';
import { CHUNK_SIZE, GENERATOR_VERSION, WORLD_SEED, heightAt, type Entity } from '../../core/world';
import { LEVEL } from '../../core/tuning';
import { RENDER } from '../../core/renderSettings';
import { INTEREST, enqueue, pending } from '../../core/interest';
import { standAt } from '../../core/stand';
import { FAR_TREES, farTreesInTile, sightDepth } from '../../core/flora/stands';
import { hash, random } from '../../proc/rng';
import { WIND_UNIFORMS, ageClass, treeGeometry, treeSpecies } from '../trees';
import { bindWind, placeTree, removeTree, updateTrees, v2Handles } from '../trees/game';
import { fadeOptIn } from '../fade';

export const FAR_TREE_FX = { off: typeof location !== 'undefined' && new URLSearchParams(location.search).get('fartrees') === '0' }; // ?fartrees=0: bench A/B
export const FAR_TREE_INFO = { instances: 0, geometries: 0, tiles: 0, refills: 0, sliceMaxMs: 0, inner: 0, outer: 0, triangles: 0 };
(globalThis as { borealFarTrees?: unknown }).borealFarTrees = { info: FAR_TREE_INFO, fx: FAR_TREE_FX }; // dev/bench handle

export function createFarTrees(scene: THREE.Scene) {
  let bm: THREE.BatchedMesh | undefined;
  const v2keys = new Map<string, string[]>(); // trees v2 (render/trees/game): far black spruce as ragged crowns, per tile
  const tiles = new Map<string, number[]>(), geoIds = new Map<THREE.BufferGeometry, number>(), tris = new Map<number, number>(), stands = new Map<string, number>();
  let lx: number | undefined, lz = 0, lDensity = -1, lInner = 0, lOuter = 0;
  const mat4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), pos = new THREE.Vector3();
  /** Stand stems/ha per 40 m chunk centre (the same sample core/population uses). */
  const stemsAt = (x: number, z: number) => {
    const cx = Math.floor(x / CHUNK_SIZE), cz = Math.floor(z / CHUNK_SIZE), k = `${cx},${cz}`; let s = stands.get(k);
    if (s === undefined) { if (stands.size > 4096) stands.clear(); stands.set(k, s = RENDER.standMap ? standAt((cx + .5) * CHUNK_SIZE, (cz + .5) * CHUNK_SIZE).stems : 1500); }
    return s;
  };
  const dry = (x: number, z: number) => heightAt(x, z) < LEVEL.shore ? 0 : 1;
  function geometryId(g: THREE.BufferGeometry, mat: THREE.Material) {
    let id = geoIds.get(g); if (id !== undefined) return id;
    if (!bm) { bm = new THREE.BatchedMesh(FAR_TREES.maxInstances, 160000, 320000, fadeOptIn(mat)); /* the shared tree material (render/batch opts it in too; idempotent) */ bm.castShadow = false; bm.receiveShadow = true; bm.frustumCulled = false; bm.name = 'far-trees'; scene.add(bm); }
    const src = g.index ? g : g.clone().setIndex([...Array(g.getAttribute('position').count).keys()]);
    try { id = bm.addGeometry(src); tris.set(id, src.index!.count / 3); } catch { id = geoIds.values().next().value ?? -1; } // full: reuse a loaded shape
    if (src !== g) src.dispose(); geoIds.set(g, id); FAR_TREE_INFO.geometries = tris.size; return id;
  }
  function* refill(cx: number, cz: number, inner: number, outer: number, density: number, reset: boolean) {
    const T = FAR_TREES.tile, in2 = inner * inner, out2 = outer * outer;
    const d2 = (tx: number, tz: number) => { const dx = (tx + .5) * T - cx, dz = (tz + .5) * T - cz; return dx * dx + dz * dz; };
    for (const [k, insts] of tiles) {
      const [a, b] = k.split(',').map(Number), d = d2(a, b);
      if (reset || d < in2 || d > out2) { for (const i of insts) if (i >= 0) bm!.deleteInstance(i); tiles.delete(k); for (const key of v2keys.get(k) ?? []) removeTree(key); v2keys.delete(k); }
    }
    yield;
    const r = Math.ceil(outer / T), ox = Math.floor(cx / T), oz = Math.floor(cz / T);
    for (let tz = oz - r; tz <= oz + r; tz++) for (let tx = ox - r; tx <= ox + r; tx++) {
      const k = `${tx},${tz}`, d = d2(tx, tz); if (d < in2 || d > out2 || tiles.has(k)) continue;
      const insts: number[] = []; tiles.set(k, insts);
      for (const p of farTreesInTile(tx, tz, density, stemsAt, dry)) {
        if (bm && bm.instanceCount >= FAR_TREES.maxInstances) break;
        const rr = random(hash(`fartree-v2:${WORLD_SEED}:${Math.floor(p.r * 0xffffffff)}`));
        const e: Entity = { key: `fartree:${tx}:${tz}:${insts.length}`, kind: 'spruce', seed: Math.floor(rr() * 0xffffffff), generatorVersion: GENERATOR_VERSION, x: p.x, z: p.z, rotation: rr() * Math.PI * 2, scale: .75 + rr() * .65 };
        if (v2Handles(treeSpecies(e.seed, e.x, e.z))) { // trees v2: a crown instance in render/trees/game (built there in sliced jobs)
          bindWind(WIND_UNIFORMS); const s = random(e.seed)(); placeTree(e.key, e.x, heightAt(e.x, e.z), e.z, e.rotation, e.scale, e.scale * (.9 + s * .2), e.scale, e.seed, ageClass(e.x, e.z), true);
          (v2keys.get(k) ?? v2keys.set(k, []).get(k)!).push(e.key); insts.push(-1); continue;
        }
        const shapes = geoIds.size, g = treeGeometry(e, 2), m = g.children[0] as THREE.Mesh, id = geometryId(m.geometry, m.material as THREE.Material);
        if (id >= 0) { const inst = bm!.addInstance(id); pos.set(e.x, heightAt(e.x, e.z), e.z); q.setFromAxisAngle(up, g.rotation.y); bm!.setMatrixAt(inst, mat4.compose(pos, q, g.scale)); insts.push(inst); }
        if (geoIds.size !== shapes || insts.length % 32 === 31) yield; // a new shape (tree build + batch upload) is its own step; dense tiles split every 32 trees
      }
      yield;
    }
  }
  return (camera: THREE.Camera) => {
    updateTrees(scene, camera); // trees v2 LOD + pruning (no-op unless ?trees=v2)
    if (bm) bm.visible = !FAR_TREE_FX.off && RENDER.treeDensity > 0;
    const x = camera.position.x, z = camera.position.z, density = RENDER.treeDensity, inner = 55 * RENDER.lod.trees + 5, T = FAR_TREES.tile;
    // the forest is drawn as deep behind the last instantiated edge (INTEREST.mid) as a line of sight sees into it (core/flora/stands
    // sightDepth), no further than the fog hides; whole tiles, so the ring moves in tile steps (incremental refill, no reset)
    const fogFar = (scene.fog as THREE.Fog | null)?.far ?? Infinity, outer = Math.max(inner, Math.min(fogFar, Math.ceil((INTEREST.mid + sightDepth(stemsAt(x, z))) / T) * T));
    const reset = density !== lDensity || Math.abs(inner - lInner) > 1;
    if (pending('fartrees:refill') || (!reset && lx !== undefined && Math.hypot(x - lx, z - lz) < T / 2 && Math.abs(outer - lOuter) <= 1)) return;
    lx = x; lz = z; lDensity = density; lInner = inner; lOuter = outer; Object.assign(FAR_TREE_INFO, { inner, outer });
    const g = refill(x, z, inner, outer, density, reset);
    const timed = (function* () { // tiles are small: run several per slice up to the slice budget
      for (;;) { const t0 = performance.now(); let r; do r = g.next(); while (!r.done && performance.now() - t0 < FAR_TREES.sliceMs * .5);
        FAR_TREE_INFO.sliceMaxMs = Math.max(FAR_TREE_INFO.sliceMaxMs, performance.now() - t0); if (r.done) return; yield; }
    })();
    enqueue('fartrees:refill', 60, timed, () => {
      let n = 0, t = 0; for (const insts of tiles.values()) for (const i of insts) if (i >= 0) { n++; t += tris.get(bm!.getGeometryIdAt(i)) ?? 0; }
      Object.assign(FAR_TREE_INFO, { instances: n, tiles: tiles.size, triangles: t, refills: FAR_TREE_INFO.refills + 1 });
    });
  };
}
