/** #192 ten-site finding 1: the Egypt desert click read boreal because vegetation came from the seeded planet.
 *  The landing now reads vegetation from the cached Sentinel-2 photo. Colours are linear-RGB 16x16 means of
 *  Sentinel-2 cloudless 2021 z12 tiles at each site (measured 2026-11-01). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { vegetationFromPhoto } from '../src/world/globe/openTiles';
import { coverKind } from '../src/world/globe/coverKind';

const SITES: [string, number, [number, number, number], string][] = [
  ['Manitoba forest', 52, [0.021, 0.055, 0.025], 'boreal'],
  ['Rondonia forest', -7.1, [0.005, 0.026, 0.008], 'tropical'],
  ['Kansas cropland', 38.5, [0.071, 0.073, 0.026], 'prairie'],
  ['Saskatchewan grass', 51, [0.142, 0.107, 0.046], 'prairie'],
  ['Montana grass', 47.9, [0.198, 0.121, 0.056], 'prairie'],
  ['Mojave', 35, [0.518, 0.328, 0.167], 'desert'],
  ['Egypt desert', 27.4, [0.946, 0.524, 0.2], 'desert'],
  ['Sahara', 23, [0.99, 0.453, 0.147], 'desert'],
];

for (const [name, lat, rgb, want] of SITES) {
  test(`${name} photo reads ${want}`, () => {
    assert.equal(coverKind(lat, 300, vegetationFromPhoto(rgb), false), want);
  });
}

test('photo vegetation stays in 0..1 and black is not forest', () => {
  for (const c of [[0, 0, 0], [1, 1, 1], [0, 1, 0], [1, 0, 0]] as [number, number, number][]) {
    const v = vegetationFromPhoto(c);
    assert.ok(v >= 0 && v <= 1);
  }
  assert.ok(vegetationFromPhoto([0, 0, 0]) < 0.62);
});
