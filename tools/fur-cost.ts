// Fur draw-cost bench (Grok Bot, T-0028 draw-cost row): n copies of the player wolf (render/playerWolf, 13000 cards) or the
// procedural hare (render/hareMesh) in view, each frame rendered and synced (1-px readPixels, so vsync and rAF don't pace it),
// with the fur on and off. ?model=wolf|hare&n=5&frames=240&day=227. Result in globalThis.pageResult (tools/strip-shot.mjs prints it).
import * as THREE from 'three';
import { createPlayerWolf } from '../src/render/playerWolf';
import { createHareModel } from '../src/animals/hare';
import { setHareDay, hareCoatState } from '../src/render/hareMesh';
const q = new URLSearchParams(location.search), model = q.get('model') ?? 'wolf', n = Number(q.get('n') ?? 1), frames = Number(q.get('frames') ?? 240);
const W = 1280, H = 800, canvas = document.getElementById('c') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true }); renderer.setPixelRatio(1); renderer.setSize(W, H);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x9fb0a0);
scene.add(new THREE.HemisphereLight(0xf1f5ef, 0x5a6650, 2)); const sun = new THREE.DirectionalLight(0xfff1dc, 2.6); sun.position.set(2, 4, 1.5); scene.add(sun);
if (model === 'hare') setHareDay(Number(q.get('day') ?? 227));
const furs: THREE.Object3D[] = [], span = model === 'wolf' ? 1.8 : .6;
for (let i = 0; i < n; i++) {
  const root = model === 'wolf' ? createPlayerWolf(1400 + i).root : createHareModel().root;
  root.position.set((i - (n - 1) / 2) * span, 0, 0); root.rotation.y = Math.PI / 2; scene.add(root);
  root.traverse(o => { if (o.name === 'fur') furs.push(o); });
}
const cam = new THREE.PerspectiveCamera(30, W / H, .05, 100); const dist = Math.max(model === 'wolf' ? 4 : 1.4, n * span * 1.1); cam.position.set(0, dist * .25, dist); cam.lookAt(0, model === 'wolf' ? .5 : .15, 0);
const gl = renderer.getContext(), px = new Uint8Array(4);
const run = (fur: boolean) => { furs.forEach(f => f.visible = fur); for (let i = 0; i < 20; i++) renderer.render(scene, cam); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  const t0 = performance.now(); for (let i = 0; i < frames; i++) { renderer.render(scene, cam); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); } return (performance.now() - t0) / frames; };
const cards = furs.reduce((s, f) => s + ((f as THREE.Mesh).geometry.index!.count / 9), 0);
run(true); run(false); // warm-up: shader compiles and uploads for both modes stay out of the timings
const off1 = run(false), on1 = run(true), off2 = run(false), on2 = run(true);
const info = renderer.info.render, dbg = gl.getExtension('WEBGL_debug_renderer_info');
(globalThis as { pageResult?: unknown }).pageResult = { model, n, cards, msFurOff: +((off1 + off2) / 2).toFixed(3), msFurOn: +((on1 + on2) / 2).toFixed(3), furMs: +((on1 + on2 - off1 - off2) / 2).toFixed(3),
  triangles: info.triangles, gpu: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : '?', coat: model === 'hare' ? hareCoatState() : undefined };
document.title = 'ready';
