// App smoke check (Grok Bot): headless Edge on the real GPU loads the game, waits for the loading screen, then holds every
// governor tier (manual) and fails on any page error or a world that did not build. Every tier with AO constructs and runs
// GTAO (render/post), the shadow cascades and both post routes, so a pass that throws at one tier fails here.
//   node tools/smoke-tiers.mjs [baseUrl=http://127.0.0.1:5173] [holdMs=8000]      exit 0 = pass, 1 = fail
// Holds the omen bench lock (tools/bench-lock.mjs, name from BENCH_NAME) for the whole run; waits up to 60 min for it.
// Edge 155 headless starts the page hidden (rAF ~0): Page.bringToFront + focus emulation + the backgrounding flags fix it.
import { spawn, execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { acquire, release } from './bench-lock.mjs';
const base = process.argv[2] ?? 'http://127.0.0.1:5173', holdMs = Number(process.argv[3] ?? 8000), port = 9900 + Math.floor(Math.random() * 90);
const lockName = process.env.BENCH_NAME ?? `smoke-tiers ${base}`;
if (!await acquire(lockName)) { console.log('SMOKE FAIL bench lock busy for 60 min'); process.exit(1); }
const edge = process.env.EDGE ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', profile = mkdtempSync(join(tmpdir(), 'smoke-edge-'));
const proc = spawn(edge, ['--headless=new', '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-gpu-sandbox', '--hide-scrollbars', '--window-size=1280,800',
  '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--disable-background-timer-throttling', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms)), errors = [];
let ok = false;
try {
  let t; for (let k = 0; k < 60 && !t; k++) { await sleep(500); try { t = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); } catch {} }
  const ws = new WebSocket(t.find(x => x.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const pend = new Map();
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); }
    if (d.method === 'Runtime.exceptionThrown') errors.push('exception: ' + (d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text));
    if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') errors.push('console.error: ' + d.params.args.map(a => a.value ?? a.description ?? '').join(' '));
    if (d.method === 'Log.entryAdded' && d.params.entry.level === 'error' && !/favicon/.test(d.params.entry.url ?? '')) errors.push('log: ' + d.params.entry.text + ' ' + (d.params.entry.url ?? '')); };
  const cdp = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async e => { const r = await Promise.race([cdp('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }), sleep(120000).then(() => ({ timeout: true }))]);
    if (r.timeout) throw new Error('evaluate timed out'); if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description ?? r.result.exceptionDetails.text); return r.result?.result?.value; };
  await cdp('Page.enable'); await cdp('Runtime.enable'); await cdp('Log.enable'); await cdp('Page.bringToFront'); await cdp('Emulation.setFocusEmulationEnabled', { enabled: true });
  await cdp('Page.navigate', { url: `${base}/?nomenu&hour=11` });
  const t0 = Date.now(); await sleep(3000);
  const loaded = async () => { try { return await ev(`document.readyState === 'complete' && !document.getElementById('loading')`) === true; } catch { return false; } }; // startup can block the page for a minute (cold shader compiles)
  while (!await loaded()) { if (Date.now() - t0 > 300000) throw new Error('loading screen still up after 300 s'); await sleep(1000); }
  console.log(`loaded in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
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
    for (let t = 0; t < Q.LADDER.length; t++) { G.tier = t; await wait(${holdMs}); let frames = 0, sum = 0; const s = performance.now();
      while (performance.now() - s < 1000) { calls = 0; await raf(); frames++; sum += calls; } out.push({ tier: Q.LADDER[t].name, ssao: Q.LADDER[t].ssao, frames, draws: Math.round(sum / frames), gpu: G.gpuMs === undefined ? '-' : G.gpuMs.toFixed(1) }); }
    G.auto = true; return JSON.stringify(out); })()`));
  for (const r of res) console.log(`${r.tier.padEnd(9)} ssao ${r.ssao}  ${r.frames} frames/s  ${r.draws} draws/frame  gpu ${r.gpu} ms`);
  const dead = res.filter(r => r.frames < 5), empty = res[0].draws < 150; // Ultra draws ~600 with the world built, ~90 with terrain only
  if (dead.length) errors.push('not rendering at ' + dead.map(r => r.tier).join(', ') + ' (' + await ev(`document.visibilityState + ' focus=' + document.hasFocus()`) + ')');
  if (empty) errors.push(`world not built: ${res[0].draws} draws at ${res[0].tier}`);
  ok = !errors.length; ws.close();
} catch (e) { errors.push('smoke: ' + (e.stack ?? e)); }
finally {
  try { execSync(`taskkill /PID ${proc.pid} /T /F`, { stdio: 'ignore' }); } catch { proc.kill(); }
  await sleep(1000); try { rmSync(profile, { recursive: true, force: true }); } catch {}
  release(lockName);
}
for (const e of errors) console.log('FAIL ' + e.slice(0, 500));
console.log(ok ? 'SMOKE PASS' : 'SMOKE FAIL'); process.exit(ok ? 0 : 1);
