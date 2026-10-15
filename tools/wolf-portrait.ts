// Wolf head portrait: the in-game wolf rig in portrait mode (fine fur, charcoal/tan/silver coat), three-quarter view, amber eyes.
import * as THREE from 'three';
import { createPlayerWolf } from '../src/render/playerWolf';
const W = 1000, H = 1000;
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('c') as HTMLCanvasElement, antialias: true });
renderer.setPixelRatio(1); renderer.setSize(W, H); renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x10161b); scene.fog = new THREE.Fog(0x10161b, 2.5, 6);
scene.add(new THREE.HemisphereLight(0x8aa0b8, 0x1a1a18, .9));
const key = new THREE.DirectionalLight(0xdfe8f5, 2.6); key.position.set(-2, 2.5, -3); scene.add(key);
const rim = new THREE.DirectionalLight(0x7fa4d8, 2.4); rim.position.set(3, 2, 1); scene.add(rim);
const warm = new THREE.DirectionalLight(0xff9a50, .7); warm.position.set(2, 0, -3); scene.add(warm);
const wolf = createPlayerWolf(1400, { portrait: true });
const pivot = new THREE.Group(); pivot.add(wolf.root); wolf.root.position.set(0, -.8, .72); // head at the origin
const q = new URLSearchParams(location.search);
wolf.animate(1, false, q.get('open') ? 'speak' : undefined, q.get('open') ? Math.PI / 44 : 0);
scene.add(pivot);
const cam = new THREE.PerspectiveCamera(28, W / H, .05, 50); cam.position.set(-.5, .1, -.95); cam.lookAt(0, -.01, 0);
renderer.render(scene, cam); document.title = 'ready';
