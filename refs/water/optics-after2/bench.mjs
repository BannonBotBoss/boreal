// node refs/water/optics-after2/bench.mjs <port> <out.json> : the game's own ?bench ladder (main.ts) at the T-0023 shore view;
// keeps the six per-tier BENCH lines (gpu = EXT_disjoint_timer_query ms when available). Same Edge/CDP pattern as capture.mjs.
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { acquire, track, release } from '../../../tools/bench-lock.mjs';
const PORT = process.argv[2], OUT = process.argv[3], name = 'claude: water bench', sleep = ms => new Promise(r => setTimeout(r, ms));
if (!await acquire(name, { waitMs: 5 * 60 * 1000 })) throw Error('GPU busy');
let ws;
try {
  const p = spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', ['--headless=new', '--disable-extensions', '--no-first-run', '--remote-debugging-port=9473', '--user-data-dir=C:/dev/boreal-claude-edge', 'about:blank'], { stdio: 'ignore' }); track(p.pid);
  let tabs; for (let i = 0; i < 40; i++) { try { tabs = await (await fetch('http://127.0.0.1:9473/json')).json(); break; } catch { await sleep(500); } }
  ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const pending = new Map(), lines = [];
  ws.onmessage = e => { const d = JSON.parse(e.data); if (d.id) { pending.get(d.id)?.(d.result); pending.delete(d.id); }
    if (d.method === 'Runtime.consoleAPICalled') { const t = d.params.args.map(a => a.value ?? '').join(' '); if (t.startsWith('BENCH')) lines.push(t); } };
  const cdp = (method, params = {}) => new Promise(r => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
  await cdp('Runtime.enable'); await cdp('Page.enable'); await cdp('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await cdp('Page.navigate', { url: `http://127.0.0.1:${PORT}/?nomenu&bench&hour=12&at=30,0,1.571` });
  const t0 = Date.now(); while (Date.now() - t0 < 300000 && lines.filter(l => l.includes('tier-')).length < 6) await sleep(1000);
  writeFileSync(OUT, JSON.stringify({ port: PORT, lines }, null, 1)); console.log(lines.join('\n'));
} finally { ws?.close(); release(name); }
