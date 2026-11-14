/**
 * Pre-fix screen recording + frame sampler + runtime telemetry for T-0224 (ambient callers & water sound audit).
 * Uses agy preview port 5254 and tools/bench-lock.mjs, cleaning up all processes and temp profile before exit.
 */
import { spawn, execSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquire, track, release } from '../../../tools/bench-lock.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
mkdirSync(__dirname, { recursive: true });

const PORT = 5254;
const BASE_URL = process.env.BOREAL_URL || `http://127.0.0.1:${PORT}`;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const CDP_PORT = 9365;
const WORK_ROOT = resolve(__dirname, '../../../work');
const PROFILE = resolve(WORK_ROOT, 'edge-audio-audit-profile');
const LOCK_NAME = 'agy: T-0224-audio-audit';

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
        await srv.transformRequest('/src/core/callField.ts');
        await srv.transformRequest('/src/audio/borealSound.ts');
      `;
      viteProc = spawn(process.execPath, ['--input-type=module', '-e', viteBoot], {
        stdio: 'ignore',
        cwd: resolve(__dirname, '../../..'),
      });
      if (viteProc.pid) track(viteProc.pid);
      let up = false;
      for (let i = 0; i < 60; i++) {
        try {
          const r = await fetch(`${BASE_URL}/src/core/callField.ts`);
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

    const url = `${BASE_URL}/?nomenu&noprobe&view=ground&rec&day=172&hour=21.8`;
    await send('Page.navigate', { url });
    let ready = false;
    for (let i = 0; i < 80; i++) {
      await sleep(500);
      ready = await evalJs(`Boolean(document.readyState === 'complete' && !document.getElementById('loading') && document.getElementById('status'))`);
      if (ready) break;
    }
    if (!ready) throw new Error(`Game did not finish loading: ${JSON.stringify(pageErrors)}`);
    await sleep(1200);

    await evalJs(`(async () => {
      const findMod = (sub) => {
        const entries = performance.getEntriesByType('resource').map((r) => r.name);
        return entries.find((n) => n.includes(sub)) || sub;
      };
      window.__tod = await import(findMod('/src/core/timeOfDay.ts'));
      window.__wc = await import(findMod('/src/core/worldClock.ts'));
      window.__sp = await import(findMod('/src/core/sitePhase.ts'));
      window.__cf = await import(findMod('/src/core/callField.ts'));
      window.__bs = await import(findMod('/src/audio/borealSound.ts'));
      window.__cs = await import(findMod('/src/world/globe/coverSample.ts'));
      window.__sa = await import(findMod('/src/core/stages/surfaceAt.ts'));
      window.__wd = await import(findMod('/src/core/world.ts'));
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

    const scenarios = [
      {
        label: 'perched_lake_shore_silent_water_-1192_-980',
        x: -1192,
        z: -980,
        yaw: Math.PI / 2,
        pitch: 0.14,
        day: 227,
        hour: 10.5,
        remoteLat: null,
        remoteLon: null,
        treeShare: 1,
      },
      {
        label: 'subarctic_summer_dusk_64_5N_21h48_false_night_callers',
        x: -1220,
        z: -820,
        yaw: 0.55,
        pitch: 0.15,
        day: 172,
        hour: 21.8,
        remoteLat: 64.5,
        remoteLon: -119.7,
        treeShare: 1,
      },
      {
        label: 'treeless_namib_desert_-23_44S_woodpecker_on_sand',
        x: -1500,
        z: -1180,
        yaw: -0.75,
        pitch: 0.12,
        day: 355,
        hour: 12.0,
        remoteLat: -23.44,
        remoteLon: 15.0,
        treeShare: 0,
      },
    ];

    const observations = [];
    for (let i = 0; i < scenarios.length; i++) {
      const s = scenarios[i];
      await evalJs(`(() => {
        const sec = window.__wc.worldSec();
        if (${s.remoteLat === null}) {
          window.__sp.clearSite();
        } else {
          window.__sp.setSite({
            latDeg: ${s.remoteLat},
            lonDeg: ${s.remoteLon},
            datumM: 200,
            salt: 1,
            treeShare: ${s.treeShare},
            dir: [0, 1, 0],
            east: [1, 0, 0],
            north: [0, 0, 1],
          });
        }
        window.__tod.setDay(${s.day}, sec);
        window.__tod.setHour(${s.hour}, sec);
        window.borealPlace?.(${s.x}, ${s.z}, ${s.yaw}, ${s.pitch});
        return true;
      })()`);
      await sleep(1600);

      const obs = await evalJs(`(() => {
        const sec = window.__wc.worldSec();
        const day = window.__tod.dayAt(sec);
        const hr = window.__tod.hourAt(sec);
        const lat = window.__sp.siteLatitude(window.__tod.LATITUDE);
        const sunEl = window.__tod.sunPosition(hr, day, lat).elevation;
        const p = window.__boreal.player();
        const nw = window.__bs.nearbyWater(p.x, p.z);
        const surf = window.__sa.surfaceAt(p.x, p.z, window.__wd.WORLD_SEED);
        const openWater = window.__cs.drawOpenWater(p.x, p.z);
        const callers = window.__cf.callersNear(p.x, p.z, 45, window.__cf.habitatOf, window.__wd.WORLD_SEED);
        const loonGap = window.__cf.callGap('loon', hr, day);
        const wpGap = window.__cf.callGap('woodpecker', hr, day);
        return {
          frame: ${i},
          label: ${JSON.stringify(s.label)},
          pos: { x: Math.round(p.x * 10) / 10, z: Math.round(p.z * 10) / 10 },
          day,
          hour: Math.round(hr * 1000) / 1000,
          siteLat: lat,
          siteTreeShare: window.__sp.SITE.treeShare,
          skySunElevationDeg: Math.round(sunEl * 1000) / 1000,
          nearbyWaterGain: Math.round(nw * 10000) / 10000,
          drawOpenWaterAtPos: openWater,
          surfaceHeightM: Math.round(surf.height * 100) / 100,
          callersWithin45m: callers,
          gameLoonGapSec: Number.isFinite(loonGap) ? Math.round(loonGap * 100) / 100 : 'Infinity',
          gameWoodpeckerGapSec: Number.isFinite(wpGap) ? Math.round(wpGap * 100) / 100 : 'Infinity',
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
