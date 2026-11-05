import test from 'node:test';
import assert from 'node:assert/strict';
import { GOVERNOR, resetGovernor } from '../src/core/quality';
import { PROBE, cachedProbe, saveProbe } from '../src/core/probe';
import {
  COLD_START, WARM_START, parseWarmStamp, readWarmStamp, saveWarmStamp, standChunkIndex, standPoint,
  startup, startupBudget, startupRoute, type StartupOptions,
} from '../src/render/startup';
import type { buildScene } from '../src/render/buildScene';

type View = ReturnType<typeof buildScene>;
const mem = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, m };
};
const gov = () => ({ auto: GOVERNOR.auto, tier: GOVERNOR.tier, probeCap: GOVERNOR.probeCap, gpu: GOVERNOR.gpu, cool: GOVERNOR.cool, onProbeRaise: GOVERNOR.onProbeRaise });
const restore = (s: ReturnType<typeof gov>) => { resetGovernor(); Object.assign(GOVERNOR, s); };

test('startup route is warm only for a cached probe, this build, and this tab', () => {
  const stamp = { build: 'build-a', renderer: 'RTX' };
  const warm = { reprobe: false, skipProbe: false, cached: true, buildId: 'build-a', renderer: 'RTX', stamp };
  assert.equal(startupRoute(warm), 'warm');
  assert.equal(startupRoute({ ...warm, reprobe: true }), 'cold');
  assert.equal(startupRoute({ ...warm, skipProbe: true }), 'cold');
  assert.equal(startupRoute({ ...warm, cached: false }), 'cold');
  assert.equal(startupRoute({ ...warm, stamp: undefined }), 'cold');
  assert.equal(startupRoute({ ...warm, buildId: 'build-b' }), 'cold');
  assert.equal(startupRoute({ ...warm, renderer: 'Intel' }), 'cold');
  assert.equal(startupRoute({ ...warm, buildId: '' }), 'cold');
  assert.equal(startupRoute({ ...warm, renderer: '' }), 'cold');
  assert.equal(startupRoute({ ...warm, stamp: { build: 'build-a', renderer: 'Other' } }), 'cold');
});

test('warm budget keeps the sky cap and the land ceiling, and does not block on the next tier', () => {
  const warm = startupBudget('warm'), cold = startupBudget('cold');
  assert.equal(warm.leaveWhenChunkBuilt, true);
  assert.equal(cold.leaveWhenChunkBuilt, false);
  assert.equal(warm.skyMaxMs, COLD_START.skyMaxMs);
  assert.equal(warm.settleMaxMs, COLD_START.settleMaxMs);
  assert.equal(warm.settleQuiet, WARM_START.settleQuiet);
  assert.equal(cold.settleQuiet, COLD_START.settleQuiet);
  assert.equal(warm.compileBeforeProbe, false);
  assert.equal(cold.compileBeforeProbe, true);
  assert.equal(warm.warmUpMs, 0);
  assert.equal(cold.warmUpMs, 6000);
  assert.equal(WARM_START.key, 'boreal.startup.warm.v1');
  assert.notEqual(WARM_START.key, PROBE.key);
});

test('warm stamp and stand cell are pure', () => {
  assert.equal(parseWarmStamp(null), undefined);
  assert.equal(parseWarmStamp('{'), undefined);
  assert.equal(parseWarmStamp(JSON.stringify({ build: '', renderer: 'A' })), undefined);
  assert.equal(parseWarmStamp(JSON.stringify({ build: 'b', renderer: '' })), undefined);
  assert.deepEqual(parseWarmStamp(JSON.stringify({ build: 'b', renderer: 'A', extra: 1 })), { build: 'b', renderer: 'A' });
  const store = mem();
  assert.equal(readWarmStamp(store), undefined);
  saveWarmStamp(store, { build: 'b', renderer: 'A' });
  assert.deepEqual(readWarmStamp(store), { build: 'b', renderer: 'A' });
  saveWarmStamp(undefined, { build: 'b', renderer: 'A' });
  assert.deepEqual(standPoint('', { x: 3, z: 4 }), { x: 3, z: 4 });
  assert.deepEqual(standPoint('?at=10,20,1', { x: 3, z: 4 }), { x: 10, z: 20 });
  assert.deepEqual(standPoint('at=10,20', { x: 3, z: 4 }), { x: 10, z: 20 });
  assert.deepEqual(standPoint('?at=nope', { x: 3, z: 4 }), { x: 3, z: 4 });
  assert.equal(standPoint('', undefined), undefined);
  assert.deepEqual(standChunkIndex(41, -1, 40), { a: 1, b: -1 });
  assert.deepEqual(standChunkIndex(0, 0, 40), { a: 0, b: 0 });
});

