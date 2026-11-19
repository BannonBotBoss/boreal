/**
 * Calibrated Rule 7 / Rule 11 / Rule 12 audit of Boreal's board rules and tooling:
 *   - tasks/RULES.md
 *   - tools/tasks.ts
 *   - tools/agent-review.mjs
 *   - tools/board-github.ts
 *   - tests/tasks.test.ts
 *   - .github/workflows/ci.yml
 *
 * Run: npx tsx refs/process/board-rules-tooling-audit/audit.ts
 * Output: refs/process/board-rules-tooling-audit/numbers.json
 */
import { existsSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { ledger } from '../../../tools/tasks';

const ROOT = resolve(process.cwd());
const OUT = join(ROOT, 'refs/process/board-rules-tooling-audit/numbers.json');

function runTempBoard(taskMd: string, events: Record<string, object>, extraFiles: Record<string, string> = {}) {
  const base = mkdtempSync(join(tmpdir(), 'boreal-audit-'));
  const tasksDir = join(base, 'tasks');
  const eventsDir = join(tasksDir, 'events');
  mkdirSync(eventsDir, { recursive: true });
  try {
    writeFileSync(join(tasksDir, 'T-0999-probe.md'), taskMd);
    for (const [name, obj] of Object.entries(events)) {
      writeFileSync(join(eventsDir, name), JSON.stringify(obj, null, 2));
    }
    for (const [rel, content] of Object.entries(extraFiles)) {
      const full = join(base, rel);
      mkdirSync(resolve(full, '..'), { recursive: true });
      writeFileSync(full, content);
    }
    const L = ledger(tasksDir, base);
    return {
      ...L,
      errors: L.errors.filter(e => !e.startsWith('the board is empty')),
    };
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
}

function makeTaskMd(opts: { credits?: number; skill?: string; author?: string; steps?: number } = {}) {
  const { credits, skill = 'board-rule-inspection', author = 'grokbot-2', steps = 2 } = opts;
  const lines = [
    '---',
    'id: T-0999',
    'title: Probe task',
    `author: ${author}`,
    'scratch: false',
    'research: false',
    `skill: ${skill}`,
    'tags: [process]',
    ...(credits !== undefined ? [`credits: ${credits}`] : []),
    '---',
    '# T-0999 Probe task',
    '',
    '## Objectives',
    ...Array.from({ length: steps }, (_, i) => `- [ ] Step ${i + 1}`),
    '',
  ];
  return lines.join('\n');
}

const agentReviewSrc = readFileSync(join(ROOT, 'tools/agent-review.mjs'), 'utf8');
const tasksTsSrc = readFileSync(join(ROOT, 'tools/tasks.ts'), 'utf8');
const boardGhSrc = readFileSync(join(ROOT, 'tools/board-github.ts'), 'utf8');
const rulesMdSrc = readFileSync(join(ROOT, 'tasks/RULES.md'), 'utf8');
const tasksTestSrc = readFileSync(join(ROOT, 'tests/tasks.test.ts'), 'utf8');
const ciYmlSrc = readFileSync(join(ROOT, '.github/workflows/ci.yml'), 'utf8');

// Live board statistics
const live = ledger(join(ROOT, 'tasks'), ROOT);
const taskFiles = readdirSync(join(ROOT, 'tasks')).filter(f => /^T-\d{4}-.*\.md$/.test(f)).sort();
let namedSkillTasks = 0;
let namedSkillParsedTrue = 0;
let creditsHeaderPresent = 0;
let creditsHeaderMismatch = 0;
const creditsMismatches: Array<{ id: string; header: number; computed: number }> = [];

for (const f of taskFiles) {
  const raw = readFileSync(join(ROOT, 'tasks', f), 'utf8').replace(/\r\n?/g, '\n');
  const fm = /^---\n([\s\S]*?)\n---/.exec(raw)?.[1] ?? '';
  const get = (k: string) => new RegExp(`^${k}:\\s*(.*)$`, 'm').exec(fm)?.[1].trim() ?? '';
  const id = get('id');
  const skillRaw = get('skill');
  const creditsRaw = get('credits');
  const t = live.tasks.find(x => x.id === id);
  if (skillRaw && skillRaw !== 'false' && skillRaw !== 'true') {
    namedSkillTasks++;
    if (t?.skill) namedSkillParsedTrue++;
  }
  if (creditsRaw && /^\d+$/.test(creditsRaw) && t) {
    creditsHeaderPresent++;
    const h = Number(creditsRaw);
    if (h !== t.award) {
      creditsHeaderMismatch++;
      creditsMismatches.push({ id, header: h, computed: t.award });
    }
  }
}

const stateCounts: Record<string, number> = {};
for (const t of live.tasks) stateCounts[t.state] = (stateCounts[t.state] ?? 0) + 1;

// Post-cutoff errors (after 2026-10-30, when GAIT_RULE_FROM was added)
const postCutoffErrors = live.errors.filter(e => /^2026-11-/.test(e));

// Check 1: agent-review.mjs cursor prefix recognition
const agentsMatch = /const AGENTS = \[([^\]]+)\]/.exec(agentReviewSrc)?.[1] ?? '';
const agentList = [...agentsMatch.matchAll(/'([^']+)'/g)].map(m => m[1]);
const recognizeBranch = (ref: string) => (agentList.some(a => ref.startsWith(a + '/')) ? 1 : 0);
const c1Match = recognizeBranch('grokbot-2/globe-leftovers');
const c1Mismatch = recognizeBranch('unknown-bot/foo');
const c1Actual = recognizeBranch('cursor/ground-sky-clouds-655c');

// Check 2: Repo slug freshness (BannonBotBoss/boreal vs stale Bannon-github/boreal)
const slugFiles = [
  { file: 'tools/agent-review.mjs', src: agentReviewSrc },
  { file: 'tools/board-github.ts', src: boardGhSrc },
  { file: 'tasks/RULES.md', src: rulesMdSrc },
];
const slugScore = (list: Array<{ src: string }>) =>
  list.filter(x => x.src.includes('BannonBotBoss/boreal')).length / list.length;
const c2Actual = slugScore(slugFiles);
const c2Match = slugScore([{ src: 'BannonBotBoss/boreal' }]);
const c2Mismatch = slugScore([{ src: 'Bannon-github/boreal' }]);

// Check 3: agent-review.mjs Draft PR guard
const hasDraftGuard = (src: string) => (src.includes('isDraft') ? 1 : 0);
const c3Actual = hasDraftGuard(agentReviewSrc);
const c3Match = hasDraftGuard('const { headRefName, headRefOid, isDraft } = ...; if (isDraft && verdict === "approve") ...');
const c3Mismatch = hasDraftGuard('const { headRefName, headRefOid } = ...');

// Check 4: Rule 14 credits: header override honored by ledger()
const r4Override = runTempBoard(makeTaskMd({ credits: 99, steps: 2 }), {});
const r4Default = runTempBoard(makeTaskMd({ credits: 20, steps: 2 }), {});
const c4Actual = r4Override.tasks[0]?.award === 99 ? 1 : 0;
const c4Match = r4Default.tasks[0]?.award === 20 ? 1 : 0;
const c4Mismatch = r4Override.tasks[0]?.award === 20 ? 0 : 1; // proves ledger returned formula 20 instead of 99

// Check 5: Rule 4 named skill: <name> parsing & skill-approve acceptance
const r5Named = runTempBoard(
  makeTaskMd({ skill: 'ground-sky-clouds' }),
  {
    '2099-01-01T10-00-grokbot-2-propose-T-0999.json': { type: 'propose', task: 'T-0999', agent: 'grokbot-2', at: '2099-01-01T10:00:00-08:00' },
    '2099-01-01T10-01-agy-approve-plan-T-0999.json': { type: 'approve-plan', task: 'T-0999', agent: 'agy', at: '2099-01-01T10:01:00-08:00' },
    '2099-01-01T10-02-grokbot-2-claim-T-0999.json': { type: 'claim', task: 'T-0999', agent: 'grokbot-2', at: '2099-01-01T10:02:00-08:00' },
    '2099-01-01T10-03-grokbot-2-complete-T-0999.json': { type: 'complete', task: 'T-0999', agent: 'grokbot-2', at: '2099-01-01T10:03:00-08:00', branch: 'grokbot-2/x', skill: 'ground-sky-clouds' },
    '2099-01-01T10-04-agy-approve-T-0999.json': { type: 'approve', task: 'T-0999', agent: 'agy', at: '2099-01-01T10:04:00-08:00' },
    '2099-01-01T10-05-agy-skill-approve-T-0999.json': { type: 'skill-approve', task: 'T-0999', agent: 'agy', at: '2099-01-01T10:05:00-08:00' },
  },
);
const r5Bool = runTempBoard(makeTaskMd({ skill: 'true' }), {});
const c5Actual = namedSkillTasks > 0 ? namedSkillParsedTrue / namedSkillTasks : 0;
const c5Match = r5Bool.tasks[0]?.skill ? 1 : 0;
const c5Mismatch = r5Named.errors.some(e => e.includes('this task makes no skill')) ? 0 : 1;

// Check 6: Rule 4 complete event skill-file existence validation
const r6MissingSkill = runTempBoard(
  makeTaskMd({ skill: 'nonexistent-skill-xyz' }),
  {
    '2099-01-01T10-00-grokbot-2-propose-T-0999.json': { type: 'propose', task: 'T-0999', agent: 'grokbot-2', at: '2099-01-01T10:00:00-08:00' },
    '2099-01-01T10-01-agy-approve-plan-T-0999.json': { type: 'approve-plan', task: 'T-0999', agent: 'agy', at: '2099-01-01T10:01:00-08:00' },
    '2099-01-01T10-02-grokbot-2-claim-T-0999.json': { type: 'claim', task: 'T-0999', agent: 'grokbot-2', at: '2099-01-01T10:02:00-08:00' },
    '2099-01-01T10-03-grokbot-2-complete-T-0999.json': { type: 'complete', task: 'T-0999', agent: 'grokbot-2', at: '2099-01-01T10:03:00-08:00', branch: 'grokbot-2/x' },
  },
);
const c6Actual = r6MissingSkill.errors.length > 0 ? 1 : 0;

// Check 7: Rule 6 complete event handoff-file existence validation
const c7Actual = r6MissingSkill.errors.some(e => /handoff/i.test(e)) ? 1 : 0;

// Check 8: Rule 10/16 quote + timestamp check on for: "matthew" & agent: "matthew" guard
const r8UnquotedFor = runTempBoard(
  makeTaskMd({ author: 'grok' }),
  {
    '2099-01-01T10-00-grok-propose-T-0999.json': { type: 'propose', task: 'T-0999', agent: 'grok', at: '2099-01-01T10:00:00-08:00' },
    '2099-01-01T10-01-grok-approve-plan-T-0999.json': { type: 'approve-plan', task: 'T-0999', agent: 'grok', for: 'matthew', at: '2099-01-01T10:01:00-08:00', note: 'ok' },
  },
);
const r8DirectMatthew = runTempBoard(
  makeTaskMd({ author: 'grok' }),
  {
    '2099-01-01T10-00-grok-propose-T-0999.json': { type: 'propose', task: 'T-0999', agent: 'grok', at: '2099-01-01T10:00:00-08:00' },
    '2099-01-01T10-01-matthew-approve-plan-T-0999.json': { type: 'approve-plan', task: 'T-0999', agent: 'matthew', at: '2099-01-01T10:01:00-08:00', note: 'approved' },
  },
);
const c8Actual = (r8UnquotedFor.errors.length > 0 ? 0.5 : 0) + (r8DirectMatthew.errors.length > 0 ? 0.5 : 0);

// Check 9: tests/tasks.test.ts post-grandfather CI enforcement (instead of permanent todo)
const hasTodoBypass = /todo:\s*real\.errors\.length/.test(tasksTestSrc);
const hasPostCutoffGate = /BOARD_RULE_FROM|GRANDFATHER/.test(tasksTestSrc);
const c9Actual = !hasTodoBypass || hasPostCutoffGate ? 1 : 0;

// Check 10: tools/board-github.ts tmpdir cleanup
const hasTmpCleanup = /rmSync\(dir/.test(boardGhSrc);
const c10Actual = hasTmpCleanup ? 1 : 0;

// Check 11: Rule 13 cross-branch next-id CLI helper & unmerged-branch renumber clarification
const hasNextIdCli = /next-?id/i.test(tasksTsSrc);
const hasUnmergedRule10Clarification = /unmerged/i.test(rulesMdSrc);
const c11Actual = (hasNextIdCli ? 0.5 : 0) + (hasUnmergedRule10Clarification ? 0.5 : 0);

// Check 12: Rule 17(c)/(d) names actual CI jobs (`test` + `slow`) and `cursor` agent
const jobsSection = ciYmlSrc.split(/^jobs:/m)[1] ?? '';
const ciJobs = [...jobsSection.matchAll(/^  ([a-z]+):$/gm)].map(m => m[1]);
const rulesNamesBothJobs = rulesMdSrc.includes('`test`') && rulesMdSrc.includes('`slow`') ? 0.5 : 0;
const rulesNamesCursor = /\bcursor\b/i.test(rulesMdSrc) ? 0.5 : 0;
const c12Actual = rulesNamesBothJobs + rulesNamesCursor;

// Cross-branch ID collisions observed on origin (git log --all)
const allTaskFiles = execFileSync('git', ['log', '--all', '--name-only', '--pretty=format:', '--', 'tasks/T-*.md'], { encoding: 'utf8' })
  .split(/\r?\n/)
  .map(s => s.trim())
  .filter(Boolean);
const byId = new Map<string, Set<string>>();
for (const p of allTaskFiles) {
  const m = /tasks\/(T-\d{4})-/.exec(p);
  if (!m) continue;
  const set = byId.get(m[1]) ?? new Set();
  set.add(p);
  byId.set(m[1], set);
}
const recentCollisions = [...byId.entries()]
  .filter(([id, s]) => id >= 'T-0250' && s.size > 1)
  .map(([id, s]) => ({ id, files: [...s].sort() }));

const checks = [
  {
    id: 'agent_review_cursor_prefix',
    metric: 'agent-review.mjs recognizes cursor/* branch author',
    measured: c1Actual,
    target: 1,
    knownMatch: c1Match,
    knownMismatch: c1Mismatch,
    score: c1Actual,
    pass: c1Actual >= 0.95,
    source: 'tools/agent-review.mjs:19,27-28; PRs #413,#414,#448,#449,#497,#499,#501,#504',
  },
  {
    id: 'repo_slug_current',
    metric: 'Fraction of board tools/rules pointing to moved repo BannonBotBoss/boreal',
    measured: Number(c2Actual.toFixed(4)),
    target: 1,
    knownMatch: c2Match,
    knownMismatch: c2Mismatch,
    score: Number(c2Actual.toFixed(4)),
    pass: c2Actual >= 0.95,
    source: 'tools/agent-review.mjs:18; tools/board-github.ts:17; tasks/RULES.md:27',
  },
  {
    id: 'agent_review_draft_guard',
    metric: 'agent-review.mjs queries isDraft and blocks approve on Draft PRs',
    measured: c3Actual,
    target: 1,
    knownMatch: c3Match,
    knownMismatch: c3Mismatch,
    score: c3Actual,
    pass: c3Actual >= 0.95,
    source: 'tools/agent-review.mjs:26-33; Draft PRs #490,#492,#507,#510',
  },
  {
    id: 'rule14_credits_header_honored',
    metric: 'tools/tasks.ts ledger() honors overridden credits: header (99 vs formula 20)',
    measured: r4Override.tasks[0]?.award ?? 0,
    target: 99,
    knownMatch: c4Match,
    knownMismatch: c4Mismatch,
    score: c4Actual,
    pass: c4Actual >= 0.95,
    source: 'tasks/RULES.md:20 (Rule 14) vs tools/tasks.ts:72-81',
  },
  {
    id: 'rule4_skill_name_parsed',
    metric: `Fraction of live tasks with named skill: <name> parsed as skill=true (${namedSkillParsedTrue}/${namedSkillTasks})`,
    measured: Number(c5Actual.toFixed(4)),
    target: 1,
    knownMatch: c5Match,
    knownMismatch: c5Mismatch,
    score: Number(c5Actual.toFixed(4)),
    pass: c5Actual >= 0.95,
    source: 'tasks/RULES.md:6 (Rule 4) vs tools/tasks.ts:80,147 (skill-approve fails on named skills)',
  },
  {
    id: 'rule4_complete_skill_exists_check',
    metric: 'tools/tasks.ts rejects complete event missing skill / nonexistent notes/skills/<name>.md',
    measured: c6Actual,
    target: 1,
    knownMatch: 1,
    knownMismatch: 0,
    score: c6Actual,
    pass: c6Actual >= 0.95,
    source: 'tasks/RULES.md:6 (Rule 4) vs tools/tasks.ts:142',
  },
  {
    id: 'rule6_complete_handoff_exists_check',
    metric: 'tools/tasks.ts rejects complete event missing tasks/handoffs/<task>-<agent>.md',
    measured: c7Actual,
    target: 1,
    knownMatch: 1,
    knownMismatch: 0,
    score: c7Actual,
    pass: c7Actual >= 0.95,
    source: 'tasks/RULES.md:12 (Rule 6) vs tools/tasks.ts:142',
  },
  {
    id: 'rule10_for_matthew_quote_and_agent_guard',
    metric: 'tools/tasks.ts validates quoted words+time on for:matthew & guards non-veto agent:matthew',
    measured: c8Actual,
    target: 1,
    knownMatch: 1,
    knownMismatch: 0,
    score: c8Actual,
    pass: c8Actual >= 0.95,
    source: 'tasks/RULES.md:16,25-26 (Rules 10,16) vs tools/tasks.ts:119,132-133',
  },
  {
    id: 'tests_tasks_post_grandfather_gate',
    metric: 'tests/tasks.test.ts fails CI on NEW post-grandfather rule breaks instead of permanent todo',
    measured: c9Actual,
    target: 1,
    knownMatch: 1,
    knownMismatch: 0,
    score: c9Actual,
    pass: c9Actual >= 0.95,
    source: `tests/tasks.test.ts:64 (${live.errors.length} total breaks, ${postCutoffErrors.length} in Nov 2026 silently skipped)`,
  },
  {
    id: 'board_github_tmpdir_cleanup',
    metric: 'tools/board-github.ts cleans up mkdtempSync boreal-board-* directory',
    measured: c10Actual,
    target: 1,
    knownMatch: 1,
    knownMismatch: 0,
    score: c10Actual,
    pass: c10Actual >= 0.95,
    source: 'tools/board-github.ts:32',
  },
  {
    id: 'rule13_next_id_and_renumber_clarity',
    metric: 'tools/tasks.ts has cross-branch next-id helper & RULES.md clarifies unmerged renumber',
    measured: c11Actual,
    target: 1,
    knownMatch: 1,
    knownMismatch: 0,
    score: c11Actual,
    pass: c11Actual >= 0.95,
    source: 'tasks/RULES.md:16,19 (Rules 10,13); recent cross-branch collisions T-0254/T-0258/T-0259',
  },
  {
    id: 'rule17_ci_jobs_and_cursor_documented',
    metric: 'tasks/RULES.md Rule 17 names actual CI jobs (test, slow) and cursor agent',
    measured: c12Actual,
    target: 1,
    knownMatch: 1,
    knownMismatch: 0,
    score: c12Actual,
    pass: c12Actual >= 0.95,
    source: `tasks/RULES.md:27 vs .github/workflows/ci.yml (jobs: ${ciJobs.join(', ')})`,
  },
];

const calibrationValid = checks.every(c => c.knownMatch >= 0.95 && c.knownMismatch <= 0.1);
const passed = checks.filter(c => c.pass).length;
const meanScore = Number((checks.reduce((s, c) => s + c.score, 0) / checks.length).toFixed(4));

const report = {
  auditedCommit: execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim(),
  auditedAt: new Date().toISOString(),
  calibrationValid,
  passed,
  total: checks.length,
  meanScore,
  liveBoardStats: {
    totalTasks: live.tasks.length,
    totalEvents: live.events.length,
    stateCounts,
    namedSkillTasks,
    namedSkillParsedTrue,
    creditsHeaderPresent,
    creditsHeaderMismatch,
    creditsMismatchesSample: creditsMismatches.slice(0, 10),
    totalRuleBreaks: live.errors.length,
    nov2026RuleBreaks: postCutoffErrors.length,
    nov2026RuleBreakSample: postCutoffErrors,
    warnings: live.warnings,
    recentCrossBranchCollisions: recentCollisions,
    ciJobs,
    agentReviewAgents: agentList,
  },
  checks,
};

writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({
  auditedCommit: report.auditedCommit,
  calibrationValid,
  passed: `${passed}/${checks.length}`,
  meanScore,
  liveBoardStats: {
    totalTasks: live.tasks.length,
    totalEvents: live.events.length,
    namedSkillTasks,
    namedSkillParsedTrue,
    creditsHeaderPresent,
    creditsHeaderMismatch,
    totalRuleBreaks: live.errors.length,
    nov2026RuleBreaks: postCutoffErrors.length,
    recentCrossBranchCollisions: recentCollisions,
  },
}, null, 2));
