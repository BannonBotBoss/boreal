// Night run probe (Grok Bot): headless Edge, ?walkprobe, holds Shift+W (run) for `secs`, records frame times, the drawn
// wolf/camera per frame, and screenshot luminance. node tools/night-run.mjs <base> <query> <out prefix> [secs=8] [turn=0]
import { spawn, execSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const [base, query, out, secs = '8'] = process.argv.slice(2);
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', port = 9200 + Math.floor(Math.random() * 90), profile = mkdtempSync(join(tmpdir(), 'grok-nightrun-'));
const p = spawn(edge, ['--headless=new', '--disable-gpu-vsync', '--disable-frame-rate-limit', '--window-size=1280,720', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--disable-background-timer-throttling', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
let id = 0; const pending = new Map(), errors = [], logs = [];
const res = { query };
try {
  let t; for (let i = 0; i < 60; i++) { try { t = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (t.find(x => x.type === 'page')) break; } catch {} await sleep(500); }
  const ws = new WebSocket(t.find(x => x.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d.result ?? d); pending.delete(d.id); }
    if (d.method === 'Runtime.exceptionThrown') errors.push((d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text).slice(0, 300));
    if (d.method === 'Runtime.consoleAPICalled') { const s = d.params.args.map(a => a.value ?? a.description).join(' ').slice(0, 200); if (d.params.type === 'error') errors.push(s); else if (!/X3595|\[vite\]/.test(s)) logs.push(s); } };
  const cdp = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async e => (await cdp('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.value;
  const key = (type, k, code, vk, mod = 0) => cdp('Input.dispatchKeyEvent', { type, key: k, code, windowsVirtualKeyCode: vk, modifiers: mod });
  const lum = async label => { const s = await cdp('Page.captureScreenshot', { format: 'png' }); writeFileSync(`${out}-${label}.png`, Buffer.from(s.data, 'base64'));
    return ev(`new Promise(r => { const im = new Image(); im.onload = () => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height).data, L = x => { x /= 255; return x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4; };
      const stat = (y0, y1, x0 = 0, x1 = 1) => { let s = 0, s8 = 0, n = 0, dark = 0; for (let y = Math.floor(y0 * c.height); y < y1 * c.height; y += 2) for (let x = Math.floor(x0 * c.width); x < x1 * c.width; x += 2) { const i = (y * c.width + x) * 4, l = .2126 * L(d[i]) + .7152 * L(d[i + 1]) + .0722 * L(d[i + 2]), v = .299 * d[i] + .587 * d[i + 1] + .114 * d[i + 2]; s += l; s8 += v; n++; if (v < 8) dark++; } return { relLum: +(s / n).toFixed(5), luma8: +(s8 / n).toFixed(1), darkPct: +(100 * dark / n).toFixed(1) }; };
      r({ all: stat(0, 1), ground: stat(.6, 1), wolf: stat(.55, .95, .4, .6), sky: stat(0, .25) }); }; im.src = 'data:image/png;base64,${s.data}'; })`); };
  await cdp('Runtime.enable'); await cdp('Page.enable'); await cdp('Page.bringToFront'); await cdp('Emulation.setFocusEmulationEnabled', { enabled: true });
  await cdp('Page.navigate', { url: `${base}/?nomenu&walkprobe${query}` });
  for (let i = 0; i < 180; i++) { await sleep(1000); if (await ev(`document.readyState === 'complete' && !document.getElementById('loading') && !!window.walkProbe`)) break; }
  await sleep(5000);
  res.lumStart = await lum('start');
  res.light = await ev(`(async () => { const u = performance.getEntriesByType('resource').map(e => e.name); const f = n => u.filter(x => x.includes(n)).pop(); const L = (await import(f('/src/render/pbr.ts') ?? '/src/render/pbr.ts')).LIGHTING; return { ...L }; })()`);
  await ev(`(() => { window.__ft = []; let last = performance.now(); const loop = t => { window.__ft.push(t - last); last = t; requestAnimationFrame(loop); }; requestAnimationFrame(loop); })()`);
  await ev('walkProbe.clear()');
  await key('keyDown', 'Shift', 'ShiftLeft', 16, 8); await key('keyDown', 'W', 'KeyW', 87, 8);
  await sleep(+secs * 500); res.lumMid = await lum('mid'); await sleep(+secs * 500);
  const data = await ev('({ frames: walkProbe.frames.slice(), ft: window.__ft.slice(), status: document.getElementById("status")?.textContent })');
  await key('keyUp', 'W', 'KeyW', 87, 0); await key('keyUp', 'Shift', 'ShiftLeft', 16, 0);
  res.lumEnd = await lum('end'); res.status = data.status;
  const f = data.frames, ft = data.ft.slice(2).sort((a, b) => a - b), q = k => +ft[Math.floor(k * (ft.length - 1))].toFixed(1);
  res.frameMs = { n: ft.length, p50: q(.5), p90: q(.9), p99: q(.99), max: q(1), fps: +(1000 * ft.length / data.ft.slice(2).reduce((s, x) => s + x, 0)).toFixed(1) };
  if (f.length > 2) {
    const T = (f[f.length - 1].t - f[0].t) / 1000, S = f[f.length - 1].sim - f[0].sim, d = Math.hypot(f[f.length - 1].bx - f[0].bx, f[f.length - 1].bz - f[0].bz);
    let path = 0, back = 0, stall = 0; const dir = { x: (f[f.length - 1].bx - f[0].bx) / (d || 1), z: (f[f.length - 1].bz - f[0].bz) / (d || 1) };
    for (let i = 1; i < f.length; i++) { const dx = f[i].bx - f[i - 1].bx, dz = f[i].bz - f[i - 1].bz; path += Math.hypot(dx, dz); if (dx * dir.x + dz * dir.z < -1e-4) back++; if (Math.hypot(dx, dz) < 1e-6) stall++; }
    res.motion = { realS: +T.toFixed(2), simS: +S.toFixed(2), simPerReal: +(S / T).toFixed(2), netM: +d.toFixed(2), pathM: +path.toFixed(2), speedNet: +(d / T).toFixed(2), gaitSpeedEnd: +f[f.length - 1].speed.toFixed(2), framesBackward: back, framesNoMove: stall, frames: f.length,
      start: [f[0].bx, f[0].bz].map(v => +v.toFixed(1)), end: [f[f.length - 1].bx, f[f.length - 1].bz].map(v => +v.toFixed(1)) };
    let cback = 0; for (let i = 1; i < f.length; i++) { const dx = f[i].cx - f[i - 1].cx, dz = f[i].cz - f[i - 1].cz; if (dx * dir.x + dz * dir.z < -1e-4) cback++; } res.motion.cameraFramesBackward = cback;
  }
  writeFileSync(`${out}.json`, JSON.stringify({ ...res, frames: f, ft: data.ft }));
  ws.close();
} finally { try { execSync(`taskkill /PID ${p.pid} /T /F`, { stdio: 'ignore' }); } catch {} await sleep(1500); try { rmSync(profile, { recursive: true, force: true }); } catch {} }
res.errors = errors.slice(0, 5); res.logs = logs.slice(0, 6);
console.log(JSON.stringify(res));

