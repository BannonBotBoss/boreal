import test from 'node:test';
import assert from 'node:assert/strict';
import { iceCover } from '../src/world/globe/planet';
import { iceLineM } from '../src/core/altitudeZones';

test('#402: low land at 78.5° is not forced to pure ice', () => {
  assert.equal(iceCover(20, iceLineM(78.5), 78.5), 0);
});
test('#402: polar ice fades in above 80° and is full by 86°', () => {
  const m = iceCover(20, iceLineM(83), 83);
  assert.ok(m > 0.2 && m < 0.8, String(m));
  assert.equal(iceCover(20, iceLineM(86), 86), 1);
});
test('land above the lapse-rate ice line is still ice', () => {
  assert.equal(iceCover(iceLineM(70) + 400, iceLineM(70), 70), 1);
});
