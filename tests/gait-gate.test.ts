/**
 * Rule 19 (tasks/RULES.md, T-0124): gait and locomotion tasks are gated in CI on real footage, a side-by-side clip in the repo,
 * a source for every number, and an escalation to Matthew after two runs with no visible fix. These tests are NOT todo: unlike
 * the legacy board test in tasks.test.ts, any rule 19 break fails `npm test`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GAIT_RULE_FROM, ledger } from '../tools/tasks';

const rule19 = (L: ReturnType<typeof ledger>) => L.errors.filter(e => /rule 19:/.test(e));

test('rule 19: the live board has no gait-evidence breaks (events before GAIT_RULE_FROM are grandfathered)', () => {
  assert.deepEqual(rule19(ledger()), [], 'run npx tsx tools/tasks.ts and see tasks/RULES.md rule 19');
});

test('rule 19: the good fixture (footage, side-by-side clip in the repo, sources, escalation after two blank runs) passes', () => {
  const L = ledger('tests/fixtures/gait-gate/good/tasks');
  assert.deepEqual(L.errors, []);
  assert.equal(L.tasks.find(t => t.id === 'T-0999')?.state, 'completed');
});

test('rule 19: the bad fixture fails on every missing piece', () => {
  const errs = rule19(ledger('tests/fixtures/gait-gate/bad/tasks')).join('\n');
  assert.match(errs, /footage url must be http\(s\), got "wolf\.mp4"/);
  assert.match(errs, /footage needs "notes"/);
  assert.match(errs, /side_by_side clip tasks\/evidence\/T-0999\/side-by-side\.webm is not in the repo/);
  assert.match(errs, /side_by_side needs a "verdict"/);
  assert.match(errs, /needs "sources"/);
  assert.match(errs, /T-0999 had 2 runs with no visible fix; stop and escalate/);
  assert.match(errs, /T-0999: rule 19: 3 runs in a row with no visible fix and no escalation/);
});

/** A one-task temp board: tags and events. */
function board(tags: string, events: object[]) {
  const root = mkdtempSync(join(tmpdir(), 'gait-')), dir = join(root, 'tasks', 'events'); mkdirSync(dir, { recursive: true });
  try {
    writeFileSync(join(root, 'tasks', 'T-0999-x.md'), ['---', 'id: T-0999', 'title: x', 'author: grok-gait', 'scratch: false', 'research: false',
      'skill: false', `tags: ${tags}`, '---', '', '## Objectives', '- [ ] one', ''].join('\n'));
    events.forEach((e, i) => writeFileSync(join(dir, `e${i}.json`), JSON.stringify({ task: 'T-0999', ...e })));
    return rule19(ledger(join(root, 'tasks')));
  } finally { rmSync(root, { recursive: true, force: true }); }
}
const flow = (day: string, complete: object = {}) => [
  { type: 'propose', agent: 'grok-gait', at: `${day}T10:00:00-07:00` }, { type: 'approve-plan', agent: 'grokbot-1', at: `${day}T10:01:00-07:00` },
  { type: 'claim', agent: 'grok-gait', at: `${day}T10:02:00-07:00` }, { type: 'complete', agent: 'grok-gait', at: `${day}T10:03:00-07:00`, branch: 'grok-gait/x', ...complete }];

test('rule 19: a bare metric complete fails on a gait task, passes when grandfathered or when the task is not gait', () => {
  assert.ok(Date.parse('2026-10-29T10:03:00-07:00') < Date.parse(GAIT_RULE_FROM));
  assert.equal(board('[hare, locomotion]', flow('2026-12-01')).length, 3, 'footage, side_by_side and sources are all missing');
  assert.equal(board('[wolf, gait]', flow('2026-12-01')).length, 3, 'the gait tag counts like locomotion');
  assert.deepEqual(board('[hare, locomotion]', flow('2026-10-29')), [], 'completed before the rule: grandfathered');
  assert.deepEqual(board('[ui, menu]', flow('2026-12-01')), [], 'not a gait task');
});

test('rule 19: a run must say whether it fixed something visibly', () => {
  const runs = [...flow('2026-12-01').slice(0, 3), { type: 'comment', agent: 'grok-gait', at: '2026-12-01T11:00:00-07:00', run: 1, note: 'counts only' }];
  assert.match(board('[gait]', runs).join('\n'), /names "visible_fix"/);
});
