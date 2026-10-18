/**
 * Dev harness (Grok Bot), `?view=farlayer`: proves the far layer of the in-page transition on a renderer configured like
 * the game's (render/buildScene.ts:46-51: MSAA, linear depth with NO log/reversed-depth flag, ACES, sRGB).
 * Pass 1: the globe (shared mode, borrowed renderer) renders into the far-layer target with its own per-material log depth.
 * Pass 2: a stand-in game pass (camera near .2 / far 700 like buildScene) with the far layer as `scene.background` and its
 * own cleared depth: test objects from 2 m to 40 m in front of the camera, a ground disc 2.5 m below it.
 * Globe params pass through (?at=x,z&alt=&look=...). Drag/wheel drive the globe camera. Logs `FARLAYER {...}` once.
 */
import * as THREE from 'three';
import { createGlobe } from './globeView';
import { createFarLayer } from './farLayer';
import { RENDER_SETTINGS, createSettingsStore } from '../../core/renderSettings';
import { STAGES } from '../../core/stages/elevation';
import { CLOCK, loadClock } from '../../core/worldClock';

export function startFarLayerDemo(canvas = document.getElementById('world') as HTMLCanvasElement) {
  for (const id of ['loading', 'status', 'interaction', 'notice']) { const e = document.getElementById(id); if (e) e.style.display = 'none'; }
  for (const sel of ['header', 'footer']) { const e = document.querySelector<HTMLElement>(sel); if (e) e.style.display = 'none'; }
  Object.assign(document.body.style, { margin: '0', overflow: 'hidden', background: '#000' });
  Object.assign(canvas.style, { display: 'block', width: '100vw', height: '100vh' });
  createSettingsStore(RENDER_SETTINGS); { const sd = Number(localStorage.getItem('boreal.seed.v1')); if (sd > 0) STAGES.seed = sd; }
  loadClock(localStorage.getItem(CLOCK.key)); // the caller (here; main.ts in the game) owns the clock in shared mode
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); renderer.setSize(innerWidth, innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const q = new URLSearchParams(location.search); if (!q.has('alt')) q.set('alt', '3000'); if (!q.has('at')) q.set('at', '72,186');
  const far = createFarLayer({ scale: Number(q.get('farScale')) || 1 });
  const size = renderer.getDrawingBufferSize(new THREE.Vector2()); far.resize(size.x, size.y);
  const globe = createGlobe(renderer, { shared: true, params: q, target: far.target });
  globe.attachInput(true);

  const scene = new THREE.Scene(); scene.background = far.texture;
  const cam = new THREE.PerspectiveCamera(48, size.x / size.y, .2, 700); scene.add(cam);
  scene.add(new THREE.HemisphereLight(0xdfe8ef, 0x303020, 1.2)); const sun = new THREE.DirectionalLight(0xffffff, 2.5); sun.position.set(.4, 1, .3); scene.add(sun);
  const rig = new THREE.Group(); cam.add(rig); // test objects ride with the camera (camera space)
  const mat = (c: number) => new THREE.MeshStandardMaterial({ color: c, roughness: .6 });
  const boxes: [number, number, number, number, number][] = [[-1.2, -.6, -2, .5, 0xd94f3d], [1.5, -.2, -6, 1, 0xe6c34a], [-4, .5, -15, 2.5, 0x4a8fe6], [8, 1, -40, 6, 0x8a5ad9]];
  for (const [x, y, z, k, c] of boxes) { const m = new THREE.Mesh(new THREE.BoxGeometry(k, k, k), mat(c)); m.position.set(x, y, z); m.rotation.set(.4, .6, 0); rig.add(m); }
  const disc = new THREE.Mesh(new THREE.CircleGeometry(6, 48), mat(0x3f6b3a)); disc.position.set(0, -2.5, -7); disc.rotation.x = -Math.PI / 2 + .35; rig.add(disc);
  let logged = false, frames = 0;
  addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight, false); });
  function frame() {
    const sz = renderer.getDrawingBufferSize(size); far.resize(sz.x, sz.y);
    globe.step(far.target); // pass 1: globe -> far layer (own MSAA colour + depth, log depth per material)
    cam.quaternion.copy(globe.camera.quaternion); cam.fov = globe.camera.fov; cam.aspect = sz.x / sz.y; cam.updateProjectionMatrix();
    renderer.render(scene, cam); // pass 2: background = far layer, depth cleared (autoClear), linear depth like the game
    if (!logged && ++frames > 30 && globe.stats().queued === 0) { logged = true;
      console.log('FARLAYER ' + JSON.stringify({ logDepthFlag: renderer.capabilities.logarithmicDepthBuffer, reversedFlag: renderer.capabilities.reversedDepthBuffer, autoClear: renderer.autoClear,
        target: [far.target.width, far.target.height, far.target.samples], farLayerMB: +(far.bytes() / 2 ** 20).toFixed(1), globe: globe.stats(), ownership: globe.ownership, memory: renderer.info.memory, programs: renderer.info.programs?.length })); }
    requestAnimationFrame(frame);
  }
  void globe.compiled.then(() => requestAnimationFrame(frame));
  return { renderer, globe, far };
}
