/**
 * Live browser screen recording + 4-stage PNG frame sampler + runtime telemetry for T-0246
 * (Horizon-Scale Water Continuity & Drained Base-Water Basins, Underwater Submersion Optics &
 * Nocturnal/Advective Wakes, Fluvial Step/Bank Alignment, and Remote Great-Lakes Hydrography Audit).
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
const CDP_PORT = 9376;
const WORK_ROOT = resolve(__dirname, '../../../work-t0246');
const PROFILE = resolve(WORK_ROOT, 'edge-water-hydro-audit-profile');
const LOCK_NAME = 'agy: T-0246-water-horizon-fluvial-submersion-hydro-audit';

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
        await srv.transformRequest('/src/main.ts');
        await srv.transformRequest('/src/render/water.ts');
        await srv.transformRequest('/src/render/chunkWater.ts');
        await srv.transformRequest('/src/render/terrainCore.ts');
        await srv.transformRequest('/src/core/waterWake.ts');
      `;
      viteProc = spawn(process.execPath, ['--input-type=module', '-e', viteBoot], {
        stdio: 'ignore',
        cwd: resolve(__dirname, '../../..'),
      });
      if (viteProc.pid) track(viteProc.pid);
      let up = false;
      for (let i = 0; i < 60; i++) {
        try {
          const r = await fetch(`${BASE_URL}/src/render/water.ts`);
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
        const origGetContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function(type, attrs) {
          if (type === 'webgl' || type === 'webgl2') {
            attrs = Object.assign({}, attrs || {}, { preserveDrawingBuffer: true });
          }
          return origGetContext.call(this, type, attrs);
        };
      })();`,
    });

    const waitBoot = async () => {
      let ready = false;
      for (let i = 0; i < 240; i++) {
        await sleep(500);
        await send('Page.bringToFront').catch(() => {});
        ready = await evalJs(`Boolean(
          document.readyState === 'complete' &&
          !document.getElementById('loading') &&
          window.__boreal &&
          typeof window.borealPlace === 'function' &&
          typeof window.wake === 'function'
        )`);
        if (ready) break;
      }
      if (!ready) throw new Error(`Game did not finish booting: ${JSON.stringify(pageErrors)}`);
    };

    await send('Page.navigate', {
      url: `${BASE_URL}/?nomenu=1&noprobe=1&view=ground&stages=1&trees=v2&date=2026-08-15&hour=13.5&rec&wake=1`,
    });
    await waitBoot();

    // Hide HUD chrome so captured frames show unobstructed 3D world geometry & optics
    await evalJs(`(() => {
      for (const el of document.body.children) {
        if (el.tagName !== 'CANVAS') el.style.visibility = 'hidden';
      }
      return true;
    })()`);

    // Start continuous 20 fps composite WebM recorder across all 4 stages
    await evalJs(`(() => {
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

    const waitChunksSettled = async (maxWaitMs = 9000) => {
      await sleep(400);
      const start = Date.now();
      while (Date.now() - start < maxWaitMs) {
        const q = await evalJs(`(async () => {
          const findMod = (sub) => performance.getEntriesByType('resource').map((r) => r.name).find((n) => n.includes(sub)) || sub;
          const interestMod = await import(findMod('/src/core/interest.ts'));
          return interestMod.queued();
        })()`);
        if (q === 0) break;
        await sleep(250);
      }
      await sleep(700);
    };

    const observations = [];

    // =========================================================================
    // STAGE 0: Home Drained 19.22 m Base-Water Lake Crater near Spawn (-55, -340 -> -100, -340)
    // =========================================================================
    const shore0 = await evalJs(`(async () => {
      const findMod = (sub) => performance.getEntriesByType('resource').map((r) => r.name).find((n) => n.includes(sub)) || sub;
      const worldMod = await import(findMod('/src/core/world.ts'));
      const surfMod = await import(findMod('/src/core/stages/surfaceAt.ts'));
      const coverMod = await import(findMod('/src/world/globe/coverSample.ts'));
      const todMod = await import(findMod('/src/core/timeOfDay.ts'));
      const wcMod = await import(findMod('/src/core/worldClock.ts'));
      worldMod.setPictureFit(null);
      todMod.initDay('?date=2026-08-15&hour=13.5', null, wcMod.worldSec());

      // Find exact eastern shoreline rim just above -0.25 m looking west into (-100, -340) 19.22 m deep open-water crater
      let sx = -40, sz = -340;
      for (let x = -95; x <= 20; x += 2) {
        const sp = surfMod.surfaceAt(x, -340, 1400);
        if (!sp.lake && sp.height > 0.6 && sp.height < 3.5) { sx = x; break; }
      }
      window.borealPlace(sx, sz, Math.PI / 2, 0.22);
      return {
        sx,
        sz,
        standHeightM: +worldMod.heightAt(sx, sz).toFixed(2),
        craterCenter: surfMod.surfaceAt(-100, -340, 1400),
        drawOpenWaterAtCrater: coverMod.drawOpenWater(-100, -340),
      };
    })()`);
    await waitChunksSettled(10000);
    const probe0 = await evalJs(`(async () => {
      const findMod = (sub) => performance.getEntriesByType('resource').map((r) => r.name).find((n) => n.includes(sub)) || sub;
      const mathMod = await import(findMod('/src/render/math.ts'));
      const coverMod = await import(findMod('/src/world/globe/coverSample.ts'));
      const surfMod = await import(findMod('/src/core/stages/surfaceAt.ts'));
      let openWaterChunksInMid = 0, totalBaseWaterChunksInMid = 0;
      const cx0 = Math.floor(${shore0.sx} / 40), cz0 = Math.floor(${shore0.sz} / 40);
      for (let dz = -3; dz <= 3; dz++) {
        for (let dx = -3; dx <= 3; dx++) {
          const mx = (cx0 + dx) * 40 + 20, mz = (cz0 + dz) * 40 + 20;
          const sp = surfMod.surfaceAt(mx, mz, 1400);
          if (sp.lake?.kind === 'open') {
            totalBaseWaterChunksInMid++;
            if (coverMod.drawOpenWater(mx, mz)) openWaterChunksInMid++;
          }
        }
      }
      const glCanvas = document.getElementById('world') || document.querySelector('canvas');
      const tmp = document.createElement('canvas'); tmp.width = 1280; tmp.height = 720;
      const tctx = tmp.getContext('2d'); tctx.drawImage(glCanvas, 0, 0, 1280, 720);
      const d = tctx.getImageData(320, 380, 640, 260).data;
      let sumR = 0, sumG = 0, sumB = 0, blueDominantPx = 0;
      const nPx = d.length / 4;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
        sumR += r; sumG += g; sumB += b;
        if (b > r * 1.1 && b > g * 1.02) blueDominantPx++;
      }
      return {
        frame: 0,
        label: 'home_drained_19m_base_water_lake_crater_missing_open_water_sheet',
        shoreStand: { x: ${shore0.sx}, z: ${shore0.sz}, groundHeightM: ${shore0.standHeightM}, cameraHeightM: +(${shore0.standHeightM} + mathMod.RIDER_HEIGHT).toFixed(2) },
        craterCenterSurfaceAt: ${JSON.stringify(shore0.craterCenter)},
        craterDepthM: +((-0.25) - (${shore0.craterCenter.height})).toFixed(2),
        drawOpenWaterAtCrater: ${shore0.drawOpenWaterAtCrater},
        baseWaterChunksInMid: totalBaseWaterChunksInMid,
        openWaterSheetsMountedInMid: openWaterChunksInMid,
        craterBasinMeanSrgbRGB: [+(sumR / nPx).toFixed(4), +(sumG / nPx).toFixed(4), +(sumB / nPx).toFixed(4)],
        craterBasinBlueWaterPixelFraction: +(blueDominantPx / nPx).toFixed(4),
      };
    })()`);
    await snapPng('frame-0.png');
    observations.push(probe0);

    // =========================================================================
    // STAGE 1: 102.6 ha Perched Boreal Lake Shore (2265, 3180) Looking East Across 710 m Fetch
    // Shows staged-water truncating abruptly in a 40 m chunk stair-step cliff at INTEREST.mid = 100 m!
    // =========================================================================
    await evalJs(`(() => {
      window.borealPlace(2265, 3180, -Math.PI / 2, 0.10);
      return true;
    })()`);
    await waitChunksSettled(10000);
    const probe1 = await evalJs(`(async () => {
      const findMod = (sub) => performance.getEntriesByType('resource').map((r) => r.name).find((n) => n.includes(sub)) || sub;
      const worldMod = await import(findMod('/src/core/world.ts'));
      const mathMod = await import(findMod('/src/render/math.ts'));
      const skirtMod = await import(findMod('/src/world/globe/horizonSkirt.ts'));
      const interestMod = await import(findMod('/src/core/interest.ts'));
      const standH = worldMod.heightAt(2265, 3180);
      const camY = standH + mathMod.RIDER_HEIGHT;
      const eyeAboveLakeM = Math.max(1.6, camY - 23.37);
      const geomHorizonM = skirtMod.horizonMetres(eyeAboveLakeM);
      const glCanvas = document.getElementById('world') || document.querySelector('canvas');
      const tmp = document.createElement('canvas'); tmp.width = 1280; tmp.height = 720;
      const tctx = tmp.getContext('2d'); tctx.drawImage(glCanvas, 0, 0, 1280, 720);
      const nearD = tctx.getImageData(380, 480, 520, 90).data;
      const farD = tctx.getImageData(380, 365, 520, 48).data;
      const meanRgb = (arr) => {
        let r = 0, g = 0, b = 0, n = arr.length / 4;
        for (let i = 0; i < arr.length; i += 4) { r += arr[i] / 255; g += arr[i + 1] / 255; b += arr[i + 2] / 255; }
        return [+(r / n).toFixed(4), +(g / n).toFixed(4), +(b / n).toFixed(4)];
      };
      return {
        frame: 1,
        label: 'perched_102ha_lake_710m_fetch_truncated_at_100m_interest_mid_exposing_dry_bed',
        stand: { x: 2265, z: 3180, groundHeightM: +standH.toFixed(2), cameraY: +camY.toFixed(2) },
        lakeSurfaceM: 23.37,
        lakeFetchEastM: 710,
        interestMidM: interestMod.INTEREST.mid,
        unrenderedFetchBeyondMidM: 710 - interestMod.INTEREST.mid,
        geometricHorizonM: +geomHorizonM.toFixed(2),
        nearLakeWaterSrgbRGB: meanRgb(nearD),
        beyond100mDrainedLakeBedSrgbRGB: meanRgb(farD),
      };
    })()`);
    await snapPng('frame-1.png');
    observations.push(probe1);

    // =========================================================================
    // STAGE 2: Underwater Submersion (~1.8 m below 23.37 m Lake Surface) Looking Upward Toward Shore & Sky
    // Demonstrates FrontSide backface culling (overhead water completely disappears, 0 Snell's window, Kd = 0)!
    // =========================================================================
    const subSpot = await evalJs(`(async () => {
      const findMod = (sub) => performance.getEntriesByType('resource').map((r) => r.name).find((n) => n.includes(sub)) || sub;
      const worldMod = await import(findMod('/src/core/world.ts'));
      const mathMod = await import(findMod('/src/render/math.ts'));
      const riversMod = await import(findMod('/src/core/stages/rivers.ts'));
      let best = { x: 2315, z: 3180, bed: 20.0, surface: 23.37, camY: 20.0 + mathMod.RIDER_HEIGHT };
      for (let x = 2275; x <= 2420; x += 4) {
        const p = riversMod.pondAt(1400, x, 3180);
        if (!p) continue;
        const h = worldMod.heightAt(x, 3180);
        const camY = h + mathMod.RIDER_HEIGHT;
        if (p.surface - camY >= 1.2 && p.surface - camY <= 2.4) {
          best = { x, z: 3180, bed: +h.toFixed(2), surface: +p.surface.toFixed(2), camY: +camY.toFixed(2) };
          break;
        }
      }
      // Face West (Math.PI / 2) back toward the forested shore, pitched upward (-0.22 rad = +12.6 deg above horizon)
      window.borealPlace(best.x, best.z, Math.PI / 2, -0.22);
      return best;
    })()`);
    await waitChunksSettled(9000);
    const probe2 = await evalJs(`(async () => {
      const findMod = (sub) => performance.getEntriesByType('resource').map((r) => r.name).find((n) => n.includes(sub)) || sub;
      const waterMod = await import(findMod('/src/render/water.ts'));
      const wm = waterMod.waterMaterial();
      const side = wm.side;
      wm.dispose();
      const glCanvas = document.getElementById('world') || document.querySelector('canvas');
      const tmp = document.createElement('canvas'); tmp.width = 1280; tmp.height = 720;
      const tctx = tmp.getContext('2d'); tctx.drawImage(glCanvas, 0, 0, 1280, 720);
      const skyD = tctx.getImageData(240, 40, 800, 180).data;
      let r = 0, g = 0, b = 0, n = skyD.length / 4;
      for (let i = 0; i < skyD.length; i += 4) { r += skyD[i] / 255; g += skyD[i + 1] / 255; b += skyD[i + 2] / 255; }
      return {
        frame: 2,
        label: 'submerged_camera_underwater_frontside_culled_zero_snells_window_unattenuated_dry_sky',
        wolfStand: ${JSON.stringify(subSpot)},
        submersionDepthM: +(${subSpot.surface} - ${subSpot.camY}).toFixed(2),
        waterMaterialSideEnum: side,
        waterMaterialIsFrontSideOnly: side === 0,
        overheadSkyFromUnderwaterMeanSrgbRGB: [+(r / n).toFixed(4), +(g / n).toFixed(4), +(b / n).toFixed(4)],
      };
    })()`);
    await snapPng('frame-2.png');
    observations.push(probe2);

    // =========================================================================
    // STAGE 3: Astronomical Midnight (hour=0.05, sun = -26.2 deg) Bioluminescent 0.55 Wakes &
    // Zero-Advection River Ripples
    // =========================================================================
    const wadeSpot = await evalJs(`(async () => {
      const findMod = (sub) => performance.getEntriesByType('resource').map((r) => r.name).find((n) => n.includes(sub)) || sub;
      const worldMod = await import(findMod('/src/core/world.ts'));
      const riversMod = await import(findMod('/src/core/stages/rivers.ts'));
      const todMod = await import(findMod('/src/core/timeOfDay.ts'));
      const wcMod = await import(findMod('/src/core/worldClock.ts'));
      todMod.initDay('?date=2026-08-15&hour=0.05', null, wcMod.worldSec());

      let best = { x: 2278, z: 3180, depth: 0.28 };
      for (let z = 3140; z <= 3240; z += 3) {
        for (let x = 2265; x <= 2320; x += 2) {
          const p = riversMod.pondAt(1400, x, z);
          if (!p) continue;
          const d = p.surface - worldMod.heightAt(x, z);
          const p2 = riversMod.pondAt(1400, x, z + 6);
          const d2 = p2 ? p2.surface - worldMod.heightAt(x, z + 6) : -1;
          if (d >= 0.16 && d <= 0.40 && d2 >= 0.14 && d2 <= 0.55) {
            best = { x, z, depth: +d.toFixed(3) };
            z = 9999; break;
          }
        }
      }
      window.borealPlace(best.x, best.z, Math.PI, 0.34);
      return best;
    })()`);
    await waitChunksSettled(8000);

    // Hold 'w' for 1.8 seconds so the wolf wades forward and stamps real paw rings + Kelvin wake at midnight!
    await evalJs(`(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', bubbles: true }));
      return true;
    })()`);
    await sleep(1800);
    await evalJs(`(() => {
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'w', bubbles: true }));
      return true;
    })()`);
    await sleep(250);

    const probe3 = await evalJs(`(async () => {
      const findMod = (sub) => performance.getEntriesByType('resource').map((r) => r.name).find((n) => n.includes(sub)) || sub;
      const todMod = await import(findMod('/src/core/timeOfDay.ts'));
      const wcMod = await import(findMod('/src/core/worldClock.ts'));
      const wakeMod = await import(findMod('/src/core/waterWake.ts'));
      const doy = todMod.dayAt(wcMod.worldSec());
      const hour = todMod.hourAt(wcMod.worldSec());
      const sun = todMod.sunPosition(hour, doy);
      const dbg = window.wake();

      // Test wake advection directly on a 1.194 m/s river current over dt = 2.0 s
      const rUpstream = wakeMod.ringAt(100 - wakeMod.WAVE.cg * 2.0, 100, 12.0, { x: 100, z: 100, t0: 10.0, amp: 1.0 });
      const rAdvectedTarget = wakeMod.ringAt(100 + 2.388 + wakeMod.WAVE.cg * 2.0, 100, 12.0, { x: 100, z: 100, t0: 10.0, amp: 1.0 });

      const glCanvas = document.getElementById('world') || document.querySelector('canvas');
      const tmp = document.createElement('canvas'); tmp.width = 1280; tmp.height = 720;
      const tctx = tmp.getContext('2d'); tctx.drawImage(glCanvas, 0, 0, 1280, 720);
      const d = tctx.getImageData(260, 320, 760, 380).data;
      let sumL = 0, maxL = 0, glowingWakePxGt025 = 0, glowingWakePxGt050 = 0;
      const nPx = d.length / 4;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
        const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        sumL += l;
        if (l > maxL) maxL = l;
        if (l > 0.25) glowingWakePxGt025++;
        if (l > 0.50) glowingWakePxGt050++;
      }
      return {
        frame: 3,
        label: 'astronomical_midnight_bioluminescent_055_wake_glow_and_zero_river_advection',
        wadeStart: ${JSON.stringify(wadeSpot)},
        hour: +hour.toFixed(3),
        sunElevationDeg: +sun.elevation.toFixed(2),
        activeRings: dbg?.rings?.length ?? 0,
        activeWakes: dbg?.wakes?.length ?? 0,
        midnightWaterMeanLuma: +(sumL / nPx).toFixed(4),
        midnightWakePeakSrgbLuma: +maxL.toFixed(4),
        midnightGlowingPixelsGt025: glowingWakePxGt025,
        midnightGlowingPixelsGt050: glowingWakePxGt050,
        staticRingSlopeMagUpstreamAgainstCurrent: +Math.hypot(rUpstream.sx, rUpstream.sz).toFixed(4),
        ringSlopeMagAtPhysicalDownstreamAdvectedPos: +Math.hypot(rAdvectedTarget.sx, rAdvectedTarget.sz).toFixed(4),
      };
    })()`);
    await snapPng('frame-3.png');
    observations.push(probe3);

    // Hold 400 ms so Stage 3 settles into the WebM recording, then finalize recording.webm
    await sleep(400);
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
