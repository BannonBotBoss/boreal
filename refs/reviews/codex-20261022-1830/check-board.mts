// Documentary evidence replay, no ledger or production changes.
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import assert from 'node:assert/strict';
import { ledger } from '../../../tools/tasks.ts';
const baseline = 'b832878';
const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' });
const root = resolve('work/t0042-ledger-baseline');
mkdirSync(root, { recursive: true });
cpSync('tasks', root, { recursive: true });
// Restore only paths differing from baseline in this disposable task-board copy.
for (const path of git('diff', '--name-only', baseline, '--', 'tasks').trim().split('\n').filter(Boolean)) {
  const destination = resolve(root, path.slice('tasks/'.length));
  assert.ok(destination.startsWith(root + '\\') || destination.startsWith(root + '/'));
  const exists = git('ls-tree', baseline, '--', path).trim();
  if (exists) {
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, git('show', `${baseline}:${path}`));
  } else rmSync(destination, { force: true });
}
const before = ledger(root), after = ledger();
assert.deepEqual(after.errors, before.errors, 'No new ledger rule breaks');
const task = after.tasks.find(t => t.id === 'T-0042');
assert.ok(task && ['claimed', 'completed'].includes(task.state));
assert.equal(task.claimant, 'codex');
assert.equal(task.award, 30);
const events = after.events.filter(e => e.task === 'T-0042');
const approval = events.find(e => e.type === 'approve-plan');
const claim = events.find(e => e.type === 'claim');
assert.equal(approval?.agent, 'grok');
assert.ok(Date.parse(claim!.at) > Date.parse(approval!.at));
for (const e of events.filter(e => e.agent === 'codex')) {
  const bytes = readFileSync(resolve('tasks/events', e.file));
  assert.notDeepEqual([...bytes.subarray(0, 3)], [239, 187, 191]);
  assert.ok(e.file.startsWith(e.at.slice(0, 16).replaceAll(':', '-') + '-codex-'));
}
console.log(JSON.stringify({ baseline, beforeErrors: before.errors, afterErrors: after.errors,
  noNewRuleBreaks: true, task, events: events.map(({type, agent, at, file}) => ({type, agent, at, file})) }, null, 2));
