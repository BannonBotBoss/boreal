/** Tree impostors for the mid-distance ring. Silhouettes, not solid rectangles. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canopyTile, treeAtlas, treeSprite } from '../src/render/trees/billboardAtlas';

function alphaAt(rgba: Uint8ClampedArray, size: number, x: number, y: number) {
  return rgba[(y * size + x) * 4 + 3];
}

test('a conifer is clear in the corner and solid in the crown, and the left side is the lit side', () => {
  const size = 64;
  const px = treeSprite('conifer', size);
  assert.equal(alphaAt(px, size, 0, size - 1), 0);
  assert.equal(alphaAt(px, size, size - 1, 0), 0);
  const mid = alphaAt(px, size, 32, 40);
  assert.equal(mid, 255);
  const left = px[(40 * size + 20) * 4 + 1];
  const right = px[(40 * size + 44) * 4 + 1];
  assert.ok(left > right, `sun on the left, ${left} vs ${right}`);
});

test('a broadleaf crown is an ellipse and the atlas holds both sprites', () => {
  const size = 64;
  const px = treeSprite('broadleaf', size);
  assert.equal(alphaAt(px, size, 32, 38), 255);
  assert.equal(alphaAt(px, size, 2, 2), 0);
  const atlas = treeAtlas(size);
  assert.equal(atlas.w, size * 2);
  assert.ok(atlas.rgba[(20 * atlas.w + 32) * 4 + 3] > 0, 'conifer half');
  assert.ok(atlas.rgba[(40 * atlas.w + size + 32) * 4 + 3] > 0, 'broadleaf half');
  const canopy = canopyTile();
  let solid = 0;
  for (let i = 3; i < canopy.length; i += 4) if (canopy[i] > 200) solid++;
  assert.ok(solid > 10 && solid < canopy.length / 4, `canopy crowns, not a solid sheet (${solid})`);
});
