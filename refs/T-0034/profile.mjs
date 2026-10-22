// T-0034 descent profiler (grok-globe): bare load -> wheel descent; rAF log (gap, mode, alt, pitch) + CPU profile of the longest busy stretch.
// node profile.mjs <base> <outJson> [headed=0]
import { spawn, execSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { acquire, track, release } from 'file:///C:/dev/boreal-grok-globe-default/tools/bench-lock.mjs';
const base = process.argv[2], out = process.argv[3], headed = process.argv[4] === '1', name = 'grok-globe: T-0034 descent profile', port = 9600 + Math.floor(Math.random() * 90);
if (!await acquire(name)) { console.log('lock busy'); process.exit(1); }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', profile = mkdtempSync(join(tmpdir(), 't0034-prof-'));
const flags = [...(headed ? ['--new-window'] : ['--headless=new', '--disable-gpu-vsync', '--disable-frame-rate-limit']), '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--hide-scrollbars', '--window-size=1280,800', '--no-first-run', '--no-default-browser-check',
  '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--disable-background-timer-throttling', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'];
const proc = spawn(edge, flags, { stdio: 'ignore' }); track(proc.pid); const errors = [];
let result = {};
try {
  let t; for (let k = 0; k < 60 && !t?.find?.(x => x.type === 'page'); k++) { await sleep(500); try { t = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); } catch {} }
  const ws = new WebSocket(t.find(x => x.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const pend = new Map();
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); }
    if (d.method === 'Runtime.exceptionThrown') errors.push('exception: ' + (d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text).slice(0, 300)); };
  const cdp = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async e => { const r = await cdp('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description); return r.result?.result?.value; };
  await cdp('Page.enable'); await cdp('Runtime.enable'); await cdp('Profiler.enable'); await cdp('Page.bringToFront'); await cdp('Emulation.setFocusEmulationEnabled', { enabled: true });
  await cdp('Page.addScriptToEvaluateOnNewDocument', { source: `(() => { const P = WebGL2RenderingContext.prototype, L = window.__links = [], lp = P.linkProgram; P.linkProgram = function (p) { const t = performance.now(); const r = lp.call(this, p); L.push(t); return r; }; const gs = P.getProgramParameter; P.getProgramParameter = function (p, k) { const t = performance.now(), r = gs.call(this, p, k); const d = performance.now() - t; if (d > 20) (window.__slowParam ??= []).push([+t.toFixed(0), +d.toFixed(0)]); return r; }; })()` });
  await cdp('Page.navigate', { url: `${base}/` }); const tl = Date.now(); await sleep(2000);
  while (await ev(`!!document.getElementById('loading') || document.readyState !== 'complete'`)) { if (Date.now() - tl > 240000) throw new Error('loading > 240 s'); await sleep(500); }
  for (let i = 0; i < 40 && await ev(`window.__inpage?.mode`) !== 'globe'; i++) await sleep(250);
  console.log(`loaded in ${((Date.now() - tl) / 1000).toFixed(0)} s, search ${await ev('location.search')}`);
  await sleep(1500);
  await ev(`(() => { const L = window.__rlog = []; let last = performance.now();
    const f = now => { const ip = window.__inpage, g = ip?.globe; let pitch = null, alt = g ? Math.round(g.altitude) : -1;
      if (g && ip.mode !== 'game') { const c = g.camera, p = c.position.clone().normalize(), d = c.getWorldDirection(c.position.clone()); pitch = +(Math.asin(Math.max(-1, Math.min(1, d.dot(p)))) * 180 / Math.PI).toFixed(1); }
      L.push({ t: +now.toFixed(1), dt: +(now - last).toFixed(1), mode: ip?.mode, alt, h: Math.round(ip?.height ?? 0), pitch }); last = now; requestAnimationFrame(f); };
    requestAnimationFrame(f); return true; })()`);
  await cdp('Profiler.setSamplingInterval', { interval: 500 }); await cdp('Profiler.start');
  const t0 = Date.now(); let landed = 0;
  while (Date.now() - t0 < 60000) {
    const mode = await ev('window.__inpage.mode');
    if (!landed && mode === 'game') landed = Date.now();
    if (landed && Date.now() - landed > 4000) break;
    if (mode === 'globe') for (let j = 0; j < 3; j++) await cdp('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 640, y: 400, deltaX: 0, deltaY: -120 });
    await sleep(150);
  }
  const prof = (await cdp('Profiler.stop')).result.profile;
  const log = await ev('window.__rlog');
  // longest busy stretch (no idle samples)
  const byId = new Map(prof.nodes.map(n => [n.id, n])), parent = new Map(); for (const n of prof.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
  let ts = prof.startTime, best = { len: 0 }, cur = null; const times = [];
  prof.samples.forEach((s, i) => { ts += prof.timeDeltas[i]; times.push(ts); const nm = byId.get(s).callFrame.functionName; if (nm === '(idle)') { if (cur && ts - cur.start > best.len) best = { len: ts - cur.start, a: cur.i, b: i }; cur = null; } else if (!cur) cur = { start: ts, i }; });
  const incl = new Map(), self = new Map();
  for (let i = best.a; i < best.b; i++) { const dt = (times[i + 1] ?? times[i]) - times[i]; let n = prof.samples[i]; const seen = new Set(); const leaf = byId.get(n).callFrame;
    const lk = `${leaf.functionName || '(anon)'} ${leaf.url.split('/').slice(-2).join('/')}:${leaf.lineNumber + 1}`; self.set(lk, (self.get(lk) ?? 0) + dt);
    while (n) { const cf = byId.get(n).callFrame, k = `${cf.functionName || '(anon)'} ${cf.url.split('/').slice(-2).join('/')}:${cf.lineNumber + 1}`; if (!seen.has(k)) { seen.add(k); incl.set(k, (incl.get(k) ?? 0) + dt); } n = parent.get(n); } }
  const top = m => [...m].sort((a, b) => b[1] - a[1]).slice(0, 40).map(([k, v]) => `${(v / 1000).toFixed(0).padStart(6)} ms ${k}`);
  const links = await ev('window.__links'), slow = await ev('window.__slowParam ?? []');
  const gaps = log.filter(r => r.dt > 100).map(r => ({ t: r.t, dt: r.dt, mode: r.mode, alt: r.alt, h: r.h, links: links.filter(x => x > r.t - r.dt && x <= r.t).length, slowParamMs: slow.filter(([x]) => x > r.t - r.dt && x <= r.t).reduce((a, [, d]) => a + d, 0) }));
  let maxJump = { d: 0 }; for (let i = 1; i < log.length; i++) if (log[i].pitch !== null && log[i - 1].pitch !== null) { const d = Math.abs(log[i].pitch - log[i - 1].pitch); if (d > maxJump.d) maxJump = { d, at: log[i], prev: log[i - 1] }; }
  result = { headed, busyMs: Math.round(best.len / 1000), incl: top(incl), self: top(self), gaps, maxGap: Math.max(...log.map(r => r.dt)), maxPitchJump: maxJump, frames: log.length, log };
  console.log(`busiest stretch ${result.busyMs} ms; max rAF gap ${result.maxGap} ms; max pitch step ${maxJump.d.toFixed(1)} deg (${JSON.stringify(maxJump.prev)} -> ${JSON.stringify(maxJump.at)})`);
  console.log('gaps > 100 ms: ' + JSON.stringify(gaps));
  console.log('INCLUSIVE in busiest stretch:\n' + result.incl.join('\n')); console.log('SELF:\n' + result.self.slice(0, 15).join('\n'));
  ws.close();
} catch (e) { errors.push('profile: ' + (e.stack ?? e)); }
finally { try { execSync(`taskkill /PID ${proc.pid} /T /F`, { stdio: 'ignore' }); } catch { proc.kill(); } await sleep(1000); try { rmSync(profile, { recursive: true, force: true }); } catch {} release(name); }
writeFileSync(out, JSON.stringify(result, null, 1)); for (const e of errors) console.log('ERR ' + e); console.log('done');