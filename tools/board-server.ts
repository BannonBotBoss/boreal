/**
 * Task board website (grok-globe). Serves tools/board.html and /api/board on http://127.0.0.1:5190. Read-only, except that
 * POST /api/comment adds a comment event (below).
 * The board is replayed by tools/tasks.ts's ledger(), so there is one parser. By default it reads tasks/ from EVERY local branch
 * (refs/heads and refs/remotes) through git, without checking anything out: each file is taken from the branch whose last commit
 * to it is newest, and the union is written to a temp folder for ledger(). Blobs come out of git byte-for-byte, so CRLF checkouts
 * do not matter. Options: --repo <git repo> (default: this checkout; branches are shared by all worktrees), --ref <ref> (one
 * branch only, e.g. main), --dir <tasks folder> (a checked-out tasks/ as is), --port <n>,
 * --comments-branch <branch> (default grok-globe/task-board-site: comments are committed only while --repo has it checked out).
 * Tags: optional front matter `tags: [animal, behaviour, wolf]` (lowercase, no #); ledger() ignores the key, the server reads it.
 * Comments: tasks/events/<YYYY-MM-DDTHH-MM>-<agent>-comment-<task>.json = { type: "comment", task, agent, at, note }. They are
 * kept out of ledger() (its rules do not know the type) and merged back into the timeline, so they never become rule breaks.
 * Run: npm run board   (or: node --import tsx tools/board-server.ts --port 5190)
 */
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const arg = (k: string) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : undefined; };
const here = dirname(fileURLToPath(import.meta.url));
const repo = arg('repo') ?? join(here, '..'), only = arg('ref'), dir = arg('dir'), port = Number(arg('port') ?? 5190);
const commentsBranch = arg('comments-branch') ?? 'grok-globe/task-board-site';
const git = (...a: string[]) => execFileSync('git', ['-C', repo, ...a], { maxBuffer: 64 << 20 });
const tmp = mkdtempSync(join(tmpdir(), 'boreal-board-')), blobs = new Map<string, Buffer>();
type Ledger = (root: string) => any;
const ledgers = new Map<string, Promise<Ledger>>();
const loadLedger = (file: string, key: string) => {
  if (!ledgers.has(key)) ledgers.set(key, import(pathToFileURL(file).href + '?v=' + key).then(m => m.ledger));
  return ledgers.get(key)!;
};
/** `tags: [a, b]` (or `tags: a, b`) from the front matter: lowercase, no #, no duplicates. */
const tagsOf = (md: string) => {
  const v = /^tags:\s*(.*)$/m.exec(/^---\r?\n([\s\S]*?)\r?\n---/.exec(md)?.[1] ?? '')?.[1] ?? '';
  return [...new Set(v.trim().replace(/^\[|\]$/g, '').split(',').map(s => s.trim().replace(/^["'#]+|["']+$/g, '').toLowerCase()).filter(Boolean))];
};
const isComment = (path: string, buf: Buffer) => {
  if (!/^tasks\/events\/[^/]*-comment-[^/]*\.json$/.test(path)) return undefined;
  try { const e = JSON.parse(buf.toString('utf8')); return e?.type === 'comment' ? e : undefined; } catch { return undefined; }
};

/** tasks/ (and tools/tasks.ts) across the refs: path -> { blob, refs that have the file }. */
function snapshot() {
  const refs = only ? [only] : git('for-each-ref', '--format=%(refname)\t%(refname:short)', 'refs/heads', 'refs/remotes').toString()
    .split('\n').filter(l => l && !l.split('\t')[0].endsWith('/HEAD')).map(l => l.split('\t')[1]);
  const files = new Map<string, { blob: string; ref: string; refs: string[] }>(), clash = new Set<string>();
  for (const ref of refs) for (const line of git('ls-tree', '-r', ref, '--', 'tasks', 'tools/tasks.ts').toString().split('\n').filter(Boolean)) {
    const [meta, path] = line.split('\t'), blob = meta.split(' ')[2], f = files.get(path);
    if (!f) files.set(path, { blob, ref, refs: [ref] }); else { f.refs.push(ref); if (f.blob !== blob) clash.add(path); }
  }
  for (const path of clash) { // differing copies: the ref whose last commit to this path is newest wins
    const f = files.get(path)!, at = (r: string) => Number(git('log', '-1', '--format=%ct', r, '--', path).toString().trim() || 0);
    f.ref = f.refs.reduce((a, b) => (at(b) > at(a) ? b : a));
    f.blob = git('rev-parse', `${f.ref}:${path}`).toString().trim();
  }
  return { refs, files };
}

const byTime = (a: any, b: any) => Date.parse(a.at) - Date.parse(b.at) || a.file.localeCompare(b.file);
async function board() {
  if (dir) {
    const own = join(here, 'tasks.ts');
    if (!existsSync(own)) throw new Error('--dir needs tools/tasks.ts in this checkout');
    const L = (await loadLedger(own, 'own'))(dir);
    return { source: { mode: 'dir', dir, refs: [] }, ...L, events: L.events.map((e: any) => ({ ...e, refs: [] })),
      tasks: L.tasks.map((t: any) => { const markdown = readFileSync(join(dir, t.file), 'utf8'); return { ...t, markdown, tags: tagsOf(markdown), branches: [], handoffs: [] }; }) };
  }
  const { refs, files } = snapshot(), root = join(tmp, 'board'), comments: any[] = [];
  rmSync(root, { recursive: true, force: true });
  for (const [path, f] of files) {
    if (!blobs.has(f.blob)) blobs.set(f.blob, git('cat-file', 'blob', f.blob));
    const c = isComment(path, blobs.get(f.blob)!);
    if (c) { comments.push({ ...c, file: path.slice('tasks/events/'.length), refs: f.refs }); continue; } // not for ledger()
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), blobs.get(f.blob)!);
  }
  const own = join(here, 'tasks.ts'), parser = files.get('tools/tasks.ts');
  if (!existsSync(own) && !parser) throw new Error('no branch has tools/tasks.ts');
  const ledger = existsSync(own) ? await loadLedger(own, 'own') : await loadLedger(join(root, 'tools/tasks.ts'), parser!.blob);
  if (!existsSync(join(root, 'tasks'))) mkdirSync(join(root, 'tasks', 'events'), { recursive: true });
  const L = ledger(join(root, 'tasks'));
  const text = (p: string) => (files.has(p) ? blobs.get(files.get(p)!.blob)!.toString('utf8') : '');
  return {
    source: { mode: only ? 'ref' : 'all-branches', refs, commentsBranch, parser: existsSync(own) ? 'tools/tasks.ts (this checkout)' : `tools/tasks.ts from ${parser!.ref}` },
    ...L,
    tasks: L.tasks.map((t: any) => { const markdown = text('tasks/' + t.file); return { ...t, markdown, tags: tagsOf(markdown), branches: files.get('tasks/' + t.file)?.refs ?? [],
      handoffs: [...files.keys()].filter(p => p.startsWith(`tasks/handoffs/${t.id}-`)).map(p => ({ file: p, markdown: text(p) })) }; }),
    events: [...L.events.map((e: any) => ({ ...e, refs: files.get('tasks/events/' + e.file)?.refs ?? [] })), ...comments].sort(byTime),
  };
}

/** Local time with its offset, e.g. 2026-10-19T07:45:00-07:00 (the board's event style). */
function localIso(d = new Date()) {
  const o = -d.getTimezoneOffset(), p = (n: number) => String(Math.floor(Math.abs(n))).padStart(2, '0');
  const l = new Date(d.getTime() + o * 60000).toISOString().slice(0, 19);
  return `${l}${o >= 0 ? '+' : '-'}${p(o / 60)}:${p(o % 60)}`;
}
let queue: Promise<unknown> = Promise.resolve();
/** Writes tasks/events/<time>-<agent>-comment-<task>.json into --repo and commits only that file, as grok-globe, on commentsBranch. */
async function comment(body: any) {
  const agent = String(body?.agent ?? 'matthew').trim().toLowerCase() || 'matthew', note = String(body?.text ?? '').replace(/\r\n?/g, '\n').trim(), task = String(body?.task ?? '');
  if (!/^[a-z][a-z0-9-]{0,31}$/.test(agent)) throw Object.assign(new Error('name: lowercase letters, digits and -, up to 32'), { code: 400 });
  if (!note || note.length > 4000) throw Object.assign(new Error('comment: 1 to 4000 characters'), { code: 400 });
  if (!(await board()).tasks.some((t: any) => t.id === task)) throw Object.assign(new Error(`unknown task ${task}`), { code: 400 });
  const head = git('symbolic-ref', '--quiet', '--short', 'HEAD').toString().trim();
  if (head !== commentsBranch) throw Object.assign(new Error(`comments are committed on ${commentsBranch}; ${repo} has ${head} checked out`), { code: 409 });
  const at = localIso(), stem = `${at.slice(0, 16).replace(':', '-')}-${agent}-comment-${task}`, events = join(repo, 'tasks', 'events');
  mkdirSync(events, { recursive: true });
  let name = stem + '.json'; for (let n = 2; existsSync(join(events, name)); n++) name = `${stem}-${n}.json`;
  const path = 'tasks/events/' + name;
  writeFileSync(join(repo, path), JSON.stringify({ type: 'comment', task, agent, at, note }) + '\n');
  try {
    git('add', '--', path);
    git('-c', 'user.name=grok-globe', '-c', 'user.email=grok-globe@users.noreply.local', 'commit', '--quiet', '-m', `board comment: ${agent} on ${task}`, '--only', '--', path);
  } catch (e) { try { git('rm', '--cached', '--quiet', '--', path); } catch {} rmSync(join(repo, path), { force: true }); throw e; }
  return { file: name, commit: git('rev-parse', '--short', 'HEAD').toString().trim(), at };
}

const page = join(here, 'board.html');
const sameOrigin = (o?: string) => !o || o === `http://127.0.0.1:${port}` || o === `http://localhost:${port}`;
createServer(async (req, res) => {
  const json = (code: number, v: unknown) => res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' }).end(JSON.stringify(v));
  try {
    if (req.method === 'POST' && req.url === '/api/comment') { // same-origin JSON only, so other sites cannot post (CORS preflight)
      if (!sameOrigin(req.headers.origin) || !String(req.headers['content-type']).startsWith('application/json')) { json(403, { error: 'same-origin JSON only' }); return; }
      let raw = ''; for await (const c of req) { raw += c; if (raw.length > 16384) { json(413, { error: 'too large' }); return; } }
      let body: any; try { body = JSON.parse(raw); } catch { json(400, { error: 'bad JSON' }); return; }
      const run = queue.then(() => comment(body)); queue = run.catch(() => {});
      try { json(200, await run); } catch (e: any) { json(e.code ?? 500, { error: String(e.message ?? e) }); }
      return;
    }
    if (req.method !== 'GET') { res.writeHead(405).end(); return; }
    if (req.url === '/' || req.url === '/index.html') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(readFileSync(page)); return; }
    if (req.url === '/api/board') { json(200, { at: new Date().toISOString(), ...(await board()) }); return; }
    res.writeHead(404).end('not found');
  } catch (e) { res.writeHead(500, { 'content-type': 'text/plain' }).end(String((e as Error).stack ?? e)); }
}).listen(port, '127.0.0.1', () => console.log(`task board: http://127.0.0.1:${port}/  (${dir ? 'dir ' + dir : only ? 'ref ' + only : 'all local branches'} of ${repo}; comments on ${commentsBranch})`));
process.on('exit', () => rmSync(tmp, { recursive: true, force: true }));
for (const s of ['SIGINT', 'SIGTERM'] as const) process.on(s, () => process.exit(0));
