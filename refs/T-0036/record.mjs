// T-0036 hunt/thought recorder (Grok Bot): Edge via CDP, off-screen window (GPU), 1280x800.
// node --experimental-websocket hunt-record.mjs <branchBase> <mainBase> <outDir> [shots]
// shots: health (fps + hare states + console errors, branch and main), chase (scripted stalk -> sprint -> pounce), low, critical.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const [base, mainBase, outDir, onlyArg] = process.argv.slice(2); mkdirSync(outDir, { recursive: true });
const only = (onlyArg ?? 'health,chase,low,critical').split(',');
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const port = 9400 + Math.floor(Math.random() * 90), profile = mkdtempSync(join(tmpdir(), 'grok-hunt-'));
const p = spawn(edge, ['--window-position=-32000,-32000', '--window-size=1280,800', '--no-first-run', '--disable-extensions', '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows', '--disable-background-timer-throttling', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
let id = 0; const pending = new Map(), errors = [], report = {};
const log = [];
try {
  let t; for (let i = 0; i < 60; i++) { try { t = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (t.find(x => x.type === 'page')) break; } catch {} await sleep(500); }
  const ws = new WebSocket(t.find(x => x.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let page = '';
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d.result ?? d); pending.delete(d.id); }
    if (d.method === 'Runtime.exceptionThrown') errors.push({ page, e: (d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text).slice(0, 300) });
    if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') errors.push({ page, e: d.params.args.map(a => a.value ?? a.description).join(' ').slice(0, 300) }); };
  const cdp = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  await cdp('Runtime.enable'); await cdp('Page.enable');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  const ev = async e => { const r = await cdp('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(e.slice(0, 60) + ': ' + (r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)); return r.result?.value; };
  const KEY = { w: ['w', 'KeyW', 87], a: ['a', 'KeyA', 65], d: ['d', 'KeyD', 68], c: ['c', 'KeyC', 67], shift: ['Shift', 'ShiftLeft', 16], space: [' ', 'Space', 32] };
  const down = new Set();
  const key = async (k, on) => { if (on === down.has(k)) return; on ? down.add(k) : down.delete(k); const [kk, code, vk] = KEY[k];
    await cdp('Input.dispatchKeyEvent', { type: on ? 'keyDown' : 'keyUp', key: kk, code, windowsVirtualKeyCode: vk }); };
  const load = async (url) => {
    page = url; await cdp('Page.navigate', { url });
    for (let i = 0; i < 150; i++) { await sleep(1000); const s = await ev("document.getElementById('status')?.innerText ?? ''"); if (/Stamina \d+/.test(s) && !(await ev("!!document.querySelector('.loading:not(.done), #loading:not([hidden])')"))) break; }
    await sleep(3000);
  };
  const fps = () => ev(`new Promise(r => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 8000) requestAnimationFrame(f); else r(n / ((performance.now() - t0) / 1000)); }; requestAnimationFrame(f); })`);
  let frameNo = 0;
  const snap = async (name, extra = {}) => { const s = await cdp('Page.captureScreenshot', { format: 'jpeg', quality: 82 }); const f = `${name}-${String(frameNo++).padStart(4, '0')}.jpg`;
    writeFileSync(join(outDir, f), Buffer.from(s.data, 'base64')); log.push({ shot: name, frame: f, t: Date.now(), status: await ev("document.getElementById('status')?.innerText"), ...extra }); };
  if (only.includes('health')) {
    for (const [name, b] of [['main', mainBase], ['branch', base]]) {
      await load(b + '?nomenu&rec'); const f = await fps(); const states = {};
      const hasProbe = await ev('!!window.__boreal');
      for (let i = 0; i < 40 && hasProbe; i++) { const hs = await ev('window.__boreal.hares()'); for (const h of hs) states[h.state] = (states[h.state] ?? 0) + 1; await sleep(500); }
      const hs = hasProbe ? await ev('window.__boreal.hares()') : null;
      report[name] = { fps: f, hareStateSamples: states, hares: hs };
      frameNo = 0; await snap(`health-${name}`);
    }
    // flee check on the branch: walk (not stalk) at the nearest hare for 8 s
    const hs0 = await ev('window.__boreal.hares()'); const bolts = [];
    await key('w', true); for (let i = 0; i < 40; i++) { const hs = await ev('window.__boreal.hares()'); for (const h of hs) if (h.state === 'flee' && !bolts.includes(h.id)) bolts.push(h.id); await sleep(200); } await key('w', false);
    report.walkFlee = { hares: hs0.length, fled: bolts.length };
  }
  if (only.includes('chase')) {
    report.chase = [];
    for (let attempt = 0; attempt < 6; attempt++) {
      await load(base + '?nomenu&rec&needs=water:40,energy:30'); frameNo = 0;
      const name = `chase${attempt}`; const t0 = Date.now(); let target, phase = 'stalk', caught = false, jumped = 0, before = await ev('window.__boreal.player()');
      const events = [];
      while (Date.now() - t0 < 60000) {
        const pl = await ev('window.__boreal.player()'), hs = await ev('window.__boreal.hares()');
        let h = hs.find(x => x.id === target);
        if (!h) { if (target !== undefined) { caught = true; events.push({ t: Date.now() - t0, e: 'target gone (caught?)' }); break; } h = hs.filter(x => x.state !== 'flee').sort((a, b) => Math.hypot(a.x - pl.x, a.z - pl.z) - Math.hypot(b.x - pl.x, b.z - pl.z))[0]; target = h?.id; if (!h) { await sleep(300); continue; } }
        const d = Math.hypot(h.x - pl.x, h.z - pl.z), want = Math.atan2(h.x - pl.x, h.z - pl.z) + Math.PI, diff = Math.atan2(Math.sin(want - pl.yaw), Math.cos(want - pl.yaw));
        await key('a', diff > .08); await key('d', diff < -.08); await key('w', true);
        if (phase === 'stalk' && (h.state === 'flee' || d < 3)) { phase = 'sprint'; events.push({ t: Date.now() - t0, e: `bolt at ${d.toFixed(1)} m`, linked: h.linked }); await key('c', false); await key('shift', false); await sleep(60); await key('shift', true); await sleep(60); await key('c', true); }
        if (phase === 'stalk') { await key('c', true); }
        if (phase === 'sprint' && d < 3.2 && Date.now() - jumped > 1600) { jumped = Date.now(); await key('space', true); await sleep(80); await key('space', false); events.push({ t: Date.now() - t0, e: `pounce at ${d.toFixed(1)} m` }); }
        await snap(name, { d, phase, hares: hs.map(x => [x.id, +x.x.toFixed(1), +x.z.toFixed(1), x.state, x.knows]), target });
        if (phase === 'sprint' && d > 30) { events.push({ t: Date.now() - t0, e: 'escaped' }); break; }
      }
      for (const k of [...down]) await key(k, false);
      for (let i = 0; i < 12; i++) { await snap(name, { after: true }); await sleep(200); }
      const after = await ev('window.__boreal.player()');
      report.chase.push({ attempt, caught, events, before, after, frames: frameNo });
      if (caught) break;
    }
  }
  for (const [name, q] of [['low', 'water:25'], ['critical', 'water:8']]) {
    if (!only.includes(name)) continue;
    await load(base + `?nomenu&rec&needs=${q}`); frameNo = 0; const t0 = Date.now();
    while (Date.now() - t0 < 24000) { await snap(name); await sleep(120); }
  }
} finally {
  writeFileSync(join(outDir, 'report.json'), JSON.stringify({ report, errors, log }, null, 1));
  p.kill(); await sleep(800); try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
console.log(JSON.stringify({ report: { ...report, chase: report.chase?.map(c => ({ attempt: c.attempt, caught: c.caught, events: c.events, before: c.before, after: c.after })) }, errors: errors.slice(0, 10) }, null, 1));
