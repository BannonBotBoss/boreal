import test from 'node:test';
import assert from 'node:assert/strict';
import { enqueue, runJobs, perFrame, queued, JOB_FIRST } from '../src/core/interest';

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

test('JOB_FIRST runs matching jobs before lower-priority-number others, and plain order without it', () => {
  const order: string[] = [], one = (id: string) => (function* () { order.push(id); yield; return id; })();
  enqueue('grass:x', 1, one('grass'), () => {}); enqueue('chunk:x', 50, one('chunk'), () => {});
  JOB_FIRST.test = k => k.startsWith('chunk:'); runJobs(100); JOB_FIRST.test = null;
  assert.deepEqual(order.slice(0, 2), ['chunk', 'grass']); runJobs(100); assert.equal(queued(), 0);
  enqueue('grass:y', 1, one('grass2'), () => {}); enqueue('chunk:y', 50, one('chunk2'), () => {}); runJobs(100);
  assert.deepEqual(order.slice(2, 4), ['grass2', 'chunk2']); runJobs(100); assert.equal(queued(), 0);
});
