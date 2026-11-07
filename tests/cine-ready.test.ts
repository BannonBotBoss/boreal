import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CINE, formatClock } from '../src/world/cosmos/cineBeats';
import { cineArrivalDue, stepCineBoot } from '../src/world/cosmos/cineReady';
import { createOpening } from '../src/world/cosmos/opening';
import { cineLayerGateState } from '../src/world/globe/planetLayers';
import { bootChoice, createContext, markBigBangSeen } from '../src/core/events';
import { BOOT_READY_MS, BOOT_READY_SAMPLES_MS, PREWARM_SAMPLES_MS } from '../src/world/globe/bootReady';
import { settleOr } from '../src/render/startup';

const boot = (over: Partial<Parameters<typeof stepCineBoot>[0]> = {}) => ({
  elapsed: 0, waited: 0, begun: false, booted: false, gaveUp: false, pinned: false, ...over,
});

test('the B13 clamp is 241 million years ago; 232 million is just after B13 and is not the held frame', () => {
  const held = CINE.b13End - 0.05;
  assert.equal(formatClock(held), '241 million years ago');
  assert.equal(formatClock(108.025), '232 million years ago');
  const stuck = stepCineBoot(boot({ elapsed: 107, waited: 0, begun: true }), 2, 10_000);
  assert.equal(stuck.elapsed, held);
  assert.equal(stuck.gaveUp, false);
  assert.equal(formatClock(stuck.elapsed), '241 million years ago');
});

test('a ready globe is not held, and a missed budget releases into B14', () => {
  const ready = stepCineBoot(boot({ elapsed: 107, waited: 1, begun: true, booted: true }), 2, 30);
  assert.equal(ready.elapsed, 109);
  assert.equal(ready.gaveUp, false);
  const early = stepCineBoot(boot({ elapsed: 20, waited: 4.5, begun: true }), 0.5, 5);
  assert.equal(early.gaveUp, true);
  assert.equal(early.elapsed, 20.5);
  const released = stepCineBoot(boot({ elapsed: 107.95, waited: 5, begun: true, gaveUp: true }), 1, 5);
  assert.equal(released.elapsed, 108.95);
  assert.equal(cineArrivalDue(108, true, true, false, false), true);
  assert.equal(cineArrivalDue(108, false, false, true, false), false);
  assert.equal(cineArrivalDue(116, false, false, true, false), true);
  assert.equal(cineArrivalDue(116, false, false, true, true), false);
});

test('a diagnostic pin does not burn the budget or snap back to the clamp', () => {
  const pinned = stepCineBoot(boot({ elapsed: 112, waited: 0, begun: true, pinned: true }), 5, 1);
  assert.equal(pinned.elapsed, 112);
  assert.equal(pinned.waited, 0);
  assert.equal(pinned.gaveUp, false);
});

test('settleOr returns the value, the rejection, or the fallback when the wait wins', async () => {
  assert.equal(await settleOr(Promise.resolve('sim'), 50, 'fallback', () => new Promise(() => {})), 'sim');
  assert.equal(await settleOr(Promise.reject(new Error('wasm')), 50, 'fallback', () => new Promise(() => {})), 'fallback');
  let release: () => void = () => {};
  const hung = settleOr(new Promise(() => {}), 10, 'fallback', () => new Promise<void>(r => { release = r; }));
  release();
  assert.equal(await hung, 'fallback');
  let late = false;
  const p = new Promise<string>(r => setTimeout(() => { late = true; r('later'); }, 0));
  assert.equal(await settleOr(p, 0, 'fallback', () => Promise.resolve()), 'fallback');
  await p;
  assert.equal(late, true);
});

test('the boot budget is the ceil of the slowest measured successful bootP, not a round guess', () => {
  assert.ok(BOOT_READY_SAMPLES_MS.length >= 2);
  const slowest = Math.max(...BOOT_READY_SAMPLES_MS);
  assert.equal(BOOT_READY_MS, Math.ceil(slowest));
  assert.ok(BOOT_READY_MS < CINE.b13End * 1000, 'a measured success finishes before the B13 hold, so the hold is not the steady cadence');
  const slowestPrewarm = Math.max(...PREWARM_SAMPLES_MS);
  assert.ok(slowestPrewarm < 83.2 * 1000, 'on these runs prewarm finished before the film draws the earth');
  assert.ok(BOOT_READY_MS <= Math.ceil(slowestPrewarm));
});

