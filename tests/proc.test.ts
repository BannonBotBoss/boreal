import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { hash, random, mulberry32, stream, range } from '../src/proc/rng';
import { random as coreRandom } from '../src/core/random';
import { mulberry32 as samplerRng } from '../src/core/surfaceSampler';
import { buildBody, wolfCoat } from '../src/core/body';
import { wolfTubes, sculptWolf } from '../src/core/wolfBody';
import { buildFurCards, strandAlpha } from '../src/render/furCards';
import { generateChunk } from '../src/core/world';

// The two generators that existed before proc/rng.ts, copied verbatim (core/random.ts and core/surfaceSampler.ts).
function legacyRandom(seed: number) {
  return () => { seed += 0x6d2b79f5; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function legacyMulberry32(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const digest = (x: string | Uint8Array) => createHash('sha256').update(x).digest('hex').slice(0, 16);

test('shared rng reproduces both legacy generators exactly', () => {
  const seeds = [0, 1, 3, 5, 9, 77, 1400, 0x51ab, 0xffffffff, 0x9e3779b9, -1, -123456, 1400 ^ 0x9e3779b9, hash('1:1400:0:0'), hash('stones-v1:1400:-2:3')];
  for (const s of seeds) {
    const a = random(s), b = legacyRandom(s), c = legacyMulberry32(s), d = coreRandom(s), e = samplerRng(s);
    for (let i = 0; i < 5000; i++) { const v = a(); assert.equal(v, b()); assert.equal(v, c()); assert.equal(v, d()); assert.equal(v, e()); }
  }
  assert.equal(mulberry32, random);
});

test('streams and ranges are seeded', () => {
  const a = stream(1400, 'hare-v1:1'), b = stream(1400, 'hare-v1:1'), c = stream(1400, 'hare-v1:2');
  const xs = [...Array(20)].map(() => range(a, [2, 5]));
  assert.deepEqual(xs, [...Array(20)].map(() => range(b, [2, 5])));
  assert.notDeepEqual(xs, [...Array(20)].map(() => range(c, [2, 5])));
  assert.ok(xs.every(x => x >= 2 && x < 5));
});

test('fur cards and world chunks are byte-identical to the pre-refactor baseline (56506c5)', () => {
  const body = buildBody(wolfTubes(wolfCoat(1400))), clear = sculptWolf(body);
  const g = buildFurCards(body, { count: 3000, length: .03, width: .0065, seed: 9, clear });
  const fur = Object.entries(g.attributes).map(([k, a]) => k + digest(new Uint8Array((a.array as Float32Array).buffer))).join(',');
  // Re-pinned for T-0075 (181874e9c7eb7b23 -> a75ee513cc7c2766): timber-grey coat stops and shoulder/tail guard-hair multipliers change the card colours and lengths on purpose. World-chunk digest below stays put.
  assert.equal(digest(fur), 'a75ee513cc7c2766');
  assert.equal(digest(new Uint8Array((strandAlpha().image.data as Uint8Array).buffer)), '8b54d4c67942e685');
  const chunks = []; for (let x = -3; x < 3; x++) for (let z = -3; z < 3; z++) chunks.push(generateChunk(x, z));
  // Re-pinned for T-0026 (ffe391673e1a808a -> 0a067128ffccd4bf): site-driven Shield rock placement & organic-mat burial intentionally change generateChunk rock entities; fur digests above are unchanged.
  assert.equal(digest(JSON.stringify(chunks)), '0a067128ffccd4bf');
});

test('shared math matches the helpers it replaced', async () => {
  const { angleTurn, smoothstep, smooth01, stepForward } = await import('../src/proc/math');
  const oldTurn = (from: number, to: number, max: number) => { const d = ((to - from + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; return from + Math.max(-max, Math.min(max, d)); };
  const oldSmooth = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const r = random(42);
  for (let i = 0; i < 2000; i++) {
    const a = (r() - .5) * 40, b = (r() - .5) * 40, m = r() * 3, x = (r() - .5) * 30;
    assert.equal(angleTurn(a, b, m), oldTurn(a, b, m));
    assert.equal(smoothstep(-6, 8, x), oldSmooth(-6, 8, x));
    const t = Math.max(0, Math.min(1, x / 10)); assert.equal(smooth01(x / 10), t * t * (3 - 2 * t));
    assert.deepEqual(stepForward(a, b, m, x, .016), { x: a - Math.sin(m) * x * .016, z: b - Math.cos(m) * x * .016 });
  }
});
