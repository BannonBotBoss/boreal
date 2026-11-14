/**
 * Post-fix screen recording + frame sampler + runtime telemetry for Boreal animal circadian / seasonal photoperiod (T-0172).
 * Uses agy preview port 5252 and tools/bench-lock.mjs, cleaning up all processes and temp profile before exit.
 */
import { spawn, execSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquire, track, release } from '../../../tools/bench-lock.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
mkdirSync(__dirname, { recursive: true });

const PORT = 5252;
const BASE_URL = process.env.BOREAL_URL || `http://127.0.0.1:${PORT}`;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const CDP_PORT = 9363;
const WORK_ROOT = resolve(__dirname, '../../../work');
const PROFILE = resolve(WORK_ROOT, 'edge-photoperiod-fix-profile');
const LOCK_NAME = 'agy: T-0172-photoperiod-fix';

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
        await srv.transformRequest('/src/core/needs/behaviour.ts');
      `;
      viteProc = spawn(process.execPath, ['--input-type=module', '-e', viteBoot], {
        stdio: 'ignore',
        cwd: resolve(__dirname, '../../..'),
      });
      if (viteProc.pid) track(viteProc.pid);
      let up = false;
      for (let i = 0; i < 40; i++) {
        try {
          const r = await fetch(`${BASE_URL}/src/core/needs/behaviour.ts`);
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
    ws.onmessage = (ev) => {
      const msg = JSON.parse(String(ev.data));
      if (msg.id && pending.has(msg.id)) {
        const { resolve: r, reject: j } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) j(new Error(msg.error.message));
        else r(msg.result);
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

    const loadScenario = async ({ url, siteLat, siteLon, day, hour, yaw, outPng, label }) => {
      await send('Page.navigate', { url });
      let ready = false;
      for (let i = 0; i < 60; i++) {
        await sleep(500);
        ready = await evalJs(`Boolean(document.readyState === 'complete' && !document.getElementById('loading') && document.getElementById('status') && document.getElementById('autonomous') && window.borealHares)`);
        if (ready) break;
      }
      if (!ready) throw new Error(`Game did not finish loading for ${label}`);
      await sleep(1000);

      await evalJs(`(async () => {
        const findMod = (sub) => {
          const entries = performance.getEntriesByType('resource').map((r) => r.name);
          return entries.find((n) => n.includes(sub)) || sub;
        };
        window.__tod = await import(findMod('/src/core/timeOfDay.ts'));
        window.__wc = await import(findMod('/src/core/worldClock.ts'));
        window.__sp = await import(findMod('/src/core/sitePhase.ts'));
        window.__beh = await import(findMod('/src/core/needs/behaviour.ts'));
        const canvas = document.querySelector('canvas');
        const stream = canvas.captureStream(20);
        const chunks = [];
        const rec = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' });
        rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
        window.__recChunks = chunks;
        window.__rec = rec;
        rec.start(100);
        return true;
      })()`);

      await evalJs(`(() => {
        if (${siteLat !== null}) {
          window.__sp.SITE.remote = true;
          window.__sp.SITE.latDeg = ${siteLat};
          window.__sp.SITE.lonDeg = ${siteLon};
        } else {
          window.__sp.clearSite();
        }
        const wNow = window.__wc.worldSec();
        window.__tod.setHour(${hour}, wNow);
        window.__tod.setDay(${day}, wNow);
        const p = window.__boreal.player();
        const h2 = window.borealHares.list().find((h) => h.id === 2) || window.borealHares.list()[0];
        if (h2) {
          h2.x = p.x - Math.sin(${yaw}) * 12;
          h2.z = p.z - Math.cos(${yaw}) * 12;
          h2.sim.x = h2.x;
          h2.sim.z = h2.z;
        }
        window.borealPlace?.(p.x, p.z, ${yaw}, 0.08);
        const btn = document.getElementById('autonomous');
        if (btn && btn.getAttribute('aria-pressed') !== 'true') btn.click();
        return true;
      })()`);
      await sleep(900);

      const frameObs = await evalJs(`(() => {
        const tod = window.__tod, wc = window.__wc, sp = window.__sp, beh = window.__beh;
        const wNow = wc.worldSec();
        const day = tod.dayAt(wNow);
        const hour = tod.hourAt(wNow);
        const lat = sp.siteLatitude(tod.LATITUDE);
        const sunEl = tod.sunPosition(hour, day, lat).elevation;
        const sunTimesDefault = beh.sunTimes(day);
        const sunTimesSite = beh.sunTimes(day, lat);
        const statusText = document.getElementById('status')?.innerText || '';
        const autoBtn = document.getElementById('autonomous')?.textContent || '';
        return {
          label: ${JSON.stringify(label)},
          day,
          hour: Math.round(hour * 10000) / 10000,
          siteLat: lat,
          skySunElevationDeg: Math.round(sunEl * 10000) / 10000,
          sunTimesDefault,
          sunTimesSite,
          autonomousButton: autoBtn,
          statusFirstLine: statusText.split('\\n')[0] || '',
        };
      })()`);
      await snapPng(outPng);

      const webmB64 = await evalJs(`new Promise((resolve) => {
        const rec = window.__rec;
        rec.onstop = async () => {
          const blob = new Blob(window.__recChunks, { type: 'video/webm' });
          const reader = new FileReader();
          reader.onloadend = () => resolve(String(reader.result).split(',')[1] || '');
          reader.readAsDataURL(blob);
        };
        rec.stop();
      })`);

      return { frameObs, webmBuf: Buffer.from(webmB64, 'base64') };
    };

    const s0 = await loadScenario({
      url: `${BASE_URL}/?nomenu&noprobe&view=ground&rec&day=172&hour=21.8&needs=water:90,energy:65,rest:80`,
      siteLat: 64.5,
      siteLon: -119.7,
      day: 172,
      hour: 21.8,
      yaw: 0.57,
      outPng: 'frame-0.png',
      label: 'post_fix_subarctic_summer_dusk_64_5N_day172_hour21_8',
    });

    const s1 = await loadScenario({
      url: `${BASE_URL}/?nomenu&noprobe&view=ground&rec&day=355&hour=8.0&needs=water:90,energy:65,rest:80`,
      siteLat: 64.5,
      siteLon: -119.7,
      day: 355,
      hour: 8.0,
      yaw: -Math.PI / 2,
      outPng: 'frame-1.png',
      label: 'post_fix_subarctic_winter_night_64_5N_day355_hour8_0',
    });

    const s2 = await loadScenario({
      url: `${BASE_URL}/?nomenu&noprobe&view=ground&rec&day=227&hour=6.0&needs=water:90,energy:65,rest:80`,
      siteLat: null,
      siteLon: null,
      day: 227,
      hour: 6.0,
      yaw: -Math.PI / 2,
      outPng: 'frame-2.png',
      label: 'post_fix_home_dawn_positive_control_49_5N_day227_hour6_0',
    });

    writeFileSync(resolve(__dirname, 'recording.webm'), s0.webmBuf);

    const obs = {
      capturedAt: new Date().toISOString(),
      baseUrl: BASE_URL,
      frames: [s0.frameObs, s1.frameObs, s2.frameObs],
    };
    writeFileSync(resolve(__dirname, 'observations.json'), JSON.stringify(obs, null, 2) + '\n', 'utf8');
    console.log(JSON.stringify(obs, null, 2));
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