test('return visits do not open the sphere, and the first-visit prewarm failure is logged', () => {
  assert.equal(bootChoice('sphere', true, null), 'globe');
  assert.equal(bootChoice('sphere', false, null), 'sphere');
  const main = readFileSync('src/main.ts', 'utf8');
  assert.match(main, /prewarm\(\)\.catch\(e => console\.warn\('inpage prewarm'/);
  assert.match(main, /whenBooted\(\)/);
  const view = readFileSync('src/world/globe/globeView.ts', 'utf8');
  assert.match(view, /settleOr\(simP, BOOT_READY_MS, null\)/);
  assert.ok(view.indexOf('finally { booted = true; }') !== -1);
});

function installDom(search: string, reduced: boolean) {
  const nodes: Fake[] = [];
  type Fake = {
    tag: string; id: string; className: string; textContent: string; hidden: boolean;
    style: { setProperty: (k: string, v: string, i?: string) => void; cssText: string };
    classList: { add: (...c: string[]) => void; remove: (...c: string[]) => void; toggle: (c: string, on?: boolean) => void };
    dataset: Record<string, string>; children: Fake[]; parent: Fake | null;
    append: (...kids: Fake[]) => void; remove: () => void; setAttribute: () => void;
    getContext: () => null; replaceChildren: () => void; insertBefore: (node: Fake, before: Fake | null) => Fake;
    clientWidth: number; clientHeight: number; width: number; height: number; offsetWidth: number;
    preload: string; onended: null | (() => void); ended: boolean; duration: number;
    play: () => Promise<void>; pause: () => void; currentTime: number; volume: number; crossOrigin: string;
    src: string; muted: boolean; loop: boolean; playsInline: boolean; alt: string; type: string;
  };
  const mk = (tag: string): Fake => {
    const node = {
      tag, id: '', className: '', textContent: '', hidden: false,
      style: { setProperty() {}, cssText: '' },
      classList: { add() {}, remove() {}, toggle() {} },
      dataset: {}, children: [] as Fake[], parent: null as Fake | null,
      append(...kids: Fake[]) { for (const k of kids) { k.parent = node; node.children.push(k); } },
      remove() { const p = node.parent; if (p) p.children = p.children.filter(c => c !== node); node.parent = null; },
      setAttribute() {}, getContext: () => null, replaceChildren() { node.children = []; },
      insertBefore(child: Fake) { child.parent = node; node.children.push(child); return child; },
      clientWidth: 800, clientHeight: 600, width: 0, height: 0, offsetWidth: 1,
      preload: '', onended: null, ended: false, duration: Number.NaN,
      play: () => Promise.resolve(), pause() {}, currentTime: 0, volume: 1, crossOrigin: '',
      src: '', muted: false, loop: false, playsInline: false, alt: '', type: '',
    };
    nodes.push(node);
    return node;
  };
  const walk = (n: Fake, id: string): Fake | null => {
    if (n.id === id) return n;
    for (const c of n.children) { const f = walk(c, id); if (f) return f; }
    return null;
  };
  const body = mk('body');
  const head = mk('head');
  const root = mk('html');
  root.append(head, body);
  const g = globalThis as Record<string, unknown>;
  g.document = {
    body, head, documentElement: mk('html'),
    getElementById: (id: string) => walk(body, id) ?? walk(head, id),
    createElement: (tag: string) => mk(tag),
  };
  g.location = { search, hash: '' };
  g.localStorage = { getItem: () => null, setItem() {} };
  g.matchMedia = (q: string) => ({ matches: reduced && q.includes('reduce'), addEventListener() {}, removeEventListener() {} });
  g.Audio = function Audio(this: unknown) { return mk('audio'); };
  const listeners = new Map<string, ((e: unknown) => void)[]>();
  g.window = {
    addEventListener(type: string, fn: (e: unknown) => void) { const list = listeners.get(type) ?? []; list.push(fn); listeners.set(type, list); },
    removeEventListener() {},
    dispatchEvent(ev: { type: string }) { (g.window as { events: string[] }).events.push(ev.type); return true; },
    events: [] as string[],
    setTimeout, clearTimeout, innerWidth: 800, innerHeight: 600,
    devicePixelRatio: 1,
  };
  g.AudioContext = undefined;
  return g.window as { events: string[]; __borealOpening?: { begin: () => void; seek: (t: number) => void; elapsed: number }; __borealSave?: { markBigBangSeen?: () => void } };
}

function film(opts: { search?: string; reduced?: boolean; ready: () => Promise<void> }) {
  const w = installDom(opts.search ?? '', opts.reduced ?? false);
  let shows = 0, planets = 0, marks = 0;
  let ctx = createContext();
  w.__borealSave = { markBigBangSeen: () => { marks++; ctx = markBigBangSeen(ctx); } };
  const opening = createOpening(() => { planets++; }, () => {}, { show: () => { shows++; }, ready: opts.ready });
  const probe = w.__borealOpening!;
  const run = (limit = 400) => {
    let n = 0;
    while (probe.elapsed < CINE.b14End && n++ < limit) opening.step(1);
  };
  return { w, opening, probe, run, get shows() { return shows; }, get planets() { return planets; }, get marks() { return marks; }, get seen() { return ctx.introComplete === true; } };
}

test('first-visit readiness paths', { concurrency: false }, async (t) => {
  await t.test('a settling boot keeps B14 arrival, one save mark, and the layer gate', async () => {
    const f = film({ ready: () => Promise.resolve() });
    f.probe.begin();
    await Promise.resolve();
    const seen = new Set<number>();
    for (let i = 0; i < 130 && f.planets === 0; i++) { f.opening.step(1); seen.add(Math.round(f.probe.elapsed * 100) / 100); }
    assert.equal(seen.has(CINE.b13End - 0.05), false);
    assert.equal(f.shows, 1);
    assert.equal(f.planets, 1);
    assert.equal(f.marks, 1);
    assert.equal(f.seen, true);
    assert.equal(f.w.events.filter(e => e === 'cinematic:complete').length, 1);
    assert.equal(cineLayerGateState().on, true);
    assert.equal((globalThis as { document: { getElementById: (id: string) => unknown } }).document.getElementById('cine') != null, true);
    f.opening.step(1);
    f.opening.step(1);
    assert.equal(f.planets, 1);
    assert.equal(f.marks, 1);
  });

  await t.test('a rejected boot plays through B14 and lands once without showing a globe', async () => {
    const f = film({ ready: () => Promise.reject(new Error('boot failed')) });
    f.probe.begin();
    await Promise.resolve();
    await Promise.resolve();
    f.run();
    assert.ok(f.probe.elapsed >= CINE.b14End);
    assert.equal(f.shows, 0);
    assert.equal(f.planets, 1);
    assert.equal(f.marks, 1);
    assert.equal(f.seen, true);
    assert.equal(f.w.events.filter(e => e === 'cinematic:complete').length, 1);
    assert.equal((globalThis as { document: { getElementById: (id: string) => unknown; body: { className: string } } }).document.getElementById('cine'), null);
    f.opening.step(1);
    assert.equal(f.planets, 1);
    assert.equal(f.marks, 1);
  });

  await t.test('a boot that never settles still reaches B14 once the measured budget is spent', async () => {
    const f = film({ ready: () => new Promise<void>(() => {}) });
    f.probe.begin();
    f.opening.step(1);
    assert.ok(f.probe.elapsed < CINE.b13End);
    assert.equal(f.planets, 0);
    f.run(500);
    assert.ok(f.probe.elapsed >= CINE.b14End);
    assert.equal(f.shows, 0);
    assert.equal(f.planets, 1);
    assert.equal(f.marks, 1);
    assert.equal(f.w.events.length, 1);
  });

  await t.test('reduced motion still lands and does not arm the cinematic layer gate', async () => {
    const f = film({ reduced: true, ready: () => Promise.resolve() });
    f.probe.begin();
    await Promise.resolve();
    for (let i = 0; i < 130 && f.planets === 0; i++) f.opening.step(1);
    assert.equal(f.planets, 1);
    assert.equal(f.shows, 1);
    assert.equal(cineLayerGateState().on, false);
  });

  await t.test('?cine=B7 can sit past the clamp without finishing the intro', () => {
    const f = film({ search: '?cine=B7', ready: () => new Promise<void>(() => {}) });
    f.probe.seek(112);
    f.opening.step(1);
    assert.equal(f.probe.elapsed, 112);
    assert.equal(f.planets, 0);
    assert.equal(f.marks, 0);
    assert.notEqual(formatClock(f.probe.elapsed), '241 million years ago');
  });
});
