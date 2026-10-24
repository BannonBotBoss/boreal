/**
 * T-0069: tools/agent-review.mjs names the author from the PR branch prefix and refuses self-review. grokbot-1 and grokbot-2
 * (own GitHub accounts, Matthew 2026-10-23) are separate agents, so each may review the other. A fake `gh` on PATH answers
 * `pr view` with the branch and records the status/comment calls instead of reaching GitHub.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, delimiter } from 'node:path';

function review(branch: string, reviewer: string) {
  const dir = mkdtempSync(join(tmpdir(), 'agent-review-')), log = join(dir, 'calls.log');
  try {
    const gh = join(dir, 'gh');
    writeFileSync(gh, `#!/usr/bin/env node
const fs = require('node:fs'); const a = process.argv.slice(2); fs.appendFileSync(${JSON.stringify(log)}, a.join(' ') + '\\n');
if (a[0] === 'pr' && a[1] === 'view') process.stdout.write(JSON.stringify({ headRefName: ${JSON.stringify(branch)}, headRefOid: 'abc1234def' }));
`);
    chmodSync(gh, 0o755);
    const r = spawnSync(process.execPath, ['tools/agent-review.mjs', '7', reviewer, 'approve', 'checked'], {
      encoding: 'utf8', env: { ...process.env, PATH: dir + delimiter + process.env.PATH, BOREAL_REPO: 'test/boreal' } });
    return { status: r.status, err: r.stderr, calls: existsSync(log) ? readFileSync(log, 'utf8') : '' };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

// The fake gh is a node script with a shebang, which Windows cannot exec directly; CI and the box run Linux.
const skip = process.platform === 'win32' ? 'fake gh needs a POSIX shebang' : false;
test('agent-review: grokbot-1 and grokbot-2 approve each other\'s PRs', { skip }, () => {
  for (const [branch, reviewer] of [['grokbot-2/reviewers', 'grokbot-1'], ['grokbot-1/topic', 'grokbot-2']]) {
    const r = review(branch, reviewer);
    assert.equal(r.status, 0, r.err);
    assert.match(r.calls, /repos\/test\/boreal\/statuses\/abc1234def .*state=success/);
    assert.match(r.calls, new RegExp(`agent-review\\*\\* by ${reviewer}: approve`));
  }
});
test('agent-review: self-review is still refused, and grok/ is not mistaken for grokbot-1/', { skip }, () => {
  for (const bot of ['grokbot-1', 'grokbot-2']) {
    const r = review(`${bot}/topic`, bot);
    assert.equal(r.status, 1); assert.match(r.err, new RegExp(`${bot} wrote ${bot}/topic`)); assert.doesNotMatch(r.calls, /statuses/);
  }
  assert.equal(review('grok/topic', 'grokbot-1').status, 0, 'grok and grokbot-1 are different prefixes');
  assert.equal(review('grokbot-1/topic', 'grok').status, 0);
  assert.equal(review('grokbot-2/topic', 'nobody').status, 2, 'unknown reviewers are still refused');
});
