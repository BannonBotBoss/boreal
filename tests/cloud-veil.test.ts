import test from 'node:test';
import assert from 'node:assert/strict';
import { CLOUD_VEIL, cloudVeilCovers, LOCAL_CLOUDS_FRAG } from '../src/world/globe/localClouds';

test('an unlit cloud march does not cover the planet', () => {
  assert.equal(cloudVeilCovers(0, 1), false, 'full alpha and no light is the black veil');
  assert.equal(cloudVeilCovers(0, 0), false);
  assert.equal(cloudVeilCovers(CLOUD_VEIL.minLight - 1e-9, 1), false);
  assert.equal(cloudVeilCovers(CLOUD_VEIL.minLight, CLOUD_VEIL.minAlpha), true, 'a lit cloud still draws');
  assert.equal(cloudVeilCovers(0.4, 0.8), true);
  assert.match(LOCAL_CLOUDS_FRAG, /max\(acc\.r, max\(acc\.g, acc\.b\)\) < \.001\) discard/);
});
