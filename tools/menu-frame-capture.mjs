// Measure the pad menu's top and height on each layer. Chrome DevTools protocol, no extra package.
// node tools/menu-frame-capture.mjs <url> <out.json> [screenshot.png] [width] [height]
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const [, , url, outJson, shot, width = '1280', height = '720'] = process.argv;
if (!url || !outJson) { console.error('usage: menu-frame-capture.mjs <url> <out.json> [shot.png] [w] [h]'); process.exit(2); }
const port = 9333 + Math.floor(Math.random() * 200);
const chrome = spawn('/opt/google/chrome/chrome', [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${port}`, `--window-size=${width},${height}`, 'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function version() {
  for (let i = 0; i < 40; i++) {
    try { const r = await fetch(`http://127.0.0.1:${port}/json/version`); if (r.ok) return r.json(); } catch { /* booting */ }
    await sleep(100);
  }
  throw new Error('chrome devtools did not open');
}
await version();
const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const page = list.find(t => t.type === 'page');
if (!page) throw new Error('no page target');
const ws = new WebSocket(page.webSocketDebuggerUrl);
let seq = 0; const pending = new Map();
ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
});
await new Promise(r => ws.addEventListener('open', r, { once: true }));
const call = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++seq;
  pending.set(id, m => { if (m.error) reject(new Error(method + ' ' + JSON.stringify(m.error))); else resolve(m.result); });
  ws.send(JSON.stringify({ id, method, params }));
  setTimeout(() => { if (pending.has(id)) { pending.delete(id); reject(new Error('timeout ' + method)); } }, 15000);
});
await call('Page.enable');
await call('Runtime.enable');
await call('Emulation.setDeviceMetricsOverride', { width: Number(width), height: Number(height), deviceScaleFactor: 1, mobile: false });
await call('Page.navigate', { url });
const deadline = Date.now() + 12000;
let text = '';
while (Date.now() < deadline) {
  await sleep(150);
  const ev = await call('Runtime.evaluate', { expression: `document.title === 'measured' ? document.getElementById('out').textContent : ''`, returnByValue: true });
  text = ev.result.value || '';
  if (text.startsWith('{')) break;
}
if (!text.startsWith('{')) throw new Error('menu did not measure: ' + text);
writeFileSync(outJson, JSON.stringify(JSON.parse(text), null, 2) + '\n');
if (shot) {
  const png = await call('Page.captureScreenshot', { format: 'png' });
  writeFileSync(shot, Buffer.from(png.data, 'base64'));
}
ws.close(); chrome.kill();
console.log(outJson);
