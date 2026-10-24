/**
 * Control badges (Matt: "only what you understand shall you have control"; "they can buy the badges, but must have the
 * badges required to buy higher"; "G would be the last"). Data: src/data/controls.json + src/data/quizzes/<id>.json.
 * ONE gate: `canUse(control)`. A badge comes from (a) passing that control's own test, (b) spending experience credits
 * (append-only ledger), or (c) a PlatformStore purchase (hook only: no payment code). Every path needs all prerequisite
 * badges first. constant.G's prereqs are every other control, so it is the capstone. Dev override: `?unlockAll=1` in dev builds.
 */
import CONTROLS from '../data/controls.json';
import G_POOL from '../data/quizzes/constant.G.json';
import { evaluate } from './constants';
import { random, hash } from '../proc/rng';

export interface Control { subject: string; prereqs: string[] | '*'; cost: number; quiz: string; learn: string }
export const CONTROL = CONTROLS.controls as unknown as Record<string, Control>;
export const RATES = CONTROLS.credits;
export interface Question { id: string; q: string; explainer?: string; hint?: string; hints?: string[]; answerExpr?: string; tol?: number; choices?: string[]; answer?: number; source: string; problem?: number; learn: string }
export interface Pool { license: string; attribution: string; pass: number; perAttempt: number; questions: Question[] }
export const POOLS: Record<string, Pool> = { 'constant.G': G_POOL as unknown as Pool };

/** Prerequisites with '*' expanded to every other control. */
export const prereqs = (id: string): string[] => {
  const p = CONTROL[id]?.prereqs ?? []; return p === '*' ? Object.keys(CONTROL).filter(n => n !== id) : p;
};

// ---- persistence: localStorage in the browser, memory elsewhere -------------------------------------------------
export interface KV { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void }
const memKV = (): KV => { const m = new Map<string, string>(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: k => void m.delete(k) }; };
let kv: KV = typeof localStorage !== 'undefined' ? localStorage : memKV();
export const useStorage = (s: KV = memKV()) => { kv = s; };
const read = <T>(k: string, d: T): T => { try { return JSON.parse(kv.getItem(k) ?? '') as T; } catch { return d; } };
const write = (k: string, v: unknown) => kv.setItem(k, JSON.stringify(v));

