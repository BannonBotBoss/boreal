import test from 'node:test';
import assert from 'node:assert/strict';
import { DIAL_DEADZONE, targetRateFromDial } from '../src/core/worldClock';
import { timescaleFrom } from '../src/core/timescale';

const lip = targetRateFromDial(DIAL_DEADZONE);
const near = (a: number, b: number, e = 1e-6) => assert.ok(Math.abs(a - b) <= e, `${a} vs ${b}`);

test('?timescale sets the one dial, from exactly 1× up to 10^12, and negative rewinds', () => {
  assert.equal(lip, 1);
  near(timescaleFrom('?timescale=0.25'), lip); // slower than real time cannot sit on the curve
  near(timescaleFrom('?loco=1&timescale=.5'), lip);
  near(timescaleFrom('?timescale=0.01'), lip);
  near(timescaleFrom('?timescale=1'), 1);
  near(timescaleFrom('?timescale=4'), 4); // the whole clock, including the sun
  near(timescaleFrom('?timescale=100'), 100); // the old ceiling of 16 is gone
  near(timescaleFrom('?timescale=1e15'), 1e12);
  near(timescaleFrom('?timescale=-100'), -100);
  near(timescaleFrom('?timescale=-1'), -1);
  for (const bad of ['', '?timescale=', '?timescale=0', '?timescale=abc', '?at=1,2']) near(timescaleFrom(bad), lip, 1e-9);
});
