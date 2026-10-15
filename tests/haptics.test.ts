import test from 'node:test';
import assert from 'node:assert/strict';
import { softWall, createWallFeedback, createHaptics, HAPTIC_EVENTS, SOUND_HAPTICS, HAPTIC_CATS, FEEL } from '../src/ui/haptics.ts';
import { sliderWall, defaultGenome } from '../src/core/genome.ts';

test('soft wall: linear inside, eased in the zone, exact hard stop, overshoot never applied', () => {
  assert.equal(softWall(.5, 0, 1).value, .5);
  const a = softWall(.95, 0, 1); assert.ok(a.value > .9 && a.value < .95 && !a.wall);   // resistance: moves less than raw
  const e = softWall(1.1, 0, 1); assert.equal(e.value, 1); assert.ok(e.wall);          // reaches the bound one zone past
  const far = softWall(5, 0, 1); assert.equal(far.value, 1); assert.ok(far.push > 1);   // hard stop, push measured
  assert.equal(softWall(-3, 0, 1).value, 0);
  for (let r = -1; r <= 2; r += .01) { const v = softWall(r, 0, 1).value; assert.ok(v >= 0 && v <= 1); }
  let prev = -Infinity; for (let r = -1; r <= 2; r += .01) { const v = softWall(r, 0, 1).value; assert.ok(v >= prev - 1e-12); prev = v; } // monotonic
  assert.equal(sliderWall(defaultGenome(), 'size', 1.6).value, 1.6); assert.ok(sliderWall(defaultGenome(), 'size', 1.6).wall);
});
test('wall feedback fires once per wall hit, not per frame', () => {
  let n = 0; const fb = createWallFeedback({}, () => { n++; });
  for (let i = 0; i < 60; i++) fb.update('h', true, .5); assert.equal(n, 1);
  fb.update('h', false); fb.update('h', true); assert.equal(n, 2); fb.update('other', true); assert.equal(n, 3);
});
test('haptic table: every entry fires through the dispatcher, rate-limited, categories + falloff respected', () => {
  let t = 0; const calls: string[] = []; let id = '';
  const h = createHaptics({}, () => t, (s, w, ms) => { calls.push(`${id}:${ms}`); });
  for (id of Object.keys(HAPTIC_EVENTS)) { t += 10000; assert.ok(h(id), id); }
  assert.ok(Object.values(SOUND_HAPTICS).every(e => e in HAPTIC_EVENTS));
  calls.length = 0; id = 'click'; t += 10000; h('click'); for (let i = 0; i < 15; i++) { t += 5; h('click'); } assert.equal(calls.length, 1); // 80 ms limit
  t += 10; assert.ok(h('click'));
  t += 10000; assert.equal(h('howl', 50), false); assert.ok(h('howl', 10));              // falloff 40 m
  HAPTIC_CATS.ui = false; t += 10000; assert.equal(h('shutter'), false); HAPTIC_CATS.ui = true;
  FEEL.haptics = false; t += 10000; assert.equal(h('land'), false); FEEL.haptics = true;
  assert.equal(h('nope'), false);
});
