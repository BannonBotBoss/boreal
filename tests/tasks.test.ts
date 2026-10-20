import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
test('task files with CRLF line ends parse like LF ones, and board comments are no rule break', () => {
  const root = mkdtempSync(join(tmpdir(), 'tasks-')), events = join(root, 'events'); mkdirSync(events);
  try {
    const md = ['---', 'id: T-0099', 'title: Test task', 'author: claude', 'scratch: false', 'research: false', 'skill: false', 'tags: [wolf]', '---',
      '# T-0099', '', '## Objectives', '- [ ] one', '- [ ] two', ''];
    writeFileSync(join(root, 'T-0099-test.md'), md.join('\r\n')); // a Windows checkout (core.autocrlf)
    writeFileSync(join(events, '2026-10-20T10-00-claude-propose-T-0099.json'), JSON.stringify({ type: 'propose', task: 'T-0099', agent: 'claude', at: '2026-10-20T10:00:00-07:00' }));
    // tools/board-server.ts writes these (POST /api/comment)
    writeFileSync(join(events, '2026-10-20T10-05-matthew-comment-T-0099.json'), JSON.stringify({ type: 'comment', task: 'T-0099', agent: 'matthew', at: '2026-10-20T10:05:00-07:00', note: 'looks good' }));
    const L = ledger(root);
    assert.deepEqual(L.errors, []);
    assert.equal(L.tasks[0].author, 'claude'); assert.equal(L.tasks[0].steps, 2); assert.equal(L.tasks[0].state, 'proposed');
    assert.deepEqual(L.agents, [], 'a comment earns nothing');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
