import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { generateChunk } from '../src/core/world';
import { applyPopulation } from '../src/core/population';
import { generateGeometry } from '../src/render/geometry';
import { createChunkBatch, PROP_MATERIAL, ROCK_MATERIAL } from '../src/render/batch';
import { finish } from '../src/core/interest';

test('a chunk actually builds through render/batch: every static entity gets an instance, keys set, LOD geometry ids valid', () => {
  let sawRock = false, sawProp = false;
  for (const [cx, cz] of [[0, 0], [2, -1], [-1, 2], [1, -2]]) {
    const ents = applyPopulation(generateChunk(cx, cz), cx, cz).filter(e => e.kind !== 'deer' && e.kind !== 'person');
    assert.ok(ents.length > 20);
    const batch = createChunkBatch();
    for (const e of ents) batch.add(e.key, new THREE.Vector3(e.x, 0, e.z), [0, 1, 2].map(d => generateGeometry(e, d)), [0, 55, 115]);
    const meshes = finish(batch.buildJob());
    assert.ok(meshes.length >= 1, 'one BatchedMesh per material');
    // A dark chunk can have rocks and no berries. The batch still has to carry whichever materials the chunk grew.
    if (ents.some(e => e.kind === 'rock')) { sawRock = true; assert.ok(meshes.some(m => m.material === ROCK_MATERIAL)); }
    if (ents.some(e => e.kind === 'plant' || e.kind === 'forage')) { sawProp = true; assert.ok(meshes.some(m => m.material === PROP_MATERIAL)); }
    const keys = new Set(meshes.flatMap(m => (m.userData.keys as string[]).filter(Boolean)));
    for (const e of ents) assert.ok(keys.has(e.key), `instance for ${e.key}`);
    for (const m of meshes) { assert.ok(m.instanceCount > 0); const p = m.geometry.getAttribute('position'); assert.ok(p.count > 0); assert.ok(m.geometry.index!.count > 0); }
    batch.update(new THREE.Vector3(cx * 40 + 20, 0, cz * 40 + 20), 1); // LOD pick runs over the built slots without throwing
    batch.dispose();
  }
  assert.ok(sawRock && sawProp, 'the window still contains a rock batch and a plant batch');
});
