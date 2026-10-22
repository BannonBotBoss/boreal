// Glow pass cost (Grok Bot, T-0035): isolates render/targetGlow's OutlinePass on the PC GPU. Off-screen headless Edge loads a
// Vite-origin page (package.json, nothing else rendering), builds a 1280x720 WebGL renderer + the herb proxy, and times N frames of (scene clear + glow) against N
// frames of (scene clear only), each frame synchronised with a 1-pixel readPixels. node tools/glow-bench.mjs <base> [N=200]
import { spawn, execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const [base, N = '200'] = process.argv.slice(2);
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', port = 9400 + Math.floor(Math.random() * 90), profile = mkdtempSync(join(tmpdir(), 'grok-outline-'));
const p = spawn(edge, ['--headless=new', '--window-position=-32000,-32000', '--disable-gpu-vsync', '--disable-frame-rate-limit', '--window-size=1280,720', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
let id = 0; const pending = new Map();
try {
  let t; for (let i = 0; i < 60; i++) { try { t = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (t.find(x => x.type === 'page')) break; } catch {} await sleep(500); }
  const ws = new WebSocket(t.find(x => x.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d.result ?? d); pending.delete(d.id); } };
  const cdp = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  await cdp('Page.enable'); await cdp('Page.navigate', { url: `${base}/package.json` }); await sleep(8000);
  const r = await cdp('Runtime.evaluate', { awaitPromise: true, returnByValue: true, expression: `import('/tools/glowBench.ts').then(m => m.run(${+N})).catch(e => String(e))` }); console.log(JSON.stringify(r.result?.value ?? r.exceptionDetails?.exception?.description ?? r).slice(0, 1500));
  ws.close();
} finally { try { execSync(`taskkill /PID ${p.pid} /T /F`, { stdio: 'ignore' }); } catch {} await sleep(1500); try { rmSync(profile, { recursive: true, force: true }); } catch {} }