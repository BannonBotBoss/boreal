/**
 * Planet globe view (Grok Bot): `?view=globe`. Orbit → ground zoom over a cube-sphere with distance-based quadtree LOD
 * (cube.ts, tailored from SimonDev ProceduralTerrain_Part10, MIT), sampled from the seeded planet function (planet.ts),
 * whose home region IS the live game's terrain (core/world heightAt, same seed and stage switch).
 * Controls: drag = orbit (three OrbitControls, MIT, examples/jsm, unmodified; its zoom is replaced by a logarithmic altitude
 * zoom), wheel/+/- = zoom, H = fly home, G or Esc = back to the game.
 * Perf: tiles build in a small pool of Web Workers (tileWorker.ts; SimonDev part 7 threads the same way), falling back to
 * budgeted core/interest jobs if workers are unavailable. Nodes beyond the horizon (planet + highest relief) are neither
 * split, built nor drawn. Governor: the shared quality ladder (core/quality) picks tile resolution, split distance, depth and
 * cache; frames feed governFrame like the game.
 * Dev: ?alt=<m> ?at=x,z ?seed= ?stages=1 ?tier=0..5 ?workers=0 (main-thread fallback) ?bench=zoom (logs a BENCH line).
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GOVERNOR, LADDER, ceiling, governFrame, tierForGpu } from '../../core/quality';
import { cachedProbe } from '../../core/probe';
import { RENDER_SETTINGS, createSettingsStore } from '../../core/renderSettings';
import { STAGES } from '../../core/stages/elevation';
import { heightAt, WORLD_SEED } from '../../core/world';
import { INTEREST, cancel, enqueue, runJobs } from '../../core/interest';
import { smoothstep, clamp } from '../../proc/math';
import { children, edgeMetres, faceDir, roots, wantsSplit, centre as nodeCentre, type QNode } from './cube';
import { renderOffset } from './origin';
import { planetFor, toLatLon, PLANET, type Vec3 } from './planet';
import { buildTile, globeMaterial, tileGeometry, type TileData } from './tile';
import type { TileRequest } from './tileWorker';
import { globeLod } from './lod';

interface Tile { mesh: THREE.Mesh; used: number; centre: Vec3 } // centre: doubles, CPU only (camera-relative rendering)
/** Dev stats (HUD + ?bench=zoom): per-tile build CPU ms, per-frame main-thread work and rAF interval. */
const STATS = { warm: [] as number[], build: [] as number[], work: [] as number[], interval: [] as number[] };
const pct = (a: number[], p: number) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const avg = (a: number[]) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
const keep = (a: number[], n: number) => { if (a.length > n) a.splice(0, a.length - n); };

