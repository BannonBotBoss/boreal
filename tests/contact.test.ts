import test from 'node:test';
import assert from 'node:assert/strict';
import { createContactBus, seatInputs, SEAT_DEFAULTS, type Contact } from '../src/core/contactBus';
import { COMPOSITIONS, density } from '../src/core/materials';
import { WHY_DEFAULTS, WHY_MAX, anchor, nowText, whyOf, whyText, stepText, tip, withTip, type Why } from '../src/core/why';
import { catalog, type Kind } from '../src/core/catalog';
import { createContext, interact, parseContext, solidContact } from '../src/core/events';
import { rockDiameter, SNOUT_REACH } from '../src/core/rocks';
import type { Entity } from '../src/core/world';

const contact = (a: string, b = 'ground', source = 'test'): Contact => ({ a, b, at: [0, 0, 0], normal: [0, 1, 0], kind: 'solid-solid', source });
const entity = (key: string, kind: Kind, extra: Partial<Entity> = {}): Entity => ({ key, kind, seed: 7, generatorVersion: 1, x: 0, z: 0, rotation: 1, scale: 1, ...extra });

test('contact bus: rising edge once per pair, order-free, end then begin fires again', () => {
  const bus = createContactBus(), seen: string[] = [], gone: string[] = [];
  bus.onContact(c => seen.push(`${c.a}|${c.b}`)); bus.onSeparate((a, b) => gone.push(`${a}|${b}`));
  assert.equal(bus.begin(contact('log1')), true);
  assert.equal(bus.begin(contact('log1')), false, 'still touching: no second begin');
  assert.equal(bus.begin(contact('ground', 'log1')), false, 'ground|log1 is the same pair');
  assert.deepEqual(seen, ['log1|ground']);
  assert.equal(bus.end('ground', 'log1'), true); assert.equal(bus.end('log1', 'ground'), false, 'falling edge once');
  assert.deepEqual(gone, ['ground|log1']);
  assert.equal(bus.begin(contact('log1')), true, 'end then begin fires again');
  assert.equal(seen.length, 2);
});
test('contact bus: touching() shows contacts made before a late subscriber; unsubscribe stops calls', () => {
  const bus = createContactBus();
  bus.begin(contact('log1')); bus.begin(contact('log2')); bus.begin(contact('rock1', 'log2'));
  let calls = 0; const off = bus.onContact(() => calls++);
  assert.equal(bus.touching().length, 3);
  assert.equal(bus.touching('log2').length, 2);
  assert.equal(bus.touching('ground', 'log1').length, 1);
  assert.equal(bus.touching('log1', 'rock1').length, 0);
  bus.begin(contact('log3')); assert.equal(calls, 1);
  off(); bus.begin(contact('log4')); assert.equal(calls, 1, 'unsubscribed');
});

