/** Tree impostors for the mid-distance ring. Silhouettes, not solid rectangles. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canopyTile, treeAtlas, treeSprite } from '../src/render/trees/billboardAtlas';
import { CC0_TREES } from '../src/render/trees/cc0Impostors';
import { treeSlot } from '../src/render/horizonCover';
import { existsSync } from 'node:fs';

function alphaAt(rgba: Uint8ClampedArray, size: number, x: number, y: number) {
  return rgba[(y * size + x) * 4 + 3];
}

test('five CC0 Kenney trees are on disk, three pines and two broadleaf', () => {
  assert.equal(CC0_TREES.length, 5);
  assert.equal(CC0_TREES.filter(t => !t.broadleaf).length, 3);
  for (const t of CC0_TREES) assert.ok(existsSync('public' + t.url), t.url);
  assert.ok(existsSync('public/models/trees/LICENCE.txt'));
  const a = treeSlot('boreal', 0, 0);
  const b = treeSlot('boreal', 40, 12);
  assert.ok(a >= 0 && a < 3 && b >= 0 && b < 3);
  assert.ok(treeSlot('prairie', 3, 9) >= 3);
});

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
  const pixels = canopy.length / 4;
  assert.ok(solid > pixels * 0.35, `canopy should be a closed stand, got ${solid} of ${pixels}`);
  assert.ok(solid < pixels * 0.92, `canopy should keep a little ground, got ${solid}`);
});
