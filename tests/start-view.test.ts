import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GLOBE_START, SPHERE_START, bareStart, startView } from '../src/world/globe/startView';

test('start view: a bare load opens the hot sphere, and keeps staged terrain and trees v2 for the forest', () => {
  for (const s of ['', '?']) { assert.equal(startView(s), 'sphere'); assert.equal(bareStart(s), `?${SPHERE_START}`); }
  const q = new URLSearchParams(SPHERE_START);
  assert.equal(q.get('start'), 'sphere');
  assert.equal(q.get('stages'), '1');
  assert.equal(q.get('trees'), 'v2');
  assert.equal(q.get('start') === 'globe', false);
  assert.equal(startView(`?${SPHERE_START}`), 'sphere');
  const main = readFileSync('src/main.ts', 'utf8');
  assert.match(main, /opened === 'sphere'/);
  assert.match(main, /createOpening\(/);
});

test('start view: ?start=globe is the shortcut to the planet, and other queries keep the ground', () => {
  assert.equal(startView(`?${GLOBE_START}`), 'globe');
  assert.equal(startView('?start=globe'), 'globe');
  assert.equal(startView('?start=globe&hour=12'), 'globe');
  assert.equal(bareStart('?start=globe'), null);
  for (const s of ['?view=ground', '?start=globe&view=ground', '?at=10,20', '?start=globe&at=10,20,1.5', '?bench', '?start=globe&bench=zoom', '?trees=v2', '?hour=12&stages=1', '?transition=reload', '?nomenu'])
    assert.equal(startView(s), 'ground', s);
  for (const s of ['?at=1,2', '?view=ground', '?trees=v2', '?start=globe']) assert.equal(bareStart(s), null, s);
});
