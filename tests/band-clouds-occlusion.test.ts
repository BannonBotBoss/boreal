import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createLocalClouds, nearEdgeDepth, LOCAL_CLOUDS } from '../src/world/globe/localClouds';

test('#202 (2): the band overlay is depth-tested with its own near-edge depth; the globe copy is not', () => {
  const lc = createLocalClouds(); const om = lc.overlay.material as THREE.RawShaderMaterial, gm = lc.mesh.material as THREE.RawShaderMaterial;
  assert.equal(om.depthTest, true); assert.equal(om.depthWrite, false); assert.equal(om.defines?.BAND_OCCLUDE, 1);
  assert.equal(gm.depthTest, false); assert.equal(gm.defines?.BAND_OCCLUDE, undefined);
  assert.match(om.fragmentShader, /#ifdef BAND_OCCLUDE[\s\S]*gl_FragDepth/);
});

test('#202 (2): a ridge in front of the cloud culls it, ground behind the cloud does not', () => {
  // game camera at 1500 m looking level north (-z); cloud near edge 3 km ahead at 1300 m
  const cam = new THREE.PerspectiveCamera(60, 16 / 9, .2, 700000); cam.position.set(0, 1500, 0); cam.lookAt(0, 1500, -1); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  const box = new THREE.Matrix4().makeScale(LOCAL_CLOUDS.sizeM, LOCAL_CLOUDS.topM, LOCAL_CLOUDS.sizeM).setPosition(0, LOCAL_CLOUDS.topM / 2, 0);
  const mv = new THREE.Matrix4().multiplyMatrices(cam.matrixWorldInverse, box);
  const cloud = new THREE.Vector3(0, 1300, -3000).applyMatrix4(box.clone().invert()); // into box-local coordinates
  const dCloud = nearEdgeDepth(cloud, mv, cam.projectionMatrix);
  const depthOf = (z: number) => { const v = new THREE.Vector3(0, 1300, z).project(cam); return v.z * .5 + .5; };
  assert.ok(dCloud > depthOf(-1000), 'ridge 1 km ahead is nearer: LessEqual test culls the cloud');
  assert.ok(dCloud < depthOf(-8000), 'ground 8 km ahead is farther: the cloud draws');
  assert.ok(Math.abs(dCloud - depthOf(-3000)) < 1e-6);
});
