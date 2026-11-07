import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CINE, formatClock } from '../src/world/cosmos/cineBeats';
import { cineArrivalDue, stepCineBoot } from '../src/world/cosmos/cineReady';
import { createOpening } from '../src/world/cosmos/opening';
import { cineLayerGateState } from '../src/world/globe/planetLayers';
import { bootChoice, createContext, markBigBangSeen } from '../src/core/events';
import { BOOT_SAMPLES_MS, CINE_HOLD_MARGIN, CINE_HOLD_S, PREWARM_SAMPLES_MS } from '../src/world/globe/bootReady';

const boot = (over: Partial<Parameters<typeof stepCineBoot>[0]> = {}) => ({
  elapsed: 0, held: 0, begun: false, booted: false, gaveUp: false, pinned: false, ...over,
});

test('the B13 clamp is 241 million years ago; 232 million is just after B13 and is not the held frame', () => {
  const held = CINE.b13End - 0.05;
  assert.equal(formatClock(held), '241 million years ago');
  assert.equal(formatClock(108.025), '232 million years ago');
  const stuck = stepCineBoot(boot({ elapsed: 107, held: 0, begun: true }), 2, 10_000);
  assert.equal(stuck.elapsed, held);
  assert.equal(stuck.gaveUp, false);
  assert.equal(formatClock(stuck.elapsed), '241 million years ago');
});

test('the grace starts when the clamp engages, and a ready globe is not held', () => {
  const ready = stepCineBoot(boot({ elapsed: 107, held: 0, begun: true, booted: true }), 2, 9);
  assert.equal(ready.elapsed, 109);
  assert.equal(ready.gaveUp, false);
  assert.equal(ready.held, 0);
  let s = boot({ elapsed: 3, begun: true });
  for (let i = 0; i < 100; i++) {
    const n = stepCineBoot(s, 1, 9);
    s = { ...s, elapsed: n.elapsed, held: n.held, gaveUp: n.gaveUp };
  }
  assert.equal(s.gaveUp, false);
  assert.equal(s.held, 0);
  assert.ok(s.elapsed < CINE.b13End);
  let guard = 0;
  while (!s.gaveUp && guard++ < 30) {
    const n = stepCineBoot(s, 1, 9);
    s = { ...s, elapsed: n.elapsed, held: n.held, gaveUp: n.gaveUp };
  }
  assert.equal(s.gaveUp, true);
  assert.ok(s.held >= 9 && s.held < 12, `held ${s.held}`);
  assert.ok(s.elapsed >= CINE.b13End);
  const released = stepCineBoot(boot({ elapsed: 107.95, held: 9, begun: true, gaveUp: true }), 1, 9);
  assert.equal(released.elapsed, 108.95);
  assert.equal(cineArrivalDue(108.03, true, true, false, false), false);
  assert.equal(cineArrivalDue(112.3, true, true, false, false), false);
  assert.equal(cineArrivalDue(CINE.b14End, true, true, false, false), true);
  assert.equal(formatClock(108.03), '231 million years ago');
  assert.equal(formatClock(108.025), '232 million years ago');
  assert.equal(cineArrivalDue(108.025, true, true, false, false), false);
  assert.equal(cineArrivalDue(108, false, false, true, false), false);
  assert.equal(cineArrivalDue(116, false, false, true, false), true);
  assert.equal(cineArrivalDue(116, false, false, true, true), false);
  // Hang case: gave up, then ready() fulfilled with earth still off at b14End.
  assert.equal(cineArrivalDue(116, false, true, true, false), true);
  assert.equal(cineArrivalDue(CINE.b14End, false, true, false, false), true);
});

test('a diagnostic pin does not burn the grace or snap back to the clamp', () => {
  const pinned = stepCineBoot(boot({ elapsed: 112, held: 0, begun: true, pinned: true }), 5, 1);
  assert.equal(pinned.elapsed, 112);
  assert.equal(pinned.held, 0);
  assert.equal(pinned.gaveUp, false);
});