test('why: every Kind has a derived chain; the tree chain is Matthew\'s; a record chain wins', () => {
  for (const kind of Object.keys(catalog) as Kind[]) { const w = whyOf({ kind }); assert.ok(w.length >= 1 && w.length <= WHY_MAX, kind); }
  assert.deepEqual(WHY_DEFAULTS.spruce.map(s => s.step), ['photosynthesized', 'seeded', 'dispersed', 'sprouted', 'grew']);
  assert.deepEqual(WHY_DEFAULTS.log.map(s => s.step), ['photosynthesized', 'seeded', 'dispersed', 'sprouted', 'grew', 'weathered', 'weakened', 'failed', 'pulled', 'tipped', 'displaced', 'settled', 'resting', 'ceased', 'oxidized', 'decaying', 'held', 'insected', 'wetted', 'sunned', 'rotting', 'nursing']);
  assert.ok(!WHY_DEFAULTS.spruce.some(s => ['weathered', 'weakened', 'failed', 'pulled', 'tipped', 'displaced', 'settled', 'resting', 'ceased', 'oxidized', 'decaying', 'held', 'insected', 'wetted', 'sunned', 'rotting', 'nursing'].includes(s.step)), 'a standing tree has not failed');
  assert.ok(WHY_DEFAULTS.log.length <= WHY_MAX);
  assert.equal(stepText(WHY_DEFAULTS.log[WHY_DEFAULTS.log.length - 12]), 'displaced the ground (the earth yields)');
  assert.deepEqual(WHY_DEFAULTS.log.map(s => s.step).slice(-6), ['held', 'insected', 'wetted', 'sunned', 'rotting', 'nursing']);
  assert.equal(WHY_MAX, 24); assert.equal(WHY_DEFAULTS.log.length, 22);
  assert.equal(stepText(anchor(whyOf({ kind: 'log' }))!), 'resting on the ground', 'the anchor skips ongoing steps');
  assert.equal(stepText(tip(whyOf({ kind: 'log' }))!), 'the other side collecting debris and growing other plants');
  assert.equal(nowText(whyOf({ kind: 'log' })), 'resting on the ground, the other side collecting debris and growing other plants');
  assert.ok(!WHY_DEFAULTS.log.some(x => (x.step as string) === 'aired'), 'oxygen is the oxidized step');
  assert.equal(nowText(whyOf({ kind: 'spruce' })), 'grew and leafed out');
  assert.equal(stepText(tip(whyOf({ kind: 'rock' }))!), 'embedded in the ground');
  assert.match(whyText(whyOf({ kind: 'spruce' })), /^photosynthesis \u2192 formed a seed \u2192 seed dispersed \u2192 sprouted from the ground \u2192 grew and leafed out$/);
  const mine: Why = [{ step: 'weathered' }, { step: 'moved', by: 'player' }];
  assert.deepEqual(whyOf({ kind: 'rock' }, { why: mine }), mine);
  const derived = whyOf({ kind: 'log' }); derived.push({ step: 'grew' });
  assert.equal(whyOf({ kind: 'log' }).length, WHY_DEFAULTS.log.length, 'whyOf returns a copy');
});
test('why: withTip is idempotent, replaces a same-step tip and stays within WHY_MAX keeping the origin', () => {
  const w = whyOf({ kind: 'log' });
  assert.deepEqual(withTip(w, { step: 'resting', on: 'ground' }), w);
  assert.deepEqual(anchor(withTip(w, { step: 'resting', on: 'r1' })), { step: 'resting', on: 'r1' });
  assert.deepEqual(withTip(w, { step: 'resting', on: 'r1' }).slice(-9).map(s => s.step), ['ceased', 'oxidized', 'decaying', 'held', 'insected', 'wetted', 'sunned', 'rotting', 'nursing'], 'ongoing steps kept after a replaced anchor');
  assert.equal(tip(withTip(w, { step: 'moved', by: 'player' }))!.step, 'moved', 'a new event appends after the ongoing steps');
  assert.equal(withTip(w, { step: 'resting', on: 'r1' }).length, w.length);
  let long = w; for (let i = 0; i < 6; i++) long = withTip(withTip(long, { step: 'moved', by: 'player' }), { step: 'resting', on: `r${i}` });
  assert.equal(long.length, WHY_MAX); assert.equal(long[0].step, 'photosynthesized');
});

