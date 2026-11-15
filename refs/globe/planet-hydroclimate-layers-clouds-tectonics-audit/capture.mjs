/**
 * Live browser screen recording + 4-stage PNG frame sampler + runtime telemetry for T-0247
 * (Planetary Hydroclimate & Sahara/Kenora Köppen Inversion, HydroLayer vs PlanetLayers Shadowing &
 * Broken Snow/Ice Toggle, Volumetric LocalClouds 20.8x Twilight Skylight Jump & Frozen KeptClouds,
 * and Sign-Inverted MORVEL Plate Kinematics & View-Locked/Unclipped Through-Planet Axis Cutaway Audit).
 *
 * Uses agy preview port 5268 and tools/bench-lock.mjs, killing Vite and headless Edge cleanly on exit.
 */
import { spawn, execSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquire, track, release } from '../../../tools/bench-lock.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
mkdirSync(__dirname, { recursive: true });

const PORT = 5268;
const BASE_URL = process.env.BOREAL_URL || `http://127.0.0.1:${PORT}`;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const CDP_PORT = 9377;
const WORK_ROOT = resolve(__dirname, '../../../work-t0247');
const PROFILE = resolve(WORK_ROOT, 'edge-globe-audit-profile');
const LOCK_NAME = 'agy: T-0247-planet-hydroclimate-layers-clouds-tectonics-audit';

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
          server: { host: '127.0.0.1', port: ${PORT}, strictPort: true, watch: null, fs: { allow: ['C:/dev'] } },
          logLevel: 'error',
        });
        await srv.listen();
        await srv.transformRequest('/src/world/globe/entry.ts');
        await srv.transformRequest('/src/world/globe/globeView.ts');
        await srv.transformRequest('/src/world/globe/planetLayers.ts');
        await srv.transformRequest('/src/world/globe/hydroLayer.ts');
        await srv.transformRequest('/src/world/globe/localClouds.ts');
        await srv.transformRequest('/src/world/globe/plates.ts');
        await srv.transformRequest('/src/world/globe/axisView.ts');
      `;
      viteProc = spawn(process.execPath, ['--input-type=module', '-e', viteBoot], {
        stdio: 'ignore',
        cwd: resolve(__dirname, '../../..'),
      });
      if (viteProc.pid) track(viteProc.pid);
      let up = false;
      for (let i = 0; i < 60; i++) {
        try {
          const r = await fetch(`${BASE_URL}/src/world/globe/globeView.ts`);
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
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
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
        const page = pages.find((p) => p.type === 'page' && p.url === 'about:blank' && p.webSocketDebuggerUrl)
          || pages.find((p) => p.type === 'page' && !String(p.url).startsWith('edge://') && p.webSocketDebuggerUrl);
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
      if (res?.exceptionDetails) {
        throw new Error(`Eval error: ${res.exceptionDetails.text} ${res.exceptionDetails.exception?.description || ''}`);
      }
      return res?.result?.value;
    };
    const snapPng = async (outFile) => {
      await evalJs('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))');
      const res = await Promise.race([
        send('Page.captureScreenshot', { format: 'png' }),
        sleep(30000).then(() => { throw new Error('captureScreenshot timeout'); }),
      ]);
      writeFileSync(resolve(__dirname, outFile), Buffer.from(res.data, 'base64'));
    };

    await send('Page.enable');
    await send('Page.bringToFront');
    await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
    await send('Page.addScriptToEvaluateOnNewDocument', {
      source: `(() => {
        if (performance && performance.setResourceTimingBufferSize) performance.setResourceTimingBufferSize(2500);
        try { localStorage.clear(); } catch {}
        const origGetContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function(type, attrs) {
          if (type === 'webgl' || type === 'webgl2') {
            attrs = Object.assign({}, attrs || {}, { preserveDrawingBuffer: true });
          }
          return origGetContext.call(this, type, attrs);
        };
      })();`,
    });

    const waitGlobeBoot = async () => {
      let ready = false;
      for (let i = 0; i < 240; i++) {
        await sleep(500);
        await send('Page.bringToFront').catch(() => {});
        ready = await evalJs(`Boolean(
          document.readyState === 'complete' &&
          window.__globe &&
          window.__globe.bootSettled &&
          window.__globe.stats().drawn >= 6 &&
          window.__globe.stats().queued === 0
        )`);
        if (ready) break;
      }
      if (!ready) throw new Error(`Globe did not finish booting: ${JSON.stringify(pageErrors)}`);
    };

    await send('Page.navigate', {
      url: `${BASE_URL}/?view=globe&stages=1&r=6371&gaslayers=1&day=45&hour=12&latlon=28,-95&alt=11500000&tier=1`,
    });
    await waitGlobeBoot();
    await sleep(2500);

    await evalJs(`(() => {
      const cp = document.getElementById('camera-panel');
      if (cp) cp.style.display = 'none';
      const comp = document.createElement('canvas');
      comp.width = 1280; comp.height = 720;
      const ctx = comp.getContext('2d');
      const glCanvas = document.getElementById('world') || document.querySelector('canvas');
      window.__stopComp = false;
      const drawComp = () => {
        if (window.__stopComp) return;
        if (glCanvas) ctx.drawImage(glCanvas, 0, 0, 1280, 720);
        setTimeout(drawComp, 50);
      };
      drawComp();
      const stream = comp.captureStream(20);
      const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';
      const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4_500_000 });
      window.__recChunks = [];
      rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) window.__recChunks.push(e.data); };
      window.__rec = rec;
      rec.start(100);
      return true;
    })()`);

    const waitGlobeTiles = async (maxMs = 9000) => {
      await sleep(350);
      const t0 = Date.now();
      while (Date.now() - t0 < maxMs) {
        const q = await evalJs(`window.__globe ? window.__globe.stats().queued : 0`);
        if (q === 0) break;
        await sleep(250);
      }
      await sleep(600);
    };

    const observations = [];

    // =========================================================================
    // STAGE 0: Through-Planet Axis Cutaway (?r=6371&gaslayers=1) with Plates & Field lines enabled
    // to visibly demonstrate unclipped foreground layers + view-locked frontal disc + missing R key
    // =========================================================================
    const probe0 = await evalJs(`(async () => {
      const platesCb = document.querySelector('#globe-layers input[data-layer="plates"]');
      if (platesCb && !platesCb.checked) platesCb.click();
      const flCb = document.querySelector('#globe-layers input[data-layer="fieldLines"]');
      if (flCb && !flCb.checked) flCb.click();

      const findAxisUi = () => [...document.querySelectorAll('div')].find((d) => d.querySelector && d.querySelector('button[data-a="off"]'));
      const ui = findAxisUi();
      const visibleBeforeKeyR = ui ? getComputedStyle(ui).display !== 'none' : false;
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', bubbles: true }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'R', bubbles: true }));
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r))));
      const visibleAfterKeyR = ui ? getComputedStyle(ui).display !== 'none' : false;
      const axisReadout = ui?.querySelector('pre')?.textContent || '';

      const gl = document.getElementById('world');
      const c2 = document.createElement('canvas'); c2.width = 1280; c2.height = 720;
      const ctx = c2.getContext('2d'); ctx.drawImage(gl, 0, 0, 1280, 720);
      const centerPx = Array.from(ctx.getImageData(640, 360, 1, 1).data);
      const cutDiscPx = Array.from(ctx.getImageData(580, 360, 1, 1).data);

      return {
        frame: 0,
        label: 'through_planet_axis_cutaway_view_locked_frontal_disc_unclipped_shells_missing_key_R',
        altitudeM: Math.round(window.__globe.altitude),
        axisUiVisibleBeforeKeyR: visibleBeforeKeyR,
        axisUiVisibleAfterKeyR: visibleAfterKeyR,
        keyboardRToggledAxis: visibleBeforeKeyR !== visibleAfterKeyR,
        axisReadout,
        centerCorePixelRgba: centerPx,
        cutOuterCorePixelRgba: cutDiscPx,
      };
    })()`);
    await sleep(450);
    await snapPng('frame-0.png');
    observations.push(probe0);

    // Turn off Axis cutaway & diagnostic Field lines / Plates before Stage 1
    await evalJs(`(() => {
      const btn = document.querySelector('button[data-a="off"]');
      if (btn) btn.click();
      const platesCb = document.querySelector('#globe-layers input[data-layer="plates"]');
      if (platesCb && platesCb.checked) platesCb.click();
      const flCb = document.querySelector('#globe-layers input[data-layer="fieldLines"]');
      if (flCb && flCb.checked) flCb.click();
      return true;
    })()`);
    await sleep(300);

    // =========================================================================
    // STAGE 1: Globe Surface Budget Layers (hydroLayer shadowing planetLayers + Snow/Ice toggle broken)
    // Bright midday sun over North America / Hudson Bay (54N, -92W) at 2,350 km (below 2,500 km ORBIT_FADE)
    // =========================================================================
    await evalJs(`(async () => {
      const findMod = (sub) => performance.getEntriesByType('resource').map((r) => r.name).find((n) => n.includes(sub)) || sub;
      const THREE = await import(findMod('/deps/three.js'));
      const planetMod = await import(findMod('/src/world/globe/planet.ts'));
      const stagesMod = await import(findMod('/src/core/stages/elevation.ts'));
      const worldMod = await import(findMod('/src/core/world.ts'));
      const todMod = await import(findMod('/src/core/timeOfDay.ts'));
      const wcMod = await import(findMod('/src/core/worldClock.ts'));
      const homeMod = await import(findMod('/src/world/globe/home.ts'));

      const seed = stagesMod.STAGES.on ? stagesMod.STAGES.seed : worldMod.WORLD_SEED;
      const planet = homeMod.globePlanet(seed, stagesMod.STAGES.on, stagesMod.STAGES.seed);
      const targetLat = 53.5, targetLon = -92.0;
      const upVec = new THREE.Vector3(...planetMod.fromLatLon(targetLat * Math.PI / 180, targetLon * Math.PI / 180));

      // Find exact hour on day=45 (mid-February winter snowpack + frozen Hudson Bay) maximizing solar elevation at (53.5N, -92W)
      let bestH = 12, maxElev = -90;
      for (let h = 0; h < 24; h += 0.05) {
        const sd = new THREE.Vector3(...planetMod.planetSunDirection(planet, h, 45));
        const el = Math.asin(Math.max(-1, Math.min(1, upVec.dot(sd)))) * 180 / Math.PI;
        if (el > maxElev) { maxElev = el; bestH = h; }
      }
      todMod.initDay(\`?day=45&hour=\${bestH.toFixed(4)}\`, null, wcMod.worldSec());

      const R = planetMod.PLANET.radius;
      const alt = 2_350_000;
      const pos = upVec.clone().multiplyScalar(R + alt);
      const camTmp = new THREE.PerspectiveCamera(45, 1280 / 720, 1, 1e9);
      camTmp.position.copy(pos);
      camTmp.up.set(0, 1, 0);
      camTmp.lookAt(0, 0, 0);
      window.__globe.drive({ position: pos, quaternion: camTmp.quaternion.clone(), fov: 45, aspect: 1280 / 720 });

      const cloudCb = document.querySelector('#globe-layers input[data-layer="clouds"]');
      if (cloudCb && cloudCb.checked) cloudCb.click();
      return { seed, bestH, maxElev };
    })()`);
    await waitGlobeTiles(9000);

    const probe1b = await evalJs(`(async () => {
      const findMod = (sub) => performance.getEntriesByType('resource').map((r) => r.name).find((n) => n.includes(sub)) || sub;
      const layersMod = await import(findMod('/src/world/globe/planetLayers.ts'));
      const hydroMod = await import(findMod('/src/world/globe/hydroLayer.ts'));
      const pwMod = await import(findMod('/src/core/planetWeather.ts'));

      const gl = document.getElementById('world');
      const cA = document.createElement('canvas'); cA.width = 1280; cA.height = 720;
      const ctxA = cA.getContext('2d');
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      ctxA.drawImage(gl, 0, 0, 1280, 720);
      const dataOn = ctxA.getImageData(200, 80, 800, 560).data;
      const uLayersBefore = layersMod.GLOBE_LAYERS.uLayers.value.toArray();

      // UNCHECK 'Snow / ice' in #globe-layers
      const snowCb = document.querySelector('#globe-layers input[data-layer="snowIce"]');
      if (snowCb && snowCb.checked) snowCb.click();
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r))));

      const cB = document.createElement('canvas'); cB.width = 1280; cB.height = 720;
      const ctxB = cB.getContext('2d');
      ctxB.drawImage(gl, 0, 0, 1280, 720);
      const dataOff = ctxB.getImageData(200, 80, 800, 560).data;
      const uLayersAfter = layersMod.GLOBE_LAYERS.uLayers.value.toArray();

      let changedPx = 0, whiteSnowIcePx = 0;
      const totalPx = dataOff.length / 4;
      for (let i = 0; i < dataOff.length; i += 4) {
        const dr = Math.abs(dataOn[i] - dataOff[i]);
        const dg = Math.abs(dataOn[i + 1] - dataOff[i + 1]);
        const db = Math.abs(dataOn[i + 2] - dataOff[i + 2]);
        if (dr + dg + db > 3) changedPx++;
        const lum = (0.2126 * dataOff[i] + 0.7152 * dataOff[i + 1] + 0.0722 * dataOff[i + 2]) / 255;
        if (lum > 0.45 && dataOff[i + 2] > 115) whiteSnowIcePx++;
      }

      const sim = pwMod.planetWeatherSim();
      const kenoraLive = sim ? pwMod.weatherAtLatLon(49.79, -94.36, sim) : null;
      const saharaLive = sim ? pwMod.weatherAtLatLon(23.5, 10.0, sim) : null;

      return {
        frame: 1,
        label: 'globe_hydrolayer_shadows_planetlayers_and_snow_ice_checkbox_ignored',
        altitudeM: Math.round(window.__globe.altitude),
        snowIceCheckboxChecked: Boolean(snowCb?.checked),
        cloudsCheckboxChecked: Boolean(document.querySelector('#globe-layers input[data-layer="clouds"]')?.checked),
        hydroLayerState: hydroMod.hydroLayerState(),
        uHydroLayerValue: hydroMod.HYDRO_DRAW.uHydroLayer.value,
        uLayersBeforeUncheck: uLayersBefore.map((v) => +v.toFixed(4)),
        uLayersAfterUncheck: uLayersAfter.map((v) => +v.toFixed(4)),
        changedPixelsFractionOnSnowIceUncheck: +(changedPx / totalPx).toFixed(6),
        whiteSnowSeaIcePixelsWithSnowIceOff: whiteSnowIcePx,
        whiteSnowSeaIceFractionWithSnowIceOff: +(whiteSnowIcePx / totalPx).toFixed(4),
        kenoraLiveSim: kenoraLive ? { tC: +kenoraLive.tC.toFixed(2), sweMm: +kenoraLive.sweMm.toFixed(1), precipMmDay: +kenoraLive.precipMmDay.toFixed(2) } : null,
        saharaLiveSim: saharaLive ? { tC: +saharaLive.tC.toFixed(2), rh: +saharaLive.rh.toFixed(3), precipMmDay: +saharaLive.precipMmDay.toFixed(2), soilMm: +saharaLive.soilMm.toFixed(1) } : null,
      };
    })()`);
    await snapPng('frame-1.png');
    observations.push(probe1b);

    // =========================================================================
    // STAGE 2: MORVEL Tectonic Plates Overlay (100% velocity sign inversion + polar raster)
    // =========================================================================
    const probe2 = await evalJs(`(async () => {
      const findMod = (sub) => performance.getEntriesByType('resource').map((r) => r.name).find((n) => n.includes(sub)) || sub;
      const THREE = await import(findMod('/deps/three.js'));
      const planetMod = await import(findMod('/src/world/globe/planet.ts'));
      const stagesMod = await import(findMod('/src/core/stages/elevation.ts'));
      const worldMod = await import(findMod('/src/core/world.ts'));
      const platesMod = await import(findMod('/src/world/globe/plates.ts'));
      const homeMod = await import(findMod('/src/world/globe/home.ts'));
      const todMod = await import(findMod('/src/core/timeOfDay.ts'));
      const wcMod = await import(findMod('/src/core/worldClock.ts'));

      const seed = stagesMod.STAGES.on ? stagesMod.STAGES.seed : worldMod.WORLD_SEED;
      const planet = homeMod.globePlanet(seed, stagesMod.STAGES.on, stagesMod.STAGES.seed);

      const snowCb = document.querySelector('#globe-layers input[data-layer="snowIce"]');
      if (snowCb && !snowCb.checked) snowCb.click();
      const platesCb = document.querySelector('#globe-layers input[data-layer="plates"]');
      if (platesCb && !platesCb.checked) platesCb.click();

      const upVec = new THREE.Vector3(...planetMod.fromLatLon(10 * Math.PI / 180, -102 * Math.PI / 180));
      let bestH = 12, maxElev = -90;
      for (let h = 0; h < 24; h += 0.05) {
        const sd = new THREE.Vector3(...planetMod.planetSunDirection(planet, h, 80));
        const el = Math.asin(Math.max(-1, Math.min(1, upVec.dot(sd)))) * 180 / Math.PI;
        if (el > maxElev) { maxElev = el; bestH = h; }
      }
      todMod.initDay(\`?day=80&hour=\${bestH.toFixed(4)}\`, null, wcMod.worldSec());

      const R = planetMod.PLANET.radius;
      const alt = 9_800_000;
      const pos = upVec.clone().multiplyScalar(R + alt);
      const camTmp = new THREE.PerspectiveCamera(45, 1280 / 720, 1, 1e9);
      camTmp.position.copy(pos);
      camTmp.up.set(0, 1, 0);
      camTmp.lookAt(0, 0, 0);
      window.__globe.drive({ position: pos, quaternion: camTmp.quaternion.clone(), fov: 45, aspect: 1280 / 720 });

      const pl = platesMod.buildPlates(seed);
      const bnds = platesMod.boundaries(pl, R, 0.4);
      let div = 0, conv = 0, trans = 0;
      for (const b of bnds) {
        if (b.kind === 'divergent') div++;
        else if (b.kind === 'convergent') conv++;
        else trans++;
      }
      return {
        frame: 2,
        label: 'morvel_plate_kinematics_100pct_sign_inversion_divergent_convergent_swapped',
        seed,
        altitudeM: Math.round(alt),
        platesCheckboxChecked: Boolean(platesCb?.checked),
        boundaryPointTotal: bnds.length,
        divergentCountGame: div,
        convergentCountGame: conv,
        transformCountGame: trans,
      };
    })()`);
    await waitGlobeTiles(8000);
    await snapPng('frame-2.png');
    observations.push(probe2);

    // =========================================================================
    // STAGE 3: Volumetric LocalClouds at Civil Twilight (-1.0 deg sun) — 20.83x Skylight Jump
    // =========================================================================
    const probe3Setup = await evalJs(`(async () => {
      const findMod = (sub) => performance.getEntriesByType('resource').map((r) => r.name).find((n) => n.includes(sub)) || sub;
      const THREE = await import(findMod('/deps/three.js'));
      const planetMod = await import(findMod('/src/world/globe/planet.ts'));
      const stagesMod = await import(findMod('/src/core/stages/elevation.ts'));
      const worldMod = await import(findMod('/src/core/world.ts'));
      const homeMod = await import(findMod('/src/world/globe/home.ts'));
      const pwMod = await import(findMod('/src/core/planetWeather.ts'));
      const ccMod = await import(findMod('/src/core/atmo/cloudColumn.ts'));
      const todMod = await import(findMod('/src/core/timeOfDay.ts'));
      const wcMod = await import(findMod('/src/core/worldClock.ts'));

      const platesCb = document.querySelector('#globe-layers input[data-layer="plates"]');
      if (platesCb && platesCb.checked) platesCb.click();
      const cloudCb = document.querySelector('#globe-layers input[data-layer="clouds"]');
      if (cloudCb && !cloudCb.checked) cloudCb.click();

      const seed = stagesMod.STAGES.on ? stagesMod.STAGES.seed : worldMod.WORLD_SEED;
      const planet = homeMod.globePlanet(seed, stagesMod.STAGES.on, stagesMod.STAGES.seed);
      const sim = pwMod.planetWeatherSim();

      // Pick a low-elevation moist land cell where LCL is 400..1100 m and cloud cover >= 0.65
      let best = { lat: 5, lon: -65, tC: 25, q: 0.017, cloud: 0.85, lcl: 700, gnd: 120 };
      if (sim && sim.n > 0) {
        const latP = sim.plane('lat'), lonP = sim.plane('lon'), landP = sim.plane('land'), elevP = sim.plane('elev'), tP = sim.plane('tair'), qP = sim.plane('q'), cP = sim.plane('cloud');
        let bestScore = -1;
        for (let i = 0; i < sim.n; i++) {
          if (landP[i] > 0.5 && elevP[i] >= 0 && elevP[i] < 350 && tP[i] > 16 && cP[i] > 0.65 && Math.abs(latP[i]) < 50) {
            const col = ccMod.cloudColumn(tP[i], qP[i], cP[i], 12000, undefined, Math.round(elevP[i] / 100) * 100);
            if (col.lcl > 350 && col.lcl < 1200 && col.top - col.lcl > 1200) {
              const sc = cP[i] * 2 + (1200 - col.lcl) / 1000;
              if (sc > bestScore) {
                bestScore = sc;
                best = { lat: latP[i], lon: lonP[i], tC: tP[i], q: qP[i], cloud: cP[i], lcl: col.lcl, gnd: elevP[i] };
              }
            }
          }
        }
      }

      // Find exact hour on day=80 where sun elevation at (best.lat, best.lon) is -0.9 deg (early civil twilight right after sunset!)
      const upVec = new THREE.Vector3(...planetMod.fromLatLon(best.lat * Math.PI / 180, best.lon * Math.PI / 180));
      let bestHour = 18.0, bestDiff = 1e9, chosenElev = -0.9;
      for (let h = 0; h < 24; h += 0.01) {
        const sd = new THREE.Vector3(...planetMod.planetSunDirection(planet, h, 80));
        const elev = Math.asin(Math.max(-1, Math.min(1, upVec.dot(sd)))) * 180 / Math.PI;
        const diff = Math.abs(elev - (-0.9));
        if (diff < bestDiff) { bestDiff = diff; bestHour = h; chosenElev = elev; }
      }
      todMod.initDay(\`?day=80&hour=\${bestHour.toFixed(4)}\`, null, wcMod.worldSec());

      // Place camera at alt = 320 m (below cloud base, looking up +18 deg into the volumetric cumulus bases & twilight sky, matching ref-3.jpg!)
      const surf = planet.sampleSurface([upVec.x, upVec.y, upVec.z]);
      const groundM = Math.max(0, surf.h);
      const R = planetMod.PLANET.radius;
      const alt = 320;
      const pos = upVec.clone().multiplyScalar(R + groundM + alt);

      const sunV = new THREE.Vector3(...planetMod.planetSunDirection(planet, bestHour, 80));
      const towardSun = sunV.clone().addScaledVector(upVec, -sunV.dot(upVec)).normalize();
      const pitchRad = 18 * Math.PI / 180;
      const lookDir = towardSun.clone().multiplyScalar(Math.cos(pitchRad)).addScaledVector(upVec, Math.sin(pitchRad)).normalize();
      const camTmp = new THREE.PerspectiveCamera(55, 1280 / 720, 1, 1e9);
      camTmp.position.copy(pos);
      camTmp.up.copy(upVec);
      camTmp.lookAt(pos.clone().addScaledVector(lookDir, 10000));
      window.__globe.drive({ position: pos, quaternion: camTmp.quaternion.clone(), fov: 55, aspect: 1280 / 720 });

      return { seed, best, bestHour: +bestHour.toFixed(3), chosenElev: +chosenElev.toFixed(2), groundM: Math.round(groundM), alt };
    })()`);

    // Step >= 80 animation frames so globeView refreshes colIn and bakes localClouds
    await evalJs(`new Promise((resolve) => {
      let k = 0;
      const tick = () => { if (++k >= 85) resolve(true); else requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    })`);
    await waitGlobeTiles(6000);

    const probe3 = await evalJs(`(async () => {
      const lc = window.__globe.localClouds;
      const u = lc?.mesh?.material?.uniforms;
      const col = lc?.column();
      const mu = u ? u.uSunMu.value : 0;
      const hDeg = Math.asin(Math.max(-1, Math.min(1, mu))) * 180 / Math.PI;
      const atmSkyF = hDeg >= 0 ? Math.max(0.048, Math.min(1, mu / 0.5)) : 0.048 * Math.pow(10, 0.4 * Math.max(hDeg, -30));

      const gl = document.getElementById('world');
      const c = document.createElement('canvas'); c.width = 1280; c.height = 720;
      const ctx = c.getContext('2d'); ctx.drawImage(gl, 0, 0, 1280, 720);
      const upper = ctx.getImageData(120, 40, 960, 520).data;
      let sumCloudBand = 0, brightCloudPx = 0, maxCloudLuma = 0;
      for (let i = 0; i < upper.length; i += 4) {
        const l = (0.2126 * upper[i] + 0.7152 * upper[i + 1] + 0.0722 * upper[i + 2]) / 255;
        sumCloudBand += l;
        if (l > maxCloudLuma) maxCloudLuma = l;
        if (l > 0.25) brightCloudPx++;
      }

      return {
        frame: 3,
        label: 'local_clouds_civil_twilight_20_8x_skylight_jump_and_frozen_keptclouds',
        setup: ${JSON.stringify(probe3Setup)},
        localCloudsMeshVisible: Boolean(lc?.mesh?.visible),
        columnLclM: col ? +col.lcl.toFixed(1) : null,
        columnTopM: col ? +col.top.toFixed(1) : null,
        uSunMu: +mu.toFixed(5),
        sunElevDeg: +hDeg.toFixed(2),
        uSkyFGame: u ? +u.uSkyF.value.toFixed(5) : null,
        atmSkyFExpected: +atmSkyF.toFixed(5),
        skyLevelOverbrightRatio: atmSkyF > 0 && u ? +(u.uSkyF.value / atmSkyF).toFixed(3) : null,
        uExt: u ? +u.uExt.value.toFixed(5) : null,
        skyCloudMeanSrgbLuma: +(sumCloudBand / (upper.length / 4)).toFixed(4),
        skyCloudPeakSrgbLuma: +maxCloudLuma.toFixed(4),
        brightTwilightCloudPixelsGt025: brightCloudPx,
      };
    })()`);
    await snapPng('frame-3.png');
    observations.push(probe3);

    await sleep(450);
    const webmBase64 = await evalJs(`new Promise((resolve) => {
      window.__stopComp = true;
      const rec = window.__rec;
      rec.onstop = async () => {
        const blob = new Blob(window.__recChunks, { type: rec.mimeType || 'video/webm' });
        const buf = await blob.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let bin = '';
        const chunk = 0x8000;
        for (let i = 0; i < bytes.length; i += chunk) {
          bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
        }
        resolve(btoa(bin));
      };
      rec.stop();
    })`);
    const webmBuf = Buffer.from(webmBase64, 'base64');
    writeFileSync(resolve(__dirname, 'recording.webm'), webmBuf);

    const out = {
      capturedAt: new Date().toISOString(),
      viewport: { width: 1280, height: 720 },
      recordingBytes: webmBuf.length,
      pageErrors,
      observations,
    };
    writeFileSync(resolve(__dirname, 'observations.json'), JSON.stringify(out, null, 2) + '\n');
    console.log(JSON.stringify(out, null, 2));
    ws.close();
  } finally {
    if (edge?.pid) {
      try { execSync(`taskkill /PID ${edge.pid} /T /F`, { stdio: 'ignore' }); } catch {}
    }
    if (viteProc?.pid) {
      try { execSync(`taskkill /PID ${viteProc.pid} /T /F`, { stdio: 'ignore' }); } catch {}
    }
    try { rmSync(WORK_ROOT, { recursive: true, force: true }); } catch {}
    release();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
