import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FLORA } from '../src/core/flora/plants';
import { covered, setAreaPrefetch, setCanopySource, setFootprintSource, type Footprint } from '../src/core/flora/site';
import { buildClump } from '../src/render/flora/plant';
import { plantsJob } from '../src/render/flora/flora';
import { bladesJob } from '../src/render/grass/cover';
import { finish } from '../src/core/interest';

const TILE = 20;
test('carpets: dense mats in shade, few in the open (light = 1 - crown score)', () => {
  setAreaPrefetch(); setFootprintSource(() => []);
  const count = (cover: number) => { setCanopySource(() => cover); let n = 0; for (let a = 0; a < 6; a++) n += finish(plantsJob(4 + a, 6)).filter(p => p.clump && FLORA[p.species].id !== 'blueberry').length; return n; };
  const shade = count(.7), open = count(0);
  assert.ok(shade > 200, `shade clumps ${shade}`); assert.ok(shade > 4 * open, `shade ${shade} vs open ${open}`);
});

test('no plant, carpet clump or grass blade grows through a rock or a log', () => {
  setAreaPrefetch(); setCanopySource(() => .6);
  const feet: Footprint[] = [{ x: 90, z: 130, r: 0, hx: 2.25, hz: .45 }, { x: 96, z: 126, r: .5, hx: 0, hz: 0 }, { x: 101, z: 124, r: .25, hx: 0, hz: 0 }];
  setFootprintSource(() => feet);
  const pl = finish(plantsJob(4, 6)); assert.ok(pl.length > 50, `${pl.length} plants`);
  for (const p of pl) assert.ok(!covered(feet, p.x, p.z), `${FLORA[p.species].id} at ${p.x.toFixed(2)},${p.z.toFixed(2)}`);
  let blades = 0; for (const [tx, tz] of [[8, 12], [9, 12], [10, 12], [9, 13]]) { const b = finish(bladesJob(tx, tz)); blades += b.count;
    for (let i = 0; i < b.count; i++) { assert.ok(!covered(feet, b.pos[i * 3], b.pos[i * 3 + 2]), 'blade inside a footprint');
      assert.deepEqual([...b.data.subarray(i * 8, i * 8 + 8)], [...b.pos.subarray(i * 3, i * 3 + 3), ...b.blade.subarray(i * 4, i * 4 + 4), b.kind[i]]); } }
  assert.ok(blades > 1000, `${blades} blades`);
  // masking keeps the rng stream: blades outside the footprints are identical with and without them
  setFootprintSource(() => []); const free = finish(bladesJob(9, 12)); setFootprintSource(() => feet); const masked = finish(bladesJob(9, 12));
  const key = (b: typeof free, i: number) => `${b.pos[i * 3]},${b.pos[i * 3 + 2]}`, kept = new Set(Array.from({ length: masked.count }, (_, i) => key(masked, i)));
  let outside = 0; for (let i = 0; i < free.count; i++) if (!covered(feet, free.pos[i * 3], free.pos[i * 3 + 2], .02)) { outside++; assert.ok(kept.has(key(free, i))); }
  assert.equal(outside, masked.count);
  setFootprintSource(); setCanopySource();
});

test('carpet clumps: far LOD is much cheaper than near', () => {
  for (const s of FLORA) if (s.carpet) { const n = buildClump(s, 0, 0).index!.count, f = buildClump(s, 0, 1).index!.count; assert.ok(f * 3 < n, `${s.id} ${f} vs ${n}`); }
  void TILE;
});
