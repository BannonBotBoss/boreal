import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addTextChunks, readTextChunks, crc32 } from '../src/camera/png';
import { FILTERS, filter, filterStops, applyFilter, reaches } from '../src/camera/filters';
import { hasBadge } from '../src/camera/badges';

// smallest valid PNG: 1x1 grey (signature, IHDR, IDAT, IEND)
const PNG = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGNgAAAAAgABSK+kcQAAAABJRU5ErkJggg==', 'base64'));
test('PNG tEXt metadata round-trips and CRC is the standard one', () => {
  assert.equal(crc32(new TextEncoder().encode('IEND')), 0xae426082);
  const out = addTextChunks(PNG, { 'Boreal-Camera': '{"N":8}', Software: 'Boreal' });
  assert.deepEqual(readTextChunks(out), { 'Boreal-Camera': '{"N":8}', Software: 'Boreal' });
  assert.equal(out.length, PNG.length + 12 * 2 + 'Boreal-Camera'.length + 1 + 7 + 'Software'.length + 1 + 6);
});
test('filters are linear light operations; atmosphere blocks UV/EUV/X-ray at the ground', () => {
  assert.deepEqual(applyFilter(filter('visible'), [.2, .3, .4]), [.2, .3, .4]);
  const l = applyFilter(filter('luminance'), [1, 1, 1]); assert.ok(Math.abs(l[0] - 1) < 1e-9 && l[0] === l[2]);
  assert.ok(filterStops(filter('halpha')) > 10, 'narrowband loses >10 stops');
  for (const id of ['uv', 'euv', 'xray'] as const) { assert.equal(reaches(filter(id), false), false); assert.equal(filterStops(filter(id)), Infinity); }
  assert.equal(FILTERS.some(f => /polar|infra/i.test(f.label)), false, 'polarizer/IR stay TODO until causal');
});
test('badges: auto + shutter free, gated controls allowed by stub, unlockAll', () => {
  assert.equal(hasBadge('camera.shutter', ''), true); assert.equal(hasBadge('camera.exposure', ''), true);
  (globalThis as any).borealBadges = { has: () => false };
  assert.equal(hasBadge('camera.filters', ''), false); assert.equal(hasBadge('camera.filters', '?unlockAll=1'), true); assert.equal(hasBadge('camera.auto', ''), true);
  delete (globalThis as any).borealBadges;
});
