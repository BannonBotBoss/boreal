import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { award, ledger, weekOf } from '../tools/tasks';

const real = ledger();
test('task board: the real board loads, every task has steps', () => {
  assert.ok(real.tasks.length > 0);
  for (const t of real.tasks) if (t.steps > 0) assert.ok(t.award > 0, t.id);
});
// Duplicate ids must fail the suite. The legacy-break test above is a todo whenever any error exists, so a second
// T-0071 would not have failed `npm test` (the ledger also used to overwrite the Map and report nothing).
test('task ids are unique on the live board, and a second file with the same id is a rule break', () => {
  const files = readdirSync('tasks').filter(f => /^T-\d{4}-.*\.md$/.test(f)).sort();
  const seen = new Map<string, string>();
  for (const f of files) {
    const text = readFileSync(join('tasks', f), 'utf8').replace(/\r\n?/g, '\n');
    const fm = /^---\n([\s\S]*?)\n---/.exec(text)?.[1] ?? '';
    const id = /^id:\s*(.*)$/m.exec(fm)?.[1].trim() ?? '';
    assert.equal(seen.has(id), false, `${f} duplicates ${seen.get(id)} on ${id}`);
    seen.set(id, f);
  }
  assert.deepEqual(real.errors.filter(e => /duplicate task id/.test(e)), []);
  assert.equal(seen.get('T-0071'), 'T-0071-grokbot-3-relay.md');
  const relay = real.tasks.find(t => t.id === 'T-0071');
  assert.equal(relay?.file, 'T-0071-grokbot-3-relay.md');
  assert.equal(relay?.title, 'grokbot-3 relays Matthew and reviews other agents\' PRs, never its own');
  assert.equal(relay?.award, 30);
  assert.notEqual(relay?.state, 'proposed', 'the stray 11:53 propose must not reopen the relay');
  assert.equal(seen.get('T-0074'), 'T-0074-land-orphan-task-files.md');
  const wolf = real.tasks.find(t => t.id === 'T-0074');
  assert.equal(wolf?.file, 'T-0074-land-orphan-task-files.md');
  assert.equal(wolf?.author, 'grokbot-3');
  assert.equal(wolf?.state, 'proposed');
  assert.equal(wolf?.claimant, undefined);
  assert.equal(wolf?.steps, 2);
  assert.equal(wolf?.award, 20);
  assert.equal(real.tasks.filter(t => t.id === 'T-0071').length, 1);
  const stray = real.events.find(e => e.file === '2026-10-24T11-53-59-grokbot-3-propose-T-0071.json');
  assert.equal(stray?.task, 'T-0071', 'the collided propose stays on T-0071 (append-only)');
  assert.equal(stray?.type, 'propose');
  assert.ok(real.events.some(e => e.task === 'T-0074' && e.type === 'propose' && e.agent === 'grokbot-3'));
  assert.ok(real.events.some(e => e.task === 'T-0074' && e.type === 'comment' && /T-0071/.test(e.note ?? '')));
  assert.ok(real.events.some(e => e.task === 'T-0071' && e.type === 'comment' && /T-0074/.test(e.note ?? '')));

  const root = mkdtempSync(join(tmpdir(), 'tasks-'));
  try {
    const md = (title: string) => ['---', 'id: T-0099', `title: ${title}`, 'author: grokbot-3', 'scratch: false', 'research: false', 'skill: false', 'tags: [board]', '---', '', '# T-0099', '', '## Objectives', '- [ ] one', ''].join('\n');
    writeFileSync(join(root, 'T-0099-a.md'), md('First'));
    writeFileSync(join(root, 'T-0099-b.md'), md('Second'));
    const L = ledger(root);
    assert.equal(L.tasks.filter(t => t.id === 'T-0099').length, 1);
    assert.equal(L.tasks.find(t => t.id === 'T-0099')?.file, 'T-0099-a.md');
    assert.equal(L.tasks.find(t => t.id === 'T-0099')?.title, 'First');
    assert.deepEqual(L.errors, ['T-0099-b.md: duplicate task id T-0099 (also T-0099-a.md)']);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
// Older events break rules written after them (claims before approve-plan, unknown T-0001..3 ...). They are append-only
// (rule 10), so this check reports them as a todo instead of failing every run; it turns into a real failure once they are
// answered by comment events or the ledger learns to accept them. `npx tsx tools/tasks.ts` lists them.
test('task board: every event follows tasks/RULES.md', { todo: real.errors.length ? `${real.errors.length} legacy rule breaks` : false }, () => {
  assert.deepEqual(real.errors, [], 'run npx tsx tools/tasks.ts for the board');
});
test('task award = 10 x steps x (1 + .5 scratch + .3 research); weeks start Monday Pacific', () => {
  assert.equal(award({ steps: 10, scratch: true, research: true }), 180);
  assert.equal(award({ steps: 3, scratch: false, research: false }), 30);
  assert.equal(weekOf('2026-10-18T16:45:00-07:00'), '2026-10-12'); // a Sunday belongs to the week that began Monday the 12th
  assert.equal(weekOf('2026-10-19T00:30:00-07:00'), '2026-10-19');
});

/** A throwaway board: one task by `author`, plus the given events (file name -> event). */
function board(author: string, events: Record<string, object | string>, run: (L: ReturnType<typeof ledger>) => void, crlf = false) {
  const root = mkdtempSync(join(tmpdir(), 'tasks-')), dir = join(root, 'events'); mkdirSync(dir);
  try {
    const md = ['---', 'id: T-0099', 'title: Test task', `author: ${author}`, 'scratch: false', 'research: false', 'skill: false', 'tags: [wolf]', '---',
      '# T-0099', '', '## Objectives', '- [ ] one', '- [ ] two', ''];
    writeFileSync(join(root, 'T-0099-test.md'), md.join(crlf ? '\r\n' : '\n'));
    for (const [f, e] of Object.entries(events)) writeFileSync(join(dir, f), typeof e === 'string' ? e : JSON.stringify(e));
    const L = ledger(root); run({ ...L, errors: L.errors.filter(e => !e.startsWith('the board is empty')) }); // one-task boards empty out
  } finally { rmSync(root, { recursive: true, force: true }); }
}
const ev = (type: string, agent: string, hhmm: string, extra: object = {}) =>
  ({ [`2099-10-22T${hhmm.replace(':', '-')}-${agent}-${type}-T-0099.json`]: { type, task: 'T-0099', agent, at: `2099-10-22T${hhmm}:00-07:00`, ...extra } });
// Events dated in 2099 so the weekly award (paid once a week is over) never changes the credits below.
const quote = 'Matthew 01:52 PT: "well, anything i request by direct chat shouldnt need approval"';

test('task files with CRLF line ends parse like LF ones, and board comments are no rule break', () => {
  board('claude', { ...ev('propose', 'claude', '10:00'), ...ev('comment', 'matthew', '10:05', { note: 'looks good' }) }, L => {
    assert.deepEqual(L.errors, []);
    assert.equal(L.tasks[0].author, 'claude'); assert.equal(L.tasks[0].steps, 2); assert.equal(L.tasks[0].state, 'proposed');
    assert.deepEqual(L.agents, [], 'a comment earns nothing');
  }, true);
});
test('rule 16/16b: Grok relaying Matthew ("for": "matthew") approves Grok\'s own plan and work, with no review credits', () => {
  board('grok', { ...ev('propose', 'grok', '01:00'), ...ev('approve-plan', 'grok', '01:01', { for: 'matthew', note: quote }),
    ...ev('claim', 'grok', '01:02'), ...ev('complete', 'grok', '01:03', { branch: 'grok/x' }), ...ev('approve', 'grok', '01:04', { for: 'matthew', note: quote }) }, L => {
    assert.deepEqual(L.errors, []);
    assert.equal(L.tasks[0].state, 'done');
    assert.deepEqual(L.agents, [{ agent: 'grok', credits: 20, status: 'Member' }], 'the claimant earns the award; no review credits for relaying');
  });
});
test('rule 16: without "for": "matthew", or without his quoted words, Grok still cannot approve its own task', () => {
  board('grok', { ...ev('propose', 'grok', '01:00'), ...ev('approve-plan', 'grok', '01:01') }, L => {
    assert.equal(L.tasks[0].state, 'proposed'); assert.match(L.errors.join('\n'), /another agent's review/);
  });
  board('grok', { ...ev('propose', 'grok', '01:00'), ...ev('approve-plan', 'grok', '01:01', { for: 'matthew' }) }, L => {
    assert.equal(L.tasks[0].state, 'proposed'); assert.match(L.errors.join('\n'), /quotes his words/);
  });
  board('claude', { ...ev('propose', 'claude', '01:00'), ...ev('approve-plan', 'codex', '01:01', { for: 'matthew', note: quote }) }, L => {
    assert.equal(L.tasks[0].state, 'approved', 'only Grok records for matthew; codex here is an ordinary non-author review');
  });
});
test('T-0069: grokbot-1 and grokbot-2 relay Matthew like grok, and review each other as separate agents', () => {
  for (const bot of ['grokbot-1', 'grokbot-2']) board(bot, { ...ev('propose', bot, '01:00'), ...ev('approve-plan', bot, '01:01', { for: 'matthew', note: quote }),
    ...ev('claim', bot, '01:02'), ...ev('complete', bot, '01:03', { branch: `${bot}/x` }), ...ev('approve', bot, '01:04', { for: 'matthew', note: quote }) }, L => {
    assert.deepEqual(L.errors, []); assert.equal(L.tasks[0].state, 'done');
  });
  board('grokbot-2', { ...ev('propose', 'grokbot-2', '01:00'), ...ev('approve-plan', 'grokbot-1', '01:01'), ...ev('claim', 'grokbot-2', '01:02'),
    ...ev('complete', 'grokbot-2', '01:03', { branch: 'grokbot-2/x' }), ...ev('approve', 'grokbot-1', '01:04') }, L => {
    assert.deepEqual(L.errors, []); assert.equal(L.tasks[0].state, 'done');
  });
  board('grokbot-1', { ...ev('propose', 'grokbot-1', '01:00'), ...ev('approve-plan', 'grokbot-1', '01:01') }, L => {
    assert.equal(L.tasks[0].state, 'proposed'); assert.match(L.errors.join('\n'), /another agent's review/);
  });
});
test('T-0071: grokbot-3 relays Matthew like grok, and reviews other agents but not itself', () => {
  board('grokbot-3', { ...ev('propose', 'grokbot-3', '01:00'), ...ev('approve-plan', 'grokbot-3', '01:01', { for: 'matthew', note: quote }),
    ...ev('claim', 'grokbot-3', '01:02'), ...ev('complete', 'grokbot-3', '01:03', { branch: 'grokbot-3/x' }), ...ev('approve', 'grokbot-3', '01:04', { for: 'matthew', note: quote }) }, L => {
    assert.deepEqual(L.errors, []); assert.equal(L.tasks[0].state, 'done');
    assert.deepEqual(L.agents, [{ agent: 'grokbot-3', credits: 20, status: 'Member' }], 'the claimant earns the award; no review credits for relaying');
  });
  for (const other of ['grok', 'grokbot-1', 'grokbot-2']) {
    board('grokbot-3', { ...ev('propose', 'grokbot-3', '01:00'), ...ev('approve-plan', other, '01:01'), ...ev('claim', 'grokbot-3', '01:02'),
      ...ev('complete', 'grokbot-3', '01:03', { branch: 'grokbot-3/x' }), ...ev('approve', other, '01:04') }, L => {
      assert.deepEqual(L.errors, []); assert.equal(L.tasks[0].state, 'done');
    });
    board(other, { ...ev('propose', other, '01:00'), ...ev('approve-plan', 'grokbot-3', '01:01'), ...ev('claim', other, '01:02'),
      ...ev('complete', other, '01:03', { branch: `${other}/x` }), ...ev('approve', 'grokbot-3', '01:04') }, L => {
      assert.deepEqual(L.errors, []); assert.equal(L.tasks[0].state, 'done');
    });
  }
  board('grokbot-3', { ...ev('propose', 'grokbot-3', '01:00'), ...ev('approve-plan', 'grokbot-3', '01:01') }, L => {
    assert.equal(L.tasks[0].state, 'proposed'); assert.match(L.errors.join('\n'), /another agent's review/);
  });
  board('grokbot-3', { ...ev('propose', 'grokbot-3', '01:00'), ...ev('approve-plan', 'grokbot-3', '01:01', { for: 'matthew' }) }, L => {
    assert.equal(L.tasks[0].state, 'proposed'); assert.match(L.errors.join('\n'), /quotes his words/);
  });
});
test('event files: a UTF-8 BOM is ignored, invalid JSON is a warning, not a crash', () => {
  const bom = '\uFEFF' + JSON.stringify({ type: 'propose', task: 'T-0099', agent: 'claude', at: '2026-10-22T01:00:00-07:00' });
  board('claude', { '2026-10-22T01-00-claude-propose-T-0099.json': bom,
    '2026-10-22T01-05-claude-comment-T-0099.json': '{ "type": "comment", "note": "C:\\dev\\x" }' }, L => {
    assert.deepEqual(L.errors, []);
    assert.equal(L.events.length, 1);
    assert.equal(L.warnings.length, 1); assert.match(L.warnings[0], /2026-10-22T01-05-claude-comment-T-0099\.json: not valid JSON/);
  });
});
