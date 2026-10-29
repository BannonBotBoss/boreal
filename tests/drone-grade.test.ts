/** Drone-height exposure. The forest floor stays at 1. The glide is half a stop brighter. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DRONE_STOP, droneExposureScale } from '../src/render/droneGrade';

test('drone exposure is 1 on the ground and half a stop up in the glide', () => {
  assert.equal(droneExposureScale(2), 1);
  assert.equal(droneExposureScale(400), DRONE_STOP);
  assert.equal(droneExposureScale(36), DRONE_STOP);
  assert.ok(Math.abs(droneExposureScale(4000) - 1) < 1e-6);
  assert.equal(DRONE_STOP, 1.5);
});
