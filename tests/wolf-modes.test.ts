import test from 'node:test';
import assert from 'node:assert/strict';
import { createWolfModes, stepWolfModes } from '../src/core/wolfModes';
test('trigger order selects sprint or super stealth and remains latched until release', () => {
  let right = stepWolfModes(createWolfModes(), 0, 1, true, .1);
  assert.equal(right.mode, 'run');
  right = stepWolfModes(right, 1, 1, true, .1); assert.equal(right.mode, 'sprint');
  let left = stepWolfModes(createWolfModes(), 1, 0, true, .1);
  assert.equal(left.mode, 'stealth');
  left = stepWolfModes(left, 1, 1, true, .1); assert.equal(left.mode, 'super-stealth');
  left = stepWolfModes(left, 0, 1, true, .1);
  assert.equal(stepWolfModes(left, 1, 1, true, .1).mode, 'super-stealth');
  left = stepWolfModes(left, 0, 0, false, .1);
  assert.equal(left.first, null);
  assert.equal(stepWolfModes(left, 1, 1, false, .1).mode, 'super-stealth');
});
test('T-0036: sprint lasts at least 10 s from full, cannot be retriggered by holding, and exhaustion needs a breather', () => {
  let state = stepWolfModes(createWolfModes(), 0, 1, true, .1);
  let sprinted = 0;
  for (let i = 0; i < 400 && !state.exhausted; i++) { state = stepWolfModes(state, 1, 1, true, .1); if (state.mode === 'sprint') sprinted += .1; }
  assert.ok(sprinted >= 10, `sprint ${sprinted.toFixed(1)} s`); assert.ok(Math.abs(sprinted - 12) < .25);
  assert.equal(state.mode, 'walk'); assert.ok(state.exhausted); assert.ok(state.sprintSpent); assert.ok(state.stamina >= 0);
  state = stepWolfModes(state, 1, 1, true, .1); assert.equal(state.mode, 'walk'); // held triggers: still a breather
  for (let i = 0; i < 100; i++) state = stepWolfModes(state, 0, 0, false, .1);
  assert.equal(state.stamina, 100); assert.equal(state.exhausted, false);
  assert.equal(stepWolfModes(state, 0, 1, true, .1).mode, 'run');
});
test('idle running drains no stamina and trigger thresholds resist jitter', () => {
  const state = stepWolfModes(createWolfModes(), 0, .3, false, 1);
  assert.equal(state.stamina, 100);
  assert.equal(stepWolfModes(state, 0, .2, false, .1).mode, 'run');
  assert.equal(stepWolfModes(state, 0, .1, false, .1).mode, 'walk');
});

test('T-0036: running lasts at least 30 s (36 s) from full stamina; recovery refills in 10 s', () => {
  let state = createWolfModes(), ran = 0;
  for (let i = 0; i < 1000 && !state.exhausted; i++) { state = stepWolfModes(state, 0, 1, true, .1); if (state.mode === 'run') ran += .1; }
  assert.ok(ran >= 30, `run ${ran.toFixed(1)} s`); assert.ok(Math.abs(ran - 36) < .25);
  assert.equal(state.exhausted, true);
  state = stepWolfModes(state, 0, 0, false, 1);
  assert.equal(state.stamina, 10);
});
