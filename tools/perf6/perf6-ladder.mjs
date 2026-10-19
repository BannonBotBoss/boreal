// Grok Bot capture: node capture.mjs <baseUrl> <outPrefix> <query> <tierName,...> [holdMs=6000] [evalJs]
// bench lock + tracked Edge, GPU vsync off; screenshots each tier to <outPrefix>-<tier>.png; prints draws/frame.
import { spawn, execSync } from 'node:child_process'; import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'; import { tmpdir } from 'node:os'; import { join } from 'node:path';
import { acquire, track, release } from 'file:///C:/Users/0/OneDrive/Desktop/i-want-to-play-a-game/tools/bench-lock.mjs';
let [base, out, query = 'nomenu&hour=11', tiers = 'Ultra', holdArg, evalJs = ''] = process.argv.slice(2); if (evalJs.startsWith('@')) evalJs = (await import('node:fs')).readFileSync(evalJs.slice(1), 'utf8');
const holdMs = Number(holdArg ?? 6000);
const name = `Grok Bot perf6 capture ${out.split(/[\\/]/).pop()}`; if (!await acquire(name)) process.exit(2);
const port = 9700 + Math.floor(Math.random() * 90), profile = mkdtempSync(join(tmpdir(), 'cap-'));
const proc = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [...(process.env.VSYNC === '1' ? [] : ['--disable-gpu-vsync', '--disable-frame-rate-limit']), '--headless=new', '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-gpu-sandbox', '--hide-scrollbars', '--window-size=1280,800', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--disable-background-timer-throttling', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
track(proc.pid); const sleep = ms => new Promise(r => setTimeout(r, ms));
try {
  let t; for (let k = 0; k < 60 && !t; k++) { await sleep(500); try { t = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); } catch {} }
  const ws = new WebSocket(t.find(x => x.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.onopen = r); let id = 0; const pend = new Map();
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); }
    if (d.method === 'Runtime.exceptionThrown') console.log('exception: ' + (d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text).slice(0, 300)); };
  const cdp = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async e => { const r = await Promise.race([cdp('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }), sleep(560000).then(() => ({}))]); if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description); return r.result?.result?.value; };
  await cdp('Page.enable'); await cdp('Runtime.enable'); await cdp('Page.bringToFront'); await cdp('Emulation.setFocusEmulationEnabled', { enabled: true });
  await cdp('Page.navigate', { url: `${base}/?${query}` }); const t0 = Date.now(); await sleep(3000);
  while (await ev(`document.readyState==='complete' && !document.getElementById('loading')`).catch(() => false) !== true) { if (Date.now() - t0 > 300000) throw new Error('load timeout'); await sleep(1000); }
  console.log(`loaded in ${((Date.now() - t0) / 1000) | 0} s`);
  if (evalJs) console.log('eval: ' + await ev(evalJs));
  for (const tier of tiers ? tiers.split(',') : []) {
    const r = await ev(`(async () => { const u = performance.getEntriesByType('resource').map(e => e.name).filter(n => n.includes('/src/core/quality.ts')), Q = await import(u[u.length - 1] ?? '/src/core/quality.ts'), G = Q.GOVERNOR;
      G.auto = false; G.capTier = 0; G.probeCap = 0; G.tier = Q.LADDER.findIndex(l => l.name === ${JSON.stringify(tier)}); await new Promise(r => setTimeout(r, ${holdMs}));
      const P = WebGL2RenderingContext.prototype; let calls = 0; const saved = {}; for (const k of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced', 'drawRangeElements']) { const f = saved[k] = P[k]; P[k] = function (...a) { calls++; return f.apply(this, a); }; }
      for (const c of document.querySelectorAll('canvas')) { const md = c.getContext('webgl2')?.getExtension('WEBGL_multi_draw'); if (md) for (const k of ['multiDrawElementsWEBGL', 'multiDrawArraysWEBGL', 'multiDrawElementsInstancedWEBGL', 'multiDrawArraysInstancedWEBGL']) { const f = md[k]; if (f && !md['__' + k]) { md['__' + k] = f; md[k] = function (...a) { calls++; return f.apply(this, a); }; } } }
      let n = 0; const s = performance.now(); while (performance.now() - s < 1000) { await new Promise(r => requestAnimationFrame(r)); n++; } for (const k in saved) P[k] = saved[k];
      return JSON.stringify({ tier: G.tier, fps: n, draws: Math.round(calls / n), gpu: G.gpuMs }); })()`);
    const shot = await cdp('Page.captureScreenshot', { format: 'png' }); writeFileSync(`${out}-${tier.replace(/\s/g, '')}.png`, Buffer.from(shot.result.data, 'base64'));
    console.log(`${tier}: ${r}`);
  }
  ws.close();
} catch (e) { console.log('capture error: ' + (e.stack ?? e)); process.exitCode = 1; }
finally { try { execSync(`taskkill /PID ${proc.pid} /T /F`, { stdio: 'ignore' }); } catch {} await sleep(800); try { rmSync(profile, { recursive: true, force: true }); } catch {} release(name); }
