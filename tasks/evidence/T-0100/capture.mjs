// Wolf senses pictures. node tasks/evidence/T-0100/capture.mjs <url> <out.png> <out.json> [mode]
// mode: live (default) | strengths | rise
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const [url, out, meta, mode = 'live'] = process.argv.slice(2);
if (!url || !out) { console.error('usage: capture.mjs <url> <out.png> <out.json> [live|strengths|rise]'); process.exit(2); }
const port = 9400 + Math.floor(Math.random() * 400);
const profile = mkdtempSync(join(tmpdir(), 'boreal-pic-'));
const chrome = process.env.CHROME || 'google-chrome';
const p = spawn(chrome, [
  '--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars', '--window-size=1280,800',
  '--autoplay-policy=no-user-gesture-required',
  '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--disable-background-timer-throttling',
  '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank',
], { stdio: 'ignore' });

let id = 0;
const pending = new Map();
const errors = [];
const read = async (cdp, expr) => {
  const r = await cdp('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  return r.result?.value;
};
const panelState = `(() => {
  const loading = document.getElementById('loading');
  const panel = document.querySelector('.wolf-senses');
  const bubbles = [...document.querySelectorAll('.sense-bubble')].map(n => ({
    kind: [...n.classList].find(c => c.startsWith('sense-bubble-')) || '',
    opacity: getComputedStyle(n).opacity,
    text: n.innerText,
  }));
  const r = panel ? panel.getBoundingClientRect() : null;
  return {
    loading: !!loading,
    sound: document.getElementById('sound')?.textContent || '',
    text: panel ? panel.innerText : '',
    bubbles,
    rect: r ? { x: r.x, y: r.y, width: r.width, height: r.height } : null,
  };
})()`;

try {
  let tabs;
  for (let i = 0; i < 40; i++) {
    try { tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (tabs.find(t => t.type === 'page')) break; } catch { /* starting */ }
    await sleep(250);
  }
  const page = tabs?.find(t => t.type === 'page');
  if (!page) throw new Error('no chrome page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => { ws.onopen = r; });
  ws.onmessage = m => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) { pending.get(d.id)(d.result ?? d); pending.delete(d.id); }
    if (d.method === 'Runtime.exceptionThrown') errors.push(d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text);
  };
  const cdp = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  await cdp('Runtime.enable');
  await cdp('Page.enable');
  await cdp('Page.bringToFront');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  await cdp('Page.navigate', { url });
  let state;
  for (let i = 0; i < 90; i++) {
    await sleep(200);
    state = await read(cdp, panelState);
    if (!state || state.loading || !state.rect) continue;
    if (state.sound === 'Sound on') {
      await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', x: 640, y: 400, button: 'left', clickCount: 1 });
      await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 640, y: 400, button: 'left', clickCount: 1 });
    }
    if ((mode === 'strengths' || mode === 'rise') && state.rect) break;
    const want = mode === 'live' ? 1 : 3;
    if (state.bubbles.length >= want || (mode === 'live' && i > 20 && state.text)) break;
  }
  const save = async (png, json) => {
    const now = await read(cdp, panelState);
    const shot = await cdp('Page.captureScreenshot', { format: 'png' });
    writeFileSync(png, Buffer.from(shot.data, 'base64'));
    const rect = now?.rect;
    const clip = rect
      ? { x: Math.max(0, rect.x - 12), y: Math.max(0, rect.y - 12), width: Math.min(700, rect.width + 36), height: Math.min(480, rect.height + 36), scale: 2 }
      : { x: 0, y: 150, width: 520, height: 320, scale: 1 };
    const panel = await cdp('Page.captureScreenshot', { format: 'png', clip });
    writeFileSync(png.replace(/\.png$/, '-panel.png'), Buffer.from(panel.data, 'base64'));
    if (json) writeFileSync(json, JSON.stringify({ mode, url, ...now, errors: errors.slice(0, 6) }, null, 2));
    return now;
  };
  if (mode === 'rise' || mode === 'strengths') {
    await cdp('Page.reload');
    for (let i = 0; i < 80; i++) {
      await sleep(50);
      state = await read(cdp, panelState);
      if (!state?.bubbles?.length) break;
    }
    const want = mode === 'strengths' ? 3 : 1;
    const bright = mode === 'strengths' ? 0.65 : 0.2;
    for (let i = 0; i < 500; i++) {
      await sleep(40);
      state = await read(cdp, panelState);
      const ops = (state?.bubbles ?? []).map(b => Number(b.opacity));
      const mx = ops.length ? Math.max(...ops) : 0;
      if ((state?.bubbles?.length ?? 0) >= want && mx >= bright) break;
    }
    if (mode === 'rise') await sleep(160);
  }
  if (mode === 'rise') {
    const frames = [];
    for (let i = 0; i < 3; i++) {
      const name = out.replace(/\.png$/, `-${i + 1}.png`);
      const now = await save(name, null);
      frames.push({ file: name, bubbles: now?.bubbles, text: now?.text });
      if (i < 2) await sleep(420);
    }
    writeFileSync(meta, JSON.stringify({ mode, url, frames, errors: errors.slice(0, 6) }, null, 2));
    console.log(JSON.stringify({ mode, frames: frames.map(f => ({ file: f.file, n: f.bubbles?.length, text: f.text, opacities: f.bubbles?.map(b => b.opacity) })) }));
  } else {
    const now = await save(out, meta);
    console.log(JSON.stringify({ mode, text: now?.text, bubbles: now?.bubbles, errors: errors.slice(0, 4) }));
  }
  ws.close();
} finally {
  try { p.kill('SIGKILL'); } catch { /* gone */ }
  await sleep(200);
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* busy */ }
}
