/**
 * Ground flora renderer (Grok Bot): flowers, shrubs and understorey carpets from core/flora/plants, placed by the shared
 * ecology (core/flora/site: niche suitability × Thomas clusters), drawn by ONE three r180 BatchedMesh for the whole field.
 *  - Geometry: render/flora/plant.ts, VARIANTS per species × 2 LODs (near / mid) + carpet clumps (buildClump), built once in
 *    budgeted job slices (one geometry per slice), then added to the shared BatchedMesh. Tiles only add / delete instances,
 *    so a new 20 m tile never creates a mesh, a program lookup or a draw call (carpets included).
 *  - Per-frame CPU: none (perObjectFrustumCulled / sortObjects off: the multi-draw list is rebuilt only when the 4 Hz LOD /
 *    visibility pass changes something). No flora casts shadows (perf audit 2026-10-18); all receive them.
 *  - Wind sway: the trees' wind uniforms (render/trees WIND_UNIFORMS, same objects); fall colour: the same phenology uniform;
 *    flowers only in their bloom window (WEATHER.day), collapsed in the vertex shader otherwise.
 *  - Light + footprints: registers the generated tree crowns as the shared canopy source and rocks / logs / trunks / props
 *    as the shared footprint source (core/flora/site), built per chunk in sliced jobs (prepareArea), so grass, flowers,
 *    shrubs and carpets thin in shade and never grow through solid objects.
 *  - Cost: radius = min(near, 45 m × √foliage) (LADDER `foliage`); per plant, small ones drop out and switch to the mid LOD
 *    first; carpets: near clumps inside CLUMP_NEAR, far clumps (half the ramets, stemless) thinned with distance.
 * Viewing: V (in game) orbits the densest flora patch near you (V or a move key leaves); ?patch=1 = showcase (cluster
 * intensity ×15, all in bloom), ?patch=view also starts in the patch view. Dev handle: globalThis.borealFlora.
 */
import * as THREE from 'three';
import { FLORA } from '../../core/flora/plants';
import { covered, footprintsIn, prepareArea, setAreaPrefetch, setCanopySource, setFootprintSource, siteAt, suitability, thomas, type Footprint, type Site } from '../../core/flora/site';
import { CHUNK_SIZE, generateChunk, heightAt } from '../../core/world';
import { applyPopulation } from '../../core/population';
import { rockDiameter } from '../../core/rocks';
import { WEATHER } from '../../core/weather';
import { enqueue, cancel, pending, finish } from '../../core/interest';
import { hash, random, sample } from '../../proc/rng';
import { addCloudShadow, addTranslucency } from '../pbr';
import { WIND_UNIFORMS, treeDims } from '../trees';
import { buildClump, buildPlant } from './plant';

const PARAMS = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams(), PATCH = PARAMS.has('patch');
type View = { x: number; y: number; z: number; yaw: number; pitch: number };
export const FLORA_FX = { off: false, bloomAll: PATCH, density: PATCH ? 15 : 6, carpet: 1, view: undefined as undefined | View };
export const FLORA_INFO = { tiles: 0, plants: 0, visible: 0, clumps: 0, clumpsVisible: 0, bySpecies: {} as Record<string, number>, sliceMaxMs: 0, buildMaxMs: 0, geometries: 0 };
const TILE = CHUNK_SIZE / 2, VARIANTS = 4, LOD_DIST = 9, CLUMP_NEAR = 6, CLUMP_FULL = 12, SLICE_MS = 2; // m, m, m, m, ms [game calibration]
const liveTiles = new Set<Plant[]>();
const now = () => performance.now();

/** Flowering patch for the viewer: the 3 m cell with the most plants × species (carpet = true: the densest understorey carpet), near (x, z) if given. */
function densest(near?: { x: number; z: number; r: number }, carpet = false) { const c = new Map<string, { n: number; sp: Set<number>; x: number; z: number }>();
  for (const t of liveTiles) for (const p of t) { if (!!p.clump !== carpet || (near && Math.hypot(p.x - near.x, p.z - near.z) > near.r)) continue;
    const k = `${Math.floor(p.x / 3)}:${Math.floor(p.z / 3)}`, e = c.get(k) ?? { n: 0, sp: new Set(), x: 0, z: 0 }; e.n++; e.sp.add(p.species); e.x += p.x; e.z += p.z; c.set(k, e); }
  let best; for (const e of c.values()) if (!best || e.n * e.sp.size > best.n * best.sp.size) best = e; return best && { x: best.x / best.n, z: best.z / best.n, y: heightAt(best.x / best.n, best.z / best.n), species: best.sp.size }; }
