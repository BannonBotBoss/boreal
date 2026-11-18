/** The ground under mama stays up through an Explore / biome rebuild. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { chunkAction } from '../src/render/groundHold';
import { createContinuousTerrain } from '../src/render/continuousTerrain';

test('a biome change keeps the old chunk until the new one is in the scene', () => {
  // The chunk under mama is needed the whole transition. The replacement is not ready yet.
  let ground = true;
  for (const ready of [false, false, false, true]) {
    const action = chunkAction(true, false, ready);
    if (action === 'drop') ground = false;
    if (action === 'swap') ground = true;
    assert.equal(action === 'drop', false);
    assert.equal(ground, true, 'ground under mama');
  }
  assert.equal(chunkAction(true, false, true), 'swap');
  assert.equal(chunkAction(false, false, false), 'drop');
  assert.equal(chunkAction(true, true, false), 'keep');
});

test('the horizon mesh is never swapped for an empty geometry', () => {
  const terrain = createContinuousTerrain();
  terrain.update(0, 0, 2);
  const first = terrain.mesh.geometry as THREE.BufferGeometry;
  const count = () => (terrain.mesh.geometry as THREE.BufferGeometry).getAttribute('position')?.count ?? 0;
  assert.ok(count() > 0, 'the first ground has vertices');
  terrain.update(0, 0, 2);
  assert.equal(terrain.mesh.geometry, first, 'the same cell keeps the mesh that is already drawn');
  terrain.update(8000, -4000, 2);
  assert.ok(count() > 0, 'the rebuilt ground has vertices');
  assert.notEqual(terrain.mesh.geometry, first);
  terrain.dispose();
});
