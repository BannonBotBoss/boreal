import test from 'node:test';
import assert from 'node:assert/strict';
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
  // no allocation per call: a million calls stay well under 4 MB of heap growth. The best of three runs is taken (grok, run 4):
  // without --expose-gc, lazy compilation and other work in the process can grow the heap during one run under a loaded
  // full suite (the known flake); an allocating f would grow it by >= 16 MB (1e6 x a 16-byte object) on every run.
  let grow = Infinity, s = 0;
  for (let run = 0; run < 3 && grow >= 4e6; run++) { global.gc?.(); const before = process.memoryUsage().heapUsed;
    for (let i = 0; i < 1e6; i++) s += f('terrain', 'base', i);
    grow = Math.min(grow, process.memoryUsage().heapUsed - before); }
  assert.ok(grow < 4e6, `f allocates when off (best of 3: ${grow} B)`); assert.ok(s > 0);
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
