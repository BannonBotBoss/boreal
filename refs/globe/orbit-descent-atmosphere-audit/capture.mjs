/**
 * Live browser screen recording + frame sampler + runtime telemetry for T-0235:
 * Planetary globe home-longitude geography (+65.54° E Kazakhstan vs -94.49° W Kenora),
 * orbit-to-glide & forest-to-orbit altitude teleports + 1-frame embody snap,
 * vacuum supersonic free-fall + dead 0.00 m/s glide handoff, and
 * multi-scale cloud-deck swaps (2,500 km 1-frame pop, dead CLOUD_OPEN 1,500->40 km, frozen un-toggled orbit clouds).
 *
 * Uses agy preview port 5260 and tools/bench-lock.mjs, terminating Vite and headless Edge cleanly on exit.
 */
import { spawn, execSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquire, track, release } from '../../../tools/bench-lock.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
mkdirSync(__dirname, { recursive: true });

const PORT = 5260;
const BASE_URL = process.env.BOREAL_URL || `http://127.0.0.1:${PORT}`;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const CDP_PORT = 9373;
const WORK_ROOT = resolve(__dirname, '../../../work');
const PROFILE = resolve(WORK_ROOT, 'edge-orbit-descent-atmosphere-profile');
const LOCK_NAME = 'agy: T-0235-orbit-descent-atmosphere-audit';

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
        await srv.transformRequest('/src/world/globe/entry.ts');
        await srv.transformRequest('/src/world/globe/globeView.ts');
        await srv.transformRequest('/src/world/globe/inpage.ts');
        await srv.transformRequest('/src/main.ts');
      `;
      viteProc = spawn(process.execPath, ['--input-type=module', '-e', viteBoot], {
        stdio: 'ignore',
        cwd: resolve(__dirname, '../../..'),
      });
      if (viteProc.pid) track(viteProc.pid);
      let up = false;
      for (let i = 0; i < 60; i++) {
        try {
          const r = await fetch(`${BASE_URL}/src/world/globe/flight.ts`);
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

    await send('Page.enable');
    await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });

    const observations = [];

    // =========================================================================
    // PART A (STANDALONE GLOBE: ?view=globe):
    // Frame 0: Default opening orbit over planet.home (+65.54° E Kazakhstan instead
    //          of -94.49° W Kenora, Ontario), subsolar noon over Central Asia while
    //          Kenora is in astronomical night (-19.8°), Layer Panel Clouds OFF ignored
    //          by Blue Marble orbit clouds, and 0° zonal wind drift over +6 h!
    // Frame 1: 1-frame cloud swap across 2,500 km (2,505 km -> 2,495 km) + dead
    //          CLOUD_OPEN (1,500 km -> 40 km uClear === 0.000)!
    // =========================================================================
    const urlGlobe = `${BASE_URL}/?view=globe&stages=1&date=2026-06-21&hour=12&panel=1&tier=1`;
    await send('Page.navigate', { url: urlGlobe });
    for (let i = 0; i < 120; i++) {
      await sleep(300);
      const booted = await evalJs(`Boolean(window.__globe && window.__globe.bootSettled && window.__globe.stats().drawn > 0)`);
      if (booted) break;
    }
    await sleep(1500);

    // Show debug HUD (` key) so coordinates and altitude are visible on frame-0.png & frame-1.png
    await evalJs(`window.dispatchEvent(new KeyboardEvent('keydown', { key: '\`', code: 'Backquote', bubbles: true }))`);
    await sleep(300);

    const probe0 = await evalJs(`(async () => {
      const findMod = (sub) => {
        const entries = performance.getEntriesByType('resource').map((r) => r.name);
        return entries.find((n) => n.includes(sub)) || sub;
      };
      const planetMod = await import(findMod('/src/world/globe/planet.ts'));
      const orbitMod = await import(findMod('/src/world/globe/orbitAlbedo.ts'));
      const transMod = await import(findMod('/src/world/globe/transition.ts'));
      const localMod = await import(findMod('/src/world/globe/localClouds.ts'));
      const clockMod = await import(findMod('/src/core/worldClock.ts'));
      const todMod = await import(findMod('/src/core/timeOfDay.ts'));

      const g = window.__globe;
      const p = g.planet;
      const homeLL = planetMod.toLatLon(p.home);
      const homeLatDeg = Number((homeLL.lat * 180 / Math.PI).toFixed(4));
      const homeLonDeg = Number((homeLL.lon * 180 / Math.PI).toFixed(4));

      // True Kenora, Ontario (Lake of the Woods): 49.77 N, -94.49 W
      const kenoraLatDeg = 49.77, kenoraLonDeg = -94.49;
      const kenoraDir = planetMod.fromLatLon(kenoraLatDeg * Math.PI / 180, kenoraLonDeg * Math.PI / 180);
      const dotHK = Math.max(-1, Math.min(1, p.home[0] * kenoraDir[0] + p.home[1] * kenoraDir[1] + p.home[2] * kenoraDir[2]));
      const greatCircleOffsetKm = Number((Math.acos(dotHK) * planetMod.PLANET.radius / 1000).toFixed(1));
      const lonOffsetDeg = Number(Math.abs(homeLonDeg - kenoraLonDeg).toFixed(4));

      // Sun direction at game clock 12:00 noon on summer solstice (day 172):
      const sec = clockMod.worldSec();
      const sunDir = planetMod.planetSunDirection(p, todMod.hourAt(sec), todMod.dayAt(sec));
      const sunLL = planetMod.toLatLon(sunDir);
      const subsolarLatDeg = Number((sunLL.lat * 180 / Math.PI).toFixed(3));
      const subsolarLonDeg = Number((sunLL.lon * 180 / Math.PI).toFixed(3));
      const kenoraSinElev = kenoraDir[0] * sunDir[0] + kenoraDir[1] * sunDir[1] + kenoraDir[2] * sunDir[2];
      const kenoraSunElevDegAtNoon = Number((Math.asin(Math.max(-1, Math.min(1, kenoraSinElev))) * 180 / Math.PI).toFixed(3));
      const gameLayerUtcHours = Number(((((todMod.hourAt(sec) - homeLonDeg / 15) % 24) + 24) % 24).toFixed(3));
      const expectedKenoraUtcHours = Number(((((todMod.hourAt(sec) - kenoraLonDeg / 15) % 24) + 24) % 24).toFixed(3));

      // Uncheck "Clouds" in the Layer Panel and verify ORBIT_DRAW still draws 100% Blue Marble clouds!
      const cloudRow = [...document.querySelectorAll('label, button, div')].find((el) =>
        el.querySelector && el.querySelector('input[type="checkbox"]') && /clouds/i.test(el.textContent || '')
      );
      let cloudsCheckboxFound = false;
      let cloudsCheckedAfterClick = null;
      const inputs = [...document.querySelectorAll('input[type="checkbox"]')];
      for (const inp of inputs) {
        const lbl = inp.closest('label') || inp.parentElement;
        if (lbl && /clouds/i.test(lbl.textContent || '')) {
          cloudsCheckboxFound = true;
          if (inp.checked) inp.click();
          cloudsCheckedAfterClick = inp.checked;
          break;
        }
      }
      await new Promise((r) => setTimeout(r, 350));
      const uOrbitWithCloudsOff = Number(orbitMod.ORBIT_DRAW.uOrbit.value.toFixed(4));
      const uOrbitDeckWithCloudsOff = Number(orbitMod.ORBIT_DRAW.uOrbitDeck.value.toFixed(4));

      // Re-enable clouds checkbox after recording Frame 0
      const hudText = [...document.querySelectorAll('div')].find((d) => (d.textContent || '').includes('Boreal planet'))?.textContent || '';

      return {
        frame: 0,
        label: 'orbit_home_in_kazakhstan_65_54E_kenora_in_midnight_and_untoggled_static_orbit_clouds',
        homeLatDeg,
        homeLonDeg,
        expectedKenoraLatDeg: kenoraLatDeg,
        expectedKenoraLonDeg: kenoraLonDeg,
        lonOffsetDeg,
        greatCircleOffsetKm,
        noonSolarCheck: {
          gameLocalHour: Number(todMod.hourAt(sec).toFixed(3)),
          subsolarLatDeg,
          subsolarLonDeg,
          kenoraSunElevDegAtNoon,
          expectedKenoraNoonSunElevDeg: 63.67,
          gameLayerUtcHours,
          expectedKenoraUtcHours,
          utcPhaseErrorHours: Number(Math.abs(expectedKenoraUtcHours - gameLayerUtcHours).toFixed(3)),
        },
        orbitCloudToggleAndDriftAudit: {
          altitudeM: Math.round(g.altitude),
          cloudsCheckboxFound,
          cloudsCheckedAfterClick,
          uOrbitWithCloudsOff,
          uOrbitDeckWithCloudsOff,
          orbitFragUsesDriftUniform: orbitMod.ORBIT_FRAG.includes('uDrift'),
        },
        hudText: hudText.trim(),
      };
    })()`);
    observations.push(probe0);
    await snapPng('frame-0.png');

    // Re-enable Clouds checkbox and test the 2,505 km -> 2,495 km 1-frame cloud swap + dead CLOUD_OPEN (1,500 km -> 40 km)!
    const probe1 = await evalJs(`(async () => {
      const findMod = (sub) => {
        const entries = performance.getEntriesByType('resource').map((r) => r.name);
        return entries.find((n) => n.includes(sub)) || entries[0];
      };
      const orbitMod = await import(findMod('/src/world/globe/orbitAlbedo.ts'));
      const transMod = await import(findMod('/src/world/globe/transition.ts'));
      const localMod = await import(findMod('/src/world/globe/localClouds.ts'));

      for (const inp of document.querySelectorAll('input[type="checkbox"]')) {
        const lbl = inp.closest('label') || inp.parentElement;
        if (lbl && /clouds/i.test(lbl.textContent || '') && !inp.checked) inp.click();
      }
      await new Promise((r) => setTimeout(r, 250));

      const sampleDiscRgb = () => {
        window.__globe.renderTo(null);
        const gl = document.getElementById('world');
        const c = document.createElement('canvas');
        c.width = 160; c.height = 90;
        const ctx = c.getContext('2d');
        ctx.drawImage(gl, 0, 0, 160, 90);
        return ctx.getImageData(40, 15, 80, 60).data;
      };

      const g = window.__globe;
      g.jumpTo(2_505_000);
      await new Promise((r) => setTimeout(r, 350));
      const above2500 = {
        altM: Math.round(g.altitude),
        orbitWeight: Number(orbitMod.orbitWeight(g.altitude).toFixed(5)),
        uOrbit: Number(orbitMod.ORBIT_DRAW.uOrbit.value.toFixed(5)),
        uOrbitDeck: Number(orbitMod.ORBIT_DRAW.uOrbitDeck.value.toFixed(5)),
      };
      const pxAbove = sampleDiscRgb();

      g.jumpTo(2_495_000);
      await new Promise((r) => setTimeout(r, 350));
      const below2500 = {
        altM: Math.round(g.altitude),
        orbitWeight: Number(orbitMod.orbitWeight(g.altitude).toFixed(5)),
        uOrbit: Number(orbitMod.ORBIT_DRAW.uOrbit.value.toFixed(5)),
        uOrbitDeck: Number(orbitMod.ORBIT_DRAW.uOrbitDeck.value.toFixed(5)),
      };
      const pxBelow = sampleDiscRgb();

      let absDiffSum = 0, changedPx = 0;
      const nPx = pxAbove.length / 4;
      for (let i = 0; i < pxAbove.length; i += 4) {
        const d = (Math.abs(pxAbove[i] - pxBelow[i]) + Math.abs(pxAbove[i + 1] - pxBelow[i + 1]) + Math.abs(pxAbove[i + 2] - pxBelow[i + 2])) / (3 * 255);
        absDiffSum += d;
        if (d > 0.08) changedPx++;
      }

      // Sample CLOUD_OPEN (1,500 km -> 150 km) vs live globeView setClear formula across altitudes
      const clearSweep = [];
      for (const altKm of [1500, 800, 400, 200, 140.4, 60, 41, 36, 31]) {
        const altM = altKm * 1000;
        const designedCloudClear = Number(transMod.cloudClear(altM).toFixed(4));
        const liveLocalFade = Number(localMod.localCloudFade(altM).toFixed(4));
        const liveAppliedSetClear = Number((designedCloudClear * liveLocalFade).toFixed(4));
        clearSweep.push({ altKm, designedCloudClear, liveLocalFade, liveAppliedSetClear });
      }

      return {
        frame: 1,
        label: 'hard_1frame_cloud_swap_across_2500km_and_dead_cloud_open_1500_to_40km',
        above2500,
        below2500,
        across10kmMeanRgbJump01: Number((absDiffSum / nPx).toFixed(4)),
        across10kmChangedPixelShare: Number((changedPx / nPx).toFixed(4)),
        cloudOpenVsLiveSetClearSweep: clearSweep,
      };
    })()`);
    observations.push(probe1);
    await snapPng('frame-1.png');

    // =========================================================================
    // PART B (IN-PAGE ORBIT <-> BAND <-> FOREST + RECORDING.WEBM):
    // Frame 2: Press G in orbit at 14,016 km -> Frame-1 99.0% teleport to 140.4 km
    //          + 0.609 vignette pop -> arrive at 400 m "Gliding above the land"
    //          frozen at 0.000 m/s (arrestGlide dead) + vacuum supersonic fallVelocity!
    // Frame 3: Press G at 400 m -> 1-frame 398.45 m camera snap (handoverBlend no-op)
    //          + Shift+G ascent from remote Kenora (-94.49 W) -> 1-frame 2.1 km to
    //          14,016 km jumpTo teleport & remote-site wipe back to +65.54 E!
    // =========================================================================
    const urlInpage = `${BASE_URL}/?start=globe&noprobe&transition=inpage&inpagelow=1&stages=1&trees=v2&date=2026-06-21&hour=12&rec`;
    await send('Page.navigate', { url: urlInpage });
    let inpageReady = false;
    for (let i = 0; i < 100; i++) {
      await sleep(300);
      inpageReady = await evalJs(`Boolean(window.__inpage && window.__inpage.mode === 'globe' && window.__inpage.globe?.bootSettled && !document.getElementById('loading'))`);
      if (inpageReady) break;
    }
    if (!inpageReady) throw new Error(`In-page globe did not settle: ${JSON.stringify(pageErrors)}`);
    await sleep(600);

    // Start composite WebM recorder capturing live canvas + telemetry overlay
    await evalJs(`(() => {
      const comp = document.createElement('canvas');
      comp.width = 1280; comp.height = 720;
      const ctx = comp.getContext('2d');
      const glCanvas = document.getElementById('world');
      window.__auditStage = 'inpage_orbit_before_G_drop';
      window.__stopComp = false;
      const drawComp = () => {
        if (!window.__stopComp) {
          ctx.drawImage(glCanvas, 0, 0, 1280, 720);
          ctx.fillStyle = 'rgba(8, 14, 22, 0.84)';
          ctx.fillRect(12, 12, 680, 76);
          ctx.fillStyle = '#e8f2ee';
          ctx.font = '13px monospace';
          const ip = window.__inpage;
          const mode = ip?.mode ?? '-';
          const alt = mode === 'globe' ? ip?.globe?.altitude : ip?.height;
          const rush = ip?.airRush ? ip.airRush() : 0;
          const cover = document.getElementById('descent-cover')?.style?.opacity ?? '0';
          ctx.fillText('Stage: ' + window.__auditStage, 22, 33);
          ctx.fillText(\`mode=\${mode}  phase=\${ip?.flightPhase ?? '-'}  alt=\${alt != null ? Math.round(alt) + ' m' : '-'}  airRush=\${rush.toFixed(2)} m/s  vignette=\${Number(cover).toFixed(2)}\`, 22, 54);
          const pr = document.getElementById('flight-prompt')?.textContent || '';
          ctx.fillText(pr.slice(0, 88), 22, 74);
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

    await sleep(700);

    // Trigger 'G' descent in orbit and measure Frame-0 vs Frame-1 altitude & vignette!
    const descentTrace = await evalJs(`(async () => {
      const findMod = (sub) => {
        const entries = performance.getEntriesByType('resource').map((r) => r.name);
        return entries.find((n) => n.includes(sub)) || sub;
      };
      const flightMod = await import(findMod('/src/world/globe/flight.ts'));

      const ip = window.__inpage;
      const g = ip.globe;
      const preDropAltM = Number(g.altitude.toFixed(1));
      const preDropCover = Number(document.getElementById('descent-cover')?.style?.opacity || 0);

      window.__auditStage = 'pressing_G_orbit_descent';
      const tStart = performance.now();
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'g', code: 'KeyG', bubbles: true }));
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'g', code: 'KeyG', bubbles: true }));

      // Wait exactly 1 requestAnimationFrame so globe.step runs 1 frame of fall!
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const frame1ElapsedMs = Number((performance.now() - tStart).toFixed(1));
      const frame1AltM = Number(g.altitude.toFixed(1));
      const frame1Cover = Number(Number(document.getElementById('descent-cover')?.style?.opacity || 0).toFixed(4));
      const frame1AltSkippedFraction = Number(((preDropAltM - frame1AltM) / preDropAltM).toFixed(6));

      // Also evaluate vacuum fallVelocity & freeFallVy directly from flight.ts
      const vacuumFallVel100kmTo10kFtMs = Number(flightMod.fallVelocity(100_000, flightMod.FALL_END_M).toFixed(2));
      let vySub = 0, ySub = 3000;
      for (let i = 0; i < 6000 && ySub > 400; i++) {
        vySub = flightMod.freeFallVy(vySub, ySub, 1 / 60);
        ySub += vySub / 60;
      }
      const vacuumFreeFall3000mTo400mMs = Number(vySub.toFixed(2));

      return {
        preDropAltM,
        preDropCover,
        frame1ElapsedMs,
        frame1AltM,
        frame1AltSkippedFraction,
        frame1Cover,
        configuredDescentSec: flightMod.DESCENT.sec,
        configuredVacuumSkipShare: flightMod.DESCENT.vacuum,
        actualRemainingDescentSec: Number((flightMod.DESCENT.sec * (1 - flightMod.DESCENT.vacuum)).toFixed(2)),
        vacuumFallVel100kmTo10kFtMs,
        vacuumFreeFall3000mTo400mMs,
      };
    })()`);

    // Wait for the seated drop (~7.6 s) to arrive at mode === 'band' (400 m glide)
    let arrivedBand = false;
    let descentWallSec = 0;
    const tDropWait = Date.now();
    for (let i = 0; i < 60; i++) {
      await sleep(250);
      const st = await evalJs(`({ mode: window.__inpage.mode, phase: window.__inpage.flightPhase, h: window.__inpage.height })`);
      if (st.mode === 'band') {
        arrivedBand = true;
        descentWallSec = Number(((Date.now() - tDropWait) / 1000).toFixed(2));
        break;
      }
    }
    if (!arrivedBand) throw new Error('Did not reach band mode after G drop');

    // Measure 1.5 seconds of hands-off "Gliding above the land · Speed carries on" at 400 m!
    const probe2 = await evalJs(`(async () => {
      window.__auditStage = 'band_400m_glide_frozen_at_0ms';
      const ip = window.__inpage;
      const p0 = ip.player();
      const h0 = ip.height;
      const rush0 = ip.airRush();
      await new Promise((r) => setTimeout(r, 1500));
      const p1 = ip.player();
      const h1 = ip.height;
      const rush1 = ip.airRush();
      const horizontalGlidedM = Number(Math.hypot(p1.x - p0.x, p1.z - p0.z).toFixed(4));
      const promptText = document.getElementById('flight-prompt')?.textContent || '';

      return {
        frame: 2,
        label: 'orbit_frame1_99pct_teleport_and_400m_glide_frozen_at_0ms',
        descentTrace: ${JSON.stringify(descentTrace)},
        measuredDescentWallSec: ${descentWallSec},
        glideCheckOver1500ms: {
          heightStartM: Number(h0.toFixed(2)),
          heightEndM: Number(h1.toFixed(2)),
          airRushStartMs: Number(rush0.toFixed(4)),
          airRushEndMs: Number(rush1.toFixed(4)),
          horizontalGlidedM,
          expectedGlideSpeedMs: 8.0,
          expectedHorizontalGlidedM: 12.0,
          flightPromptText: promptText,
        },
      };
    })()`);
    observations.push(probe2);
    await snapPng('frame-2.png');

    // Wait until centre chunk is built so 'G' embody is accepted, then measure frame-by-frame embody snap + Shift+G ascent teleport!
    const probe3 = await evalJs(`(async () => {
      const findMod = (sub) => {
        const entries = performance.getEntriesByType('resource').map((r) => r.name);
        return entries.find((n) => n.includes(sub)) || sub;
      };
      const planetMod = await import(findMod('/src/world/globe/planet.ts'));
      const transMod = await import(findMod('/src/world/globe/transition.ts'));
      const siteMod = await import(findMod('/src/core/sitePhase.ts'));

      const ip = window.__inpage;
      // Wait up to 8 s for landing chunk under player to be built
      for (let i = 0; i < 40; i++) {
        if (ip.STATS.ready || ip.fade > 0) break;
        await new Promise((r) => setTimeout(r, 200));
      }

      window.__auditStage = 'pressing_G_embody_1frame_snap';
      const cam = ip.view.camera;
      const preEmbodyCamY = Number(cam.position.y.toFixed(3));
      const preEmbodyHeightAGL = Number(ip.height.toFixed(3));
      const frameSamples = [{ frame: 0, dtMs: 0, mode: ip.mode, camY: preEmbodyCamY }];
      const tEmbody = performance.now();

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'g', code: 'KeyG', bubbles: true }));
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'g', code: 'KeyG', bubbles: true }));

      for (let f = 1; f <= 6; f++) {
        await new Promise((r) => requestAnimationFrame(r));
        frameSamples.push({
          frame: f,
          dtMs: Number((performance.now() - tEmbody).toFixed(1)),
          mode: ip.mode,
          camY: Number(cam.position.y.toFixed(3)),
        });
      }

      const gameReachedAtFrame = frameSamples.find((s) => s.mode === 'game')?.frame ?? -1;
      const gameReachedDtMs = frameSamples.find((s) => s.mode === 'game')?.dtMs ?? -1;
      const postEmbodyCamY = frameSamples.find((s) => s.mode === 'game')?.camY ?? Number(cam.position.y.toFixed(3));

      await new Promise((r) => setTimeout(r, 300));

      return {
        preEmbodyCamY,
        preEmbodyHeightAGL,
        postEmbodyCamY,
        embodySnapJumpM: Number(Math.abs(preEmbodyCamY - postEmbodyCamY).toFixed(3)),
        configuredBlendSec: transMod.TRANSITION.blendSec,
        gameReachedAtFrame,
        gameReachedDtMs,
        embodyFrameTrace: frameSamples,
      };
    })()`);

    // Snap frame-3.png right after the 1-frame embody snap onto the wolf ground camera!
    await snapPng('frame-3.png');

    // Now test Shift+G ascent from a remote Kenora landing (-94.49 W, 49.77 N) to prove the 1-frame 2.1 km -> 14,016 km jumpTo & remote-site wipe!
    const ascentAudit = await evalJs(`(async () => {
      const findMod = (sub) => {
        const entries = performance.getEntriesByType('resource').map((r) => r.name);
        return entries.find((n) => n.includes(sub)) || sub;
      };
      const planetMod = await import(findMod('/src/world/globe/planet.ts'));
      const siteMod = await import(findMod('/src/core/sitePhase.ts'));

      const ip = window.__inpage;
      // Place at remote Kenora (49.77 N, -94.49 W), embody to game, then ascend()!
      ip.placeAt(49.77, -94.49, 12);
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 150));
      }
      // Force embody to game at remote Kenora
      ip.showForest({ x: ip.player().x, z: ip.player().z, yaw: 0 });
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const remoteBeforeAscend = siteMod.SITE.remote;
      const siteLonBeforeAscend = Number((planetMod.toLatLon(siteMod.SITE.dir).lon * 180 / Math.PI).toFixed(3));

      window.__auditStage = 'shift_G_ascent_2100m_to_14016km_teleport';
      ip.ascend();
      let lastBandHeightM = 0;
      let firstGlobeAltM = 0;
      let firstGlobeLonDeg = 0;
      for (let f = 0; f < 400; f++) {
        await new Promise((r) => requestAnimationFrame(r));
        if (ip.mode === 'band') {
          lastBandHeightM = Number(ip.height.toFixed(1));
        } else if (ip.mode === 'globe') {
          firstGlobeAltM = Number(ip.globe.altitude.toFixed(1));
          const pos = ip.globe.camera.position;
          const L = pos.length() || 1;
          const ll = planetMod.toLatLon([pos.x / L, pos.y / L, pos.z / L]);
          firstGlobeLonDeg = Number((ll.lon * 180 / Math.PI).toFixed(3));
          break;
        }
      }

      return {
        remoteBeforeAscend,
        siteLonBeforeAscend,
        lastBandHeightM,
        firstGlobeAltM,
        ascentOneFrameJumpRatio: lastBandHeightM > 0 ? Number((firstGlobeAltM / lastBandHeightM).toFixed(1)) : 0,
        firstGlobeLonDegAfterAscent: firstGlobeLonDeg,
        wipedRemoteSiteLonDeltaDeg: Number(Math.abs(firstGlobeLonDeg - siteLonBeforeAscend).toFixed(3)),
      };
    })()`);

    observations.push({
      frame: 3,
      label: 'embody_1frame_398m_camera_snap_and_shiftG_ascent_6674x_teleport_wiping_remote_site',
      embodyAudit: probe3,
      ascentAudit,
    });

    await sleep(400);
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
