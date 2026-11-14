import test from 'node:test';
import assert from 'node:assert/strict';
import { litterFollowsPlayer, pictureSpecies, sensesTitle } from '../src/render/playables';

test('the embodied body is not labelled a wolf, and the senses title follows it', () => {
  assert.equal(pictureSpecies('wolf'), 'Gray Wolf');
  assert.equal(pictureSpecies('hare'), 'Snowshoe Hare');
  assert.equal(pictureSpecies('deer'), 'White-tailed Deer');
  assert.equal(pictureSpecies('nope'), 'Gray Wolf');
  assert.equal(sensesTitle('Grey wolf'), 'Grey wolf senses');
  assert.equal(sensesTitle('Snowshoe hare'), 'Snowshoe hare senses');
  assert.ok(!sensesTitle('Snowshoe hare').startsWith('Wolf'));
  assert.equal(litterFollowsPlayer('wolf'), true);
  assert.equal(litterFollowsPlayer('hare'), false);
});
