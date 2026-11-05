import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DANGER_M, HEARING_M, PROTECT_COMMIT, SIGHT_M, SMELL_M,
  bodyKg, dangerOf, diet, effort, hungerRate, inFocus, resetDrives, scentOf, stepDrives,
} from '../src/core/drives';

test('a fox is a carnivore, a pup is cheap, and smell outranges sight', () => {
  assert.equal(diet('Red Fox'), 'carnivore');
  assert.equal(diet('Snowshoe Hare'), 'herbivore');
  assert.ok(hungerRate('Red Fox') > hungerRate('Gray Wolf'));
  const pup = effort(bodyKg('Red Fox'), bodyKg('pup'));
  const mama = effort(bodyKg('Red Fox'), bodyKg('Gray Wolf'));
  assert.ok(pup < 0.4, `pup effort ${pup}`);
  assert.ok(mama > 100, `mama effort ${mama}`);
  assert.ok(SMELL_M > SIGHT_M && SMELL_M > HEARING_M);
  assert.ok(scentOf(5) > scentOf(30));
  assert.equal(inFocus(25, false), false);
  assert.equal(inFocus(25, true), true);
});

test('on the ring the fox circles until the mother commits', () => {
  resetDrives({ x: 9.5, z: 0 });
  const now = stepDrives(0, 0, 0, 1.2, 0.2, true, 0.2);
  assert.equal(now.mode, 'linger');
  assert.ok(now.protect < PROTECT_COMMIT);
  assert.equal(now.committed, false);
  assert.equal(now.mamaX, 0);
});

test('inside the ring the fox backs out before she charges', () => {
  resetDrives({ x: 4, z: 0 });
  const now = stepDrives(0, 0, 0, 1, 0.2, false, 0.5);
  assert.equal(now.mode, 'linger');
  assert.ok(now.foxX > 4, `backed away to ${now.foxX}`);
  assert.ok(now.protect < PROTECT_COMMIT);
});

test('once she commits the fox flees and she steps toward it', () => {
  resetDrives({ x: 9.5, z: 0, protect: 1 });
  const now = stepDrives(0, 0, 0, 1.2, 0.2, true, 0.2);
  assert.equal(now.mode, 'flee');
  assert.ok(now.foxX > 9.5, `fled to ${now.foxX}`);
  assert.ok(now.mamaX > 0, 'she stepped toward the fox');
  assert.ok(now.danger > dangerOf(9.5, false));
  assert.equal(now.threat, 1);
});

test('a stray pup is approachable and a far scent is only a watch', () => {
  resetDrives({ x: 20, z: 0, hunger: 0.9 });
  const stray = stepDrives(0, 0, 0, 8, 0, true, 0.2);
  assert.equal(stray.mode, 'approach');
  resetDrives({ x: 28, z: 0 });
  const far = stepDrives(0, 0, 0, 1, 0.2, false, 0.2);
  assert.equal(far.mode, 'watch');
  assert.ok(far.scent > 0.05);
  assert.equal(inFocus(28, false), false);
  assert.equal(DANGER_M, 8);
});
