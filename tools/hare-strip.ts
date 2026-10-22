/**
 * Dev tool (Grok Bot, T-0009 animation gate): the game's hare (createHareModel + poseHare, the same code the game runs) driven
 * by the REAL shared pipeline (stepAgent, HARE_AGENT) on a clover patch, filmed by a locked side-on camera 6 m away like the
 * reference video (refs/hare/graze-alert-flight/attempt4-video.mp4), sampled at the reference's 6 fps over 5 s, as a 6 x 5
 * sheet the same size as attempt4-video-frames-6fps.jpg. A wolf stands 20 m to the left (downwind of the hare) and starts walking at ?wolfAt=2.1 s.
 */
import * as THREE from 'three';
import { createHareModel, poseHare } from '../src/animals/hare';
import { createAgent, stepAgent, type FoodSource, type AgentWorld } from '../src/core/agent/pipeline';
import { HARE_AGENT } from '../src/core/agent/species';
import { CLOVER, CLOVER_WHY, grazeTransaction, type CloverPatch } from '../src/core/clover';
import { stream } from '../src/proc/rng';
import { setHareDay } from '../src/animals/hare';
const q = new URLSearchParams(location.search), wolfAt = Number(q.get('wolfAt') ?? 2.1), fps = Number(q.get('fps') ?? 6), dur = Number(q.get('dur') ?? 5), seed = q.get('seed') ?? 'strip';
const CW = 424, CH = 240, COLS = 6, N = Math.round(fps * dur), ROWS = Math.ceil(N / COLS), W = CW * COLS, H = CH * ROWS;
const canvas = document.getElementById('c') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true }); renderer.setPixelRatio(1); renderer.setSize(W, H); renderer.setScissorTest(true);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x24331f); scene.fog = new THREE.Fog(0x24331f, 8, 30);
scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x405030, 2.2)); const sun = new THREE.DirectionalLight(0xfff1d8, 2.6); sun.position.set(3, 8, 6); scene.add(sun);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 40), new THREE.MeshStandardMaterial({ color: 0x5f8a3e, roughness: 1 })); ground.rotation.x = -Math.PI / 2; scene.add(ground);
const leaf = new THREE.InstancedMesh(new THREE.CircleGeometry(.03, 6).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x3f7a2a }), 4000);
const r = stream(7, 'strip-clover'), m4 = new THREE.Matrix4(); for (let i = 0; i < 4000; i++) { m4.makeTranslation((r() - .5) * 30, .01 + r() * .03, (r() - .5) * 8 - 1); leaf.setMatrixAt(i, m4); } scene.add(leaf);
for (let i = 0; i < 26; i++) { const t = new THREE.Mesh(new THREE.CylinderGeometry(.12, .16, 9, 6), new THREE.MeshStandardMaterial({ color: 0x2b2418 })); t.position.set(-14 + i * 1.2 + r(), 4.5, -6 - r() * 3); scene.add(t); }
// T-0028: ?day=<day of year> picks the coat (the hare's rig skin (HARE_SKIN) moult), ?snow=1 a snow ground for the winter gate
if (q.get('day')) setHareDay(Number(q.get('day')));
if (q.get('snow')) { scene.background = new THREE.Color(0xc9d2da); scene.fog = new THREE.Fog(0xc9d2da, 8, 30); (ground.material as THREE.MeshStandardMaterial).color.set(0xf4f6f8); leaf.visible = false; }
const hare = { ...createHareModel(), hopPhase: 0, id: 1 }; scene.add(hare.root);
const max = Math.round(Math.PI * CLOVER.unitsPerM2); const patch: CloverPatch = { key: 'clover:strip', x: -1.2, z: 0, r: 1, light: 1, max, units: max, stolon: 50 * Math.PI, why: CLOVER_WHY.map(w => ({ ...w })) };
const src: FoodSource = { at: (x, z, pad = 0) => Math.hypot(patch.x - x, patch.z - z) < patch.r + pad && patch.units > 0 ? patch : undefined,
  nearest: (x, z, range, ex) => patch.key !== ex && Math.hypot(patch.x - x, patch.z - z) < range && patch.units > 0 ? patch : undefined, eat: (_k, u, by) => grazeTransaction(patch, u, by) };
const a = createAgent(HARE_AGENT, 'hare:strip', -1.2, 0, stream(1, seed), { energy: 60, relaxation: 95, heading: -Math.PI / 2 }); // facing +x? heading -pi/2 -> see below
const wolf = { key: 'player', kind: 'wolf', x: Number(q.get('wolfX') ?? -20), z: 0, speed: 0 };
const world = (): AgentWorld => ({ others: [wolf], wind: { x: -1, z: 0 }, daylight: 1, food: { clover: src } });
const cam = new THREE.PerspectiveCamera(Number(q.get('fov') ?? 16), CW / CH, .1, 80); cam.position.set(0, .45, 6); cam.lookAt(0, .2, 0);
const labels = document.getElementById('labels')!, log: unknown[] = [];
let t = 0, next = 0; const dt = 1 / 120;
for (let f = 0; f < N; f++) {
  const at = f / fps;
  while (t < at - 1e-9) { if (t >= wolfAt) { wolf.speed = 1.6; wolf.x += 1.6 * dt; } stepAgent(a, world(), dt); poseHare(hare, a, dt, t, 0); t += dt; }
  const col = f % COLS, row = Math.floor(f / COLS), x = col * CW, y = H - (row + 1) * CH;
  if (q.get('track')) { const dz = Number(q.get('track')); cam.position.set(a.x, .25, a.z + dz); cam.lookAt(a.x, .15, a.z); }
  renderer.setViewport(x, y, CW, CH); renderer.setScissor(x, y, CW, CH); renderer.render(scene, cam);
  const d = document.createElement('div'); d.className = 'c'; d.style.left = `${x + 4}px`; d.style.top = `${row * CH + 3}px`; d.textContent = `${at.toFixed(2)}s ${a.action}`; labels.append(d);
  log.push({ t: +at.toFixed(3), action: a.action, x: +a.x.toFixed(3), speed: +a.speed.toFixed(2), phase: +hare.hopPhase.toFixed(3) }); next++;
}
(globalThis as { stripLog?: unknown }).stripLog = log; document.title = 'ready';