test('the B13 grace is twice the measured prewarm spread, and bootP is not on a timer', () => {
  const spread = Math.max(...PREWARM_SAMPLES_MS) - Math.min(...PREWARM_SAMPLES_MS);
  assert.equal(CINE_HOLD_MARGIN, 2);
  assert.equal(CINE_HOLD_S, Math.ceil(CINE_HOLD_MARGIN * spread / 1000));
  assert.ok(CINE_HOLD_S > spread / 1000, 'the grace is longer than the three-run spread');
  assert.ok(Math.max(...PREWARM_SAMPLES_MS) < 83.2 * 1000, 'measured prewarm finished before the earth frame');
  assert.ok(Math.max(...BOOT_SAMPLES_MS) < Math.min(...PREWARM_SAMPLES_MS));
  const view = readFileSync('src/world/globe/globeView.ts', 'utf8');
  assert.equal(view.includes('settleOr'), false);
  assert.match(view, /bootGlobe\(/);
  assert.match(view, /console\.warn\('globe boot failed'/);
  assert.match(view, /releaseFilm\(\)/);
  const bootFn = view.slice(view.indexOf('const bootP'), view.indexOf('if (atmos)'));
  assert.ok(bootFn.indexOf('booted = true') > bootFn.indexOf('bootGlobe('));
  assert.equal(bootFn.includes('BOOT_READY'), false);
});

test('return visits do not open the sphere, and the first-visit prewarm failure is logged', () => {
  assert.equal(bootChoice('sphere', true, null), 'globe');
  assert.equal(bootChoice('sphere', false, null), 'sphere');
  const main = readFileSync('src/main.ts', 'utf8');
  assert.match(main, /prewarm\(\)\.catch\(e => console\.warn\('inpage prewarm'/);
  assert.match(main, /whenBooted\(\)/);
  assert.match(main, /releaseFilm\(\)/);
  const pre = readFileSync('src/world/globe/inpage.ts', 'utf8');
  const warm = pre.slice(pre.indexOf('async prewarm'), pre.indexOf('g.attachViewpoint(null)'));
  assert.match(warm, /forestLanding\(\)/);
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
      style: { setProperty(k: string, v: string) { (node.style as unknown as Record<string, string>)[k] = v; }, cssText: '' },
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
  const played: string[] = [];
  g.Audio = function Audio(this: unknown, src?: string) {
    const n = mk('audio');
    if (src) n.src = src;
    n.play = () => { played.push(n.src); return Promise.resolve(); };
    return n;
  };
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
  const suns: number[] = [];
  (g.window as { __inpage?: { setFilmDrive: (yaw: number, radii: number, offset: number, sunBias?: number) => void } }).__inpage = {
    setFilmDrive(_yaw, _radii, _offset, sunBias) { suns.push(sunBias ?? 0); },
  };
  return Object.assign(g.window as { events: string[]; __borealOpening?: { begin: () => void; seek: (t: number) => void; elapsed: number }; __borealSave?: { markBigBangSeen?: () => void } }, { played, suns });
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
    let throughB14 = false;
    for (let i = 0; i < 200 && f.planets === 0; i++) {
      f.opening.step(1);
      seen.add(Math.round(f.probe.elapsed * 100) / 100);
      if (f.probe.elapsed >= 108.03 && f.probe.elapsed < CINE.b14End) throughB14 = true;
    }
    assert.equal(throughB14, true);
    assert.equal(seen.has(CINE.b13End - 0.05), false);
    assert.ok(f.probe.elapsed >= CINE.b14End);
    assert.equal(f.shows, 1);
    assert.equal(f.planets, 1);
    assert.equal(f.marks, 1);
    assert.equal(f.seen, true);
    assert.equal(f.w.events.filter(e => e === 'cinematic:complete').length, 1);
    assert.equal(cineLayerGateState().on, true);
    assert.equal((globalThis as { document: { getElementById: (id: string) => unknown } }).document.getElementById('cine'), null);
    f.opening.step(1);
    f.opening.step(1);
    assert.equal(f.planets, 1);
    assert.equal(f.marks, 1);
  });

  await t.test('Today, the sun grade, vo-b14 and the hero crossfade run before finish', async () => {
    const f = film({ ready: () => Promise.resolve() });
    const played = (f.w as { played: string[] }).played;
    const suns = (f.w as { suns: number[] }).suns;
    f.probe.begin();
    await Promise.resolve();
    let today = false, overlap = false, at108 = false;
    const nodesOf = (n: { className?: string; id?: string; textContent?: string; style?: { opacity?: string }; children?: unknown[] }): typeof n[] => {
      const out = [n];
      for (const c of n.children ?? []) out.push(...nodesOf(c as typeof n));
      return out;
    };
    for (let i = 0; i < 800 && f.planets === 0; i++) {
      f.opening.step(0.2);
      const t = f.probe.elapsed;
      if (t >= 108.03 && t < CINE.b14End) {
        at108 = true;
        assert.equal(f.planets, 0);
        assert.equal(cineArrivalDue(t, true, true, false, false), false);
      }
      const nodes = nodesOf((globalThis as unknown as { document: { body: { children: unknown[] } } }).document.body);
      const hero = nodes.find(n => n.className === 'hero-line');
      const panel = nodes.find(n => n.id === 'cine-panel');
      const count = nodes.find(n => n.className === 'count');
      if (count?.textContent === 'Today') today = true;
      const ho = Number(hero?.style?.opacity);
      const po = Number(panel?.style?.opacity);
      if (hero?.textContent?.includes('Today · 13.8 billion years') && ho > 0 && ho < 1 && Math.abs(po - (1 - ho)) < 1e-6) overlap = true;
    }
    assert.equal(at108, true);
    assert.equal(today, true);
    assert.equal(overlap, true);
    assert.ok(suns.some(s => s > 0 && s < 1), 'sun grade is partial between 108 and 112');
    assert.ok(suns.some(s => s >= 1), 'sun grade reaches full before the landing');
    assert.ok(played.some(s => s.includes('vo-b14-home')), 'vo-b14 plays before finish');
    assert.equal(f.planets, 1);
    assert.ok(f.probe.elapsed >= CINE.b14End);
    assert.equal(f.marks, 1);
    assert.equal(f.w.events.filter(e => e === 'cinematic:complete').length, 1);
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
