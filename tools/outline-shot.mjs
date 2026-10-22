// Target-outline shots (Grok Bot, T-0035): headless Edge (GPU on), loads <base>/?nomenu&at=..., waits for streaming,
// screenshots, then records frame times for `secs`. node tools/outline-shot.mjs <base> <out dir> <label=x,z,yaw;...> [secs=5] [extra query]
import { spawn, execSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const [base, outDir, spec, secs = '5', extra = ''] = process.argv.slice(2); mkdirSync(outDir, { recursive: true });
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', port = 9300 + Math.floor(Math.random() * 90), profile = mkdtempSync(join(tmpdir(), 'grok-outline-'));
const p = spawn(edge, ['--headless=new', '--disable-gpu-vsync', '--disable-frame-rate-limit', '--window-size=1280,720', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--disable-background-timer-throttling', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
let id = 0; const pending = new Map(), errors = [], out = [];
try {
  let t; for (let i = 0; i < 60; i++) { try { t = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (t.find(x => x.type === 'page')) break; } catch {} await sleep(500); }
  const ws = new WebSocket(t.find(x => x.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d.result ?? d); pending.delete(d.id); }
    if (d.method === 'Runtime.exceptionThrown') errors.push((d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text).slice(0, 300));
    if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') errors.push(d.params.args.map(a => a.value ?? a.description).join(' ').slice(0, 200)); };
  const cdp = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async e => (await cdp('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.value;
  await cdp('Runtime.enable'); await cdp('Page.enable'); await cdp('Page.bringToFront'); await cdp('Emulation.setFocusEmulationEnabled', { enabled: true });
  for (const item of spec.split(';')) {
    const [label, at] = item.split('=');
    await cdp('Page.navigate', { url: `${base}/?nomenu&at=${at}${extra}` });
    for (let i = 0; i < +(process.env.MAXWAIT ?? 180); i++) { await sleep(1000); if (await ev(`document.readyState === 'complete' && !document.getElementById('loading')`)) break; }
    await sleep(7000);
    // HOLD=f[,w]:secs : hold keys (focus, forward) before the shot; records the heading change while held
    const hold = process.env.HOLD ? process.env.HOLD.split(':') : null, held = hold ? hold[0].split(',') : [];
    const KEY = { f: ['f', 'KeyF', 70], w: ['w', 'KeyW', 87] }; let statusHeld;
    for (const k of held) await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: KEY[k][0], code: KEY[k][1], windowsVirtualKeyCode: KEY[k][2] });
    if (hold) { await sleep(+hold[1] * 1000); statusHeld = await ev(`document.getElementById('status')?.innerText`); }
    const s = await cdp('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(outDir, `${label}.png`), Buffer.from(s.data, 'base64'));
    for (const k of held) await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: KEY[k][0], code: KEY[k][1], windowsVirtualKeyCode: KEY[k][2] });
    const statusAfter = hold ? await ev(`new Promise(r => setTimeout(() => r(document.getElementById('status')?.innerText), 500))`) : undefined;
    await ev(`(() => { window.__ft = []; let last = performance.now(); const loop = t => { window.__ft.push(t - last); last = t; requestAnimationFrame(loop); }; requestAnimationFrame(loop); })()`);
    await sleep(+secs * 1000);
    const d = await ev(`({ ft: window.__ft.slice(), target: document.getElementById('target')?.textContent })`);
    const ft = d.ft.slice(2).sort((a, b) => a - b), q = k => +ft[Math.floor(k * (ft.length - 1))].toFixed(2);
    out.push({ label, at, target: d.target, statusHeld: hold ? statusHeld : undefined, statusAfter, n: ft.length, p50: q(.5), p90: q(.9), mean: +(ft.reduce((a, b) => a + b, 0) / ft.length).toFixed(2) });
  }
  ws.close();
} finally { try { execSync(`taskkill /PID ${p.pid} /T /F`, { stdio: 'ignore' }); } catch {} await sleep(1500); try { rmSync(profile, { recursive: true, force: true }); } catch {} }
writeFileSync(join(outDir, 'frames.json'), JSON.stringify({ base, extra, out, errors: errors.slice(0, 5) }, null, 1));
console.log(JSON.stringify({ out, errors: errors.slice(0, 5) }));