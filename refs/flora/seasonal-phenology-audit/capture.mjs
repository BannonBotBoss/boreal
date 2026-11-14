/**
 * Live browser screen recording + decoded video frame sampler + runtime telemetry for T-0226
 * (seasonal flora phenology rollover, midwinter snow burial & deciduous leaf-off, and Southern Hemisphere phase).
 * Uses agy preview port 5256 and tools/bench-lock.mjs, killing Vite and headless Edge cleanly on exit.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquire, track, release } from '../../../tools/bench-lock.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
mkdirSync(__dirname, { recursive: true });

const PORT = 5256;
const BASE_URL = process.env.BOREAL_URL || `http://127.0.0.1:${PORT}`;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const CDP_PORT = 9367;
const WORK_ROOT = resolve(__dirname, '../../../work');
const PROFILE = resolve(WORK_ROOT, 'edge-flora-phenology-audit-profile');
const LOCK_NAME = 'agy: T-0226-flora-phenology-audit';

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
        await srv.transformRequest('/src/render/flora/flora.ts');
        await srv.transformRequest('/src/core/treeSpecies.ts');
      `;
      viteProc = spawn(process.execPath, ['--input-type=module', '-e', viteBoot], {
        stdio: 'ignore',
        cwd: resolve(__dirname, '../../..'),
      });
      if (viteProc.pid) track(viteProc.pid);
      let up = false;
      for (let i = 0; i < 60; i++) {
        try {
          const r = await fetch(`${BASE_URL}/src/core/treeSpecies.ts`);
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

    const url = `${BASE_URL}/?nomenu&noprobe&view=ground&stages=1&rec&day=227&hour=13`;
    await send('Page.navigate', { url });
    let ready = false;
    for (let i = 0; i < 80; i++) {
      await sleep(500);
      ready = await evalJs(`Boolean(document.readyState === 'complete' && !document.getElementById('loading') && document.getElementById('status'))`);
      if (ready) break;
    }
    if (!ready) throw new Error(`Game did not finish loading: ${JSON.stringify(pageErrors)}`);
    await sleep(2000);

    // Import modules and locate a boreal forest stand with deciduous birch/aspen AND understory flora!
    const spot = await evalJs(`(async () => {
      const findMod = (sub) => {
        const entries = performance.getEntriesByType('resource').map((r) => r.name);
        return entries.find((n) => n.includes(sub)) || sub;
      };
      window.__tod = await import(findMod('/src/core/timeOfDay.ts'));
      window.__wc = await import(findMod('/src/core/worldClock.ts'));
      window.__sp = await import(findMod('/src/core/sitePhase.ts'));
      window.__cs = await import(findMod('/src/world/globe/coverSample.ts'));
      window.__wd = await import(findMod('/src/core/world.ts'));
      window.__pop = await import(findMod('/src/core/population.ts'));
      window.__tr = await import(findMod('/src/render/trees.ts'));
      window.__ts = await import(findMod('/src/core/treeSpecies.ts'));
      window.__we = await import(findMod('/src/core/weather.ts'));
      window.__pw = await import(findMod('/src/core/planetWeather.ts'));
      window.__fl = await import(findMod('/src/render/flora/flora.ts'));
      window.__gr = await import(findMod('/src/render/grass/grass.ts'));
      window.__fi = await import(findMod('/src/core/fields.ts'));

      // Scan around (-1190, -980) boreal stand for a birch/aspen cluster with dry forest floor
      let best = { x: -1188, z: -985, yaw: 0.4, decid: [] };
      for (let cx = -31; cx <= -28; cx++) {
        for (let cz = -26; cz <= -23; cz++) {
          const ents = window.__pop.applyPopulation(window.__wd.generateChunk(cx, cz), cx, cz);
          const decid = ents
            .filter((e) => e.kind === 'spruce')
            .map((e) => ({ e, d: window.__tr.treeDims(e.seed, e.x, e.z) }))
            .filter((t) => ['paper-birch', 'trembling-aspen', 'balsam-poplar'].includes(t.d.species) && window.__wd.heightAt(t.e.x, t.e.z) > 1.5);
          if (decid.length > best.decid.length) {
            const target = decid[0].e;
            const px = target.x, pz = target.z + 11;
            if (window.__wd.heightAt(px, pz) > 1.2) {
              best = { x: px, z: pz, yaw: 0, decid: decid.slice(0, 4).map((t) => ({ sp: t.d.species, x: +t.e.x.toFixed(1), z: +t.e.z.toFixed(1) })) };
            }
          }
        }
      }
      return best;
    })()`);

    // Move to the boreal birch/aspen + understory flora stand and let chunks & flora tiles build before recording
    await evalJs(`(async () => {
      window.__sp.clearSite();
      const sec = window.__wc.worldSec();
      window.__tod.setDay(227, sec);
      window.__tod.setHour(13.0, sec);
      window.borealPlace?.(${spot.x}, ${spot.z}, ${spot.yaw}, -0.04);
      await window.__pw.openForestPlanet(227, 13.0);
      return true;
    })()`);
    for (let i = 0; i < 40; i++) {
      await sleep(250);
      const built = await evalJs(`(globalThis.borealFlora?.info?.visible ?? 0) > 800`);
      if (built) break;
    }
    await sleep(800);

    // Start MediaRecorder on the WebGL canvas (15 fps)
    await evalJs(`(() => {
      const canvas = document.querySelector('canvas');
      const stream = canvas.captureStream(15);
      const chunks = [];
      const rec = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' });
      rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
      window.__recChunks = chunks;
      window.__recStartMs = performance.now();
      window.__rec = rec;
      rec.start(100);
      return true;
    })()`);

    const observations = [];
    const sampleState = async (label) => {
      return await evalJs(`(() => {
        const sec = window.__wc.worldSec();
        const doy = window.__tod.dayAt(sec);
        const hr = window.__tod.hourAt(sec);
        const lat = window.__sp.siteLatitude(window.__tod.LATITUDE);
        const sun = window.__tod.sunPosition(hr, doy, lat);
        const w = window.__we.weatherAt(${spot.x}, ${spot.z});
        const clim = window.__we.cellClimate(doy, hr, 0, ${spot.x}, ${spot.z});
        const ph = window.__ts.phenology(window.__we.WEATHER.day);
        const floraInfo = globalThis.borealFlora?.info ?? {};
        const daySec = 24 * window.__tod.REAL_SECONDS_PER_GAME_HOUR;
        const sunSec1d = window.__fi.sunSeconds(sec, sec + daySec);
        return {
          label: ${JSON.stringify(label)},
          videoOffsetSec: +((performance.now() - window.__recStartMs) / 1000).toFixed(3),
          doy,
          weatherDay: window.__we.WEATHER.day,
          hour: +hr.toFixed(3),
          latDeg: +lat.toFixed(3),
          sunElevationDeg: +sun.elevation.toFixed(2),
          airTempC: +w.tC.toFixed(2),
          climateTargetTempC: +clim.tC.toFixed(2),
          climateSource: clim.source,
          sweMm: +(w.swe ?? 0).toFixed(2),
          snowDepthM: +(window.__we.snowDepthCm(w.swe ?? 0) / 100).toFixed(4),
          treePhenology: ph,
          windUniformColour: +window.__tr.WIND_UNIFORMS.uColour.value.toFixed(4),
          windUniformHasOff: 'uOff' in window.__tr.WIND_UNIFORMS,
          floraInfo: {
            visible: floraInfo.visible ?? 0,
            clumpsVisible: floraInfo.clumpsVisible ?? 0,
            bySpecies: floraInfo.bySpecies ?? {},
          },
          fieldsDaylightFraction: +window.__fi.daylightFraction(doy).toFixed(4),
          fieldsSunWeightedSecondsNext24h: +sunSec1d.toFixed(2),
          spot: ${JSON.stringify(spot)},
        };
      })()`);
    };

    // Scene 0 (0.0 - 1.5 s): Year 1 Mid-August (day = 227, 13:00, 49.5 N) — baseline green birch/aspen & blooming fireweed
    await sleep(900);
    observations.push(await sampleState('scene0_year1_aug15_day227_49_5N'));
    await sleep(600);

    // Scene 1 (1.5 - 3.2 s): Year 2 Mid-August rollover (day = 592 = 227 + 365, 13:00, 49.5 N)
    await evalJs(`(() => {
      const sec = window.__wc.worldSec();
      window.__tod.setDay(592, sec);
      window.__tod.setHour(13.0, sec);
      window.borealPlace?.(${spot.x}, ${spot.z}, ${spot.yaw}, -0.04);
      return true;
    })()`);
    await sleep(900);
    observations.push(await sampleState('scene1_year2_aug15_rollover_day592_49_5N'));
    await sleep(600);

    // Scene 2 (3.2 - 5.0 s): Midwinter January snowpack (day = 15, 13:00, 49.5 N) — pitch down slightly (-0.18) to show snow + green understory flora!
    await evalJs(`(async () => {
      const sec = window.__wc.worldSec();
      window.__tod.setDay(15, sec);
      window.__tod.setHour(13.0, sec);
      await window.__pw.openForestPlanet(15, 13.0);
      window.__we.initWeather(15, 13.0, ${spot.x}, ${spot.z});
      window.borealPlace?.(${spot.x}, ${spot.z}, ${spot.yaw}, -0.16);
      return true;
    })()`);
    await sleep(1100);
    observations.push(await sampleState('scene2_midwinter_jan15_day15_49_5N'));
    await sleep(600);

    // Scene 3 (5.0 - 6.8 s): Southern Hemisphere austral midsummer (-45.0 S, -71.5 W, day = 15 Jan 15, 13:00)
    await evalJs(`(async () => {
      const lat = -45.0, lon = -71.5, rad = Math.PI / 180;
      const clat = Math.cos(lat * rad), slat = Math.sin(lat * rad), clon = Math.cos(lon * rad), slon = Math.sin(lon * rad);
      window.__sp.setSite({
        latDeg: lat, lonDeg: lon, datumM: 220, salt: 0, treeShare: 0.85, coastM: 120000,
        dir: [clat * clon, slat, clat * slon],
        east: [-slon, 0, clon],
        north: [-slat * clon, clat, -slat * slon],
      });
      const sec = window.__wc.worldSec();
      window.__tod.setDay(15, sec);
      window.__tod.setHour(13.0, sec);
      await window.__pw.openForestPlanet(15, 13.0);
      window.__we.initWeather(15, 13.0, ${spot.x}, ${spot.z});
      window.borealPlace?.(${spot.x}, ${spot.z}, ${spot.yaw}, -0.04);
      return true;
    })()`);
    await sleep(1100);
    observations.push(await sampleState('scene3_austral_midsummer_jan15_day15_45S'));
    await sleep(600);

    // Stop MediaRecorder, save recording.webm, AND decode exact PNG frames from the recorded video blob!
    const decoded = await evalJs(`(async () => {
      const rec = window.__rec;
      if (rec && rec.state !== 'inactive') {
        await new Promise((r) => { rec.onstop = r; rec.stop(); });
      }
      const blob = new Blob(window.__recChunks, { type: 'video/webm' });
      const buf = await blob.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let bin = '';
      for (let i = 0; i < bytes.length; i += 0x8000) {
        bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      }
      const webmB64 = btoa(bin);

      // Decode frames directly from the recorded video at each scene's videoOffsetSec
      const url = URL.createObjectURL(blob);
      const vid = document.createElement('video');
      vid.muted = true;
      vid.playsInline = true;
      vid.src = url;
      await new Promise((r, j) => { vid.onloadedmetadata = r; vid.onerror = j; });
      // Force duration discovery on WebM MediaRecorder blobs
      vid.currentTime = 1e6;
      await new Promise((r) => { vid.onseeked = r; });
      const duration = vid.duration;

      const c = document.createElement('canvas');
      c.width = vid.videoWidth || 1280;
      c.height = vid.videoHeight || 720;
      const ctx = c.getContext('2d');
      const times = ${JSON.stringify([])};
      return { webmB64, duration, width: c.width, height: c.height };
    })()`);

    writeFileSync(resolve(__dirname, 'recording.webm'), Buffer.from(decoded.webmB64, 'base64'));

    // Now seek and decode exact frames at each observation's videoOffsetSec
    const frameTimes = observations.map((o) => Math.min(Math.max(0.1, o.videoOffsetSec), Math.max(0.1, decoded.duration - 0.1)));
    const framesB64 = await evalJs(`(async () => {
      const blob = new Blob(window.__recChunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const vid = document.createElement('video');
      vid.muted = true;
      vid.playsInline = true;
      vid.src = url;
      await new Promise((r, j) => { vid.onloadedmetadata = r; vid.onerror = j; });
      vid.currentTime = 1e6;
      await new Promise((r) => { vid.onseeked = r; });
      const c = document.createElement('canvas');
      c.width = vid.videoWidth || 1280;
      c.height = vid.videoHeight || 720;
      const ctx = c.getContext('2d');
      const out = [];
      for (const t of ${JSON.stringify(frameTimes)}) {
        vid.currentTime = Math.min(t, Math.max(0, vid.duration - 0.05));
        await new Promise((r) => { vid.onseeked = r; });
        ctx.drawImage(vid, 0, 0, c.width, c.height);
        out.push({ requestedSec: t, decodedCurrentTimeSec: +vid.currentTime.toFixed(3), pngB64: c.toDataURL('image/png').split(',')[1] });
      }
      URL.revokeObjectURL(url);
      return out;
    })()`);

    framesB64.forEach((f, idx) => {
      writeFileSync(resolve(__dirname, `frame-${idx}.png`), Buffer.from(f.pngB64, 'base64'));
      observations[idx].decodedFrame = {
        file: `frame-${idx}.png`,
        requestedSec: f.requestedSec,
        decodedCurrentTimeSec: f.decodedCurrentTimeSec,
      };
    });

    const meta = {
      capturedAt: new Date().toISOString(),
      sourceBranch: 'agy/t0226-propose',
      baseCommit: 'd06aa4b',
      viewport: { width: decoded.width, height: decoded.height },
      videoDurationSec: +decoded.duration.toFixed(3),
      pageErrors,
      observations,
    };
    writeFileSync(resolve(__dirname, 'observations.json'), JSON.stringify(meta, null, 2) + '\n', 'utf8');
    console.log(JSON.stringify(meta, null, 2));

    ws.close();
  } finally {
    if (edge?.pid) {
      try { process.kill(edge.pid); } catch {}
    }
    if (viteProc?.pid) {
      try { process.kill(viteProc.pid); } catch {}
    }
    await release();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
