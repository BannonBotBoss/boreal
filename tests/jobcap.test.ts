import test from 'node:test';
import assert from 'node:assert/strict';
import { enqueue, runJobs, perFrame, queued } from '../src/core/interest';

test('perFrame caps a job kind per frame (WAIT) under a raised budget, shared across jobs of that kind, and still finishes', () => {
  let t = 0; const now = () => t, steps: string[] = [];
  const job = (id: string, n: number) => (function* () { for (let i = 0; i < n; i++) { t += 1; steps.push(id); yield; } return id; })();
  const done: string[] = [];
  enqueue('capk:a', 0, perFrame('capk', 2, job('a', 3), now), v => done.push(v));
  enqueue('capk:b', 1, perFrame('capk', 2, job('b', 3), now), v => done.push(v));
  runJobs(100, now); assert.deepEqual(steps, ['a', 'a']); // 2 ms of 'capk' this frame, then both jobs WAIT under a 100 ms budget
  runJobs(100, now); assert.deepEqual(steps, ['a', 'a', 'a', 'b']);
  for (let k = 0; k < 4; k++) runJobs(100, now);
  assert.deepEqual(done, ['a', 'b']); assert.equal(queued(), 0);
});

test('perFrame does nothing at the normal budget', () => {
  let t = 0; const now = () => t, steps: number[] = [];
  enqueue('capn:a', 0, perFrame('capn', 1, (function* () { for (let i = 0; i < 6; i++) { t += 1; steps.push(i); yield; } })(), now), () => {});
  runJobs(4, now); assert.equal(steps.length, 4); // INTEREST.budgetMs: the scheduler's own budget limits it, not the cap
  runJobs(4, now); runJobs(4, now); assert.equal(queued(), 0);
});
