import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { remoteVideos, cardIndex, ECOLOGY_CARDS } from '../src/ui/loading';
test('loading cards cycle and the manifest parses', () => {
  assert.equal(cardIndex(0, 3, 7), 0); assert.equal(cardIndex(7.1, 3, 7), 1); assert.equal(cardIndex(21, 3, 7), 0); assert.equal(cardIndex(5, 0), 0);
  assert.ok(ECOLOGY_CARDS.length >= 5);
  assert.ok(Array.isArray(JSON.parse(readFileSync('public/loading/manifest.json', 'utf8')).videos));
});
test('only remote https clips are used', () => {
  assert.deepEqual(remoteVideos({ videos: [{ src: '/loading/a.mp4' }, { src: 'http://x/b.mp4' }, { src: 'https://x/c.mp4' }] }).map(v => v.src), ['https://x/c.mp4']);
  assert.deepEqual(remoteVideos({}), []);
});
