/**
 * Tree viewer (Grok Bot): /?tree=1 (globe/entry.ts route) or /tools/tree-viewer.html?tree=1. Modes:
 *  ?tree=1             ages x seeds of black spruce side by side (near LOD) + one tree (age 90, seed 7) in all four LODs
 *  ?tree=1&view=lod    near | mid | far crown | impostor of one tree at the same size (&atlas=1 shows the impostor atlas)
 *  ?tree=1&view=one    one tree at eye level in front of a small stand (reference comparison); &age= &seed=
 *  ?tree=1&bench=far   far-ring bench: 20k+ crowns + impostors on Thomas-cluster placement (core/flora/stands), high camera
 * Dev handle: globalThis.borealTrees { stats, ready }. &nmix= sets the impostor's baked-normal weight.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { BUILD_PHASE, buildConifer, buildConiferSteps, crownMaterial, type ConiferLods } from './conifer';
import { bakeAtlas, impostorMesh, IMPOSTOR_FX, type Atlas } from './impostor';
import { farRing, type FarTree } from './farRing';
import { farTreesInTile, FAR_TREES } from '../../core/flora/stands';

const q = new URLSearchParams(location.search), hud = document.getElementById('hud') ?? (() => { // opened from the game page (/?tree=1, globe/entry.ts): clear its UI, add the HUD
  for (const el of Array.from(document.body.children)) if (el.tagName !== 'SCRIPT') el.remove();
  document.body.style.cssText = 'margin:0;height:100vh;overflow:hidden;background:#a9c3dc;font:600 13px system-ui;color:#123';
  const d = document.createElement('div'); d.id = 'hud'; d.style.cssText = 'position:absolute;left:8px;top:6px;white-space:pre;text-shadow:0 0 3px #fff;pointer-events:none'; document.body.appendChild(d); return d; })();
if (q.has('nmix')) IMPOSTOR_FX.normalMix.value = +q.get('nmix')!;
if (q.has('upbend')) IMPOSTOR_FX.upBend.value = +q.get('upbend')!;
if (q.has('itint')) IMPOSTOR_FX.tint.value.fromArray(q.get('itint')!.split(',').map(Number));
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio)); renderer.setSize(innerWidth, innerHeight); renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0xa9c3dc);
const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, .1, 5000);
scene.add(new THREE.HemisphereLight(0xbcd3e8, 0x3a3a2a, 1.1));
const sun = new THREE.DirectionalLight(0xfff1dc, 3.2); sun.position.set(25, 40, 35); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -10, near: 1, far: 150 }); scene.add(sun);
const floor = new THREE.Mesh(new THREE.CircleGeometry(2000, 64), new THREE.MeshStandardMaterial({ color: 0x2c2f22, roughness: 1 })); // dark forest floor under thinning trees
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
const controls = new OrbitControls(camera, renderer.domElement);
const stats: Record<string, unknown> = {}, handle = { stats, ready: false }; (globalThis as { borealTrees?: unknown }).borealTrees = handle;
const tri = (o: THREE.Object3D) => { let n = 0; o.traverse(c => { const m = c as THREE.Mesh; if (m.isMesh) n += (m.geometry.index?.count ?? m.geometry.getAttribute('position').count) / 3; }); return n; };
const at = (o: THREE.Object3D, x: number, z: number) => { o.position.set(x, 0, z); scene.add(o); };

/** One tree in all four LODs along x from x0 (spacing dx); returns triangle counts. */
function lodRow(t: ConiferLods, x0: number, z: number, dx: number) {
  at(t.near, x0, z); at(t.mid, x0 + dx, z);
  const crown = new THREE.InstancedMesh(t.crown, crownMaterial(), 1); crown.setMatrixAt(0, new THREE.Matrix4().makeTranslation(x0 + 2 * dx, 0, z)); scene.add(crown);
  const probe = t.near.clone(); probe.position.set(0, 0, 0); const atlas = bakeAtlas(renderer, probe);
  const imp = impostorMesh(atlas, 1); imp.setMatrixAt(0, new THREE.Matrix4().makeTranslation(x0 + 3 * dx, 0, z)); scene.add(imp);
  return { atlas, tris: { near: tri(t.near), mid: tri(t.mid), crown: tri(crown), impostor: 2 } };
}
function sheet() {
  const ages = (q.get('ages') ?? '15,35,70,120').split(',').map(Number), seeds = (q.get('seeds') ?? '1,2,3').split(',').map(Number);
  const builds: ConiferLods[] = [];
  ages.forEach((age, i) => seeds.forEach((seed, j) => { const t = buildConifer('black-spruce', seed, age); builds.push(t); at(t.near, (i - (ages.length - 1) / 2) * 4.6 + (j - 1) * 1.4, j * 3.2 - 2); }));
  const lod = buildConifer('black-spruce', 7, 90), row = lodRow(lod, -6, -14, 4), ms = builds.map(b => b.stats.buildMs);
  Object.assign(stats, { ages, seeds, buildMs: ms.map(v => +v.toFixed(1)), buildMsMean: +(ms.reduce((a, b) => a + b, 0) / ms.length).toFixed(1),
    heights: builds.map(b => +b.height.toFixed(1)), dbh: builds.map(b => +b.dbh.toFixed(1)), stems: builds.map(b => b.stats.stems),
    nearTris: builds.map(b => b.stats.tris.near), midTris: builds.map(b => b.stats.tris.mid), lod90: { ...row.tris, buildMs: +lod.stats.buildMs.toFixed(1), height: +lod.height.toFixed(1), dbh: +lod.dbh.toFixed(1) } });
  hud.textContent = `Black spruce (Picea mariana), procedural Weber-Penn\nfront: ages ${ages.join(', ')} yr (left to right) x seeds ${seeds.join(', ')}\nback: age 90 seed 7 as near | mid | far crown | impostor\nnear build ${stats.buildMsMean} ms/tree (mean)`;
  camera.position.set(0, 9, 26); controls.target.set(0, 5.5, -4); handle.ready = true;
}
function lods() {
  const t = buildConifer('black-spruce', 7, 90), row = lodRow(t, -7.5, 0, 5);
  if (q.has('atlas')) { const card = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.MeshBasicMaterial({ map: row.atlas.albedo, transparent: true, side: THREE.DoubleSide })); card.position.set(0, 6, 8); scene.add(card); }
  Object.assign(stats, { ...row.tris, buildMs: t.stats.buildMs, height: t.height });
  camera.position.set(0, 2, 30); controls.target.set(0, t.height * .45, 0);
  hud.textContent = `age 90 seed 7, ${t.height.toFixed(1)} m: near ${row.tris.near} | mid ${row.tris.mid} | crown ${row.tris.crown} | impostor 2 triangles`; handle.ready = true;
}
function one() {
  const t = buildConifer('black-spruce', +(q.get('seed') ?? 7), +(q.get('age') ?? 90)); scene.add(t.near);
  for (let k = 0; k < 6; k++) at(buildConifer('black-spruce', 100 + k, 60 + k * 15).near, -9 + k * 3.6 + (k % 2), -9 - (k % 3) * 3); // a small stand behind
  Object.assign(stats, { height: t.height, dbh: t.dbh, ...t.stats });
  camera.position.set(0, 1.7, t.height * 1.45); controls.target.set(0, t.height * .5, 0); camera.fov = 45; camera.updateProjectionMatrix();
  hud.textContent = q.has('nohud') ? '' : `black spruce, age ${q.get('age') ?? 90} yr, seed ${q.get('seed') ?? 7}: ${t.height.toFixed(1)} m, DBH ${t.dbh.toFixed(1)} cm, ${t.stats.tris.near} tris`; handle.ready = true;
}
async function benchFar() {
  const R = +(q.get('r') ?? 260), split = +(q.get('split') ?? 160), crowns: THREE.BufferGeometry[] = [], atlases: Atlas[] = [], t0 = performance.now();
  for (let v = 0; v < 4; v++) { const t = buildConifer('black-spruce', 500 + v, 70 + v * 20); crowns.push(t.crown); if (q.get('imp') !== '0') atlases.push(bakeAtlas(renderer, t.near)); }
  const prepMs = performance.now() - t0, trees: FarTree[] = [], T = FAR_TREES.tile, r = Math.ceil(R / T), t1 = performance.now();
  for (let tz = -r; tz <= r; tz++) for (let tx = -r; tx <= r; tx++) for (const p of farTreesInTile(tx, tz, 1, () => 2150, (x, z) => Math.hypot(x, z) < R ? 1 : 0, 1400))
    trees.push({ x: p.x, y: 0, z: p.z, key: `${tx}:${tz}:${p.x.toFixed(2)}:${p.z.toFixed(2)}`, scale: .75 + (p.r % 1) * .5 });
  const ring = farRing(trees, crowns, atlases, 0, 0, split); scene.add(ring.group);
  const placeMs = performance.now() - t1; sun.castShadow = false;
  camera.position.set(0, +(q.get('h') ?? 120), R * .9); controls.target.set(0, 0, -R * .2); controls.update();
  for (let i = 0; i < 30; i++) { renderer.render(scene, camera); await new Promise(r => requestAnimationFrame(r)); } // warm-up (programs, uploads)
  const frames: number[] = []; let last = performance.now();
  await new Promise<void>(res => { const step = () => { renderer.render(scene, camera); const now = performance.now(); frames.push(now - last); last = now; if (frames.length < 300) requestAnimationFrame(step); else res(); }; requestAnimationFrame(step); });
  frames.shift(); frames.sort((a, b) => a - b); const calls = renderer.info.render.calls, triangles = renderer.info.render.triangles, gl = renderer.getContext() as WebGL2RenderingContext;
  // GPU time: timer queries when exposed, else render + a 1-pixel readPixels (forces the frame to finish; includes a sync stall)
  const tq = gl.getExtension('EXT_disjoint_timer_query_webgl2') as { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number } | null, gpuMs: number[] = [], px = new Uint8Array(4);
  if (tq) for (let i = 0; i < 40; i++) { const qq = gl.createQuery()!; gl.beginQuery(tq.TIME_ELAPSED_EXT, qq); renderer.render(scene, camera); gl.endQuery(tq.TIME_ELAPSED_EXT);
    await new Promise(r => requestAnimationFrame(r)); for (let k = 0; k < 20 && !gl.getQueryParameter(qq, gl.QUERY_RESULT_AVAILABLE); k++) await new Promise(r => requestAnimationFrame(r));
    if (gl.getQueryParameter(qq, gl.QUERY_RESULT_AVAILABLE) && !gl.getParameter(tq.GPU_DISJOINT_EXT)) gpuMs.push(gl.getQueryParameter(qq, gl.QUERY_RESULT) / 1e6); gl.deleteQuery(qq); }
  const fin: number[] = []; for (let i = 0; i < 60; i++) { const a = performance.now(); renderer.render(scene, camera); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); fin.push(performance.now() - a); } fin.sort((a, b) => a - b); gpuMs.sort((a, b) => a - b);
  if (gpuMs.length) Object.assign(stats, { gpuMedian: +gpuMs[gpuMs.length >> 1].toFixed(2), gpuP95: +gpuMs[Math.floor(gpuMs.length * .95)].toFixed(2) });
  Object.assign(stats, { trees: trees.length, crowns: ring.counts.crowns, impostors: ring.counts.impostors, calls, triangles,
    frameAvg: +(frames.reduce((a, b) => a + b, 0) / frames.length).toFixed(2), frameP95: +frames[Math.floor(frames.length * .95)].toFixed(2), renderSyncMedian: +fin[30].toFixed(2), renderSyncP95: +fin[57].toFixed(2), timerQuery: !!tq,
    prepMs: +prepMs.toFixed(0), placeMs: +placeMs.toFixed(0), radius: R, split, crownTris: crowns.map(c => c.index!.count / 3) });
  hud.textContent = `far ring: ${trees.length} trees (${ring.counts.crowns} crowns, ${ring.counts.impostors} impostors), ${calls} draw calls, ${triangles} tris\nframe avg ${stats.frameAvg} ms, render+sync median ${stats.renderSyncMedian} ms${stats.gpuMedian !== undefined ? `, GPU ${stats.gpuMedian} ms` : ''}`;
  handle.ready = true;
}
function steps() { // dev: step times of the sliced build (the game's 'trees2' jobs must stay under ~4 ms per step)
  const out: Record<string, (number | string)[]> = {};
  for (const [cls, age] of [[0, 25], [1, 70], [2, 130], [3, 220]]) for (let v = 0; v < 2; v++) {
    const g = buildConiferSteps('black-spruce', 101 + v * 17 + cls * 1000, age), ms: number[] = [], ph: string[] = []; let r; do { const t = performance.now(); r = g.next(); ms.push(+(performance.now() - t).toFixed(2)); ph.push(BUILD_PHASE.at); } while (!r.done);
    const i = ms.indexOf(Math.max(...ms)); out[`${age}y:${v}`] = [ms[i], ms.length, +ms.reduce((a, b) => a + b, 0).toFixed(1), i, ph[i]];
  }
  Object.assign(stats, out); hud.textContent = JSON.stringify(out); handle.ready = true;
}
if (q.has('steps')) steps(); else if (q.get('bench') === 'far') void benchFar(); else if (q.get('view') === 'one') one(); else if (q.get('view') === 'lod') lods(); else sheet();
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
renderer.setAnimationLoop(() => { if (q.get('bench') === 'far' && !handle.ready) return; controls.update(); renderer.render(scene, camera); });
