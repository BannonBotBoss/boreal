/**
 * Ground flora renderer (Grok Bot): flowers + shrubs from core/flora/plants, placed by the shared ecology (core/flora/site:
 * niche suitability × Thomas clusters), drawn as one three r180 BatchedMesh per 20 m tile and shadow class (as render/batch).
 *  - Geometry: render/flora/plant.ts, VARIANTS per species × 2 LODs (near / mid), built once and shared.
 *  - Wind sway: the trees' wind uniforms (render/trees WIND_UNIFORMS, same objects); fall colour: the same phenology uniform;
 *    flowers only in their bloom window (WEATHER.day), collapsed in the vertex shader otherwise.
 *  - Light: registers the tree crowns as the shared canopy source, so grass, flowers and shrubs all thin in shade.
 *  - Cost: radius = min(near, 45 m × √foliage) (LADDER `foliage`); per plant, small ones drop out and switch to the mid LOD first; only shrubs > 1.5 m
 *    cast shadows. Tiles are interest jobs (one species per slice).
 * Debug: ?patch=1 = showcase (cluster intensity ×15 instead of ×6, all in bloom). Dev handle: globalThis.borealFlora.
 */
import * as THREE from 'three';
import { FLORA, type FloraSpec } from '../../core/flora/plants';
import { setCanopySource, siteAt, suitability, thomas, type Site } from '../../core/flora/site';
import { CHUNK_SIZE, generateChunk, heightAt } from '../../core/world';
import { WEATHER } from '../../core/weather';
import { enqueue, cancel, pending } from '../../core/interest';
import { hash, random, sample } from '../../proc/rng';
import { addCloudShadow, addTranslucency } from '../pbr';
import { WIND_UNIFORMS, treeDims } from '../trees';
import { buildPlant } from './plant';

const PATCH = typeof location !== 'undefined' && new URLSearchParams(location.search).has('patch');
export const FLORA_FX = { off: false, bloomAll: PATCH, density: PATCH ? 15 : 6, view: undefined as undefined | { x: number; y: number; z: number; yaw: number; pitch: number } };
export const FLORA_INFO = { tiles: 0, plants: 0, visible: 0, bySpecies: {} as Record<string, number> };
/** ?patch=1 helper: centre of the 3 m cell with the most plants and species among the built tiles (for the showcase camera). */
const densest = () => { const c = new Map<string, { n: number; sp: Set<number>; x: number; z: number }>();
  for (const t of liveTiles) for (const p of t) { const k = `${Math.floor(p.x / 3)}:${Math.floor(p.z / 3)}`, e = c.get(k) ?? { n: 0, sp: new Set(), x: 0, z: 0 }; e.n++; e.sp.add(p.species); e.x += p.x; e.z += p.z; c.set(k, e); }
  let best; for (const e of c.values()) if (!best || e.n * e.sp.size > best.n * best.sp.size) best = e; return best && { x: best.x / best.n, z: best.z / best.n, y: heightAt(best.x / best.n, best.z / best.n), species: best.sp.size }; };
const liveTiles = new Set<Plant[]>();
(globalThis as { borealFlora?: unknown }).borealFlora = { info: FLORA_INFO, fx: FLORA_FX, densest };
const TILE = CHUNK_SIZE / 2, VARIANTS = 4, LOD_DIST = 9, TALL = 1.5; // m [game calibration]

// Canopy from the generated trees (crown radius from render/trees treeDims × entity scale): cover = Σ crown overlaps, capped.
const crowns = new Map<string, { x: number; z: number; r: number }[]>();
function crownsOf(cx: number, cz: number) {
  const k = `${cx}:${cz}`; let c = crowns.get(k);
  if (!c) { c = generateChunk(cx, cz).filter(e => e.kind === 'spruce').map(e => ({ x: e.x, z: e.z, r: ((treeDims(e.seed, e.x, e.z).crownWidth ?? 3) / 2) * e.scale })); crowns.set(k, c); if (crowns.size > 400) crowns.delete(crowns.keys().next().value!); }
  return c;
}
setCanopySource((x, z) => { const cx = Math.floor(x / CHUNK_SIZE), cz = Math.floor(z / CHUNK_SIZE); let s = 0;
  for (let a = cx - 1; a <= cx + 1; a++) for (let b = cz - 1; b <= cz + 1; b++) for (const t of crownsOf(a, b)) { const d = Math.hypot(t.x - x, t.z - z); if (d < t.r * 1.5) s += Math.exp(-((d / t.r) ** 2)); }
  return Math.min(1, s); });

