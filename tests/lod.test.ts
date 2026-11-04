import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chooseTier, stepTier, percentile, type Hysteresis, type TierSample } from '../src/world/cosmos/lod';

test('the highest tier inside the frame budget is chosen', () => {
  const samples: TierSample[] = [
    { id: 'ultra', p50: 40, p95: 55 },
    { id: 'high', p50: 20, p95: 28 },
    { id: 'medium', p50: 12, p95: 15 },
    { id: 'low', p50: 6, p95: 8 },
  ];
  assert.equal(chooseTier(samples, 16.7), 'medium');
  assert.equal(chooseTier(samples, 60), 'ultra');
  assert.equal(chooseTier(samples.map(s => ({ ...s, p95: 100 })), 16.7), 'low');
});

test('hysteresis does not flap on one slow frame', () => {
  let state: Hysteresis = stepTier({ tier: 'high', over: 0, under: 0 }, 30, 0.2, 16.7);
  assert.equal(state.tier, 'high');
  state = stepTier(state, 30, 0.2, 16.7);
  assert.equal(state.tier, 'high');
  state = stepTier(state, 8, 0.5, 16.7);
  assert.equal(state.over, 0);
  assert.equal(state.tier, 'high');
});

test('a tier steps down only after the hold, and back up the same way', () => {
  let state: Hysteresis = { tier: 'high', over: 0, under: 0 };
  state = stepTier(state, 40, 1.2, 16.7);
  state = stepTier(state, 40, 1.2, 16.7);
  assert.equal(state.tier, 'medium');
  state = stepTier(state, 4, 1.2, 16.7);
  state = stepTier(state, 4, 1.2, 16.7);
  assert.equal(state.tier, 'high');
});

test('percentile picks the high end of a sorted sample', () => {
  assert.equal(percentile([10, 30, 20, 40], 0.5), 20);
  assert.equal(percentile([10, 30, 20, 40], 0.95), 40);
});
