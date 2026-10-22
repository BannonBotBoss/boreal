/**
 * Mirror the task board (tasks/*.md + tasks/events) onto GitHub: one Issue per open task, and the "Boreal board" project.
 * State comes from Claude's ledger() (tools/tasks.ts on claude/tasks-crlf-comment); this file adds no state logic.
 *
 *   npx tsx tools/board-github.ts issues    # repo scope only: create missing Issues, refresh state/agent labels
 *   npx tsx tools/board-github.ts project   # needs `gh auth refresh -s project` once: create/link the project, add items, set Status
 *
 * Env: BOREAL_REPO (Bannon-github/boreal), BOREAL_TASKS (./tasks), BOREAL_LEDGER (path to tasks.ts with ledger()).
 * Re-runnable: Issues are matched by their "T-XXXX:" title prefix, project items by Issue URL.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const REPO = process.env.BOREAL_REPO ?? 'Bannon-github/boreal', OWNER = REPO.split('/')[0];
const TASKS = resolve(process.env.BOREAL_TASKS ?? 'tasks');
const LEDGER = resolve(process.env.BOREAL_LEDGER ?? (existsSync('tools/tasks.ts') ? 'tools/tasks.ts' : 'C:/dev/boreal-claude-tasks/tools/tasks.ts'));
const PROJECT_TITLE = 'Boreal board';
const STATUS: Record<string, string> = { proposed: 'Proposed', approved: 'Plan approved', claimed: 'In progress',
  completed: 'Waiting for approval', done: 'Done', rejected: 'Rejected' };
const COLOR: Record<string, string> = { proposed: 'GRAY', approved: 'BLUE', claimed: 'YELLOW', completed: 'ORANGE', done: 'GREEN', rejected: 'RED' };
const OPEN = new Set(['proposed', 'approved', 'claimed', 'completed']);

const gh = (...a: string[]) => execFileSync('gh', a, { encoding: 'utf8', maxBuffer: 64 << 20 }).trim();
const ghJson = (...a: string[]) => JSON.parse(gh(...a) || 'null');

/** ledger() reads a copy of the board; the copy drops UTF-8 BOMs and doubles stray backslashes (Windows paths) in event
 * JSON, which would otherwise make JSON.parse throw. The real files are not touched. */
