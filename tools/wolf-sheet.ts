// Picture of the continuous-skin, furred wolf: three poses, two head close-ups, and three coats.
import * as THREE from 'three';
import { createPlayerWolf } from '../src/render/playerWolf';
const CW = 520, CH = 400, W = CW * 3, H = CH * 2;
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('c') as HTMLCanvasElement, antialias: true });
renderer.setPixelRatio(1); renderer.setSize(W, H); renderer.setScissorTest(true);
type Wolf = ReturnType<typeof createPlayerWolf>;
const make = (seed: number, setup: (w: Wolf) => void) => { const w = createPlayerWolf(seed); setup(w); return w.root; };
const cells: Array<{ label: string; roots: THREE.Object3D[]; eye: [number, number, number]; target: [number, number, number]; fov?: number }> = [
  { label: 'Standing', roots: [make(1400, w => w.animate(1, false, undefined, 0))], eye: [3.4, .85, -.1], target: [0, .5, -.1] },
  { label: 'Walking', roots: [make(1400, w => { w.brain.motion = 'walk'; w.brain.gaitSpeed = 1.6; w.brain.phase = .3; w.animate(1, true, undefined, 0); })], eye: [2.3, 1.1, -2.2], target: [0, .5, 0] },
  { label: 'Galloping', roots: [make(1400, w => { w.brain.motion = 'run'; w.brain.gaitSpeed = 7; w.brain.phase = .35; w.animate(1, true, undefined, 0, 'run'); })], eye: [3.4, .9, .4], target: [0, .6, 0] },
  { label: 'Head, closed', roots: [make(1400, w => w.animate(1, false, undefined, 0))], eye: [1.1, 1.1, -1.5], target: [0, .85, -.7], fov: 30 },
  { label: 'Head, jaw open (hinged at rear skull)', roots: [make(1400, w => w.animate(1, false, 'speak', Math.PI / 44))], eye: [1.1, 1.1, -1.5], target: [0, .85, -.7], fov: 30 },
  { label: 'Grey, tan and black coats', roots: [1, 2, 3].map((seed, i) => { const r = make([1400, 1, 18][i], w => w.animate(1, false, undefined, 0)); r.position.x = (i - 1) * 1.4; return r; }), eye: [0, 1.1, 4.3], target: [0, .5, 0] },
];
cells.forEach((cell, n) => {
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0xcfd8cf); scene.fog = new THREE.Fog(0xcfd8cf, 20, 60);
  scene.add(new THREE.HemisphereLight(0xf1f5dd, 0x526753, 2.3));
  const sun = new THREE.DirectionalLight(0xffebc3, 3); sun.position.set(3, 6, 2); scene.add(sun);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial({ color: 0x7f9265, roughness: 1 })); ground.rotation.x = -Math.PI / 2; scene.add(ground);
  cell.roots.forEach(r => scene.add(r));
  const cam = new THREE.PerspectiveCamera(cell.fov ?? 34, CW / CH, .05, 100); cam.position.set(...cell.eye); cam.lookAt(...cell.target);
  const x = (n % 3) * CW, y = H - (Math.floor(n / 3) + 1) * CH; renderer.setViewport(x, y, CW, CH); renderer.setScissor(x, y, CW, CH); renderer.render(scene, cam);
  const l = document.createElement('div'); l.className = 'l'; l.style.left = `${x}px`; l.style.top = `${H - y - CH}px`; l.textContent = cell.label; document.body.append(l);
});
document.title = 'ready';
