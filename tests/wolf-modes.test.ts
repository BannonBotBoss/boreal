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
test('sprint expires, cannot be retriggered by holding, and running exhausts stamina', () => {
  let state = stepWolfModes(createWolfModes(), 0, 1, true, .1);
  for (let i = 0; i < 17; i++) state = stepWolfModes(state, 1, 1, true, .1);
  assert.equal(state.mode, 'run'); assert.ok(state.sprintSpent);
  for (let i = 0; i < 200; i++) state = stepWolfModes(state, 1, 1, true, .1);
  assert.equal(state.mode, 'walk'); assert.ok(state.exhausted); assert.ok(state.stamina >= 0);
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

test('running lasts fourteen seconds from full stamina with unchanged recovery', () => {
  let state = createWolfModes();
  for (let i=0;i<140;i++) state=stepWolfModes(state,0,1,true,.1);
  assert.equal(state.mode,'run'); assert.ok(Math.abs(state.stamina-2)<1e-8);
  for (let i=0;i<3;i++) state=stepWolfModes(state,0,1,true,.1);
  assert.equal(state.exhausted,true);
  state=stepWolfModes(state,0,0,false,1);
  assert.equal(state.stamina,10);
});
