// node refs/forest-edge/trunk-zone/capture.mjs <port> <out dir> : the T-0023 noon lake view (?at=30,0,1.571, hour 12) once per
// tree variant ('' = default trees, '&trees=v2' = render/trees/game black spruce v2), 3 stills each, for the trunk-zone sky share.
// Pattern of refs/water/shore-audit/capture.mjs (bench lock, headless Edge killed by release).
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { acquire, track, release } from '../../../tools/bench-lock.mjs';
const PORT = process.argv[2] ?? '5212', name = 'claude: trunk zone', out = resolve(process.argv[3] ?? 'refs/forest-edge/trunk-zone');
const sleep = ms => new Promise(r => setTimeout(r, ms));
mkdirSync(out, { recursive: true });
if (!await acquire(name, { waitMs: 5 * 60 * 1000 })) throw Error('GPU busy');
let ws;
try {
  const p = spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', ['--headless=new', '--disable-extensions', '--no-first-run', '--remote-debugging-port=9471', `--user-data-dir=${'C:/dev/boreal-claude-edge'}`, 'about:blank'], { stdio: 'ignore' }); track(p.pid);
  let tabs; for (let i = 0; i < 40; i++) { try { tabs = await (await fetch('http://127.0.0.1:9471/json')).json(); break; } catch { await sleep(500); } }
  ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const pending = new Map(), errors = [];
  ws.onmessage = e => { const d = JSON.parse(e.data); if (d.id) { pending.get(d.id)?.(d.result); pending.delete(d.id); } if (d.method === 'Runtime.exceptionThrown') errors.push(d.params.exceptionDetails?.text); };
  const cdp = (method, params = {}) => new Promise((r, j) => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); setTimeout(() => { if (pending.delete(n)) j(Error(method + ' timeout')); }, 30000).unref(); });
  const ev = async expression => { const r = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails)); return r.result?.value; };
  await cdp('Runtime.enable'); await cdp('Page.enable'); await cdp('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  const shots = [];
  const go = async (url) => { await cdp('Page.navigate', { url }); let ok = false; for (let i = 0; i < 120; i++) { await sleep(1000); if (await ev("document.readyState==='complete' && !document.getElementById('loading')")) { ok = true; break; } } if (!ok) throw Error('not ready ' + url); await sleep(6000); };
  for (const [tag, extra] of [['default', ''], ['v2', '&trees=v2']]) {
    await go(`http://127.0.0.1:${PORT}/?nomenu&bench&hour=12&at=30,0,1.571${extra}`);
    for (let i = 0; i < 3; i++) { const s = await cdp('Page.captureScreenshot', { format: 'png' }); const f = `${tag}-${i}.png`; writeFileSync(`${out}/${f}`, Buffer.from(s.data, 'base64')); shots.push({ f, t: Date.now() }); await sleep(1000); }
  }
  writeFileSync(`${out}/observations.json`, JSON.stringify({ port: PORT, shots, errors }, null, 2)); console.log(JSON.stringify({ shots: shots.length, errors }));
} finally { ws?.close(); release(name); }
