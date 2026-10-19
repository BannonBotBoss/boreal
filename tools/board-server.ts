/**
 * Task board website (grok-globe), read-only. Serves tools/board.html and /api/board on http://127.0.0.1:5190.
 * The board is replayed by tools/tasks.ts's ledger(), so there is one parser. By default it reads tasks/ from EVERY local branch
 * (refs/heads and refs/remotes) through git, without checking anything out: each file is taken from the branch whose last commit
 * to it is newest, and the union is written to a temp folder for ledger(). Blobs come out of git byte-for-byte, so CRLF checkouts
 * do not matter. Options: --repo <git repo> (default: this checkout; branches are shared by all worktrees), --ref <ref> (one
 * branch only, e.g. main), --dir <tasks folder> (a checked-out tasks/ as is), --port <n>.
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
const git = (...a: string[]) => execFileSync('git', ['-C', repo, ...a], { maxBuffer: 64 << 20 });
const tmp = mkdtempSync(join(tmpdir(), 'boreal-board-')), blobs = new Map<string, Buffer>();
type Ledger = (root: string) => any;
const ledgers = new Map<string, Promise<Ledger>>();
const loadLedger = (file: string, key: string) => {
  if (!ledgers.has(key)) ledgers.set(key, import(pathToFileURL(file).href + '?v=' + key).then(m => m.ledger));
  return ledgers.get(key)!;
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

async function board() {
  if (dir) {
    const own = join(here, 'tasks.ts');
    if (!existsSync(own)) throw new Error('--dir needs tools/tasks.ts in this checkout');
    const L = (await loadLedger(own, 'own'))(dir);
    return { source: { mode: 'dir', dir, refs: [] }, ...L, events: L.events.map((e: any) => ({ ...e, refs: [] })),
      tasks: L.tasks.map((t: any) => ({ ...t, markdown: readFileSync(join(dir, t.file), 'utf8'), branches: [], handoffs: [] })) };
  }
  const { refs, files } = snapshot(), root = join(tmp, 'board');
  rmSync(root, { recursive: true, force: true });
  for (const [path, f] of files) {
    if (!blobs.has(f.blob)) blobs.set(f.blob, git('cat-file', 'blob', f.blob));
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
    source: { mode: only ? 'ref' : 'all-branches', refs, parser: existsSync(own) ? 'tools/tasks.ts (this checkout)' : `tools/tasks.ts from ${parser!.ref}` },
    ...L,
    tasks: L.tasks.map((t: any) => ({ ...t, markdown: text('tasks/' + t.file), branches: files.get('tasks/' + t.file)?.refs ?? [],
      handoffs: [...files.keys()].filter(p => p.startsWith(`tasks/handoffs/${t.id}-`)).map(p => ({ file: p, markdown: text(p) })) })),
    events: L.events.map((e: any) => ({ ...e, refs: files.get('tasks/events/' + e.file)?.refs ?? [] })),
  };
}

const page = join(here, 'board.html');
createServer(async (req, res) => {
  try {
    if (req.method !== 'GET') { res.writeHead(405).end(); return; }
    if (req.url === '/' || req.url === '/index.html') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(readFileSync(page)); return; }
    if (req.url === '/api/board') { res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }).end(JSON.stringify({ at: new Date().toISOString(), ...(await board()) })); return; }
    res.writeHead(404).end('not found');
  } catch (e) { res.writeHead(500, { 'content-type': 'text/plain' }).end(String((e as Error).stack ?? e)); }
}).listen(port, '127.0.0.1', () => console.log(`task board: http://127.0.0.1:${port}/  (${dir ? 'dir ' + dir : only ? 'ref ' + only : 'all local branches'} of ${repo})`));
process.on('exit', () => rmSync(tmp, { recursive: true, force: true }));
for (const s of ['SIGINT', 'SIGTERM'] as const) process.on(s, () => process.exit(0));
