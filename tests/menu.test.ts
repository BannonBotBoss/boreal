import test from 'node:test'; import assert from 'node:assert/strict';
import { moveFocus, tierChoice } from '../src/ui/menu';
test('start menu focus wraps and tier choice warns only above the probe cap', () => {
  assert.equal(moveFocus(0, -1, 5), 4); assert.equal(moveFocus(4, 1, 5), 0); assert.equal(moveFocus(0, 1, 0), 0);
  assert.equal(tierChoice(3, 2).warn, ''); assert.equal(tierChoice(2, 2).warn, ''); assert.match(tierChoice(0, 2).warn, /above/);
});