export function startGlobe(canvas = document.getElementById('world') as HTMLCanvasElement) {
  // ---- page: hide the game's DOM (this view never starts the game loop)
  for (const id of ['loading', 'status', 'interaction', 'notice']) { const e = document.getElementById(id); if (e) e.style.display = 'none'; }
  for (const sel of ['header', 'footer']) { const e = document.querySelector<HTMLElement>(sel); if (e) e.style.display = 'none'; }
  Object.assign(document.body.style, { margin: '0', overflow: 'hidden', background: '#000' });
  Object.assign(canvas.style, { display: 'block', width: '100vw', height: '100vh' });
  const hud = document.createElement('div');
  Object.assign(hud.style, { position: 'absolute', left: '14px', top: '12px', font: '12px/1.6 system-ui', color: '#dfe8ef', background: '#0b1622b0', padding: '8px 12px', borderRadius: '6px', pointerEvents: 'none', whiteSpace: 'pre' });
  document.body.append(hud);

  // ---- the same world the game uses: settings store (applies world.stagedTerrain + quality caps), seed from the start menu
  createSettingsStore(RENDER_SETTINGS);
  { const sd = Number(localStorage.getItem('boreal.seed.v1')); if (sd > 0) STAGES.seed = sd; }
  const q = new URLSearchParams(location.search);
  if (q.has('stages')) STAGES.on = true;
  const seed = Number(q.get('seed')) || (STAGES.on ? STAGES.seed : WORLD_SEED);
  const planet = planetFor(seed, heightAt, STAGES.on ? 'staged' : 'layered'), R = PLANET.radius;

  // ---- renderer + governor start (same rules as render/photoreal: GPU string → start tier, probe cap from the cached probe)
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, logarithmicDepthBuffer: true, powerPreference: 'high-performance' });
  { const g = renderer.getContext(), dbg = g.getExtension('WEBGL_debug_renderer_info');
    GOVERNOR.gpu = String(dbg ? g.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER));
    const probe = cachedProbe(localStorage, GOVERNOR.gpu); if (probe) GOVERNOR.probeCap = probe.cap;
    if (GOVERNOR.auto) GOVERNOR.tier = Math.max(ceiling(), tierForGpu(GOVERNOR.gpu)); }
  if (q.has('tier')) { GOVERNOR.auto = false; GOVERNOR.tier = clamp(Number(q.get('tier')) || 0, 0, LADDER.length - 1); }
  let lod = globeLod();
  const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 1, 1e9);
  const applyRes = () => { renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5) * lod.resScale); renderer.setSize(innerWidth, innerHeight, false); };
  applyRes(); addEventListener('resize', () => { applyRes(); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const SPACE = new THREE.Color(0x02040a), SKY = new THREE.Color(0x8fb4d9);
  const scene = new THREE.Scene(); scene.background = SPACE.clone();
  // Sun: fixed, from the home side so the playable region is lit [game calibration; the world clock drives it in a later step]
  const sun = new THREE.DirectionalLight(0xfff4e0, 3.2), sunDir = new THREE.Vector3(...planet.home).add(new THREE.Vector3(...planet.east).multiplyScalar(.6)).add(new THREE.Vector3(0, .5, 0)).normalize();
  sun.position.copy(sunDir); scene.add(sun, new THREE.HemisphereLight(0x9fb8d8, 0x202018, .35));
  const material = globeMaterial();
  const group = new THREE.Group(); scene.add(group);

  // ---- camera: OrbitControls rotates around the planet centre; altitude is ours (log zoom), tilt toward the horizon near ground
  const controls = new OrbitControls(camera, canvas); controls.enableZoom = false; controls.enablePan = false; controls.enableDamping = true; controls.dampingFactor = .12;
  const bench = q.get('bench') === 'zoom', benchFrom = 14e6, benchTo = 300, benchSec = 20; let benchT = -2, benchOrbit = {}; // 2 s settle at orbit, 20 s zoom, 8 s hold
  const startAlt = bench ? benchFrom : Number(q.get('alt')) || R * 2.2;
  const start = q.has('at') ? (() => { const [x, z] = (q.get('at') ?? '0,0').split(',').map(Number); return planet.fromLocal(x || 0, z || 0); })() : planet.home;
  let alt = startAlt, targetAlt = startAlt, ground = 0, flyHome = 0;
  camera.position.set(...start).multiplyScalar(R + alt);
  const zoom = (f: number) => { targetAlt = clamp(targetAlt * f, 40, R * 4); };
  canvas.addEventListener('wheel', e => { e.preventDefault(); zoom(Math.exp(e.deltaY * .0016)); }, { passive: false });
  addEventListener('keydown', e => {
    if (e.key === '+' || e.key === '=') zoom(.7); else if (e.key === '-') zoom(1 / .7);
    else if (e.key === 'h' || e.key === 'H') flyHome = 1;
    else if (e.key === 'g' || e.key === 'G' || e.key === 'Escape') { q.delete('view'); location.search = q.toString(); }
  });

  // ---- tile builders: a worker pool (default) or budgeted main-thread jobs (?workers=0 or no Worker support)
  const tiles = new Map<string, Tile>(), queued = new Map<string, { n: QNode; pr: number }>(), inflight = new Set<string>();
  let frame = 0, built = 0, reqId = 0;
  const camPos: Vec3 = [0, 0, 0];
  const nWorkers = q.get('workers') === '0' ? 0 : clamp((navigator.hardwareConcurrency || 4) - 2, 1, 4);
  const pool: { w: Worker; busy: string }[] = [], ids = new Map<number, QNode>();
  const accept = (n: QNode, t: TileData) => {
    inflight.delete(n.key); STATS.build.push(t.cpu); built++;
    const mesh = new THREE.Mesh(tileGeometry(t), material); mesh.matrixAutoUpdate = false;
    tiles.set(n.key, { mesh, used: frame, centre: [t.centre[0], t.centre[1], t.centre[2]] });
  };
  try {
    for (let k = 0; k < nWorkers; k++) {
      const w = new Worker(new URL('./tileWorker.ts', import.meta.url), { type: 'module' }), slot = { w, busy: '' };
      w.onmessage = (e: MessageEvent<{ id: number; tile: TileData; warm?: number }>) => { if (e.data.warm !== undefined) { STATS.warm.push(e.data.warm); return; } const n = ids.get(e.data.id)!; ids.delete(e.data.id); slot.busy = ''; accept(n, e.data.tile); };
      w.onerror = e => { console.warn('globe tile worker failed; using main-thread jobs', e.message); pool.length = 0; inflight.clear(); ids.clear(); };
      w.postMessage({ warm: true, id: 0, seed, staged: STAGES.on, stagesSeed: STAGES.seed, face: 0, level: 0, i: 0, j: 0, segments: 0 } satisfies TileRequest);
      pool.push(slot);
    }
  } catch (e) { console.warn('globe: no workers, main-thread jobs', e); pool.length = 0; }
  const mode = () => pool.length ? `${pool.length} workers` : 'main-thread';
  function dispatch() {
    if (!pool.length) { // fallback: sliced generators within INTEREST.budgetMs
      for (const [key, { n, pr }] of queued) { queued.delete(key); inflight.add(key); enqueue(key, pr, buildTile(n, planet, lod.segments), t => accept(n, t)); }
      runJobs(INTEREST.budgetMs); return;
    }
    const order = [...queued.values()].sort((a, b) => a.pr - b.pr);
    for (const slot of pool) {
      if (slot.busy) continue; const job = order.shift(); if (!job) break;
      const { n } = job, id = ++reqId; queued.delete(n.key); inflight.add(n.key); ids.set(id, n); slot.busy = n.key;
      slot.w.postMessage({ id, seed, staged: STAGES.on, stagesSeed: STAGES.seed, face: n.face, level: n.level, i: n.i, j: n.j, segments: lod.segments } satisfies TileRequest);
    }
  }
  const offTmp: Vec3 = [0, 0, 0];
  const wanted = new Set<string>(); let drawn = 0, inView = 0, deepest = 0, culled = 0, splitK = 1;
  function want(n: QNode) {
    const t = tiles.get(n.key); if (t) { t.used = frame; return true; }
    wanted.add(n.key);
    if (!inflight.has(n.key)) { const c = nodeCentre(n, R); queued.set(n.key, { n, pr: n.level * 1e-3 + Math.hypot(camPos[0] - c[0], camPos[1] - c[1], camPos[2] - c[2]) / R }); }
    return false;
  }
  // Horizon culling: a node is hidden when its whole angular extent lies beyond the camera's horizon over the planet plus
  // the horizon of the highest possible relief (1.6 × maxLand bounds the seed's tail; planet tests check the range).
  const reliefHorizon = Math.acos(R / (R + PLANET.maxLand * 1.6)), dirTmp: Vec3 = [0, 0, 0];
  function hidden(n: QNode) {
    if (n.level === 0) return false;
    const D = Math.hypot(camPos[0], camPos[1], camPos[2]), s = 2 / (1 << n.level), a0 = -1 + n.i * s, b0 = -1 + n.j * s;
    const c = faceDir(n.face, a0 + s / 2, b0 + s / 2, dirTmp), ang = Math.acos(clamp((c[0] * camPos[0] + c[1] * camPos[1] + c[2] * camPos[2]) / D, -1, 1));
    const extent = edgeMetres(n.level, R) / R * .8; // ≥ half-diagonal of the node (Nowell cells are ≤ 1.2 × the mean size)
    return ang - extent > Math.acos(clamp(R / D, -1, 1)) + reliefHorizon;
  }
  // Frustum-aware LOD: below minLevel, a node wholly outside the view frustum never splits (it stays drawn coarse and
  // three's culling skips its draw call), so detail, builds and the cache go only where the camera looks.
  const frustum = new THREE.Frustum(), projView = new THREE.Matrix4(), ball = new THREE.Sphere();
  function inFrustum(n: QNode) {
    const c = nodeCentre(n, R); ball.center.set(c[0], c[1], c[2]); ball.radius = edgeMetres(n.level, R) * .8 + PLANET.maxLand * 1.6;
    return frustum.intersectsSphere(ball);
  }
  function visit(n: QNode) {
    if (hidden(n)) { culled++; return; }
    const ready = want(n), seen = n.level < lod.minLevel || inFrustum(n);
    if (seen && wantsSplit(n, camPos, { radius: R, minLevel: lod.minLevel, maxLevel: lod.maxLevel, split: lod.split * splitK })) {
      const kids = children(n).filter(k => !hidden(k) || (culled++, false)), ok = kids.map(want).every(Boolean);
      if (ok) { for (const k of kids) visit(k); return; }
    }
    if (ready) { const tl = tiles.get(n.key)!; renderOffset(tl.centre, camPos, offTmp); tl.mesh.position.set(offTmp[0], offTmp[1], offTmp[2]); tl.mesh.updateMatrix(); group.add(tl.mesh); drawn++; if (seen) inView++; deepest = Math.max(deepest, n.level); }
  }
  // roots first, synchronously on this thread, so the planet is never empty
  for (const r of roots()) accept(r, (() => { const g = buildTile(r, planet, lod.segments); let x = g.next(); while (!x.done) x = g.next(); return x.value; })());
  STATS.build.length = 0;

  // ---- loop
  let last = performance.now(), fps = 0, prevT = 0;
  function tick() {
    const t0 = performance.now(), dt = Math.min(.1, (t0 - last) / 1000); last = t0; frame++;
    const dir = camera.position.clone().normalize(), s = planet.sampleSurface([dir.x, dir.y, dir.z]); ground = Math.max(s.h, s.water);
    if (flyHome) { const h = new THREE.Vector3(...planet.home), k = 1 - Math.exp(-dt * 2.5); dir.lerp(h, k).normalize(); if (dir.angleTo(h) < 1e-5) flyHome = 0; }
    if (bench) { const prev = benchT; benchT += dt;
      if (prev < 0 && benchT >= 0) { STATS.build.length = STATS.work.length = STATS.interval.length = 0; benchOrbit = { drawn, inView, calls: renderer.info.render.calls, tris: renderer.info.render.triangles }; }
      targetAlt = alt = benchFrom * (benchTo / benchFrom) ** clamp(benchT / benchSec, 0, 1);
      if (prev < benchSec + 8 && benchT >= benchSec + 8) console.log('BENCH ' + JSON.stringify({ mode: mode(), warm: STATS.warm.map(Math.round), tiles: STATS.build.length, buildAvg: +avg(STATS.build).toFixed(2), buildP95: +pct(STATS.build, .95).toFixed(2), buildMax: +Math.max(0, ...STATS.build).toFixed(2),
        frames: STATS.work.length, workAvg: +avg(STATS.work).toFixed(2), workP99: +pct(STATS.work, .99).toFixed(2), workMax: +Math.max(0, ...STATS.work).toFixed(2), intervalP99: +pct(STATS.interval, .99).toFixed(1), intervalMax: +Math.max(0, ...STATS.interval).toFixed(1), cached: tiles.size, orbit: benchOrbit, ground: { drawn, inView, calls: renderer.info.render.calls, tris: renderer.info.render.triangles } })); }
    else alt = Math.exp(Math.log(alt) + (Math.log(targetAlt) - Math.log(alt)) * (1 - Math.exp(-dt * 7)));
    controls.rotateSpeed = clamp(alt / R * .6, 2e-6, 1);
    camera.position.copy(dir).multiplyScalar(R + ground + alt);
    controls.update();
    camera.position.setLength(R + ground + alt);
    camera.lookAt(0, 0, 0);
    const tilt = (Math.PI / 2 - .12) * (1 - smoothstep(3e3, 3e5, alt)); camera.rotateX(tilt); // look toward the horizon near the ground [game calibration]
    camera.near = clamp(alt * .02, .5, 1e5); camera.far = Math.sqrt((R + ground + alt) ** 2 - R * R) + R * 2; camera.updateProjectionMatrix();
    (scene.background as THREE.Color).copy(SPACE).lerp(SKY, 1 - smoothstep(2e4, 1.2e5, alt)); // daytime sky below ~100 km [game calibration; no scattering yet]
    camPos[0] = camera.position.x; camPos[1] = camera.position.y; camPos[2] = camera.position.z;

    // LOD selection, then hand the wanted builds to the workers (or jobs); drop builds nobody wants any more
    camera.updateMatrixWorld(); frustum.setFromProjectionMatrix(projView.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    group.clear(); wanted.clear(); drawn = 0; inView = 0; deepest = 0; culled = 0;
    for (const r of roots()) visit(r);
    // draw cap: shrink the split distance while more tiles than the tier's cap are in view, relax it back when under
    splitK = inView > lod.draw ? Math.max(.35, splitK * .97) : inView < lod.draw * .85 ? Math.min(1, splitK * 1.01) : splitK;
    for (const key of queued.keys()) if (!wanted.has(key)) queued.delete(key);
    if (!pool.length) for (const key of inflight) if (!wanted.has(key)) { cancel(key); inflight.delete(key); }
    dispatch();
    if (frame % 30 === 0 && tiles.size > lod.cache) { // evict least-recently-used tiles over the tier's cache cap (never the roots)
      const old = [...tiles.entries()].filter(([k, t]) => t.used < frame - 2 && k.split('/')[1] !== '0').sort((a, b) => a[1].used - b[1].used);
      for (const [key, t] of old.slice(0, tiles.size - lod.cache)) { t.mesh.geometry.dispose(); tiles.delete(key); }
    }
    // camera-relative: render from the origin (tile offsets were set from the double camera position in visit())
    const tR = performance.now(); camera.position.set(0, 0, 0); camera.updateMatrixWorld(); renderer.render(scene, camera); camera.position.set(camPos[0], camPos[1], camPos[2]); camera.updateMatrixWorld();
    const work = performance.now() - t0; if (bench && work > 40) console.log(`SPIKE ${work.toFixed(0)}ms alt ${alt.toFixed(0)} pre-render ${(tR - t0).toFixed(0)} render ${(performance.now() - tR).toFixed(0)} calls ${renderer.info.render.calls} accepted ${built}`); STATS.work.push(work); if (prevT) STATS.interval.push(t0 - prevT);
    if (!bench) { keep(STATS.work, 600); keep(STATS.interval, 600); keep(STATS.build, 2000); }
    fps = fps * .95 + (1000 / Math.max(1, t0 - (prevT || t0 - 16))) * .05; prevT = t0;
    if (governFrame(work, undefined, dt * 1000)) { lod = globeLod(); applyRes(); }
    if (frame % 10 === 1) {
      const ll = toLatLon([dir.x, dir.y, dir.z]);
      hud.textContent = `Boreal planet · seed ${seed}${STAGES.on ? ' (staged)' : ''}\n` +
        `altitude ${alt >= 1e4 ? (alt / 1000).toFixed(0) + ' km' : alt.toFixed(0) + ' m'} · ground ${ground.toFixed(0)} m · ${(ll.lat * 180 / Math.PI).toFixed(2)}°, ${(ll.lon * 180 / Math.PI).toFixed(2)}°\n` +
        `tiles drawn ${drawn} (${inView} in view, cap ${lod.draw}${splitK < 1 ? ` · split ×${splitK.toFixed(2)}` : ''}) · culled ${culled} · cached ${tiles.size} · deepest L${deepest} · queued ${queued.size + inflight.size}\n` +
        `build (${mode()}) ${built} tiles · avg ${avg(STATS.build).toFixed(1)} ms · p95 ${pct(STATS.build, .95).toFixed(1)} ms · worst frame ${Math.max(0, ...STATS.work).toFixed(1)} ms\n` +
        `tier ${LADDER[GOVERNOR.tier].name}${GOVERNOR.auto ? ' (auto)' : ''} · ${lod.segments} seg · ${fps.toFixed(0)} fps · work ${work.toFixed(1)} ms\n` +
        `drag orbit · wheel / + - zoom · H home · G game`;
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  return { planet, renderer, scene, camera, tiles };
}