interface Boot {
  opts?: StartupOptions;
  environment?: unknown;
  ibl?: number;
  landReady?: () => boolean;
  busy?: () => boolean;
  measure?: () => Promise<{ renderer: string; benchMs: number; maxTexture: number; deviceMemory: number; cores: number }>;
  cells?: [number, number][];
  here?: { x: number; z: number };
}
function harness(partial: Boot = {}) {
  const compiles: number[] = [], warmUps: Array<number | undefined> = [], steps: string[] = [];
  let t = 0, pumps = 0;
  const scene = { environment: partial.environment === undefined ? {} : partial.environment };
  const view = {
    scene,
    livingHere: () => partial.here ?? { x: 0, z: 0, handle: 'h', species: 'wolf', embodied: 'h' },
    chunkBuilt: (a: number, b: number) => { partial.cells?.push([a, b]); return partial.landReady ? partial.landReady() : true; },
    photoreal: {
      tier: { ibl: partial.ibl ?? 1 },
      compile: async () => { compiles.push(GOVERNOR.tier); },
      warmUp: async (_tier: unknown, maxMs?: number) => { warmUps.push(maxMs); },
      INFO: { workMs: 8 },
      gpuMs: 8,
      renderer: { getContext: () => ({ getParameter: () => 8192, MAX_TEXTURE_SIZE: 0x0D33 }) },
    },
  };
  const pump = async () => { pumps++; t += 16; };
  const now = () => t;
  return {
    view: view as unknown as View, scene, compiles, warmUps, steps, pump, now,
    get pumps() { return pumps; }, reset() { t = 0; pumps = 0; compiles.length = 0; warmUps.length = 0; steps.length = 0; },
  };
}

test('a return reload compiles once and does not bench again; a full queue no longer holds the land step', async () => {
  const saved = gov(); GOVERNOR.gpu = 'TEST GPU'; GOVERNOR.tier = 1; GOVERNOR.probeCap = 0; GOVERNOR.auto = true;
  const probeStore = mem(), warmStore = mem();
  let measured = 0;
  const h = harness();
  const measure = async () => { measured++; return { renderer: GOVERNOR.gpu, benchMs: 9, maxTexture: 8192, deviceMemory: 8, cores: 8 }; };
  const common = { probeStorage: probeStore, warmStorage: warmStore, buildId: 'build-a', pump: h.pump, now: h.now, measureProbe: measure, busy: () => false, landReady: () => true };
  try {
    const first = await startup(h.view, { step: (label) => h.steps.push(label) }, common);
    assert.equal(measured, 1, 'first visit benches');
    assert.equal(cachedProbe(probeStore, GOVERNOR.gpu)?.cap, 0);
    assert.deepEqual(readWarmStamp(warmStore), { build: 'build-a', renderer: 'TEST GPU' });
    assert.ok(first);
    assert.equal(h.compiles.length, 1, 'fast bench leaves the start tier, so one compile');
    assert.equal(h.warmUps[0], 6000);
    const coldPumps = h.pumps;
    assert.ok(coldPumps >= COLD_START.settleQuiet, `cold land wait ran (${coldPumps})`);
    h.reset();
    const second = await startup(h.view, { step: (label) => h.steps.push(label) }, common);
    assert.equal(measured, 1, 'cached probe is not benched again');
    assert.equal(probeStore.m.size, 1);
    assert.equal(h.compiles.length, 1, 'warm path still compiles the live tier');
    assert.equal(h.warmUps[0], 0, 'next tier is queued, not awaited');
    assert.ok(h.pumps < coldPumps);
    assert.ok(h.pumps < 30, `warm pumps ${h.pumps}`);
    assert.equal(second?.cap, first?.cap);
    assert.ok(h.steps.includes('Compiling shaders…'));
    assert.ok(h.steps.includes('Lighting the sky…'));
  } finally { restore(saved); }
});

