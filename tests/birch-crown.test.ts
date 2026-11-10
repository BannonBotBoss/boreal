/** Paper birch is an oval crown, not a green icosahedron on a stick. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crownShape, isLollipop } from '../src/render/trees';

test('a paper birch crown is an oval of many vertices, not one ball', () => {
  for (const detail of [1, 2]) {
    const shape = crownShape('paper-birch', 1, detail);
    assert.ok(!isLollipop(shape), JSON.stringify(shape));
    assert.ok(shape.aspect > 1.15, `aspect ${shape.aspect}`);
    assert.ok(shape.n > 120, `vertices ${shape.n}`);
  }
});

test('jack pine is not a ball either', () => {
  const shape = crownShape('jack-pine', 2, 2);
  assert.ok(!isLollipop(shape), JSON.stringify(shape));
});
