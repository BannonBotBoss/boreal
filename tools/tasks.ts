/**
 * Task board ledger (Claude): reads tasks/*.md and tasks/events/*.json, replays the events, and returns the board, balances,
 * status, weekly awards and any rule breaks. The rules are in tasks/RULES.md (rules 16/16b: "for": "matthew" approvals). `npx tsx tools/tasks.ts` prints it all;
 * tests/tasks.test.ts fails on any rule break.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export const STATUS = [['Member', 0], ['Contributor', 100], ['Trusted', 250], ['Senior', 500], ['Lead', 1000]] as const;
export const CREDITS = { perStep: 10, scratch: .5, research: .3, skill: 1.5, bugPerSeverity: 5, review: 2, weekly: 25 };
/** Agents that record Matthew's chat approvals with "for": "matthew" (rules 16/16b). grokbot-1, grokbot-2 and grokbot-3 have their own GitHub accounts (T-0069, T-0071). */
export const RELAYS_MATTHEW: readonly string[] = ['grok', 'grokbot-1', 'grokbot-2', 'grokbot-3'];
export type State = 'proposed' | 'approved' | 'claimed' | 'completed' | 'done' | 'rejected';
export interface Task { id: string; file: string; title: string; author: string; scratch: boolean; research: boolean; skill: boolean; steps: number;
  state: State; claimant?: string; skillApproved: boolean; award: number }
export interface Ev { type: string; task?: string; agent: string; at: string; file: string; branch?: string; severity?: number; of?: string; to?: string; note?: string; bug?: string; for?: string }

