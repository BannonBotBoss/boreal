/**
 * The loading screen used to hit its ceiling while the terrain worker was still building the
 * stage grid, then fade away. The animal was left in a void: no terrain mesh, no trees, and
 * sometimes only the senses ring because the procedural body had been hidden.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { generateChunk } from '../src/core/world';
import { GOVERNOR, resetGovernor } from '../src/core/quality';
import { saveProbe } from '../src/core/probe';
import { COLD_START, GROUND_HOLD, startup, type StartupOptions } from '../src/render/startup';
import { proceduralBodyShare } from '../src/render/animalPicture';
import type { buildScene } from '../src/render/buildScene';

type View = ReturnType<typeof buildScene>;

test('the spawn chunk still has spruce outside the clearing', () => {
  const spruce = generateChunk(0, 0).filter(e => e.kind === 'spruce');
  assert.ok(spruce.length > 0, 'a landed chunk with no spruce is the empty forest');
  assert.ok(spruce.some(e => Math.hypot(e.x, e.z) >= 13), 'trees stand outside the 13 m clearing');
});

test('a coat that never draws does not hide the wolf', () => {
  assert.equal(proceduralBodyShare(true, true, 1, 0, 1, 0), 0, 'a drawn full mesh replaces the procedural body');
  assert.ok(proceduralBodyShare(true, true, 0, 0, 1, 0) > 0.5, 'no replacement mesh: the procedural wolf stays');
  assert.equal(proceduralBodyShare(false, true, 0, 0, 0.8, 0.2), 1);
  assert.equal(proceduralBodyShare(true, true, 0, 0, 0, 0), 0, 'a far speck is not a body');
  assert.equal(proceduralBodyShare(true, false, 0, 0, 1, 0), 0);
});

const mem = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } };
};

function boot(landReady: () => boolean, busy: () => boolean) {
  let t = 0;
  const steps: string[] = [];
  const scene = { environment: {} };
  const view = {
    scene,
    livingHere: () => ({ x: 0, z: 0, handle: 'h', species: 'wolf', embodied: 'h' }),
    chunkBuilt: () => landReady(),
    photoreal: {
      tier: { ibl: 0 },
      compile: async () => {},
      warmUp: async () => {},
      INFO: { workMs: 8 },
      gpuMs: 8,
      renderer: { getContext: () => ({ getParameter: () => 8192, MAX_TEXTURE_SIZE: 0x0D33 }) },
    },
  };
  const pump = async () => { t += 16; };
  const now = () => t;
  const opts: StartupOptions = {
    probeStorage: mem(), warmStorage: mem(), buildId: 'build-a', pump, now,
    busy, landReady, measureProbe: async () => { throw new Error('no bench'); },
  };
  saveProbe(opts.probeStorage!, { renderer: 'TEST GPU', benchMs: 9 });
  return { view: view as unknown as View, steps, opts, now };
}

test('the loader does not say Ready while the standing chunk is still out', async () => {
  const saved = { auto: GOVERNOR.auto, tier: GOVERNOR.tier, probeCap: GOVERNOR.probeCap, gpu: GOVERNOR.gpu };
  GOVERNOR.gpu = 'TEST GPU'; GOVERNOR.tier = 1; GOVERNOR.auto = true;
  const h = boot(() => false, () => true);
  try {
    const result = await startup(h.view, { step: (label) => h.steps.push(label) }, h.opts);
    assert.equal(result && 'ground' in result ? result.ground : undefined, false);
    assert.ok(h.steps.includes(GROUND_HOLD.building), 'the worker miss builds the chunk on this thread');
    assert.equal(h.steps.at(-1), GROUND_HOLD.missing);
    assert.equal(h.steps.includes('Ready'), false);
    assert.ok(h.now() >= COLD_START.settleMaxMs * 2 + GROUND_HOLD.recoverMs, 'splash wait, then the main-thread rebuild');
  } finally { resetGovernor(); Object.assign(GOVERNOR, saved); }
});

test('a chunk that arrives after the first ceiling still reveals, with trees on that ground', async () => {
  const saved = { auto: GOVERNOR.auto, tier: GOVERNOR.tier, probeCap: GOVERNOR.probeCap, gpu: GOVERNOR.gpu };
  GOVERNOR.gpu = 'TEST GPU'; GOVERNOR.tier = 1; GOVERNOR.auto = true;
  let t = 0, ready = false;
  const steps: string[] = [];
  const view = {
    scene: { environment: {} },
    livingHere: () => ({ x: 30, z: 0, handle: 'mama', species: 'wolf', embodied: 'mama' }),
    chunkBuilt: (a: number, b: number) => { assert.deepEqual([a, b], [0, 0]); return ready; },
    photoreal: {
      tier: { ibl: 0 },
      compile: async () => {},
      warmUp: async () => {},
      INFO: { workMs: 8 },
      gpuMs: 8,
      renderer: { getContext: () => ({ getParameter: () => 8192, MAX_TEXTURE_SIZE: 0x0D33 }) },
    },
  };
  const opts: StartupOptions = {
    probeStorage: mem(), warmStorage: mem(), buildId: 'build-a',
    pump: async () => { t += 16; if (t > COLD_START.settleMaxMs + 1000) ready = true; },
    now: () => t,
    busy: () => !ready,
    landReady: () => ready,
    measureProbe: async () => { throw new Error('no bench'); },
  };
  saveProbe(opts.probeStorage!, { renderer: 'TEST GPU', benchMs: 9 });
  try {
    const result = await startup(view as unknown as View, { step: (label) => steps.push(label) }, opts);
    assert.equal(result && 'ground' in result ? result.ground : undefined, true);
    assert.equal(steps.includes(GROUND_HOLD.building), false, 'a chunk that arrives in the splash wait does not rebuild here');
    assert.equal(steps.includes(GROUND_HOLD.missing), false);
    assert.equal(steps.at(-1), 'Ready');
    assert.ok(generateChunk(0, 0).some(e => e.kind === 'spruce'));
  } finally { resetGovernor(); Object.assign(GOVERNOR, saved); }
});
