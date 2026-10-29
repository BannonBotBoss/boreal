// T-0044 run 14 (grok-gait): frameTouchdown - the planting FRAME, not the continuous instant (hand-worked values).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { frameTouchdown, timeToTouchdown } from '../src/animals/locomotion/touchdownPlan';
const close = (a: number, b: number, e = 1e-12) => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);
test('rounds the time left up to whole frames', () => {
  // hz 4, dt 1/120: one frame = 1/30 of phase. ph .95 -> dphi .05 = 1.5 frames -> 2 frames = 1/60 s, dphi 1/15
  const r = frameTouchdown(.95, 4, 1 / 120); close(r.tRem, 2 / 120); close(r.dphi, 2 * 4 / 120);
  // exactly on a frame: no extra frame
  const e = frameTouchdown(1 - 4 / 120, 4, 1 / 120); close(e.tRem, 1 / 120, 1e-12);
  // at least one frame
  close(frameTouchdown(1, 4, 1 / 120).tRem, 1 / 120);
});
test('never earlier than the continuous instant, at most one frame later', () => {
  for (const ph of [.81, .9, .97, .999]) for (const dt of [1 / 60, 1 / 240]) { const c = timeToTouchdown(ph, 5), f = frameTouchdown(ph, 5, dt);
    assert.ok(f.tRem >= c.tRem - 1e-12 && f.tRem < c.tRem + dt + 1e-12); }
});
test('dt <= 0 falls back to the continuous time', () => { assert.deepEqual(frameTouchdown(.9, 5, 0), timeToTouchdown(.9, 5)); });