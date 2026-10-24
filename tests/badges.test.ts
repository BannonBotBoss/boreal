import test from 'node:test';
import assert from 'node:assert/strict';
import { CONTROL, POOLS, prereqs, useStorage, setUnlockAll, canUse, hasBadge, earn, ledger, balance, redeem, buy, setPlatformStore,
  NoopStore, drawTest, submitTest, answerOf, hint, answerCredits, RATES } from '../src/core/badges';

const fresh = () => { useStorage(); setUnlockAll(false); setPlatformStore(NoopStore); };
const ids = Object.keys(CONTROL);
const fund = (n: number) => { for (let i = 0; i < n; i++) earn('answer', i * 60000); };
const holdAllBut = async (skip: string) => { setPlatformStore({ purchase: async () => true });
  for (const id of topo().filter(x => x !== skip)) assert.deepEqual(await buy(id), { ok: true }, id); };
const topo = () => { const out: string[] = []; const v = (n: string) => { if (out.includes(n)) return; prereqs(n).forEach(v); out.push(n); }; ids.forEach(v); return out; };

test('prerequisite graph is acyclic and constant.G is its unique sink (the capstone)', () => {
  const seen = new Set<string>(), stack = new Set<string>();
  const dfs = (n: string) => { assert.ok(!stack.has(n), `cycle at ${n}`); if (seen.has(n)) return; stack.add(n); prereqs(n).forEach(dfs); stack.delete(n); seen.add(n); };
  ids.forEach(dfs);
  const sinks = ids.filter(n => !ids.some(m => prereqs(m).includes(n)));
  assert.deepEqual(sinks, ['constant.G']);
  for (const p of prereqs('constant.G')) assert.ok(ids.includes(p));
});
test('locked controls reject use; dev unlockAll opens all', () => {
  fresh(); for (const id of ids) assert.equal(canUse(id), false, id);
  setUnlockAll(true); for (const id of ids) assert.equal(canUse(id), true); setUnlockAll(false);
});
test('ledger: append-only, balance invariant, anti-farm cap', () => {
  fresh();
  for (let i = 0; i < 20; i++) earn('look', 1000 + i);
  assert.equal(balance(), RATES.capPerMinute.look, 'capped per minute');
  fund(30); const l = ledger();
  l.forEach((e, i) => { assert.equal(e.id, i + 1); assert.equal(e.balance, (i ? l[i - 1].balance : 0) + e.amount); });
});
test('credits unlock a control; no double-spend; prereqs required', () => {
  fresh(); fund(40);
  assert.equal(redeem('layer.clouds').ok, false, 'needs layer.atmosphere');
  assert.deepEqual(redeem('layer.atmosphere'), { ok: true }); assert.equal(canUse('layer.atmosphere'), true);
  const b = balance(); assert.equal(redeem('layer.atmosphere').ok, false); assert.equal(balance(), b, 'no double spend');
  assert.deepEqual(redeem('layer.clouds'), { ok: true }, 'bought badge counts as prereq');
  fresh(); assert.equal(redeem('layer.atmosphere').ok, false, 'not enough credits'); assert.equal(balance(), 0);
});
test('purchase hook: noop declines; a store grants only when prereqs are held', async () => {
  fresh(); assert.equal((await buy('layer.atmosphere')).ok, false);
  setPlatformStore({ purchase: async () => true });
  assert.equal((await buy('constant.G')).ok, false, 'G prereqs cannot be skipped');
  assert.equal((await buy('layer.aurora')).ok, false);
  assert.deepEqual(await buy('layer.magnetosphere'), { ok: true }); assert.deepEqual(await buy('layer.aurora'), { ok: true });
});
test('G test: draws without repeats until the pool is exhausted', () => {
  fresh(); const pool = POOLS['constant.G']; assert.ok(pool.questions.length >= 20);
  const per = pool.perAttempt, rounds = Math.floor(pool.questions.length / per), got: string[] = [];
  for (let r = 0; r < rounds; r++) got.push(...drawTest('constant.G', r).map(q => q.id));
  assert.equal(new Set(got).size, got.length, 'no repeats');
  assert.equal(drawTest('constant.G', 99).length, per, 'resets when exhausted');
});
test('G test: pass grants the badge only after every prereq; fail keeps it locked; ~70% pass', async () => {
  fresh(); let qs = drawTest('constant.G', 1);
  const right = qs.map(answerOf), wrong = qs.map(() => -1);
  assert.equal(submitTest('constant.G', qs, right).passed, false, 'prereqs missing');
  await holdAllBut('constant.G');
  qs = drawTest('constant.G', 2);
  const r0 = submitTest('constant.G', qs, qs.map(() => -1)); assert.equal(r0.passed, false); assert.equal(hasBadge('constant.G'), false);
  assert.match(r0.message, /you got 0 of 10/);
  qs = drawTest('constant.G', 3); const a = qs.map(answerOf); a[0] = a[1] = a[2] = -1;
  const r1 = submitTest('constant.G', qs, a); assert.equal(r1.passed, true, '7 of 10 passes'); assert.ok(canUse('constant.G'));
  void wrong;
});
test('numeric tolerance is forgiving (8%)', () => {
  fresh(); const [q] = drawTest('constant.G', 5); const v = answerOf(q);
  assert.equal(submitTest('constant.G', [q], [v * 1.07]).score, 1); assert.equal(submitTest('constant.G', [q], [v * 1.2]).score, 0);
});
test('hints: ordered nudge -> clue -> walkthrough; cost credits; full reveal does not count toward the pass', async () => {
  fresh(); const q = POOLS['constant.G'].questions[0];
  assert.equal(q.hints!.length, 3); assert.equal(hint(q, 0), q.hints![0]); assert.equal(hint(q, 2), q.hints![2]); assert.match(hint(q, 2), /Plug/);
  assert.ok(answerCredits(2) < answerCredits(0) && answerCredits(9) >= 1);
  await holdAllBut('constant.G');
  const qs = drawTest('constant.G', 7), a = qs.map(answerOf);
  const b0 = balance(); const r = submitTest('constant.G', qs, a, 5e9, qs.map(() => 3));
  assert.equal(r.score, 0); assert.equal(r.passed, false); assert.ok(balance() > b0, 'still earns credits');
  const r2 = submitTest('constant.G', qs, a, 6e9, qs.map(() => 1)); assert.equal(r2.passed, true, 'hints short of reveal never block');
});
test('every pool question has attribution, source, learn link, explainer and hints', () => {
  for (const [id, p] of Object.entries(POOLS)) {
    assert.match(p.license, /CC BY/); assert.ok(p.attribution.includes('OpenStax'));
    for (const q of p.questions) assert.ok(q.source.startsWith('https://') && q.learn.startsWith('https://') && q.explainer && q.hints?.length, `${id}/${q.id}`);
  }
  for (const [id, c] of Object.entries(CONTROL)) assert.ok(c.quiz === 'todo' || POOLS[c.quiz], id);
});
