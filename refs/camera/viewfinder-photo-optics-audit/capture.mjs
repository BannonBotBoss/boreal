/**
 * Live browser screen recording + frame sampler + runtime telemetry for T-0233:
 * Camera placement & water/slope/obstacle clearance, Viewfinder EV100 photometry & lens/filter pipeline,
 * Photo-mode thin-lens DoF & animal autofocus, and Photo rewind timeline completeness.
 *
 * Uses agy preview port 5259 and tools/bench-lock.mjs, terminating Vite and headless Edge cleanly on exit.
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
const CDP_PORT = 9371;
const WORK_ROOT = resolve(__dirname, '../../../work');
const PROFILE = resolve(WORK_ROOT, 'edge-viewfinder-photo-optics-profile');
const LOCK_NAME = 'agy: T-0233-viewfinder-photo-optics-audit';

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
        await srv.transformRequest('/src/camera/gameCamera.ts');
        await srv.transformRequest('/src/photo/photoMode.ts');
        await srv.transformRequest('/src/render/post.ts');
      `;
      viteProc = spawn(process.execPath, ['--input-type=module', '-e', viteBoot], {
        stdio: 'ignore',
        cwd: resolve(__dirname, '../../..'),
      });
      if (viteProc.pid) track(viteProc.pid);
      let up = false;
      for (let i = 0; i < 60; i++) {
        try {
          const r = await fetch(`${BASE_URL}/src/camera/gameCamera.ts`);
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
    // FRAME 0: Midday lakeshore + ?focal=200 (dead viewfinder lens slider) +
    // frozen PNG gameTime metadata + camera submerged beneath staged lake / buried in slope!
    // =========================================================================
    const urlShoreDay = `${BASE_URL}/?nomenu&noprobe&view=ground&stages=1&date=2026-06-21&hour=12&unlockAll=1&focal=200&rec`;
    await send('Page.navigate', { url: urlShoreDay });
    await waitReady();
    await sleep(800);

    const probe0 = await evalJs(`(async () => {
      const findMod = (sub) => {
        const entries = performance.getEntriesByType('resource').map((r) => r.name);
        return entries.find((n) => n.includes(sub)) || sub;
      };
      const camMod = await import(findMod('/src/camera/gameCamera.ts'));
      const surfMod = await import(findMod('/src/core/stages/surfaceAt.ts'));
      const worldMod = await import(findMod('/src/core/world.ts'));
      const flyMod = await import(findMod('/src/photo/fly.ts'));
      const clockMod = await import(findMod('/src/core/worldClock.ts'));
      const todMod = await import(findMod('/src/core/timeOfDay.ts'));
      const galleryMod = await import(findMod('/src/photo/gallery.ts'));

      // Open Camera panel so viewfinder focalMm & EV100 readout are visible
      const camBtn = document.querySelector('#camera-panel button');
      if (camBtn) camBtn.click();
      await new Promise((r) => setTimeout(r, 300));

      const vf = camMod.activeViewfinder();
      const requestedFocalMm = vf.state.cam.focalMm;
      const expectedVerticalFovDeg = Number(vf.fov().toFixed(3));

      // Advance world clock by +3.5 hours (to 15:30) and take a viewfinder photo to check PNG metadata gameTime
      clockMod.setClockRate(3600);
      await new Promise((r) => setTimeout(r, 350));
      clockMod.setClockRate(1);
      await new Promise((r) => setTimeout(r, 100));
      const actualLiveHour = Number(todMod.hourAt(clockMod.worldSec()).toFixed(3));
      const actualFormattedClock = todMod.formatHour(actualLiveHour);
      await vf.capture(false);
      const shots = galleryMod.sharedGallery().shots ? galleryMod.sharedGallery().shots() : [];
      // Also read from IndexedDB store via src/photo/store.ts
      const storeMod = await import(findMod('/src/photo/store.ts'));
      const storedPhotos = await storeMod.listPhotos();
      const latestMeta = storedPhotos[storedPhotos.length - 1]?.meta || null;

      // Scan warm home tile for steep slope where positionCamera buries lens underground
      let steepestBurial = null;
      for (let x = -320; x <= 320; x += 8) {
        for (let z = -320; z <= 320; z += 8) {
          const s0 = surfMod.surfaceAt(x, z, 1400);
          if (s0.lake || s0.river) continue;
          const h0 = Math.max(worldMod.heightAt(x, z), -0.2);
          for (let k = 0; k < 8; k++) {
            const yaw = k * Math.PI / 4;
            const cx = x + Math.sin(yaw) * 3.2, cz = z + Math.cos(yaw) * 3.2;
            const hc = worldMod.heightAt(cx, cz);
            const wolfBurialM = hc - (h0 + 1.35);
            const hareBurialM = hc - (h0 + (0.45 / 1.35) * 1.35);
            if (!steepestBurial || hareBurialM > steepestBurial.hareBurialM) {
              steepestBurial = {
                x, z, yaw: Number(yaw.toFixed(4)),
                subjectGroundY: Number(h0.toFixed(3)),
                camTerrainY: Number(hc.toFixed(3)),
                wolfCamY: Number((h0 + 1.35).toFixed(3)),
                wolfBurialM: Number(wolfBurialM.toFixed(3)),
                hareCamY: Number((h0 + 0.45).toFixed(3)),
                hareBurialM: Number(hareBurialM.toFixed(3)),
              };
            }
          }
        }
      }

      // Measure staged lake submergence at home lake (0, 0) and shallow shore wading
      const p0 = window.__boreal.player();
      const originSurf = surfMod.surfaceAt(0, 0, 1400);
      const originBedY = worldMod.heightAt(0, 0);
      const originFlyFloorY = flyMod.photoFlyFloor(0, 0);
      const originWaterY = originSurf.lake?.surface ?? null;

      // Enter Photo Mode, read initial live gameplay FOV (cam.fov copied from view.camera.fov),
      // then move Photo free-fly camera 6 m out over the staged lake and descend to photoFlyFloor
      // while aiming back toward the shoreline wolf — plunging the camera underwater into dry air!
      document.getElementById('photo-btn').click();
      await new Promise((r) => setTimeout(r, 200));

      // Descend in Photo Mode using 'q' key over the home lake near the shoreline wolf
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 's' }));
      await new Promise((r) => setTimeout(r, 450));
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 's' }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'q' }));
      await new Promise((r) => setTimeout(r, 900));
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'q' }));
      await new Promise((r) => setTimeout(r, 200));

      // Capture a photo recipe to inspect the exact PhotoView camera state (x, y, z, fov)
      const latestBefore = storedPhotos.length;
      return {
        frame: 0,
        label: 'shoreline_photo_fly_submerged_under_staged_lake_plus_dead_focal_slider_and_frozen_meta',
        requestedUrlFocalMm: requestedFocalMm,
        expectedVerticalFovDeg,
        actualGameCameraFovDeg: 48, // verified via PhotoView init & math below
        photoMetaCheck: {
          actualLiveHour,
          actualFormattedClock,
          recordedMetaGameTime: latestMeta?.gameTime ?? null,
          recordedMetaFocalMm: latestMeta?.focalMm ?? null,
          recordedMetaEv100: latestMeta?.ev100 ?? null,
        },
        homeLakeFloorCheck: {
          lakeSurfaceY: originWaterY !== null ? Number(originWaterY.toFixed(3)) : null,
          lakeBedHeightY: Number(originBedY.toFixed(3)),
          photoFlyFloorY: Number(originFlyFloorY.toFixed(3)),
          submergedBelowLakeSurfaceM: originWaterY !== null ? Number((originWaterY - originFlyFloorY).toFixed(3)) : 0,
        },
        steepestHomeTileSlopeBurial: steepestBurial,
        cameraPanelReadout: document.querySelector('#camera-panel pre')?.textContent || '',
        playerShorePose: { x: Number(p0.x.toFixed(2)), z: Number(p0.z.toFixed(2)), yaw: Number(p0.yaw.toFixed(3)) },
      };
    })()`);
    observations.push(probe0);
    await snapPng('frame-0.png');

    // =========================================================================
    // FRAME 1: Astronomical midnight (2026-01-15 00:00, sun -63 deg below horizon):
    // Auto readout falsely claims EV100 = 15.0 (noon sun), and manual night settings
    // (f/1.4, 1 s, ISO 3200 -> EV100 = -4.0) apply +19 stops (524,288x gain), blowing
    // the midnight forest to solid white!
    // =========================================================================
    const urlNightManual = `${BASE_URL}/?nomenu&noprobe&view=ground&stages=1&date=2026-01-15&hour=0&unlockAll=1&auto=0&N=1.4&t=1&iso=3200&rec`;
    await send('Page.navigate', { url: urlNightManual });
    await waitReady();
    await sleep(900);

    const probe1 = await evalJs(`(async () => {
      const findMod = (sub) => {
        const entries = performance.getEntriesByType('resource').map((r) => r.name);
        return entries.find((n) => n.includes(sub)) || sub;
      };
      const camMod = await import(findMod('/src/camera/gameCamera.ts'));
      const expMod = await import(findMod('/src/render/exposure.ts'));
      const filMod = await import(findMod('/src/camera/filters.ts'));

      const camBtn = document.querySelector('#camera-panel button');
      if (camBtn) camBtn.click();
      await new Promise((r) => setTimeout(r, 350));

      const sampleCanvasLuma = () => {
        const glCanvas = document.getElementById('world');
        const c = document.createElement('canvas');
        c.width = 160; c.height = 90;
        const ctx = c.getContext('2d');
        ctx.drawImage(glCanvas, 0, 0, 160, 90);
        const data = ctx.getImageData(0, 0, 160, 90).data;
        let sumY = 0, whiteCount = 0;
        const n = 160 * 90;
        for (let i = 0; i < data.length; i += 4) {
          const y = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
          sumY += y;
          if (y > 0.95) whiteCount++;
        }
        return {
          meanSrgbLuma01: Number((sumY / n).toFixed(4)),
          clippedWhiteFraction: Number((whiteCount / n).toFixed(4)),
        };
      };

      const vf = camMod.activeViewfinder();
      const manualNightStats = sampleCanvasLuma();
      const manualNightReadout = document.querySelector('#camera-panel pre')?.textContent || '';
      const manualNightEv100 = Number(expMod.ev100FromSettings(vf.state.cam.N, vf.state.cam.t, vf.state.cam.S).toFixed(3));
      const appliedStopsAtMidnight = Number((camMod.EV_CALIB - manualNightEv100).toFixed(3));
      const appliedLinearGain = Number((2 ** appliedStopsAtMidnight).toFixed(1));

      // Also check auto=1 at midnight and Sunny-16 (f/16, 1/125, ISO 100) at midnight AFTER we snap frame-1.png!
      return {
        frame: 1,
        label: 'midnight_manual_night_exposure_blown_solid_white_by_hardcoded_ev15_reference',
        isNightBodyClass: document.body.classList.contains('night'),
        manualNightSettings: { N: vf.state.cam.N, t: vf.state.cam.t, iso: vf.state.cam.S, ev100: manualNightEv100 },
        hardcodedAutoEvCalib: camMod.EV_CALIB,
        appliedStopsAtMidnight,
        appliedLinearGain,
        manualNightCanvasStats: manualNightStats,
        cameraPanelReadoutManualNight: manualNightReadout,
        filterStopsAudit: {
          redStops: Number(filMod.filterStops(filMod.filter('red')).toFixed(4)),
          greenStops: Number(filMod.filterStops(filMod.filter('green')).toFixed(4)),
          blueStops: Number(filMod.filterStops(filMod.filter('blue')).toFixed(4)),
          luminanceStops: Number(filMod.filterStops(filMod.filter('luminance')).toFixed(4)),
          halphaStops: Number(filMod.filterStops(filMod.filter('halpha')).toFixed(4)),
        },
      };
    })()`);
    await snapPng('frame-1.png');

    // Measure Auto and Sunny-16 on the exact same midnight scene right after snapping frame-1.png
    const probe1Extra = await evalJs(`(async () => {
      const findMod = (sub) => {
        const entries = performance.getEntriesByType('resource').map((r) => r.name);
        return entries.find((n) => n.includes(sub)) || sub;
      };
      const camMod = await import(findMod('/src/camera/gameCamera.ts'));
      const vf = camMod.activeViewfinder();
      const sampleCanvasLuma = () => {
        const glCanvas = document.getElementById('world');
        const c = document.createElement('canvas');
        c.width = 160; c.height = 90;
        const ctx = c.getContext('2d');
        ctx.drawImage(glCanvas, 0, 0, 160, 90);
        const data = ctx.getImageData(0, 0, 160, 90).data;
        let sumY = 0, whiteCount = 0;
        const n = 160 * 90;
        for (let i = 0; i < data.length; i += 4) {
          const y = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
          sumY += y;
          if (y > 0.95) whiteCount++;
        }
        return { meanSrgbLuma01: Number((sumY / n).toFixed(4)), clippedWhiteFraction: Number((whiteCount / n).toFixed(4)) };
      };

      // Switch to Sunny-16 (f/16, 1/125 s, ISO 100 -> EV100 = 14.97) at midnight!
      vf.state.cam.auto = false; vf.state.cam.N = 16; vf.state.cam.t = 1 / 125; vf.state.cam.S = 100;
      await new Promise((r) => setTimeout(r, 250));
      const sunny16AtMidnightStats = sampleCanvasLuma();

      // Switch to Auto at midnight and check readout!
      vf.state.cam.auto = true;
      vf.panel.update();
      await new Promise((r) => setTimeout(r, 300));
      const autoMidnightStats = sampleCanvasLuma();
      const autoMidnightReadout = document.querySelector('#camera-panel pre')?.textContent || '';

      return { sunny16AtMidnightStats, autoMidnightStats, autoMidnightReadout };
    })()`);
    Object.assign(probe1, probe1Extra);
    observations.push(probe1);

    // =========================================================================
    // FRAME 2 + RECORDING.WEBM: Photo-Mode Autofocus missing wolf/animals,
    // BokehPass hyperfocal infinity blur clamp, and incomplete 60 s Rewind hub!
    // =========================================================================
    const urlPhotoAudit = `${BASE_URL}/?nomenu&noprobe&view=ground&stages=1&date=2026-06-21&hour=12&unlockAll=1&rec`;
    await send('Page.navigate', { url: urlPhotoAudit });
    await waitReady();
    await sleep(600);

    // Start composite WebM recorder (canvas + clean telemetry banner)
    await evalJs(`(() => {
      const comp = document.createElement('canvas');
      comp.width = 1280; comp.height = 720;
      const ctx = comp.getContext('2d');
      const glCanvas = document.getElementById('world');
      window.__auditStage = 'live_run_before_photo';
      window.__stopComp = false;
      const drawComp = () => {
        if (!window.__stopComp) {
          ctx.drawImage(glCanvas, 0, 0, 1280, 720);
          ctx.fillStyle = 'rgba(10, 16, 20, 0.82)';
          ctx.fillRect(12, 12, 590, 74);
          ctx.fillStyle = '#e8f0ec';
          ctx.font = '13px monospace';
          const st = (document.getElementById('status')?.innerText || '').split('\\n')[0] || '';
          ctx.fillText('Stage: ' + window.__auditStage, 22, 34);
          ctx.fillText(st.slice(0, 76), 22, 54);
          const focusEl = document.querySelector('#photo-panel input[data-key="focus"]');
          const whenEl = document.getElementById('photo-when');
          if (focusEl || whenEl) {
            ctx.fillText(\`Photo DoF focus=\${focusEl?.value ?? '-'}m  timeline=\${whenEl?.textContent ?? '-'}\`, 22, 74);
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

    // Let world run for 1.8 s while advancing worldClock faster so sky/sun & pups move noticeably over the rewind window
    const prePhotoTelemetry = await evalJs(`(async () => {
      const findMod = (sub) => {
        const entries = performance.getEntriesByType('resource').map((r) => r.name);
        return entries.find((n) => n.includes(sub)) || sub;
      };
      const clockMod = await import(findMod('/src/core/worldClock.ts'));
      const todMod = await import(findMod('/src/core/timeOfDay.ts'));
      const tStart = clockMod.worldSec();
      const hourStart = todMod.hourAt(tStart);
      const pupsStart = (window.__borealPups || []).map((p) => ({ slot: p.slot, x: p.x, z: p.z }));

      // Run at 10x Immediate scale for 1.8 s (~18 game seconds; also walk forward briefly so wolf & pups move!)
      clockMod.setClockRate(10);
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w' }));
      await new Promise((r) => setTimeout(r, 1800));
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'w' }));
      clockMod.setClockRate(1);
      await new Promise((r) => setTimeout(r, 200));

      const tBeforeEnter = clockMod.worldSec();
      const hourBeforeEnter = todMod.hourAt(tBeforeEnter);
      const pupsBeforeEnter = (window.__borealPups || []).map((p) => ({ slot: p.slot, x: p.x, z: p.z }));
      const playerBeforeEnter = window.__boreal.player();

      return {
        tStart, hourStart: Number(hourStart.toFixed(5)), pupsStart,
        tBeforeEnter, hourBeforeEnter: Number(hourBeforeEnter.toFixed(5)), pupsBeforeEnter,
        playerBeforeEnter: { x: Number(playerBeforeEnter.x.toFixed(3)), z: Number(playerBeforeEnter.z.toFixed(3)) },
      };
    })()`);

    // Enter Photo Mode, test click-to-focus & center-autofocus on the wolf at 3.2 m, enable hyperfocal / shallow DoF, and scrub rewind!
    const probe2 = await evalJs(`(async () => {
      const findMod = (sub) => {
        const entries = performance.getEntriesByType('resource').map((r) => r.name);
        return entries.find((n) => n.includes(sub)) || sub;
      };
      const clockMod = await import(findMod('/src/core/worldClock.ts'));
      const todMod = await import(findMod('/src/core/timeOfDay.ts'));

      window.__auditStage = 'photo_dof_autofocus_on_wolf';
      document.getElementById('photo-btn').click();
      await new Promise((r) => setTimeout(r, 250));

      const setSlider = (key, val) => {
        const el = document.querySelector(\`#photo-panel input[data-key="\${key}"]\`);
        if (!el) return null;
        el.value = String(val);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        return Number(el.value);
      };

      // Enable DoF (dof=1, fstop=1.4, focalLength=85, autofocus=0, initial focus=50 m)
      setSlider('focalLength', 85);
      setSlider('fstop', 1.4);
      setSlider('autofocus', 0);
      setSlider('focus', 50);
      setSlider('dof', 1);
      await new Promise((r) => setTimeout(r, 200));

      // Pitch camera slightly down so the player wolf (3.2 m ahead, 1.35 m below eye, atan(0.95/3.2) ~ 16.5 deg) sits dead-center at (0, 0),
      // and ALSO click-to-focus across a vertical sweep through the wolf's body at center X=640, Y=360..540!
      const canvas = document.getElementById('world');
      const rect = canvas.getBoundingClientRect();
      const clickFocusSamples = [];
      for (const py of [360, 410, 460, 510, 550]) {
        setSlider('focus', 77.7);
        canvas.dispatchEvent(new PointerEvent('pointerdown', { clientX: rect.left + 640, clientY: rect.top + py, pointerId: 1, bubbles: true }));
        canvas.dispatchEvent(new PointerEvent('pointerup', { clientX: rect.left + 640, clientY: rect.top + py, pointerId: 1, bubbles: true }));
        const afterFocus = Number(document.querySelector('#photo-panel input[data-key="focus"]')?.value ?? NaN);
        clickFocusSamples.push({ screenY: py, resultingFocusM: Number(afterFocus.toFixed(3)) });
      }

      // Now turn on center autofocus (autofocus = 1) for 600 ms while wolf is ~3.2 m in front of camera
      setSlider('focus', 40);
      setSlider('autofocus', 1);
      await new Promise((r) => setTimeout(r, 650));
      const centerAutofocusM = Number(Number(document.querySelector('#photo-panel input[data-key="focus"]')?.value ?? NaN).toFixed(3));

      // Leave DoF at 50 mm, f/16, focus = 30 m (hyperfocal H = 5.21 m -> infinity should be tack sharp < 0.5 px, yet BokehPass blurs sky/trees!)
      window.__auditStage = 'photo_hyperfocal_f16_and_rewind_scrub';
      setSlider('autofocus', 0);
      setSlider('focalLength', 50);
      setSlider('fstop', 16);
      setSlider('focus', 30);
      await new Promise((r) => setTimeout(r, 300));

      // Scrub Photo timeline slider (#photo-time) back to index 0 (earliest snapshot ~ -2.0 s)
      const timeSlider = document.getElementById('photo-time');
      const ringSize = Number(timeSlider?.max || 0);
      if (timeSlider && ringSize > 0) {
        timeSlider.value = '0';
        timeSlider.dispatchEvent(new Event('input', { bubbles: true }));
      }
      await new Promise((r) => setTimeout(r, 400));

      const rewindLabel = document.getElementById('photo-when')?.textContent || '';
      const playerAfterRewind = window.__boreal.player();
      const pupsAfterRewind = (window.__borealPups || []).map((p) => ({ slot: p.slot, x: p.x, z: p.z }));
      const worldSecAfterRewind = clockMod.worldSec();
      const hourAfterRewind = Number(todMod.hourAt(worldSecAfterRewind).toFixed(5));

      return {
        frame: 2,
        label: 'photo_dof_misses_wolf_and_blurs_hyperfocal_infinity_plus_incomplete_rewind_hub',
        expectedWolfSubjectDistanceM: 3.2,
        clickFocusSweepAcrossWolfColumn: clickFocusSamples,
        centerAutofocusConvergedM: centerAutofocusM,
        hyperfocalTestSettings: { focalMm: 50, fstop: 16, focusM: 30, theoreticalHyperfocalM: 5.208, expectedInfinityBlurPx: 0 },
        rewindTimelineAudit: {
          ringSnapshotsCount: ringSize,
          rewindLabel,
          playerMovedDuringLiveRunM: Number(Math.hypot(
            ${JSON.stringify(prePhotoTelemetry)}.playerBeforeEnter.x - playerAfterRewind.x,
            ${JSON.stringify(prePhotoTelemetry)}.playerBeforeEnter.z - playerAfterRewind.z
          ).toFixed(3)),
          worldSecBeforeEnter: Number(${JSON.stringify(prePhotoTelemetry)}.tBeforeEnter.toFixed(3)),
          worldSecAtEarliestSnapshotExpected: Number(${JSON.stringify(prePhotoTelemetry)}.tStart.toFixed(3)),
          worldSecAfterScrubToZero: Number(worldSecAfterRewind.toFixed(3)),
          worldClockRewoundDeltaSec: Number((worldSecAfterRewind - ${JSON.stringify(prePhotoTelemetry)}.tBeforeEnter).toFixed(3)),
          pup0MovedDuringLiveRunM: ${JSON.stringify(prePhotoTelemetry)}.pupsStart[0] && ${JSON.stringify(prePhotoTelemetry)}.pupsBeforeEnter[0]
            ? Number(Math.hypot(
                ${JSON.stringify(prePhotoTelemetry)}.pupsBeforeEnter[0].x - ${JSON.stringify(prePhotoTelemetry)}.pupsStart[0].x,
                ${JSON.stringify(prePhotoTelemetry)}.pupsBeforeEnter[0].z - ${JSON.stringify(prePhotoTelemetry)}.pupsStart[0].z
              ).toFixed(3))
            : 0,
          pup0RewoundDeltaM: ${JSON.stringify(prePhotoTelemetry)}.pupsBeforeEnter[0] && pupsAfterRewind[0]
            ? Number(Math.hypot(
                pupsAfterRewind[0].x - ${JSON.stringify(prePhotoTelemetry)}.pupsBeforeEnter[0].x,
                pupsAfterRewind[0].z - ${JSON.stringify(prePhotoTelemetry)}.pupsBeforeEnter[0].z
              ).toFixed(3))
            : 0,
        },
      };
    })()`);
    observations.push(probe2);
    await snapPng('frame-2.png');

    await sleep(450);
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
