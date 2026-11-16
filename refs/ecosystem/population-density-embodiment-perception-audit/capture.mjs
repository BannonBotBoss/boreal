/**
 * Live browser screen recording + 4-stage PNG frame sampler + runtime telemetry for T-0249
 * (Coarse Population Temporal/Spatial Fold & Carrying Capacity, Unlit Floating animalDensity Discs,
 * Living-Pack Embodiment & 12x Lifespan Clock Desync, and Disconnected #106 Perception / Sense-Stream Starvation Audit).
 *
 * Uses agy preview port 5268 and tools/bench-lock.mjs, killing Vite and headless Edge cleanly on exit.
 */
import { spawn, execSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquire, track, release } from '../../../tools/bench-lock.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
mkdirSync(__dirname, { recursive: true });

const PORT = 5268;
const BASE_URL = process.env.BOREAL_URL || `http://127.0.0.1:${PORT}`;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const CDP_PORT = 9379;
const WORK_ROOT = resolve(__dirname, '../../../work-t0249');
const PROFILE = resolve(WORK_ROOT, 'edge-pop-embodiment-audit-profile');
const LOCK_NAME = 'agy: T-0249-population-density-embodiment-perception-audit';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function decodePng(file) {
  const buf = readFileSync(file);
  let o = 8, w = 0, h = 0, color = 0;
  const idat = [];
  while (o < buf.length) {
    const len = buf.readUInt32BE(o); o += 4;
    const type = buf.subarray(o, o + 4).toString('ascii'); o += 4;
    const data = buf.subarray(o, o + len); o += len + 4;
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); color = data[9]; }
    else if (type === 'IDAT') idat.push(Buffer.from(data));
    else if (type === 'IEND') break;
  }
  const bpp = color === 6 ? 4 : 3, stride = w * bpp, raw = inflateSync(Buffer.concat(idat));
  const rgb = new Uint8Array(w * h * 3);
  const prior = new Uint8Array(stride), row = new Uint8Array(stride);
  let p = 0;
  for (let y = 0; y < h; y++) {
    const filter = raw[p++];
    for (let i = 0; i < stride; i++) {
      const x = raw[p++], a = i >= bpp ? row[i - bpp] : 0, b = prior[i], c = i >= bpp ? prior[i - bpp] : 0;
      let v = x;
      if (filter === 1) v = (x + a) & 255;
      else if (filter === 2) v = (x + b) & 255;
      else if (filter === 3) v = (x + Math.floor((a + b) / 2)) & 255;
      else if (filter === 4) {
        const pr = a + b - c, pa = Math.abs(pr - a), pb = Math.abs(pr - b), pc = Math.abs(pr - c);
        v = (x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
      }
      row[i] = v;
    }
    prior.set(row);
    for (let x = 0; x < w; x++) {
      const s = (y * w + x) * 3, i = x * bpp;
      rgb[s] = row[i]; rgb[s + 1] = row[i + 1]; rgb[s + 2] = row[i + 2];
    }
  }
  return { w, h, rgb };
}

