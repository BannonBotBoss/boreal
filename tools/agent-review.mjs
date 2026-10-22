#!/usr/bin/env node
/**
 * agent-review: the reviewing agent's verdict on a pull request, as a commit status named "agent-review" on the PR head.
 * All agents push with Matthew's one GitHub login, so GitHub cannot tell authors apart; the author is the agent prefix of the
 * PR branch (grok/, grok-globe/, grok-gait/, claude/, codex/, agy/). A review by the author is refused.
 * Matthew's own approval: reviewer "matthew" (Rule 16; quote his words in the note).
 *
 *   node tools/agent-review.mjs <pr-number> <reviewer-agent> <approve|reject> "<note>"
 *
 * Needs only the repo scope (gh api). On the free plan for private repos GitHub does not enforce required checks, so this
 * status is advisory: whoever merges checks that agent-review is green and ci passed (RULES.md, "GitHub").
 */
import { execFileSync } from 'node:child_process';
const REPO = process.env.BOREAL_REPO ?? 'Bannon-github/boreal';
const AGENTS = ['grok-globe', 'grok-gait', 'grok', 'claude', 'codex', 'agy', 'matthew'];
const [pr, reviewer, verdict, ...rest] = process.argv.slice(2), note = rest.join(' ');
if (!pr || !reviewer || !['approve', 'reject'].includes(verdict)) {
  console.error('usage: node tools/agent-review.mjs <pr> <reviewer> <approve|reject> "<note>"'); process.exit(2);
}
if (!AGENTS.includes(reviewer)) { console.error(`unknown reviewer ${reviewer}; one of ${AGENTS.join(', ')}`); process.exit(2); }
const gh = (...a) => execFileSync('gh', a, { encoding: 'utf8' }).trim();
const { headRefName, headRefOid } = JSON.parse(gh('pr', 'view', pr, '-R', REPO, '--json', 'headRefName,headRefOid'));
const author = AGENTS.find(a => headRefName.startsWith(a + '/'));
if (!author) { console.error(`branch ${headRefName} has no agent prefix, so the author is unknown`); process.exit(1); }
if (author === reviewer) { console.error(`${reviewer} wrote ${headRefName}; another agent (or Matthew) must review it`); process.exit(1); }
const state = verdict === 'approve' ? 'success' : 'failure';
const description = `${reviewer}: ${verdict}${note ? ' - ' + note : ''}`.slice(0, 140);
gh('api', `repos/${REPO}/statuses/${headRefOid}`, '-f', `state=${state}`, '-f', 'context=agent-review', '-f', `description=${description}`);
gh('pr', 'comment', pr, '-R', REPO, '--body', `**agent-review** by ${reviewer}: ${verdict}\n\n${note}`);
console.log(`agent-review ${state} on ${headRefName}@${headRefOid.slice(0, 7)} by ${reviewer}`);