async function board() {
  const dir = mkdtempSync(join(tmpdir(), 'boreal-board-')); cpSync(TASKS, dir, { recursive: true });
  const ev = join(dir, 'events');
  for (const f of existsSync(ev) ? readdirSync(ev).filter(f => f.endsWith('.json')) : []) {
    let s = readFileSync(join(ev, f), 'utf8').replace(/^\uFEFF/, '');
    try { JSON.parse(s); } catch { s = s.replace(/\\(?!["\\/bfnrtu])/g, '\\\\'); console.warn(`warn: repaired JSON in copy of events/${f}`); }
    writeFileSync(join(ev, f), s);
  }
  const { ledger } = await import(pathToFileURL(LEDGER).href);
  const L = ledger(dir);
  const handoffs = existsSync(join(TASKS, 'handoffs')) ? readdirSync(join(TASKS, 'handoffs')) : [];
  return (L.tasks as any[]).map(t => ({ ...t, owner: t.claimant ?? t.author, handoffs: handoffs.filter(h => h.startsWith(t.id + '-')) }));
}

const blob = (p: string) => `https://github.com/${REPO}/blob/main/${p}`;
function body(t: any) {
  return [`Mirrored from the task board (\`tasks/${t.file}\`). State and owner come from the event ledger; the task file stays the source of truth until the board moves fully to GitHub.`,
    '', `- **State:** ${STATUS[t.state]} (\`${t.state}\`)`, `- **Author:** ${t.author}`, `- **Owner:** ${t.owner}${t.claimant ? ' (claimant)' : ''}`,
    `- **Steps:** ${t.steps} · award ${t.award} cr`, `- **Task:** ${blob('tasks/' + t.file)}`,
    ...t.handoffs.map((h: string) => `- **Handoff:** ${blob('tasks/handoffs/' + h)}`)].join('\n');
}
function ensureLabel(name: string, color: string, existing: Set<string>) {
  if (existing.has(name)) return;
  gh('label', 'create', name, '-R', REPO, '--color', color, '--force'); existing.add(name);
}
const LABEL_COLOR: Record<string, string> = { proposed: 'bbbbbb', approved: '1f6feb', claimed: 'd4a72c', completed: 'fb8f44', done: '2da44e', rejected: 'cf222e' };

async function issues() {
  const tasks = (await board()).filter(t => OPEN.has(t.state));
  const labels = new Set<string>((ghJson('label', 'list', '-R', REPO, '--limit', '500', '--json', 'name') as any[]).map(l => l.name));
  const have = ghJson('issue', 'list', '-R', REPO, '--state', 'all', '--limit', '1000', '--json', 'number,title,url,labels') as any[];
  const out: any[] = [];
  for (const t of tasks) {
    const want = [`state:${t.state}`, `agent:${t.owner}`];
    ensureLabel(want[0], LABEL_COLOR[t.state], labels); ensureLabel(want[1], 'ededed', labels);
    const prev = have.find(i => i.title.startsWith(t.id + ':'));
    if (prev) {
      const stale = prev.labels.map((l: any) => l.name).filter((n: string) => /^(state|agent):/.test(n) && !want.includes(n));
      const missing = want.filter(n => !prev.labels.some((l: any) => l.name === n));
      if (stale.length || missing.length) gh('issue', 'edit', String(prev.number), '-R', REPO, ...missing.flatMap(n => ['--add-label', n]), ...stale.flatMap((n: string) => ['--remove-label', n]));
      console.log(`exists  ${t.id} #${prev.number} ${t.state}`); out.push({ ...t, url: prev.url, created: false }); continue;
    }
    const url = gh('issue', 'create', '-R', REPO, '--title', `${t.id}: ${t.title}`, '--body', body(t), ...want.flatMap(n => ['--label', n]));
    console.log(`created ${t.id} ${url} ${t.state}`); out.push({ ...t, url, created: true });
  }
  return out;
}

async function project() {
  const tasks = await issues();
  let p = (ghJson('project', 'list', '--owner', OWNER, '--format', 'json', '--limit', '100').projects as any[]).find(x => x.title === PROJECT_TITLE);
  if (!p) p = ghJson('project', 'create', '--owner', OWNER, '--title', PROJECT_TITLE, '--format', 'json');
  try { gh('project', 'link', String(p.number), '--owner', OWNER, '--repo', REPO); } catch { /* already linked */ }
  const fields = ghJson('project', 'field-list', String(p.number), '--owner', OWNER, '--format', 'json').fields as any[];
  let status = fields.find(f => f.name === 'Status');
  const names = Object.values(STATUS);
  if (!status || names.some(n => !status.options?.some((o: any) => o.name === n))) {
    // Replace the default Todo/In Progress/Done options with the board's six states.
    const opts = Object.entries(STATUS).map(([k, n]) => `{name:${JSON.stringify(n)},color:${COLOR[k]},description:${JSON.stringify('ledger state: ' + k)}}`).join(',');
    const r = ghJson('api', 'graphql', '-f', `query=mutation{updateProjectV2Field(input:{fieldId:${JSON.stringify(status.id)},singleSelectOptions:[${opts}]}){projectV2Field{...on ProjectV2SingleSelectField{id options{id name}}}}}`);
    status = { ...status, options: r.data.updateProjectV2Field.projectV2Field.options };
  }
  const items = ghJson('project', 'item-list', String(p.number), '--owner', OWNER, '--format', 'json', '--limit', '1000').items as any[];
  for (const t of tasks) {
    const item = items.find(i => i.content?.url === t.url) ?? ghJson('project', 'item-add', String(p.number), '--owner', OWNER, '--url', t.url, '--format', 'json');
    const opt = status.options.find((o: any) => o.name === STATUS[t.state]);
    gh('project', 'item-edit', '--id', item.id, '--project-id', p.id, '--field-id', status.id, '--single-select-option-id', opt.id);
    console.log(`project ${t.id} -> ${STATUS[t.state]}`);
  }
  console.log(`Board: ${p.url}`);
}

const mode = process.argv[2];
if (mode === 'issues') await issues(); else if (mode === 'project') await project();
else { console.error('usage: npx tsx tools/board-github.ts issues|project'); process.exitCode = 2; }
