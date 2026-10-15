/** Dev tool: draws generated skeletons. Colour = joint type; dashed outline = provisional values. */
import * as THREE from 'three';
import { mammalSkeleton, birdSkeleton } from '../src/core/species';
import type { Skeleton } from '../src/core/skeleton';
const list: Skeleton[] = [mammalSkeleton('Gray Wolf'), mammalSkeleton('White-tailed Deer'), mammalSkeleton('American Black Bear'), mammalSkeleton('Beaver'),
  mammalSkeleton('Little Brown Myotis'), birdSkeleton('Owls'), birdSkeleton('Loons'), birdSkeleton('Herons and Bitterns'), birdSkeleton('Swans')];
const COLS = 3, CW = 440, CH = 330, W = COLS * CW, H = Math.ceil(list.length / COLS) * CH;
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('c') as HTMLCanvasElement, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H); renderer.setScissorTest(true);
const colour = { root: 0x222222, fixed: 0x8a8f99, hinge: 0x2f6fd6, ball: 0xe07b1f } as const;
list.forEach((s, i) => {
  const scene = new THREE.Scene(); scene.background = new THREE.Color(i % 2 ? 0xeceee6 : 0xf6f7f2);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x888888, 3));
  const box = new THREE.Box3();
  for (const b of s.bones) {
    const h = new THREE.Vector3(...b.head), t = new THREE.Vector3(...b.tail), d = t.clone().sub(h), L = d.length();
    const r = Math.max(b.radius * .25, L * .06);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r * .6, r, L, 6), new THREE.MeshStandardMaterial({ color: colour[b.joint], roughness: .8 }));
    mesh.position.copy(h.clone().add(t).multiplyScalar(.5)); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); scene.add(mesh);
    const j = new THREE.Mesh(new THREE.SphereGeometry(r * 1.3, 8, 6), new THREE.MeshStandardMaterial({ color: colour[b.joint] })); j.position.copy(h); scene.add(j);
    if (b.role === 'skull') { const o = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), new THREE.MeshStandardMaterial({ color: 0xd9cfb8, transparent: true, opacity: .45 }));
      o.position.copy(mesh.position); o.quaternion.copy(mesh.quaternion); o.scale.set(b.radius, L * .55, b.radius * .9); scene.add(o); }
    box.expandByPoint(h); box.expandByPoint(t);
  }
  const ground = new THREE.Mesh(new THREE.BoxGeometry(50, .0005, .0005), new THREE.MeshBasicMaterial({ color: 0x6b7d4f })); scene.add(ground);
  const c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3()), span = Math.max(size.y * CW / CH, size.z) * .62;
  const cam = new THREE.OrthographicCamera(-span, span, span * CH / CW, -span * CH / CW, .01, 100);
  const dir = new THREE.Vector3(1, .35, -.5).normalize(); cam.position.copy(c.clone().add(dir.multiplyScalar(10))); cam.lookAt(c);
  const x = (i % COLS) * CW, y = H - (Math.floor(i / COLS) + 1) * CH;
  renderer.setViewport(x, y, CW, CH); renderer.setScissor(x, y, CW, CH); renderer.render(scene, cam);
  const prov = s.bones.filter(b => b.provisional).length;
  const l = document.createElement('div'); l.className = 'l'; l.style.left = `${x + 10}px`; l.style.top = `${H - y - CH + 8}px`;
  l.innerHTML = `${s.species} <span class="s">· ${s.archetype} · ${s.bones.length} bones · ${s.bones.length - prov} sourced</span>`;
  document.getElementById('labels')!.append(l);
});
const key = document.createElement('div'); key.id = 'key'; key.style.cssText = `position:absolute;left:10px;top:${H - 24}px`;
key.innerHTML = '<b style="color:#2f6fd6">hinge</b> · <b style="color:#e07b1f">ball</b> · <b style="color:#8a8f99">fixed</b> · <b>root</b>';
document.body.append(key); document.title = 'ready';
