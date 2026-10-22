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
import { setHareDay, HARE_SKIN, POSES } from '../src/animals/hare';
import { SWING, POSE_SHAPES } from '../src/animals/locomotion/bounding';
import { posePlausibility } from '../src/animals/locomotion/boundScore';
const q = new URLSearchParams(location.search), wolfAt = Number(q.get('wolfAt') ?? 2.1), fps = Number(q.get('fps') ?? 6), dur = Number(q.get('dur') ?? 5), seed = q.get('seed') ?? 'strip';
// run 9 (gather outline grid): ?chest=<s> deepens the chest rings downward (ry x 1 + (s - 1) x chest weight, top kept; ?chestw=<w> narrows rx the same way);
// ?headsize=<s> scales the head rings (before the model is built)
if (q.get('chest')) { const s = Number(q.get('chest')), wx = Number(q.get('chestw') ?? 1); for (const r of HARE_SKIN.trunk) { const c = (r as { chest?: number }).chest ?? 0, d = r.ry * (s - 1) * c; r.ry += d; r.y -= d; r.rx *= 1 + (wx - 1) * c; } }
if (q.get('runears')) POSES.run[4] = Number(q.get('runears'));
if (q.get('pose')) for (const e of q.get('pose')!.split(';')) { const [k, i, v] = e.split(':'); POSES[k][Number(i)] = Number(v); } // run 11 grid hook: pose=run:2:-.2;head-down:4:1.2
if (q.get('headsize')) { const s = Number(q.get('headsize')); for (const r of HARE_SKIN.head) { r.rx *= s; r.ry *= s; r.z *= s; r.y *= s; } }
const CW = 424, CH = 240, COLS = 6, N = Math.round(fps * dur), ROWS = Math.ceil(N / COLS), W = CW * COLS, H = CH * ROWS;
const canvas = document.getElementById('c') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true }); renderer.setPixelRatio(1); renderer.setSize(W, H); renderer.setScissorTest(true);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x24331f); scene.fog = new THREE.Fog(0x24331f, 8, 30);
const hemi = new THREE.HemisphereLight(0xdfe8ff, 0x405030, 2.2); scene.add(hemi); const sun = new THREE.DirectionalLight(0xfff1d8, 2.6); sun.position.set(3, 8, 6); scene.add(sun);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 40), new THREE.MeshStandardMaterial({ color: 0x5f8a3e, roughness: 1 })); ground.rotation.x = -Math.PI / 2; scene.add(ground);
const leaf = new THREE.InstancedMesh(new THREE.CircleGeometry(.03, 6).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x3f7a2a }), 4000);
const r = stream(7, 'strip-clover'), m4 = new THREE.Matrix4(); for (let i = 0; i < 4000; i++) { m4.makeTranslation((r() - .5) * 30, .01 + r() * .03, (r() - .5) * 8 - 1); leaf.setMatrixAt(i, m4); } scene.add(leaf);
for (let i = 0; i < 26; i++) { const t = new THREE.Mesh(new THREE.CylinderGeometry(.12, .16, 9, 6), new THREE.MeshStandardMaterial({ color: 0x2b2418 })); t.position.set(-14 + i * 1.2 + r(), 4.5, -6 - r() * 3); scene.add(t); }
// T-0028: ?day=<day of year> picks the coat (the hare's rig skin (HARE_SKIN) moult), ?snow=1 a snow ground for the winter gate
if (q.get('day')) setHareDay(Number(q.get('day')));
if (q.get('snow')) { scene.background = new THREE.Color(0xc9d2da); scene.fog = new THREE.Fog(0xc9d2da, 8, 30); (ground.material as THREE.MeshStandardMaterial).color.set(0xf4f6f8); leaf.visible = false; hemi.groundColor.set(0xdfe4ea); } // snow bounces light up onto the belly
// T-0028 look metric: ?matte=1 = flat magenta background, no ground / clover / trees / fog / labels (silhouette + coat masks)
const MATTE = !!q.get('matte');
if (MATTE) { scene.background = new THREE.Color(0xff00ff); scene.fog = null; scene.children.filter(o => o instanceof THREE.Mesh || o instanceof THREE.InstancedMesh).forEach(o => { o.visible = false; }); }
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
// run 7 (T-0009): ?stride=<m/s> = a bound PHASE sheet instead of the timed sequence: the hare runs at that steady speed (flee
// action) for 2 s, then the N cells sample ONE stride evenly (cell k at phase k / N), so lookscore can find the gathered,
// push-off and extended phases however the 6 fps sequence aliases them
const STRIDE = Number(q.get('stride') ?? 0);
// run 7: ?view=end = the tracking camera END-ON from behind (on the hare's path, the wolf's side), as the wolf sees a fleeing hare
const END = q.get('view') === 'end';
// run 8 (lookscore v1.3): ?phase0=<0..1> shifts the stride sheet's first cell by that share of one cell (noise runs);
// ?fold=<x> = SWING.fold.hind for a known-mismatch render (Gait Builder's foot-over-back 1.5); every cell logs the rig's
// anatomical plausibility (boundScore posePlausibility), read by lookscore v1.3 from <pre id="strip-log"> or, with ?log=1,
// from pageResult (tools/strip-shot.mjs prints it)
if (q.get('fold')) SWING.fold.hind = Number(q.get('fold'));
// run 9: ?graze=pitch,drop,ahead overrides the rig's graze-crouch shape (grid search against the graze references)
if (q.get('graze')) { const [p, d, a] = q.get('graze')!.split(',').map(Number); POSE_SHAPES['graze-crouch'] = { pitch: p, drop: d, foreLift: false, ahead: a }; }
const plaus = () => { const f = hare.frame, sk = hare.rig?.skeleton; if (!f || !sk) return { above: null, joint: 0, ok: true };
  const p = posePlausibility(sk, f); return { above: +(p.soleOverHip * 1000).toFixed(1), joint: +p.jointOut.toFixed(2), ok: p.ok }; };
