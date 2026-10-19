import test from 'node:test';
import assert from 'node:assert/strict';
import { timescaleFrom } from '../src/core/timescale';

test('?timescale: 0.05-1 from the URL, anything else is real time', () => {
  assert.equal(timescaleFrom('?timescale=0.25'), .25);
  assert.equal(timescaleFrom('?loco=1&timescale=.5'), .5);
  assert.equal(timescaleFrom('?timescale=0.01'), .05); // floor
  assert.equal(timescaleFrom('?timescale=4'), 1); // never faster than real time
  for (const bad of ['', '?timescale=', '?timescale=0', '?timescale=-1', '?timescale=abc', '?at=1,2']) assert.equal(timescaleFrom(bad), 1, bad);
});