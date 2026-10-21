// node tools/strip-shot.mjs <url> <out.png> [width height]: headless Edge screenshot of a page that sets document.title = 'ready'.
// The Edge process tree is always killed (taskkill /T /F) and its temp profile removed, in finally. A page that sets
// globalThis.pageResult gets it printed as `result` (tools/fur-cost.html); EDGE_FLAGS adds Edge switches (e.g. the GPU flags of smoke-tiers).
import { spawn, execSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const [url, out, w = '1200', h = '520'] = process.argv.slice(2);
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', port = 9400 + Math.floor(Math.random() * 90), profile = mkdtempSync(join(tmpdir(), 'grok-strip-'));
const p = spawn(edge, [...(process.env.EDGE_FLAGS ? process.env.EDGE_FLAGS.split(' ') : []), '--headless=new', `--window-size=${w},${h}`, '--hide-scrollbars', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
let id = 0; const pending = new Map(); const errors = [];
try {
  let t; for (let i = 0; i < 60; i++) { try { t = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (t.find(x => x.type === 'page')) break; } catch {} await sleep(500); }
  const ws = new WebSocket(t.find(x => x.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d.result ?? d); pending.delete(d.id); }
    if (d.method === 'Runtime.exceptionThrown') errors.push(d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text); };
  const cdp = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  await cdp('Runtime.enable'); await cdp('Page.enable'); await cdp('Emulation.setDeviceMetricsOverride', { width: +w, height: +h, deviceScaleFactor: 1, mobile: false }); await cdp('Page.navigate', { url });
  let ok = false; for (let i = 0; i < 120; i++) { await sleep(500); const r = await cdp('Runtime.evaluate', { expression: 'document.title', returnByValue: true }); if (r.result?.value === 'ready') { ok = true; break; } }
  await sleep(300);
  const s = await cdp('Page.captureScreenshot', { format: 'png' }); writeFileSync(out, Buffer.from(s.data, 'base64'));
  const result = (await cdp('Runtime.evaluate', { expression: 'globalThis.pageResult ?? null', returnByValue: true })).result?.value;
  console.log(JSON.stringify({ ok, out, errors: errors.slice(0, 3), ...(result ? { result } : {}) })); ws.close();
} finally { try { execSync(`taskkill /PID ${p.pid} /T /F`, { stdio: 'ignore' }); } catch {} await sleep(1500); try { rmSync(profile, { recursive: true, force: true }); } catch {} }
