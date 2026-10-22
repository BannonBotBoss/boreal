/**
 * Trees v2 in the game (Grok Bot, trees M2), behind ?trees=v2. Black spruce entities (core/stand species via render/trees
 * treeSpecies) and the far stand filler's black spruce (render/flora/fartrees) are drawn from render/trees/conifer instead of
 * the stylised cone stacks:
 *  - near  (< TREES_V2.nearM x the tree LOD scale): the Weber-Penn tree, bark tubes + needle cards, <= ~15k triangles;
 *  - mid   (out to the far-filler ring, 55 m x LOD + 5): thinned tubes + one spray card per limb;
 *  - crown (beyond, and every far-filler tree): the <=38-triangle scraggly spire (uneven tiers, gaps, lean, clumped club), per-instance palette + fake vertical AO.
 * Shared geometry per (age class, variant) in THREE BatchedMeshes: bark, needles, crowns (one draw call each per pass; LOD by
 * swapping an instance's geometry id). Variant builds are sliced jobs (core/interest, 'trees2'); the chunk batch gets an
 * empty level for these entities (render/trees hook), so nothing is drawn twice. Wind: the game's shared wind uniforms.
 */
import * as THREE from 'three';
import { BUILD_PHASE, buildConiferSteps, barkMaterial, crownMaterial, foliageMaterial, CONIFER_WIND, type ConiferLods } from './conifer';
import { INTEREST, enqueue } from '../../core/interest';
import { RENDER } from '../../core/renderSettings';
import { fadeOptIn } from '../fade';

export const TREES_V2 = { on: typeof location !== 'undefined' && new URLSearchParams(location.search).get('trees') === 'v2', nearM: 28, species: new Set(['black-spruce']) };
export const TREES_V2_INFO = { stepMaxMs: 0, trees: 0, far: 0, near: 0, mid: 0, crown: 0, variants: 0, buildMs: [] as number[], slow: [] as (number | string)[][], tris: {} as Record<string, number>, full: 0 };
(globalThis as { borealTreesV2?: unknown }).borealTreesV2 = { fx: TREES_V2, info: TREES_V2_INFO, list: () => [...trees.values()].filter(t => !t.far).map(t => [Math.round(t.m.elements[12]), Math.round(t.m.elements[14]), t.lod]) }; // dev/bench handle
/** Representative age (yr) per render/trees age class (stand age since fire < 40, < 100, < 190, older). */
const CLASS_AGE = [25, 70, 130, 220], VARIANTS = 4;
interface Variant { lods: ConiferLods; ids: { nb: number; mb: number; nl: number; ml: number; cr: number } }
interface Tree { m: THREE.Matrix4; vk: number; far: boolean; lod: number; bark: number; leaf: number; crown: number }
const variants = new Map<number, Variant>(), building = new Set<number>(), trees = new Map<string, Tree>();
let scene: THREE.Scene | undefined, bark: THREE.BatchedMesh | undefined, leaf: THREE.BatchedMesh | undefined, crown: THREE.BatchedMesh | undefined, bound = false;
let lx = Infinity, lz = Infinity, lt = 0, prune = 0;

/** Is this species drawn by v2? */
export const v2Handles = (species: string) => TREES_V2.on && TREES_V2.species.has(species);
/** Bind the game's wind (render/trees WIND_UNIFORMS, same objects) before the first program compiles. */
export function bindWind(u: { uWind: { value: number }; uWindDir: { value: THREE.Vector2 }; uWindAmp: { value: number } }) { if (!bound) { Object.assign(CONIFER_WIND, { uWind: u.uWind, uWindDir: u.uWindDir, uWindAmp: u.uWindAmp }); bound = true; } }

