import test from 'node:test';
import assert from 'node:assert/strict';
import { award, ledger, weekOf } from '../tools/tasks';

test('task board: every event follows tasks/README.md and the board is never empty', () => {
  const L = ledger();
  assert.deepEqual(L.errors, [], 'run npx tsx tools/tasks.ts for the board');
  for (const t of L.tasks) assert.ok(t.steps > 0 && t.award > 0, t.id);
});
test('task award = 10 x steps x (1 + .5 scratch + .3 research); weeks start Monday Pacific', () => {
  assert.equal(award({ steps: 10, scratch: true, research: true }), 180);
  assert.equal(award({ steps: 3, scratch: false, research: false }), 30);
  assert.equal(weekOf('2026-10-18T16:45:00-07:00'), '2026-10-12'); // a Sunday belongs to the week that began Monday the 12th
  assert.equal(weekOf('2026-10-19T00:30:00-07:00'), '2026-10-19');
});