// ---- dev override -----------------------------------------------------------------------------------------------
let devAll = false;
try { devAll = !!(import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV && typeof location !== 'undefined' && new URLSearchParams(location.search).get('unlockAll') === '1'; } catch { devAll = false; }
export const setUnlockAll = (on: boolean) => { devAll = on; };

// ---- badges -----------------------------------------------------------------------------------------------------
export type Via = 'test' | 'credits' | 'purchase';
const badges = () => read<Record<string, Via>>('boreal.badges', {});
export const hasBadge = (id: string) => id in badges();
/** THE gate. Every gated control calls this before acting. */
export const canUse = (id: string) => devAll || hasBadge(id);
export const missingPrereqs = (id: string) => prereqs(id).filter(p => !hasBadge(p));
function grant(id: string, via: Via) { const b = badges(); b[id] = via; write('boreal.badges', b); }
export const resetBadges = () => { kv.removeItem('boreal.badges'); kv.removeItem('boreal.ledger'); kv.removeItem('boreal.quizSeen'); };

// ---- credit ledger (append-only) --------------------------------------------------------------------------------
export interface Entry { id: number; t: number; amount: number; reason: string; balance: number }
export const ledger = () => read<Entry[]>('boreal.ledger', []);
export const balance = () => { const l = ledger(); return l.length ? l[l.length - 1].balance : 0; };
function append(amount: number, reason: string, t: number) {
  const l = ledger(), e = { id: l.length + 1, t, amount, reason, balance: balance() + amount };
  write('boreal.ledger', [...l, e]); return e;
}
/** Earn credits for an interaction; capped per kind per minute (anti-farm). Returns the entry or null when capped. */
export function earn(kind: keyof typeof RATES.rates, t = Date.now(), less = 0) {
  const minute = Math.floor(t / 60000), got = ledger().filter(e => e.reason === `earn:${kind}` && Math.floor(e.t / 60000) === minute)
    .reduce((s, e) => s + e.amount, 0), rate = Math.max(1, RATES.rates[kind] - less), cap = RATES.capPerMinute[kind];
  if (got + rate > cap) return null;
  return append(rate, `earn:${kind}`, t);
}
export type Result = { ok: true } | { ok: false; why: string };
const prereqCheck = (id: string): Result | null => {
  if (!CONTROL[id]) return { ok: false, why: 'unknown control' };
  if (hasBadge(id)) return { ok: false, why: 'already held' };
  const m = missingPrereqs(id); return m.length ? { ok: false, why: `needs ${m.join(', ')}` } : null;
};
export function redeem(id: string, t = Date.now()): Result {
  const bad = prereqCheck(id); if (bad) return bad;
  const cost = CONTROL[id].cost; if (balance() < cost) return { ok: false, why: 'not enough credits' };
  append(-cost, `spend:${id}`, t); grant(id, 'credits'); return { ok: true };
}

// ---- purchase hook ----------------------------------------------------------------------------------------------
export interface PlatformStore { purchase(controlId: string): Promise<boolean> }
/** No store yet: every purchase is declined. */
export const NoopStore: PlatformStore = { purchase: async () => false };
let platform: PlatformStore = NoopStore;
export const setPlatformStore = (s: PlatformStore) => { platform = s; };
export async function buy(id: string): Promise<Result> {
  const bad = prereqCheck(id); if (bad) return bad;
  if (!(await platform.purchase(id))) return { ok: false, why: 'purchase declined' };
  grant(id, 'purchase'); return { ok: true };
}

// ---- tests (no repeats until the pool is exhausted) -------------------------------------------------------------
const truth = (q: Question) => q.answerExpr !== undefined ? new Function(...Object.keys(evaluate()), `return (${q.answerExpr});`)(...Object.values(evaluate())) as number : q.answer!;
export const answerOf = truth;
/** Draw the next attempt's questions without replacement; seen ids persist per control; reset when exhausted. */
export function drawTest(id: string, seed = Date.now()): Question[] {
  const pool = POOLS[CONTROL[id]?.quiz]; if (!pool) return [];
  const seenAll = read<Record<string, string[]>>('boreal.quizSeen', {}); let seen = seenAll[id] ?? [];
  let fresh = pool.questions.filter(q => !seen.includes(q.id));
  if (fresh.length < pool.perAttempt) { seen = []; fresh = pool.questions.slice(); }
  const r = random(hash(`${id}:${seed}`)), order = fresh.map(q => ({ q, k: r() })).sort((a, b) => a.k - b.k).map(x => x.q);
  const pick = order.slice(0, pool.perAttempt).map(q => q.choices ? shuffleChoices(q, r) : q);
  seenAll[id] = [...seen, ...pick.map(q => q.id)]; write('boreal.quizSeen', seenAll); return pick;
}
function shuffleChoices(q: Question, r: () => number): Question {
  const idx = q.choices!.map((_, i) => i).map(i => ({ i, k: r() })).sort((a, b) => a.k - b.k).map(x => x.i);
  return { ...q, choices: idx.map(i => q.choices![i]), answer: idx.indexOf(q.answer!) };
}
/** Credit for one answer: 1 if right (numeric within tol, default 8%), 0.5 if a multiple-choice second try is right. */
export function credit(q: Question, a: number | [number, number]) {
  if (q.answerExpr !== undefined) { const v = truth(q), x = Array.isArray(a) ? a[0] : a; return Math.abs(x - v) <= Math.abs(v) * (q.tol ?? .08) ? 1 : 0; }
  const [first, second] = Array.isArray(a) ? a : [a, undefined];
  return first === q.answer ? 1 : second === q.answer ? .5 : 0;
}
export const correct = (q: Question, a: number | [number, number]) => credit(q, a) > 0;
/** Grade an attempt; pass at score >= pool.pass (~70%) with all prereqs held grants the badge. Failing costs nothing;
 *  draw again for fresh questions. Every answer, right or wrong, earns credits (learning is an interaction). */
/** Hint `tier` (0 nudge, 1 clue, 2 walkthrough) for a question; tiers come in order, always available. */
export const hint = (q: Question, tier: number) => q.hints?.[Math.min(tier, (q.hints?.length ?? 1) - 1)] ?? q.explainer ?? '';
/** Credits for one answer: the answer rate minus 1 per hint used (never below 1). */
export const answerCredits = (hintsUsed = 0) => Math.max(1, RATES.rates.answer - hintsUsed);
/** `hintsUsed[i]` = how many tiers were opened. All tiers open (the walkthrough) = that question can't count toward the pass. */
export function submitTest(id: string, qs: Question[], answers: (number | [number, number])[], t = Date.now(), hintsUsed: number[] = []) {
  const pool = POOLS[CONTROL[id]?.quiz]; if (!pool || !qs.length) return { score: 0, passed: false, message: 'no sourced test yet (todo)', learn: [] as string[] };
  const revealed = (i: number) => (hintsUsed[i] ?? 0) >= (qs[i].hints?.length ?? Infinity);
  const got = qs.reduce((s, q, i) => s + (revealed(i) ? 0 : credit(q, answers[i])), 0), score = got / qs.length;
  qs.forEach((_, i) => earn('answer', t + i, hintsUsed[i] ?? 0));
  const bad = prereqCheck(id), passed = score >= pool.pass && !bad;
  if (passed) grant(id, 'test');
  const message = `you got ${got} of ${qs.length}` + (passed ? ' - nice, badge earned' : bad && !bad.ok ? ` - ${bad.why}` : ' - nice try, go again for new questions');
  return { score, passed, message, learn: qs.filter((q, i) => credit(q, answers[i]) < 1).map(q => q.learn) };
}
