import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { applySurfaceBands, wantsBands } from '../src/render/bands';

test('surface bands selection: solid untextured materials only', () => {
  assert.equal(wantsBands(new THREE.MeshStandardMaterial({ vertexColors: true })), true);
  assert.equal(wantsBands(new THREE.MeshLambertMaterial()), true);
  assert.equal(wantsBands(new THREE.MeshStandardMaterial({ transparent: true })), false);
  assert.equal(wantsBands(new THREE.MeshStandardMaterial({ alphaTest: .4 })), false);
  assert.equal(wantsBands(new THREE.MeshStandardMaterial({ map: new THREE.Texture() })), false);
  const out = new THREE.MeshStandardMaterial(); out.userData.noBands = true; assert.equal(wantsBands(out), false);
  assert.equal(wantsBands(new THREE.ShaderMaterial()), false);
  assert.equal(wantsBands(new THREE.SpriteMaterial()), false);
  assert.equal(wantsBands(new THREE.LineBasicMaterial()), false);
  assert.equal(wantsBands(new THREE.PointsMaterial()), false);
});

test('surface bands: one fixed key per base material, patch injected once, untouched when skipped', () => {
  const a = applySurfaceBands(new THREE.MeshStandardMaterial()), b = applySurfaceBands(new THREE.MeshStandardMaterial());
  assert.equal(a.customProgramCacheKey(), b.customProgramCacheKey()); assert.match(a.customProgramCacheKey(), /\|bands$/);
  const own = new THREE.MeshStandardMaterial(); own.customProgramCacheKey = () => 'boreal-x'; applySurfaceBands(own); applySurfaceBands(own);
  assert.equal(own.customProgramCacheKey(), 'boreal-x|bands');
  const sh = { uniforms: {}, vertexShader: '#include <worldpos_vertex>', fragmentShader: '#include <color_fragment>\n#include <alphamap_fragment>' } as unknown as THREE.WebGLProgramParametersWithUniforms;
  a.onBeforeCompile(sh, {} as THREE.WebGLRenderer); a.onBeforeCompile(sh, {} as THREE.WebGLRenderer);
  assert.equal(sh.fragmentShader.split('float bt =').length, 2); assert.ok(sh.vertexShader.includes('vBandW = '));
  const mapped = new THREE.MeshStandardMaterial({ map: new THREE.Texture() }), key = mapped.customProgramCacheKey();
  applySurfaceBands(mapped); assert.equal(mapped.customProgramCacheKey(), key);
});