(globalThis as { borealFlora?: unknown }).borealFlora = { info: FLORA_INFO, fx: FLORA_FX, densest };

// ---- per-chunk crowns (canopy) + footprints, from the same entities the scene draws (generateChunk → applyPopulation) ----
type ChunkInfo = { crowns: { x: number; z: number; r: number }[]; feet: Footprint[] };
const chunks = new Map<string, ChunkInfo>();
function* chunkJob(cx: number, cz: number): Generator<unknown, ChunkInfo> {
  const k = `${cx}:${cz}`; let c = chunks.get(k); if (c) return c;
  const ents = applyPopulation(generateChunk(cx, cz), cx, cz); yield;
  c = { crowns: [], feet: [] }; let t = now();
  for (const e of ents) {
    if (e.kind === 'spruce') { const d = treeDims(e.seed, e.x, e.z); c.crowns.push({ x: e.x, z: e.z, r: ((d.crownWidth ?? 3) / 2) * e.scale });
      c.feet.push({ x: e.x, z: e.z, r: (d.trunkRadius ?? .15) * e.scale * 1.3, hx: 0, hz: 0 }); } // trunk + root flare
    else if (e.kind === 'rock') c.feet.push({ x: e.x, z: e.z, r: rockDiameter(e) / 2, hx: 0, hz: 0 });            // render/rocks: bounding sphere = diameter
    else if (e.kind === 'log') c.feet.push({ x: e.x, z: e.z, r: 0, hx: 2.25, hz: .45 });                          // render/geometry: 4.4 m × r .43, axis x, unrotated
    else if (e.kind === 'forage' || e.kind === 'plant') c.feet.push({ x: e.x, z: e.z, r: (e.kind === 'plant' ? .55 : .5) * e.scale, hx: 0, hz: 0 });
    if (now() - t > SLICE_MS) { yield; t = now(); }
  }
  chunks.set(k, c); if (chunks.size > 400) chunks.delete(chunks.keys().next().value!); return c;
}
const chunkAt = (cx: number, cz: number) => chunks.get(`${cx}:${cz}`) ?? finish(chunkJob(cx, cz));
const span = (a: number, b: number) => { const o: number[] = []; for (let i = Math.floor(a / CHUNK_SIZE); i <= Math.floor(b / CHUNK_SIZE); i++) o.push(i); return o; };
setCanopySource((x, z) => { let s = 0; // crown score: Σ Gaussian crown overlaps, capped
  for (const a of span(x - 12, x + 12)) for (const b of span(z - 12, z + 12)) for (const t of chunkAt(a, b).crowns) { const d = Math.hypot(t.x - x, t.z - z); if (d < t.r * 1.5) s += Math.exp(-((d / t.r) ** 2)); }
  return Math.min(1, s); });
setFootprintSource((x0, z0, x1, z1) => { const out: Footprint[] = [];
  for (const a of span(x0 - 3, x1 + 3)) for (const b of span(z0 - 3, z1 + 3)) for (const f of chunkAt(a, b).feet) { const ex = (f.hx || f.r) + .6, ez = (f.hz || f.r) + .6; if (f.x + ex > x0 && f.x - ex < x1 && f.z + ez > z0 && f.z - ez < z1) out.push(f); }
  return out; });
setAreaPrefetch(function* (x0, z0, x1, z1) { for (const a of span(x0 - 12, x1 + 12)) for (const b of span(z0 - 12, z1 + 12)) if (!chunks.has(`${a}:${b}`)) yield* chunkJob(a, b); });

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

export interface Plant { species: number; variant: number; x: number; y: number; z: number; rot: number; scale: number; h: number; clump?: boolean; keep?: number }
/** All plants + carpet clumps of one tile (pure: seed + position), in budgeted slices: chunk caches, then the site lattice
 * (1 m, memoised), then one species per slice. Plants and clumps are masked against rock / log / trunk / prop footprints. */