const day = { value: 180 }, bloomAll = { value: 0 };
let material: THREE.MeshStandardMaterial | undefined;
function floraMaterial() {
  if (material) return material;
  material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .8, side: THREE.DoubleSide }); material.userData.shared = true;
  (material as unknown as { defines: Record<string, string> }).defines = { TRANSLUCENCY_MASK: '1.0' };
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, WIND_UNIFORMS, { uDay: day, uBloomAll: bloomAll }); addTranslucency(shader); addCloudShadow(shader);
    shader.vertexShader = 'uniform float uWind, uWindAmp, uColour, uDay, uBloomAll; uniform vec2 uWindDir; attribute vec3 aFall; attribute float aOrgan; attribute vec2 aBloom; varying vec3 vFall; varying float vOrgan;\n' + shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vFall = aFall; vOrgan = aOrgan;
      mat4 pm = modelMatrix;
      #ifdef USE_BATCHING
        pm = modelMatrix * batchingMatrix;
      #endif
      if (aBloom.y > 0. && uBloomAll < .5 && (uDay < aBloom.x || uDay > aBloom.y)) transformed = vec3(0.); // out of bloom: flower collapses (degenerate)
      float ph = pm[3].x * .31 + pm[3].z * .23, hgt = max(position.y, 0.), amp = min(uWindAmp, 2.);
      vec3 wl = transpose(mat3(pm)) * vec3(uWindDir.x, 0., uWindDir.y); vec2 along = normalize(wl.xz + 1e-5), across = vec2(-along.y, along.x);
      float sway = .05 * hgt * hgt / (.4 + hgt) * amp; // stiffening with height (cantilever), as the trees' bend; [game calibration]
      transformed.xz += sway * (along * (.7 + .5 * sin(uWind * 1.6 + ph)) + across * .3 * cos(uWind * 1.1 + ph * 1.3));
      transformed.xz += aOrgan * .004 * amp * vec2(sin(uWind * 9. + ph * 3. + position.y * 40.), cos(uWind * 7. + ph * 2.)); // flower flutter`);
    shader.fragmentShader = 'uniform float uColour; varying vec3 vFall; varying float vOrgan;\n' + shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      diffuseColor.rgb = mix(diffuseColor.rgb, vFall, uColour * (1. - vOrgan)); // deciduous leaves colour with the shared phenology`);
  };
  material.customProgramCacheKey = () => 'boreal-flora';
  return material;
}
const geos = new Map<string, THREE.BufferGeometry>();
const plantGeo = (s: FloraSpec, v: number, d: number) => { const k = `${s.id}:${v}:${d}`; let g = geos.get(k); if (!g) geos.set(k, g = buildPlant(s, v, d)); return g; };

export interface Plant { species: number; variant: number; x: number; y: number; z: number; rot: number; scale: number; h: number }
/** All plants of one tile (pure: seed + position). Sites are memoised on a 1 m lattice within the tile. */
export function* plantsJob(tx: number, tz: number): Generator<unknown, Plant[]> {
  const memo = new Map<number, Site>(), site = (x: number, z: number) => { const k = Math.round(x) * 100003 + Math.round(z); let s = memo.get(k); if (!s) memo.set(k, s = siteAt(Math.round(x), Math.round(z))); return s; };
  const out: Plant[] = [];
  for (let s = 0; s < FLORA.length; s++) {
    const sp = FLORA[s], c = { ...sp.cluster, kappa: sp.cluster.kappa * FLORA_FX.density }, r = random(hash(`flora-plant:${sp.id}:${tx}:${tz}`));
    for (const p of thomas(sp.id, tx, tz, TILE, c, (x, z) => suitability(sp.niche, site(x, z)))) {
      const h = sample(r, sp.height); out.push({ species: s, variant: Math.floor(r() * VARIANTS), x: p.x, y: heightAt(p.x, p.z), z: p.z, rot: r() * Math.PI * 2, scale: h / sp.height.mean, h }); }
    yield;
  }
  return out;
}

