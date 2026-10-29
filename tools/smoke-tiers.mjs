// App smoke check (Grok Bot): headless Edge on the real GPU loads the game, waits for the loading screen, then holds every
// governor tier (manual) and fails on any page error or a world that did not build. Every tier with AO constructs and runs
// GTAO (render/post), the shadow cascades and both post routes, so a pass that throws at one tier fails here.
//   node tools/smoke-tiers.mjs [baseUrl=http://127.0.0.1:5173] [holdMs=8000]      exit 0 = pass, 1 = fail
// Holds the omen bench lock (tools/bench-lock.mjs, name from BENCH_NAME) for the whole run; waits up to 60 min for it. Logs GPU memory (nvidia-smi).
// Edge 155 headless starts the page hidden (rAF ~0): Page.bringToFront + focus emulation + the backgrounding flags fix it.
import { spawn, execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { acquire, track, release } from './bench-lock.mjs';
const base = process.argv[2] ?? 'http://127.0.0.1:5173', holdMs = Number(process.argv[3] ?? 8000), port = 9900 + Math.floor(Math.random() * 90);
const lockName = process.env.BENCH_NAME ?? `smoke-tiers ${base}`;
if (!await acquire(lockName)) { console.log('SMOKE FAIL bench lock busy for 60 min'); process.exit(1); }
const edge = process.env.EDGE ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', profile = mkdtempSync(join(tmpdir(), 'smoke-edge-'));
// GPU vsync off by default (SMOKE_VSYNC=1 keeps it): on omen the GPU process's vsync thread (WinVSyncProvider, DXGI vblank wait)
// sometimes blocks ~0.5 s per frame for a whole run (external display asleep / mode change?), so the page drew 2 fps on every
// tier with an idle main thread and 0.2-9 ms GPU frames; a trace shows GpuVSyncThread busy 2999 of 3000 ms. Uncapped fps here.
const vsyncFlags = process.env.SMOKE_VSYNC === '1' ? [] : ['--disable-gpu-vsync', '--disable-frame-rate-limit'];
const proc = spawn(edge, [...vsyncFlags, '--headless=new', '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-gpu-sandbox', '--hide-scrollbars', '--window-size=1280,800',
  '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--disable-background-timer-throttling', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
track(proc.pid); // release() kills it even if this script dies before its finally
const gpuMem = () => { try { return execSync('nvidia-smi --query-gpu=memory.used,memory.total,utilization.gpu --format=csv,noheader', { encoding: 'utf8', timeout: 10000 }).trim(); } catch { return 'n/a (no nvidia-smi)'; } };
console.log('gpu at start: ' + gpuMem() + ' (used, total, util)'); // contention check: what other GPU users hold before the run
const sleep = ms => new Promise(r => setTimeout(r, ms)), errors = [];
let ok = false;
try {
  let t; for (let k = 0; k < 60 && !t; k++) { await sleep(500); try { t = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); } catch {} }
  const ws = new WebSocket(t.find(x => x.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const pend = new Map();
  const trace = []; let traceDone = null;
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); }
    if (d.method === 'Tracing.dataCollected') trace.push(...d.params.value); if (d.method === 'Tracing.tracingComplete') traceDone?.();
    if (d.method === 'Runtime.exceptionThrown') errors.push('exception: ' + (d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text));
    if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') errors.push('console.error: ' + d.params.args.map(a => a.value ?? a.description ?? '').join(' '));
    if (d.method === 'Log.entryAdded' && d.params.entry.level === 'error' && !/favicon/.test(d.params.entry.url ?? '')) errors.push('log: ' + d.params.entry.text + ' ' + (d.params.entry.url ?? '')); };
  const cdp = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async e => { const r = await Promise.race([cdp('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }), sleep(120000).then(() => ({ timeout: true }))]);
    if (r.timeout) throw new Error('evaluate timed out'); if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description ?? r.result.exceptionDetails.text); return r.result?.result?.value; };
  await cdp('Page.enable'); await cdp('Runtime.enable'); await cdp('Log.enable'); await cdp('Page.bringToFront'); await cdp('Emulation.setFocusEmulationEnabled', { enabled: true });
  // program links (shader compiles in the GPU process: ANGLE/D3D11 links can take 100s of ms there while the page's main thread idles)
  await cdp('Page.addScriptToEvaluateOnNewDocument', { source: `(() => { const P = WebGL2RenderingContext.prototype, L = window.__links = [], ss = P.shaderSource, lp = P.linkProgram, at = P.attachShader, nm = new WeakMap(), pn = new WeakMap();
    P.shaderSource = function (sh, src) { nm.set(sh, (/#define SHADER_NAME (\\S+)/.exec(src) || [])[1] || (/#define (USE_CSM|DEPTH_PACKING)/.exec(src) || [])[1] || '?'); return ss.call(this, sh, src); };
    P.attachShader = function (p, sh) { if (nm.get(sh) !== '?' || !pn.has(p)) pn.set(p, nm.get(sh)); return at.call(this, p, sh); };
    P.linkProgram = function (p) { L.push([performance.now(), pn.get(p) || '?']); return lp.call(this, p); }; })()` });
  await cdp('Page.navigate', { url: `${base}/?nomenu&hour=11` });
  const t0 = Date.now(); await sleep(3000);
  const loaded = async () => { try { return await ev(`document.readyState === 'complete' && !document.getElementById('loading')`) === true; } catch { return false; } }; // startup can block the page for a minute (cold shader compiles)
  while (!await loaded()) { if (Date.now() - t0 > 300000) throw new Error('loading screen still up after 300 s'); await sleep(1000); }
  console.log(`loaded in ${((Date.now() - t0) / 1000).toFixed(0)} s, ${await ev('window.__links.length')} program links`);
  const gpu = await ev(`(() => { const c = [...document.querySelectorAll('canvas')].find(c => c.getContext('webgl2')), gl = c?.getContext('webgl2'), x = gl?.getExtension('WEBGL_debug_renderer_info');
    return gl ? (gl.isContextLost() ? 'CONTEXT LOST ' : '') + gl.getParameter(x ? x.UNMASKED_RENDERER_WEBGL : gl.RENDERER) : 'no webgl2 canvas'; })()`);
  console.log('renderer ' + gpu); if (/SwiftShader|WARP|Basic Render|llvmpipe|software|CONTEXT LOST|no webgl2/i.test(gpu)) errors.push('not on the GPU: ' + gpu); // a 2 fps run with an idle main thread is the GPU process, not app code
  const res = JSON.parse(await ev(`(async () => {
    const u = performance.getEntriesByType('resource').map(e => e.name).filter(n => n.includes('/src/core/quality.ts')), Q = await import(u[u.length - 1] ?? '/src/core/quality.ts'), G = Q.GOVERNOR;
    const P = WebGL2RenderingContext.prototype; let calls = 0;
    for (const k of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced', 'drawRangeElements']) { const f = P[k]; P[k] = function (...a) { calls++; return f.apply(this, a); }; }
    for (const c of document.querySelectorAll('canvas')) { const md = c.getContext('webgl2')?.getExtension('WEBGL_multi_draw'); if (md) for (const k of ['multiDrawElementsWEBGL', 'multiDrawArraysWEBGL', 'multiDrawElementsInstancedWEBGL', 'multiDrawArraysInstancedWEBGL']) { const f = md[k]; if (f) md[k] = function (...a) { calls++; return f.apply(this, a); }; } }
    const raf = () => new Promise(r => requestAnimationFrame(r)), wait = ms => new Promise(r => setTimeout(r, ms)), out = [];
    G.auto = false; G.capTier = 0; G.probeCap = 0;
    for (let t = 0; t < Q.LADDER.length; t++) { const l0 = window.__links.length; G.tier = t; await wait(${holdMs}); let frames = 0, sum = 0; const s = performance.now(), l1 = window.__links.length;
      while (performance.now() - s < 1000) { calls = 0; await raf(); frames++; sum += calls; } out.push({ tier: Q.LADDER[t].name, ssao: Q.LADDER[t].ssao, frames, draws: Math.round(sum / frames), gpu: G.gpuMs === undefined ? '-' : G.gpuMs.toFixed(1), links: l1 - l0, linksSampled: window.__links.length - l1 }); }
    G.auto = true; return JSON.stringify(out); })()`));
  console.log('gpu after tiers: ' + gpuMem());
  for (const r of res) console.log(`${r.tier.padEnd(9)} ssao ${r.ssao}  ${r.frames} frames/s  ${r.draws} draws/frame  gpu ${r.gpu} ms  links ${r.links} (+${r.linksSampled} in the 1 s sample)`);
  console.log(vsyncFlags.length ? '(gpu vsync off: uncapped fps)' : '(gpu vsync on)');
  // The ground world as the game holds it (world/globe/inpage's window.__inpage dev hook, buildScene's borealDensity report).
  // Draw counts alone no longer say whether the world is built: since #161 a still player wolf is one rigid wolf.glb mesh
  // (was ~42 procedural meshes plus their shadow draws), so a built Ultra world can draw under 150.
  const world = await ev(`(() => { const c = window.__inpage, cam = c?.view?.camera, d = globalThis.borealDensity?.(); return cam ? { mode: c.mode, near: cam.near, far: cam.far, chunks: d?.chunks ?? null } : null; })()`);
  if (world) console.log(`world: mode ${world.mode}, ${world.chunks ?? '?'} chunks, camera near ${+world.near.toFixed(2)} m far ${+world.far.toFixed(0)} m`);
  // A game-mode camera must keep the game clip (0.2 m). The orbit clip (near = altitude x 0.02) left on it hides the near world.
  if (world?.mode === 'game' && world.near > 1) errors.push(`game camera near clip ${world.near.toFixed(1)} m (orbit clip left on the forest camera)`);
  const dead = res.filter(r => r.frames < 5), empty = world?.chunks != null ? world.chunks < 1 : res[0].draws < 150; // no chunk built in the interest ring (box SwiftShader holds 4-10 after 20 s); older builds without the report: Ultra draws ~600 built, ~90 terrain only
  if (dead.length) console.log('links in the last 20 s by shader: ' + await ev(`(() => { const n = performance.now(), m = new Map(); for (const [t, k] of window.__links) if (n - t < 20000) m.set(k, (m.get(k) || 0) + 1); return JSON.stringify([...m].sort((a, b) => b[1] - a[1]).slice(0, 10)); })()`));
  if (dead.length) { // where a dead frame goes: 3 s browser trace, wall time per event name and thread (top 15)
    await cdp('Tracing.start', { categories: 'devtools.timeline,disabled-by-default-devtools.timeline.frame,viz,cc,gpu,benchmark,toplevel,blink.user_timing', transferMode: 'ReportEvents' });
    await sleep(3000); const done = new Promise(r => traceDone = r); await cdp('Tracing.end'); await Promise.race([done, sleep(20000)]);
    const tn = new Map(); for (const e of trace) if (e.ph === 'M' && e.name === 'thread_name') tn.set(e.pid + ':' + e.tid, e.args.name);
    const agg = new Map(); for (const e of trace) if (e.ph === 'X' && e.dur) { const k = (tn.get(e.pid + ':' + e.tid) ?? e.tid) + ' ' + e.name; agg.set(k, (agg.get(k) ?? 0) + e.dur); }
    console.log('trace 3 s, ms per thread+event:'); for (const [k, v] of [...agg].sort((a, b) => b[1] - a[1]).slice(0, 15)) console.log('  ' + (v / 1000).toFixed(0).padStart(6) + ' ' + k); }
  if (dead.length) errors.push('not rendering at ' + dead.map(r => r.tier).join(', ') + ' (' + await ev(`document.visibilityState + ' focus=' + document.hasFocus()`) + ')');
  if (empty) errors.push(world?.chunks != null ? `world not built: ${world.chunks} chunks` : `world not built: ${res[0].draws} draws at ${res[0].tier}`);
  ok = !errors.length; ws.close();
} catch (e) { errors.push('smoke: ' + (e.stack ?? e)); }
finally {
  try { execSync(`taskkill /PID ${proc.pid} /T /F`, { stdio: 'ignore' }); } catch { proc.kill(); }
  await sleep(1000); try { rmSync(profile, { recursive: true, force: true }); } catch {}
  release(lockName);
}
for (const e of errors) console.log('FAIL ' + e.slice(0, 500));
console.log(ok ? 'SMOKE PASS' : 'SMOKE FAIL'); process.exit(ok ? 0 : 1);
