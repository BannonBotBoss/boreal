/**
 * Reproducible Rule 7 / Rule 12 audit of `tasks/RULES.md` vs `tools/tasks.ts` on `origin/main` (`20cbd95`).
 * Run: `npx tsx refs/board/rule-ledger-audit/audit.ts`
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ledger } from '../../../tools/tasks';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../../..');
const tasksDir = resolve(repoRoot, 'tasks');

const l = ledger(tasksDir, repoRoot);
const taskById = new Map(l.tasks.map((t) => [t.id, t]));

const namedSkillTasks: string[] = [];
const boolSkillTasks: string[] = [];
const creditHeaderMismatches: Array<{ id: string; file: string; headerCredits: number; computedAward: number }> = [];

for (const f of readdirSync(tasksDir).filter((x) => /^T-\d{4}-.*\.md$/.test(x)).sort()) {
  const raw = readFileSync(resolve(tasksDir, f), 'utf8').replace(/\r\n?/g, '\n');
  const fm = /^---\n([\s\S]*?)\n---/.exec(raw)?.[1] ?? '';
  const get = (k: string) => new RegExp(`^${k}:\\s*(.*)$`, 'm').exec(fm)?.[1].trim() ?? '';
  const id = get('id');
  const sk = get('skill');
  if (sk === 'true') boolSkillTasks.push(id);
  else if (sk && sk !== 'false' && sk !== 'none') namedSkillTasks.push(`${id} (${sk})`);
  const cr = Number(get('credits'));
  const t = taskById.get(id);
  if (t && Number.isFinite(cr) && cr > 0 && cr !== t.award) {
    creditHeaderMismatches.push({ id, file: f, headerCredits: cr, computedAward: t.award });
  }
}

// Check which tasks already have non-board implementation commits (`src/`, `crates/`, `tools/`, `tests/`) on `main`
const implLog = execSync('git log --oneline -- src crates tools tests', { cwd: repoRoot, encoding: 'utf8' });
const hasImplCommitOnMain = (id: string) => new RegExp(`\\b${id}\\b`).test(implLog);

const completedTasks = l.tasks.filter((t) => t.state === 'completed');
const approvedTasks = l.tasks.filter((t) => t.state === 'approved');
const proposedTasks = l.tasks.filter((t) => t.state === 'proposed');

const completedAlreadyMerged = completedTasks.filter((t) => hasImplCommitOnMain(t.id)).map((t) => t.id);
const completedPendingReview = completedTasks.filter((t) => !completedAlreadyMerged.includes(t.id)).map((t) => t.id);

const approvedAlreadyMerged = approvedTasks.filter((t) => hasImplCommitOnMain(t.id)).map((t) => t.id);
const approvedUnmerged = approvedTasks.filter((t) => !approvedAlreadyMerged.includes(t.id)).map((t) => t.id);

const proposedAlreadyMerged = proposedTasks.filter((t) => hasImplCommitOnMain(t.id)).map((t) => t.id);

// Also count complete events that fail `name the branch` only because older/Grokbot-2 complete events used `commit` instead of `branch`
const branchlessCompletes = l.errors.filter((e) => e.endsWith(': name the branch'));

const report = {
  auditedHead: execSync('git rev-parse HEAD', { cwd: repoRoot, encoding: 'utf8' }).trim(),
  totalTasks: l.tasks.length,
  finding1_rule4SkillHeaderMismatch: {
    ruleRef: 'tasks/RULES.md:6 (Rule 4: header says `skill: <skill-name>`) vs tools/tasks.ts:80 (`skill: get(\"skill\") === \"true\"`)',
    namedSkillTaskCount: namedSkillTasks.length,
    namedSkillTaskSample: namedSkillTasks.slice(0, 15),
    booleanSkillTrueCount: boolSkillTasks.length,
    skillApprovePassRateForNamedSkills: 0,
  },
  finding2_rule14CreditsHeaderIgnored: {
    ruleRef: 'tasks/RULES.md:20 (Rule 14: `tools/tasks.ts must read the header once the ledger lands on main`) vs tools/tasks.ts:81 (`t.award = award(t)`)',
    mismatchCount: creditHeaderMismatches.length,
    mismatches: creditHeaderMismatches,
  },
  finding3_rule17MergedPrBoardDrift: {
    ruleRef: 'tasks/RULES.md:4,21,27 (Rules 2, 15, 17: GitHub PR reviews/merges land code on `main` without recording `approve-plan`/`claim`/`complete`/`approve` JSON events)',
    completedTotal: completedTasks.length,
    completedAlreadyMergedOnMainCount: completedAlreadyMerged.length,
    completedAlreadyMergedOnMain: completedAlreadyMerged,
    completedActuallyAwaitingMerge: completedPendingReview,
    approvedTotal: approvedTasks.length,
    approvedAlreadyMergedOnMainCount: approvedAlreadyMerged.length,
    approvedAlreadyMergedOnMain: approvedAlreadyMerged,
    approvedRemainingUnmerged: approvedUnmerged,
    proposedTotal: proposedTasks.length,
    proposedAlreadyMergedOnMainCount: proposedAlreadyMerged.length,
    proposedAlreadyMergedOnMainSample: proposedAlreadyMerged.slice(0, 20),
    branchlessCompleteRuleBreaksCount: branchlessCompletes.length,
  },
};

const outPath = resolve(__dirname, 'audit.json');
writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(report, null, 2));
