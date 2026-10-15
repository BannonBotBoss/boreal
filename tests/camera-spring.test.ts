import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PITCH, LOOK_PITCH_RANGE, springLookPitch } from '../src/render/math';

test('held vertical stick is proportional and bounded instead of accumulating', () => {
  for (const input of [-2, -1, -.5, .5, 1, 2]) {
    let pitch = DEFAULT_PITCH;
    for (let frame = 0; frame < 600; frame++) {
      pitch = springLookPitch(pitch, input, 1 / 60);
      assert.ok(Math.abs(pitch - DEFAULT_PITCH) <= LOOK_PITCH_RANGE + 1e-10);
    }
    const expected = DEFAULT_PITCH + Math.max(-1, Math.min(1, input)) * LOOK_PITCH_RANGE;
    assert.ok(Math.abs(pitch - expected) < 1e-10);
  }
});

test('release returns within half a degree in 0.3 seconds without overshoot at any frame rate', () => {
  for (const hz of [30, 60, 120]) for (const direction of [-1, 1]) {
    let pitch = DEFAULT_PITCH + direction * LOOK_PITCH_RANGE;
    for (let frame = 0; frame < hz * .3; frame++) {
      const next = springLookPitch(pitch, 0, 1 / hz);
      assert.ok((next - DEFAULT_PITCH) * direction >= 0);
      assert.ok(Math.abs(next - DEFAULT_PITCH) < Math.abs(pitch - DEFAULT_PITCH));
      pitch = next;
    }
    assert.ok(Math.abs(pitch - DEFAULT_PITCH) < .5 * Math.PI / 180);
  }
});

test('mouse can hold a bounded tilt and springs home on release', () => {
  const held = springLookPitch(DEFAULT_PITCH, 0, 1, 20);
  assert.ok(held <= DEFAULT_PITCH + LOOK_PITCH_RANGE);
  assert.ok(Math.abs(springLookPitch(held, 0, .3) - DEFAULT_PITCH) < .5 * Math.PI / 180);
});