export function award(t: Pick<Task, 'steps' | 'scratch' | 'research'>) {
  return Math.round(CREDITS.perStep * t.steps * (1 + (t.scratch ? CREDITS.scratch : 0) + (t.research ? CREDITS.research : 0)));
}
function parseTask(file: string, raw: string): Task {
  const text = raw.replace(/\r\n?/g, '\n'); // CRLF checkouts (core.autocrlf on Windows) read like LF ones
  const fm =/^---\n([\s\S]*?)\n---/.exec(text)?.[1] ?? '', get = (k: string) => new RegExp(`^${k}:\\s*(.*)$`, 'm').exec(fm)?.[1].trim() ?? '';
  const objectives = /## Objectives\n([\s\S]*?)(\n## |$)/.exec(text)?.[1] ?? '';
  const t = { id: get('id'), file, title: get('title'), author: get('author'), scratch: get('scratch') === 'true', research: get('research') === 'true',
    skill: get('skill') === 'true', steps: (objectives.match(/^- \[[ x]\]/gm) ?? []).length, state: 'proposed' as State, skillApproved: false, award: 0 };
  t.award = award(t); return t;
}
/** The Monday (Pacific time, DST included) that starts the week containing `at`, as YYYY-MM-DD. */
export function weekOf(at: string) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' })
    .formatToParts(new Date(at)).map(x => [x.type, x.value]));
  const back = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(p.weekday);
  return new Date(Date.UTC(+p.year, +p.month - 1, +p.day - back)).toISOString().slice(0, 10);
}
export function ledger(root = join(process.cwd(), 'tasks')) {
  const tasks = new Map<string, Task>(), errors: string[] = [], balance = new Map<string, number>(), earned = new Map<string, Map<string, number>>();
  const status = new Map<string, number>();
  for (const f of readdirSync(root).filter(f => /^T-\d{4}-.*\.md$/.test(f)).sort()) {
    const t = parseTask(f, readFileSync(join(root, f), 'utf8'));
    if (!t.id || !f.startsWith(t.id + '-')) errors.push(`${f}: front matter id must match the file name`);
    if (!t.author) errors.push(`${f}: no author`); if (t.steps === 0) errors.push(`${f}: no "- [ ]" steps under ## Objectives`);
    tasks.set(t.id, t);
  }
  // Event files: a UTF-8 BOM (Windows PowerShell writes one) is dropped; a file that is not valid JSON is a warning and is
  // skipped, so one bad file never hides the whole board.
  const dir = join(root, 'events'), events: Ev[] = [], warnings: string[] = [];
  for (const f of existsSync(dir) ? readdirSync(dir).filter(f => f.endsWith('.json')) : []) {
    try { events.push({ ...JSON.parse(readFileSync(join(dir, f), 'utf8').replace(/^\uFEFF/, '')), file: f }); }
    catch (err) { warnings.push(`${f}: not valid JSON, skipped (${(err as Error).message})`); }
  }
  events.sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || a.file.localeCompare(b.file));
  const pay = (agent: string, n: number, at: string, counts = true) => {
    balance.set(agent, (balance.get(agent) ?? 0) + n);
    if (counts && n > 0) { const w = weekOf(at), m = earned.get(w) ?? new Map(); m.set(agent, (m.get(agent) ?? 0) + n); earned.set(w, m); }
  };
  const bugs = new Map<string, Ev>(), confirmed = new Set<string>();
  for (const e of events) {
    const bad = (why: string) => errors.push(`${e.file}: ${why}`);
    if (!e.agent || !e.type || Number.isNaN(Date.parse(e.at))) { bad('needs type, agent and an ISO time'); continue; }
    if (e.agent === 'matthew' && e.type === 'veto') { const t = e.task && tasks.get(e.task); if (t) t.state = 'rejected'; continue; }
    if (e.type === 'redeem') {
      const next = (status.get(e.agent) ?? 0) + 1, s = STATUS[next];
      if (!s || s[0] !== e.to) { bad(`next status for ${e.agent} is ${s?.[0] ?? 'none'}`); continue; }
      const cost = s[1] - STATUS[next - 1][1];
      if ((balance.get(e.agent) ?? 0) < cost) { bad(`${e.agent} has fewer than ${cost} banked credits`); continue; }
      pay(e.agent, -cost, e.at, false); status.set(e.agent, next); continue;
    }
    if (e.type === 'bug') { if (!(e.severity! >= 1 && e.severity! <= 3)) bad('severity 1-3'); bugs.set(e.file, e); }
    const t = e.task ? tasks.get(e.task) : undefined;
    // Rules 16/16b: Matthew's approval in chat, recorded by a Grok bot (grok, grokbot-1, grokbot-2, grokbot-3; T-0069, T-0071) with "for": "matthew"
    // and his words quoted in the note, is a non-author review even on that bot's own tasks. It pays no review credits (the bot
    // did not review), and needs the quote.
    const forMatthew = RELAYS_MATTHEW.includes(e.agent) && e.for === 'matthew' && (e.type === 'approve-plan' || e.type === 'approve');
    if (forMatthew && !e.note?.trim()) { bad('an approval for matthew quotes his words in the note (rule 16)'); continue; }
    if (e.type !== 'confirm-bug' && !t) { bad(`unknown task ${e.task}`); continue; }
    switch (e.type) {
      case 'propose': if (e.agent !== t!.author) bad('the proposer is the task author'); break;
      case 'approve-plan': case 'reject-plan':
        if (t!.state !== 'proposed') bad(`plan is ${t!.state}`); else if (e.agent === t!.author && !forMatthew) bad('a plan needs another agent\'s review');
        else { t!.state = e.type === 'approve-plan' ? 'approved' : 'rejected'; if (!forMatthew) pay(e.agent, CREDITS.review, e.at); } break;
      case 'claim': if (t!.state !== 'approved') bad(`task is ${t!.state}, not approved`); else { t!.state = 'claimed'; t!.claimant = e.agent; } break;
      case 'release': if (t!.claimant !== e.agent) bad('only the claimant releases'); else { t!.state = 'approved'; t!.claimant = undefined; } break;
      case 'complete': if (t!.state !== 'claimed' || t!.claimant !== e.agent) bad('only the claimant completes a claimed task'); else if (!e.branch) bad('name the branch'); else t!.state = 'completed'; break;
      case 'approve': case 'reject':
        if (t!.state !== 'completed') bad(`task is ${t!.state}`); else if (e.agent === t!.claimant && !forMatthew) bad('work needs another agent\'s review');
        else { if (!forMatthew) pay(e.agent, CREDITS.review, e.at); if (e.type === 'approve') { t!.state = 'done'; pay(t!.claimant!, t!.award, e.at); } else t!.state = 'claimed'; } break;
      case 'skill-approve':
        if (!t!.skill) bad('this task makes no skill'); else if (t!.state !== 'done') bad('approve the task first'); else if (e.agent === t!.claimant) bad('another agent approves the skill');
        else if (!t!.skillApproved) { t!.skillApproved = true; pay(t!.claimant!, Math.round(t!.award * (CREDITS.skill - 1)), e.at); } break;
      case 'bug': if (t!.state !== 'done') bad('bugs are filed against done tasks'); break;
      case 'comment': break; // a note on the board (tools/board-server.ts POST /api/comment): no credits, no state change
      case 'confirm-bug': {
        const b = e.of ? bugs.get(e.of) : undefined, bt = b?.task ? tasks.get(b.task) : undefined;
        if (!b || !bt) { bad('confirm-bug needs "of": an earlier bug event file'); break; }
        if (e.agent === b.agent || e.agent === bt.claimant) { bad('confirm with an agent that is neither the reporter nor the author'); break; }
        if (confirmed.has(e.of!)) { bad('already confirmed'); break; }
        confirmed.add(e.of!); const n = CREDITS.bugPerSeverity * b.severity!; pay(b.agent, n, e.at); pay(bt.claimant!, -n, e.at, false); break;
      }
      default: bad(`unknown event type ${e.type}`);
    }
  }
  const awards = [...earned].sort().map(([week, m]) => {
    const top = Math.max(...m.values()), winners = [...m].filter(([, n]) => n === top).map(([a]) => a);
    return { week, winners, credits: top };
  });
  const current = weekOf(new Date().toISOString());
  for (const a of awards) if (a.week < current) for (const w of a.winners) pay(w, CREDITS.weekly, a.week, false); // paid once the week is over
  const open = [...tasks.values()].filter(t => t.state === 'proposed' || t.state === 'approved' || t.state === 'claimed');
  if (open.length === 0) errors.push('the board is empty: propose a task that moves the game forward');
  const agents = new Set([...balance.keys(), ...status.keys()]);
  return { tasks: [...tasks.values()], events, errors, warnings, awards,
    agents: [...agents].sort().map(a => ({ agent: a, credits: balance.get(a) ?? 0, status: STATUS[status.get(a) ?? 0][0] })) };
}

if (process.argv[1]?.endsWith('tasks.ts')) {
  const L = ledger();
  console.log('Tasks'); for (const t of L.tasks) console.log(`  ${t.id} ${t.state.padEnd(9)} ${String(t.award).padStart(4)} cr  ${t.title}${t.claimant ? `  (${t.claimant})` : ''}`);
  console.log('Agents'); for (const a of L.agents) console.log(`  ${a.agent.padEnd(12)} ${String(a.credits).padStart(5)} cr  ${a.status}`);
  console.log('Weekly award'); for (const w of L.awards) console.log(`  week of ${w.week}: ${w.winners.join(', ')} (${w.credits} cr)`);
  if (L.warnings.length) { console.log('Warnings'); for (const w of L.warnings) console.log('  ' + w); }
  if (L.errors.length) { console.log('Rule breaks'); for (const e of L.errors) console.log('  ' + e); process.exitCode = 1; }
}