export function createFlora(scene: THREE.Scene) {
  const group = new THREE.Group(); group.name = 'flora'; scene.add(group);
  type Tile = { tx: number; tz: number; plants: Plant[]; meshes: { bm: THREE.BatchedMesh; slots: { inst: number; geo: [number, number]; p: Plant; lod: number }[] }[] };
  const tiles = new Map<string, Tile>(), jobs = new Set<string>();
  function build(tx: number, tz: number, plants: Plant[]): Tile {
    const t: Tile = { tx, tz, plants, meshes: [] };
    for (const tall of [false, true]) {
      const list = plants.filter(p => (p.h > TALL) === tall); if (!list.length) continue;
      const keys = [...new Set(list.map(p => `${p.species}:${p.variant}`))]; let v = 0, ix = 0;
      for (const k of keys) for (const d of [0, 1]) { const [s, va] = k.split(':').map(Number), g = plantGeo(FLORA[s], va, d); v += g.getAttribute('position').count; ix += g.index!.count; }
      const bm = new THREE.BatchedMesh(list.length, v, ix, floraMaterial()); bm.userData.shadowSet = true; bm.castShadow = tall; bm.receiveShadow = true;
      const ids = new Map(keys.map(k => { const [s, va] = k.split(':').map(Number); return [k, [bm.addGeometry(plantGeo(FLORA[s], va, 0)), bm.addGeometry(plantGeo(FLORA[s], va, 1))] as [number, number]]; }));
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), slots = list.map(p => { const geo = ids.get(`${p.species}:${p.variant}`)!, inst = bm.addInstance(geo[0]);
        bm.setMatrixAt(inst, m.compose(new THREE.Vector3(p.x, p.y - .01, p.z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.rot), new THREE.Vector3(p.scale, p.scale, p.scale))); return { inst, geo, p, lod: 0 }; });
      group.add(bm); t.meshes.push({ bm, slots });
    }
    return t;
  }
  const dispose = (k: string) => { const t = tiles.get(k)!; liveTiles.delete(t.plants); for (const m of t.meshes) { group.remove(m.bm); m.bm.dispose(); } tiles.delete(k); };
  let last = -1;
  function update(camera: THREE.Camera, foliage: number, nearRadius: number, time = performance.now() / 1000) {
    const v = FLORA_FX.view; // debug/showcase camera (?patch=1 tooling): overrides the camera for this frame
    if (v) { camera.position.set(v.x, heightAt(v.x, v.z) + v.y, v.z); camera.rotation.set(v.pitch, v.yaw, 0, 'YXZ'); camera.updateMatrixWorld(true); }
    day.value = WEATHER.day; bloomAll.value = FLORA_FX.bloomAll ? 1 : 0; group.visible = !FLORA_FX.off && foliage > 0;
    if (time - last < .25 && time >= last) return; last = time; // tiles + per-instance LOD 4×/s (as render/batch)
    const R = Math.min(nearRadius, 45 * Math.sqrt(foliage)), cx = camera.position.x, cz = camera.position.z, want = new Set<string>();
    const sq = (tx: number, tz: number) => Math.hypot(Math.max(tx * TILE - cx, 0, cx - tx * TILE - TILE), Math.max(tz * TILE - cz, 0, cz - tz * TILE - TILE));
    const n = Math.ceil(R / TILE) + 1, ox = Math.floor(cx / TILE), oz = Math.floor(cz / TILE);
    for (let a = ox - n; a <= ox + n; a++) for (let b = oz - n; b <= oz + n; b++) { const d = sq(a, b), k = `${a}:${b}`; if (d > R + TILE / 2) continue; want.add(k);
      if (d <= R && !tiles.has(k) && !pending(`flora:${k}`)) { jobs.add(k); enqueue(`flora:${k}`, d + 8, plantsJob(a, b), (pl: Plant[]) => { jobs.delete(k); tiles.set(k, build(a, b, pl)); liveTiles.add(pl); }); } }
    for (const k of [...tiles.keys()]) if (!want.has(k)) dispose(k);
    for (const k of [...jobs]) if (!want.has(k)) { cancel(`flora:${k}`); jobs.delete(k); }
    let plants = 0, visible = 0; const by: Record<string, number> = {};
    for (const t of tiles.values()) for (const { bm, slots } of t.meshes) for (const s of slots) { plants++;
      const d = Math.hypot(s.p.x - cx, s.p.z - cz), vis = d < R * Math.min(1, .25 + s.p.h * .5), lod = d > LOD_DIST * (.5 + s.p.h) ? 1 : 0; // small plants drop out and simplify first
      bm.setVisibleAt(s.inst, vis); if (vis) { visible++; by[FLORA[s.p.species].id] = (by[FLORA[s.p.species].id] ?? 0) + 1; }
      if (lod !== s.lod) { bm.setGeometryIdAt(s.inst, s.geo[lod]); s.lod = lod; } }
    Object.assign(FLORA_INFO, { tiles: tiles.size, plants, visible, bySpecies: by });
  }
  return { group, update };
}
