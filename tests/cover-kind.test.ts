/** Placeholder cover rule for the drone (T-0112). Not a species range. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coverKind, coverSpacingM, coverSpots } from '../src/world/globe/coverKind';

test('water, ice, tundra, desert, prairie and boreal follow the latitude breaks', () => {
  assert.equal(coverKind(50, 300, 0.8, true), 'water');
  assert.equal(coverKind(80, 0, 0.2, false), 'ice');
  assert.equal(coverKind(64, 40, 0.2, false), 'tundra');
  assert.equal(coverKind(50, 1200, 0.2, false), 'rock');
  assert.equal(coverKind(25, 400, 0.1, false), 'desert');
  assert.equal(coverKind(42, 300, 0.4, false), 'prairie');
  assert.equal(coverKind(52, 300, 0.8, false), 'boreal');
  assert.equal(coverSpacingM('water'), null);
  assert.equal(coverSpacingM('boreal'), 6);
  assert.ok((coverSpacingM('prairie') ?? 0) > (coverSpacingM('boreal') ?? 0));
});

test('billboards stay outside the near meshes and under the cap', () => {
  const spots = coverSpots(0, 0, 'boreal', 36, 200, 80);
  assert.ok(spots.length > 0 && spots.length <= 80);
  for (const s of spots) {
    const d = Math.hypot(s.x, s.z);
    assert.ok(d >= 36 && d <= 200);
  }
  assert.equal(coverSpots(0, 0, 'tundra').length, 0);
});
