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
 * Two ways to run it: startGlobe (standalone `?view=globe`, owns page + renderer + loop; the reload path) and createGlobe
 * (shared: borrows the game's renderer for the in-page transition and renders into a far-layer target, farLayer.ts).
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
import { createAtmosphere } from './atmosphere';
import { across } from './cube';
import { CLOCK, loadClock, worldSec } from '../../core/worldClock';
import { gameHour, START_HOUR, sunPosition } from '../../core/timeOfDay';
import { gameUrl, landSpawn, handoffTarget, HANDOFF } from './handoff';
import { globePlanet } from './home';
import { toLatLon, PLANET, type Vec3 } from './planet';
import { setLogDepthFar } from './logDepth';
import { buildTile, globeMaterial, releaseTileGeometry, setGlobeDetail, stitchIndex, tileGeometry, type TileData } from './tile';
export { GLOBE_LAKE } from './tile'; // inpage.ts (lazy): the band's lake ease
/** Deeper tiles under a low camera: split x(1 + k) for tiles within reach x altitude, ramping in from `from` to `full` m. [game calibration] */
export const NEAR_SPLIT = { k: 1.2, from: 3000, full: 1200, reach: 4 };
import type { TileRequest } from './tileWorker';
import { GLOBE_LOD, balancedTree, globeLod, worldTier } from './lod';

interface Tile { mesh: THREE.Mesh; used: number; centre: Vec3; seg: number } // centre: doubles, CPU only (camera-relative rendering)
/** Dev stats (HUD + ?bench=zoom): per-tile build CPU ms, per-frame main-thread work and rAF interval. */
const STATS = { warm: [] as number[], build: [] as number[], work: [] as number[], interval: [] as number[], compileMs: -1, rebuilt: 0 };
const pct = (a: number[], p: number) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const avg = (a: number[]) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
const keep = (a: number[], n: number) => { if (a.length > n) a.splice(0, a.length - n); };

/** Who owns what (explicit; tests/globe.test.ts). Standalone `?view=globe` owns the page and the renderer. Shared mode (the
 *  in-page transition) borrows the game's renderer: no resize, no page DOM, no clock load (main owns the world clock), no
 *  governor feed (main feeds it once per frame), no auto handoff, input only while attached, and NO renderer dispose or
 *  context loss. `ownsRenderer` sets the dispose rule explicitly. */
export interface GlobeOptions {
  shared: boolean; ownsRenderer?: boolean; params?: URLSearchParams;
  /** shared mode: programs are compiled for this target (render-target programs differ from the screen's: tone mapping, colour space) */
  target?: THREE.WebGLRenderTarget | null;
  /** G / Esc (and the standalone auto handoff): default = dispose and reload into the game at the spot */
  onLeave?: (at: { x: number; z: number; yaw: number } | null) => void;
  /** tile workers (default: cores - 2, 1..4; shared mode 2). ?workers=0 = main-thread jobs */
  workers?: number;
}
export function globeOwnership(o: GlobeOptions) {
  const page = !o.shared;
  return { disposeRenderer: o.ownsRenderer ?? page, resize: page, pageDom: page, loadClock: page, governor: page, autoHandoff: page, inputAtStart: page };
}
export type Globe = ReturnType<typeof createGlobe>;

/** Standalone planet view (`?view=globe`): its own renderer, page and loop. */
export function startGlobe(canvas = document.getElementById('world') as HTMLCanvasElement) {
  // the same world the game uses: settings store (applies world.stagedTerrain + quality caps), seed from the start menu
  createSettingsStore(RENDER_SETTINGS);
  { const sd = Number(localStorage.getItem('boreal.seed.v1')); if (sd > 0) STAGES.seed = sd; }
  // log depth is per material (logDepth.ts), not a renderer flag: the same programs as in shared mode
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  // governor start (same rules as render/photoreal: GPU string -> start tier, probe cap from the cached probe)
  { const g = renderer.getContext(), dbg = g.getExtension('WEBGL_debug_renderer_info');
    GOVERNOR.gpu = String(dbg ? g.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER));
    const probe = cachedProbe(localStorage, GOVERNOR.gpu); if (probe) GOVERNOR.probeCap = probe.cap;
    if (GOVERNOR.auto) GOVERNOR.tier = Math.max(ceiling(), tierForGpu(GOVERNOR.gpu)); }
  const q = new URLSearchParams(location.search);
  if (q.has('tier')) { GOVERNOR.auto = false; GOVERNOR.tier = clamp(Number(q.get('tier')) || 0, 0, LADDER.length - 1); }
  const globe = createGlobe(renderer, { shared: false, params: q });
  globe.start(); return globe;
}

