import test from 'node:test';
import assert from 'node:assert/strict';
import v8 from 'node:v8';
import { runInNewContext } from 'node:vm';
import { f, choose, scope, tracing, withTrace, setLiveTrace, type Trace } from '../src/proc/trace.ts';
import { generateChunk, heightAt, chunkSeed, terrainBand } from '../src/core/world.ts';
import { rockRecipe } from '../src/core/rocks.ts';
import { shapeDeer } from '../src/core/deerHerd.ts';
import { AnimalBrain } from '../src/core/animalBehavior.ts';
import { surfaceDetail } from '../src/core/surface.ts';
import { LEVEL } from '../src/core/tuning.ts';

test('trace off: hooks are pass-through and record nothing', () => {
  assert.equal(tracing(), false);
  const o = { a: 1 }; assert.equal(f('g', 'n', 3.5), 3.5); assert.equal(f('g', 's', 'x'), 'x'); scope('k');
  assert.equal(choose('g', 'c', .5, [['a', .3], ['b', .8], ['c', 1]]), 'b'); assert.equal(o.a, 1);
  // no allocation per call: a million calls stay well under 1 MB of heap growth
  // Robust under load: a real GC before each sample (v8 flag + vm, so no change to the npm script),
  // then the MINIMUM of 5 samples. An allocating f allocates in every sample, so min still catches it, while
  // GC timing / JIT warm-up noise only inflates some samples. The counter stays a small int (no boxed doubles from the
  // harness itself, which is what pushed earlier runs over the limit). Same 1e6 calls and same 4e6 limit.
  v8.setFlagsFromString('--expose-gc'); const gc = runInNewContext('gc') as () => void;
  let s = 0; const growth: number[] = [];
  for (let r = 0; r < 5; r++) {
    gc(); const before = process.memoryUsage().heapUsed;
    for (let i = 0; i < 1e6; i++) if (f('terrain', 'base', i) > 0) s++;
    growth.push(process.memoryUsage().heapUsed - before);
  }
  growth.sort((x, y) => x - y);
  assert.ok(growth[0] < 4e6, `f allocates when off (heap growth per 1e6 calls: ${growth.join(', ')} B)`); assert.ok(s > 0);
});
test('traced generation gives bit-identical outputs and reports factors', () => {
  const plain = [generateChunk(0, 0), generateChunk(-2, 3), heightAt(12.3, -40.1), rockRecipe(99)];
  const t: Trace = { factors: [] };
  const traced = withTrace(t, () => [generateChunk(0, 0), generateChunk(-2, 3), heightAt(12.3, -40.1), rockRecipe(99)]);
  assert.deepEqual(traced, plain); assert.ok(t.factors.length > 100); assert.equal(tracing(), false);
  const k = t.factors.find(x => x.name === 'kind')!; assert.ok(k.table && typeof k.roll === 'number');
});
test('heightAt layers equal the old closed form; terrain band uses tuning thresholds', () => {
  const old = (x: number, z: number) => { const d = Math.abs(x - (45 + Math.sin(z / 44) * 17));
    return 1.8 + Math.sin(x * .043) * 1.4 + Math.cos(z * .038) * 1.3 + Math.sin(x * .13 + z * .09) * .28 - 5.8 * Math.exp(-(d * d) / 110) + surfaceDetail(x, z); };
  for (let i = 0; i < 300; i++) { const x = i * 7.31 - 900, z = i * -3.7 + 200; assert.equal(heightAt(x, z), old(x, z)); }
  assert.equal(terrainBand(LEVEL.shore - .01), 'shore'); assert.equal(terrainBand(LEVEL.upland + 1), 'upland'); assert.equal(terrainBand(-5), 'water');
  assert.equal(typeof chunkSeed(1, 2), 'number');
});
test('filter scopes a trace to one entity; overrides re-run the same generator', () => {
  const key = generateChunk(0, 0).find(e => e.kind === 'spruce')!.key;
  const t: Trace = { factors: [], filter: key, overrides: { seed: 12345 } };
  const e = withTrace(t, () => generateChunk(0, 0)).find(x => x.key === key)!;
  assert.equal(e.seed, 12345); assert.ok(t.factors.every(x => x.scope === key));
  assert.notEqual(generateChunk(0, 0).find(x => x.key === key)!.seed, 12345); // non-destructive
});
test('live trace on a behaviour layer: same decisions as untraced', () => {
  const run = (live: boolean) => {
    const herd = [0, 1, 2].map(i => ({ key: `t${i}${live}`, x: i * 4, z: i, brain: new AnimalBrain(i + 7) }));
    const t: Trace = { factors: [], filter: herd[0].key }; if (live) setLiveTrace(t);
    const out: string[] = []; for (let s = 0; s < 200; s++) for (const d of herd) out.push(shapeDeer(d, herd, .05) + d.brain.heading.toFixed(12));
    setLiveTrace(undefined); return { out, n: t.factors.length };
  };
  const a = run(false), b = run(true); assert.deepEqual(b.out, a.out); assert.ok(b.n > 0); assert.equal(a.n, 0);
});
