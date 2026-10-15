// Picture of the procedural bear: side profile, walking, head close-ups, claws, and the black-bear variant.
import * as THREE from 'three';
import { createBear } from '../src/render/bear';
const CW = 520, CH = 400, W = CW * 3, H = CH * 2;
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('c') as HTMLCanvasElement, antialias: true });
renderer.setPixelRatio(1); renderer.setSize(W, H); renderer.setScissorTest(true);
type Bear = ReturnType<typeof createBear>;
const make = (setup: (b: Bear) => void, variant: 'grizzly' | 'black' = 'grizzly') => { const b = createBear(1, variant); setup(b); return b.root; };
const standing = () => make(b => b.animate(1));
const cells: Array<{ label: string; roots: THREE.Object3D[]; eye: [number, number, number]; target: [number, number, number]; fov?: number }> = [
  { label: 'Grizzly, side: hump, plantigrade feet', roots: [standing()], eye: [4.2, .9, -.1], target: [0, .6, 0] },
  { label: 'Walking', roots: [make(b => b.animate(1, 'walk', .3, 1.2))], eye: [2.8, 1.4, -2.8], target: [0, .6, 0] },
  { label: 'Black bear (no hump)', roots: [make(b => b.animate(1), 'black')], eye: [4.2, .9, -.1], target: [0, .6, 0] },
  { label: 'Head, profile: dished face', roots: [standing()], eye: [1.6, .95, -.95], target: [0, .86, -1.0], fov: 30 },
  { label: 'Head, three-quarter', roots: [standing()], eye: [.9, 1.05, -2.1], target: [0, .86, -1.0], fov: 30 },
  { label: 'Front paw: five curved claws', roots: [standing()], eye: [.75, .3, -1.2], target: [.2, .07, -.55], fov: 30 },
];
cells.forEach((cell, n) => {
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0xcfd8cf); scene.fog = new THREE.Fog(0xcfd8cf, 20, 60);
  scene.add(new THREE.HemisphereLight(0xf1f5dd, 0x526753, 2.1));
  const sun = new THREE.DirectionalLight(0xffebc3, 2.8); sun.position.set(3, 6, 2); scene.add(sun);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial({ color: 0x7f9265, roughness: 1 })); ground.rotation.x = -Math.PI / 2; scene.add(ground);
  cell.roots.forEach(r => scene.add(r));
  const cam = new THREE.PerspectiveCamera(cell.fov ?? 34, CW / CH, .05, 100); cam.position.set(...cell.eye); cam.lookAt(...cell.target);
  const x = (n % 3) * CW, y = H - (Math.floor(n / 3) + 1) * CH; renderer.setViewport(x, y, CW, CH); renderer.setScissor(x, y, CW, CH); renderer.render(scene, cam);
  const l = document.createElement('div'); l.className = 'l'; l.style.left = `${x}px`; l.style.top = `${H - y - CH}px`; l.textContent = cell.label; document.body.append(l);
});
document.title = 'ready';