test('grass still queued: cold waits out the ceiling, warm returns once the standing chunk is in', async () => {
  const saved = gov(); GOVERNOR.gpu = 'TEST GPU'; GOVERNOR.tier = 1; GOVERNOR.probeCap = 0; GOVERNOR.auto = true;
  const probeStore = mem(); saveProbe(probeStore, { renderer: 'TEST GPU', benchMs: 9 });
  const h = harness();
  let measured = 0;
  const measure = async () => { measured++; return { renderer: 'TEST GPU', benchMs: 80, maxTexture: 8192, deviceMemory: 8, cores: 8 }; };
  try {
    await startup(h.view, { step() {} }, {
      probeStorage: probeStore, warmStorage: mem(), buildId: 'build-a', pump: h.pump, now: h.now,
      measureProbe: measure, busy: () => true, landReady: () => true,
    });
    const coldPumps = h.pumps;
    assert.equal(measured, 0, 'a cached probe skips the Ultra bench even on the cold route');
    assert.ok(coldPumps > 500, `cold wait while the queue stays full (${coldPumps})`);
    assert.equal(h.warmUps[0], 6000);
    h.reset();
    const warmStore = mem(); saveWarmStamp(warmStore, { build: 'build-a', renderer: 'TEST GPU' });
    await startup(h.view, { step() {} }, {
      probeStorage: probeStore, warmStorage: warmStore, buildId: 'build-a', pump: h.pump, now: h.now,
      measureProbe: measure, busy: () => true, landReady: () => true,
    });
    assert.equal(measured, 0);
    assert.ok(h.pumps < 30, `warm pumps while flora stays queued (${h.pumps})`);
    assert.equal(h.compiles.length, 1);
    assert.equal(h.warmUps[0], 0);
  } finally { restore(saved); }
});

test('warm does not reveal before the standing chunk, and does not skip a missing sky', async () => {
  const saved = gov(); GOVERNOR.gpu = 'TEST GPU'; GOVERNOR.tier = 1; GOVERNOR.auto = true;
  const probeStore = mem(); saveProbe(probeStore, { renderer: 'TEST GPU', benchMs: 9 });
  const warmStore = mem(); saveWarmStamp(warmStore, { build: 'build-a', renderer: 'TEST GPU' });
  const h = harness({ environment: null, ibl: 1 });
  try {
    await startup(h.view, { step() {} }, {
      probeStorage: probeStore, warmStorage: warmStore, buildId: 'build-a', pump: h.pump, now: h.now,
      landReady: () => false, busy: () => false, measureProbe: async () => { throw new Error('bench'); },
    });
    assert.ok(h.pumps > 500, `no chunk: stay on the land ceiling (${h.pumps})`);
    assert.equal(h.compiles.length, 1, 'shaders still compile after the land ceiling');
    h.reset(); h.scene.environment = null;
    let seen = 0;
    await startup(h.view, { step() {} }, {
      probeStorage: probeStore, warmStorage: warmStore, buildId: 'build-a', pump: async () => { seen++; h.pump(); if (seen === 4 + 5) h.scene.environment = {}; }, now: h.now,
      landReady: () => true, measureProbe: async () => { throw new Error('bench'); },
    });
    assert.ok(seen > 4, 'sky wait runs after the chunk is ready');
    assert.ok(seen < 40, `sky returns when the environment map exists (${seen})`);
    assert.equal(h.compiles.length, 1);
  } finally { restore(saved); }
});

