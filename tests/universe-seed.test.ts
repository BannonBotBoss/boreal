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
  WORLD_SEED_KEY,
} from '../src/core/universeSeed';

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

test('worldSeedFromUniverse is stable and differs from the parent seed in the common case', () => {
  assert.equal(worldSeedFromUniverse(1400), worldSeedFromUniverse(1400));
  assert.equal(worldSeedFromUniverse(1), worldSeedFromUniverse(1));
  assert.notEqual(worldSeedFromUniverse(1400), 1400);
});

test('universeStream is deterministic per label', () => {
  const a = universeStream(99, 'dark-ages')();
  const b = universeStream(99, 'dark-ages')();
  const c = universeStream(99, 'ionization')();
  assert.equal(a, b);
  assert.notEqual(a, c);
});

test('writeUniverseSeed stores universe and derived world seed', () => {
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
  assert.equal(mem.get(WORLD_SEED_KEY), String(worldSeedFromUniverse(1400)));
});
