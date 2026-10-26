import test from 'node:test';
import assert from 'node:assert/strict';
import { timescaleFrom } from '../src/core/timescale';

test('?timescale is the one clock rate, clamped to 0.05-16', () => {
  assert.equal(timescaleFrom('?timescale=0.25'), .25);
  assert.equal(timescaleFrom('?loco=1&timescale=.5'), .5);
  assert.equal(timescaleFrom('?timescale=0.01'), .05); // floor
  assert.equal(timescaleFrom('?timescale=4'), 4); // the whole clock, including sun and ground
  assert.equal(timescaleFrom('?timescale=100'), 16); // ceiling
  for (const bad of ['', '?timescale=', '?timescale=0', '?timescale=-1', '?timescale=abc', '?at=1,2']) assert.equal(timescaleFrom(bad), 1, bad);
});