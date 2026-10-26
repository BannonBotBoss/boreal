import test from 'node:test';
import assert from 'node:assert/strict';
import { atomValues, defaults, type PadState } from '../src/core/bindings';
import { contextPresses, createPadReader } from '../src/input/gamepad';
import { createMenuModel, createNumberEntry, radialSlice, type Item, type MenuEvent } from '../src/ui/padNav';
import { buttonMap } from '../src/input/padRouter';

const pad = (b: Record<number, number> = {}, axes = [0, 0, 0, 0]): PadState => ({ buttons: Array.from({ length: 17 }, (_, i) => ({ value: b[i] ?? 0, pressed: (b[i] ?? 0) > .1 })), axes });
function rig(owned = new Set<string>()) {
  const log: string[] = []; let on = false;
  const items = (): Item[] => [{ label: 'Header', kind: 'info' }, { label: 'Grid', kind: 'toggle', act: () => { on = !on; log.push('grid'); } }, { label: 'Aurora', kind: 'toggle', control: 'layer.aurora', act: () => log.push('aurora') }, { label: 'ISO', kind: 'range', adjust: d => log.push('iso' + d) }];
  const m = createMenuModel([{ id: 'layers', label: 'Layers', items }, { id: 'camera', label: 'Camera', items: () => [{ label: 'Shutter', kind: 'action', act: () => log.push('shot') }] }],
    { canUse: id => owned.has(id), badgePage: c => ({ title: 'Locked ' + c, items: () => [{ label: 'Take the test', kind: 'action', act: () => log.push('test:' + c) }] }) });
  const reader = createPadReader(); let t = 0;
  const press = (b: Record<number, number>, axes?: number[]) => { for (const v of [pad(b, axes), pad()]) for (const e of contextPresses(defaults(), reader.update(atomValues([], v), t += 50), 'menu')) m.input(e as MenuEvent); };
  return { m, log, press, on: () => on };
}
test('pad menu: d-pad skips info rows, A selects, LB/RB switch tabs, B closes', () => {
  const { m, log, press, on } = rig(); m.open();
  assert.equal(m.current()?.label, 'Grid', 'focus skips the info header');
  press({ 0: 1 }); assert.ok(on());
  press({ 13: 1 }); press({ 13: 1 }); assert.equal(m.current()?.label, 'ISO');
  press({ 15: 1 }); assert.deepEqual(log.slice(-1), ['iso1']);
  press({ 5: 1 }); assert.equal(m.title(), 'Camera'); press({ 0: 1 }); assert.ok(log.includes('shot'));
  press({ 4: 1 }); assert.equal(m.title(), 'Layers');
  press({ 1: 1 }); assert.equal(m.st.open, false);
});
test('pad menu: left stick navigates too', () => {
  const { m, press } = rig(); m.open(); press({}, [0, .9, 0, 0]); assert.equal(m.current()?.label, 'Aurora');
});
test('pad menu: a click can open a root tab without the bumpers', () => {
  const { m } = rig(); m.open();
  m.tabTo(1); assert.equal(m.title(), 'Camera');
  m.tabTo(0); assert.equal(m.title(), 'Layers');
  m.push({ title: 'Nested', items: () => [{ label: 'Stay', kind: 'info' }] });
  m.tabTo(1); assert.equal(m.title(), 'Nested', 'a pushed page does not switch tabs');
});
test('badge gate: a locked item opens its test page, B returns; owned item acts', () => {
  const r = rig(); r.m.open(); r.press({ 13: 1 }); assert.equal(r.m.current()?.label, 'Aurora');
  r.press({ 0: 1 }); assert.equal(r.m.title(), 'Locked layer.aurora'); assert.ok(!r.log.includes('aurora'));
  r.press({ 0: 1 }); assert.ok(r.log.includes('test:layer.aurora'));
  r.press({ 1: 1 }); assert.equal(r.m.title(), 'Layers');
  const o = rig(new Set(['layer.aurora'])); o.m.open(); o.press({ 13: 1 }); o.press({ 0: 1 }); assert.ok(o.log.includes('aurora'));
});
test('radial filter wheel: slices clockwise from up, dead zone', () => {
  assert.equal(radialSlice(0, -1, 8), 0); assert.equal(radialSlice(1, 0, 8), 2); assert.equal(radialSlice(0, 1, 8), 4); assert.equal(radialSlice(-1, 0, 8), 6);
  assert.equal(radialSlice(.1, .1, 8), -1);
});
test('number entry: mantissa on d-pad, exponent on bumpers, normalised', () => {
  const n = createNumberEntry(); n.input('menuTabNext'); n.input('menuTabNext'); assert.equal(n.value(), 100);
  for (let i = 0; i < 10; i++) n.input('menuUp'); assert.equal(n.text(), '2.00 × 10^2');
  assert.equal(n.input('menuSelect'), false);
});
test('button map covers the whole pad (help overlay data)', () => {
  const rows = buttonMap(defaults()), atoms = rows.map(r => r.atom);
  for (const a of ['a', 'b', 'x', 'y', 'lb', 'rb', 'lt', 'rt', 'view', 'menu', 'dup', 'ddown', 'ls', 'rs']) assert.ok(atoms.includes(a), a);
  assert.ok(rows.find(r => r.atom === 'menu')!.by.any.length, 'Menu opens the pad menu everywhere');
  assert.ok(rows.find(r => r.atom === 'rt')!.by.globe.length && rows.find(r => r.atom === 'rt')!.by.camera.length);
});
