import test from 'node:test';
import assert from 'node:assert/strict';
import { steerWolf } from '../src/core/locomotion';
import { positionCamera, RIDER_DISTANCE, RIDER_FLANK, RIDER_HEIGHT } from '../src/render/math';
import { PerspectiveCamera } from 'three';

test('left stick steers wolf and chase camera remains behind its heading', () => {
  const start = { x: 0, z: 0, heading: 0 };
  const turned = steerWolf(start, 1, 0, .25);
  assert.ok(turned.heading < 0);
  assert.equal(turned.x, 0); assert.equal(turned.z, 0);
  const moved = steerWolf(turned, 0, 1, .25);
  assert.ok(moved.x > 0 && moved.z < 0);
  const camera = new PerspectiveCamera();
  positionCamera(camera, moved.x, moved.z, 1.6, moved.heading);
  const backX = camera.position.x - moved.x, backZ = camera.position.z - moved.z;
  assert.ok(Math.abs(Math.hypot(backX, backZ) - 1.6 * Math.hypot(RIDER_DISTANCE, RIDER_FLANK) / RIDER_HEIGHT) < 1e-8);
  assert.ok(backX * (moved.x - turned.x) + backZ * (moved.z - turned.z) < 0);
  assert.deepEqual(steerWolf(moved, 0, 0, 1), moved);
});
