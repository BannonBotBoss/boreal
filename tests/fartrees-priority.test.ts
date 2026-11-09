import test from 'node:test';
import assert from 'node:assert/strict';
import { FAR_TREE_PRIORITY } from '../src/render/flora/fartrees';
import { INTEREST } from '../src/core/interest';

test('horizon trunks run before the grass at the mid edge', () => {
  assert.equal(FAR_TREE_PRIORITY, 9);
  assert.ok(FAR_TREE_PRIORITY > 5, 'the grass under the player (distance 0 + 5) still goes first');
  assert.ok(FAR_TREE_PRIORITY > 4, 'the near Weber–Penn build at priority 4 still goes first');
  assert.ok(FAR_TREE_PRIORITY < INTEREST.mid + 5, 'a refill at 60 never started while mid-edge grass stayed queued');
});
