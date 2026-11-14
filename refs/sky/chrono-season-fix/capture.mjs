/**
 * Post-fix screen recording + frame sampler + runtime telemetry for Boreal Chronometer & Venus site/date propagation (T-0170).
 * Uses agy preview port 5253 and tools/bench-lock.mjs, cleaning up all processes and temp profile before exit.
 */
import { spawn, execSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquire, track, release } from '../../../tools/bench-lock.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
mkdirSync(__dirname, { recursive: true });

const PORT = 5253;
const BASE_URL = process.env.BOREAL_URL || `http://127.0.0.1:${PORT}`;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const CDP_PORT = 9364;
const WORK_ROOT = resolve(__dirname, '../../../work');
const PROFILE = resolve(WORK_ROOT, 'edge-chrono-fix-profile');
const LOCK_NAME = 'agy: T-0170-chrono-venus-fix';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  if (!(await acquire(LOCK_NAME))) throw new Error('Timed out waiting for bench-lock');
  let viteProc = null;
  let edge = null;
  try {
    if (!process.env.BOREAL_URL) {
      const viteBoot = `
        import { createServer } from 'vite';
        const srv = await createServer({
          server: { host: '127.0.0.1', port: ${PORT}, strictPort: true, watch: null },
          logLevel: 'error',
        });
        await srv.listen();
        await srv.transformRequest('/src/main.ts');
        await srv.transformRequest('/src/ui/chronometer.ts');
        await srv.transformRequest('/src/render/venusSky.ts');
      `;
      viteProc = spawn(process.execPath, ['--input-type=module', '-e', viteBoot], {
        stdio: 'ignore',
        cwd: resolve(__dirname, '../../..'),
      });
      if (viteProc.pid) track(viteProc.pid);
      let up = false;
      for (let i = 0; i < 60; i++) {
        try {
          const r = await fetch(`${BASE_URL}/src/ui/chronometer.ts`);
          if (r.ok) { up = true; break; }
        } catch {}
        await sleep(500);
      }
      if (!up) throw new Error(`Vite server did not start on ${BASE_URL}`);
    }

    rmSync(PROFILE, { recursive: true, force: true });
    mkdirSync(PROFILE, { recursive: true });

    edge = spawn(EDGE, [
      '--headless=new',
      '--disable-extensions',
      '--no-first-run',
      '--no-default-browser-check',
      `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=${PROFILE}`,
      '--window-size=1280,720',
      '--mute-audio',
      'about:blank',
    ], { stdio: 'ignore' });
    if (edge.pid) track(edge.pid);

    let wsUrl = null;
    for (let i = 0; i < 40; i++) {
      await sleep(250);
      try {
        const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
        const pages = await res.json();
        const page = pages.find((p) => p.type === 'page' && p.webSocketDebuggerUrl);
        if (page) { wsUrl = page.webSocketDebuggerUrl; break; }
      } catch {}
    }
    if (!wsUrl) throw new Error('Failed to connect to headless Edge CDP');

    const ws = new WebSocket(wsUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

    let seq = 1;
    const pending = new Map();
    const pageErrors = [];
    ws.onmessage = (ev) => {
      const msg = JSON.parse(String(ev.data));
      if (msg.id && pending.has(msg.id)) {
        const { resolve: r, reject: j } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) j(new Error(msg.error.message));
        else r(msg.result);
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        pageErrors.push(msg.params?.exceptionDetails?.text || 'exception');
      }
    };
    const send = (method, params = {}) => new Promise((r, j) => {
      const id = seq++;
      pending.set(id, { resolve: r, reject: j });
      ws.send(JSON.stringify({ id, method, params }));
    });
    const evalJs = async (expression) => {
      const res = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (res?.exceptionDetails) throw new Error(`Eval error: ${res.exceptionDetails.text} ${res.exceptionDetails.exception?.description || ''}`);
      return res?.result?.value;
    };
    const snapPng = async (outFile) => {
      await evalJs(`(() => { if (window.__rec && window.__rec.state === 'recording') window.__rec.pause(); return true; })()`);
      await sleep(100);
      const res = await Promise.race([
        send('Page.captureScreenshot', { format: 'png' }),
        sleep(15000).then(() => { throw new Error('captureScreenshot timeout'); }),
      ]);
      writeFileSync(resolve(__dirname, outFile), Buffer.from(res.data, 'base64'));
      await evalJs(`(() => { if (window.__rec && window.__rec.state === 'paused') window.__rec.resume(); return true; })()`);
    };

    await send('Page.enable');
    await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });

    const url = `${BASE_URL}/?nomenu&noprobe&view=ground&rec&day=355&hour=12`;
    await send('Page.navigate', { url });
    let ready = false;
    for (let i = 0; i < 80; i++) {
      await sleep(500);
      ready = await evalJs(`Boolean(document.readyState === 'complete' && !document.getElementById('loading') && document.getElementById('status'))`);
      if (ready) break;
    }
    if (!ready) {
      const diag = await evalJs(`({ readyState: document.readyState, hasLoading: !!document.getElementById('loading'), loadingText: document.getElementById('loading')?.innerText })`);
      throw new Error(`Game did not finish loading: ${JSON.stringify({ diag, pageErrors })}`);
    }
    await sleep(1200);

    await evalJs(`(async () => {
      const findMod = (sub) => {
        const entries = performance.getEntriesByType('resource').map((r) => r.name);
        return entries.find((n) => n.includes(sub)) || sub;
      };
      window.__tod = await import(findMod('/src/core/timeOfDay.ts'));
      window.__wc = await import(findMod('/src/core/worldClock.ts'));
      window.__sp = await import(findMod('/src/core/sitePhase.ts'));
      window.__we = await import(findMod('/src/core/weather.ts'));
      window.__ch = await import(findMod('/src/ui/chronometer.ts'));
      window.__vs = await import(findMod('/src/render/venusSky.ts'));
      window.borealPlace?.(0, 0, Math.PI, 0.28);
      const canvas = document.querySelector('canvas');
      const stream = canvas.captureStream(20);
      const chunks = [];
      const rec = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' });
      rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
      window.__recChunks = chunks;
      window.__rec = rec;
      window.__recStart = performance.now();
      rec.start(100);
      return true;
    })()`);

    // Open Chronometer once with 't' and keep it open across all 4 frames to prove live redraw + (day, lat) dial-gradient refresh
    await evalJs(`(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 't', code: 'KeyT', bubbles: true }));
      return true;
    })()`);
    await sleep(120);
    await evalJs(`(() => {
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 't', code: 'KeyT', bubbles: true }));
      return true;
    })()`);
    await sleep(300);

    const configs = [
      { label: 'winter_solstice_noon_home_49_79N', day: 355, hour: 12.0, remoteLat: null, remoteLon: null, yaw: Math.PI, pitch: 0.25 },
      { label: 'winter_solstice_dusk_home_49_79N_16h30', day: 355, hour: 16.5, remoteLat: null, remoteLon: null, yaw: Math.PI + 0.65, pitch: 0.16 },
      { label: 'december_solstice_noon_namib_23_44S_15_0E', day: 355, hour: 12.0, remoteLat: -23.44, remoteLon: 15.0, yaw: 0.0, pitch: 0.35 },
      { label: 'august_positive_control_noon_home_49_79N', day: 227, hour: 12.0, remoteLat: null, remoteLon: null, yaw: Math.PI, pitch: 0.35 },
    ];

    const observations = [];
    for (let i = 0; i < configs.length; i++) {
      const cfg = configs[i];
      await evalJs(`(() => {
        const sec = window.__wc.worldSec();
        if (${cfg.remoteLat === null}) {
          window.__sp.clearSite();
        } else {
          window.__sp.setSite({
            latDeg: ${cfg.remoteLat},
            lonDeg: ${cfg.remoteLon},
            datumM: 0,
            salt: 1,
            treeShare: 0,
            dir: [0, 1, 0],
            east: [1, 0, 0],
            north: [0, 0, 1],
          });
        }
        window.__tod.setDay(${cfg.day}, sec);
        window.__tod.setHour(${cfg.hour}, sec);
        window.borealPlace?.(0, 0, ${cfg.yaw}, ${cfg.pitch});
        return true;
      })()`);
      await sleep(750);

      const obs = await evalJs(`(() => {
        const sec = window.__wc.worldSec();
        const day = window.__tod.dayAt(sec);
        const hr = window.__tod.hourAt(sec);
        const lat = window.__sp.siteLatitude(window.__we.SITE.lat);
        const lon = window.__sp.siteLongitude(window.__we.SITE.lon);
        const chronoState = window.__ch.chronoSunState(sec);
        const skySun = window.__tod.sunPosition(hr, day, lat);
        const chronoEl = document.querySelector('.chronometer');
        const sunText = chronoEl?.querySelector('.chrono-face small')?.textContent ?? null;
        const timeText = chronoEl?.querySelector('.chrono-face b')?.textContent ?? null;
        const glyphText = chronoEl?.querySelector('.chrono-glyph')?.textContent ?? null;
        const dialBg = chronoEl?.querySelector('.chrono-dial')?.style.background ?? null;
        return {
          frame: ${i},
          label: ${JSON.stringify(cfg.label)},
          videoSec: Math.round(((performance.now() - window.__recStart) / 1000) * 100) / 100,
          day,
          hour: Math.round(hr * 10000) / 10000,
          latitude: lat,
          longitude: lon,
          chronoOpen: chronoEl ? !chronoEl.hidden : false,
          timeText,
          sunText,
          glyphText,
          dialBgSample: dialBg ? dialBg.slice(0, 180) : null,
          chronoSunElevation: Math.round(chronoState.elevation * 10000) / 10000,
          skySunElevationSite: Math.round(skySun.elevation * 10000) / 10000,
          elevationErrorDeg: Math.round((chronoState.elevation - skySun.elevation) * 10000) / 10000,
          liveVenusProbe: window.__venus ?? null,
          statusFirstLine: (document.getElementById('status')?.innerText || '').split('\\n')[0] || '',
        };
      })()`);
      observations.push(obs);
      await snapPng(`frame-${i}.png`);
    }

    const webmB64 = await evalJs(`new Promise((resolve) => {
      const rec = window.__rec;
      rec.onstop = () => {
        const blob = new Blob(window.__recChunks, { type: 'video/webm' });
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result).split(',')[1] || '');
        reader.readAsDataURL(blob);
      };
      rec.stop();
    })`);
    writeFileSync(resolve(__dirname, 'recording.webm'), Buffer.from(webmB64, 'base64'));

    const outJson = {
      capturedAt: new Date().toISOString(),
      baseUrl: BASE_URL,
      observations,
      pageErrors,
    };
    writeFileSync(resolve(__dirname, 'observations.json'), JSON.stringify(outJson, null, 2) + '\n', 'utf8');
    console.log(JSON.stringify(outJson, null, 2));
    ws.close();
  } finally {
    if (edge?.pid) {
      try { execSync(`taskkill /PID ${edge.pid} /T /F`, { stdio: 'ignore' }); } catch {}
    }
    if (viteProc?.pid) {
      try { execSync(`taskkill /PID ${viteProc.pid} /T /F`, { stdio: 'ignore' }); } catch {}
    }
    release(LOCK_NAME);
    rmSync(WORK_ROOT, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
