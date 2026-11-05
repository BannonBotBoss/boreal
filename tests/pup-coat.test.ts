import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { finishAnimalCoat } from '../src/render/coatFinish';
import { stylizedNight } from '../src/render/stylizedPalette';

test('a pup coat is an opaque tabby and dusk does not turn it into a ghost', () => {
  const pup = new THREE.MeshStandardMaterial({ color: 0xffffff });
  pup.userData.pupCoat = true;
  pup.userData.stylized = true;
  pup.userData.fillIntensity = 0.2;
  pup.emissiveIntensity = 0.2;
  pup.toneMapped = true;
  finishAnimalCoat(pup, 'pup');
  const mama = new THREE.MeshStandardMaterial();
  finishAnimalCoat(mama, 'mama');
  assert.notEqual(pup.customProgramCacheKey(), mama.customProgramCacheKey());
  assert.match(String(pup.customProgramCacheKey()), /pup/);

  const shader = { fragmentShader: 'void main() {\n#include <opaque_fragment>\n}\n', vertexShader: '' };
  pup.onBeforeCompile?.(shader as never, {} as never);
  assert.match(shader.fragmentShader, /gl_FragColor\.rgb = coat/);
  assert.match(shader.fragmentShader, /vec3\(0\.22, 0\.12, 0\.06\)/);
  assert.match(shader.fragmentShader, /vec3\(0\.42, 0\.26, 0\.14\)/);
  assert.doesNotMatch(shader.fragmentShader, /0\.78,\s*0\.84,\s*0\.95/);

  stylizedNight(pup, 0);
  assert.equal(pup.emissiveIntensity, 0);
  assert.equal(pup.toneMapped, false);
  stylizedNight(pup, 1);
  assert.equal(pup.emissiveIntensity, 0);
  assert.equal(pup.toneMapped, false);
});
