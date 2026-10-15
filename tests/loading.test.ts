import test from 'node:test'; import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { manifestCards, cardIndex, FALLBACK_CARDS } from '../src/ui/loading';
test('loading cards cycle and the manifest parses', () => {
  assert.equal(cardIndex(0, 3, 7), 0); assert.equal(cardIndex(7.1, 3, 7), 1); assert.equal(cardIndex(21, 3, 7), 0); assert.equal(cardIndex(5, 0), 0);
  assert.ok(FALLBACK_CARDS.length >= 1);
  const m = JSON.parse(readFileSync('public/loading/manifest.json', 'utf8')), cards = manifestCards(m);
  assert.equal(cards.length, m.cards.length, 'every manifest card is valid'); assert.ok(cards.length >= 8);
  for (const c of cards) { assert.ok(c.source, 'every fact is sourced'); assert.ok(existsSync('public' + c.image), c.image); assert.ok(statSync('public' + c.image).size < 400_000); }
});
test('manifest cards: fact required, local webp art only', () => {
  assert.deepEqual(manifestCards({ cards: [{ fact: '' }, { fact: 'a', image: 'https://x/y.webp' }, { fact: 'b', image: '/loading/cards/ok-1.webp' }, { fact: 'c' }] }).map(c => c.fact), ['b', 'c']);
  assert.deepEqual(manifestCards(null), []);
});
