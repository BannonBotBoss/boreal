/** Spawn cervids are a species coat, not the intensity-14 white lamp. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { dressCervidCoat } from '../src/render/coatFinish';
import { coatOf } from '../src/render/stylizedPalette';
import { createDeerRig } from '../src/render/animalRig';

test('a mapped deer albedo loses the white emissive fill', () => {
  const mapped = new THREE.MeshStandardMaterial({ color: 0xffffff });
  mapped.map = new THREE.Texture();
  mapped.emissive.setRGB(1, 0.94, 0.82);
  mapped.emissiveIntensity = 14;
  mapped.emissiveMap = mapped.map;
  const coat = coatOf('White-tailed Deer');
  dressCervidCoat(mapped, coat);
  assert.equal(mapped.emissiveIntensity, 0);
  assert.equal(mapped.emissiveMap, null);
  assert.equal(mapped.emissive.r, 0);
  assert.equal(mapped.userData.cervidCoat, true);
  dressCervidCoat(mapped, coat);
  assert.equal(mapped.emissiveIntensity, 0);
});

test('the procedural rack is a cylinder, not a stretched icosahedron', () => {
  const rig = createDeerRig(1, 0);
  let cylinders = 0, icosa = 0;
  rig.root.traverse(obj => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (mesh.geometry instanceof THREE.CylinderGeometry) cylinders++;
    if (mesh.geometry instanceof THREE.IcosahedronGeometry && (mesh.material as THREE.MeshStandardMaterial).color.getHex() === 0x6e5a40) icosa++;
  });
  assert.equal(cylinders, 4);
  assert.equal(icosa, 0);
});
