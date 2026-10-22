import { spawn } from 'node:child_process'; import { mkdtempSync, rmSync } from 'node:fs'; import { tmpdir } from 'node:os'; import { join } from 'node:path';
const sleep = ms => new Promise(r => setTimeout(r, ms)); const [url] = process.argv.slice(2);
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', port = 9500 + Math.floor(Math.random() * 90), profile = mkdtempSync(join(tmpdir(), 'grok-needs-'));
const p = spawn(edge, ['--headless=new', '--window-size=1280,800', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
try { let t; for (let i = 0; i < 60; i++) { try { t = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (t.find(x => x.type === 'page')) break; } catch {} await sleep(500); }
  const ws = new WebSocket(t.find(x => x.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.onopen = r); let id = 0; const pend = new Map();
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d.result ?? d); pend.delete(d.id); } };
  const cdp = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  await cdp('Page.enable'); await cdp('Page.navigate', { url }); await sleep(25000);
  const r = await cdp('Runtime.evaluate', { awaitPromise: true, returnByValue: true, expression: `(async () => { const W = await import('/src/core/needs/water.ts'); const e = await import('/src/core/stages/elevation.ts'); const sa = await import('/src/core/stages/surfaceAt.ts');
    const [sx, sz] = e.STAGES.on ? sa.dryStart(0, 0) : [0, 0]; const w = W.nearestWater(sx, sz, 600); if (!w) return { staged: e.STAGES.on, none: true };
    const d = Math.hypot(w.x - sx, w.z - sz), ux = (w.x - sx) / d, uz = (w.z - sz) / d, h = Math.atan2(-ux, -uz); let x = w.x, z = w.z;
    while (W.waterAt(x, z)) { x -= ux * .25; z -= uz * .25; } x -= ux * .4; z -= uz * .4;
    return { staged: e.STAGES.on, start: [sx, sz], water: [w.x, w.z], at: [+x.toFixed(2), +z.toFixed(2), +h.toFixed(3)], ahead: W.waterAhead(x, z, h), act: document.getElementById('act').textContent }; })()` });
  console.log(JSON.stringify(r.result?.value ?? r, null, 0));
} finally { p.kill(); await sleep(500); try { rmSync(profile, { recursive: true, force: true }); } catch {} }
