// T-0044 run 12 (grok-gait): jointSwing.ts, the pure joint-space helpers (hand-worked values).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jointGate, segments, fromSegments, limitStep, blendJoints, shoulderAt, jointStep2 } from '../src/animals/locomotion/jointSwing';
const close = (a: number, b: number, e = 1e-12) => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);
test('jointGate: 2 x 88 deg / t_stance x dt', () => {
  close(jointGate(.14, 4.2, 1 / 240), 2 * 88 * Math.PI / 180 * 4.2 / .14 / 240);
  close(jointGate(.5, 1, .5, 90, 1), Math.PI / 2);
});
test('segments and fromSegments are inverse', () => {
  const a = { girdle: .3, leg: -.5, knee: 1.1, wrist: -.4 }, s = segments(a);
  close(s[0], .3); close(s[1], -.2); close(s[2], 1.1); close(s[3], .5);
  const b = fromSegments(s); close(b.girdle, a.girdle); close(b.leg, a.leg); close(b.knee, a.knee); close(b.wrist, a.wrist);
});
test('limitStep clamps every segment turn to max and passes small steps', () => {
  const p = { girdle: 0, leg: 0, knee: 0, wrist: 0 };
  const r = limitStep(p, { girdle: .05, leg: 0, knee: 1, wrist: -1.5 }, .1), s = segments(r); // next manus .05 + 1 - 1.5 = -.45
  close(s[0], .05); close(s[1], .05); close(s[2], .1); close(s[3], -.1);
});
test('limitStep takes the short way round', () => {
  const r = limitStep({ girdle: 3.1, leg: 0, knee: 0, wrist: 0 }, { girdle: -3.1, leg: 6.2, knee: 0, wrist: -6.2 }, .1);
  close(segments(r)[0], 3.1 + (2 * Math.PI - 6.2));
});
test('blendJoints follows the Cheetah cubic Bezier (u .5 -> half way, ends exact)', () => {
  const a = { girdle: 0, leg: 0, knee: 0, wrist: 0 }, b = { girdle: .5, leg: .5, knee: .5, wrist: .5 }; // segments .5 1 .5 2
  const m = segments(blendJoints(a, b, .5)), e = segments(blendJoints(a, b, 1)), z = segments(blendJoints(a, b, 0));
  close(m[0], .25); close(m[1], .5); close(m[2], .25); close(m[3], 1);
  close(e[3], 2); close(z[3], 0);
});
test('shoulderAt: top plus the girdle bone along (-sin, -cos)', () => {
  const s = shoulderAt({ z: .01, y: .157 }, .063, .6);
  close(s.z, .01 - .063 * Math.sin(.6)); close(s.y, .157 - .063 * Math.cos(.6));
});
test('jointStep2 is the squared largest segment turn', () => {
  close(jointStep2(.1, -.3, .2, 0), .09);
  close(jointStep2(2 * Math.PI + .05, 0, 0, 0), .0025, 1e-9);
});