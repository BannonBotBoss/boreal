/**
 * Dev tool (Grok Bot, run diagnosis): the default game wolf (createPlayerWolf, the pose the player sees) as a side-view strip
 * of `n` frames evenly spaced over one stride at `speed` m/s (?speed=6&n=8&label=...). The ground stripes move with the
 * distance travelled, so a planted paw stays on its stripe; each frame shows its time and which paws are down.
 * Works against any commit that has createPlayerWolf + gaitFor (no new imports), for before/after shots.
 */
import * as THREE from 'three';
import { createPlayerWolf } from '../src/render/playerWolf';
import { gaitFor, WOLF_LEGS } from '../src/core/animalBehavior';
const q = new URLSearchParams(location.search);
const speed = Number(q.get('speed') ?? 6), N = Number(q.get('n') ?? 8), label = q.get('label') ?? '';
const CW = 300, CH = 230, HEAD = 34, W = CW * Math.min(N, 4), rows = Math.ceil(N / 4), H = HEAD + rows * CH;
const canvas = document.getElementById('c') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H); renderer.setScissorTest(true);
const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight(0xffffff, 0x667766, 2.6));
const sun = new THREE.DirectionalLight(0xfff4e0, 2.2); sun.position.set(5, 8, 3); scene.add(sun);
const STRIPE = .25, stripes: THREE.Mesh[] = [];
for (let k = -24; k <= 24; k++) { const m = new THREE.Mesh(new THREE.BoxGeometry(1.2, .01, STRIPE), new THREE.MeshStandardMaterial({ color: k & 1 ? 0x7d8f5f : 0x9aac78 })); m.position.y = -.005; scene.add(m); stripes.push(m); }
const wolf = createPlayerWolf(); scene.add(wolf.root);
const cam = new THREE.OrthographicCamera(-1.3, 1.3, 1.0, -.95, .1, 50); cam.position.set(10, 3.2, 0); cam.lookAt(0, .5, 0); // a little above: the ground stripes show
const gait = gaitFor('run', speed, WOLF_LEGS, 'gallop')!;
const hz = speed / gait.cycle, frac = (v: number) => v - Math.floor(v);
const labels = document.getElementById('labels')!;
const add = (cls: string, x: number, y: number, html: string) => { const d = document.createElement('div'); d.className = cls; d.style.left = `${x}px`; d.style.top = `${y}px`; d.innerHTML = html; labels.append(d); };
add('h', 10, 8, `${label} default game wolf, run ${speed} m/s, ${gait.name}: ${hz.toFixed(2)} strides/s, stride ${gait.cycle.toFixed(2)} m, duty ${gait.duty.toFixed(2)}, period ${(1000 / hz).toFixed(0)} ms (frames every ${(1000 / hz / N).toFixed(0)} ms)`);
renderer.setClearColor(0xeef0ea); renderer.setScissor(0, 0, W, H); renderer.setViewport(0, 0, W, H); renderer.clear();
const names = ['LF', 'LH', 'RF', 'RH'];
for (let f = 0; f < N; f++) {
  const phase = f / N, t = phase / hz, dist = phase * gait.cycle;
  const b = wolf.brain as unknown as Record<string, unknown>;
  b.motion = 'run'; b.problem = 'explore'; b.gaitSpeed = speed; b.gaitName = gait.name; b.phase = phase; b.prevPhase = phase; b.drawAlpha = 1;
  wolf.animate(1 + f, true, undefined, 0, 'run');
  stripes.forEach((m, k) => { m.position.z = k * STRIPE - 24 * STRIPE + frac(dist / (2 * STRIPE)) * 2 * STRIPE; }); // ground slides back under the wolf (+z is back)
  const col = f % 4, row = Math.floor(f / 4), x = col * CW, y = H - HEAD - (row + 1) * CH;
  renderer.setViewport(x, y, CW, CH); renderer.setScissor(x, y, CW, CH);
  renderer.setClearColor(f % 2 ? 0xe4e8de : 0xf2f4ee); renderer.clear(); renderer.render(scene, cam);
  const down = gait.offsets.map((o, i) => frac(phase + o) < gait.duty ? names[i] : '').filter(Boolean);
  add('c', x + 6, HEAD + row * CH + 4, `t ${(1000 * t).toFixed(0)} ms &middot; ${down.length ? 'down: ' + down.join(' ') : '<b>all feet off</b>'}`);
}
document.title = 'ready';