export function* plantsJob(tx: number, tz: number): Generator<unknown, Plant[]> {
  const x0 = tx * TILE, z0 = tz * TILE;
  yield* prepareArea(x0 - 4, z0 - 4, x0 + TILE + 4, z0 + TILE + 4);
  const memo = new Map<number, Site>(), site = (x: number, z: number) => { const k = Math.round(x) * 100003 + Math.round(z); let s = memo.get(k); if (!s) memo.set(k, s = siteAt(Math.round(x), Math.round(z))); return s; };
  let t = now();
  for (let j = -2; j <= TILE + 2; j++) { for (let i = -2; i <= TILE + 2; i++) site(x0 + i, z0 + j); if (now() - t > SLICE_MS) { yield; t = now(); } }
  const feet = footprintsIn(x0 - 3, z0 - 3, x0 + TILE + 3, z0 + TILE + 3), out: Plant[] = [];
  for (let s = 0; s < FLORA.length; s++) {
    const sp = FLORA[s], c = { ...sp.cluster, kappa: sp.cluster.kappa * FLORA_FX.density }, r = random(hash(`flora-plant:${sp.id}:${tx}:${tz}`));
    for (const p of thomas(sp.id, tx, tz, TILE, c, (x, z) => suitability(sp.niche, site(x, z)))) {
      const h = sample(r, sp.height), variant = Math.floor(r() * VARIANTS), rot = r() * Math.PI * 2; // every draw first: masking never shifts the stream
      if (!covered(feet, p.x, p.z, Math.min(.5, .04 + .3 * h))) out.push({ species: s, variant, x: p.x, y: heightAt(p.x, p.z), z: p.z, rot, scale: h / sp.height.mean, h }); }
    yield;
  }
  for (let s = 0; s < FLORA.length; s++) { // understorey carpets: clonal mats (Thomas clusters) of merged ramet clumps, by the same niche (light = crown score)
    const sp = FLORA[s], cp = sp.carpet; if (!cp || !FLORA_FX.carpet) continue; const r = random(hash(`flora-carpet:${sp.id}:${tx}:${tz}`));
    for (const p of thomas(`carpet:${sp.id}`, tx, tz, TILE, { ...cp.cluster, kappa: cp.cluster.kappa * FLORA_FX.carpet }, (x, z) => suitability(sp.niche, site(x, z)))) {
      const variant = Math.floor(r() * VARIANTS), rot = r() * Math.PI * 2, scale = .85 + .3 * r();
      if (!covered(feet, p.x, p.z, cp.radius * .8)) out.push({ species: s, variant, x: p.x, y: heightAt(p.x, p.z), z: p.z, rot, scale, h: sp.height.mean * scale, clump: true, keep: p.r }); }
    yield;
  }
  return out;
}

/** Geometry list for the shared BatchedMesh: species × variant × LOD, plus carpet clumps. */
const geoKey = (s: number, v: number, d: number, clump?: boolean) => `${s}:${v}:${d}:${clump ? 1 : 0}`;
function* geometriesJob(): Generator<unknown, Map<string, THREE.BufferGeometry>> {
  const out = new Map<string, THREE.BufferGeometry>();
  for (let s = 0; s < FLORA.length; s++) for (let v = 0; v < VARIANTS; v++) for (const d of [0, 1]) {
    out.set(geoKey(s, v, d), buildPlant(FLORA[s], v, d)); yield;
    if (FLORA[s].carpet) { out.set(geoKey(s, v, d, true), buildClump(FLORA[s], v, d)); yield; } }
  return out;
}

