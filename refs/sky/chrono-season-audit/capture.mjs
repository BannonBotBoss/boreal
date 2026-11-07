// Run from repository root: node refs/sky/chrono-season-audit/capture.mjs
// Never writes outside C:\dev (uses C:\dev\boreal-agy-loop\work\edge-profile-chrono).
import { spawn, execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const out = resolve('refs/sky/chrono-season-audit');
mkdirSync(out, { recursive: true });
const profileDir = resolve('work/edge-profile-chrono');
mkdirSync(profileDir, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));

let edgeProc;
let ws;
try {
  edgeProc = spawn(
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    [
      '--headless=new',
      '--disable-extensions',
      '--no-first-run',
      '--disable-gpu-vsync',
      '--disable-frame-rate-limit',
      '--remote-debugging-port=9477',
      `--user-data-dir=${profileDir}`,
      'about:blank',
    ],
    { stdio: 'ignore' }
  );

  let tabs;
  for (let i = 0; i < 40; i++) {
    try {
      tabs = await (await fetch('http://127.0.0.1:9477/json')).json();
      break;
    } catch {
      await sleep(500);
    }
  }
  if (!tabs) throw new Error('Edge remote debugging did not start on 9477');
  ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise(r => (ws.onopen = r));

  let id = 0;
  const pending = new Map();
  const errors = [];
  ws.onmessage = e => {
    const d = JSON.parse(e.data);
    if (d.id) {
      pending.get(d.id)?.(d.result);
      pending.delete(d.id);
    }
    if (d.method === 'Runtime.exceptionThrown') errors.push(d.params);
  };
  const cdp = (method, params = {}) =>
    new Promise((r, j) => {
      const n = ++id;
      pending.set(n, r);
      ws.send(JSON.stringify({ id: n, method, params }));
      setTimeout(() => {
        if (pending.delete(n)) j(new Error(method + ' timeout'));
      }, 45000).unref();
    });
  const ev = async expression => {
    const r = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
    return r.result?.value;
  };

  await cdp('Runtime.enable');
  await cdp('Page.enable');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  const url = 'http://127.0.0.1:5173/?nomenu&noprobe&view=ground&day=355&hour=12';
  await cdp('Page.navigate', { url });

  let ready = false;
  for (let i = 0; i < 90; i++) {
    await sleep(1000);
    if (await ev("document.readyState==='complete' && !document.getElementById('loading')")) {
      ready = true;
      break;
    }
  }
  if (!ready) throw new Error('not ready: ' + (await ev('location.href')));
  await sleep(3000);

  await ev(`(async () => {
    window.auditClock = await import('/src/core/timeOfDay.ts');
    window.auditWorldClock = await import('/src/core/worldClock.ts');
    window.auditSite = await import('/src/core/sitePhase.ts');
    window.auditWeather = await import('/src/core/weather.ts');
    window.auditVenus = await import('/src/render/venusSky.ts');
    window.borealPlace?.(0, 0, Math.PI, 0.25); // Face south (yaw = Math.PI -> fx=0, fz=+1) and tilt up toward the southern sky
    const c = document.querySelector('canvas');
    window.auditStart = performance.now();
    window.auditChunks = [];
    window.auditRecorder = new MediaRecorder(c.captureStream(15), { mimeType: 'video/webm' });
    auditRecorder.ondataavailable = e => auditChunks.push(e.data);
    auditRecorder.start();
  })()`);

  // Open the chronometer dialog via keyboard 't'
  await ev(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 't', code: 'KeyT', bubbles: true }))`);
  await ev(`new Promise(r => requestAnimationFrame(r))`);
  await ev(`window.dispatchEvent(new KeyboardEvent('keyup', { key: 't', code: 'KeyT', bubbles: true }))`);
  await sleep(400);

  const observations = [];
  const configs = [
    { day: 355, hour: 12, remoteLat: null, remoteLon: null }, // Frame 0: Winter solstice noon at Kenora (49.79°N): sky is 16.79° up, chronometer says "sun 55° up"!
    { day: 355, hour: 16.5, remoteLat: null, remoteLon: null }, // Frame 1: Winter solstice 16:30 at Kenora (49.79°N): sky is -4.43° down (after sunset, twilight), chronometer says "sun 25° up" with ☀!
    { day: 355, hour: 12, remoteLat: -23.44, remoteLon: 15.0 }, // Frame 2: Southern hemisphere summer solstice noon (-23.44°S, 15.0°E): sky is 89.96° up (zenith), chronometer still says "sun 55° up"!
    { day: 227, hour: 12, remoteLat: null, remoteLon: null }, // Frame 3: August 15 noon baseline at Kenora (49.79°N)
  ];
  for (let i = 0; i < configs.length; i++) {
    const cfg = configs[i];
    await ev(`(() => {
      const sec = auditWorldClock.worldSec();
      if (${cfg.remoteLat} === null) {
        auditSite.clearSite();
      } else {
        auditSite.setSite({
          latDeg: ${cfg.remoteLat},
          lonDeg: ${cfg.remoteLon},
          datumM: 0,
          salt: 1,
          dir: [0, 1, 0],
          east: [1, 0, 0],
          north: [0, 0, 1]
        });
      }
      auditClock.setDay(${cfg.day}, sec);
      auditClock.setHour(${cfg.hour}, sec);
    })()`);
    // Toggle chronometer off across a rAF, then back on across a rAF so draw() updates the DOM!
    await ev(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 't', code: 'KeyT', bubbles: true }))`);
    await ev(`new Promise(r => requestAnimationFrame(r))`);
    await ev(`window.dispatchEvent(new KeyboardEvent('keyup', { key: 't', code: 'KeyT', bubbles: true }))`);
    await ev(`new Promise(r => requestAnimationFrame(r))`);
    await ev(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 't', code: 'KeyT', bubbles: true }))`);
    await ev(`new Promise(r => requestAnimationFrame(r))`);
    await ev(`window.dispatchEvent(new KeyboardEvent('keyup', { key: 't', code: 'KeyT', bubbles: true }))`);
    await ev(`new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))`);
    await sleep(400);
    const s = await cdp('Page.captureScreenshot', { format: 'png' });
    writeFileSync(`${out}/frame-${i}.png`, Buffer.from(s.data, 'base64'));
    observations.push(
      await ev(`(() => {
        const sec = auditWorldClock.worldSec();
        const day = auditClock.dayAt(sec);
        const hr = auditClock.hourAt(sec);
        const lat = auditSite.siteLatitude(auditWeather.SITE.lat);
        const lon = Number.isFinite(auditSite.SITE.lonDeg) ? auditSite.SITE.lonDeg : auditWeather.SITE.lon;
        const date = auditClock.clockDate(sec);
        const chronoEl = document.querySelector('.chronometer');
        const sunText = chronoEl?.querySelector('.chrono-face small')?.textContent ?? null;
        const timeText = chronoEl?.querySelector('.chrono-face b')?.textContent ?? null;
        const glyphText = chronoEl?.querySelector('.chrono-glyph')?.textContent ?? null;
        const dialBg = chronoEl?.querySelector('.chrono-dial')?.style.background ?? null;
        const undatedSun = auditClock.sunPosition(hr);
        const datedSun495 = auditClock.sunPosition(hr, day);
        const datedSunSite = auditClock.sunPosition(hr, day, lat);
        const venusHome = auditVenus.venusSky(auditVenus.utOf(date, hr));
        const venusSite = auditVenus.venusSky(auditVenus.utOf(date, hr, lon), lat, lon);
        return {
          frame: ${i},
          wallMs: performance.now(),
          videoSec: (performance.now() - auditStart) / 1000,
          day,
          hour: hr,
          latitude: lat,
          longitude: lon,
          chronoOpen: chronoEl ? !chronoEl.hidden : false,
          timeText,
          sunText,
          glyphText,
          dialBgSample: dialBg ? dialBg.slice(0, 160) : null,
          chronoSunElevation: undatedSun.elevation,
          skySunElevation495: datedSun495.elevation,
          skySunElevationSite: datedSunSite.elevation,
          elevationErrorDeg: undatedSun.elevation - datedSunSite.elevation,
          venusHomeAlt: venusHome.alt.elevation,
          venusSiteAlt: venusSite.alt.elevation,
          venusAltErrorDeg: venusHome.alt.elevation - venusSite.alt.elevation,
          status: document.getElementById('status')?.textContent
        };
      })()`)
    );
  }

  const video = await ev(`new Promise(r => {
    auditRecorder.onstop = () => {
      const f = new FileReader();
      f.onload = () => r(f.result.split(',')[1]);
      f.readAsDataURL(new Blob(auditChunks, { type: 'video/webm' }));
    };
    auditRecorder.stop();
  })`);
  writeFileSync(`${out}/recording.webm`, Buffer.from(video, 'base64'));
  writeFileSync(`${out}/observations.json`, JSON.stringify({ url, observations, errors }, null, 2));
  console.log(JSON.stringify(observations, null, 2));
} finally {
  try {
    ws?.close();
  } catch {}
  if (edgeProc?.pid) {
    try {
      execSync(`taskkill /PID ${edgeProc.pid} /T /F`, { stdio: 'ignore' });
    } catch {}
  }
}