test('solidContact: generated objects return the same context (no save growth)', () => {
  const ctx = createContext();
  assert.equal(solidContact(ctx, contact('0:0:3')), ctx);
  assert.equal(solidContact(ctx, { a: entity('0:0:3', 'log'), b: 'ground' }), ctx);
  assert.equal(JSON.stringify(ctx), JSON.stringify(createContext()));
});
const pushedRock = () => {
  const seed = Array.from({ length: 100 }, (_, i) => i).find(i => rockDiameter(entity('r', 'rock', { seed: i })) === .17)!;
  const rock = entity('1:1:5', 'rock', { seed });
  const player = { x: 0, z: SNOUT_REACH + .13, heading: 0, abilities: ['move' as const] };
  return { rock, ctx: interact(createContext(), player, rock, 'move') };
};
test('rock push writes the why: moved by the player', () => {
  const { rock, ctx } = pushedRock(), w = whyOf(rock, ctx.records[rock.key]);
  assert.equal(stepText(tip(w)!), 'moved by the player');
  assert.deepEqual(w.slice(0, 2), WHY_DEFAULTS.rock, 'the chain keeps where it came from');
});
test('solidContact: updates only the why of a remembered object, idempotently, never moving it', () => {
  const { rock, ctx } = pushedRock();
  const next = solidContact(ctx, contact(rock.key));
  assert.notEqual(next, ctx);
  assert.equal(stepText(tip(next.records[rock.key].why!)!), 'embedded in the ground');
  const { why: _a, ...restNext } = next.records[rock.key], { why: _b, ...restCtx } = ctx.records[rock.key];
  assert.deepEqual(restNext, restCtx, 'x, z, rotation, roll, scale and everything else unchanged');
  assert.equal(solidContact(next, contact(rock.key)), next, 'same contact twice: same context');
  assert.equal(solidContact(next, contact('ground', rock.key)), next, 'order-free');
  assert.equal(ctx.records[rock.key].why!.length, 3, 'input context not mutated');
  assert.deepEqual(Object.keys(next.records), [rock.key], 'no other record written');
});
test('solidContact: a remembered object whose tip already says it adds nothing', () => {
  const deer = entity('2:2:1', 'deer');
  const ctx = interact(createContext(), { x: 0, z: 1, abilities: ['speak'] }, deer, 'speak');
  assert.equal(ctx.records[deer.key].why, undefined, 'speak does not store a why');
  const once = solidContact(ctx, contact(deer.key));
  assert.equal(stepText(tip(once.records[deer.key].why!)!), 'resting on the ground');
  assert.equal(solidContact(once, contact(deer.key)), once);
});
test('parseContext: optional why loads, old saves without why still load, bad chains are rejected', () => {
  const { rock, ctx } = pushedRock();
  const loaded = parseContext(JSON.stringify(ctx));
  assert.equal(stepText(tip(loaded.records[rock.key].why!)!), 'moved by the player');
  const old = structuredClone(ctx); delete old.records[rock.key].why;
  assert.equal(parseContext(JSON.stringify(old)).records[rock.key].why, undefined);
  const bad = (why: unknown) => { const c = structuredClone(ctx) as unknown as { records: Record<string, { why: unknown }> }; c.records[rock.key].why = why; return JSON.stringify(c); };
  assert.throws(() => parseContext(bad([{ step: 'teleported' }])));
  assert.throws(() => parseContext(bad([])));
  assert.throws(() => parseContext(bad('resting')));
  assert.throws(() => parseContext(bad([{ step: 'resting', on: 'x'.repeat(65) }])));
  assert.throws(() => parseContext(bad([{ step: 'resting', note: 'free text' }])));
  assert.throws(() => parseContext(bad(Array.from({ length: WHY_MAX + 1 }, () => ({ step: 'grew' })))));
});
test('seating inputs ride on the contact for T-0005: defaults, bounds, and solidContact ignores them', () => {
  assert.deepEqual(seatInputs({}), { trunkDensity: undefined, earthDensity: SEAT_DEFAULTS.earthDensity, sinkFraction: 1 / 3 });
  assert.deepEqual(seatInputs({ trunkDensity: 512, earthDensity: 1400, sinkFraction: .3 }), { trunkDensity: 512, earthDensity: 1400, sinkFraction: .3 });
  assert.deepEqual(seatInputs({ trunkDensity: -1, earthDensity: NaN, sinkFraction: 4 }), { trunkDensity: undefined, earthDensity: SEAT_DEFAULTS.earthDensity, sinkFraction: 1 });
  const trunk = density(COMPOSITIONS.log.body); assert.ok(trunk > 400 && trunk < SEAT_DEFAULTS.earthDensity, 'a log is lighter than the earth it presses into');
  const ctx = createContext(), payload = { ...contact('0:0:3'), trunkDensity: trunk, earthDensity: 1300, sinkFraction: 1 / 3 };
  assert.equal(solidContact(ctx, payload), ctx, 'generated log: still the same context');
  const deer = entity('2:2:1', 'deer'), known = interact(createContext(), { x: 0, z: 1, abilities: ['speak'] }, deer, 'speak');
  assert.deepEqual(solidContact(known, { ...contact(deer.key), sinkFraction: .9 }), solidContact(known, contact(deer.key)), 'payload does not change the why');
});
