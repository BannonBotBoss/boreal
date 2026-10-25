import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { BANDS_AMP, BANDS_AMP_DEFAULT, applySurfaceBands, bandCycleM, bandsFromSearch, wantsBands } from '../src/render/bands';
import { fadeOptIn } from '../src/render/fade';
import { GLSL_NOISE } from '../src/proc/glsl';
import { LOG_MATERIAL } from '../src/render/geometry';
import { PROP_MATERIAL, ROCK_MATERIAL } from '../src/render/batch';

test('surface bands selection: solid untextured materials only', () => {
  assert.equal(wantsBands(new THREE.MeshStandardMaterial({ vertexColors: true })), true);
  assert.equal(wantsBands(new THREE.MeshLambertMaterial()), true);
  assert.equal(wantsBands(new THREE.MeshPhongMaterial()), true);
  assert.equal(wantsBands(new THREE.MeshStandardMaterial({ transparent: true })), false);
  assert.equal(wantsBands(new THREE.MeshStandardMaterial({ alphaTest: .4 })), false);
  const cov = new THREE.MeshStandardMaterial(); cov.alphaToCoverage = true; assert.equal(wantsBands(cov), false);
  assert.equal(wantsBands(new THREE.MeshStandardMaterial({ map: new THREE.Texture() })), false);
  assert.equal(wantsBands(new THREE.MeshStandardMaterial({ alphaMap: new THREE.Texture() })), false);
  const out = new THREE.MeshStandardMaterial(); out.userData.noBands = true; assert.equal(wantsBands(out), false);
  assert.equal(wantsBands(new THREE.ShaderMaterial()), false);
  assert.equal(wantsBands(new THREE.SpriteMaterial()), false);
  assert.equal(wantsBands(new THREE.LineBasicMaterial()), false);
  assert.equal(wantsBands(new THREE.PointsMaterial()), false);
  assert.equal(wantsBands(PROP_MATERIAL), true);
  assert.equal(wantsBands(LOG_MATERIAL), false); // T-0005 bark ships its own pattern
  assert.equal(wantsBands(ROCK_MATERIAL), false); // T-0026 mineral bands
});

test('surface bands: one fixed key per base material, patch injected once, untouched when skipped', () => {
  const plain = new THREE.MeshStandardMaterial(), prev = plain.onBeforeCompile.toString();
  const a = applySurfaceBands(plain), b = applySurfaceBands(new THREE.MeshStandardMaterial());
  assert.equal(a.customProgramCacheKey(), prev + '|bands');
  assert.equal(a.customProgramCacheKey(), b.customProgramCacheKey());
  const third = applySurfaceBands(new THREE.MeshStandardMaterial());
  assert.equal(third.customProgramCacheKey(), a.customProgramCacheKey());
  const own = new THREE.MeshStandardMaterial(); own.customProgramCacheKey = () => 'boreal-x'; applySurfaceBands(own); applySurfaceBands(own);
  assert.equal(own.customProgramCacheKey(), 'boreal-x|bands');
  const sh = { uniforms: {}, vertexShader: '#include <worldpos_vertex>', fragmentShader: '#include <color_fragment>\n#include <alphamap_fragment>' } as unknown as THREE.WebGLProgramParametersWithUniforms;
  a.onBeforeCompile(sh, {} as THREE.WebGLRenderer); a.onBeforeCompile(sh, {} as THREE.WebGLRenderer);
  assert.equal(sh.fragmentShader.split('float bt =').length, 2); assert.ok(sh.vertexShader.includes('vBandW = '));
  assert.equal(sh.fragmentShader.includes(GLSL_NOISE), true);
  assert.equal(sh.fragmentShader.split('float vnoiseU(').length, 2); // one definition, from proc/glsl
  assert.ok(sh.fragmentShader.includes('float fbm('));
  assert.match(sh.fragmentShader, /1\. \+ 0\.150 \* clamp/);
  const alph = sh.fragmentShader.indexOf('#include <alphamap_fragment>');
  assert.ok(sh.fragmentShader.lastIndexOf('diffuseColor.rgb *=') < alph);
  const mapped = new THREE.MeshStandardMaterial({ map: new THREE.Texture() }), key = mapped.customProgramCacheKey();
  applySurfaceBands(mapped); assert.equal(mapped.customProgramCacheKey(), key);
  const masked = new THREE.MeshStandardMaterial(); masked.userData.bandsMask = '(1. - step(0.5, vLeaf))';
  const msh = { uniforms: {}, vertexShader: '#include <worldpos_vertex>', fragmentShader: 'float vnoiseU(vec2 p, float s) { return 0.0; }\nfloat fbm(vec2 p, float s) { return 0.0; }\n#include <alphamap_fragment>' } as unknown as THREE.WebGLProgramParametersWithUniforms;
  applySurfaceBands(masked).onBeforeCompile(msh, {} as THREE.WebGLRenderer);
  assert.equal(msh.fragmentShader.split('float vnoiseU(').length, 2); // already present: do not paste a second noise
  assert.ok(msh.fragmentShader.includes('mix(1., bk, (1. - step(0.5, vLeaf)))'));
});

test('surface bands: fade keeps the |bands key, and the query switch is the spec one', () => {
  const m = new THREE.MeshStandardMaterial(), prev = m.onBeforeCompile.toString();
  applySurfaceBands(m); fadeOptIn(m, true);
  assert.equal(m.customProgramCacheKey(), prev + '|bands');
  assert.equal(BANDS_AMP, BANDS_AMP_DEFAULT);
  assert.deepEqual(bandsFromSearch(null), { on: true, amp: .15 });
  assert.deepEqual(bandsFromSearch('?bands=0'), { on: false, amp: .15 });
  assert.deepEqual(bandsFromSearch('?hour=15&bands=0'), { on: false, amp: .15 });
  assert.deepEqual(bandsFromSearch('?bands=0.22'), { on: true, amp: .22 });
  assert.deepEqual(bandsFromSearch('?bands=0.9'), { on: true, amp: .15 });
  const y = bandCycleM([0, 1, 0]), x = bandCycleM([1, 0, 0]), z = bandCycleM([0, 0, 1]);
  assert.ok(Math.abs(y - 2 / (4 * 1.4)) < 1e-12);
  assert.ok(Math.abs(x - 2 / 4) < 1e-12);
  assert.ok(Math.abs(z - 2 / (4 * .9)) < 1e-12);
  assert.equal(1 - BANDS_AMP_DEFAULT, .85);
  assert.equal(1 + BANDS_AMP_DEFAULT, 1.15);
});

test('surface bands wiring: batch calls the one chunk, trees mask bark, animals opt out', () => {
  const batch = readFileSync(new URL('../src/render/batch.ts', import.meta.url), 'utf8');
  const trees = readFileSync(new URL('../src/render/trees.ts', import.meta.url), 'utf8');
  const wolf = readFileSync(new URL('../src/render/playerWolf.ts', import.meta.url), 'utf8');
  const pbr = readFileSync(new URL('../src/render/pbr.ts', import.meta.url), 'utf8');
  assert.match(batch, /applySurfaceBands\(mat\)/);
  assert.match(trees, /bandsMask = '\(1\. - step\(0\.5, vLeaf\)\)'/);
  assert.match(wolf, /noBands = true/);
  assert.doesNotMatch(pbr, /applySurfaceBands/); // terrain is not on this chunk
});
