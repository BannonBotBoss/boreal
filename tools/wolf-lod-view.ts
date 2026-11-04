/**
 * Wolf LOD evidence page (#162 item 2): the real animalPicture path with Meshy wolves on heightAt terrain.
 * /tools/wolf-lod-view.html?shot=ladder|gait|mid   Driven by window.__step(dt) (virtual clock), so frames are deterministic.
 */
import * as THREE from 'three';
import { createAnimalPicture, type PictureBody } from '../src/render/animalPicture';
import { loadAnimalBuffer } from '../src/render/animalModels';
import { gaitFor, WOLF_LEGS, type Motion } from '../src/core/animalBehavior';
import { heightAt } from '../src/core/world';
import { REBIND } from '../src/render/gaitLod';
REBIND.on = q0('rebind') !== '0';
function q0(k: string) { return new URLSearchParams(location.search).get(k); }

const realNow = performance.now.bind(performance);
let virt = 0; performance.now = () => virt;
const q = new URLSearchParams(location.search), shot = q.get('shot') ?? 'gait';
const W = 1280, H = 720;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H); renderer.setPixelRatio(1); document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x9fb4c4); scene.fog = new THREE.Fog(0x9fb4c4, 120, 400);
scene.add(new THREE.HemisphereLight(0xdde8ff, 0x4a3b2a, 1.4));
const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.position.set(30, 60, 20); scene.add(sun);
const camera = new THREE.PerspectiveCamera(shot === 'mid' ? 12 : 50, W / H, 0.1, 2000);

// terrain: pick a dry spot, then a heightAt grid around it
let ox = 0, oz = 0;
for (let i = 0; i < 400; i++) { const x = (i % 20) * 37 - 300, z = Math.floor(i / 20) * 37 - 300, h = heightAt(x, z); if (Number.isFinite(h) && h > 2) { ox = x; oz = z; break; } }
const ground = (x: number, z: number) => { const h = heightAt(x, z); return Number.isFinite(h) ? h : 0; };
const S = 260, N = 260, geo = new THREE.PlaneGeometry(S, S, N, N); geo.rotateX(-Math.PI / 2);
const gp = geo.getAttribute('position');
for (let i = 0; i < gp.count; i++) gp.setY(i, ground(gp.getX(i) + ox, gp.getZ(i) + oz));
geo.translate(ox, 0, oz); geo.computeVertexNormals();
const tex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d')!; g.fillStyle = '#6f7d4e'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#5d6a40'; g.fillRect(0, 0, 32, 32); g.fillRect(32, 32, 32, 32); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(S / 1, S / 1); t.magFilter = THREE.NearestFilter; return t; })();
scene.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tex })));

const picture = createAnimalPicture(scene);
type Wolf = { body: PictureBody; s: number; lane: number; speed: () => number; motion: () => Motion };
const wolves: Wolf[] = [];
const hud = document.getElementById('hud')!;
let t = 0;
const speedAt = (tt: number) => tt < 4 ? 1.2 : tt < 8 ? 2.6 : 7;
function addWolf(key: string, lane: number, s0: number, speed: () => number) {
  const root = new THREE.Group();
  wolves.push({ body: { key, species: 'Gray Wolf', x: 0, y: 0, z: 0, yaw: 0, moving: true, motion: 'walk', phase: 0, speed: 1.2, root }, s: s0, lane, speed, motion: () => 'run' });
}
if (shot === 'ladder') for (const [i, d] of [8, 24, 40, 70, 120].entries()) addWolf('w' + i, d, 0, () => 2.6);
else if (shot === 'mid') { addWolf('near', 9, 0, () => 2.6); addWolf('mid', 40, 0, () => 2.6); }
else addWolf('gait', 4.5, 0, () => speedAt(t));

const stride = (v: number) => gaitFor(v < 2 ? 'walk' : 'run', v, WOLF_LEGS)!.cycle;
const K = 0.74 / 0.82; // gaitScale of the Meshy wolf (meshySkin legsForSpecies: shoulder / WOLF_LEG_SHOULDER) [read from the bench: 0.9]
function place(w: Wolf, dt: number) {
  const v = w.speed(), b = w.body;
  w.s += v * K * dt;
  b.phase = ((b.phase ?? 0) + v / stride(v) * dt) % 1; b.speed = v; b.motion = v < 2 ? 'walk' : 'run';
  // walk along +x across the view, lane = distance from the camera line
  b.x = ox + w.s - (shot === 'gait' ? 0 : 0); b.z = oz - w.lane; b.y = ground(b.x, b.z); b.yaw = -Math.PI / 2;
}
(window as unknown as { __step: (dt: number) => unknown }).__step = (dt: number) => {
  virt += dt * 1000; t += dt;
  for (const w of wolves) place(w, dt);
  const lead = wolves[0].body;
  if (shot === 'gait') { camera.position.set(lead.x + 0.6, ground(lead.x, oz) + 0.9, oz + 0.5); camera.lookAt(lead.x, lead.y + 0.45, lead.z); }
  else if (shot === 'mid') { const m = wolves[1].body; camera.position.set(ox + wolves[0].s, ground(ox, oz) + 1.7, oz + 0.5); camera.lookAt(m.x, m.y + 0.4, m.z); }
  else { camera.position.set(ox + wolves[0].s - 18, ground(ox, oz) + 2.5, oz + 6); camera.lookAt(ox + wolves[0].s, ground(ox, oz) + 0.5, oz - 40); }
  camera.updateMatrixWorld();
  const t0 = realNow();
  const weights = picture.sync(wolves.map(w => w.body), camera, H);
  const syncUs = (realNow() - t0) * 1000;
  renderer.render(scene, camera);
  const st = (globalThis as { borealPicture?: () => unknown }).borealPicture?.() as { wolves?: unknown } | undefined;
  const info = { syncUs: +syncUs.toFixed(1), t: +t.toFixed(2), speed: lead.speed, gait: gaitFor(lead.motion!, lead.speed!, WOLF_LEGS)?.name, phase: +(lead.phase ?? 0).toFixed(3), wolves: st?.wolves, weights: weights.map(x => ({ full: +x.full.toFixed(2), low: +x.low.toFixed(2), speck: +x.speck.toFixed(2) })) };
  hud.textContent = `${shot}  t ${info.t}s  ${info.gait} ${info.speed} m/s  ` + JSON.stringify(info.wolves);
  const dbg = scene.children.filter(o => o.userData.wolfLod && o.visible).map(o => { const h = new THREE.Vector3(); o.getObjectByName('head')!.getWorldPosition(h); return { lvl: o.userData.wolfLod, ry: +o.rotation.y.toFixed(2), head: [+(h.x - o.position.x).toFixed(2), +(h.z - o.position.z).toFixed(2)] }; });
  return { ...info, dbg };
};
(async () => {
  const buf = await (await fetch('/models/animals/gray-wolf.glb')).arrayBuffer();
  await loadAnimalBuffer(buf, 'Gray Wolf');
  (window as unknown as { __ready: boolean }).__ready = true;
})();