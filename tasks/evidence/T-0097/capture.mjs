// In-game compass caption. node tasks/evidence/T-0097/capture.mjs <url> <out.png> <out.json>
// Stands on a woodpecker (callField) at noon and waits until the listening line leaves "Quiet nearby".
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const [url, out, meta] = process.argv.slice(2);
if (!url || !out) { console.error('usage: capture.mjs <url> <out.png> <out.json>'); process.exit(2); }
const port = 9400 + Math.floor(Math.random() * 400);
const profile = mkdtempSync(join(tmpdir(), 'boreal-sound-'));
const chrome = process.env.CHROME || 'google-chrome';
const p = spawn(chrome, [
  '--headless=new', '--hide-scrollbars', '--window-size=1280,800',
  '--autoplay-policy=no-user-gesture-required',
  '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--disable-background-timer-throttling',
  '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank',
], { stdio: 'ignore' });

let id = 0;
const pending = new Map();
const errors = [];
try {
  let tabs;
  for (let i = 0; i < 40; i++) {
    try { tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (tabs.find(t => t.type === 'page')) break; } catch { /* starting */ }
    await sleep(250);
  }
  const page = tabs.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => { ws.onopen = r; });
  ws.onmessage = m => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) { pending.get(d.id)(d.result ?? d); pending.delete(d.id); }
    if (d.method === 'Runtime.exceptionThrown') errors.push(d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text);
    if (d.method === 'Runtime.consoleAPICalled') {
      const line = d.params.args.map(a => a.value ?? a.description ?? '').join(' ');
      if (/error|fail|warn/i.test(line)) errors.push(line.slice(0, 240));
    }
  };
  const cdp = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const evalJs = async expr => {
    const r = await cdp('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    return r.result?.value;
  };
  await cdp('Runtime.enable');
  await cdp('Page.enable');
  await cdp('Page.bringToFront');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  await cdp('Page.navigate', { url });
  let ready = false;
  let heard = '';
  for (let i = 0; i < 180; i++) {
    await sleep(1000);
    const state = await evalJs(`(() => {
      const loading = document.getElementById('loading');
      const heard = document.querySelector('.sense-heard');
      const sound = document.getElementById('sound');
      return { loading: !!loading, heard: heard ? heard.textContent : '', sound: sound ? sound.textContent : '', title: document.title };
    })()`);
    if (!state) continue;
    if (!state.loading && state.heard) {
      ready = true;
      if (state.sound === 'Sound on') await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', x: 640, y: 400, button: 'left', clickCount: 1 });
      if (state.sound === 'Sound on') await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 640, y: 400, button: 'left', clickCount: 1 });
      heard = state.heard;
      if (heard && heard !== 'Quiet nearby') break;
    }
    if (i % 15 === 14) console.log(JSON.stringify({ wait: i + 1, ...state, errors: errors.slice(-2) }));
  }
  await sleep(400);
  heard = await evalJs(`document.querySelector('.sense-heard')?.textContent || ''`);
  const titles = await evalJs(`[...document.querySelectorAll('.sense-cue')].map(n => n.getAttribute('aria-label'))`);
  const shot = await cdp('Page.captureScreenshot', { format: 'png' });
  writeFileSync(out, Buffer.from(shot.data, 'base64'));
  const clip = await cdp('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 140, width: 520, height: 280, scale: 1 } });
  const clipPath = out.replace(/\.png$/, '-panel.png');
  writeFileSync(clipPath, Buffer.from(clip.data, 'base64'));
  const report = { ready, heard, titles, url, out, clipPath, errors: errors.slice(0, 8) };
  if (meta) writeFileSync(meta, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  ws.close();
  process.exit(ready && heard && heard !== 'Quiet nearby' ? 0 : 1);
} finally {
  try { p.kill('SIGKILL'); } catch { /* already gone */ }
  await sleep(300);
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* profile busy */ }
}