export function createFlora(scene: THREE.Scene) {
  const group = new THREE.Group(); group.name = 'flora'; scene.add(group);
  let bm: THREE.BatchedMesh | undefined, cap = 0; const ids = new Map<string, number>(), waiting = new Map<string, Plant[]>(), free: number[] = [];
  type Slot = { inst: number; geo: [number, number]; p: Plant; lod: number; vis: boolean };
  const tiles = new Map<string, { plants: Plant[]; slots: Slot[] }>(), jobs = new Set<string>();
  enqueue('flora:geometry', -1, geometriesJob(), (geos: Map<string, THREE.BufferGeometry>) => {
    let v = 0, ix = 0; for (const g of geos.values()) { v += g.getAttribute('position').count; ix += g.index!.count; }
    cap = 8192; bm = new THREE.BatchedMesh(cap, v, ix, floraMaterial()); bm.name = 'flora-batch';
    Object.assign(bm, { perObjectFrustumCulled: false, sortObjects: false, frustumCulled: false, castShadow: false, receiveShadow: true }); bm.userData.shadowSet = true;
    for (const [k, g] of geos) { ids.set(k, bm.addGeometry(g)); g.dispose(); }
    group.add(bm); FLORA_INFO.geometries = geos.size;
    for (const [k, pl] of waiting) build(k, pl); waiting.clear();
  });
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), scl = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  function build(k: string, plants: Plant[]) {
    const t0 = now(), b = bm!;
    const add = plants.length - free.length; if (add > 0 && b.instanceCount + add > cap) { while (b.instanceCount + add > cap) cap *= 2; b.setInstanceCount(cap); }
    const slots = plants.map(p => { const geo: [number, number] = [ids.get(geoKey(p.species, p.variant, 0, p.clump))!, ids.get(geoKey(p.species, p.variant, 1, p.clump))!];
      let inst = free.pop(); if (inst === undefined) inst = b.addInstance(geo[1]); else b.setGeometryIdAt(inst, geo[1]);
      b.setMatrixAt(inst, m.compose(pos.set(p.x, p.y - .01, p.z), q.setFromAxisAngle(Y, p.rot), scl.setScalar(p.scale))); b.setVisibleAt(inst, false); return { inst, geo, p, lod: 1, vis: false }; });
    tiles.set(k, { plants, slots }); liveTiles.add(plants); last = -1; // LOD / visibility pass on the next update
    FLORA_INFO.buildMaxMs = Math.max(FLORA_INFO.buildMaxMs, now() - t0);
  }
  const dispose = (k: string) => { const t = tiles.get(k)!; liveTiles.delete(t.plants); for (const s of t.slots) { if (s.vis) bm!.setVisibleAt(s.inst, false); free.push(s.inst); } tiles.delete(k); }; // own free list: three's deleteInstance re-sorts its id list on every add

  // ---- patch viewer (V / ?patch=view): orbit camera over the densest flowering patch near the viewer ----
  const viewer = { on: PARAMS.get('patch') === 'view', site: undefined as undefined | { x: number; y: number; z: number }, a: .6, t: 0, hint: undefined as HTMLElement | undefined };
  const setViewer = (on: boolean) => { viewer.on = on; viewer.site = undefined; if (!on) FLORA_FX.view = undefined;
    if (typeof document === 'undefined') return;
    if (on && !viewer.hint) { const h = viewer.hint = document.createElement('div'); h.textContent = 'Flora patch view · V or a move key to leave';
      Object.assign(h.style, { position: 'fixed', left: '50%', bottom: '24px', transform: 'translateX(-50%)', padding: '6px 12px', background: 'rgba(0,0,0,.45)', color: '#fff', font: '13px system-ui, sans-serif', borderRadius: '6px', pointerEvents: 'none', zIndex: '5' }); document.body.appendChild(h); }
    if (viewer.hint) viewer.hint.hidden = !on; };
  if (typeof addEventListener !== 'undefined') addEventListener('keydown', e => {
    if (e.repeat || e.ctrlKey || e.metaKey || (e.target instanceof HTMLElement && (e.target.isContentEditable || e.target.matches('input,textarea,select')))) return;
    const k = e.key.toLowerCase();
    if (k === 'v') setViewer(!viewer.on); else if (viewer.on && ['w', 'a', 's', 'd', 'p', 'escape'].includes(k)) setViewer(false); // p: photo mode takes the camera; Esc also opens the pause menu (main.ts)
  });
  if (viewer.on) setViewer(true);

  let last = -1;
  function update(camera: THREE.Camera, foliage: number, nearRadius: number, time = now() / 1000) {
    if (viewer.on) { // orbit 3.4 m out, 1.1 m up, ~0.12 rad/s; the site is picked once flora near the viewer has been built
      const dt = Math.min(.1, Math.max(0, time - viewer.t)); viewer.t = time; viewer.a += dt * .12;
      viewer.site ??= densest({ x: camera.position.x, z: camera.position.z, r: 30 });
      if (viewer.site) FLORA_FX.view = { x: viewer.site.x + Math.sin(viewer.a) * 3.4, y: 1.1, z: viewer.site.z + Math.cos(viewer.a) * 3.4, yaw: viewer.a, pitch: -.3 };
    }
    const v = FLORA_FX.view; // viewer / tooling camera: overrides the camera for this frame
    if (v) { camera.position.set(v.x, heightAt(v.x, v.z) + v.y, v.z); camera.rotation.set(v.pitch, v.yaw, 0, 'YXZ'); camera.updateMatrixWorld(true); }
    day.value = WEATHER.day; bloomAll.value = FLORA_FX.bloomAll ? 1 : 0; group.visible = !FLORA_FX.off && foliage > 0;
    if (time - last < .25 && time >= last) return; last = time; // tiles + per-instance LOD 4×/s (as render/batch)
    const R = Math.min(nearRadius, 45 * Math.sqrt(foliage)), RC = R * .7, cx = camera.position.x, cz = camera.position.z, want = new Set<string>();
    const sq = (tx: number, tz: number) => Math.hypot(Math.max(tx * TILE - cx, 0, cx - tx * TILE - TILE), Math.max(tz * TILE - cz, 0, cz - tz * TILE - TILE));
    const n = Math.ceil(R / TILE) + 1, ox = Math.floor(cx / TILE), oz = Math.floor(cz / TILE);
    for (let a = ox - n; a <= ox + n; a++) for (let b = oz - n; b <= oz + n; b++) { const d = sq(a, b), k = `${a}:${b}`; if (d > R + TILE / 2) continue; want.add(k);
      if (d <= R && !tiles.has(k) && !waiting.has(k) && !pending(`flora:${k}`)) { jobs.add(k); enqueue(`flora:${k}`, d + 8, timed(plantsJob(a, b)), (pl: Plant[]) => { jobs.delete(k); if (bm) build(k, pl); else waiting.set(k, pl); }); } }
    for (const k of [...tiles.keys()]) if (!want.has(k)) dispose(k);
    for (const k of [...waiting.keys()]) if (!want.has(k)) waiting.delete(k);
    for (const k of [...jobs]) if (!want.has(k)) { cancel(`flora:${k}`); jobs.delete(k); }
    if (!bm) return;
    let plants = 0, visible = 0, clumps = 0, clumpsVisible = 0; const by: Record<string, number> = {};
    for (const t of tiles.values()) for (const s of t.slots) { const p = s.p, d = Math.hypot(p.x - cx, p.z - cz); let vis: boolean, lod: number;
      if (p.clump) { clumps++; vis = d < RC && (d < CLUMP_FULL || p.keep! < (CLUMP_FULL / d) ** 1.5); lod = d > CLUMP_NEAR ? 1 : 0; if (vis) clumpsVisible++; } // far mats thin with distance
      else { plants++; vis = d < R * Math.min(1, .25 + p.h * .5); lod = d > LOD_DIST * (.5 + p.h) ? 1 : 0; if (vis) { visible++; by[FLORA[p.species].id] = (by[FLORA[p.species].id] ?? 0) + 1; } } // small plants drop out and simplify first
      if (vis !== s.vis) { bm.setVisibleAt(s.inst, vis); s.vis = vis; }
      if (lod !== s.lod) { bm.setGeometryIdAt(s.inst, s.geo[lod]); s.lod = lod; } }
    Object.assign(FLORA_INFO, { tiles: tiles.size, plants, visible, clumps, clumpsVisible, bySpecies: by });
  }
  return { group, update };
}
/** Slice timer for the perf audit (FLORA_INFO.sliceMaxMs). */
function* timed<T>(g: Generator<unknown, T>): Generator<unknown, T> { for (;;) { const t = now(), r = g.next(); FLORA_INFO.sliceMaxMs = Math.max(FLORA_INFO.sliceMaxMs, now() - t); if (r.done) return r.value; yield; } }
