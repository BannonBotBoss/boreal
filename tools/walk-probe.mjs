// Walk probe (Grok Bot): drives the default game wolf in headless Edge (?walkprobe) and measures what is drawn.
// node tools/walk-probe.mjs <base url> <out.json> [label] [extra query, e.g. &loco=1]. Modes: stealth (C), walk (W), run (Shift+W). Prints a summary.
import { spawn, execSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const [base = 'http://127.0.0.1:5199', out = 'walk-probe.json', label = '', query = ''] = process.argv.slice(2);
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', port = 9300 + Math.floor(Math.random() * 90), profile = mkdtempSync(join(tmpdir(), 'grok-walkprobe-'));
const p = spawn(edge, ['--headless=new', '--disable-gpu-vsync', '--disable-frame-rate-limit', '--window-size=1280,720', '--autoplay-policy=no-user-gesture-required', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--disable-background-timer-throttling', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
let id = 0; const pending = new Map(), errors = [];
const result = { label, base, modes: {} };
try {
  let t; for (let i = 0; i < 60; i++) { try { t = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (t.find(x => x.type === 'page')) break; } catch {} await sleep(500); }
  const ws = new WebSocket(t.find(x => x.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d.result ?? d); pending.delete(d.id); }
    if (d.method === 'Runtime.exceptionThrown') errors.push((d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text).slice(0, 300));
    if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') errors.push(d.params.args.map(a => a.value ?? a.description).join(' ').slice(0, 300)); };
  const cdp = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async e => (await cdp('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.value;
  const key = (type, k, code, vk, mod = 0) => cdp('Input.dispatchKeyEvent', { type, key: k, code, windowsVirtualKeyCode: vk, modifiers: mod });
  await cdp('Runtime.enable'); await cdp('Page.enable'); await cdp('Page.bringToFront'); await cdp('Emulation.setFocusEmulationEnabled', { enabled: true });
  await cdp('Page.navigate', { url: `${base}/?nomenu&walkprobe&hour=11${query}` });
  for (let i = 0; i < 180; i++) { await sleep(1000); if (await ev(`document.readyState === 'complete' && !document.getElementById('loading') && !!window.walkProbe`)) break; }
  await sleep(4000);
  await key('keyDown', 'x', 'KeyX', 88); await key('keyUp', 'x', 'KeyX', 88); // a user gesture: starts the audio context
  await sleep(1500);
  const modes = [['stealth', [['c', 'KeyC', 67]]], ['walk', []], ['run', [['Shift', 'ShiftLeft', 16]]]];
  for (const [mode, held] of modes) {
    const mod = mode === 'run' ? 8 : 0;
    for (const [k, c, v] of held) await key('keyDown', k, c, v, mod);
    await key('keyDown', mode === 'run' ? 'W' : 'w', 'KeyW', 87, mod);
    await sleep(2500); // accelerate to steady speed
    await ev('walkProbe.clear()');
    await sleep(4000);
    const data = await ev('({ frames: walkProbe.frames.slice(), steps: walkProbe.steps.slice(), audio: (() => { try { return !!document.querySelector("canvas") } catch { return false } })() })');
    await key('keyUp', mode === 'run' ? 'W' : 'w', 'KeyW', 87, 0);
    for (const [k, c, v] of held) await key('keyUp', k, c, v, 0);
    await sleep(2000);
    result.modes[mode] = data;
  }
  ws.close();
} finally { try { execSync(`taskkill /PID ${p.pid} /T /F`, { stdio: 'ignore' }); } catch { p.kill(); } /* whole Edge tree */ await sleep(1500); try { rmSync(profile, { recursive: true, force: true }); } catch {} }
result.errors = errors;

// ---- analysis ----
const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
const rms = a => Math.sqrt(mean(a.map(x => x * x)));
function spectrum(ts, ys, rate = 240) { // zero-order-hold resample (what the screen shows), detrend, DFT peak 0.5..60 Hz
  const t0 = ts[0], t1 = ts[ts.length - 1], n = Math.floor((t1 - t0) * rate); if (n < 32) return { hz: 0, amp: 0 };
  const r = []; let j = 0; for (let i = 0; i < n; i++) { const t = t0 + i / rate; while (j + 1 < ts.length && ts[j + 1] <= t) j++; r.push(ys[j]); }
  const m = mean(r); const d = r.map(x => x - m); let best = { hz: 0, amp: 0 };
  for (let f = .5; f <= 60; f += .25) { let re = 0, im = 0; for (let i = 0; i < n; i++) { const a = 2 * Math.PI * f * i / rate; re += d[i] * Math.cos(a); im -= d[i] * Math.sin(a); } const amp = 2 * Math.hypot(re, im) / n; if (amp > best.amp) best = { hz: f, amp }; }
  return best;
}
const detrend = (ts, ys, win = .5) => ys.map((y, i) => { const a = ys.filter((_, k) => Math.abs(ts[k] - ts[i]) <= win / 2); return y - mean(a); });
const summary = {};
for (const [mode, d] of Object.entries(result.modes)) {
  const f = d.frames; if (f.length < 10) { summary[mode] = { frames: f.length }; continue; }
  const ts = f.map(x => x.t / 1000), T = ts[ts.length - 1] - ts[0], simT = f[f.length - 1].sim - f[0].sim;
  const dist = f.slice(1).reduce((s, x, i) => s + Math.hypot(x.bx - f[i].bx, x.bz - f[i].bz), 0);
  const speed = dist / simT, phaseRate = (f[f.length - 1].phase - f[0].phase) / simT;
  const dir = { x: f[f.length - 1].bx - f[0].bx, z: f[f.length - 1].bz - f[0].bz }, L = Math.hypot(dir.x, dir.z) || 1; dir.x /= L; dir.z /= L;
  const along = f.map(x => (x.bx - f[0].bx) * dir.x + (x.bz - f[0].bz) * dir.z), lat = f.map(x => (x.bx - f[0].bx) * -dir.z + (x.bz - f[0].bz) * dir.x);
  const step = along.slice(1).map((a, i) => a - along[i]), still = step.filter(s => Math.abs(s) < 1e-6).length / step.length;
  const alongErr = detrend(ts, along, .25), byd = detrend(ts, f.map(x => x.by)), cyd = detrend(ts, f.map(x => x.cy)), latd = detrend(ts, lat);
  const gaps = d.steps.slice(1).map((s, i) => (s.t - d.steps[i].t) / 1000);
  summary[mode] = {
    frames: f.length, fps: +(f.length / T).toFixed(1), simPerReal: +(simT / T).toFixed(3), gait: [...new Set(f.map(x => x.gait))].join('/'),
    speed: +speed.toFixed(2), cost: +mean(f.map(x => x.cost)).toFixed(3), cadenceHz: +phaseRate.toFixed(2), strideM: +(speed / phaseRate).toFixed(2),
    framesWithoutBodyMotionPct: +(100 * still).toFixed(1), forwardJudderRmsMm: +(1000 * rms(alongErr)).toFixed(1), forwardJudder: spectrum(ts, alongErr),
    bodyYRmsMm: +(1000 * rms(byd)).toFixed(1), bodyY: spectrum(ts, byd), lateralRmsMm: +(1000 * rms(latd)).toFixed(1),
    cameraYRmsMm: +(1000 * rms(cyd)).toFixed(1), cameraY: spectrum(ts, cyd),
    footstepsPerSec: +(d.steps.length / T).toFixed(2), footstepGapMs: gaps.length ? { min: Math.round(1000 * Math.min(...gaps)), mean: Math.round(1000 * mean(gaps)), max: Math.round(1000 * Math.max(...gaps)) } : null,
    footfallsPerSecExpected: +(4 * phaseRate * simT / T).toFixed(2),
  };
}
result.summary = summary;
writeFileSync(out, JSON.stringify(result));
console.log(JSON.stringify({ label, summary, errors: errors.slice(0, 5) }, null, 1));

