import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { autoplayLine, autoplayScenario } from '../src/input/autoplay';

test('autoplay is off unless the URL flag asks for it', () => {
  assert.equal(autoplayScenario(''), null);
  assert.equal(autoplayScenario('?start=globe'), null);
  assert.equal(autoplayScenario('?autoplay=0'), null);
  assert.equal(autoplayScenario('?autoplay=off'), null);
  assert.equal(autoplayScenario('?autoplay=false'), null);
  assert.equal(autoplayScenario('?autoplay=1'), 'matthew');
  assert.equal(autoplayScenario('?autoplay=matthew'), 'matthew');
  assert.equal(autoplayScenario('?autoplay=night'), 'night');
});

test('autoplay log line carries the step and the time', () => {
  assert.equal(autoplayLine(3, 'clicked Explore', 4.2), 'AUTOPLAY step 3: clicked Explore t=4.2s');
});

test('the autoplay driver does not import simulation', () => {
  const src = readFileSync(join(import.meta.dirname, '../src/input/autoplay.ts'), 'utf8');
  assert.doesNotMatch(src, /from '\.\.\/(core|animals|world|proc|render)/);
});