function boxStats(png, xa, xb, ya, yb) {
  const { w, h, rgb } = png;
  const x0 = Math.floor(w * xa), x1 = Math.floor(w * xb);
  const y0 = Math.floor(h * ya), y1 = Math.floor(h * yb);
  let n = 0, rSum = 0, gSum = 0, bSum = 0, oliveDom = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * w + x) * 3;
      const R = rgb[i], G = rgb[i + 1], B = rgb[i + 2];
      n++;
      rSum += R; gSum += G; bSum += B;
      if (G > 45 && R > 35 && G > B + 12) oliveDom++;
    }
  }
  return {
    n,
    meanRgb: [+(rSum / n).toFixed(2), +(gSum / n).toFixed(2), +(bSum / n).toFixed(2)],
    meanLumaSrgb: +((0.2126 * rSum + 0.7152 * gSum + 0.0722 * bSum) / (255 * n)).toFixed(4),
    oliveStainFrac: +(oliveDom / n).toFixed(4),
  };
}

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
        await srv.transformRequest('/src/core/coarse.ts');
        await srv.transformRequest('/src/render/animalDensity.ts');
        await srv.transformRequest('/src/render/animalPicture.ts');
        await srv.transformRequest('/src/core/enterLiving.ts');
        await srv.transformRequest('/src/core/lifespan.ts');
        await srv.transformRequest('/src/core/sensePictures.ts');
      `;
      viteProc = spawn(process.execPath, ['--input-type=module', '-e', viteBoot], {
        stdio: 'ignore',
        cwd: resolve(__dirname, '../../..'),
      });
      if (viteProc.pid) track(viteProc.pid);
      let up = false;
      for (let i = 0; i < 60; i++) {
        try {
          const r = await fetch(`${BASE_URL}/src/core/coarse.ts`);
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
        try { if (!sessionStorage.getItem('__kept')) { localStorage.clear(); sessionStorage.setItem('__kept', '1'); } } catch {}
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
      for (let i = 0; i < 120; i++) {
        await sleep(500);
        await send('Page.bringToFront').catch(() => {});
        ready = await evalJs(`Boolean(
          document.readyState === 'complete' &&
          !document.getElementById('loading') &&
          window.__boreal &&
          typeof window.borealPlace === 'function' &&
          typeof window.borealDensity === 'function' &&
          typeof window.borealPicture === 'function'
        )`);
        if (ready) break;
      }
      if (!ready) throw new Error(`Game did not finish booting: ${JSON.stringify(pageErrors)}`);
    };

    const observations = [];

    await send('Page.navigate', {
      url: `${BASE_URL}/?nomenu=1&noprobe=1&view=ground&stages=1&trees=v2&date=2026-08-15&hour=12.0&rec=1`,
    });
    await waitBoot();

    await evalJs(`(async () => {
      const findMod = (sub) => performance.getEntriesByType('resource').map((r) => r.name).find((n) => n.includes(sub)) || sub;
      const qualMod = await import(findMod('/src/core/quality.ts'));
      qualMod.GOVERNOR.auto = false;
      qualMod.GOVERNOR.tier = 1;
      qualMod.GOVERNOR.capTier = 0;
      qualMod.GOVERNOR.probeCap = 0;
      qualMod.GOVERNOR.worldTier = -1;
    })()`);
    await sleep(1400);

    // Start 20 fps WebM recorder
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
    await sleep(500);

    // =========================================================================
    // STAGE 0 (frame-0.png): Daylight 2,000x Ecological scale on sloped boreal lakeshore
    // Shows: (1) wild hares/deer/landingCast fox stay 100% solid frozen statues on top of
    // 16.5m density pancakes (m.body=0 ignored by picture.sync), AND (2) flat CircleGeometry
    // density discs float in mid-air off the sloped bank / water!
    // =========================================================================
    const stage0 = await evalJs(`(async () => {
      const findMod = (sub) => performance.getEntriesByType('resource').map((r) => r.name).find((n) => n.includes(sub)) || sub;
      const worldMod = await import(findMod('/src/core/world.ts'));
      const todMod = await import(findMod('/src/core/timeOfDay.ts'));
      const wcMod = await import(findMod('/src/core/worldClock.ts'));
      const landMod = await import(findMod('/src/world/globe/landingSite.ts'));
      const planetMod = await import(findMod('/src/world/globe/planet.ts'));

      // Anchor on North American boreal Kenora (49.77 N, -94.36 W) so landingCast also populates NA boreal wildlife
      const dir = planetMod.fromLatLon(49.77 * Math.PI / 180, -94.36 * Math.PI / 180);
      landMod.engageLanding(dir, 0);

      // Stand on sloped dry bank near (32, 6) looking toward closest hare / shoreline
      const hares = window.__boreal.hares();
      const p = window.__boreal.player();
      let target = hares[0] || { x: p.x, z: p.z - 14 };
      // Pick closest hare within 8..22 m
      let bestD = 999;
      for (const h of hares) {
        const d = Math.hypot(h.x - p.x, h.z - p.z);
        if (d > 5 && d < bestD) { bestD = d; target = h; }
      }
      // Step 10m back from target so hare + density pancake + slope fill center frame
      const ang = Math.atan2(target.x - p.x, target.z - p.z);
      const standX = target.x - Math.sin(ang) * 10.5;
      const standZ = target.z - Math.cos(ang) * 10.5;
      const yaw = Math.atan2(-(target.x - standX), -(target.z - standZ));
      window.borealPlace(standX, standZ, yaw, -0.18);

      // Set clock rate to 2,000x (Ecological scale: m.body = 0, m.ink = 1, m.kind = 'density')
      // Hold clock immediately after setting rate so sun stays at 12:00 noon while observation().scale === 'ecological'
      wcMod.setClockRate(2000);
      todMod.setDay(227, wcMod.worldSec());
      todMod.setHour(12.0, wcMod.worldSec());
      window.borealHold(true);
      return { standX: +standX.toFixed(2), standZ: +standZ.toFixed(2), yaw: +yaw.toFixed(4), target };
    })()`);
    await sleep(1600);
    const stage0Telem = await evalJs(`(() => {
      const dens = window.borealDensity();
      const pic = window.borealPicture();
      return {
        statusText: document.getElementById('status')?.innerText || '',
        densityReport: {
          scale: dens.scale,
          census: dens.census,
          animalMarksCount: dens.animals.length,
          sampleMarks: dens.animals.slice(0, 6),
        },
        pictureReport: pic,
      };
    })()`);
    await snapPng('frame-0.png');
    const png0 = decodePng(resolve(__dirname, 'frame-0.png'));
    observations.push({
      frame: 0,
      label: 'ecological_2000x_unfolded_statues_on_floating_density_pancakes',
      ...stage0,
      ...stage0Telem,
      midgroundStats: boxStats(png0, 0.15, 0.85, 0.42, 0.92),
    });

    // =========================================================================
    // STAGE 1 (frame-1.png): Astronomical New Moon Midnight (2026-01-15, DOY 18, 00:10, -19 C, 34.4 cm snow)
    // at 10^9x Evolutionary scale -> 110 m diameter ('range', r = 55 m) unlit radioactive olive UFO pancake
    // glowing across 0.001 lx pitch-black snowpack and cantilevering over lake/slopes!
    // =========================================================================
    const stage1 = await evalJs(`(async () => {
      const findMod = (sub) => performance.getEntriesByType('resource').map((r) => r.name).find((n) => n.includes(sub)) || sub;
      const todMod = await import(findMod('/src/core/timeOfDay.ts'));
      const wcMod = await import(findMod('/src/core/worldClock.ts'));
      const landMod = await import(findMod('/src/world/globe/landingSite.ts'));
      const weatherMod = await import(findMod('/src/core/weather.ts'));
      // Return to home Kenora lakeshore so staged lake + 34.4 cm January snowpack + slope are in frame
      landMod.clearLanding?.();
      window.borealHold(false);
      wcMod.setClockRate(1e9); // Evolutionary scale: m.kind === 'range', radius = 55.0 m (110 m diameter!)
      todMod.DAY.year = 2026;
      // 2026-01-18 is New Moon (moonAge ~ 0.0 d), sunElevation < -60 deg at 00:10!
      todMod.setDay(18, wcMod.worldSec());
      todMod.setHour(0.16, wcMod.worldSec());
      // Let 1 frame advance weather aggregateShare so January snowpack (34.4 cm) settles, then hold clock at 00:10!
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      todMod.setDay(18, wcMod.worldSec());
      todMod.setHour(0.16, wcMod.worldSec());
      window.borealHold(true);

      // Stand at (34, 8) facing across the sloped bank & home lake + hares
      window.borealPlace(34, 8, 0.55, -0.16);
      const sun = todMod.sunPosition(todMod.hourAt(wcMod.worldSec()), todMod.dayAt(wcMod.worldSec()));
      const w = weatherMod.weatherAt(34, 8);
      return {
        sunElevationDeg: +sun.elevation.toFixed(3),
        dayOfYear: todMod.dayAt(wcMod.worldSec()),
        hour: +todMod.hourAt(wcMod.worldSec()).toFixed(3),
        airTempC: +w.tC.toFixed(2),
        snowDepthCm: +(w.snowMm / 2.5).toFixed(2),
      };
    })()`);
    await sleep(1200);
    const stage1Telem = await evalJs(`(() => {
      const dens = window.borealDensity();
      const pic = window.borealPicture();
      return {
        statusText: document.getElementById('status')?.innerText || '',
        scale: dens.scale,
        census: dens.census,
        rangeMarks: dens.animals.filter((a) => a.kind === 'range').length,
        pictureReport: pic,
      };
    })()`);
    await snapPng('frame-1.png');
    const png1 = decodePng(resolve(__dirname, 'frame-1.png'));
    observations.push({
      frame: 1,
      label: 'midnight_new_moon_evolutionary_110m_unlit_glowing_range_pancake_over_snow_and_lake',
      ...stage1,
      ...stage1Telem,
      nightSkyBox: boxStats(png1, 0.15, 0.85, 0.05, 0.28),
      glowingPancakeBox: boxStats(png1, 0.15, 0.85, 0.48, 0.92),
    });

    // =========================================================================
    // STAGE 2 (frame-2.png): LIVING_PACK Embodiment (Snowshoe Hare at (50, 0), h = -0.317m < -0.25m water)
    // + 12x Lifespan Clock Desync (10 Julian years of worldSec -> 121.0 yr old immortal hare vs 5 yr max!)
    // + Pause Menu 'Play as' panel ('Grizzly bear (not in the living store)' & lifespanWarning banner)
    // =========================================================================
    const stage2 = await evalJs(`(async () => {
      const findMod = (sub) => performance.getEntriesByType('resource').map((r) => r.name).find((n) => n.includes(sub)) || sub;
      const todMod = await import(findMod('/src/core/timeOfDay.ts'));
      const wcMod = await import(findMod('/src/core/worldClock.ts'));
      const worldMod = await import(findMod('/src/core/world.ts'));
      const tuneMod = await import(findMod('/src/core/tuning.ts'));
      const lifeMod = await import(findMod('/src/core/lifespan.ts'));
      const enterMod = await import(findMod('/src/core/enterLiving.ts'));

      window.borealHold(false);
      wcMod.setClockRate(1);
      todMod.setDay(200, wcMod.worldSec());
      todMod.setHour(11.0, wcMod.worldSec());
      window.borealHold(true);

      // Set born timestamp 10 Julian years (10 * 31,557,600 = 315,576,000 worldSec) earlier:
      // epochOffsetYr advances +10.00 yr, coarseStep advances +10.00 yr, yet ageYears advances +120.00 yr -> 121.0 yr hare!
      const tenJulianYearsSec = 10 * 31557600;
      const wNow = wcMod.worldSec();
      localStorage.setItem('boreal.player.born', String(wNow - tenJulianYearsSec));

      // Open Pause Menu -> click 'Player' tab -> select 'hare' -> close to applyPending() (teleports to (50, 0)!) -> reopen Pause Menu + Player tab so warning + Play as + underwater (50,0) scene are visible!
      document.getElementById('pause')?.click();
      await new Promise((r) => setTimeout(r, 150));
      const tabs = Array.from(document.querySelectorAll('button, [role="tab"]'));
      const playerTab = tabs.find((b) => b.textContent?.trim() === 'Player');
      playerTab?.click();
      await new Promise((r) => setTimeout(r, 120));
      const hareRadio = document.querySelector('input[name="playable"][value="hare"]');
      if (hareRadio) { hareRadio.click(); hareRadio.dispatchEvent(new Event('change', { bubbles: true })); }
      await new Promise((r) => setTimeout(r, 120));
      // Resume for 400 ms so applyPending() swaps body to Snowshoe Hare at LIVING_PACK (50, 0) without dropStand!
      document.getElementById('pause')?.click();
      window.borealHold(false);
      await new Promise((r) => setTimeout(r, 450));
      const pAfterSwap = window.__boreal.player();
      const hAtHare = worldMod.heightAt(pAfterSwap.x, pAfterSwap.z);
      // Reopen pause menu & Player panel to show lifespanWarning + Grizzly bear disabled note
      document.getElementById('pause')?.click();
      await new Promise((r) => setTimeout(r, 180));
      const tabs2 = Array.from(document.querySelectorAll('button, [role="tab"]'));
      tabs2.find((b) => b.textContent?.trim() === 'Player')?.click();
      await new Promise((r) => setTimeout(r, 150));

      const roster = enterMod.livingRoster();
      const computedHareAge = lifeMod.ageYears('hare', wNow - tenJulianYearsSec, wcMod.worldSec());
      const menuText = document.getElementById('start-menu')?.innerText || document.querySelector('.menu-overlay, dialog, aside')?.innerText || document.body.innerText;
      return {
        playerAfterSwap: pAfterSwap,
        hareSpawnHeightM: +hAtHare.toFixed(4),
        waterSurfaceLevelM: tuneMod.LEVEL.waterSurface,
        belowWaterSurfaceM: +(tuneMod.LEVEL.waterSurface - hAtHare).toFixed(4),
        computedHareAgeYears: +computedHareAge.toFixed(2),
        hareMaxLifespanYears: lifeMod.LIFESPAN.hare.maxYears,
        rosterRecords: roster,
        menuWarningSnippet: menuText.slice(0, 600),
      };
    })()`);
    await sleep(500);
    await snapPng('frame-2.png');
    observations.push({
      frame: 2,
      label: 'living_pack_hare_below_water_and_121yr_immortal_12x_lifespan_warning',
      ...stage2,
    });

    // =========================================================================
    // STAGE 3 (frame-3.png): Live Embodied Wolf + Data (U) Diagnostic Panel ('NOT IN RUST perceptionBuffer.ts')
    // + #senses 8-slot sound-cap starvation of visual sight bubbles!
    // =========================================================================
    const stage3 = await evalJs(`(async () => {
      const findMod = (sub) => performance.getEntriesByType('resource').map((r) => r.name).find((n) => n.includes(sub)) || sub;
      const wcMod = await import(findMod('/src/core/worldClock.ts'));
      const todMod = await import(findMod('/src/core/timeOfDay.ts'));
      const spMod = await import(findMod('/src/core/sensePictures.ts'));
      const pbMod = await import(findMod('/src/core/perceptionBuffer.ts'));

      // Switch back to wolf & close pause menu
      const wolfRadio = document.querySelector('input[name="playable"][value="wolf"]');
      if (wolfRadio) { wolfRadio.click(); wolfRadio.dispatchEvent(new Event('change', { bubbles: true })); }
      await new Promise((r) => setTimeout(r, 100));
      document.getElementById('pause')?.click();
      window.borealHold(false);
      wcMod.setClockRate(1);
      todMod.setDay(227, wcMod.worldSec());
      todMod.setHour(10.5, wcMod.worldSec());
      await new Promise((r) => setTimeout(r, 450));

      // Place wolf facing closest hare at 7 m so lastSeen has a direct visual sight hit!
      const hares = window.__boreal.hares();
      const h0 = hares[0] || { x: 30, z: -8 };
      const wx = h0.x, wz = h0.z + 7.0;
      window.borealPlace(wx, wz, 0, -0.10);
      await new Promise((r) => setTimeout(r, 350));

      // Open Data (U) panel and scroll its body to 'Not in Rust' section showing perceptionBuffer.ts
      window.borealData?.open();
      await new Promise((r) => setTimeout(r, 650));
      const panel = document.getElementById('data-panel');
      if (panel) {
        const heads = Array.from(panel.querySelectorAll('h3'));
        const nir = heads.find((h) => h.textContent?.includes('Not in Rust'));
        if (nir) nir.scrollIntoView({ block: 'start' });
      }
      await new Promise((r) => setTimeout(r, 250));

      // Also verify createSenseStream() 8-slot cap starvation directly in browser runtime:
      const testStream = spMod.createSenseStream();
      for (let i = 0; i < 6; i++) testStream.offer({ key: 'hearing:' + i, kind: 'sound', strength: 0.5, bearing: 0.1 * i });
      for (let i = 0; i < 3; i++) testStream.offer({ key: 'scent:' + i, kind: 'scent', strength: 0.4, bearing: -0.2 * i });
      const sightAccepted = testStream.offer({ key: 'sight:0', kind: 'sight', strength: 0.95, bearing: 0 });

      const senseBubblesDom = Array.from(document.querySelectorAll('.sense-bubble')).map((el) => el.className);
      return {
        playerWolfResetToStore: window.__boreal.player(),
        sensePicturesCap: spMod.SENSE_PICTURES.cap,
        perceptionTotalFixedPlusSenseCaps: pbMod.PERCEPTION.caps.visible + pbMod.PERCEPTION.caps.scent + pbMod.PERCEPTION.caps.sound,
        sightAcceptedWhenSoundAndScentFill8: sightAccepted,
        liveSenseBubblesDom: senseBubblesDom,
        dataPanelNotInRustSnippet: (panel?.innerText || '').split('Not in Rust')[1]?.slice(0, 520) || '',
      };
    })()`);
    await sleep(400);
    await snapPng('frame-3.png');
    observations.push({
      frame: 3,
      label: 'disconnected_issue106_perception_buffer_in_data_panel_and_sense_stream_sight_starvation',
      ...stage3,
    });

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
    writeFileSync(resolve(__dirname, 'observations.json'), JSON.stringify(out, null, 2) + '\n', 'utf8');
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