if (STRIDE > 0) { a.action = 'flee'; a.speed = STRIDE; a.heading = -Math.PI / 2; for (; t < 2; t += dt) { a.x += STRIDE * dt; poseHare(hare, a, dt, t, 0); } }
const strideDt = STRIDE > 0 ? 1 / (hare.frame!.plan.hz * N) : 0;
if (STRIDE > 0 && Number(q.get('phase0') ?? 0) > 0) { const s0 = Number(q.get('phase0')) * strideDt, sub = Math.max(1, Math.round(s0 / dt)), h = s0 / sub; for (let k = 0; k < sub; k++) { a.x += STRIDE * h; poseHare(hare, a, h, t, 0); t += h; } }
for (let f = 0; f < N && STRIDE > 0; f++) {
  const sub = Math.max(1, Math.round(strideDt / dt)), h = strideDt / sub; for (let k = 0; k < sub; k++) { a.x += STRIDE * h; poseHare(hare, a, h, t, 0); t += h; }
  const col = f % COLS, row = Math.floor(f / COLS), x = col * CW, y = H - (row + 1) * CH;
  const dz = Number(q.get('track') ?? 2.2); if (END) cam.position.set(a.x - dz, .25, a.z); else cam.position.set(a.x, .25, a.z + dz); cam.lookAt(a.x, .15, a.z);
  renderer.setViewport(x, y, CW, CH); renderer.setScissor(x, y, CW, CH); renderer.render(scene, cam);
  log.push({ t: +t.toFixed(3), action: 'flee', x: +a.x.toFixed(3), speed: STRIDE, phase: +hare.frame!.stride.toFixed(3), ...plaus() });
}
for (let f = 0; f < N && !(STRIDE > 0); f++) {
  const at = f / fps;
  while (t < at - 1e-9) { if (t >= wolfAt) { wolf.speed = 1.6; wolf.x += 1.6 * dt; } stepAgent(a, world(), dt); poseHare(hare, a, dt, t, 0); t += dt; }
  const col = f % COLS, row = Math.floor(f / COLS), x = col * CW, y = H - (row + 1) * CH;
  if (q.get('track')) { const dz = Number(q.get('track')); if (END) cam.position.set(a.x - dz, .25, a.z); else cam.position.set(a.x, .25, a.z + dz); cam.lookAt(a.x, .15, a.z); }
  renderer.setViewport(x, y, CW, CH); renderer.setScissor(x, y, CW, CH); renderer.render(scene, cam);
  const d = document.createElement('div'); d.className = 'c'; d.style.left = `${x + 4}px`; d.style.top = `${row * CH + 3}px`; d.textContent = `${at.toFixed(2)}s ${a.action}`; if (!MATTE) labels.append(d);
  log.push({ t: +at.toFixed(3), action: a.action, x: +a.x.toFixed(3), speed: +a.speed.toFixed(2), phase: +hare.hopPhase.toFixed(3), ...plaus() }); next++;
}
(globalThis as { stripLog?: unknown; pageResult?: unknown }).stripLog = log; (globalThis as { pageResult?: unknown }).pageResult = q.get('log') ? JSON.stringify(log) : log.map(l => (l as { action: string }).action).join(',');
{ const pre = document.createElement('pre'); pre.id = 'strip-log'; pre.style.display = 'none'; pre.textContent = JSON.stringify(log); document.body.append(pre); } document.title = 'ready';