function meshes() {
  if (bark || !scene) return;
  const mk = (mat: THREE.Material, n: number, v: number, i: number, shadow: boolean, name: string) => {
    const b = new THREE.BatchedMesh(n, v, i, fadeOptIn(mat, true)); b.castShadow = shadow; b.receiveShadow = true; b.name = name; b.frustumCulled = false; b.perObjectFrustumCulled = true; scene!.add(b); return b; };
  bark = mk(barkMaterial(), 6000, 260000, 600000, true, 'trees2-bark'); leaf = mk(foliageMaterial(), 6000, 700000, 1100000, true, 'trees2-needles'); crown = mk(crownMaterial(), 16000, 4000, 8000, false, 'trees2-crowns');
}
function variantJob(vk: number) {
  if (variants.has(vk) || building.has(vk)) return; building.add(vk);
  const cls = Math.floor(vk / VARIANTS), v = vk % VARIANTS;
  const timed = function* <T>(g: Generator<unknown, T>): Generator<unknown, T> { for (let n = 0; ; n++) { const t = performance.now(), r = g.next(), ms = +(performance.now() - t).toFixed(2); TREES_V2_INFO.stepMaxMs = Math.max(TREES_V2_INFO.stepMaxMs, ms); if (ms > 4 && TREES_V2_INFO.slow.length < 12) TREES_V2_INFO.slow.push([ms, vk, n, BUILD_PHASE.at]); if (r.done) { if (TREES_V2_INFO.slow.some(e => e[1] === vk && (e[0] as number) > 0)) TREES_V2_INFO.slow.push([0, vk, n]); return r.value; } yield; } };
  enqueue(`trees2:build:${vk}`, 55, timed((function* () {
    const lods: ConiferLods = yield* buildConiferSteps('black-spruce', 101 + v * 17 + cls * 1000, CLASS_AGE[cls]);
    BUILD_PHASE.at = 'meshes'; meshes(); yield;
    const g = (o: THREE.Group, i: number) => (o.children[i] as THREE.Mesh).geometry, add = (b: THREE.BatchedMesh, geo: THREE.BufferGeometry) => { try { return b.addGeometry(geo); } catch { TREES_V2_INFO.full++; return -1; } };
    for (const geo of [g(lods.near, 0), g(lods.mid, 0), g(lods.near, 1), g(lods.mid, 1), lods.crown]) { BUILD_PHASE.at = 'bounds'; geo.computeBoundingBox(); geo.computeBoundingSphere(); yield; } // BatchedMesh copies precomputed bounds instead of scanning
    // one addGeometry per step (each copies ~30k verts; the first also allocates the batch buffers): keeps steps < 4 ms
    BUILD_PHASE.at = 'add:midBark'; const mb = add(bark!, g(lods.mid, 0)); yield; BUILD_PHASE.at = 'add:nearBark'; const nb = add(bark!, g(lods.near, 0)); yield;
    BUILD_PHASE.at = 'add:midLeaf'; const ml = add(leaf!, g(lods.mid, 1)); yield; BUILD_PHASE.at = 'add:nearLeaf'; const nl = add(leaf!, g(lods.near, 1)); yield;
    BUILD_PHASE.at = 'add:crown'; const cr = add(crown!, lods.crown);
    return { lods, ids: { nb, mb, nl, ml, cr } };
  })()), (r: Variant) => {
    variants.set(vk, r); building.delete(vk); TREES_V2_INFO.variants = variants.size; TREES_V2_INFO.buildMs.push(+r.lods.stats.buildMs.toFixed(1)); TREES_V2_INFO.tris[`${CLASS_AGE[cls]}y:${v}`] = r.lods.stats.tris.near;
    for (const t of trees.values()) if (t.vk === vk && t.crown < 0) materialise(t);
    lx = Infinity; // re-pick LODs
  });
}
function materialise(t: Tree) {
  const va = variants.get(t.vk); if (!va || !crown || va.ids.cr < 0) return;
  t.crown = crown.addInstance(va.ids.cr); crown.setMatrixAt(t.crown, t.m);
  if (!t.far && va.ids.nb >= 0 && va.ids.nl >= 0) { t.bark = bark!.addInstance(va.ids.mb); bark!.setMatrixAt(t.bark, t.m); t.leaf = leaf!.addInstance(va.ids.ml); leaf!.setMatrixAt(t.leaf, t.m); bark!.setVisibleAt(t.bark, false); leaf!.setVisibleAt(t.leaf, false); }
  t.lod = 2;
}
const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), p3 = new THREE.Vector3(), s3 = new THREE.Vector3();
/** The far crown geometry a placed tree of this seed/age class draws, once its variant is built (else undefined). T-0032: render/flora/fartrees measures its blocking width. */
export function v2Crown(seed: number, cls: number) { return variants.get(Math.max(0, Math.min(3, cls)) * VARIANTS + ((seed >>> 5) % VARIANTS))?.lods.crown; }
/** Place one tree (idempotent by key). `cls` = render/trees age class 0-3; `seed` picks the variant. */
export function placeTree(key: string, x: number, y: number, z: number, rotY: number, sx: number, sy: number, sz: number, seed: number, cls: number, far: boolean) {
  if (trees.has(key)) return;
  const vk = Math.max(0, Math.min(3, cls)) * VARIANTS + ((seed >>> 5) % VARIANTS);
  const t: Tree = { m: new THREE.Matrix4().compose(p3.set(x, y, z), q.setFromAxisAngle(up, rotY), s3.set(sx, sy, sz)), vk, far, lod: -1, bark: -1, leaf: -1, crown: -1 };
  trees.set(key, t); variantJob(vk); if (variants.has(vk)) materialise(t);
}
export function removeTree(key: string) {
  const t = trees.get(key); if (!t) return; trees.delete(key);
  if (t.crown >= 0) crown!.deleteInstance(t.crown); if (t.bark >= 0) bark!.deleteInstance(t.bark); if (t.leaf >= 0) leaf!.deleteInstance(t.leaf);
}
/** Per frame (driven by render/flora/fartrees): LOD per chunk tree from the camera distance, pruning of unloaded chunks. */
export function updateTrees(sc: THREE.Scene, camera: THREE.Camera) {
  if (!TREES_V2.on) return; scene = sc;
  const x = camera.position.x, z = camera.position.z, now = performance.now();
  if (Math.hypot(x - lx, z - lz) < 1 && now - lt < 500) return; lx = x; lz = z; lt = now;
  const k = RENDER.lod.trees, n2 = (TREES_V2.nearM * k) ** 2, m2 = (55 * k + 5) ** 2, drop2 = (INTEREST.mid * 1.5 + 80) ** 2, doPrune = now - prune > 1000;
  let near = 0, mid = 0, cr = 0, far = 0;
  for (const [key, t] of trees) {
    const dx = t.m.elements[12] - x, dz = t.m.elements[14] - z, d2 = dx * dx + dz * dz;
    if (t.far) { far++; continue; }
    if (doPrune && d2 > drop2) { removeTree(key); continue; } // its chunk was unloaded (chunks reload and re-place by key)
    if (t.crown < 0) continue;
    const lod = d2 < n2 ? 0 : d2 < m2 ? 1 : 2; lod === 0 ? near++ : lod === 1 ? mid++ : cr++;
    if (lod === t.lod) continue; t.lod = lod; const va = variants.get(t.vk)!;
    crown!.setVisibleAt(t.crown, lod === 2);
    if (t.bark >= 0) { bark!.setVisibleAt(t.bark, lod < 2); leaf!.setVisibleAt(t.leaf, lod < 2); if (lod < 2) { bark!.setGeometryIdAt(t.bark, lod ? va.ids.mb : va.ids.nb); leaf!.setGeometryIdAt(t.leaf, lod ? va.ids.ml : va.ids.nl); } }
  }
  if (doPrune) prune = now;
  Object.assign(TREES_V2_INFO, { trees: trees.size, far, near, mid, crown: cr });
}
