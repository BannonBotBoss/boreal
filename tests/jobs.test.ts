import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STATS, enqueue, runJobs } from '../src/core/interest';

test('job scheduler: the finishing step is its own budgeted step; a slow kind is not stacked after other work', () => {
  let t = 0; const clock = () => t, log: string[] = [];
  function* slow(id: string) { log.push(id + 1); t += 3; yield; log.push(id + 2); t += 3; return id; }
  const done = (id: string) => { log.push(id + 'done'); t += 3; };
  enqueue('slowk:a', 0, slow('a'), done); enqueue('slowk:b', 1, slow('b'), done);
  runJobs(4, clock); assert.deepEqual(log, ['a1'], 'a second 3 ms step would overrun 4 ms');
  runJobs(4, clock); assert.deepEqual(log, ['a1', 'a2', 'adone'], 'unknown finishing cost: it may share the frame (then it is measured)');
  runJobs(4, clock); runJobs(4, clock); assert.deepEqual(log.slice(3), ['b1', 'b2'], 'finishing (est 3 ms) does not follow a 3 ms slice');
  runJobs(4, clock); assert.deepEqual(log.slice(5), ['bdone'], 'finishing runs as the first step of the next frame');
  const k = STATS.kinds.slowk; assert.equal(k.slices, 4); assert.equal(k.dones, 2); assert.equal(k.maxDone, 3); assert.equal(k.over, 0);
  function* fast() { t += .5; yield; t += .5; return 0; }
  let got = 0; for (let i = 0; i < 3; i++) enqueue(`fastk:${i}`, i, fast(), () => { got++; });
  runJobs(4, clock); assert.equal(got, 3, 'cheap steps still share one frame');
});
