import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHidden, layerStates, deepOffset, DEFAULT_HIDDEN, stateText } from '../src/world/globe/layerPanel';

test('layer panel: ?hide beats storage, storage beats defaults, unknown ids dropped', () => {
  assert.deepEqual([...parseHidden('', null)], DEFAULT_HIDDEN);
  assert.deepEqual([...parseHidden('', 'clouds,bogus')], ['clouds']);
  assert.deepEqual([...parseHidden('?hide=aurora', 'clouds')], ['aurora']);
  assert.deepEqual([...parseHidden('?hide=', 'clouds')], []);
  assert.equal(deepOffset('?deep=-3e9'), -3e9);
});
test('layer panel: existence from deep time gates "on" (not yet formed / gone)', () => {
  const now = layerStates(new Set(), 0); for (const s of Object.values(now)) assert.equal(s.on, true, s.id);
  const hadean = layerStates(new Set(), -4.5e9);
  assert.equal(hadean.ocean.exists, 'not-yet-formed'); assert.equal(hadean.ocean.on, false); assert.equal(stateText(hadean.ocean), 'not yet formed');
  assert.equal(layerStates(new Set(), -300e6).vegetation.on, true);
  assert.equal(layerStates(new Set(), -700e6).vegetation.exists, 'not-yet-formed');
  const future = layerStates(new Set(), 2e9); assert.equal(future.ocean.exists, 'gone'); assert.equal(stateText(future.ocean), 'gone');
  assert.equal(layerStates(new Set(['clouds']), 0).clouds.on, false);
});
