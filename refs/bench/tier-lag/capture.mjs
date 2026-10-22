// grok: ?bench tier lag (T-0023 lead 2, claude): run the in-game ?bench on a port and keep every BENCH console line.
// Headless Edge on the GPU, off-screen (--window-position=-32000,-32000), flags of tools/smoke-tiers.mjs; bench lock; killed on release.
// node refs/bench/tier-lag/capture.mjs <port> <out.json>
import { spawn } from 'node:child_process'; import { mkdtempSync, writeFileSync } from 'node:fs'; import { tmpdir } from 'node:os'; import { join } from 'node:path';
import { acquire, track, release } from '../../../tools/bench-lock.mjs';
const PORT = process.argv[2] ?? '5263', out = process.argv[3] ?? 'refs/bench/tier-lag/bench.json', name = 'grok: bench tier lag', dbg = 9700 + Math.floor(Math.random() * 90);
const sleep = ms => new Promise(r => setTimeout(r, ms));
if (!await acquire(name, { waitMs: 10 * 60 * 1000 })) throw Error('GPU busy');
let ws; const lines = [];
try {
  const p = spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', ['--disable-gpu-vsync', '--disable-frame-rate-limit', '--headless=new', '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-gpu-sandbox', '--hide-scrollbars', '--window-size=1280,800', '--window-position=-32000,-32000',
    '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--disable-background-timer-throttling', `--remote-debugging-port=${dbg}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'grok-bench-'))}`, 'about:blank'], { stdio: 'ignore' }); track(p.pid);
  let tabs; for (let i = 0; i < 60 && !tabs; i++) { await sleep(500); try { tabs = await (await fetch(`http://127.0.0.1:${dbg}/json`)).json(); } catch {} }
  ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const pend = new Map(); let done = false;
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); }
    if (d.method === 'Runtime.consoleAPICalled') { const s = d.params.args.map(a => a.value ?? a.description ?? '').join(' '); if (s.startsWith('BENCH')) { lines.push(s); console.log(s.slice(0, 160)); if (s === 'BENCH done') done = true; } } };
  const cdp = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  await cdp('Page.enable'); await cdp('Runtime.enable'); await cdp('Page.bringToFront'); await cdp('Emulation.setFocusEmulationEnabled', { enabled: true });
  await cdp('Page.navigate', { url: `http://127.0.0.1:${PORT}/?nomenu&bench&hour=12` });
  const t0 = Date.now(); while (!done && Date.now() - t0 < 9 * 60 * 1000) await sleep(1000);
} finally { ws?.close(); release(name); writeFileSync(out, JSON.stringify({ port: PORT, lines }, null, 1)); }