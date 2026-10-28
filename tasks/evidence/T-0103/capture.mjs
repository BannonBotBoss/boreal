// T-0103: cloud or rain at a fixed Kenora noon, plus the live cell values.
// node tasks/evidence/T-0103/capture.mjs [baseUrl]
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { acquire, track, release } from '../../../tools/bench-lock.mjs';

const base = process.argv[2] ?? 'http://127.0.0.1:5284';
const out = resolve('tasks/evidence/T-0103');
const artifacts = '/opt/cursor/artifacts';
mkdirSync(out, { recursive: true });
mkdirSync(artifacts, { recursive: true });
const name = 'grokbot-3: T-0103 weather cell';
const shots = [
  { name: 'jan-noon', q: '?nomenu&noprobe&day=15&hour=12' },
  { name: 'jul-noon', q: '?nomenu&noprobe&day=196&hour=12' },
];
const sleep = ms => new Promise(r => setTimeout(r, ms));
let commit = '';
try { commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { commit = ''; }
if (!await acquire(name, { waitMs: 180000 })) throw new Error('GPU busy');
const cdpPort = 9600 + Math.floor(Math.random() * 200);
const profile = mkdtempSync(join(tmpdir(), 't0103-chrome-'));
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
  let id = 0; const pend = new Map(); const consoleErrors = [];
  ws.onmessage = m => {
    const d = JSON.parse(m.data);
    if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); }
    const text = d.method === 'Runtime.exceptionThrown' ? d.params?.exceptionDetails?.text
      : d.method === 'Runtime.consoleAPICalled' && (d.params?.type === 'error' || d.params?.type === 'warning')
        ? (d.params.args ?? []).map(a => a.value ?? a.description ?? '').join(' ')
        : '';
    if (text) consoleErrors.push(String(text).slice(0, 400));
  };
  const cdp = (method, params = {}) => new Promise((res, rej) => {
    const i = ++id;
    const t = setTimeout(() => { pend.delete(i); rej(new Error('cdp timeout ' + method)); }, 180000);
    pend.set(i, d => { clearTimeout(t); res(d); });
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  const ev = async expr => {
    const r = await cdp('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    const details = r.exceptionDetails || r.result?.exceptionDetails;
    if (details) throw new Error(JSON.stringify(details));
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
    const href = await ev('location.href');
    if (typeof href !== 'string' || !href.includes(shot.q.slice(1, 12))) throw new Error(shot.name + ' left the query: ' + href);
    await sleep(2500);
    const sample = await ev(`(async () => {
      const names = performance.getEntriesByType('resource').map(e => e.name);
      const pick = (part) => names.filter(n => n.includes(part)).at(-1);
      const w = await import(pick('/src/core/weather.ts'));
      const p = await import(pick('planetWeather.ts'));
      const c = await import(pick('/src/core/timeOfDay.ts'));
      const here = w.weatherAt(0, 0);
      const sim = p.planetWeatherSim();
      const layerZ = 0.5 * w.DY;
      const target = w.cellClimate(w.WEATHER.day, w.WEATHER.hour, layerZ, 0, 0);
      let planet = null;
      if (sim && sim.n > 0) {
        const planetMod = await import(pick('/src/world/globe/planet.ts'));
        const world = await import(pick('/src/core/world.ts'));
        const ll = planetMod.toLatLon(planetMod.planetFor(world.WORLD_SEED).fromLocal(0, 0));
        planet = p.weatherAtLatLon(ll.lat * 180 / Math.PI, ll.lon * 180 / Math.PI);
      }
      return {
        href: location.href,
        day: w.WEATHER.day, hour: w.WEATHER.hour, steps: w.WEATHER.steps,
        clockDay: c.dayAt(0),
        live: w.nearCellLive(),
        tC: here.tC, rh: here.rh, cloud: here.cloud, rainMmH: here.rainMmH, snow: here.snow,
        sweMm: here.sweMm, depthCm: here.depthCm, derivedCm: w.snowDepthCm(here.sweMm),
        wind: here.wind,
        target: { source: target.source, surfaceTC: target.surfaceTC, layerTC: target.tC, p: target.p, rh: target.rh, cloud: target.cloud, precipMmH: target.precipMmH, u: target.u, v: target.v },
        planet: planet && { tC: planet.tC, rh: planet.rh, cloud: planet.cloud, precipMmH: planet.precipMmH, snow: planet.snow, sweMm: planet.sweMm },
        status: document.getElementById('status') ? document.getElementById('status').innerText.split('\\n')[0] : '',
      };
    })()`);
    if (!sample || !sample.live || sample.target?.source !== 'planet') {
      console.error(shot.name, 'sample', JSON.stringify(sample));
      console.error('console', JSON.stringify(consoleErrors.slice(0, 20)));
      const body = await ev(`document.body ? document.body.innerText.slice(0, 500) : ''`);
      console.error('body', body);
      throw new Error(shot.name + ' cell was not live');
    }
    const png = await cdp('Page.captureScreenshot', { format: 'png' });
    const file = join(out, shot.name + '.png');
    writeFileSync(file, Buffer.from(png.result.data, 'base64'));
    copyFileSync(file, join(artifacts, 'T-0103-' + shot.name + '.png'));
    observations.push({ ...shot, url: base + shot.q, ms: Date.now() - t0, sample });
    console.log(shot.name, JSON.stringify(sample));
  }
  writeFileSync(join(out, 'observations.json'), JSON.stringify({
    commit, viewport: { width: 1280, height: 720 },
    note: 'Diagnostic date jump via ?day= (not natural motion). January is day 15 noon, July is day 196 noon. nomenu, noprobe. The cell values are the live near grid. No sun-angle score.',
    consoleErrors: consoleErrors.slice(0, 40),
    observations,
  }, null, 2));
  copyFileSync(join(out, 'observations.json'), join(artifacts, 'T-0103-observations.json'));
} finally {
  ws?.close();
  try { proc.kill(); } catch { /* already gone */ }
  release(name);
}
