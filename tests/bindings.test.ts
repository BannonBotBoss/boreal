import test from 'node:test';
import assert from 'node:assert/strict';
import { ACTIONS, assign, assignGroup, atomValues, comboValue, conflicts, createCapture, deadzone, defaults, loadBindings, resolveInput, saveBindings, tidyCombo, unbind, type PadState } from '../src/core/bindings';
const near = (a: number, b: number, m = '') => assert.ok(Math.abs(a - b) < 1e-9, `${m} ${a} vs ${b}`);
const padOf = (o: { b?: Record<number, number>; axes?: number[] } = {}): PadState => ({ buttons: Array.from({ length: 17 }, (_, i) => ({ value: o.b?.[i] ?? 0, pressed: (o.b?.[i] ?? 0) > .1 })), axes: o.axes ?? [0, 0, 0, 0] });
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

test('defaults reproduce the old fixed controls exactly (hold values, random keyboard + pad states)', () => {
  const b = defaults();
  for (let n = 0; n < 400; n++) {
    const keys = new Set(['w', 'a', 's', 'd', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'shift', 'c', ' '].filter(() => rnd() < .3));
    const axes = [0, 1, 2, 3].map(() => rnd() < .5 ? 0 : rnd() * 2 - 1), bv: Record<number, number> = { 6: rnd() < .5 ? rnd() : 0, 7: rnd() < .5 ? rnd() : 0, 2: +(rnd() < .3), 14: +(rnd() < .3), 15: +(rnd() < .3) };
    const pad = padOf({ b: bv, axes }), k = (x: string) => Number(keys.has(x));
    for (const chrono of [false, true]) {
      const H = resolveInput(b, atomValues(keys, pad), new Set(), chrono).value;
      const free = chrono ? 0 : 1;
      near(H.steerRight - H.steerLeft, free * (k('d') - k('a') + deadzone(axes[0])), 'dx');
      near(H.moveBack - H.moveForward, free * (k('s') - k('w') + deadzone(axes[1])), 'dz');
      near(H.lookRight - H.lookLeft, free * (k('arrowright') - k('arrowleft')) + deadzone(axes[2]), 'look');
      near(H.lookDown - H.lookUp, free * (k('arrowdown') - k('arrowup')) + deadzone(axes[3]), 'tilt');
      near(H.stealth, free * Math.max(bv[6], k('c')), 'stealth'); near(H.run, free * Math.max(bv[7], k('shift')), 'run');
      assert.equal(H.jump > .25, !!free && (keys.has(' ') || bv[2] > 0), 'jump');
      if (chrono) near(H.scrubLater - H.scrubEarlier, k('arrowright') - k('arrowleft') + bv[15] - bv[14] + deadzone(axes[0]), 'scrub');
    }
  }
  assert.deepEqual(conflicts(b), [], 'defaults have no conflicts');
});
test('press actions fire once on the edge; Shift+G is planet view, not also a growl; Ctrl+I is left to the browser', () => {
  const b = defaults(), step = (keys: string[], pad?: PadState, prev = new Set<string>(), chrono = false) => resolveInput(b, atomValues(keys, pad), prev, chrono);
  let r = step(['e']); assert.deepEqual([...r.fired], ['interact']); assert.deepEqual([...step(['e'], undefined, r.active).fired], [], 'held: no repeat');
  r = step(['shift', 'g']); assert.ok(r.fired.has('planet') && !r.fired.has('growl'));
  assert.ok(step(['g']).fired.has('growl'));
  assert.equal(step(['control', 'i']).fired.size, 0); assert.ok(step(['i']).fired.has('inspector'));
  assert.deepEqual([...step([], padOf({ b: { 8: 1 } })).fired], ['chrono']); assert.deepEqual([...step([], padOf({ b: { 9: 1 } })).fired], ['pause']);
  assert.ok(step(['escape']).fired.has('pause') && step([], padOf({ b: { 1: 1 } })).fired.has('back'));
  assert.equal(step(['e'], undefined, new Set(), true).fired.size, 0, 'chronometer open: interact is not live');
});
test('combos: modifiers must be held; value is the last atom (analog trigger); Matthew\'s example layout', () => {
  const v = atomValues([], padOf({ b: { 7: .6 }, axes: [0, 0, 0, -1] }));
  near(comboValue('rs+rt', v), .6); near(comboValue('rs+rt', atomValues([], padOf({ b: { 7: .6 } }))), 0); near(comboValue('lb+a', v), 0);
  let b = assignGroup(defaults(), 'walk', ['rs.up'])!; // walk = right stick
  b = assign(b, 'jump', ['rs.click', 'rs.down']); b = assign(b, 'run', ['rs.up', 'rt']); // jump = RS click, run = RS + RT
  assert.deepEqual([b.moveForward.pad, b.moveBack.pad, b.steerLeft.pad, b.steerRight.pad, b.jump.pad, b.run.pad], [['rs.up'], ['rs.down'], ['rs.left'], ['rs.right'], ['rs.click'], ['rs+rt']]);
  assert.deepEqual(b.moveForward.keys, ['k:w'], 'keyboard untouched by a pad capture');
  const H = resolveInput(b, v, new Set()).value; near(H.moveForward, 1); near(H.run, .6);
  near(resolveInput(b, atomValues([], padOf({ b: { 7: 1 } })), new Set()).value.run, 0, 'RT alone no longer runs');
  assert.deepEqual(assign(defaults(), 'planet', ['k:shift', 'k:p']).planet.keys, ['k:shift+k:p']);
  assert.equal(assignGroup(defaults(), 'walk', ['a']), undefined, 'a button cannot fill a whole stick');
  assert.deepEqual(assignGroup(defaults(), 'look', ['lb', 'dup'])!.lookLeft.pad, ['lb+dleft'], 'modifier + d-pad');
});
test('conflicts: same inputs (any order) on two live-together actions; keep-on resolves', () => {
  let b = assignGroup(defaults(), 'walk', ['rs.right'])!; const cs = conflicts(b);
  assert.equal(cs.length, 4); assert.deepEqual(cs.find(c => c.combo === 'rs.up')!.ids, ['moveForward', 'lookUp']);
  for (const c of cs) b = unbind(b, c.ids[1], c.combo); assert.deepEqual(conflicts(b), []);
  assert.deepEqual(conflicts({ ...defaults(), jump: { keys: [], pad: ['lb+a'] }, interact: { keys: [], pad: ['a+lb'] } })[0].ids, ['jump', 'interact']);
  assert.deepEqual(conflicts({ ...defaults(), scrubLater: { keys: [], pad: ['a'] } }), [], 'chronometer-only actions do not clash with play actions');
});
test('capture: waits for release, records in order, ends on release; tidy rules', () => {
  const c = createCapture(), f = (b: Record<number, number>, axes?: number[]) => c.feed(atomValues([], padOf({ b, axes })));
  assert.equal(f({ 0: 1 }), undefined, 'A that opened it is still held'); assert.equal(f({}), undefined);
  assert.equal(f({}, [0, 0, 0, -1]), undefined); assert.equal(f({ 7: 1 }, [0, 0, 0, -1]), undefined);
  assert.deepEqual(f({}), ['rs.up', 'rt']); assert.equal(tidyCombo(['rs.up', 'rt']), 'rs+rt');
  assert.equal(tidyCombo(['rs.down', 'rs.click']), 'rs.click'); assert.equal(tidyCombo(['ls.up', 'ls.left']), 'ls.up'); assert.equal(tidyCombo(['k:shift', 'k:g']), 'k:shift+k:g');
});
test('persistence: only changes are saved; loads back; bad saves fall back to defaults', () => {
  assert.equal(saveBindings(defaults()), '{}');
  const b = assign(defaults(), 'jump', ['rs.click']), raw = saveBindings(b);
  assert.deepEqual(Object.keys(JSON.parse(raw)), ['jump']); assert.deepEqual(loadBindings(raw), b);
  assert.deepEqual(loadBindings('not json'), defaults()); assert.deepEqual(loadBindings(null), defaults());
  assert.deepEqual(loadBindings('{"nope":{"pad":["a"]},"jump":{"pad":[3,"y"]}}').jump, { keys: ['k:space'], pad: ['y'] });
  assert.equal(new Set(ACTIONS.map(a => a.id)).size, ACTIONS.length);
});
