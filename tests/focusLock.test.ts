import test from 'node:test';
import assert from 'node:assert/strict';
import { FOCUS, pickFocus, focusSteer } from '../src/core/focusLock';
import { defaults, conflicts } from '../src/core/bindings';
import { SYSTEM_PROPERTIES } from '../src/config/systemProperties';

const herb = { key: 'h', kind: 'plant', x: 0, z: -3 }, far = { key: 'f', kind: 'deer', x: 0, z: -20 }, behind = { key: 'b', kind: 'plant', x: 0, z: 4 };
const P = { x: 0, z: 0, view: 0 }; // heading 0 faces -z

test('focus engages only while the button is held', () => {
  assert.equal(pickFocus(false, undefined, P, [herb]), undefined);
  assert.equal(pickFocus(true, undefined, P, [herb])?.key, 'h');
  assert.equal(pickFocus(false, herb, P, [herb]), undefined, 'release drops it');
});

test('focus needs an interactable object within the radius, in front', () => {
  assert.equal(pickFocus(true, undefined, P, [far]), undefined, '20 m is out of range');
  assert.equal(FOCUS.radius, SYSTEM_PROPERTIES.focus.radius, 'the radius comes from the system properties file');
  assert.equal(pickFocus(true, undefined, P, [behind]), undefined, 'behind the wolf is outside the cone');
  assert.equal(pickFocus(true, undefined, P, [{ key: 'r', kind: 'rock', x: 0, z: -2 }]), undefined, 'pebbles are not focus targets');
  const edge = { key: 'e', kind: 'plant', x: 0, z: -FOCUS.radius + .1 };
  assert.equal(pickFocus(true, undefined, P, [edge])?.key, 'e');
  assert.equal(pickFocus(true, edge, { x: 0, z: 1, view: 0 }, [edge]), undefined, 'leaving the radius drops focus');
  const centred = { key: 'c', kind: 'plant', x: 0, z: -4 }, side = { key: 's', kind: 'plant', x: 3, z: -2 };
  assert.equal(pickFocus(true, undefined, P, [side, centred])?.key, 'c', 'near and centred wins');
  assert.equal(pickFocus(true, side, P, [side, centred])?.key, 's', 'the held pick is kept while in range');
});

test('steering only while moving forward, smooth at the turn rate', () => {
  const right = { key: 'r', kind: 'plant', x: 2, z: -2 }, dt = 1 / 30;
  assert.equal(focusSteer(0, P, right, 0, 0, dt), undefined, 'standing still: no turn');
  assert.equal(focusSteer(0, P, right, -1, 0, dt), undefined, 'backing up: no turn');
  assert.equal(focusSteer(0, P, right, 1, .8, dt), undefined, 'hand steering wins');
  const d = focusSteer(0, P, right, 1, 0, dt)!;
  assert.ok(Math.abs(d) <= FOCUS.turnRate * dt + 1e-12 && d < 0, 'clamped turn toward +x (heading decreases)');
  let h = 0; for (let i = 0; i < 60; i++) h += focusSteer(h, P, right, 1, 0, dt) ?? 0;
  assert.ok(Math.abs(h - Math.atan2(-2, 2)) < 1e-6, 'converges on the bearing without overshoot');
  assert.equal(focusSteer(0, P, undefined, 1, 0, dt), undefined);
});

test('focus has its own binding (LB / F) with no conflicts', () => {
  const b = defaults(); assert.deepEqual(b.focus, { keys: ['k:f'], pad: ['lb'] });
  assert.equal(conflicts(b).length, 0);
});