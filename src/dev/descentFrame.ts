/**
 * One WebGL view of the horizon mesh. The dive test and the evidence shots drive
 * `window.__dive`. SwiftShader frame time includes the mesh build, the GPU upload
 * and the draw (`gl.finish`).
 */
import * as THREE from 'three';
import { heightAt } from '../core/world';
import { ISO_BELOW_HORIZON } from '../world/globe/flight';
import { horizonMetres } from '../world/globe/horizonSkirt';
import { viewpointPose } from '../world/globe/transition';
import { createContinuousTerrain } from '../render/continuousTerrain';

const canvas = document.querySelector('#c') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false });
renderer.setSize(1280, 720, false);
renderer.setClearColor(0x9bb8d0);
const scene = new THREE.Scene();
const terrain = createContinuousTerrain();
scene.add(terrain.mesh);
scene.add(new THREE.HemisphereLight(0xd5e6f5, 0x6d5b3c, 1.15));
const sun = new THREE.DirectionalLight(0xfff0d2, 1.35);
sun.position.set(30, 80, 18);
scene.add(sun);
const camera = new THREE.PerspectiveCamera(48, 1280 / 720, 0.5, 20000);
const pose = { position: new THREE.Vector3(), quaternion: new THREE.Quaternion() };

function place(eye: number) {
  const ground = heightAt(0, 0);
  viewpointPose(0, 0, ground, eye, 0, ISO_BELOW_HORIZON, pose);
  camera.position.copy(pose.position);
  camera.quaternion.copy(pose.quaternion);
  camera.near = Math.max(0.2, eye * 0.01);
  camera.far = Math.max(8000, horizonMetres(Math.max(1, eye)) * 1.2);
  camera.updateProjectionMatrix();
}

function sample(): { hash: string; mean: number } {
  const gl = renderer.getContext();
  const w = 64, h = 36;
  const buf = new Uint8Array(w * h * 4);
  gl.readPixels(608, 342, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
  let n = 0;
  for (let i = 0; i < buf.length; i += 4) n += buf[i] + buf[i + 1] + buf[i + 2];
  let hash = 0;
  for (let i = 0; i < buf.length; i += 16) hash = (hash * 33 + buf[i]) >>> 0;
  return { hash: hash.toString(16), mean: n / (buf.length / 4) };
}

const pub = () => (globalThis as { __terrain?: { pending?: number; leaves?: number; frameMs?: number; uploaded?: number } }).__terrain;

function step(eye: number) {
  const t0 = performance.now();
  terrain.update(0, 0, eye);
  place(eye);
  renderer.render(scene, camera);
  renderer.getContext().finish();
  const ms = performance.now() - t0;
  const picture = sample();
  return { eye, ms, picture, terrain: pub() ?? null };
}

const api = {
  ready: true,
  step,
  /** Warm shaders and the height grid, then time every dive frame. */
  dive() {
    step(2000);
    const gaps: { eye: number; ms: number }[] = [];
    const shots: Record<string, { ms: number; hash: string; mean: number; pending: number }> = {};
    let eye = 2000;
    while (eye >= 2) {
      const row = step(eye);
      gaps.push({ eye: Math.round(eye), ms: row.ms });
      eye *= 0.84;
    }
    for (const mark of [1200, 300, 28]) {
      let last = step(mark);
      let guard = 0;
      while ((pub()?.pending ?? 0) > 0 && guard++ < 120) {
        last = step(mark);
        gaps.push({ eye: mark, ms: last.ms });
      }
      shots[String(mark)] = { ms: last.ms, hash: last.picture.hash, mean: last.picture.mean, pending: pub()?.pending ?? 0 };
    }
    const max = gaps.reduce((m, g) => Math.max(m, g.ms), 0);
    const gl = renderer.getContext();
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const rendererName = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) as string : gl.getParameter(gl.RENDERER) as string;
    return { gaps, max, shots, renderer: rendererName };
  },
};

(window as unknown as { __dive?: typeof api }).__dive = api;