/** The globe on a given renderer. Standalone: startGlobe. Shared: the caller's loop calls step(target) each frame. */
export function createGlobe(renderer: THREE.WebGLRenderer, opts: GlobeOptions) {
  const own = globeOwnership(opts), canvas = renderer.domElement, q = opts.params ?? new URLSearchParams(location.search);
  const listeners: (() => void)[] = []; // removed by dispose()
  const listen = (t: EventTarget, type: string, fn: (e: any) => void, o?: AddEventListenerOptions) => { t.addEventListener(type, fn, o); listeners.push(() => t.removeEventListener(type, fn, o)); };
  // ---- page (standalone only): hide the game's DOM (this view never starts the game loop)
  let hud: HTMLDivElement | null = null;
  if (own.pageDom) {
    for (const id of ['loading', 'status', 'interaction', 'notice']) { const e = document.getElementById(id); if (e) e.style.display = 'none'; }
    for (const sel of ['header', 'footer']) { const e = document.querySelector<HTMLElement>(sel); if (e) e.style.display = 'none'; }
    Object.assign(document.body.style, { margin: '0', overflow: 'hidden', background: '#000' });
    Object.assign(canvas.style, { display: 'block', width: '100vw', height: '100vh' });
    hud = document.createElement('div');
    Object.assign(hud.style, { position: 'absolute', left: '14px', top: '12px', font: '12px/1.6 system-ui', color: '#dfe8ef', background: '#0b1622b0', padding: '8px 12px', borderRadius: '6px', pointerEvents: 'none', whiteSpace: 'pre' });
    document.body.append(hud);
  }
  if (q.has('stages')) STAGES.on = true;
  const seed = Number(q.get('seed')) || (STAGES.on ? STAGES.seed : WORLD_SEED);
  const planet = globePlanet(seed, STAGES.on, STAGES.seed), R = PLANET.radius; // home.ts: surfaceAt (staged) or heightAt
  let lod = globeLod(), lodTier = worldTier(); // tile rows follow the HELD world tier (core/quality worldTier), not every step
  const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 1, 1e9);
  const applyRes = () => { if (!own.resize) return; renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5) * lod.resScale); renderer.setSize(innerWidth, innerHeight, false); };
  applyRes(); if (own.resize) listen(window, 'resize', () => { applyRes(); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
  if (own.pageDom) renderer.toneMapping = THREE.ACESFilmicToneMapping; // shared: the game owns tone mapping (also ACES)

  const SPACE = new THREE.Color(0x02040a), SKY = new THREE.Color(0x8fb4d9), SKY_DAY = new THREE.Color(0x9fb8d8), SKY_DUSK = new THREE.Color(0xc9a58f);
  const scene = new THREE.Scene(); scene.background = SPACE.clone();
  // Sun: the game's world clock (core/worldClock + timeOfDay, same ?hour= start offset as the game), placed at the home
  // region and turned into planet axes (game +x = east, +y = up, −z = north). One direction for the whole planet.
  if (own.loadClock) loadClock(localStorage.getItem(CLOCK.key)); // shared: main already owns the clock
  const hourParam = Number(q.get('hour')), startHour = q.has('hour') && hourParam >= 0 && hourParam < 24 ? hourParam : START_HOUR;
  const E = new THREE.Vector3(...planet.east), N = new THREE.Vector3(...planet.north), U = new THREE.Vector3(...planet.home);
  const sunDir = new THREE.Vector3(), sunNow = () => { const d = sunPosition(gameHour(q.has('shot') ? 0 : worldSec(), startHour)).direction; /* screenshots: clock pinned so ?hour= is exact */ return sunDir.copy(E).multiplyScalar(d.x).addScaledVector(U, d.y).addScaledVector(N, -d.z).normalize(); };
  const sun = new THREE.DirectionalLight(0xffffff, 3.2), hemi = new THREE.HemisphereLight(0x9fb8d8, 0x202018, .35);
  sun.position.copy(sunNow()); scene.add(sun, hemi);
  const seamsDebug = q.get('seams') === '1'; // ?seams=1: skirts red, tile borders yellow (tile.ts globeMaterial)
  const material = globeMaterial(seamsDebug ? lod.segments : 0);
  // Atmosphere (atmosphere.ts): sky shell + aerial perspective on the tiles; ?atmos=0 for the plain look
  const atmos = q.get('atmos') === '0' ? null : createAtmosphere(R, GOVERNOR.tier, planet.seed);
  if (atmos) { atmos.patch(material); if (q.get('dome') !== '0') scene.add(atmos.dome); }
  const camV = new THREE.Vector3();
  let ext: { position: THREE.Vector3; quaternion: THREE.Quaternion; fov: number; aspect: number } | null = null; // shared band: externally flown camera
  const atYaw = Number(q.get('at')?.split(',')[2]); // from the game (handoff.ts globeUrl): keep its heading
  let lookAz = q.has('look') ? Number(q.get('look')) * Math.PI / 180 : q.has('at') && Number.isFinite(atYaw) && q.get('at')!.split(',').length > 2 ? -atYaw : null;
  const pitchQ = q.has('pitch') ? Number(q.get('pitch')) * Math.PI / 180 : null; // ?pitch=deg from straight down (screenshots: look down at a cloud deck)
  const group = new THREE.Group(); scene.add(group);

  // ---- camera: OrbitControls rotates around the planet centre; altitude is ours (log zoom), tilt toward the horizon near ground
  const controls = new OrbitControls(camera, canvas); controls.enableZoom = false; controls.enablePan = false; controls.enableDamping = true; controls.dampingFactor = .12;
  let inputOn = own.inputAtStart; controls.enabled = inputOn; // input is mode-scoped: only while attached (attachInput)
  const bench = q.get('bench') === 'zoom', benchFrom = 14e6, benchTo = 300, benchSec = 20; let benchT = -2, benchOrbit = {}; // 2 s settle at orbit, 20 s zoom, 8 s hold
  const startAlt = bench ? benchFrom : Number(q.get('alt')) || R * 2.2;
  const dirQ = q.get('dir')?.split(',').map(Number); // ?dir=x,y,z: start over any planet direction (e.g. a cube-face corner, screenshots)
  const start = dirQ?.length === 3 && dirQ.every(Number.isFinite) ? new THREE.Vector3(...dirQ).normalize().toArray() as [number, number, number] : q.has('at') ? (() => { const [x, z] = (q.get('at') ?? '0,0').split(',').map(Number); return planet.fromLocal(x || 0, z || 0); })() : planet.home;
  let alt = startAlt, targetAlt = startAlt, ground = 0, flyHome = 0, overHome: { x: number; z: number } | null = null, leaving = false;
  const shot = q.has('shot'); // screenshots: clock pinned, stays on the globe, logs seam diagnostics
  const autoHandoff = own.autoHandoff && !bench && !q.has('shot') && q.get('handoff') !== '0'; // screenshots and benches stay on the globe
  if (q.get('handoff') === 'demo') targetAlt = HANDOFF.alt * .75; // ?handoff=demo&alt=4000: descend and hand off by itself
  const fade = own.pageDom ? document.createElement('div') : null; if (fade) { Object.assign(fade.style, { position: 'fixed', inset: '0', background: '#dfe8ef', opacity: '0', transition: 'opacity .6s', pointerEvents: 'none' }); document.body.append(fade); }
  const leave = opts.onLeave ?? ((at: { x: number; z: number; yaw: number } | null) => { dispose(); location.search = gameUrl(location.search, at); });
  camera.position.set(...start).multiplyScalar(R + alt);
  const fwdTmp = new THREE.Vector3(), camUp = new THREE.Vector3(...start), nL = new THREE.Vector3(), eL = new THREE.Vector3();
  const localNE = () => { nL.copy(N).addScaledVector(camUp, -N.dot(camUp)).normalize(); eL.copy(E).addScaledVector(camUp, -E.dot(camUp)).normalize(); }; // compass axes at the camera (home's, projected)
  const cameraAz = () => { localNE(); camera.getWorldDirection(fwdTmp); return Math.atan2(fwdTmp.dot(eL), fwdTmp.dot(nL)); };
  // game yaw of the camera heading (handoff.ts: yaw = -compass azimuth); the set heading (?look, ?at yaw, Q/E, right-drag) when there is one
  const headingYaw = () => Math.round(-(lookAz ?? cameraAz()) * 1000) / 1000;
  // turn the heading below 300 km: Q/E and right-drag (left-drag still pans over the planet)
  const turn = (d: number) => { if (alt < 3e5) lookAz = (lookAz ?? cameraAz()) + d; };
  controls.mouseButtons.RIGHT = null; listen(canvas, 'contextmenu', e => { if (inputOn) e.preventDefault(); });
  let turnX: number | null = null;
  listen(canvas, 'pointerdown', (e: PointerEvent) => { if (inputOn && e.button === 2) turnX = e.clientX; });
  listen(window, 'pointermove', (e: PointerEvent) => { if (turnX !== null) { turn((e.clientX - turnX) * .005); turnX = e.clientX; } });
  listen(window, 'pointerup', (e: PointerEvent) => { if (e.button === 2) turnX = null; });
  const zoom = (f: number) => { targetAlt = clamp(targetAlt * f, 40, R * 4); };
  listen(canvas, 'wheel', (e: WheelEvent) => { if (!inputOn) return; e.preventDefault(); zoom(Math.exp(e.deltaY * .0016)); }, { passive: false });
  listen(window, 'keydown', (e: KeyboardEvent) => {
    if (!inputOn) return;
    if (e.key === '+' || e.key === '=') zoom(.7); else if (e.key === '-') zoom(1 / .7);
    else if (e.key === 'h' || e.key === 'H') flyHome = 1;
    else if (e.key === 'q' || e.key === 'Q') turn(-.12); else if (e.key === 'e' || e.key === 'E') turn(.12);
    else if (e.key === 'g' || e.key === 'G' || e.key === 'Escape') { const at = overHome && { ...landSpawn(overHome), yaw: headingYaw() }; leave(at); } // over home: spawn right below, same heading
  });

  // ---- tile builders: a worker pool (default) or budgeted main-thread jobs (?workers=0 or no Worker support)
  const tiles = new Map<string, Tile>(), queued = new Map<string, { n: QNode; pr: number }>(), inflight = new Set<string>();
  let frame = 0, built = 0, reqId = 0, cancelledN = 0;
  const camPos: Vec3 = [0, 0, 0];
  const nWorkers = q.get('workers') === '0' ? 0 : opts.workers ?? (opts.shared ? 2 : clamp((navigator.hardwareConcurrency || 4) - 2, 1, 4));
  let suspended = false; // shared mode: workers terminated during gameplay (suspendWorkers), restarted on the way up
  const pool: { w: Worker; busy: string; id: number }[] = [], ids = new Map<number, QNode>();
  // finished tiles wait here; each frame adopts the closest few within a small main-thread budget (geometry + GPU upload
  // happen on adoption), so a burst of worker results never lands in one frame
  const ready: { n: QNode; t: TileData; d: number }[] = [];
  const ADOPT = { perFrame: 4, ms: 2.5 }; // [game calibration]
  const accept = (n: QNode, t: TileData) => {
    inflight.delete(n.key); STATS.build.push(t.cpu); built++;
    const old = tiles.get(n.key); if (old) { releaseTileGeometry(old.mesh.geometry); STATS.rebuilt++; } // a rebuild at the current segment count replaces the old tile
    const mesh = new THREE.Mesh(tileGeometry(t), material); mesh.matrixAutoUpdate = false;
    tiles.set(n.key, { mesh, used: frame, centre: [t.centre[0], t.centre[1], t.centre[2]], seg: Math.round(Math.sqrt(4 + t.position.length / 3)) - 3 });
  };
  function spawn() { try {
    for (let k = 0; k < nWorkers; k++) {
      const w = new Worker(new URL('./tileWorker.ts', import.meta.url), { type: 'module' }), slot = { w, busy: '', id: 0 };
      w.onmessage = (e: MessageEvent<{ id: number; tile?: TileData; warm?: number; cancelled?: boolean }>) => {
        if (e.data.warm !== undefined) { STATS.warm.push(e.data.warm); return; }
        const n = ids.get(e.data.id); ids.delete(e.data.id); if (slot.id === e.data.id) { slot.busy = ''; slot.id = 0; }
        if (!n) return; if (e.data.cancelled || !e.data.tile) { inflight.delete(n.key); cancelledN++; return; }
        const c = e.data.tile.centre; ready.push({ n, t: e.data.tile, d: Math.hypot(c[0] - camPos[0], c[1] - camPos[1], c[2] - camPos[2]) });
      };
      w.onerror = e => { console.warn('globe tile worker failed; using main-thread jobs', e.message); pool.length = 0; inflight.clear(); ids.clear(); };
      w.postMessage({ warm: true, id: 0, seed, staged: STAGES.on, stagesSeed: STAGES.seed, face: 0, level: 0, i: 0, j: 0, segments: 0 } satisfies TileRequest);
      pool.push(slot);
    }
  } catch (e) { console.warn('globe: no workers, main-thread jobs', e); pool.length = 0; } }
  spawn();
  const mode = () => pool.length ? `${pool.length} workers` : 'main-thread';
  function dispatch() {
    if (suspended) return;
    if (!pool.length) { // fallback: sliced generators within INTEREST.budgetMs
      for (const [key, { n, pr }] of queued) { queued.delete(key); inflight.add(key); enqueue(`globe:${key}`, pr, buildTile(n, planet, lod.segments), t => accept(n, t)); } // one scheduler kind ('globe') so its cost estimate learns
      runJobs(INTEREST.budgetMs); return;
    }
    const order = [...queued.values()].sort((a, b) => a.pr - b.pr);
    for (const slot of pool) {
      if (slot.busy) continue; const job = order.shift(); if (!job) break; // busy includes '~' (cancel sent, waiting for the worker)
      const { n } = job, id = ++reqId; queued.delete(n.key); inflight.add(n.key); ids.set(id, n); slot.busy = n.key; slot.id = id;
      slot.w.postMessage({ id, seed, staged: STAGES.on, stagesSeed: STAGES.seed, face: n.face, level: n.level, i: n.i, j: n.j, segments: lod.segments } satisfies TileRequest);
    }
  }
  const offTmp: Vec3 = [0, 0, 0];
  const wanted = new Set<string>(); let drawn = 0, inView = 0, deepest = 0, culled = 0, splitK = 1;
  function want(n: QNode) {
    const t = tiles.get(n.key);
    if (t) { // built at another tier's segment count (the governor moved the world tier): neighbours would not share
      t.used = frame; // their edge vertices (T-junction cracks), so rebuild it at the current count; the old one draws meanwhile
      if (t.seg !== lod.segments && !inflight.has(n.key)) { wanted.add(n.key); const c = nodeCentre(n, R); queued.set(n.key, { n, pr: 1 + n.level * 1e-3 + Math.hypot(camPos[0] - c[0], camPos[1] - c[1], camPos[2] - c[2]) / R }); }
      return true;
    }
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
  // Stitching (tile.ts stitchIndex): an edge whose same-face neighbour is drawn one level coarser gets the collapsed index
  const drawnNodes: QNode[] = [], drawnKeys = new Set<string>();
  function stitch() {
    drawnKeys.clear(); for (const n of drawnNodes) drawnKeys.add(n.key);
    for (const n of drawnNodes) {
      let flags = 0;
      if (n.level > 0) for (let e = 0; e < 4; e++) { // the same-level node across each edge (also across cube-face edges): its parent drawn?
        const a = across(n, e); if (drawnKeys.has(`${a.face}/${n.level - 1}/${a.i >> 1}/${a.j >> 1}`)) flags |= 1 << e;
      }
      const t = tiles.get(n.key)!, g = t.mesh.geometry;
      if ((g.userData.stitch ?? 0) !== flags) { g.userData.stitch = flags; g.setIndex(stitchIndex(t.seg, flags)); }
    }
    if (shot && frame % 240 === 0) console.log('SEAMS ' + JSON.stringify(seamReport())); // screenshots: level jumps / segment mismatches across drawn edges
  }
  /** Diagnostics: for every drawn tile edge, the level difference to the drawn neighbour (also across cube faces) and
   *  whether both tiles have the same segment count (the stitching needs both: <= 1 level apart, same segments). */
  function seamReport() {
    const jumps: Record<number, number> = {}, segs: Record<number, number> = {}; let segMismatch = 0;
    for (const n of drawnNodes) {
      const t = tiles.get(n.key)!; segs[t.seg] = (segs[t.seg] ?? 0) + 1;
      for (let e = 0; e < 4; e++) { const a = across(n, e);
        for (let l = n.level; l >= 0; l--) { const k = `${a.face}/${l}/${a.i >> (n.level - l)}/${a.j >> (n.level - l)}`; if (!drawnKeys.has(k)) continue;
          jumps[n.level - l] = (jumps[n.level - l] ?? 0) + 1; if (tiles.get(k)!.seg !== t.seg) segMismatch++; break; } }
    }
    return { drawn: drawnNodes.length, jumps, segs, segMismatch, lodSegments: lod.segments, rebuilt: STATS.rebuilt, tier: GOVERNOR.tier, worldTier: GOVERNOR.worldTier, changes: GOVERNOR.changes };
  }
  let splitSet = new Set<string>();
  function visit(n: QNode) {
    if (hidden(n)) { culled++; return; }
    const ready = want(n), seen = n.level < lod.minLevel || inFrustum(n);
    if (splitSet.has(n.key)) { // the 2:1 balanced split set (lod.ts balancedTree): neighbours never 2+ levels apart
      const kids = children(n).filter(k => !hidden(k) || (culled++, false)), ok = kids.map(want).every(Boolean);
      if (ok) { for (const k of kids) visit(k); return; }
    }
    if (ready) { const tl = tiles.get(n.key)!; renderOffset(tl.centre, camPos, offTmp); tl.mesh.position.set(offTmp[0], offTmp[1], offTmp[2]); tl.mesh.updateMatrix(); group.add(tl.mesh); drawnNodes.push(n); drawn++; if (seen) inView++; deepest = Math.max(deepest, n.level); }
  }
  // Leaving (handoff, G, closing the tab): stop the workers and free the GPU now, so nothing of the globe lingers into the game
  // Shared mode: the renderer belongs to the game, so only the globe's own resources go (explicit owner flag).
  let down = false;
  function dispose() {
    if (down) return; down = true; for (const off of listeners) off(); listeners.length = 0; controls.dispose();
    for (const sl of pool) sl.w.terminate(); pool.length = 0; ids.clear(); inflight.clear(); queued.clear(); ready.length = 0;
    for (const t of tiles.values()) releaseTileGeometry(t.mesh.geometry); tiles.clear(); material.dispose(); group.clear();
    if (atmos) { atmos.dome.geometry.dispose(); (atmos.dome.material as THREE.Material).dispose(); }
    if (own.disposeRenderer) { renderer.dispose(); renderer.forceContextLoss(); }
  }
  if (own.disposeRenderer) listen(window, 'pagehide', dispose);
  // roots first, synchronously on this thread, so the planet is never empty
  for (const r of roots()) accept(r, (() => { const g = buildTile(r, planet, lod.segments); let x = g.next(); while (!x.done) x = g.next(); return x.value; })());
  STATS.build.length = 0;

  // ---- loop
  let last = performance.now(), fps = 0, prevT = 0, t0 = 0, dt = 0, tR = 0;
  const dir = new THREE.Vector3();
  /** Camera, LOD, builds, adoption, eviction: everything but the draw. */
  function update() {
    t0 = performance.now(); dt = Math.min(.1, (t0 - last) / 1000); last = t0; frame++;
    if (ext) camera.position.copy(ext.position); // shared band: the transition flies the camera (drive)
    dir.copy(camera.position).normalize(); const s = planet.sampleSurface([dir.x, dir.y, dir.z]); ground = Math.max(s.h, s.water);
    // globe → game: below HANDOFF.alt over the playable region (not while climbing), fade and reload into the game there
    overHome = s.home >= 1 ? { x: Math.round(s.x * 10) / 10, z: Math.round(s.z * 10) / 10 } : null;
    const spawn = handoffTarget(s, alt, targetAlt > alt * 1.01);
    if (autoHandoff && spawn && !leaving) { leaving = true; if (fade) fade.style.opacity = '1'; const at = { ...landSpawn(spawn), yaw: headingYaw() }; setTimeout(() => leave(at), 650); }
    if (flyHome) { const h = new THREE.Vector3(...planet.home), k = 1 - Math.exp(-dt * 2.5); dir.lerp(h, k).normalize(); if (dir.angleTo(h) < 1e-5) flyHome = 0; }
    if (bench) { const prev = benchT; benchT += dt;
      if (prev < 0 && benchT >= 0) { STATS.build.length = STATS.work.length = STATS.interval.length = 0; benchOrbit = { drawn, inView, calls: renderer.info.render.calls, tris: renderer.info.render.triangles }; }
      targetAlt = alt = benchFrom * (benchTo / benchFrom) ** clamp(benchT / benchSec, 0, 1);
      if (prev < benchSec + 8 && benchT >= benchSec + 8) console.log('BENCH ' + JSON.stringify({ mode: mode(), warm: STATS.warm.map(Math.round), tiles: STATS.build.length, buildAvg: +avg(STATS.build).toFixed(2), buildP95: +pct(STATS.build, .95).toFixed(2), buildMax: +Math.max(0, ...STATS.build).toFixed(2),
        frames: STATS.work.length, compileMs: +STATS.compileMs.toFixed(0), workAvg: +avg(STATS.work).toFixed(2), workP99: +pct(STATS.work, .99).toFixed(2), workMax: +Math.max(0, ...STATS.work).toFixed(2), intervalP99: +pct(STATS.interval, .99).toFixed(1), intervalMax: +Math.max(0, ...STATS.interval).toFixed(1), cached: tiles.size, orbit: benchOrbit, ground: { drawn, inView, calls: renderer.info.render.calls, tris: renderer.info.render.triangles } })); }
    else if (!ext) alt = Math.exp(Math.log(alt) + (Math.log(targetAlt) - Math.log(alt)) * (1 - Math.exp(-dt * 7)));
    if (ext) { alt = targetAlt = Math.max(1, camera.position.length() - R - ground); camUp.copy(dir); camera.quaternion.copy(ext.quaternion);
      if (camera.fov !== ext.fov || camera.aspect !== ext.aspect) { camera.fov = ext.fov; camera.aspect = ext.aspect; } }
    else {
    controls.rotateSpeed = clamp(alt / R * .6, 2e-6, 1);
    camera.position.copy(dir).multiplyScalar(R + ground + alt); camUp.copy(dir);
    controls.update();
    camera.position.setLength(R + ground + alt);
    camera.lookAt(0, 0, 0);
    const tilt = pitchQ ?? (Math.PI / 2 - .12) * (1 - smoothstep(3e3, 3e5, alt)); camera.rotateX(tilt); // look toward the horizon near the ground [game calibration]
    if (lookAz !== null && alt < 3e5) { // ?look=azimuth° (0 north, 90 east): face a compass heading near the ground (screenshots)
      localNE(); const up = camUp.clone(), h = nL.clone().multiplyScalar(Math.cos(lookAz)).addScaledVector(eL, Math.sin(lookAz));
      camera.up.copy(up); camera.lookAt(camera.position.clone().add(h.addScaledVector(up, -.08))); }
    }
    camera.near = clamp(alt * .02, .5, 1e5); camera.far = Math.sqrt((R + ground + alt) ** 2 - R * R) + R * 2; camera.updateProjectionMatrix();
    if (!atmos) (scene.background as THREE.Color).copy(SPACE).lerp(SKY, 1 - smoothstep(2e4, 1.2e5, alt)); // plain look: flat daytime sky below ~100 km
    sun.position.copy(sunNow()); { const se = camera.position.clone().normalize().dot(sunDir); hemi.intensity = .04 + .66 * smoothstep(-.3, .12, se); hemi.color.copy(SKY_DAY).lerp(SKY_DUSK, 1 - smoothstep(0, .2, se)); } // sky light: full by ~7 deg sun, warm at dusk, a little left in civil twilight [game calibration]
    camPos[0] = camera.position.x; camPos[1] = camera.position.y; camPos[2] = camera.position.z;

    // LOD selection, then hand the wanted builds to the workers (or jobs); drop builds nobody wants any more
    camera.updateMatrixWorld(); frustum.setFromProjectionMatrix(projView.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    group.clear(); wanted.clear(); drawnNodes.length = 0; drawn = 0; inView = 0; deepest = 0; culled = 0;
    const lodOpts = { radius: R, minLevel: lod.minLevel, maxLevel: lod.maxLevel, split: lod.split * splitK };
    // below ~3 km (the in-page descent) tiles near the camera split deeper, so the globe reads like the game where they meet;
    // the draw cap below still shrinks the split when too many tiles are in view (per-tier caps and the governor unchanged)
    const nb = NEAR_SPLIT.k * smoothstep(NEAR_SPLIT.from, NEAR_SPLIT.full, alt), nearOpts = { ...lodOpts, split: lodOpts.split * (1 + nb) };
    const wants = (n: QNode) => { if (nb <= 0) return wantsSplit(n, camPos, lodOpts); const c = nodeCentre(n, R), dd = Math.hypot(camPos[0] - c[0], camPos[1] - c[1], camPos[2] - c[2]); return wantsSplit(n, camPos, dd < alt * NEAR_SPLIT.reach ? nearOpts : lodOpts); };
    splitSet = balancedTree(roots(), n => (n.level < lod.minLevel || inFrustum(n)) && wants(n), n => !hidden(n)).splits;
    for (const r of roots()) visit(r);
  stitch();
    // draw cap: shrink the split distance while more tiles than the tier's cap are in view, relax it back when under
    splitK = inView > lod.draw ? Math.max(.35, splitK * .97) : inView < lod.draw * .85 ? Math.min(1, splitK * 1.01) : splitK;
    for (const key of queued.keys()) if (!wanted.has(key)) queued.delete(key);
    if (!pool.length && !suspended) for (const key of inflight) if (!wanted.has(key)) { cancel(`globe:${key}`); inflight.delete(key); }
    for (const slot of pool) if (slot.busy && !wanted.has(slot.busy) && !tiles.has(slot.busy)) { slot.w.postMessage({ cancel: true, id: slot.id } as TileRequest); slot.busy = '~'; } // stale: the worker drops it at its next slice
    // adopt finished tiles: closest first, a few per frame within a budget
    if (ready.length) { const ta = performance.now(); for (const it of ready) { const c = it.t.centre; it.d = Math.hypot(c[0] - camPos[0], c[1] - camPos[1], c[2] - camPos[2]); } ready.sort((a, b) => a.d - b.d);
      let k = 0; while (ready.length && k < ADOPT.perFrame && performance.now() - ta < ADOPT.ms) { const it = ready.shift()!; accept(it.n, it.t); k++; } }
    dispatch();
    if (frame % 30 === 0 && tiles.size > lod.cache) { // evict least-recently-used tiles over the tier's cache cap (never the roots)
      const old = [...tiles.entries()].filter(([k, t]) => t.used < frame - 2 && k.split('/')[1] !== '0').sort((a, b) => a[1].used - b[1].used);
      for (const [key, t] of old.slice(0, tiles.size - lod.cache)) { releaseTileGeometry(t.mesh.geometry); tiles.delete(key); }
    }
  }
  /** Draw into `target` (null = the screen). Camera-relative: render from the origin (tile offsets were set from the
   *  double camera position in visit()). A target gets its own depth; the globe's log depth never meets the game's. */
  function renderTo(target: THREE.WebGLRenderTarget | null = null) {
    const viewH = target ? target.height : canvas.height;
    if (target && !ext && Math.abs(camera.aspect - target.width / target.height) > 1e-6) { camera.aspect = target.width / target.height; camera.updateProjectionMatrix(); }
    setLogDepthFar(camera.far);
    setGlobeDetail(camPos, alt, GLOBE_LOD[Math.min(GLOBE_LOD.length - 1, Math.max(0, worldTier()))].detail, seed); // tile.ts ground detail (uniforms)
    tR = performance.now(); camera.position.set(0, 0, 0); camera.updateMatrixWorld(); if (atmos) atmos.update(camera, camV.set(camPos[0], camPos[1], camPos[2]), sunDir, q.has('shot') ? 0 : worldSec(), viewH);
    const prev = renderer.getRenderTarget(); renderer.setRenderTarget(target); renderer.render(scene, camera); renderer.setRenderTarget(prev);
    camera.position.set(camPos[0], camPos[1], camPos[2]); camera.updateMatrixWorld();
  }
  /** Stats, governor (standalone only: in shared mode main feeds it once per frame), held-tier LOD, HUD. */
  function after() {
    const work = performance.now() - t0; if (bench && work > 40) console.log(`SPIKE ${work.toFixed(0)}ms alt ${alt.toFixed(0)} pre-render ${(tR - t0).toFixed(0)} render ${(performance.now() - tR).toFixed(0)} calls ${renderer.info.render.calls} accepted ${built}`); STATS.work.push(work); if (prevT) STATS.interval.push(t0 - prevT);
    if (!bench) { keep(STATS.work, 600); keep(STATS.interval, 600); keep(STATS.build, 2000); }
    fps = fps * .95 + (1000 / Math.max(1, t0 - (prevT || t0 - 16))) * .05; prevT = t0;
    const segWas = lod.segments; if (seamsDebug) material.userData.uSeg.value = lod.segments;
    if (own.governor && governFrame(work, undefined, dt * 1000)) { lod = globeLod(); applyRes(); }
    if (atmos && atmos.tier !== GOVERNOR.tier) atmos.setTier(GOVERNOR.tier); // resolution + atmosphere samples follow the tier now (cheap uniforms)
    if (lodTier !== worldTier()) { lodTier = worldTier(); lod = globeLod(); } // tile resolution/split/caps once the new tier has held (no rebuild per step)
    if (shot && lod.segments !== segWas) console.log(`SEGMENTS ${segWas} -> ${lod.segments} at frame ${frame} (tier ${GOVERNOR.tier}, world tier ${GOVERNOR.worldTier})`);
    if (hud && frame % 10 === 1) {
      const ll = toLatLon([dir.x, dir.y, dir.z]);
      hud.textContent = `Boreal planet · seed ${seed}${STAGES.on ? ' (staged)' : ''}\n` +
        `altitude ${alt >= 1e4 ? (alt / 1000).toFixed(0) + ' km' : alt.toFixed(0) + ' m'} · ground ${ground.toFixed(0)} m · ${(ll.lat * 180 / Math.PI).toFixed(2)}°, ${(ll.lon * 180 / Math.PI).toFixed(2)}°\n` +
        `tiles drawn ${drawn} (${inView} in view, cap ${lod.draw}${splitK < 1 ? ` · split ×${splitK.toFixed(2)}` : ''}) · culled ${culled} · cached ${tiles.size} · deepest L${deepest} · queued ${queued.size + inflight.size}\n` +
        `build (${mode()}) ${built} tiles (${cancelledN} cancelled, ${ready.length} waiting) · avg ${avg(STATS.build).toFixed(1)} ms · p95 ${pct(STATS.build, .95).toFixed(1)} ms · worst frame ${Math.max(0, ...STATS.work).toFixed(1)} ms\n` +
        `tier ${LADDER[GOVERNOR.tier].name}${GOVERNOR.auto ? ' (auto)' : ''} · ${lod.segments} seg · ${fps.toFixed(0)} fps · shaders ${STATS.compileMs >= 0 ? STATS.compileMs.toFixed(0) + ' ms async' : '…'} · work ${work.toFixed(1)} ms\n` +
        (overHome && alt < HANDOFF.hintAlt ? `over the home region: descend below ${HANDOFF.alt / 1000} km to enter the game\n` : '') + `drag orbit · right-drag / Q E turn · wheel / + - zoom · H home · G game`;
    }
  }
  /** One frame: update, draw into `target`, bookkeeping. */
  function step(target: THREE.WebGLRenderTarget | null = null) { if (down) return; update(); renderTo(target); after(); }
  function tick() { if (down) return; step(null); if (!down) requestAnimationFrame(tick); }
  // Compile every program (tiles + aerial perspective, sky shell + clouds) BEFORE the first frame, in parallel where the
  // driver has KHR_parallel_shader_compile (three's compileAsync polls it), so opening the globe never freezes on a compile.
  for (const t of tiles.values()) group.add(t.mesh);
  const tc = performance.now(), prevTarget = renderer.getRenderTarget();
  renderer.setRenderTarget(opts.target ?? null); // programs are built synchronously for the current target's tone mapping / colour space
  const compiled = renderer.compileAsync(scene, camera).catch(e => console.warn('globe: compileAsync failed, compiling on first draw', e))
    .finally(() => { STATS.compileMs = performance.now() - tc; group.clear(); });
  renderer.setRenderTarget(prevTarget);
  let started = false;
  /** Compile the programs for another target too (shared mode: the far-layer target AND the screen), behind a loading screen. */
  async function precompile(target: THREE.WebGLRenderTarget | null) {
    await compiled; for (const t of tiles.values()) group.add(t.mesh);
    const prevT = renderer.getRenderTarget(); renderer.setRenderTarget(target);
    const p = renderer.compileAsync(scene, camera).catch(e => console.warn('globe: precompile failed', e)); renderer.setRenderTarget(prevT);
    await p; group.clear();
  }
  return {
    planet, renderer, scene, camera, tiles, ownership: own, compiled, update, renderTo, after, step, dispose,
    /** standalone loop */
    start() { if (started) return; started = true; void compiled.then(() => requestAnimationFrame(tick)); },
    /** mode-scoped input: the globe's keys, wheel and drags act only while attached */
    attachInput(on: boolean) { inputOn = on; controls.enabled = on; if (!on) turnX = null; },
    get disposed() { return down; }, get altitude() { return alt; }, get ground() { return ground; }, precompile,
    /** shared band: fly the camera from outside (planet-frame metres, orientation, the game camera's fov/aspect); null = the
     *  globe's own controls take over again from where the camera is, keeping its heading */
    drive(cam: { position: THREE.Vector3; quaternion: THREE.Quaternion; fov: number; aspect: number } | null) {
      if (!cam && ext) { camera.position.copy(ext.position); lookAz = cameraAz(); }
      ext = cam;
    },
    /** over the playable region (game-local x, z), else null; descending = zooming in */
    get overHome() { return overHome; }, get descending() { return targetAlt < alt * .995; }, get headingYaw() { return headingYaw(); },
    zoomTo(a: number) { targetAlt = clamp(a, 40, R * 4); }, jumpTo(a: number) { alt = targetAlt = clamp(a, 40, R * 4); },
    /** shared mode: terminate the tile workers during gameplay (their memory goes) and restart them on demand */
    suspendWorkers() { if (suspended || !pool.length) return; suspended = true; for (const sl of pool) sl.w.terminate(); pool.length = 0; ids.clear(); inflight.clear(); },
    resumeWorkers() { if (!suspended || down) return; suspended = false; spawn(); },
    get workers() { return pool.length; },
    stats: () => ({ drawn, inView, cached: tiles.size, queued: queued.size + inflight.size, deepest, tier: GOVERNOR.tier, segments: lod.segments }),
  };
}
