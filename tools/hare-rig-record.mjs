// T-0009 rig-port recorder (Grok Bot): Edge via CDP, OFF-SCREEN window (GPU), 1280x800, against a separate Vite.
// node tools/hare-rig-record.mjs <base> <outDir> [slow=0.2] [skipPerf]
// slow: game-time scale while the staged clip records (performance.now + rAF time scaled in the page), so ~6-10 screenshots/s
// sample the 4.4 Hz bound densely; 1 = real time.
// 1. staged: one hare placed ~6 m ahead of the wolf, side-on; frames while it grazes, then the wolf walks/sprints at it (alert, bound).
// 2. perf: HARE.count raised, every hare moved into the near tier, wolf sprinting through them; HARE_RIG_STATS.ms per frame,
//    rig on (default near tier) vs off (INTEREST.near = 0: no hare rigged), plus fps.
import { spawn, execSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const sleep = ms => new Promise(r => setTimeout(r, ms));
// mode 'drive': the staged hare is driven (embodied-style) across the view
const [base, outDir, slowArg, skipPerf, mode] = process.argv.slice(2); const SLOW = Number(slowArg ?? .2); mkdirSync(join(outDir, 'frames'), { recursive: true });
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const port = 9500 + Math.floor(Math.random() * 90), profile = mkdtempSync(join(tmpdir(), 'grok-hareport-'));
const p = spawn(edge, ['--window-position=-32000,-32000', '--window-size=1280,800', '--no-first-run', '--disable-extensions', '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows', '--disable-background-timer-throttling', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
let id = 0; const pending = new Map(), errors = [], report = {}, log = [];
try {
  let t; for (let i = 0; i < 60; i++) { try { t = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (t.find(x => x.type === 'page')) break; } catch {} await sleep(500); }
  const ws = new WebSocket(t.find(x => x.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d.result ?? d); pending.delete(d.id); }
    if (d.method === 'Runtime.exceptionThrown') errors.push((d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text).slice(0, 300));
    if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') errors.push(d.params.args.map(a => a.value ?? a.description).join(' ').slice(0, 300)); };
  const cdp = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  await cdp('Runtime.enable'); await cdp('Page.enable');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 2, mobile: false }); // more pixels on a .45 m hare
  await cdp('Page.addScriptToEvaluateOnNewDocument', { source: `(() => { const pn = performance.now.bind(performance), raf = window.requestAnimationFrame.bind(window); let S = 1, r0 = pn(), v0 = r0;
    const now = () => v0 + (pn() - r0) * S; performance.now = now; window.requestAnimationFrame = cb => raf(() => cb(now()));
    window.__slow = s => { v0 = now(); r0 = pn(); S = s; return S; }; })()` });
  await cdp('Emulation.setFocusEmulationEnabled', { enabled: true });
  const ev = async e => { const r = await cdp('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(e.slice(0, 60) + ': ' + (r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)); return r.result?.value; };
  const KEY = { w: ['w', 'KeyW', 87], shift: ['Shift', 'ShiftLeft', 16] }; const down = new Set();
  const key = async (k, on) => { if (on === down.has(k)) return; on ? down.add(k) : down.delete(k); const [kk, code, vk] = KEY[k]; await cdp('Input.dispatchKeyEvent', { type: on ? 'keyDown' : 'keyUp', key: kk, code, windowsVirtualKeyCode: vk }); };
  const load = async url => { await cdp('Page.navigate', { url });
    for (let i = 0; i < 180; i++) { await sleep(1000); const s = await ev("document.getElementById('status')?.innerText ?? ''"); if (/Stamina \d+/.test(s) && await ev('!!globalThis.borealHares') && !(await ev("!!document.querySelector('.loading:not(.done), #loading:not([hidden])')"))) break; }
    await sleep(4000); };
  const mods = `(async () => { const u = performance.getEntriesByType('resource').map(e => e.name), f = n => u.filter(x => x.includes(n)).pop(); globalThis.__H = await import(f('/src/animals/hare.ts')); globalThis.__I = await import(f('/src/core/interest.ts')); return [!!__H.HARE, __I.INTEREST.near]; })()`;
  // per-frame sampler of the rig cost (HARE_RIG_STATS is written once per frame by the hare update)
  const sample = secs => ev(`new Promise(r => { const s = [], t0 = performance.now(); let n = 0; const f = () => { n++; const st = borealHares.stats; s.push([st.ms, st.rigged, st.locked]); if (performance.now() - t0 < ${secs * 1000}) requestAnimationFrame(f); else { const ms = s.map(x => x[0]).sort((a, b) => a - b), mean = ms.reduce((a, b) => a + b, 0) / ms.length;
    r({ frames: n, fps: n / ((performance.now() - t0) / 1000), meanMs: mean, p95Ms: ms[Math.floor(ms.length * .95)], maxMs: ms[ms.length - 1], rigged: Math.max(...s.map(x => x[1])), riggedMean: s.reduce((a, x) => a + x[1], 0) / s.length, lockedMax: Math.max(...s.map(x => x[2])) }); } }; requestAnimationFrame(f); })`);
  await load(`${base}/?nomenu&rec&hour=12`);
  report.modules = await ev(mods);
  report.baseline = await sample(4);
  // 1. staged hare near the camera
  const pl = await ev('window.__boreal.player()'); report.player = pl;
  const stage = (fwd, side, face) => ev(`(() => { const p = window.__boreal.player(), h = borealHares.list()[0]; if (!h) return null; const y = p.yaw, fx = -Math.sin(y), fz = -Math.cos(y), rx = -Math.cos(y), rz = Math.sin(y);
    h.sim.x = p.x + fx * ${fwd} + rx * ${side}; h.sim.z = p.z + fz * ${fwd} + rz * ${side}; h.sim.heading = y + ${face}; for (const o of borealHares.list().slice(1)) { o.sim.x = p.x + 60; o.sim.z = p.z + 60; } return { id: h.id, x: h.sim.x, z: h.sim.z }; })()`);
  report.slow = SLOW; await ev(`window.__slow(${SLOW})`); // slow from the staging on: the alert sit-up and the bolt come within ~1 game s
  if (mode === 'drive') { // the hare is marked controlled + embodied (the sim only senses it, the rig still poses it, the fore lock is always on)
    await ev(`(() => { const p = window.__boreal.player(), h = borealHares.list()[0], y = p.yaw, fx = -Math.sin(y), fz = -Math.cos(y), rx = -Math.cos(y), rz = Math.sin(y);
      h.sim.controlled = true; h.embodied = true; h.sim.state = 'flee'; const ox = p.x + fx * 3.5, oz = p.z + fz * 3.5, hd = Math.atan2(-rx, -rz);
      let t = 0, last = performance.now(); const prof = t => t < 1 ? 0 : t < 2.2 ? 2.5 : t < 3 ? 2.5 + (t - 2.2) / .8 * 6 : 8.5; // stand, half-bound 2.5 m/s, sprint 8.5 m/s
      let s = -6; h.sim.x = ox - rx * 6; h.sim.z = oz - rz * 6; h.sim.heading = hd;
      const step = () => { const now = performance.now(), dt = Math.min(.1, (now - last) / 1000); last = now; t += dt; const v = s < 7 ? prof(t) : 0; s += v * dt;
        h.sim.speed = v; h.sim.state = v > 0 ? 'flee' : 'graze'; h.sim.x = ox + rx * s; h.sim.z = oz + rz * s; h.sim.heading = hd; if (t < 12) requestAnimationFrame(step); };
      requestAnimationFrame(step); return 1; })()`);
    report.staged = await ev('(() => { const h = borealHares.list()[0]; return { id: h.id, x: h.sim.x, z: h.sim.z, driven: true }; })()');
  } else report.staged = await stage(2.5, 3, 0); // beside the wolf, so its flight (away from the wolf) crosses the view side-on
  let k = 0; const t0 = Date.now(); let phase = 'calm';
  while (Date.now() - t0 < 3000 + 3000 / SLOW) {
    const tt = (Date.now() - t0) / 1000;
    if (phase === 'calm' && tt > 3 && mode !== 'drive') { phase = 'walk'; await key('w', true); }
    if (phase === 'walk' && tt > 3 + .15 / SLOW) { phase = 'stop'; await key('w', false); } // a short step: the hare bolts, the camera stays nearly still
    const s = await cdp('Page.captureScreenshot', { format: 'jpeg', quality: 85 }); const name = `f${String(k++).padStart(4, '0')}.jpg`;
    writeFileSync(join(outDir, 'frames', name), Buffer.from(s.data, 'base64'));
    log.push({ name, t: +tt.toFixed(2), phase, hare: await ev(`(() => { const h = borealHares.list().find(x => x.id === ${report.staged?.id}); return h && { state: h.sim.state, speed: +h.sim.speed.toFixed(2), x: +h.x.toFixed(2), z: +h.z.toFixed(2), rig: !!h.rig, lock: !!h.rig?.foreLock }; })()`), player: await ev('window.__boreal.player()') });
  }
  for (const kk of [...down]) await key(kk, false); await ev('window.__slow(1)');
  // 2. perf: N hares, all in the near tier, wolf sprinting among them
  report.perf = [];
  if (!skipPerf) for (const N of [5, 12]) for (const rig of [true, false]) {
    await ev(`(() => { __H.HARE.count = ${N}; __I.INTEREST.near = ${rig ? '__I.INTEREST.near || 60' : 0}; return 1; })()`);
    const nearWas = await ev('__I.INTEREST.near'); if (rig && nearWas < 30) await ev('__I.INTEREST.near = 60');
    await sleep(1500);
    await ev(`(() => { const p = window.__boreal.player(), hs = borealHares.list(); hs.forEach((h, i) => { const a = i / hs.length * 6.283, d = 6 + (i % 4) * 4; h.sim.x = p.x + Math.sin(a) * d; h.sim.z = p.z + Math.cos(a) * d; }); return hs.length; })()`);
    await key('w', true); await key('shift', true); await sleep(500);
    const r = await sample(5); await key('w', false); await key('shift', false);
    r.N = await ev('borealHares.list().length'); r.rigOn = rig; r.near = await ev('__I.INTEREST.near'); report.perf.push(r); await sleep(1000);
  }
  await ev('__I.INTEREST.near = 60');
} finally {
  try { execSync(`taskkill /PID ${p.pid} /T /F`, { stdio: 'ignore' }); } catch {} // Edge first, whatever failed
  mkdirSync(outDir, { recursive: true }); writeFileSync(join(outDir, 'report.json'), JSON.stringify({ report, errors, log }, null, 1)); await sleep(1500); try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
console.log(JSON.stringify({ report, errors: errors.slice(0, 10), frames: log.length, states: log.map(l => `${l.t}:${l.phase}:${l.hare?.state}:${l.hare?.speed}:${l.hare?.rig ? 'R' : '-'}${l.hare?.lock ? 'L' : ''}`).join(' ') }, null, 1));