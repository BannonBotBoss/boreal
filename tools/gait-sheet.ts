/** Dev tool: renders each animal's motions as strips of still frames (side view) so animation can be reviewed as images. */
import * as THREE from 'three';
import { createDeerRig } from '../src/render/animalRig';
import { createPlayerWolf } from '../src/render/playerWolf';
import { gaitFor, type Motion, DEER_LEGS, WOLF_LEGS } from '../src/core/animalBehavior';
type Row = { animal: 'deer' | 'wolf'; motion: Motion; speed: number };
const rows: Row[] = [
  { animal: 'deer', motion: 'walk', speed: .8 }, { animal: 'deer', motion: 'run', speed: 3 }, { animal: 'deer', motion: 'back', speed: .65 }, { animal: 'deer', motion: 'jump', speed: 0 },
  { animal: 'wolf', motion: 'walk', speed: .8 }, { animal: 'wolf', motion: 'walk', speed: 2 }, { animal: 'wolf', motion: 'run', speed: 7 }, { animal: 'wolf', motion: 'back', speed: .8 }, { animal: 'wolf', motion: 'jump', speed: 0 },
];
const FRAMES = 8, CELL = 150, LABEL = 120;
const canvas = document.getElementById('c') as HTMLCanvasElement;
const W = LABEL + FRAMES * CELL, H = rows.length * CELL;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H); renderer.setScissorTest(true);
const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight(0xffffff, 0x667766, 2.6));
const sun = new THREE.DirectionalLight(0xffffff, 2); sun.position.set(5, 8, 3); scene.add(sun);
const ground = new THREE.Mesh(new THREE.BoxGeometry(8, .01, 3), new THREE.MeshStandardMaterial({ color: 0x8a9a6a })); ground.position.y = -.005; scene.add(ground);
const deer = createDeerRig(1, 0), wolf = createPlayerWolf();
const cams = {
  deer: (() => { const c = new THREE.OrthographicCamera(-1.9, 1.9, 1.85, -1.65, .1, 50); c.position.set(10, 1.4, 0); c.lookAt(0, 1.4, 0); return c; })(),
  wolf: (() => { const c = new THREE.OrthographicCamera(-.85, .85, .85, -.85, .1, 50); c.position.set(10, .75, 0); c.lookAt(0, .75, 0); return c; })(),
};
const labels = document.getElementById('labels')!;
renderer.setClearColor(0xeef0ea); renderer.setScissor(0, 0, W, H); renderer.setViewport(0, 0, W, H); renderer.clear();
rows.forEach((row, r) => {
  const rig = row.animal === 'deer' ? deer : wolf;
  scene.add(rig.root); scene.remove(row.animal === 'deer' ? wolf.root : deer.root);
  const gait = gaitFor(row.motion, row.speed, row.animal === 'deer' ? DEER_LEGS : WOLF_LEGS);
  const l = document.createElement('div'); l.className = 'l'; l.style.left = '8px'; l.style.top = `${r * CELL + CELL / 2 - 16}px`;
  l.innerHTML = `${row.animal} ${row.motion}<br><span style="font-weight:400;color:#667">${row.speed ? row.speed + ' m/s · ' + gait!.name : ''}</span>`; labels.append(l);
  for (let f = 0; f < FRAMES; f++) {
    rig.brain.motion = row.motion; rig.brain.problem = 'explore'; rig.brain.gaitSpeed = row.speed;
    rig.brain.phase = f / FRAMES; rig.brain.jumpTime = row.motion === 'jump' ? (f / (FRAMES - 1)) * .85 : 0;
    if (rig === deer) deer.animate(1); else wolf.animate(1 + f, row.motion !== 'jump', undefined, 0, 'walk');
    const x = LABEL + f * CELL, y = H - (r + 1) * CELL;
    renderer.setViewport(x, y, CELL, CELL); renderer.setScissor(x, y, CELL, CELL);
    renderer.setClearColor(f % 2 ? 0xe4e8de : 0xf2f4ee); renderer.clear(); renderer.render(scene, cams[row.animal]);
    const c = document.createElement('div'); c.className = 'c'; c.style.left = `${x + 4}px`; c.style.top = `${r * CELL + 3}px`;
    c.textContent = row.motion === 'jump' ? `t ${(f / (FRAMES - 1) * .85).toFixed(2)}s` : `${f}/${FRAMES}`; labels.append(c);
  }
});
document.title = 'ready';
