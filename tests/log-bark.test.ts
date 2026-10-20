import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { generateChunk } from '../src/core/world';
import { generateGeometry, LOG_MATERIAL } from '../src/render/geometry';
import { GOVERNOR, LADDER } from '../src/core/quality';

/** T-0005 bark: one shared material with the bark hook, opted out of grok/surface-bands, and the per-vertex bark data on every
 *  log part at every LOD (a BatchedMesh needs one attribute set across its geometries). */
const log = generateChunk(0, 0).concat(generateChunk(1, 0)).find(e => e.kind === 'log')!;
test('log bark: one material, noBands, smooth shading, a bark hook', () => {
  assert.equal(LOG_MATERIAL.userData.noBands, true); assert.equal(LOG_MATERIAL.userData.shared, true); assert.equal(LOG_MATERIAL.flatShading, false);
  const s = { uniforms: {} as Record<string, THREE.IUniform>, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader };
  LOG_MATERIAL.onBeforeCompile(s as never, undefined as never);
  assert.ok(s.vertexShader.includes('attribute vec4 bark;') && s.fragmentShader.includes('barkN(') && s.fragmentShader.includes('dFdx(barkH)'));
  assert.ok('uBark' in s.uniforms);
  const t0 = GOVERNOR.tier; try { for (let i = 0; i < LADDER.length; i++) { GOVERNOR.tier = i; assert.equal(s.uniforms.uBark.value, i < 3 ? 1 : 0, LADDER[i].name); } } finally { GOVERNOR.tier = t0; }
});
test('log bark: every part at every LOD carries position, normal, uv, color and bark; 12 sides at LOD 0', () => {
  for (const d of [0, 1, 2]) { const g = generateGeometry(log, d), parts: THREE.Mesh[] = []; g.traverse(o => { if ((o as THREE.Mesh).isMesh) parts.push(o as THREE.Mesh); });
    assert.equal(parts.length, 2);
    for (const m of parts) { assert.equal(m.material, LOG_MATERIAL); assert.deepEqual(Object.keys(m.geometry.attributes).sort(), ['bark', 'color', 'normal', 'position', 'uv']);
      const b = m.geometry.getAttribute('bark'); for (let i = 0; i < b.count; i++) assert.ok(b.getZ(i) >= 0 && b.getZ(i) < 1); }
    const cyl = parts.find(m => m.geometry.type === 'CylinderGeometry')!; assert.equal((cyl.geometry as THREE.CylinderGeometry).parameters.radialSegments, [12, 8, 6][d]); }
});