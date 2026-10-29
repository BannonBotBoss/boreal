import test from 'node:test';
import assert from 'node:assert/strict';
import { ACTIONS, ACTION, CONTEXTS, actionsIn, atomValues, clashesWith, conflicts, defaults, loadBindings, resolveContext, saveBindings, swapAssign, type PadState } from '../src/core/bindings';
import { contextPresses, createPadReader, keyAction, REPEAT, HOLD_MS, standardPad } from '../src/input/gamepad';
import { createSettingsModel, localStore } from '../src/ui/gamepadSettings';

const pad = (b: Record<number, number> = {}, axes = [0, 0, 0, 0]): PadState => ({ buttons: Array.from({ length: 17 }, (_, i) => ({ value: b[i] ?? 0, pressed: (b[i] ?? 0) > .1 })), axes });
const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m }; };

test('registry: every context has actions, every action has a context, defaults clash-free', () => {
  for (const c of CONTEXTS) if (c.id !== 'any') assert.ok(actionsIn(c.id).length > 0, c.id);
  assert.equal(new Set(ACTIONS.map(a => a.id)).size, ACTIONS.length, 'unique ids');
  assert.deepEqual(conflicts(defaults()), []);
  for (const id of ['globeZoomIn', 'camUp', 'menuSelect', 'padMenu', 'padHelp', 'shutter', 'cameraMode', 'inspector']) assert.ok(ACTION[id], id);
});
test('mocked pad: contexts resolve their own actions (globe zoom on RT, menu A select, any-actions not in menus)', () => {
  const v = atomValues([], pad({ 7: .5, 0: 1 }));
  assert.equal(resolveContext(defaults(), v, new Set(), 'globe').value.globeZoomIn, .5);
  assert.ok(resolveContext(defaults(), v, new Set(), 'menu').fired.has('menuSelect'));
  assert.ok(!resolveContext(defaults(), atomValues([], pad({ 9: 1 })), new Set(), 'menu').fired.has('padMenu'));
  assert.ok(resolveContext(defaults(), atomValues([], pad({ 9: 1 })), new Set(), 'globe').fired.has('padMenu'));
});
test('reader: edges, d-pad auto-repeat after delay, tap vs hold', () => {
  const r = createPadReader(), at = (b: Record<number, number>, t: number) => r.update(atomValues([], pad(b)), t);
  let e = at({ 13: 1 }, 0); assert.ok(e.down.has('ddown') && e.repeat.has('ddown'));
  assert.ok(!at({ 13: 1 }, REPEAT.delayMs - 1).repeat.has('ddown'));
  assert.ok(at({ 13: 1 }, REPEAT.delayMs + 1).repeat.has('ddown')); assert.ok(!at({ 13: 1 }, REPEAT.delayMs + 20).repeat.has('ddown'));
  assert.ok(at({ 13: 1 }, REPEAT.delayMs + REPEAT.rateMs + 2).repeat.has('ddown'));
  e = at({ 3: 1 }, 2000); e = at({}, 2100); assert.ok(e.tap.has('y'), 'quick Y = tap');
  at({ 3: 1 }, 3000); assert.ok(at({ 3: 1 }, 3000 + HOLD_MS).hold.has('y')); assert.ok(!at({}, 4000).tap.has('y'), 'held Y is not a tap');
  const r2 = createPadReader(); const e2 = r2.update(atomValues([], pad({}, [0, .9, 0, 0])), 0);
  assert.deepEqual([...contextPresses(defaults(), e2, 'menu')], ['menuDown'], 'left stick navigates menus');
  assert.equal(r2.update(atomValues([], pad({}, [0, .1, 0, 0])), 10).up.has('ls.down'), true, 'dead zone releases');
});
test('rebinding: capture binds; clash opens swap prompt; swap moves the old binding; keep-both and cancel', () => {
  const kv = mem(), store = localStore(kv), m = createSettingsModel(store);
  m.st.tab = CONTEXTS.findIndex(c => c.id === 'play'); m.st.row = m.rows().findIndex(a => a.id === 'jump');
  m.input('menuSelect'); assert.equal(m.st.mode, 'capture');
  m.captured(['a']); assert.equal(m.st.mode, 'prompt'); assert.deepEqual(m.st.pending!.clashes, ['interact']);
  m.input('menuSelect'); assert.deepEqual(store.get().jump.pad, ['a']); assert.deepEqual(store.get().interact.pad, ['x'], 'swap: interact gets jump\'s old X');
  assert.deepEqual(conflicts(store.get()), []);
  m.input('menuSelect'); m.captured(['lb']); m.input('menuAlt'); assert.ok(conflicts(store.get()).length > 0, 'keep both leaves the clash flagged');
  m.input('menuSelect'); m.captured(['xbox']); assert.equal(m.st.mode, 'list'); assert.deepEqual(store.get().jump.pad, ['xbox'], 'an unbound button binds directly');
  m.input('menuSelect'); m.input('menuBack'); assert.equal(m.st.mode, 'list');
  m.input('menuAlt'); assert.deepEqual(store.get().jump.pad, [], 'X clears');
  assert.ok(clashesWith(defaults(), 'moveForward', 'rs.up').includes('lookUp'));
});
test('persistence: saved per action, reload restores, reset to defaults; tabs and close', () => {
  const kv = mem(), m = createSettingsModel(localStore(kv));
  m.st.tab = CONTEXTS.findIndex(c => c.id === 'globe'); m.st.row = m.rows().findIndex(a => a.id === 'globeHome'); m.input('menuSelect'); m.captured(['ls.click']);
  assert.deepEqual(JSON.parse(kv.getItem('boreal.bindings.v1')!), { globeHome: { keys: ['k:h'], pad: ['ls.click'] } });
  assert.deepEqual(localStore(kv).get().globeHome.pad, ['ls.click']);
  assert.deepEqual(loadBindings(saveBindings(swapAssign(defaults(), 'jump', ['a']))).jump.pad, ['a']);
  m.input('menuAlt2'); m.input('menuSelect'); assert.equal(kv.getItem('boreal.bindings.v1'), '{}');
  const t = m.st.tab; m.input('menuTabNext'); assert.equal(m.st.tab, (t + 1) % CONTEXTS.length); m.input('menuTabPrev'); m.input('menuTabPrev'); assert.equal(m.st.tab, (t - 1 + CONTEXTS.length) % CONTEXTS.length);
  m.st.row = 0; m.input('menuUp'); assert.equal(m.st.row, m.rows().length - 1, 'wraps');
  assert.equal(keyAction(defaults(), 'Enter', 'menu'), 'menuSelect'); assert.equal(keyAction(defaults(), 'Escape', 'menu'), 'menuBack');
  m.input('menuBack'); assert.ok(m.st.closed);
  assert.equal(standardPad({ getGamepads: () => [null, { connected: true, mapping: 'standard', buttons: [], axes: [] } as unknown as Gamepad] })?.axes.length, 0);
});
