import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mintUniverseSeed,
  normalizeUniverseSeed,
  worldSeedFromUniverse,
  universeStream,
  writeUniverseSeed,
  readUniverseSeed,
  UNIVERSE_SEED_KEY,
} from '../src/core/universeSeed.ts';
import { cycleToSeconds, expansionRatio, spaceExtent, ALPHA_STAR } from '../src/core/cosmicTime.ts';

test('mintUniverseSeed is non-zero and changes across calls when random differs', () => {
  const a = mintUniverseSeed(() => 0.1, () => 1);
  const b = mintUniverseSeed(() => 0.9, () => 2);
  assert.ok(a > 0);
  assert.ok(b > 0);
  assert.notEqual(a, b);
});

test('normalizeUniverseSeed rejects zero/NaN and keeps u32', () => {
  assert.equal(normalizeUniverseSeed(0), 0);
  assert.equal(normalizeUniverseSeed(-3), 0);
  assert.equal(normalizeUniverseSeed(Number.NaN), 0);
  assert.equal(normalizeUniverseSeed(42.9), 42);
});

test('worldSeedFromUniverse is stable', () => {
  assert.equal(worldSeedFromUniverse(1400), worldSeedFromUniverse(1400));
  assert.notEqual(worldSeedFromUniverse(1400), 1400);
});

test('universeStream is deterministic per label', () => {
  const a = universeStream(99, 'dark-ages')();
  const b = universeStream(99, 'dark-ages')();
  const c = universeStream(99, 'ionization')();
  assert.equal(a, b);
  assert.notEqual(a, c);
});

test('writeUniverseSeed stores seed', () => {
  const mem = new Map<string, string>();
  const storage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => { mem.set(k, v); },
    removeItem: (k: string) => { mem.delete(k); },
    clear: () => mem.clear(),
    key: () => null,
    get length() { return mem.size; },
  } as Storage;
  writeUniverseSeed(1400, storage);
  assert.equal(readUniverseSeed(storage), 1400);
  assert.equal(mem.get(UNIVERSE_SEED_KEY), '1400');
});

test('space extent is 0 at t=0 and grows across the log map', () => {
  assert.equal(spaceExtent(0), 0);
  assert.ok(spaceExtent(5.39e-44) >= 0);
  assert.ok(spaceExtent(1e-20) > spaceExtent(5.39e-44));
  assert.ok(spaceExtent(1e17) > spaceExtent(1e-20));
});

test('cycle 0 is nothing; cycle 1 is Planck', () => {
  assert.equal(cycleToSeconds(0), 0);
  assert.ok(Math.abs(cycleToSeconds(1) - 5.39e-44) < 1e-50);
});

test('expansion ratio is finite for mid times', () => {
  const xi = expansionRatio(1e-20);
  assert.ok(Number.isFinite(xi));
  assert.ok(xi >= 0);
  assert.ok(ALPHA_STAR > 0);
});
