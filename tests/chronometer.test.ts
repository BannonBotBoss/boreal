import test from 'node:test';
import assert from 'node:assert/strict';
import { DAY, dayAt, hourAt, initDay, setHour, DAY_OF_YEAR, START_HOUR } from '../src/core/timeOfDay';
import { CHRONO, dialAngle, dialHour, scrubVelocity } from '../src/ui/chronometer';
import { ACTION } from '../src/core/bindings';
const near = (a: number, b: number, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);
test('setHour turns the dial (offset), not the world clock; shortest way round, date follows past midnight', () => {
  DAY.offset = 0; near(hourAt(0), START_HOUR);
  near(setHour(20, 600), 20); near(hourAt(600), 20); near(hourAt(900), 21); // the clock keeps running from the new hour
  const o = DAY.offset; near(setHour(2, 600), 2); near(DAY.offset - o, 6); // 20 → 02 goes forward 6 h, not back 18
  assert.equal(dayAt(600), DAY_OF_YEAR + 1);
  near(setHour(23, 600), 23); assert.equal(dayAt(600), DAY_OF_YEAR); // back over midnight: the previous day again
});
test('initDay: saved offset, then ?hour= makes it exactly that hour; bad values ignored', () => {
  initDay('', '3.5', 0); near(DAY.offset, 3.5);
  initDay('?hour=12&trees=v2', '3.5', 12345); near(hourAt(12345), 12);
  initDay('?hour=abc', null, 0); near(DAY.offset, 0); initDay('?hour=24', null, 0); near(DAY.offset, 0); initDay('?hour=', 'x', 0); near(DAY.offset, 0);
  initDay('?day=15&hour=12', null, 0); assert.equal(dayAt(0), 15); near(hourAt(0), 12);
  initDay('?day=abc&hour=12', null, 0); near(hourAt(0), 12); assert.equal(dayAt(0), DAY_OF_YEAR);
  DAY.offset = 0;
});
test('dial: noon top, 18 right, midnight bottom, 6 left; angle and point agree', () => {
  near(dialAngle(12), 0); near(dialAngle(18), 90); near(dialAngle(6), -90);
  near(dialHour(0, -1), 12); near(dialHour(1, 0), 18); near(dialHour(0, 1), 0); near(dialHour(-1, 0), 6);
  for (const h of [0.5, 7.25, 13, 21.9]) { const a = dialAngle(h) * Math.PI / 180; near(dialHour(Math.sin(a), -Math.cos(a)), h, 1e-9); }
});
test('scrub eases toward input × rate, clamps input, and settles at rest', () => {
  let v = 0; for (let i = 0; i < 120; i++) v = scrubVelocity(v, 1, 1 / 60); near(v, CHRONO.rate, 1e-3);
  assert.ok(scrubVelocity(0, 1, 1 / 60) < CHRONO.rate * .2, 'no jump on the first frame');
  near(scrubVelocity(0, -5, 10), -CHRONO.rate, 1e-6);
  for (let i = 0; i < 120; i++) v = scrubVelocity(v, 0, 1 / 60); assert.ok(Math.abs(v) < 1e-3);
});
test('the chronometer and planet view are bindable actions (T / D-pad up, Shift+G; View is the help overlay)', () => {
  assert.deepEqual([ACTION.chrono.keys, ACTION.chrono.pad, ACTION.planet.keys], [['k:t'], ['dup'], ['k:shift+k:g']]);
});
