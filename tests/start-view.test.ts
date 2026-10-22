import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GLOBE_START, bareStart, startView } from '../src/world/globe/startView';

test('start view: a bare load opens the globe (Matthew 2026-10-22), with staged terrain and trees v2 for the descent', () => {
  for (const s of ['', '?']) { assert.equal(startView(s), 'globe'); assert.equal(bareStart(s), `?${GLOBE_START}`); }
  const q = new URLSearchParams(GLOBE_START);
  assert.equal(q.get('start'), 'globe'); assert.equal(q.get('stages'), '1'); assert.equal(q.get('trees'), 'v2');
  assert.equal(startView(`?${GLOBE_START}`), 'globe'); // the rewritten bare URL (and a reload of it) stays on the globe
  assert.equal(startView('?start=globe&hour=12'), 'globe'); // captures of the default start with other flags
});
test('start view: ?view=ground, ?at=, ?bench and every other explicit query keep the ground view; only bare is rewritten', () => {
  for (const s of ['?view=ground', '?start=globe&view=ground', '?at=10,20', '?start=globe&at=10,20,1.5', '?bench', '?start=globe&bench=zoom', '?trees=v2', '?hour=12&stages=1', '?transition=reload', '?nomenu'])
    assert.equal(startView(s), 'ground', s);
  for (const s of ['?at=1,2', '?view=ground', '?trees=v2']) assert.equal(bareStart(s), null, s);
});