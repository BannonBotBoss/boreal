// T-0044 run 12 (grok-gait): close-up side-on copy of tools/hare-rig-record.mjs (Grok Bot's recorder, drive mode). Same off-screen Edge
// (--window-position=-32000,-32000), takes the omen bench lock (tools/bench-lock.mjs) and kills its own Edge when done.
// Camera option (this copy only): a second three.js renderer on the page's own scene, a narrow camera `dist` m to the hare's side at hare
// height, following it, so the hare fills the frame. The driven hare: stand .5 s, ramp to V m/s over 1 s, hold.
// node tools/hare-closeup-record.mjs <base> <outDir> <V m/s> [slow=0.1] [joint=limit=1,plantW=100] [dist=1.3]
import { acquire, track, release } from './bench-lock.mjs';
import { spawn, execSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const sleep = ms => new Promise(r => setTimeout(r, ms));
// mode 'drive': the staged hare is driven (embodied-style) across the view
const [base, outDir, vArg, slowArg, jointArg, distArg] = process.argv.slice(2); const V = Number(vArg ?? 8.5), SLOW = Number(slowArg ?? .1), DIST = Number(distArg ?? 1.3), skipPerf = 1, mode = 'drive'; const LOCKNAME = 'grok-gait: T-0044 run 12 close-up clip';
if (!(await acquire(LOCKNAME))) { console.error('bench lock not acquired'); process.exit(1); } mkdirSync(join(outDir, 'frames'), { recursive: true });
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const port = 9500 + Math.floor(Math.random() * 90), profile = mkdtempSync(join(tmpdir(), 'grok-hareport-'));
const p = spawn(edge, ['--window-position=-32000,-32000', '--window-size=1280,800', '--no-first-run', '--disable-extensions', '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows', '--disable-background-timer-throttling', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' }); track(p.pid);
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
      let t = 0, last = performance.now(); const prof = t => t < .5 ? 0 : t < 1.5 ? (t - .5) * ${V} : ${V}; // stand, ramp, hold V
      let s = -2; h.sim.x = ox - rx * 2; h.sim.z = oz - rz * 6; h.sim.heading = hd;
      const step = () => { const now = performance.now(), dt = Math.min(.1, (now - last) / 1000); last = now; t += dt; const v = s < 40 ? prof(t) : 0; s += v * dt;
        h.sim.speed = v; h.sim.state = v > 0 ? 'flee' : 'graze'; h.sim.x = ox + rx * s; h.sim.z = oz + rz * s; h.sim.heading = hd; if (t < 30) requestAnimationFrame(step); };
      requestAnimationFrame(step); return 1; })()`);
    report.staged = await ev('(() => { const h = borealHares.list()[0]; return { id: h.id, x: h.sim.x, z: h.sim.z, driven: true }; })()');
  } else report.staged = await stage(2.5, 3, 0); // beside the wolf, so its flight (away from the wolf) crosses the view side-on
  report.joint = await ev(`(async () => { const u = performance.getEntriesByType('resource').map(e => e.name), b = u.filter(x => x.includes('/src/animals/locomotion/bounding.ts')).pop(); if (!b) return 'bounding.ts not found'; const m = await import(b); for (const kv of ${JSON.stringify(jointArg ?? '')}.split(',').filter(Boolean)) { const [k, x] = kv.split('='); m.FORE_JOINT[k] = Number(x); } return JSON.stringify(m.FORE_JOINT); })()`);
  report.cam = await ev(`(async () => { const u = performance.getEntriesByType('resource').map(e => e.name), t3 = u.filter(x => /\\/deps\\/three\\.js|three\\.module\\.js/.test(x)).pop(); if (!t3) return 'three not found: ' + u.filter(x => x.includes('three')).slice(0, 3).join(' ');
    const T = await import(t3), h = borealHares.list()[0]; let sc = h.root; while (sc.parent) sc = sc.parent; const cv = document.createElement('canvas');
    const r = new T.WebGLRenderer({ canvas: cv, antialias: true, preserveDrawingBuffer: true }); r.setPixelRatio(1); r.setSize(1280, 720, false); const cam = new T.PerspectiveCamera(20, 1280 / 720, .05, 300); cam.layers.set(7); r.setClearColor(0xdfe6ea, 1);
    // layer 1 = the hare, the scene's lights and a 10 cm ground grid snapped to the world (grass, water and terrain left out so nothing hides the legs)
    const grid = new T.GridHelper(8, 80, 0x444444, 0x8a8a8a), floor = new T.Mesh(new T.PlaneGeometry(8, 8), new T.MeshBasicMaterial({ color: 0xc9cbbf })); floor.rotation.x = -Math.PI / 2; grid.layers.set(7); floor.layers.set(7); const box = new T.Box3(), c = new T.Vector3(); sc.add(grid); sc.add(floor);
    globalThis.__close = () => { const p = new T.Vector3(); h.root.getWorldPosition(p); const y = h.sim.heading, rx = -Math.cos(y), rz = Math.sin(y); h.root.traverse(o => o.layers.enable(7)); sc.traverse(o => { if (o.isLight) o.layers.enable(7); }); let skin; h.root.traverse(m => { if (m.isSkinnedMesh && m.name === 'skin') skin = m; }); box.makeEmpty(); if (skin) box.expandByObject(skin, true); else box.setFromObject(h.root); box.getCenter(c); const gy = box.min.y;
      const gx = Math.round(p.x * 10) / 10, gz = Math.round(p.z * 10) / 10; grid.position.set(gx, gy + .001, gz); floor.position.set(gx, gy - .002, gz); const bg = sc.background, fog = sc.fog; sc.background = null; sc.fog = null;
      cam.position.set(c.x + rx * ${DIST}, c.y + .03, c.z + rz * ${DIST}); cam.lookAt(c.x, c.y, c.z); globalThis.__closeInfo = { c: [c.x, c.y, c.z].map(v => +v.toFixed(2)), gy: +gy.toFixed(2), size: box.getSize(new T.Vector3()).toArray().map(v => +v.toFixed(2)), dbg: (() => { const o = []; h.root.traverse(m => { if (m.isMesh || m.isSkinnedMesh || m.isPoints || m.isLine) o.push([m.type, m.name, m.visible, m.layers.mask, m.frustumCulled]); }); return { vis: h.root.visible, id: h.id, n: o.length, o: o.slice(0, 12) }; })() }; r.render(sc, cam); sc.background = bg; sc.fog = fog; return cv.toDataURL('image/jpeg', .88).split(',')[1]; };
    return 'ok ' + sc.type; })()`);  let k = 0; const t0 = Date.now(); let phase = 'calm';
  while (Date.now() - t0 < 4000 / SLOW && k < Number(process.env.MAXF ?? 1e9)) {
    const tt = (Date.now() - t0) / 1000;
    if (phase === 'calm' && tt > 3 && mode !== 'drive') { phase = 'walk'; await key('w', true); }
    if (phase === 'walk' && tt > 3 + .15 / SLOW) { phase = 'stop'; await key('w', false); } // a short step: the hare bolts, the camera stays nearly still
    const s = { data: await ev('__close()') }; const name = `f${String(k++).padStart(4, '0')}.jpg`;
    writeFileSync(join(outDir, 'frames', name), Buffer.from(s.data, 'base64'));
    log.push({ name, t: +tt.toFixed(2), phase, hare: await ev(`(() => { const h = borealHares.list().find(x => x.id === ${report.staged?.id}); return h && { state: h.sim.state, speed: +h.sim.speed.toFixed(2), x: +h.x.toFixed(2), z: +h.z.toFixed(2), rig: !!h.rig, lock: !!h.rig?.foreLock }; })()`), player: await ev('window.__boreal.player()'), cam: await ev('globalThis.__closeInfo') });
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
  release(LOCKNAME);
  mkdirSync(outDir, { recursive: true }); writeFileSync(join(outDir, 'report.json'), JSON.stringify({ report, errors, log }, null, 1)); await sleep(1500); try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
console.log(JSON.stringify({ report, errors: errors.slice(0, 10), frames: log.length, states: log.map(l => `${l.t}:${l.phase}:${l.hare?.state}:${l.hare?.speed}:${l.hare?.rig ? 'R' : '-'}${l.hare?.lock ? 'L' : ''}`).join(' ') }, null, 1));