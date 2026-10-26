// T-0082: forest weather before (wasm absent, climateRaw) and after (Rust grid).
// Same dates via ?day=&hour=. Run from the repo root with Vite already serving this checkout.
// node tasks/evidence/T-0082/capture.mjs [baseUrl]
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { acquire, track, release } from '../../../tools/bench-lock.mjs';

const base = process.argv[2] ?? 'http://127.0.0.1:5173';
const out = resolve('tasks/evidence/T-0082');
const wasm = resolve('public/wasm/boreal_sim.wasm');
const wasmHide = join(tmpdir(), 'boreal_sim.wasm.t0082');
const name = 'grokbot-2: T-0082 forest weather';
const shots = [
  { name: 'jan-before', q: '?nomenu&noprobe&day=15&hour=12', wasm: false },
  { name: 'jul-before', q: '?nomenu&noprobe&day=196&hour=12', wasm: false },
  { name: 'jan-after', q: '?nomenu&noprobe&day=15&hour=12', wasm: true },
  { name: 'jul-after', q: '?nomenu&noprobe&day=196&hour=12', wasm: true },
];
const sleep = ms => new Promise(r => setTimeout(r, ms));
if (!await acquire(name, { waitMs: 120000 })) throw new Error('GPU busy');
const cdpPort = 9340 + Math.floor(Math.random() * 200);
const profile = mkdtempSync(join(tmpdir(), 't0082-chrome-'));
const chrome = process.env.CHROME ?? '/usr/bin/google-chrome';
const proc = spawn(chrome, [
  '--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--hide-scrollbars', '--window-size=1280,720',
  `--remote-debugging-port=${cdpPort}`, `--user-data-dir=${profile}`, 'about:blank',
], { stdio: 'ignore' });
track(proc.pid);
let ws;
function setWasm(on) {
  if (on) { if (existsSync(wasmHide) && !existsSync(wasm)) renameSync(wasmHide, wasm); }
  else if (existsSync(wasm)) renameSync(wasm, wasmHide);
}
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
    if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails));
    return r.result?.result?.value;
  };
  await cdp('Page.enable');
  await cdp('Runtime.enable');
  await cdp('Network.enable');
  await cdp('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  const observations = [];
  for (const shot of shots) {
    setWasm(shot.wasm);
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
        driving: !!(sim && sim.n > 0), gridDay: sim && sim.day, gridHour: sim && sim.hour,
        tC: here.tC, rh: here.rh, cloud: here.cloud, rainMmH: here.rainMmH, snow: here.snow, sweMm: here.sweMm,
        wind: here.wind, fog: here.fog,
      };
    })()`);
    if (shot.wasm && !sample.driving) throw new Error(shot.name + ' did not bind the planet grid');
    const png = await cdp('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(out, shot.name + '.png'), Buffer.from(png.result.data, 'base64'));
    observations.push({ ...shot, url: base + shot.q, ms: Date.now() - t0, sample });
    console.log(shot.name, JSON.stringify(sample));
  }
  writeFileSync(join(out, 'observations.json'), JSON.stringify({
    note: 'before = wasm file moved aside, so weatherAt is climateRaw. after = the Rust tair/rh/wind/precip/snow planes via weatherAtLatLon.',
    kenoraNormals: { januaryC: -16.0, julyC: 19.2, source: 'ECCC 1981-2010 Kenora A, weather.ts NORMALS.temp[0] and [6]' },
    solarParity: 'tests/planet-budget.test.ts wasm solarCell vs weather.ts solar()/shortwave() within 1e-9; toa plane after boot vs solar() within 1e-6 (tests/planet-weather.test.ts)',
    observations,
  }, null, 2));
} finally {
  setWasm(true);
  ws?.close();
  release(name);
}
