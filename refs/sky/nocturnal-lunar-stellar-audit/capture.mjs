/**
 * Live browser screen recording + frame sampler + runtime telemetry for T-0231
 * (nocturnal sky: seasonal lunar ecliptic declination & calendar year propagation,
 * rendered Moon disc & moonlit vs moonless cloud scattering, sidereal starfield rotation &
 * sky-luminance limiting magnitude, and Full-Moon vs New-Moon illumination & animal night vision).
 * Uses agy preview port 5258 and tools/bench-lock.mjs, killing Vite and headless Edge cleanly on exit.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquire, track, release } from '../../../tools/bench-lock.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
mkdirSync(__dirname, { recursive: true });

const PORT = 5258;
const BASE_URL = process.env.BOREAL_URL || `http://127.0.0.1:${PORT}`;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const CDP_PORT = 9371;
const WORK_ROOT = resolve(__dirname, '../../../work');
const PROFILE = resolve(WORK_ROOT, 'edge-nocturnal-sky-profile');
const LOCK_NAME = 'agy: T-0231-nocturnal-sky-audit';

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
        await srv.transformRequest('/src/core/light.ts');
        await srv.transformRequest('/src/core/timeOfDay.ts');
        await srv.transformRequest('/src/core/skyVisibility.ts');
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
    const snapPng = async (outFile) => {
      const res = await Promise.race([
        send('Page.captureScreenshot', { format: 'png' }),
        sleep(15000).then(() => { throw new Error('captureScreenshot timeout'); }),
      ]);
      writeFileSync(resolve(__dirname, outFile), Buffer.from(res.data, 'base64'));
    };
    const waitReady = async () => {
      let ready = false;
      for (let i = 0; i < 80; i++) {
        await sleep(500);
        ready = await evalJs(`Boolean(document.readyState === 'complete' && !document.getElementById('loading') && document.getElementById('status')?.innerText?.length > 10)`);
        if (ready) break;
      }
      if (!ready) throw new Error(`Game did not finish loading: ${JSON.stringify(pageErrors)}`);
    };

    const tiltCameraUp = async (dyPixels) => {
      await evalJs(`(() => {
        const c = document.getElementById('world');
        c.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, button: 0, clientX: 640, clientY: 360, bubbles: true }));
        c.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, button: 0, clientX: 640, clientY: ${360 + dyPixels}, bubbles: true }));
        c.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, button: 0, clientX: 640, clientY: ${360 + dyPixels}, bubbles: true }));
        return true;
      })()`);
    };

    await send('Page.enable');
    await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });

    const observations = [];

    // =========================================================================
    // Scene 0: Winter Solstice Full Moon Midnight (2026-12-24 00:00, doy=358, age=15.05 d)
    // Looking due South (yaw = PI) across the open lake & up into the southern sky dome
    // =========================================================================
    const urlFullMoon = `${BASE_URL}/?nomenu&noprobe&view=ground&stages=1&rec&date=2026-12-24&hour=0&at=-1230,-966,3.14159`;
    await send('Page.navigate', { url: urlFullMoon });
    await waitReady();
    await sleep(3000);
    // In main.ts: pitch = clampLookPitch(pitch + (clientY - drag.y) * 0.004). Let's check which sign pitches up!
    const pitchProbe = await evalJs(`(async () => {
      const gl = document.querySelector('canvas');
      const snap = document.createElement('canvas'); snap.width = 1280; snap.height = 720;
      const ctx = snap.getContext('2d'); ctx.drawImage(gl, 0, 0);
      const topBefore = ctx.getImageData(640, 120, 1, 1).data[2];
      return { topBefore };
    })()`);
    // Tilt camera upward so southern sky dome (elev 0..55 deg) + wolf + lake horizon are all framed
    await tiltCameraUp(-130);
    await sleep(600);

    // Start MediaRecorder on a 1280x720 composite canvas so recording.webm spans all 3 nocturnal scenes
    await evalJs(`(() => {
      const comp = document.createElement('canvas');
      comp.width = 1280;
      comp.height = 720;
      const ctx = comp.getContext('2d');
      const glCanvas = document.querySelector('canvas');
      window.__stopComp = false;
      window.__sceneLabel = 'Scene 0: 2026-12-24 00:00 Winter Full Moon (age=15.05d) Looking South';
      const drawComp = () => {
        if (!window.__stopComp) {
          ctx.drawImage(glCanvas, 0, 0, 1280, 720);
          ctx.fillStyle = 'rgba(0, 0, 0, 0.76)';
          ctx.fillRect(12, 646, 1120, 62);
          ctx.fillStyle = '#ffffff';
          ctx.font = '12px sans-serif';
          ctx.fillText(window.__sceneLabel || '', 20, 663);
          const st = document.getElementById('status');
          if (st) {
            const lines = (st.innerText || '').split('\\n').slice(0, 2);
            lines.forEach((ln, idx) => ctx.fillText(ln.slice(0, 150), 20, 680 + idx * 16));
          }
          requestAnimationFrame(drawComp);
        }
      };
      requestAnimationFrame(drawComp);
      const stream = comp.captureStream(20);
      const chunks = [];
      const rec = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' });
      rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
      window.__recChunks = chunks;
      window.__rec = rec;
      rec.start(100);
      return true;
    })()`);

    await sleep(1200);

    const obs0 = await evalJs(`(async () => {
      const findMod = (sub) => {
        const entries = performance.getEntriesByType('resource').map((r) => r.name);
        return entries.find((n) => n.includes(sub)) || sub;
      };
      const timeMod = await import(findMod('/src/core/timeOfDay.ts'));
      const lightMod = await import(findMod('/src/core/light.ts'));
      const pbrMod = await import(findMod('/src/render/pbr.ts'));
      const weatherMod = await import(findMod('/src/core/weather.ts'));
      const clockMod = await import(findMod('/src/core/worldClock.ts'));
      const speciesMod = await import(findMod('/src/core/species.ts'));

      const p = window.__boreal.player();
      // Force clear sky (cloud = 0) first so Full Moon is unobstructed
      weatherMod.WEATHER.on = false;
      await new Promise((r) => setTimeout(r, 400));

      const wSec = clockMod.worldSec();
      const doy = timeMod.dayAt(wSec);
      const hr = timeMod.hourAt(wSec);
      const sun = timeMod.sunPosition(hr, doy, weatherMod.SITE.lat);
      const age = lightMod.moonAge(doy);
      const gameMoon = timeMod.sunPosition(hr - age / lightMod.SYNODIC * 24, doy, weatherMod.SITE.lat);
      const EmoonGame = lightMod.moonLux(age, Math.sin(gameMoon.elevation * Math.PI / 180));
      const gainGame = lightMod.exposureFor(pbrMod.LIGHTING.lux) * lightMod.wolfEyes(pbrMod.LIGHTING.lux);
      const rawKey = 3 * EmoonGame / lightMod.LUX.ref * gainGame + lightMod.nightKey(gainGame);
      const rawHemi = Math.max(0.35, lightMod.nightSkyLight(EmoonGame, gainGame));
      const fillFullMoon = lightMod.sceneFill({
        elevation: sun.elevation,
        rawHemi,
        rawKey,
        dark: lightMod.darkAdapted(pbrMod.LIGHTING.lux),
      });

      const gl = document.querySelector('canvas');
      const snap = document.createElement('canvas');
      snap.width = 1280; snap.height = 720;
      const sctx = snap.getContext('2d');
      sctx.drawImage(gl, 0, 0, 1280, 720);
      const meanRoi = (x0, y0, w, h) => {
        const d = sctx.getImageData(x0, y0, w, h).data;
        let r = 0, g = 0, b = 0, maxL = 0, n = w * h;
        for (let i = 0; i < d.length; i += 4) {
          r += d[i]; g += d[i + 1]; b += d[i + 2];
          const l = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
          if (l > maxL) maxL = l;
        }
        return {
          r: +(r / n / 255).toFixed(4),
          g: +(g / n / 255).toFixed(4),
          b: +(b / n / 255).toFixed(4),
          luma: +((0.2126 * r + 0.7152 * g + 0.0722 * b) / n / 255).toFixed(4),
          maxLuma: +maxL.toFixed(4),
        };
      };

      // Capture exact star pixel positions in upper sky ROI (y=30..220, x=200..1080) at hour = 0.0
      const skyData0 = sctx.getImageData(200, 30, 880, 190).data;
      const brightPixels0 = [];
      for (let py = 0; py < 190; py++) {
        for (let px = 0; px < 880; px++) {
          const idx = (py * 880 + px) * 4;
          const lum = (0.2126 * skyData0[idx] + 0.7152 * skyData0[idx + 1] + 0.0722 * skyData0[idx + 2]) / 255;
          if (lum > 0.35) brightPixels0.push(px + ',' + py);
        }
      }
      window.__brightStarSet0 = brightPixels0;

      return {
        frame: 0,
        label: 'winter_solstice_full_moon_midnight_2026_12_24',
        doy,
        year: timeMod.DAY.year,
        hour: +hr.toFixed(4),
        sunElevationDeg: +sun.elevation.toFixed(4),
        moonAgeDays: +age.toFixed(4),
        gameMoonPos: {
          elevationDeg: +gameMoon.elevation.toFixed(4),
          azimuthDeg: +gameMoon.azimuth.toFixed(4),
        },
        lightingGlobal: { ...pbrMod.LIGHTING },
        fillFullMoon,
        hareNightSightFloorOnly: speciesMod.HARE_AGENT.senses.sight.night,
        pixelSamples: {
          upperSkyDome: meanRoi(380, 40, 520, 180),
          midSkyGameMoonBand: meanRoi(540, 160, 200, 140),
          lakeAndShoreLower: meanRoi(350, 460, 580, 170),
        },
        brightSkyPixelCountHour0: brightPixels0.length,
      };
    })()`);
    observations.push({ ...obs0, pitchProbe });
    await snapPng('frame-0.png');

    // =========================================================================
    // Scene 1: Advance clock +4 hours to 04:00 & switch to Winter New Moon (2026-12-09, doy=343, age=0.05 d)
    // with clouds on: test sidereal star rotation over 4 hours, moonless night cloud glow, and New-Moon vs Full-Moon ground fill!
    // =========================================================================
    const obs1 = await evalJs(`(async () => {
      window.__sceneLabel = 'Scene 1: +4h Star Rotation Check & 2026-12-09 Moonless New Moon (age=0.05d) + Clouds';
      const findMod = (sub) => {
        const entries = performance.getEntriesByType('resource').map((r) => r.name);
        return entries.find((n) => n.includes(sub)) || sub;
      };
      const timeMod = await import(findMod('/src/core/timeOfDay.ts'));
      const lightMod = await import(findMod('/src/core/light.ts'));
      const pbrMod = await import(findMod('/src/render/pbr.ts'));
      const weatherMod = await import(findMod('/src/core/weather.ts'));
      const clockMod = await import(findMod('/src/core/worldClock.ts'));

      // Step 1a: Keep clear sky (WEATHER.on = false) and advance hour from 00:00 -> 04:00 (+4.0 sidereal hours = 60.16 deg sky rotation!)
      timeMod.setHour(4.0, clockMod.worldSec());
      await new Promise((r) => setTimeout(r, 500));

      const gl = document.querySelector('canvas');
      const snap = document.createElement('canvas');
      snap.width = 1280; snap.height = 720;
      const sctx = snap.getContext('2d');
      sctx.drawImage(gl, 0, 0, 1280, 720);
      const skyData4 = sctx.getImageData(200, 30, 880, 190).data;
      const set0 = new Set(window.__brightStarSet0 || []);
      let overlap = 0, total4 = 0;
      for (let py = 0; py < 190; py++) {
        for (let px = 0; px < 880; px++) {
          const idx = (py * 880 + px) * 4;
          const lum = (0.2126 * skyData4[idx] + 0.7152 * skyData4[idx + 1] + 0.0722 * skyData4[idx + 2]) / 255;
          if (lum > 0.35) {
            total4++;
            if (set0.has(px + ',' + py)) overlap++;
          }
        }
      }
      const stationaryStarFractionAfter4h = set0.size > 0 ? overlap / Math.max(1, Math.min(set0.size, total4)) : 0;

      // Step 1b: Now set date to Winter New Moon (doy=343, 2026-12-09, age=0.054 d) at 00:00 with partly cloudy sky (WEATHER.on = true, cloud = 0.75)
      timeMod.setDay(343, clockMod.worldSec());
      timeMod.setHour(0.0, clockMod.worldSec());
      weatherMod.WEATHER.on = true;
      const p = window.__boreal.player();
      weatherMod.initWeather(343, 0, p.x, p.z);
      const g = weatherMod.getGrid();
      g.qc.fill(0.0005); // cloud layer on moonless night
      await new Promise((r) => setTimeout(r, 900));

      const wSec = clockMod.worldSec();
      const doy = timeMod.dayAt(wSec);
      const hr = timeMod.hourAt(wSec);
      const sun = timeMod.sunPosition(hr, doy, weatherMod.SITE.lat);
      const age = lightMod.moonAge(doy);
      const gameMoon = timeMod.sunPosition(hr - age / lightMod.SYNODIC * 24, doy, weatherMod.SITE.lat);
      const EmoonNew = lightMod.moonLux(age, Math.sin(gameMoon.elevation * Math.PI / 180));
      const gainNew = lightMod.exposureFor(pbrMod.LIGHTING.lux) * lightMod.wolfEyes(pbrMod.LIGHTING.lux);
      const rawKeyNew = 3 * EmoonNew / lightMod.LUX.ref * gainNew + lightMod.nightKey(gainNew);
      const rawHemiNew = Math.max(0.35, lightMod.nightSkyLight(EmoonNew, gainNew));
      const fillNewMoon = lightMod.sceneFill({
        elevation: sun.elevation,
        rawHemi: rawHemiNew,
        rawKey: rawKeyNew,
        dark: lightMod.darkAdapted(pbrMod.LIGHTING.lux),
      });

      sctx.drawImage(gl, 0, 0, 1280, 720);
      const meanRoi = (x0, y0, w, h) => {
        const d = sctx.getImageData(x0, y0, w, h).data;
        let r = 0, g = 0, b = 0, n = w * h;
        for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
        return {
          r: +(r / n / 255).toFixed(4),
          g: +(g / n / 255).toFixed(4),
          b: +(b / n / 255).toFixed(4),
          luma: +((0.2126 * r + 0.7152 * g + 0.0722 * b) / n / 255).toFixed(4),
        };
      };

      return {
        frame: 1,
        label: 'moonless_new_moon_with_clouds_and_4h_star_rotation_check',
        doy,
        hour: +hr.toFixed(4),
        moonAgeDays: +age.toFixed(4),
        EmoonNew,
        lightingGlobal: { ...pbrMod.LIGHTING },
        fillNewMoon,
        starRotationCheck4Hours: {
          brightPixelsAt00h: set0.size,
          brightPixelsAt04h: total4,
          exactSamePixelOverlap: overlap,
          stationaryFraction: +stationaryStarFractionAfter4h.toFixed(4),
        },
        pixelSamples: {
          moonlessCloudSkyDome: meanRoi(380, 40, 520, 180),
          lakeAndShoreLower: meanRoi(350, 460, 580, 170),
        },
      };
    })()`);
    observations.push(obs1);
    await snapPng('frame-1.png');

    // =========================================================================
    // Scene 2: Non-2026 Calendar Year (?date=2025-01-14 Wolf Full Moon) & Civil Twilight / Low-Sun Star Leak (sun.elevation = -5.5 deg & +1.5 deg)
    // =========================================================================
    const obs2 = await evalJs(`(async () => {
      window.__sceneLabel = 'Scene 2: Non-2026 Date (2025-01-14 Full Moon) & Civil Twilight Star Leak (elev=-5.5 deg)';
      const findMod = (sub) => {
        const entries = performance.getEntriesByType('resource').map((r) => r.name);
        return entries.find((n) => n.includes(sub)) || sub;
      };
      const timeMod = await import(findMod('/src/core/timeOfDay.ts'));
      const lightMod = await import(findMod('/src/core/light.ts'));
      const pbrMod = await import(findMod('/src/render/pbr.ts'));
      const weatherMod = await import(findMod('/src/core/weather.ts'));
      const clockMod = await import(findMod('/src/core/worldClock.ts'));

      // Check 2a: Set DAY.year = 2025, doy = 14 (2025-01-14 Wolf Full Moon, real age = 14.79 d), hour = 0
      weatherMod.WEATHER.on = false;
      timeMod.DAY.year = 2025;
      timeMod.setDay(14, clockMod.worldSec());
      timeMod.setHour(0.0, clockMod.worldSec());
      await new Promise((r) => setTimeout(r, 500));
      const lightingMoonAgeOn2025Jan14 = pbrMod.LIGHTING.moonAge;
      const expectedMoonAge2025Jan14 = lightMod.moonAge(14, 2025);
      const EmoonGame2025Jan14 = pbrMod.LIGHTING.Emoon;

      // Check 2b: Set hour to early civil twilight on Aug 15 (day=227, hour=19.85 -> sun.elevation ~ -5.2 deg, bright civil twilight ~4.5 lx!)
      timeMod.DAY.year = 2026;
      timeMod.setDay(227, clockMod.worldSec());
      timeMod.setHour(19.95, clockMod.worldSec());
      await new Promise((r) => setTimeout(r, 700));

      const wSec = clockMod.worldSec();
      const hr = timeMod.hourAt(wSec);
      const sun = timeMod.sunPosition(hr, 227, weatherMod.SITE.lat);
      const lgt = timeMod.lighting(sun.elevation);

      const gl = document.querySelector('canvas');
      const snap = document.createElement('canvas');
      snap.width = 1280; snap.height = 720;
      const sctx = snap.getContext('2d');
      sctx.drawImage(gl, 0, 0, 1280, 720);
      // Count star spikes (local pixel contrast > +0.12 over immediate 3px neighbor in clear twilight zenith y=25..150)
      const twData = sctx.getImageData(240, 25, 800, 125).data;
      let civilTwilightStarSpikes = 0;
      for (let py = 2; py < 123; py++) {
        for (let px = 2; px < 798; px++) {
          const i0 = (py * 800 + px) * 4;
          const iL = (py * 800 + (px - 2)) * 4;
          const iR = (py * 800 + (px + 2)) * 4;
          const l0 = (0.2126 * twData[i0] + 0.7152 * twData[i0 + 1] + 0.0722 * twData[i0 + 2]) / 255;
          const lBg = 0.5 * (
            (0.2126 * twData[iL] + 0.7152 * twData[iL + 1] + 0.0722 * twData[iL + 2]) +
            (0.2126 * twData[iR] + 0.7152 * twData[iR + 1] + 0.0722 * twData[iR + 2])
          ) / 255;
          if (l0 - lBg > 0.12) civilTwilightStarSpikes++;
        }
      }

      return {
        frame: 2,
        label: 'year_2025_full_moon_mismatch_and_civil_twilight_star_leak',
        year2025Jan14Check: {
          clockYear: 2025,
          doy: 14,
          gameReportedMoonAge: +lightingMoonAgeOn2025Jan14.toFixed(4),
          expectedMoonAge2025: +expectedMoonAge2025Jan14.toFixed(4),
          gameEmoonLux: +EmoonGame2025Jan14.toFixed(5),
        },
        civilTwilightCheck: {
          hour: +hr.toFixed(4),
          sunElevationDeg: +sun.elevation.toFixed(4),
          uDay: +lgt.day.toFixed(4),
          shaderStarNightFactor: +(1 - lgt.day).toFixed(4),
          lux: +pbrMod.LIGHTING.lux.toFixed(4),
          civilTwilightStarSpikes,
        },
      };
    })()`);
    observations.push(obs2);
    await snapPng('frame-2.png');

    await sleep(1000);

    // Finalize recording.webm
    const webmBase64 = await evalJs(`new Promise((resolve) => {
      window.__stopComp = true;
      const rec = window.__rec;
      rec.onstop = async () => {
        const blob = new Blob(window.__recChunks, { type: 'video/webm' });
        const buf = await blob.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let bin = '';
        for (let i = 0; i < bytes.length; i += 8192) {
          bin += String.fromCharCode(...bytes.subarray(i, i + 8192));
        }
        resolve(btoa(bin));
      };
      rec.stop();
    })`);
    writeFileSync(resolve(__dirname, 'recording.webm'), Buffer.from(webmBase64, 'base64'));
    writeFileSync(resolve(__dirname, 'observations.json'), JSON.stringify({ capturedAt: new Date().toISOString(), pageErrors, observations }, null, 2));

    ws.close();
    console.log('Saved recording.webm, frame-0..2.png, and observations.json');
  } finally {
    if (edge?.pid) { try { process.kill(edge.pid); } catch {} }
    if (viteProc?.pid) { try { process.kill(viteProc.pid); } catch {} }
    await release();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
