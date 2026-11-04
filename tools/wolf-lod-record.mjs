// Wolf LOD evidence recorder (Grok Bot): Edge via CDP, OFF-SCREEN window, against a separate Vite.
// node tools/wolf-lod-record.mjs <base> <outDir>
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const [base, outDir, extra = '', only = ''] = process.argv.slice(2);
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const port = 9600 + Math.floor(Math.random() * 90), profile = mkdtempSync(join(tmpdir(), 'grok-wolflod-'));
const p = spawn(edge, ['--window-position=-32000,-32000', '--window-size=1280,720', '--no-first-run', '--disable-extensions', '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows', '--disable-background-timer-throttling', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
let id = 0; const pending = new Map(), errors = [], report = { pid: p.pid };
try {
  let t; for (let i = 0; i < 60; i++) { try { t = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (t.find(x => x.type === 'page')) break; } catch {} await sleep(500); }
  const ws = new WebSocket(t.find(x => x.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d.result ?? d); pending.delete(d.id); }
    if (d.method === 'Runtime.exceptionThrown') errors.push((d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text).slice(0, 300));
    if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') errors.push(d.params.args.map(a => a.value ?? a.description).join(' ').slice(0, 300)); };
  const cdp = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  await cdp('Runtime.enable'); await cdp('Page.enable');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  const ev = async e => { const r = await cdp('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(e.slice(0, 60) + ': ' + (r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)); return r.result?.value; };
  const snap = async (dir, name) => { const s = await cdp('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(dir, name), Buffer.from(s.data, 'base64')); };
  for (const [shot, secs, every, stills] of [['gait', 12, 1, [2, 6, 10]], ['ladder', 4, 2, [1, 3]], ['mid', 3, 3, [1, 2.5]]].filter(r => !only || only.split(',').includes(r[0]))) {
    const dir = join(outDir, shot); mkdirSync(join(dir, 'frames'), { recursive: true });
    await cdp('Page.navigate', { url: `${base}/tools/wolf-lod-view.html?shot=${shot}${extra}` });
    for (let i = 0; i < 120 && !(await ev('!!window.__ready').catch(() => false)); i++) await sleep(500);
    const log = []; let k = 0; const dt = 1 / 30;
    for (let n = 0; n < secs * 30; n++) {
      const info = await ev(`window.__step(${dt})`); log.push(info);
      if (n % every === 0) await snap(join(dir, 'frames'), `f${String(k++).padStart(4, '0')}.png`);
      for (const s of stills) if (Math.abs(n * dt - s) < dt / 2) await snap(dir, `still-${s}s.png`);
    }
    writeFileSync(join(dir, 'log.json'), JSON.stringify(log));
    report[shot] = { frames: k, last: log[log.length - 1] };
  }
  // real-time per-wolf cost in the page: 300 steps, wolves.us / count
  await cdp('Page.navigate', { url: `${base}/tools/wolf-lod-view.html?shot=ladder` });
  for (let i = 0; i < 120 && !(await ev('!!window.__ready').catch(() => false)); i++) await sleep(500);
  report.cost = await ev(`(() => { const rows = []; for (let n = 0; n < 300; n++) { const i = window.__step(1/60); if (n > 30) rows.push({ ...i.wolves, sync: i.syncUs }); } const sum = k => rows.reduce((a, r) => a + r[k], 0) / rows.length; const ss = rows.map(r => r.sync).sort((a, b) => a - b); return { near: sum('near'), mid: sum('mid'), far: sum('far'), syncMeanUs: sum('sync'), syncP95Us: ss[Math.floor(ss.length * .95)] }; })()`);
  report.errors = errors;
} catch (e) { report.fatal = String(e); report.errors = errors; }
finally { try { p.kill(); } catch {} await sleep(800); try { rmSync(profile, { recursive: true, force: true }); } catch {} }
writeFileSync(join(outDir, 'report.json'), JSON.stringify(report, null, 1)); console.log(JSON.stringify(report).slice(0, 2000));