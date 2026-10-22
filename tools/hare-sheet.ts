// Picture of the procedural snowshoe hare (T-0028): side, three-quarter, head, feet; summer (day 227), mid autumn moult, winter.
// ?day=<n> overrides the summer cells' day. Same createHareModel the game uses (no mesh file).
import * as THREE from 'three';
import { createHareModel } from '../src/animals/hare';
import { setHareDay } from '../src/animals/hare';
const q = new URLSearchParams(location.search), CW = 520, CH = 400, W = CW * 3, H = CH * 2;
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('c') as HTMLCanvasElement, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H); renderer.setScissorTest(true);
const cells: Array<{ label: string; day: number; eye: [number, number, number]; target: [number, number, number]; fov?: number; bg?: number }> = [
  { label: 'Summer (day 227), side', day: Number(q.get('day') ?? 227), eye: [1.6, .25, -.1], target: [0, .13, -.1] },
  { label: 'Summer, three-quarter front', day: Number(q.get('day') ?? 227), eye: [.9, .45, -1.2], target: [0, .13, -.12] },
  { label: 'Summer, head and ears', day: Number(q.get('day') ?? 227), eye: [.55, .3, -.62], target: [0, .23, -.3], fov: 22 },
  { label: 'Autumn moult (day 303, 20 d in)', day: 303, eye: [1.6, .25, -.1], target: [0, .13, -.1] },
  { label: 'Winter (day 15), side', day: 15, eye: [1.6, .25, -.1], target: [0, .13, -.1], bg: 0xe8edf2 },
  { label: 'Winter, hind feet (snowshoes)', day: 15, eye: [.5, .12, .35], target: [0, .03, -.06], fov: 30, bg: 0xe8edf2 },
];
cells.forEach((cell, n) => {
  setHareDay(cell.day);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(cell.bg ?? 0xb9c4b0);
  scene.add(new THREE.HemisphereLight(0xf1f5ef, 0x5a6650, 2.0));
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.6); sun.position.set(2, 4, 1.5); scene.add(sun);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.MeshStandardMaterial({ color: cell.bg ? 0xf2f4f6 : 0x6f8556, roughness: 1 })); ground.rotation.x = -Math.PI / 2; scene.add(ground);
  const hare = createHareModel(); scene.add(hare.root); if (q.get('nofur')) hare.root.getObjectByName('fur')!.visible = false;
  const cam = new THREE.PerspectiveCamera(cell.fov ?? 20, CW / CH, .02, 50); cam.position.set(...cell.eye); cam.lookAt(...cell.target);
  const x = (n % 3) * CW, y = H - (Math.floor(n / 3) + 1) * CH; renderer.setViewport(x, y, CW, CH); renderer.setScissor(x, y, CW, CH); renderer.render(scene, cam);
  scene.remove(hare.root);
  const l = document.createElement('div'); l.className = 'l'; l.style.left = `${x + 6}px`; l.style.top = `${H - y - CH + 4}px`; l.textContent = cell.label; document.body.append(l);
});
document.title = 'ready';
