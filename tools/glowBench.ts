/** Glow pass cost probe (T-0035), loaded by tools/glow-bench.mjs through Vite: herb proxy + OutlinePass on a 1280x720 renderer. */
import * as THREE from 'three';
import { createTargetGlow } from '../src/render/targetGlow';
import { generateGeometry } from '../src/render/geometry';
import type { Entity } from '../src/core/world';
export function run(N = 200) {
  const c = document.createElement('canvas'); c.width = 1280; c.height = 720;
  const renderer = new THREE.WebGLRenderer({ canvas: c, antialias: true }); renderer.setSize(1280, 720, false);
  const cam = new THREE.PerspectiveCamera(48, 1280 / 720, .2, 700); cam.position.set(0, 1.6, 3); cam.lookAt(0, .2, 0); cam.updateMatrixWorld(true);
  const scene = new THREE.Scene(); scene.add(new THREE.Mesh(new THREE.PlaneGeometry(50, 50).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x334433 })));
  const glow = createTargetGlow(renderer, cam);
  glow.set('herb', undefined, () => generateGeometry({ key: 'h', kind: 'plant', x: 0, z: 0, seed: 7, scale: 1, rotation: 0 } as unknown as Entity, 0));
  const gl = renderer.getContext(), px = new Uint8Array(4);
  const once = (on: boolean) => { const t0 = performance.now(); for (let i = 0; i < N; i++) { renderer.setRenderTarget(null); renderer.render(scene, cam); if (on) glow.render(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); } return +((performance.now() - t0) / N).toFixed(3); };
  once(true); once(false); const on: number[] = [], off: number[] = []; for (let k = 0; k < 30; k++) { on.push(once(true)); off.push(once(false)); }
  const med = (a: number[]) => [...a].sort((x, y) => x - y)[a.length >> 1], d = on.map((v, i) => v - off[i]);
  const out = { onMedMs: med(on), offMedMs: med(off), glowMedMs: +med(d).toFixed(3), glowP25: +[...d].sort((x, y) => x - y)[7].toFixed(3), glowP75: +[...d].sort((x, y) => x - y)[22].toFixed(3), framesPerSample: N, samples: 30 };
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  return { gpu: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : '', out };
}