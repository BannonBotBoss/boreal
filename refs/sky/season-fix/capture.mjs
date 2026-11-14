/**
 * Live browser screen recording + decoded .webm frame sampler + pixel-space solar disk altitude
 * recovery for T-0022 (seasonal solar date propagation).
 * Uses agy preview port 5257 and tools/bench-lock.mjs, killing Vite and headless Edge cleanly on exit.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquire, track, release } from '../../../tools/bench-lock.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
mkdirSync(__dirname, { recursive: true });

const PORT = 5257;
const BASE_URL = process.env.BOREAL_URL || `http://127.0.0.1:${PORT}`;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const CDP_PORT = 9368;
const WORK_ROOT = resolve(__dirname, '../../../work');
const PROFILE = resolve(WORK_ROOT, 'edge-seasonal-sky-fix-profile');
const LOCK_NAME = 'agy: T-0022-seasonal-sky-fix';

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
        await srv.transformRequest('/src/render/sky.ts');
        await srv.transformRequest('/src/world/globe/planet.ts');
      `;
      viteProc = spawn(process.execPath, ['--input-type=module', '-e', viteBoot], {
        stdio: 'ignore',
        cwd: resolve(__dirname, '../../..'),
      });
      if (viteProc.pid) track(viteProc.pid);
      let up = false;
      for (let i = 0; i < 60; i++) {
        try {
          const r = await fetch(`${BASE_URL}/src/render/sky.ts`);
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

    await send('Page.enable');
    await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
    await send('Page.addScriptToEvaluateOnNewDocument', {
      source: `try { localStorage.setItem('boreal.photo.v1', JSON.stringify({ focalLength: 14 })); } catch {}`,
    });

    const url = `${BASE_URL}/?nomenu&noprobe&view=ground&stages=1&rec&day=227&hour=12`;
    await send('Page.navigate', { url });

    let ready = false;
    for (let i = 0; i < 80; i++) {
      await sleep(500);
      ready = await evalJs(`Boolean(document.readyState === 'complete' && !document.getElementById('loading') && document.getElementById('status'))`);
      if (ready) break;
    }
    if (!ready) throw new Error(`Game did not finish loading: ${JSON.stringify(pageErrors)}`);
    await sleep(2000);

    // Import modules and find a dry north-shore tripod spot overlooking the 3.06 ha boreal lake facing due south (yaw = Math.PI)
    const tripod = await evalJs(`(async () => {
      const findMod = (sub) => {
        const entries = performance.getEntriesByType('resource').map((r) => r.name);
        return entries.find((n) => n.includes(sub)) || sub;
      };
      window.__tod = await import(findMod('/src/core/timeOfDay.ts'));
      window.__wc = await import(findMod('/src/core/worldClock.ts'));
      window.__sp = await import(findMod('/src/core/sitePhase.ts'));
      window.__we = await import(findMod('/src/core/weather.ts'));
      window.__pw = await import(findMod('/src/core/planetWeather.ts'));
      window.__ae = await import(findMod('/src/render/aerial.ts'));
      window.__pbr = await import(findMod('/src/render/pbr.ts'));
      window.__lt = await import(findMod('/src/core/light.ts'));
      window.__pl = await import(findMod('/src/world/globe/planet.ts'));
      window.__sa = await import(findMod('/src/core/stages/surfaceAt.ts'));

      // Scan north bank of the (-1230, -920) boreal lake for dry bank just north of open lake water
      let spot = { x: -1230, z: -966 };
      for (let z = -980; z <= -940; z += 2) {
        const here = window.__sa.surfaceAt(-1230, z);
        const south20 = window.__sa.surfaceAt(-1230, z + 24);
        if (!here.lake && here.height > 17.8 && south20.lake && south20.lake.surface > 17.0) {
          spot = { x: -1230, z };
          break;
        }
      }
      return spot;
    })()`);

    // Helper inside page to prepare a day at 12:00 solar noon with clear sky so the Preetham solar disk is sharp and unoccluded
    await evalJs(`(() => {
      window.__prepDay = async (targetDay) => {
        // Exit photo mode if active
        if (document.body.classList.contains('photo-mode')) {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
          window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', code: 'Escape', bubbles: true }));
          await new Promise((r) => setTimeout(r, 250));
        }
        window.__sp.clearSite();
        window.borealHold?.(false);
        const sec = window.__wc.worldSec();
        window.__tod.setDay(targetDay, sec);
        window.__tod.setHour(12.0, sec);
        await window.__pw.openForestPlanet(targetDay, 12.0);
        // Disable stochastic cloud veil during solar disk geometry measurement while keeping snowpack/temperature live
        window.__we.WEATHER.on = false;
        window.borealPlace?.(${tripod.x}, ${tripod.z}, Math.PI, -24 * Math.PI / 180);
      };

      window.__enterTripodPhoto = async () => {
        const canvas = document.querySelector('canvas');
        // Hold pointer drag at (640, 360) so springLookPitch holds -24 deg upward pitch right before entering photo mode
        canvas.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, button: 0, buttons: 1, clientX: 640, clientY: 360, bubbles: true }));
        window.borealPlace?.(${tripod.x}, ${tripod.z}, Math.PI, -24 * Math.PI / 180);
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        canvas.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, button: 0, buttons: 0, clientX: 640, clientY: 360, bubbles: true }));
        document.getElementById('photo-btn')?.click();
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        // Drag slightly down in photo mode (dy = -5.2 px at s = (81.2026/48)*0.004 = 0.006767 rad/px -> +2.0 deg) to reach +26.0 deg upward pitch
        const s = (2 * Math.atan(12 / 14) * 180 / Math.PI) / 48 * 0.004;
        const dy = -(2.0 * Math.PI / 180) / s;
        canvas.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 2, button: 0, buttons: 1, clientX: 640, clientY: 360, bubbles: true }));
        canvas.dispatchEvent(new PointerEvent('pointermove', { pointerId: 2, button: 0, buttons: 1, clientX: 640, clientY: 360 + dy, bubbles: true }));
        canvas.dispatchEvent(new PointerEvent('pointerup', { pointerId: 2, button: 0, buttons: 0, clientX: 640, clientY: 360 + dy, bubbles: true }));
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      };
      return true;
    })()`);

    await evalJs(`window.__prepDay(227)`);
    await sleep(2200);
    await evalJs(`window.__enterTripodPhoto()`);
    await sleep(500);

    // Start MediaRecorder on the WebGL canvas (15 fps)
    await evalJs(`(() => {
      const canvas = document.querySelector('canvas');
      const stream = canvas.captureStream(15);
      const chunks = [];
      const rec = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8', videoBitsPerSecond: 8000000 });
      rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
      window.__recChunks = chunks;
      window.__recStartMs = performance.now();
      window.__rec = rec;
      rec.start(100);
      return true;
    })()`);

    const sampleScene = async (label) => {
      return await evalJs(`(() => {
        const sec = window.__wc.worldSec();
        const doy = window.__tod.dayAt(sec);
        const hr = window.__tod.hourAt(sec);
        const lat = window.__sp.siteLatitude(window.__we.SITE.lat);
        const sun = window.__tod.sunPosition(hr, doy, lat);
        const uDir = window.__ae.AERIAL.uSunDir.value;
        const uElevDeg = Math.asin(Math.max(-1, Math.min(1, uDir.y))) * 180 / Math.PI;
        const uAzDeg = ((Math.atan2(uDir.x, -uDir.z) * 180 / Math.PI) % 360 + 360) % 360;
        const planet = window.__pl.createPlanet(42);
        const pSun = window.__pl.planetSunDirection(planet, 12, doy);
        const pSubsolarLatDeg = window.__pl.toLatLon(pSun).lat * 180 / Math.PI;
        const fovDeg = 2 * Math.atan(12 / 14) * 180 / Math.PI;
        return {
          label: ${JSON.stringify(label)},
          videoOffsetSec: +((performance.now() - window.__recStartMs) / 1000).toFixed(3),
          doy,
          dateLabel: window.__tod.formatDate(doy).text,
          hour: +hr.toFixed(4),
          observerLatDeg: +lat.toFixed(4),
          sunElevationDeg: +sun.elevation.toFixed(6),
          sunAzimuthDeg: +sun.azimuth.toFixed(6),
          skyUniformElevationDeg: +uElevDeg.toFixed(6),
          skyUniformAzimuthDeg: +uAzDeg.toFixed(6),
          lightingEsunLux: +window.__pbr.LIGHTING.Esun.toFixed(2),
          lightingMoonAgeDays: +window.__pbr.LIGHTING.moonAge.toFixed(6),
          expectedMoonAgeDays: +window.__lt.moonAge(doy).toFixed(6),
          planetNoonSubsolarLatDeg: +pSubsolarLatDeg.toFixed(6),
          expectedDeclinationDeg: +window.__tod.declination(doy).toFixed(6),
          cameraPose: {
            tripodX: ${tripod.x},
            tripodZ: ${tripod.z},
            yawDeg: 180,
            pitchUpDeg: 26.0,
            focalMm: 14,
            fovDeg: +fovDeg.toFixed(4),
          },
        };
      })()`);
    };

    const observations = [];

    // Scene 0: Day 227 (Aug 15, Year 1) at 12:00 solar noon
    await sleep(1100);
    observations.push(await sampleScene('scene0_day227_aug15_noon'));
    await sleep(500);

    // Scene 1: Day 355 (Dec 21 winter solstice) at 12:00 solar noon
    await evalJs(`window.__prepDay(355)`);
    await sleep(2400);
    await evalJs(`window.__enterTripodPhoto()`);
    await sleep(1000);
    observations.push(await sampleScene('scene1_day355_dec21_noon'));
    await sleep(500);

    // Scene 2: Day 592 (227 + 365, Year-2 Aug 15 rollover) at 12:00 solar noon
    await evalJs(`window.__prepDay(592)`);
    await sleep(1600);
    await evalJs(`window.__enterTripodPhoto()`);
    await sleep(900);
    observations.push(await sampleScene('scene2_day592_year2_aug15_rollover_noon'));
    await sleep(500);

    // Stop MediaRecorder and decode frames + measure pixel-space solar disk centroids directly from recording.webm!
    const videoResult = await evalJs(`(async () => {
      const rec = window.__rec;
      await new Promise((resolve) => {
        rec.onstop = resolve;
        rec.stop();
      });
      const durationSec = (performance.now() - window.__recStartMs) / 1000;
      const blob = new Blob(window.__recChunks, { type: 'video/webm' });
      const buf = new Uint8Array(await blob.arrayBuffer());
      let bin = '';
      const step = 0x8000;
      for (let i = 0; i < buf.length; i += step) {
        bin += String.fromCharCode(...buf.subarray(i, i + step));
      }
      const videoBase64 = btoa(bin);

      const url = URL.createObjectURL(blob);
      const vid = document.createElement('video');
      vid.muted = true;
      vid.playsInline = true;
      vid.preload = 'auto';
      vid.src = url;
      await new Promise((res, rej) => {
        vid.onloadedmetadata = res;
        vid.onerror = () => rej(new Error('video metadata load failed'));
      });
      if (vid.duration === Infinity || Number.isNaN(vid.duration)) {
        vid.currentTime = 1e6;
        await new Promise((res) => { vid.ontimeupdate = () => { vid.ontimeupdate = null; res(); }; });
        vid.currentTime = 0;
        await new Promise((res) => { vid.onseeked = () => { vid.onseeked = null; res(); }; });
      }

      const c = document.createElement('canvas');
      c.width = vid.videoWidth || 1280;
      c.height = vid.videoHeight || 720;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      const targets = ${JSON.stringify(observations.map((o) => o.videoOffsetSec))};
      const fovRad = 2 * Math.atan(12 / 14);
      const tanHalfFov = Math.tan(fovRad / 2);
      const pitchRad = 26.0 * Math.PI / 180;

      const frames = [];
      for (let i = 0; i < targets.length; i++) {
        const t = Math.min(Math.max(0.05, targets[i]), Math.max(0.05, durationSec - 0.1));
        vid.currentTime = t;
        await new Promise((res) => { vid.onseeked = () => { vid.onseeked = null; res(); }; });
        ctx.drawImage(vid, 0, 0, c.width, c.height);

        // Measure solar disk pixel centroid in upper sky region (y in [0, 500], above horizon ~550 px)
        const img = ctx.getImageData(0, 0, c.width, c.height).data;
        let maxLum = 0;
        const yMaxSky = 500;
        for (let y = 4; y < yMaxSky; y++) {
          for (let x = 200; x < c.width - 200; x++) {
            const idx = (y * c.width + x) * 4;
            const lum = 0.2126 * img[idx] + 0.7152 * img[idx + 1] + 0.0722 * img[idx + 2];
            if (lum > maxLum) maxLum = lum;
          }
        }
        // Intensity-weighted centroid of top solar core pixels (lum >= max(242, maxLum - 6))
        const thr = Math.max(240, maxLum - 5);
        let sumW = 0, sumX = 0, sumY = 0, count = 0;
        for (let y = 4; y < yMaxSky; y++) {
          for (let x = 200; x < c.width - 200; x++) {
            const idx = (y * c.width + x) * 4;
            const lum = 0.2126 * img[idx] + 0.7152 * img[idx + 1] + 0.0722 * img[idx + 2];
            if (lum >= thr) {
              const w = (lum - thr + 1) ** 2;
              sumW += w;
              sumX += w * (x + 0.5);
              sumY += w * (y + 0.5);
              count++;
            }
          }
        }
        const cx = sumW > 0 ? sumX / sumW : c.width / 2;
        const cy = sumW > 0 ? sumY / sumW : c.height / 2;
        const ndcX = (2 * (cx / c.width) - 1) * (c.width / c.height);
        const ndcY = 1 - 2 * (cy / c.height);
        const vx = ndcX * tanHalfFov;
        const vy = ndcY * tanHalfFov;
        const fwd = Math.cos(pitchRad) - Math.sin(pitchRad) * vy;
        const up = Math.sin(pitchRad) + Math.cos(pitchRad) * vy;
        const pixelElevDeg = Math.atan2(up, Math.hypot(vx, fwd)) * 180 / Math.PI;

        frames.push({
          index: i,
          requestedSec: t,
          decodedSec: +vid.currentTime.toFixed(3),
          pngBase64: c.toDataURL('image/png').split(',')[1],
          solarDiskPixel: {
            centroidX: +cx.toFixed(2),
            centroidY: +cy.toFixed(2),
            corePixelCount: count,
            peakLuma8Bit: +maxLum.toFixed(2),
            recoveredElevationDeg: +pixelElevDeg.toFixed(4),
          },
        });
      }
      URL.revokeObjectURL(url);
      return { durationSec: +durationSec.toFixed(3), videoBase64, frames };
    })()`);

    writeFileSync(resolve(__dirname, 'recording.webm'), Buffer.from(videoResult.videoBase64, 'base64'));
    for (const f of videoResult.frames) {
      const fn = `frame-${f.index}.png`;
      writeFileSync(resolve(__dirname, fn), Buffer.from(f.pngBase64, 'base64'));
      observations[f.index].decodedFrame = {
        file: fn,
        requestedSec: f.requestedSec,
        decodedCurrentTimeSec: f.decodedSec,
        solarDiskPixel: f.solarDiskPixel,
      };
    }

    const summary = {
      capturedAt: new Date().toISOString(),
      sourceBranch: 'agy/seasonal-solar-date',
      viewport: { width: 1280, height: 720 },
      videoDurationSec: videoResult.durationSec,
      pageErrors,
      tripod,
      observations,
    };
    writeFileSync(resolve(__dirname, 'observations.json'), JSON.stringify(summary, null, 2) + '\n', 'utf8');
    console.log(JSON.stringify(summary, null, 2));

    ws.close();
  } finally {
    if (edge) { try { edge.kill('SIGKILL'); } catch {} }
    if (viteProc) { try { viteProc.kill('SIGKILL'); } catch {} }
    release();
  }
}

main().catch((err) => {
  console.error(err);
  release();
  process.exit(1);
});
