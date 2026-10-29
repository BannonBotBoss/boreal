// T-0107: the animal already standing, then the view after entering it in that same spot.
// Day 15, hour 12. No ?at= : the place is the store stand.
// node tasks/evidence/T-0107/capture.mjs [baseUrl]
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { acquire, track, release } from '../../../tools/bench-lock.mjs';

const base = process.argv[2] ?? 'http://127.0.0.1:5277';
const out = resolve('tasks/evidence/T-0107');
const artifacts = '/opt/cursor/artifacts';
mkdirSync(out, { recursive: true });
mkdirSync(artifacts, { recursive: true });
const shots = [
  { name: 'before-entry', q: '?nomenu&noprobe&rec&day=15&hour=12&watch=1' },
  { name: 'after-entry', q: '?nomenu&noprobe&rec&day=15&hour=12' },
];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const name = 'grokbot-3: T-0107 enter living animal';
if (!await acquire(name, { waitMs: 120000 })) throw new Error('GPU busy');
const cdpPort = 9467;
const profile = mkdtempSync(join(tmpdir(), 't0107-chrome-'));
const chrome = process.env.CHROME ?? '/usr/bin/google-chrome';
const proc = spawn(chrome, [
  '--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--hide-scrollbars', '--disable-extensions', '--no-first-run',
  '--window-size=1280,720', `--remote-debugging-port=${cdpPort}`, `--user-data-dir=${profile}`, 'about:blank',
], { stdio: 'ignore' });
track(proc.pid);
let ws;
try {
  let tabs;
  for (let k = 0; k < 40 && !tabs; k++) {
    await sleep(250);
    try { tabs = await (await fetch(`http://127.0.0.1:${cdpPort}/json`)).json(); } catch { /* chrome still starting */ }
  }
  if (!tabs) throw new Error('chrome devtools did not open');
  ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pend = new Map();
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } };
  const cdp = (method, params = {}) => new Promise((res, rej) => {
    const i = ++id;
    const t = setTimeout(() => { pend.delete(i); rej(new Error('cdp timeout ' + method)); }, 180000);
    pend.set(i, d => { clearTimeout(t); res(d); });
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  const ev = async expr => {
    const r = await cdp('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    const body = r.result ?? {};
    if (body.exceptionDetails) {
      const d = body.exceptionDetails;
      return { error: d.exception?.description || d.text || 'evaluate failed' };
    }
    return body.result?.value;
  };
  await cdp('Page.enable');
  await cdp('Runtime.enable');
  await cdp('Network.enable');
  await cdp('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp('Page.addScriptToEvaluateOnNewDocument', { source: 'localStorage.clear(); sessionStorage.clear();' });
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  const observations = [];
  for (const shot of shots) {
    const t0 = Date.now();
    await cdp('Page.navigate', { url: base + shot.q });
    let loaded = false;
    while (Date.now() - t0 < 180000) {
      await sleep(1000);
      try { loaded = await ev(`document.readyState === 'complete' && !document.getElementById('loading')`) === true; } catch { loaded = false; }
      if (loaded) break;
    }
    if (!loaded) throw new Error(shot.name + ' still loading');
    await sleep(8000);
    const sample = await ev(`(() => {
      const status = document.getElementById('status');
      const probe = window.__boreal;
      let player = null;
      try { player = probe && probe.player ? probe.player() : null; } catch (e) { player = { error: String(e) }; }
      return { href: location.href, status: status ? status.innerText.split('\\n')[0] : '', player };
    })()`);
    const png = await cdp('Page.captureScreenshot', { format: 'png' });
    const file = join(out, shot.name + '.png');
    writeFileSync(file, Buffer.from(png.result.data, 'base64'));
    copyFileSync(file, join(artifacts, 'T-0107-' + shot.name + '.png'));
    observations.push({ ...shot, url: base + shot.q, ms: Date.now() - t0, sample });
    console.log(shot.name, JSON.stringify(sample));
  }
  writeFileSync(join(out, 'observations.json'), JSON.stringify({
    viewport: { width: 1280, height: 720 },
    note: 'Day 15, hour 12. Before: ?watch=1, the rider camera pulled back. After: the same stand, rider height. No ?at=. The place is the stored wolf.',
    observations,
  }, null, 2));
} finally {
  ws?.close();
  release(name);
}
