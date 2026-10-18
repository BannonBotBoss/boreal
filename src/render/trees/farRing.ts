/**
 * Far tree ring (Grok Bot), after Matthew's wide-view forest notes: trunkless crowns as InstancedMeshes (one draw call per
 * crown variant), per-instance Y rotation and non-uniform scale from seeded hashes, colour from render/trees/conifer
 * CROWN_UNIFORMS (palette grouped by low-frequency noise + fake vertical AO, uniforms only), and octahedral impostors past
 * `split` m. Placement comes from the caller (core/flora/stands farTreesInTile = Thomas clusters), never a grid.
 */
import * as THREE from 'three';
import { hash, random } from '../../proc/rng';
import { crownMaterial } from './conifer';
import { impostorMesh, type Atlas } from './impostor';

export interface FarTree { x: number; y: number; z: number; key: string; scale: number }
export interface FarRing { group: THREE.Group; crowns: THREE.InstancedMesh[]; impostors: THREE.InstancedMesh[]; counts: { crowns: number; impostors: number } }
/** Build the ring around (cx, cz): crowns inside `split` m, impostors beyond (if atlases are given). */
export function farRing(trees: FarTree[], crowns: THREE.BufferGeometry[], atlases: Atlas[], cx: number, cz: number, split = Infinity): FarRing {
  const group = new THREE.Group(); group.name = 'far-tree-ring';
  const near: FarTree[][] = crowns.map(() => []), far: FarTree[][] = atlases.map(() => []);
  for (const t of trees) {
    const v = hash(t.key), d = Math.hypot(t.x - cx, t.z - cz);
    if (d > split && atlases.length) far[v % atlases.length].push(t); else near[v % crowns.length].push(t);
  }
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const place = (mesh: THREE.InstancedMesh, list: FarTree[]) => list.forEach((t, i) => {
    const r = random(hash(`far:${t.key}`)), w = t.scale * (.8 + r() * .4); // non-uniform: crown width and height vary separately [game calibration]
    mesh.setMatrixAt(i, m.compose(p.set(t.x, t.y, t.z), q.setFromAxisAngle(up, r() * Math.PI * 2), s.set(w, t.scale * (.85 + r() * .3), w)));
  });
  const crownMeshes = crowns.map((g, i) => { const mesh = new THREE.InstancedMesh(g, crownMaterial(), Math.max(1, near[i].length)); place(mesh, near[i]); mesh.count = near[i].length; mesh.castShadow = false; mesh.receiveShadow = true; mesh.computeBoundingSphere(); group.add(mesh); return mesh; });
  const impMeshes = atlases.map((a, i) => { const mesh = impostorMesh(a, Math.max(1, far[i].length)); place(mesh, far[i]); mesh.count = far[i].length; group.add(mesh); return mesh; });
  return { group, crowns: crownMeshes, impostors: impMeshes, counts: { crowns: near.reduce((a, l) => a + l.length, 0), impostors: far.reduce((a, l) => a + l.length, 0) } };
}
