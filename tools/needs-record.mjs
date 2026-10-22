// T-0036 recorder (Grok Bot): headless Edge via CDP, 1280x800. node needs-record.mjs <base> <outDir>
// Each shot: load base+query, wait for the world, then a burst of JPEG frames with per-frame HUD text.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const [base, outDir] = process.argv.slice(2); mkdirSync(outDir, { recursive: true });
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const SHOTS = [
  ['drink', '?nomenu&at=14.37,7.53,2.02&needs=water:22', 8000, true],
  ['low', '?nomenu&needs=water:25', 40000],
  ['stagger', '?nomenu&needs=water:20,energy:15,rest:25', 40000],
];
const only = process.argv[4]; if (only) SHOTS.splice(0, SHOTS.length, ...SHOTS.filter(s => only.split(',').includes(s[0])));
const port = 9400 + Math.floor(Math.random() * 90), profile = mkdtempSync(join(tmpdir(), 'grok-needs-'));
const p = spawn(edge, ['--headless=new', '--disable-extensions', '--window-size=1280,800', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--disable-background-timer-throttling', '--enable-unsafe-swiftshader', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
let id = 0; const pending = new Map(), errors = [];
const log = [];
try {
  let t; for (let i = 0; i < 60; i++) { try { t = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (t.find(x => x.type === 'page')) break; } catch {} await sleep(500); }
  const ws = new WebSocket(t.find(x => x.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d.result ?? d); pending.delete(d.id); }
    if (d.method === 'Runtime.exceptionThrown') errors.push((d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text).slice(0, 300)); };
  const cdp = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  await cdp('Runtime.enable'); await cdp('Page.enable');
  const ev = async e => (await cdp('Runtime.evaluate', { expression: e, returnByValue: true })).result?.value;
  for (const [name, q, burst, press] of SHOTS) {
    await cdp('Page.navigate', { url: base + q });
    // wait for the loading screen to finish (status line shows the HUD)
    for (let i = 0; i < 120; i++) { await sleep(1000); const s = await ev("document.getElementById('status')?.innerText ?? ''"); if (/Water \d+%/.test(s) && !(await ev("!!document.querySelector('.loading:not(.done), #loading:not([hidden])')"))) break; }
    await sleep(2500);
    if (press) { log.push({ shot: name, before: await ev("document.getElementById('act')?.textContent") }); await ev("document.getElementById('act').click()"); }
    const t0 = Date.now(); let n = 0;
    while (Date.now() - t0 < burst) {
      const shot = await cdp('Page.captureScreenshot', { format: 'jpeg', quality: 80 });
      const f = `${name}-${String(n).padStart(3, '0')}.jpg`; writeFileSync(join(outDir, f), Buffer.from(shot.data, 'base64'));
      log.push({ shot: name, frame: f, ms: Date.now() - t0, status: await ev("document.getElementById('status')?.innerText"), act: await ev("document.getElementById('act')?.textContent") });
      n++; await sleep(150);
    }
  }
} finally {
  writeFileSync(join(outDir, 'frames.json'), JSON.stringify({ log, errors }, null, 1));
  p.kill(); await sleep(800); try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
console.log('frames', log.length, 'errors', errors.length);
