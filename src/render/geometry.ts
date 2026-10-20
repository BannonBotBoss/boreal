import * as THREE from 'three';
import type { Entity } from '../core/world';
import { random } from '../core/random';
import { createDeerRig } from './animalRig';
import { icosphere, rockGeometry } from './rocks';
import { treeGeometry } from './trees';

/** Fallen logs share one batch material with the same parameters as render/batch PROP_MATERIAL (same program key, no new
 *  program), colour per vertex. Being a different material, the chunk batch gives logs their own BatchedMesh, which casts
 *  shadows (render/photoreal: near cascade only), while plants and bushes (PROP_MATERIAL) cast none. */
export const LOG_MATERIAL = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95, flatShading: true }); LOG_MATERIAL.userData.shared = true;
const tinted = (g: THREE.BufferGeometry, hex: number) => { const c = new THREE.Color(hex), n = g.getAttribute('position').count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };

/** Only this layer knows Three.js. No model files are loaded. */
export function generateGeometry(entity: Entity, detail: number): THREE.Group {
  if (entity.kind === 'deer') { const rig = createDeerRig(entity.seed, detail); rig.root.scale.setScalar(entity.scale); rig.root.rotation.y = entity.rotation; return rig.root; }
  if (entity.kind === 'rock') return rockGeometry(entity, detail);
  if (entity.kind === 'spruce') return treeGeometry(entity, detail); // boreal species: src/render/trees.ts
  const group = new THREE.Group(), rng = random(entity.seed);
  const segments = [9, 6, 4][detail];
  const material = (color: number) => new THREE.MeshStandardMaterial({ color, roughness: .95, flatShading: true });
  const wood = material(0x70513b), leaf = material(0x315746), pale = material(0xc4ab7a);
  const body = material(entity.kind === 'person' ? 0x9b6650 : 0xa28055);
  const add = (geometry: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1) => {
    const mesh = new THREE.Mesh(geometry, mat); mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); group.add(mesh); return mesh;
  };
  const ellipsoid = (mat: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number) =>
    add(icosphere(detail === 0 ? 1 : 0), mat, x, y, z, sx, sy, sz);
  if (entity.kind === 'log') {
    const log = add(tinted(new THREE.CylinderGeometry(.32, .43, 4.4, segments), 0x70513b), LOG_MATERIAL, 0, .4, 0); log.rotation.z = Math.PI / 2;
    const end = add(tinted(new THREE.CircleGeometry(.33, segments), 0xc4ab7a), LOG_MATERIAL, 2.21, .4, 0); end.rotation.y = Math.PI / 2;
    log.userData.shared = end.userData.shared = true; // render/batch keeps a shared material as is (its own batch) instead of baking it into PROP_MATERIAL
  } else if (entity.kind === 'forage') {
    const berries = material(0x536fb7), leaves = material(0x528d40);
    for(let i=0;i<(detail===2?3:7);i++) {
      const angle=i*2.4;
      ellipsoid(leaves,Math.cos(angle)*.28,.17,Math.sin(angle)*.28,.22,.13,.17);
      ellipsoid(berries,Math.cos(angle)*.22,.32,Math.sin(angle)*.22,.06,.065,.06);
    }
  } else if (entity.kind === 'plant') {
    for (let i = 0; i < (detail === 2 ? 2 : 5); i++) {
      const a = i * 2.4;
      ellipsoid(leaf, Math.cos(a) * .25, .35, Math.sin(a) * .25, .23, .5, .18);
      ellipsoid(material(0xd9a15c), Math.cos(a) * .3, .8, Math.sin(a) * .3, .13, .15, .13);
    }
  } else {
    ellipsoid(body, 0, 1.05, 0, .38, .65, .23);
    ellipsoid(pale, 0, 1.98, 0, .25, .3, .25);
    for (const x of [-.18, .18]) add(new THREE.CylinderGeometry(.12, .09, .8, segments), wood, x, .4, 0);
    for (const x of [-.48, .48]) {
      const arm = add(new THREE.CylinderGeometry(.10, .08, .8, segments), body, x, 1.2, 0); arm.name = 'arm'; arm.rotation.z = x * .3;
    }
  }
  // Materials created but unused by this recipe have no GPU allocation.
  group.scale.setScalar(entity.scale); group.rotation.y = entity.rotation;
  return group;
}
export function disposeObject(object: THREE.Object3D) {
  const materials = new Set<THREE.Material>();
  object.traverse(child => {
    if (child instanceof THREE.Mesh && !child.userData.shared) { // shared tree geometry/material stay cached
      child.geometry.dispose();
      for (const m of Array.isArray(child.material) ? child.material : [child.material]) materials.add(m);
    }
  });
  materials.forEach(m => { if (!m.userData.shared) m.dispose(); }); // shared materials (render/pbr) outlive chunks
}