test('?reprobe, a new build, and a missing cache keep the full probe; the cache key stays per renderer', async () => {
  const saved = gov(); GOVERNOR.gpu = 'TEST GPU'; GOVERNOR.tier = 1; GOVERNOR.probeCap = 0; GOVERNOR.auto = true;
  const probeStore = mem(), warmStore = mem();
  saveProbe(probeStore, { renderer: 'TEST GPU', benchMs: 9 });
  saveWarmStamp(warmStore, { build: 'build-a', renderer: 'TEST GPU' });
  let measured = 0;
  const h = harness();
  const measure = async () => { measured++; return { renderer: GOVERNOR.gpu, benchMs: 80, maxTexture: 4096, deviceMemory: 8, cores: 8 }; };
  const base = { probeStorage: probeStore, warmStorage: warmStore, pump: h.pump, now: h.now, measureProbe: measure, busy: () => false, landReady: () => true };
  try {
    const again = await startup(h.view, { step() {} }, { ...base, buildId: 'build-a', reprobe: true });
    assert.equal(measured, 1);
    assert.ok((again?.benchMs ?? 0) > 40, 'reprobe replaces the cached bench');
    assert.equal(h.warmUps[0], 6000);
    assert.ok(h.compiles.length >= 1);
    h.reset(); measured = 0;
    const other = mem(); saveProbe(other, { renderer: 'OTHER GPU', benchMs: 9 });
    await startup(h.view, { step() {} }, { ...base, probeStorage: other, buildId: 'build-a' });
    assert.equal(measured, 1, 'a different renderer string is a cache miss');
    assert.equal(cachedProbe(other, 'OTHER GPU'), undefined, 'one probe record: the new bench replaces it');
    assert.equal(cachedProbe(other, 'TEST GPU')?.renderer, 'TEST GPU');
    h.reset(); measured = 0; GOVERNOR.tier = 1;
    const cachedSlow = mem(); saveProbe(cachedSlow, { renderer: 'TEST GPU', benchMs: 30 });
    await startup(h.view, { step() {} }, { ...base, probeStorage: cachedSlow, buildId: 'build-b' });
    assert.equal(measured, 0, 'a new build reuses the probe cache');
    assert.equal(h.warmUps[0], 6000, 'a new build still takes the long compile path');
    assert.equal(h.compiles[0], 1, 'cold compiles before the cached tier is applied');
    assert.equal(h.compiles.at(-1), 3, 'then it compiles the cached cap');
    h.reset(); measured = 0;
    const empty = mem();
    await startup(h.view, { step() {} }, { ...base, probeStorage: empty, warmStorage: mem(), buildId: 'build-a' });
    assert.equal(measured, 1, 'no cached probe runs the Ultra bench');
    assert.equal(h.warmUps[0], 6000);
    h.reset(); measured = 0;
    const blank = mem();
    const probeBefore = probeStore.m.get(PROBE.key);
    await startup(h.view, { step() {} }, { ...base, warmStorage: blank, skipProbe: true });
    assert.equal(measured, 0);
    assert.equal(h.warmUps[0], 6000, 'bench and noprobe keep the long warm-up');
    assert.equal(readWarmStamp(blank), undefined, 'skipProbe does not mark the tab warm');
    assert.equal(probeStore.m.get(PROBE.key), probeBefore, 'skipProbe does not rewrite the probe cache');
  } finally { restore(saved); }
});

test('warm compile uses the cached tier, and the standing cell follows ?at= then the store point', async () => {
  const saved = gov(); GOVERNOR.gpu = 'TEST GPU'; GOVERNOR.tier = 1; GOVERNOR.auto = true;
  const probeStore = mem(); saveProbe(probeStore, { renderer: 'TEST GPU', benchMs: 30 }); // cap 3, cheaper than the start tier
  const warmStore = mem(); saveWarmStamp(warmStore, { build: 'build-a', renderer: 'TEST GPU' });
  const cells: [number, number][] = [];
  const h = harness({ cells, here: { x: 41, z: -1 } });
  try {
    await startup(h.view, { step() {} }, {
      probeStorage: probeStore, warmStorage: warmStore, buildId: 'build-a', pump: h.pump, now: h.now,
      busy: () => true, measureProbe: async () => { throw new Error('bench'); },
    });
    assert.equal(h.compiles.length, 1);
    assert.equal(h.compiles[0], 3, 'one compile, at the cached cap, not the start tier');
    assert.deepEqual(cells[0], [1, -1]);
    assert.equal(GOVERNOR.probeCap, 3);
  } finally { restore(saved); }
});
