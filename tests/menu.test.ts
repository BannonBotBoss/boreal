import test from 'node:test'; import assert from 'node:assert/strict';
import { moveFocus, tierChoice } from '../src/ui/menu';
import { mintUniverseSeed, worldSeedFromUniverse } from '../src/core/universeSeed';
test('start menu focus wraps and tier choice warns only above the probe cap', () => {
  assert.equal(moveFocus(0, -1, 5), 4); assert.equal(moveFocus(4, 1, 5), 0); assert.equal(moveFocus(0, 1, 0), 0);
  assert.equal(tierChoice(3, 2).warn, ''); assert.equal(tierChoice(2, 2).warn, ''); assert.match(tierChoice(0, 2).warn, /above/);
});
test('Generate universe seeds differ across mints and each maps to a stable world seed', () => {
  const a = mintUniverseSeed(() => 0.2, () => 10);
  const b = mintUniverseSeed(() => 0.8, () => 20);
  assert.notEqual(a, b);
  assert.equal(worldSeedFromUniverse(a), worldSeedFromUniverse(a));
});
