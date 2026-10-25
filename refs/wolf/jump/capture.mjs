// T-0074 wolf jump frame strip (adapted from T-0075 capture). Virtual time steps 0.1 s per frame. Headless Chrome on Linux (swiftshader), not Edge.
// node refs/wolf/view/capture.mjs <port> <outdir>
// Serves ?nomenu&bench&hour=11 at the dry start. Viewport matches issue #52 (1024×559).
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = process.argv[2] ?? '5270';
const out = process.argv[3] ?? 'refs/wolf/jump/after';
const sleep = ms => new Promise(r => setTimeout(r, ms));
mkdirSync(out, { recursive: true });
const profile = mkdtempSync(join(tmpdir(), 'boreal-grokbot-chrome-'));
const debug = 9340 + (Number(PORT) % 20);
const chrome = spawn('google-chrome', [
  '--headless=new', '--disable-extensions', '--no-first-run', '--disable-gpu',
  '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
  `--remote-debugging-port=${debug}`, `--user-data-dir=${profile}`, 'about:blank',
], { stdio: 'ignore' });
let ws;
try {
  let tabs;
  for (let i = 0; i < 40; i++) {
    try { tabs = await (await fetch(`http://127.0.0.1:${debug}/json`)).json(); break; }
    catch { await sleep(250); }
  }
  if (!tabs) throw Error('chrome debug port closed');
  ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise(r => { ws.onopen = r; });
  let id = 0;
  const pending = new Map();
  const errors = [];
  const logs = [];
  ws.onmessage = e => {
    const d = JSON.parse(e.data);
    if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); }
    if (d.method === 'Runtime.exceptionThrown') errors.push(d.params?.exceptionDetails?.exception?.description ?? d.params?.exceptionDetails?.text);
    if (d.method === 'Runtime.consoleAPICalled') logs.push(d.params.args?.map(a => a.value ?? a.description).join(' '));
  };
  const cdp = (method, params = {}, ms = 30000) => new Promise((res, rej) => {
    const n = ++id; pending.set(n, res); ws.send(JSON.stringify({ id: n, method, params }));
    setTimeout(() => { if (pending.delete(n)) rej(Error(method + ' timeout')); }, ms).unref();
  });
  const ev = async expression => {
    const r = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.result?.exceptionDetails || r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails ?? r.result?.exceptionDetails));
    return r.result?.result?.value;
  };
  await cdp('Runtime.enable');
  await cdp('Page.enable');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1024, height: 559, deviceScaleFactor: 1, mobile: false });
  const url = `http://127.0.0.1:${PORT}/?nomenu&bench&hour=11`;
  await cdp('Page.navigate', { url });
  let ready = false;
  for (let i = 0; i < 90; i++) {
    await sleep(1000);
    const state = await ev(`({ready: document.readyState, loading: !!document.getElementById('loading'), canvas: !!document.querySelector('canvas')})`);
    if (state?.ready === 'complete' && !state.loading && state.canvas) { ready = true; break; }
  }
  if (!ready) throw Error('game not ready');
  await sleep(4000);
  const shot = async name => {
    const s = await cdp('Page.captureScreenshot', { format: 'png' }, 60000);
    writeFileSync(`${out}/${name}.png`, Buffer.from(s.result.data, 'base64'));
  };
  await shot('f00-stand');
  const key = (type) => cdp('Input.dispatchKeyEvent', { type, code: 'Space', key: ' ', keyCode: 32, windowsVirtualKeyCode: 32 });
  await cdp('Emulation.setVirtualTimePolicy', { policy: 'pause' });
  await key('keyDown');
  for (let f = 1; f <= 12; f++) {
    const done = new Promise(r => { const h = ws.onmessage; ws.onmessage = e => { h(e); if (JSON.parse(e.data).method === 'Emulation.virtualTimeBudgetExpired') { ws.onmessage = h; r(); } }; });
    await cdp('Emulation.setVirtualTimePolicy', { policy: 'advance', budget: 100 });
    await done;
    if (f === 1) await key('keyUp');
    await shot(`f${String(f).padStart(2, '0')}-t${f * 100}ms`);
  }
  const info = await ev(`({href: location.href, w: innerWidth, h: innerHeight, title: document.title})`);
  writeFileSync(`${out}/observations.json`, JSON.stringify({ port: PORT, url, info, errors: errors.slice(0, 20), logs: logs.filter(l => /BENCH|error|wolf/i.test(l)).slice(0, 30) }, null, 2));
  console.log(JSON.stringify({ out, info, errors: errors.length }));
} finally {
  ws?.close();
  chrome.kill('SIGKILL');
  try { rmSync(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }); } catch { /* chrome may still hold the profile */ }
}
