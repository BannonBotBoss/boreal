// Headless before/after for T-0004. Not the omen bench: SwiftShader, no bench lock, vsync not the RTX path.
// Usage: node tasks/evidence/T-0004/capture.mjs [baseUrl]
// Writes PNG stills plus capture.json (program links, shader hits, rAF frame time).
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const base = process.argv[2] ?? 'http://127.0.0.1:5288';
const out = new URL('.', import.meta.url).pathname;
const shots = [
  { name: 'log-on', q: '?nomenu&hour=15&at=66.14,12.62,0.677' },
  { name: 'log-off', q: '?nomenu&hour=15&bands=0&at=66.14,12.62,0.677' },
  { name: 'trunk-on', q: '?nomenu&hour=15&at=-25.14,-15.98,0' },
  { name: 'trunk-off', q: '?nomenu&hour=15&bands=0&at=-25.14,-15.98,0' },
];
const cdpPort = 9333 + Math.floor(Math.random() * 400);
const profile = mkdtempSync(join(tmpdir(), 'bands-chrome-'));
const chrome = process.env.CHROME ?? '/usr/bin/google-chrome';
const proc = spawn(chrome, [
  '--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows', '--hide-scrollbars', '--window-size=1280,720',
  `--remote-debugging-port=${cdpPort}`, `--user-data-dir=${profile}`, 'about:blank',
], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const results = [];
try {
  let tabs;
  for (let k = 0; k < 40 && !tabs; k++) {
    await sleep(250);
    try { tabs = await (await fetch(`http://127.0.0.1:${cdpPort}/json`)).json(); } catch { /* chrome still starting */ }
  }
  if (!tabs) throw new Error('chrome devtools did not open');
  const ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const pend = new Map();
  ws.onmessage = m => {
    const d = JSON.parse(m.data);
    if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); }
  };
  const cdp = (method, params = {}) => new Promise((res, rej) => {
    const i = ++id;
    const t = setTimeout(() => { pend.delete(i); rej(new Error('cdp timeout ' + method)); }, 180000);
    pend.set(i, d => { clearTimeout(t); res(d); });
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  const ev = async expr => {
    const r = await cdp('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.text + ' ' + (r.result.exceptionDetails.exception?.description ?? ''));
    return r.result?.result?.value;
  };
  await cdp('Page.enable');
  await cdp('Runtime.enable');
  await cdp('Page.addScriptToEvaluateOnNewDocument', { source: `(() => { const P = WebGL2RenderingContext.prototype, L = window.__links = [], S = window.__bandSrc = 0, ss = P.shaderSource, lp = P.linkProgram;
    P.shaderSource = function (sh, src) { if (typeof src === 'string' && src.includes('float bt =')) window.__bandSrc++; return ss.call(this, sh, src); };
    P.linkProgram = function (p) { L.push(performance.now()); return lp.call(this, p); }; })()` });
  for (const shot of shots) {
    const t0 = Date.now();
    const errors = [];
    await cdp('Page.navigate', { url: base + shot.q });
    await sleep(1500);
    let loaded = false;
    while (Date.now() - t0 < 240000) {
      try {
        loaded = await ev(`document.readyState === 'complete' && !document.getElementById('loading')`) === true;
      } catch { loaded = false; }
      if (loaded) break;
      await sleep(1000);
    }
    if (!loaded) { results.push({ name: shot.name, error: 'loading screen still up', ms: Date.now() - t0 }); continue; }
    await ev(`(async () => { const u = performance.getEntriesByType('resource').map(e => e.name).filter(n => n.includes('/src/render/trees.ts')); if (u.length) { const T = await import(u[u.length - 1]); if (T.WIND_UNIFORMS) T.WIND_UNIFORMS.uWindAmp.value = 0; } })()`).catch(e => errors.push(String(e)));
    await sleep(800);
    const sample = await ev(`(async () => { const raf = () => new Promise(r => requestAnimationFrame(r)); const xs = []; let last = performance.now();
      for (let i = 0; i < 30; i++) { await raf(); const n = performance.now(); xs.push(n - last); last = n; }
      xs.sort((a, b) => a - b); const mid = xs[xs.length >> 1];
      const gl = document.querySelector('canvas')?.getContext('webgl2'); const x = gl?.getExtension('WEBGL_debug_renderer_info');
      let tier = null; try { const u = performance.getEntriesByType('resource').map(e => e.name).filter(n => n.includes('/src/core/quality.ts')); if (u.length) { const Q = await import(u[u.length - 1]); tier = Q.LADDER[Q.GOVERNOR.tier]?.name + ' auto=' + Q.GOVERNOR.auto + ' gpu=' + Q.GOVERNOR.gpu; } } catch (e) { tier = String(e); }
      return { medianMs: mid, frames: xs.length, renderer: gl ? gl.getParameter(x ? x.UNMASKED_RENDERER_WEBGL : gl.RENDERER) : 'no canvas', links: window.__links?.length ?? -1, bandSrc: window.__bandSrc ?? -1, tier }; })()`);
    const png = await cdp('Page.captureScreenshot', { format: 'png' });
    writeFileSync(out + shot.name + '.png', Buffer.from(png.result.data, 'base64'));
    results.push({ name: shot.name, q: shot.q, loadMs: Date.now() - t0, ...sample, errors });
    console.log(shot.name, JSON.stringify(sample), 'load', Date.now() - t0);
  }
  ws.close();
} finally {
  try { proc.kill('SIGKILL'); } catch { /* already gone */ }
  await sleep(300);
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* profile cleanup */ }
  writeFileSync(out + 'capture.json', JSON.stringify({ base, at: new Date().toISOString(), results }, null, 2) + '\n');
  console.log(JSON.stringify(results, null, 2));
}
