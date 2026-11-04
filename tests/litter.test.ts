import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ageAfter, birthPlaces, followStep, growthStage, LITTER, pupScale, stepHz, trailBackM, trailSlot, walkMps } from '../src/core/litter';

test('five pups are born on the den ring at four weeks and walk toward their mother', () => {
  const born = birthPlaces(21.5, 8.5);
  assert.equal(born.length, LITTER.count);
  assert.equal(growthStage(LITTER.emergeYears), 'pup');
  for (const pup of born) {
    assert.ok(Math.abs(Math.hypot(pup.x - 21.5, pup.z - 8.5) - LITTER.denRingM) < 1e-9);
    assert.ok(Math.abs(pup.ageYears - 4 / 52) < 1e-12);
  }
  const slot = trailSlot(0, 0, 0, 0);
  const before = Math.hypot(slot.x, slot.z);
  const stepped = followStep(0, 0, 0, 0, 0, 0, 1);
  assert.ok(Math.hypot(slot.x - stepped.x, slot.z - stepped.z) < before - 0.5);
  const stayed = followStep(slot.x, slot.z, 0, 0, 0, 0, 1);
  assert.ok(Math.abs(stayed.x - slot.x) < 1e-9 && Math.abs(stayed.z - slot.z) < 1e-9);
  let x = born[0].x, z = born[0].z;
  for (let i = 0; i < 40; i++) ({ x, z } = followStep(x, z, 0, 30, 0, -0.35, 0.5));
  const trail = trailSlot(0, 30, 0, -0.35);
  assert.ok(Math.hypot(x - trail.x, z - trail.z) < Math.hypot(born[0].x - trail.x, born[0].z - trail.z));
});

test('ten real minutes at the default clock grows the litter', () => {
  const tenMin = 7200;
  const older = ageAfter(LITTER.emergeYears, tenMin);
  assert.ok(Math.abs(older - (LITTER.emergeYears + 0.5)) < 1e-9);
  assert.ok(pupScale(older) > pupScale(LITTER.emergeYears) + 0.3);
  assert.ok(trailBackM(older) < trailBackM(LITTER.emergeYears));
  assert.ok(walkMps(older) > walkMps(LITTER.emergeYears));
  assert.ok(stepHz(older) < stepHz(LITTER.emergeYears));
  assert.equal(ageAfter(older, -100), older);
  const young = trailSlot(2, 0, 0, 0, LITTER.emergeYears);
  const grown = trailSlot(2, 0, 0, 0, older);
  assert.ok(Math.hypot(grown.x, grown.z) < Math.hypot(young.x, young.z));
});
