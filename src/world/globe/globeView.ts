/**
 * Planet globe view (Grok Bot), milestone 1: `?view=globe`. Orbit → ground zoom over a cube-sphere with distance-based
 * quadtree LOD (cube.ts, tailored from SimonDev ProceduralTerrain_Part10, MIT), sampled from the seeded planet function
 * (planet.ts), whose home region IS the live game's terrain (core/world heightAt, same seed and stage switch).
 * Controls: drag = orbit (three OrbitControls, MIT, examples/jsm, unmodified; its zoom is replaced by a logarithmic altitude
 * zoom so the wheel feels the same from 20 000 km to 50 m), wheel/+/- = zoom, H = fly home, G or Esc = back to the game.
 * Governor: the shared quality ladder (core/quality) picks the tile resolution, split distance, depth and cache; frames feed
 * governFrame like the game; tile builds run through core/interest runJobs within INTEREST.budgetMs (rule 8).
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GOVERNOR, LADDER, ceiling, governFrame, tierForGpu } from '../../core/quality';
import { cachedProbe } from '../../core/probe';
import { RENDER_SETTINGS, createSettingsStore } from '../../core/renderSettings';
import { STAGES } from '../../core/stages/elevation';
import { heightAt, WORLD_SEED } from '../../core/world';
import { INTEREST, cancel, enqueue, pending, runJobs } from '../../core/interest';
import { smoothstep, clamp } from '../../proc/math';
import { children, roots, wantsSplit, centre as nodeCentre, type QNode } from './cube';
import { planetFor, toLatLon, PLANET, type Vec3 } from './planet';
import { tileJob, type TileOut } from './tile';
import { globeLod } from './lod';

interface Tile { mesh: THREE.Mesh; out: TileOut; used: number }

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
  const q = new URLSearchParams(location.search), shot = q.has('shot');
  if (q.has('stages')) STAGES.on = true;
  const seed = Number(q.get('seed')) || (STAGES.on ? STAGES.seed : WORLD_SEED);
  const planet = planetFor(seed, heightAt, STAGES.on ? 'staged' : 'layered'), R = PLANET.radius;

  // ---- renderer + governor start (same rules as render/photoreal: GPU string → start tier, probe cap from the cached probe)
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, logarithmicDepthBuffer: true, powerPreference: 'high-performance', preserveDrawingBuffer: shot });
  { const g = renderer.getContext(), dbg = g.getExtension('WEBGL_debug_renderer_info');
    GOVERNOR.gpu = String(dbg ? g.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER));
    const probe = cachedProbe(localStorage, GOVERNOR.gpu); if (probe) GOVERNOR.probeCap = probe.cap;
    if (GOVERNOR.auto) GOVERNOR.tier = Math.max(ceiling(), tierForGpu(GOVERNOR.gpu)); }
  if (q.has('tier')) { GOVERNOR.auto = false; GOVERNOR.tier = clamp(Number(q.get('tier')) || 0, 0, LADDER.length - 1); }
  let lod = globeLod();
  const applyRes = () => { renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5) * lod.resScale); renderer.setSize(innerWidth, innerHeight, false); };
  applyRes(); addEventListener('resize', () => { applyRes(); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const SPACE = new THREE.Color(0x02040a), SKY = new THREE.Color(0x8fb4d9);
  const scene = new THREE.Scene(); scene.background = SPACE.clone();
  const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 1, 1e9);
  // Sun: fixed, from the home side so the playable region is lit [game calibration; the world clock drives it in a later step]
  const sun = new THREE.DirectionalLight(0xfff4e0, 3.2), sunDir = new THREE.Vector3(...planet.home).add(new THREE.Vector3(...planet.east).multiplyScalar(.6)).add(new THREE.Vector3(0, .5, 0)).normalize();
  sun.position.copy(sunDir); scene.add(sun, new THREE.HemisphereLight(0x9fb8d8, 0x202018, .35));
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .92, metalness: 0 });
  const group = new THREE.Group(); scene.add(group);

  // ---- camera: OrbitControls rotates around the planet centre; altitude is ours (log zoom), tilt toward the horizon near ground
  const controls = new OrbitControls(camera, canvas); controls.enableZoom = false; controls.enablePan = false; controls.enableDamping = true; controls.dampingFactor = .12;
  const startAlt = Number(q.get('alt')) || R * 2.2;
  const start = q.has('at') ? (() => { const [x, z] = (q.get('at') ?? '0,0').split(',').map(Number); return planet.fromLocal(x || 0, z || 0); })() : planet.home;
  let alt = startAlt, targetAlt = startAlt, ground = 0;
  camera.position.set(...start).multiplyScalar(R + alt);
  const zoom = (f: number) => { targetAlt = clamp(targetAlt * f, 40, R * 4); };
  canvas.addEventListener('wheel', e => { e.preventDefault(); zoom(Math.exp(e.deltaY * .0016)); }, { passive: false });
  addEventListener('keydown', e => {
    if (e.key === '+' || e.key === '=') zoom(.7); else if (e.key === '-') zoom(1 / .7);
    else if (e.key === 'h' || e.key === 'H') { flyHome = 1; }
    else if (e.key === 'g' || e.key === 'G' || e.key === 'Escape') { q.delete('view'); location.search = q.toString(); }
  });
  let flyHome = 0;

  // ---- tiles: cache by node key, built by budgeted jobs, drawn from the deepest READY level (no holes while refining)
  const tiles = new Map<string, Tile>(), jobKeys = new Set<string>(); let frame = 0, built = 0, buildMs = 0;
  const camPos: Vec3 = [0, 0, 0];
  const lodOpts = () => ({ radius: R, minLevel: lod.minLevel, maxLevel: lod.maxLevel, split: lod.split });
  function want(n: QNode) {
    const t = tiles.get(n.key); if (t) { t.used = frame; return true; }
    if (!pending(n.key)) {
      jobKeys.add(n.key);
      const c = nodeCentre(n, R), dist = Math.hypot(camPos[0] - c[0], camPos[1] - c[1], camPos[2] - c[2]);
      enqueue(n.key, n.level * 1e-3 + dist / R, tileJob(n, planet, lod.segments), out => {
        const mesh = new THREE.Mesh(out.geometry, material); mesh.position.set(...out.centre); mesh.matrixAutoUpdate = false; mesh.updateMatrix();
        tiles.set(n.key, { mesh, out, used: frame }); built++; buildMs += out.ms; jobKeys.delete(n.key);
      });
    }
    wanted.add(n.key); return false;
  }
  const wanted = new Set<string>(); let drawn = 0, deepest = 0;
  function visit(n: QNode) {
    const ready = want(n);
    if (wantsSplit(n, camPos, lodOpts())) {
      const kids = children(n), ok = kids.map(want).every(Boolean);
      if (ok) { for (const k of kids) visit(k); return; }
    }
    if (ready) { group.add(tiles.get(n.key)!.mesh); drawn++; deepest = Math.max(deepest, n.level); }
  }
  // roots first, synchronously, so the planet is never empty
  for (const r of roots()) { want(r); } runJobs(1e9);

  // ---- loop
  let last = performance.now(), fps = 0;
  function tick() {
    const t0 = performance.now(), dt = Math.min(.1, (t0 - last) / 1000); last = t0; frame++;
    // altitude above the ground under the camera (smoothed in log space), rotate speed scaled to altitude
    const dir = camera.position.clone().normalize(), s = planet.sampleSurface([dir.x, dir.y, dir.z]); ground = Math.max(s.h, s.water);
    if (flyHome) { const h = new THREE.Vector3(...planet.home), k = 1 - Math.exp(-dt * 2.5); dir.lerp(h, k).normalize(); if (dir.angleTo(h) < 1e-5) flyHome = 0; }
    alt = Math.exp(Math.log(alt) + (Math.log(targetAlt) - Math.log(alt)) * (1 - Math.exp(-dt * 7)));
    controls.rotateSpeed = clamp(alt / R * .6, 2e-6, 1);
    camera.position.copy(dir).multiplyScalar(R + ground + alt);
    controls.update();
    camera.position.setLength(R + ground + alt);
    camera.lookAt(0, 0, 0);
    const tilt = (Math.PI / 2 - .12) * (1 - smoothstep(3e3, 3e5, alt)); camera.rotateX(tilt); // look toward the horizon near the ground [game calibration]
    camera.near = clamp(alt * .02, .5, 1e5); camera.far = Math.sqrt((R + ground + alt) ** 2 - R * R) + R * 2; camera.updateProjectionMatrix();
    (scene.background as THREE.Color).copy(SPACE).lerp(SKY, 1 - smoothstep(2e4, 1.2e5, alt)); // daytime sky below ~100 km [game calibration; no scattering yet]
    camPos[0] = camera.position.x; camPos[1] = camera.position.y; camPos[2] = camera.position.z;

    // LOD selection + jobs
    const select = () => { group.clear(); wanted.clear(); drawn = 0; deepest = 0; for (const r of roots()) visit(r); };
    select(); runJobs(INTEREST.budgetMs);
    if (shot && jobKeys.size) { runJobs(1e9); select(); } // ?shot=1: finish one whole level per frame (headless screenshots only)
    // cancel jobs nobody wants any more; evict least-recently-used tiles over the tier's cache cap
    if (frame % 30 === 0) {
      if (tiles.size > lod.cache) { const old = [...tiles.entries()].filter(([, t]) => t.used < frame - 2).sort((a, b) => a[1].used - b[1].used);
        for (const [key, t] of old.slice(0, tiles.size - lod.cache)) { t.out.geometry.dispose(); tiles.delete(key); } }
    }
    renderer.render(scene, camera);
    const work = performance.now() - t0; fps = fps * .95 + (1000 / Math.max(1, t0 - (prevT || t0 - 16))) * .05; prevT = t0;
    if (governFrame(work, undefined, dt * 1000)) { lod = globeLod(); applyRes(); }
    if (frame % 10 === 1 || shot) {
      const ll = toLatLon([dir.x, dir.y, dir.z]);
      hud.textContent = `Boreal planet · seed ${seed}${STAGES.on ? ' (staged)' : ''}\n` +
        `altitude ${alt >= 1e4 ? (alt / 1000).toFixed(0) + ' km' : alt.toFixed(0) + ' m'} · ground ${ground.toFixed(0)} m · ${(ll.lat * 180 / Math.PI).toFixed(2)}°, ${(ll.lon * 180 / Math.PI).toFixed(2)}°\n` +
        `tiles drawn ${drawn} · cached ${tiles.size} · deepest L${deepest} · built ${built} (avg latency ${built ? (buildMs / built).toFixed(0) : 0} ms)\n` +
        `tier ${LADDER[GOVERNOR.tier].name}${GOVERNOR.auto ? ' (auto)' : ''} · ${lod.segments} seg · ${fps.toFixed(0)} fps · work ${work.toFixed(1)} ms\n` +
        `drag orbit · wheel / + - zoom · H home · G game`;
    }
    for (const key of jobKeys) if (!wanted.has(key)) { cancel(key); jobKeys.delete(key); } // camera moved on: drop stale builds
    requestAnimationFrame(tick);
  }
  let prevT = 0;
  requestAnimationFrame(tick);
  return { planet, renderer, scene, camera, tiles };
}
