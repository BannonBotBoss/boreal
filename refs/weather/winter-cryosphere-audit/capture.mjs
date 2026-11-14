/**
 * Live browser screen recording + frame sampler + runtime telemetry for T-0230
 * (winter cryosphere, lake freeze-up, terrain snowpack/wetness attributes, active snowfall vs
 * ground snowpack state, and precipitation particle physics).
 * Uses agy preview port 5259 and tools/bench-lock.mjs, killing Vite and headless Edge cleanly on exit.
 */
import { spawn, execSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquire, track, release } from '../../../tools/bench-lock.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
mkdirSync(__dirname, { recursive: true });

const PORT = 5259;
const BASE_URL = process.env.BOREAL_URL || `http://127.0.0.1:${PORT}`;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const CDP_PORT = 9370;
const WORK_ROOT = resolve(__dirname, '../../../work');
const PROFILE = resolve(WORK_ROOT, 'edge-winter-cryosphere-profile');
const LOCK_NAME = 'agy: T-0230-winter-cryosphere-audit';

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
        await srv.transformRequest('/src/core/weather.ts');
        await srv.transformRequest('/src/render/continuousTerrain.ts');
        await srv.transformRequest('/src/render/water.ts');
        await srv.transformRequest('/src/render/sky.ts');
      `;
      viteProc = spawn(process.execPath, ['--input-type=module', '-e', viteBoot], {
        stdio: 'ignore',
        cwd: resolve(__dirname, '../../..'),
      });
      if (viteProc.pid) track(viteProc.pid);
      let up = false;
      for (let i = 0; i < 60; i++) {
        try {
          const r = await fetch(`${BASE_URL}/src/core/weather.ts`);
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

    await send('Page.enable');
    await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });

    const observations = [];

    // =========================================================================
    // Navigate to north shore of the 3.06 ha boreal lake on Jan 15 (day=15, hour=12)
    // =========================================================================
    const urlWinter = `${BASE_URL}/?nomenu&noprobe&view=ground&stages=1&rec&day=15&hour=12&at=-1230,-966,3.1416`;
    await send('Page.navigate', { url: urlWinter });
    await waitReady();
    await sleep(3500);

    // Start MediaRecorder on a 1280x720 composite canvas so recording.webm spans all three audit states
    await evalJs(`(() => {
      const comp = document.createElement('canvas');
      comp.width = 1280;
      comp.height = 720;
      const ctx = comp.getContext('2d');
      const glCanvas = document.querySelector('canvas');
      window.__stopComp = false;
      window.__sceneLabel = 'Scene 0: Jan 15 Midwinter Clear Noon (day=15)';
      const drawComp = () => {
        if (!window.__stopComp) {
          ctx.drawImage(glCanvas, 0, 0, 1280, 720);
          ctx.fillStyle = 'rgba(0, 0, 0, 0.74)';
          ctx.fillRect(12, 646, 1080, 62);
          ctx.fillStyle = '#ffffff';
          ctx.font = '12px sans-serif';
          ctx.fillText(window.__sceneLabel || '', 20, 663);
          const st = document.getElementById('status');
          if (st) {
            const lines = (st.innerText || '').split('\\n').slice(0, 2);
            lines.forEach((ln, idx) => ctx.fillText(ln.slice(0, 145), 20, 680 + idx * 16));
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

    await sleep(1500);

    // Probe Scene 0: Midwinter clear noon (Jan 15, day=15) — continuousTerrain aSnow/aWet, lake water ice, and clear-day track decay
    const obs0 = await evalJs(`(async () => {
      const findMod = (sub) => {
        const entries = performance.getEntriesByType('resource').map((r) => r.name);
        return entries.find((n) => n.includes(sub)) || sub;
      };
      const weatherMod = await import(findMod('/src/core/weather.ts'));
      const planetWeatherMod = await import(findMod('/src/core/planetWeather.ts'));
      const worldMod = await import(findMod('/src/core/world.ts'));
      const contTerrainMod = await import(findMod('/src/render/continuousTerrain.ts'));
      const waterMod = await import(findMod('/src/render/water.ts'));
      const deltasMod = await import(findMod('/src/core/deltas.ts'));
      const groundMod = await import(findMod('/src/core/ground.ts'));

      const p = window.__boreal.player();
      const wHere = weatherMod.weatherAt(p.x, p.z);
      const colHere = groundMod.column(p.x + 8, p.z - 12); // upland shore cell
      const contMesh = contTerrainMod.buildContinuousMesh(p.x, p.z, 2.0, worldMod.heightAt);
      let maxASnow = 0, sumASnow = 0, maxAWet = 0, sumAWet = 0;
      for (let i = 0; i < contMesh.snow.length; i++) {
        if (contMesh.snow[i] > maxASnow) maxASnow = contMesh.snow[i];
        sumASnow += contMesh.snow[i];
        if (contMesh.wet[i] > maxAWet) maxAWet = contMesh.wet[i];
        sumAWet += contMesh.wet[i];
      }

      const wMat = waterMod.waterMaterial();
      const sim = planetWeatherMod.planetWeatherSim();
      const pw = sim ? planetWeatherMod.weatherAtLatLon(49.79, -94.36, sim) : null;

      // Sample rendered WebGL pixels from 2D snapshot over lake ROI and upland shore ROI
      const gl = document.querySelector('canvas');
      const snap = document.createElement('canvas');
      snap.width = 1280; snap.height = 720;
      const sctx = snap.getContext('2d');
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

      // Test catchUpWeather(3600) on clear winter day (rainMmH = 0, sweMm > 0.5) and footprint strength after 0.5 days
      weatherMod.initWeather(15, 12, p.x, p.z);
      weatherMod.setNearCellLive(true);
      weatherMod.catchUpWeather(3600);
      const gAfterCatchUp = weatherMod.getGrid();
      const wClearAfterCatchUp = weatherMod.weatherAt(p.x, p.z);
      const fpDelta = { kind: 'footprint', x: p.x, z: p.z, t: groundMod.GROUND.years - 0.5 / 365.25, m: 1 };
      const fpStrengthGame = deltasMod.strength(fpDelta, groundMod.GROUND.years);
      const fpStrengthExpectedDryCold = Math.exp(-0.5 / 1.5);

      return {
        frame: 0,
        label: 'midwinter_clear_noon_lake_and_forest_bank_day15',
        player: p,
        statusBar: document.getElementById('status')?.innerText?.split('\\n')[0] || '',
        weatherHere: wHere,
        planetWeatherHome: pw,
        groundColumnShoreTopLayer: colHere.layers[0] || null,
        continuousTerrainStats: {
          vertexCount: contMesh.snow.length,
          leaves: contMesh.leaves,
          maxASnow,
          meanASnow: contMesh.snow.length ? sumASnow / contMesh.snow.length : 0,
          maxAWet,
          meanAWet: contMesh.wet.length ? sumAWet / contMesh.wet.length : 0,
        },
        waterMaterialStats: {
          colorHex: '#' + wMat.color.getHexString(),
          roughness: wMat.roughness,
          metalness: wMat.metalness,
          cacheKey: wMat.customProgramCacheKey(),
        },
        pixelSamples: {
          lakeSurfaceCenter: meanRoi(560, 440, 160, 70),
          shoreGroundForeground: meanRoi(220, 540, 180, 90),
        },
        clearWinterTrackDecay: {
          precipMmH: wClearAfterCatchUp.rainMmH,
          sweMm: wClearAfterCatchUp.sweMm,
          snowFlagOnClearDay: wClearAfterCatchUp.snow,
          gridSnowfallCol0: gAfterCatchUp.snowfall[0],
          halfDayFootprintStrengthGame: +fpStrengthGame.toFixed(6),
          halfDayFootprintStrengthExpected: +fpStrengthExpectedDryCold.toFixed(6),
        },
      };
    })()`);
    observations.push(obs0);
    await snapPng('frame-0.png');

    // =========================================================================
    // Scene 1: Active Midwinter Snowfall (2.8 mm/h, 6.0 m/s east wind) + Wolf Forward Movement & 12x Clock Dial
    // =========================================================================
    const obs1 = await evalJs(`(async () => {
      window.__sceneLabel = 'Scene 1: Active Snowfall (2.8 mm/h, 6 m/s wind) + Camera Lock & 12x Clock';
      const findMod = (sub) => {
        const entries = performance.getEntriesByType('resource').map((r) => r.name);
        return entries.find((n) => n.includes(sub)) || sub;
      };
      const weatherMod = await import(findMod('/src/core/weather.ts'));
      const clockMod = await import(findMod('/src/core/worldClock.ts'));
      const p0 = window.__boreal.player();

      weatherMod.initWeather(15, 12, p0.x, p0.z);
      const g = weatherMod.getGrid();
      g.precip.fill(2.8);
      g.snowfall.fill(1);
      g.swe.fill(85);
      g.u.fill(6.0);
      g.v.fill(0.0);
      weatherMod.setNearCellLive(true);

      // Hold W + ShiftLeft to run forward during snowfall so recording shows camera-locked snow
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', key: 'w', bubbles: true }));
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ShiftLeft', key: 'Shift', bubbles: true }));
      await new Promise((r) => setTimeout(r, 1400));
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ShiftLeft', key: 'Shift', bubbles: true }));
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', key: 'w', bubbles: true }));

      const p1 = window.__boreal.player();
      const wSnow = weatherMod.weatherAt(p1.x, p1.z);

      // Test bare-ground snowfall misclassification in climateSurface / mixWeather when sweMm = 0 and tC = -6 C
      g.swe.fill(0);
      g.precip.fill(2.8);
      g.snowfall.fill(1);
      // Force observation scale briefly into Behavioral (rate = 15x) so weatherAt calls mixWeather & sky.update sees 15x worldSec!
      const prevDial = clockMod.dialPosition ? clockMod.dialPosition() : 0.01;
      if (clockMod.setDialPosition) clockMod.setDialPosition(clockMod.dialForRate(15));
      await new Promise((r) => setTimeout(r, 600));
      const obsScaleAt15x = clockMod.observation();
      const wMixedBareGround = weatherMod.weatherAt(p1.x, p1.z);
      if (clockMod.setDialPosition) clockMod.setDialPosition(prevDial);
      g.swe.fill(85);

      return {
        frame: 1,
        label: 'active_midwinter_snowfall_wind_and_camera_lock',
        playerStart: { x: +p0.x.toFixed(3), z: +p0.z.toFixed(3) },
        playerEnd: { x: +p1.x.toFixed(3), z: +p1.z.toFixed(3) },
        distanceMovedM: +Math.hypot(p1.x - p0.x, p1.z - p0.z).toFixed(3),
        activeSnowWeather: wSnow,
        obsAt15x: obsScaleAt15x,
        bareGroundSubzeroSnowMixed: {
          tC: +wMixedBareGround.tC.toFixed(2),
          rainMmH: +wMixedBareGround.rainMmH.toFixed(2),
          sweMm: +wMixedBareGround.sweMm.toFixed(2),
          snowFlag: wMixedBareGround.snow,
        },
      };
    })()`);
    observations.push(obs1);
    await snapPng('frame-1.png');

    // =========================================================================
    // Scene 2: Active Warm Wind-Driven Rain (Aug 15 day=227, +19 C, 4.5 mm/h, 8 m/s wind)
    // =========================================================================
    const obs2 = await evalJs(`(async () => {
      window.__sceneLabel = 'Scene 2: Summer Wind-Driven Rain (4.5 mm/h, 8 m/s wind, day=227)';
      const findMod = (sub) => {
        const entries = performance.getEntriesByType('resource').map((r) => r.name);
        return entries.find((n) => n.includes(sub)) || sub;
      };
      const weatherMod = await import(findMod('/src/core/weather.ts'));
      const todMod = await import(findMod('/src/core/timeOfDay.ts'));
      const clockMod = await import(findMod('/src/core/worldClock.ts'));
      const contTerrainMod = await import(findMod('/src/render/continuousTerrain.ts'));
      const worldMod = await import(findMod('/src/core/world.ts'));

      todMod.setDay(227, clockMod.worldSec());
      todMod.setHour(14, clockMod.worldSec());
      const p = window.__boreal.player();
      weatherMod.initWeather(227, 14, p.x, p.z);
      const g = weatherMod.getGrid();
      g.precip.fill(4.5);
      g.snowfall.fill(0);
      g.swe.fill(0);
      g.soil.fill(150);
      g.u.fill(8.0);
      g.v.fill(0.0);
      weatherMod.setNearCellLive(true);

      await new Promise((r) => setTimeout(r, 1400));
      const wRain = weatherMod.weatherAt(p.x, p.z);
      const contMeshSummerRain = contTerrainMod.buildContinuousMesh(p.x, p.z, 2.0, worldMod.heightAt);
      let maxAWet = 0;
      for (let i = 0; i < contMeshSummerRain.wet.length; i++) {
        if (contMeshSummerRain.wet[i] > maxAWet) maxAWet = contMeshSummerRain.wet[i];
      }

      return {
        frame: 2,
        label: 'summer_wind_driven_rain_and_zero_terrain_wetness_day227',
        rainWeather: wRain,
        continuousTerrainMaxAWetInDownpour: maxAWet,
      };
    })()`);
    observations.push(obs2);
    await snapPng('frame-2.png');

    await sleep(900);
    const webmB64 = await evalJs(`new Promise((resolve) => {
      window.__stopComp = true;
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
