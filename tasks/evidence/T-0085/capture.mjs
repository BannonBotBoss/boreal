// T-0085: same forest pose before and after the sea and rain-shadow terms.
// The date and the camera query stay fixed. Run from the repo root with Vite already serving this checkout.
// node tasks/evidence/T-0085/capture.mjs before|after [baseUrl]
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { acquire, track, release } from '../../../tools/bench-lock.mjs';

const which = ['before', 'after', 'fixed'].includes(process.argv[2]) ? process.argv[2] : 'before';
const base = process.argv[3] ?? 'http://127.0.0.1:5275';
const out = resolve('tasks/evidence/T-0085');
const name = `grokbot-3: T-0085 forest ${which}`;
const shots = [
  { name: `jan-${which}`, q: '?nomenu&noprobe&day=15&hour=12' },
  { name: `jul-${which}`, q: '?nomenu&noprobe&day=196&hour=12' },
];
const sleep = ms => new Promise(r => setTimeout(r, ms));
if (!await acquire(name, { waitMs: 120000 })) throw new Error('GPU busy');
const cdpPort = 9440 + Math.floor(Math.random() * 200);
const profile = mkdtempSync(join(tmpdir(), 't0085-chrome-'));
const chrome = process.env.CHROME ?? '/usr/bin/google-chrome';
const proc = spawn(chrome, [
  '--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--hide-scrollbars', '--window-size=1280,720',
  `--remote-debugging-port=${cdpPort}`, `--user-data-dir=${profile}`, 'about:blank',
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
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
    return r.result?.result?.value;
  };
  await cdp('Page.enable');
  await cdp('Runtime.enable');
  await cdp('Network.enable');
  await cdp('Network.setCacheDisabled', { cacheDisabled: true });
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
    await sleep(2500);
    const sample = await ev(`(async () => {
      const names = performance.getEntriesByType('resource').map(e => e.name);
      const pick = (part) => names.filter(n => n.includes(part)).at(-1);
      const w = await import(pick('/src/core/weather.ts'));
      const p = await import(pick('planetWeather.ts'));
      const c = await import(pick('/src/core/timeOfDay.ts'));
      const here = w.weatherAt(0, 0);
      const sim = p.planetWeatherSim();
      return {
        day: w.WEATHER.day, hour: w.WEATHER.hour, clockDay: c.dayAt(0), clockHour: c.hourAt(0),
        driving: !!(sim && sim.n > 0),
        tC: here.tC, rh: here.rh, cloud: here.cloud, rainMmH: here.rainMmH, snow: here.snow, sweMm: here.sweMm,
        wind: here.wind,
      };
    })()`);
    if (!sample.driving) throw new Error(shot.name + ' did not bind the planet grid');
    const png = await cdp('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(out, shot.name + '.png'), Buffer.from(png.result.data, 'base64'));
    observations.push({ ...shot, url: base + shot.q, ms: Date.now() - t0, sample });
    console.log(shot.name, JSON.stringify(sample));
  }
  writeFileSync(join(out, `observations-${which}.json`), JSON.stringify({
    which,
    note: 'Same query: nomenu, noprobe, noon. before is the planet grid without the sea-distance term or the upslope term. after is the merged sea term (long fetch, four-degree cells). fixed is the ocean-coast fetch on the one-degree forest grid.',
    observations,
  }, null, 2));
} finally {
  ws?.close();
  release(name);
}
