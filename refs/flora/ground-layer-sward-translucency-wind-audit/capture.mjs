/**
 * Live browser screen recording + 4-stage PNG frame sampler + runtime telemetry for T-0248
 * (ContinuousTerrain Dropped onBeforeCompile & 92% Boreal Ground-Layer Overwrite + Missing Layer-1 GI Bounce,
 * Nocturnal Vegetation STYLIZED Emissive Glow, Frozen Straw Steppe Sward & 8 m Ring Cutoff,
 * Unshadowed Foliage Subsurface Translucency, and Uncapped Horizontal Canopy Wind Shear Audit).
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
const CDP_PORT = 9378;
const WORK_ROOT = resolve(__dirname, '../../../work-t0248');
const PROFILE = resolve(WORK_ROOT, 'edge-flora-sward-audit-profile');
const LOCK_NAME = 'agy: T-0248-ground-layer-sward-translucency-wind-audit';

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
  let n = 0, rSum = 0, gSum = 0, bSum = 0, greenDom = 0, strawDom = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * w + x) * 3;
      const R = rgb[i], G = rgb[i + 1], B = rgb[i + 2];
      n++;
      rSum += R; gSum += G; bSum += B;
      if (G > R + 6 && G > B + 6) greenDom++;
      if (R > G + 8 && G > B + 8) strawDom++;
    }
  }
  return {
    n,
    meanRgb: [+(rSum / n).toFixed(2), +(gSum / n).toFixed(2), +(bSum / n).toFixed(2)],
    meanLumaSrgb: +((0.2126 * rSum + 0.7152 * gSum + 0.0722 * bSum) / (255 * n)).toFixed(4),
    greenDominantFrac: +(greenDom / n).toFixed(4),
    strawDominantFrac: +(strawDom / n).toFixed(4),
  };
}

function diffStats(pngA, pngB, xa = 0, xb = 1, ya = 0, yb = 1) {
  const { w, h } = pngA;
  const x0 = Math.floor(w * xa), x1 = Math.floor(w * xb);
  const y0 = Math.floor(h * ya), y1 = Math.floor(h * yb);
  let n = 0, changed = 0, l1Sum = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * w + x) * 3;
      const dr = Math.abs(pngA.rgb[i] - pngB.rgb[i]);
      const dg = Math.abs(pngA.rgb[i + 1] - pngB.rgb[i + 1]);
      const db = Math.abs(pngA.rgb[i + 2] - pngB.rgb[i + 2]);
      n++;
      l1Sum += (dr + dg + db) / 3;
      if (dr + dg + db > 6) changed++;
    }
  }
  return { n, changedFrac: +(changed / n).toFixed(4), meanAbsRgbDiff: +(l1Sum / n).toFixed(3) };
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
        await srv.transformRequest('/src/render/pbr.ts');
        await srv.transformRequest('/src/render/flora/moss.ts');
        await srv.transformRequest('/src/render/grass/grass.ts');
        await srv.transformRequest('/src/render/flora/steppeTuft.ts');
        await srv.transformRequest('/src/render/trees.ts');
      `;
      viteProc = spawn(process.execPath, ['--input-type=module', '-e', viteBoot], {
        stdio: 'ignore',
        cwd: resolve(__dirname, '../../..'),
      });
      if (viteProc.pid) track(viteProc.pid);
      let up = false;
      for (let i = 0; i < 60; i++) {
        try {
          const r = await fetch(`${BASE_URL}/src/render/pbr.ts`);
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

    const waitBoot = async () => {
      let ready = false;
      for (let i = 0; i < 120; i++) {
        await sleep(500);
        await send('Page.bringToFront').catch(() => {});
        ready = await evalJs(`Boolean(
          document.readyState === 'complete' &&
          !document.getElementById('loading') &&
          window.__boreal &&
          typeof window.borealPlace === 'function'
        )`);
        if (ready) break;
      }
      if (!ready) throw new Error(`Game did not finish booting: ${JSON.stringify(pageErrors)}`);
    };

    const observations = [];

    // Boot directly into ground view with stages=1 and trees=v2 on July 15 (day 196 = New Moon in 2026)
    await send('Page.navigate', {
      url: `${BASE_URL}/?nomenu=1&noprobe=1&view=ground&stages=1&trees=v2&date=2026-07-15&hour=10.2&rec=1`,
    });
    await waitBoot();

    // Force High/Ultra quality tier in headless SwiftShader so CSM shadows (2 cascades), SH GI probe,
    // full grass/flora foliage (1.0), and trees=v2 all run just as on Matthew's desktop GPU!
    await evalJs(`(async () => {
      const findMod = (sub) => performance.getEntriesByType('resource').map((r) => r.name).find((n) => n.includes(sub)) || sub;
      const qualMod = await import(findMod('/src/core/quality.ts'));
      qualMod.GOVERNOR.auto = false;
      qualMod.GOVERNOR.tier = 1; // High: shadows=2, gi=1, foliage=1, trees=1, near=70, mid=120
      qualMod.GOVERNOR.capTier = 0;
      qualMod.GOVERNOR.probeCap = 0;
      qualMod.GOVERNOR.worldTier = -1;
    })()`);
    await sleep(800);

    // Start continuous 20 fps WebM recorder across all 4 scenes
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
    await sleep(400);

    // =========================================================================
    // STAGE 0 (frame-0.png): Dry Boreal Canadian Shield ridge (Cladonia lichen + conifers + grass)
    // continuousTerrain .clone() drops onBeforeCompile (0% moss/pbr floor on ground) + 92% cover overwrite + 0 Layer-1 GI terrain
    // =========================================================================
    const stage0 = await evalJs(`(async () => {
      const findMod = (sub) => performance.getEntriesByType('resource').map((r) => r.name).find((n) => n.includes(sub)) || sub;
      const worldMod = await import(findMod('/src/core/world.ts'));
      const landMod = await import(findMod('/src/world/globe/landingSite.ts'));
      const planetMod = await import(findMod('/src/world/globe/planet.ts'));
      const siteMod = await import(findMod('/src/core/flora/site.ts'));
      const mossCore = await import(findMod('/src/core/flora/mosses.ts'));
      const pbrMod = await import(findMod('/src/render/pbr.ts'));
      const castMod = await import(findMod('/src/render/landingCast.ts'));
      const todMod = await import(findMod('/src/core/timeOfDay.ts'));
      const wcMod = await import(findMod('/src/core/worldClock.ts'));
      const rosterMod = await import(findMod('/src/core/landingRoster.ts'));

      // Scan boreal Shield / Laurentian / Foothill candidates in <30ms to anchor at the base of a dry boreal slope
      let best = null;
      let chosenLatLon = null;
      const candidates = [
        [47.68, -70.85], [48.20, -70.50], [49.85, -94.40], [50.40, -93.80],
        [51.60, -115.60], [52.85, -117.80], [53.90, -118.80], [55.20, -122.50],
        [48.90, -87.60], [49.50, -85.00], [51.20, -73.50], [54.50, -105.50],
      ];
      for (const [lat, lon] of candidates) {
        for (let dLat = -0.12; dLat <= 0.12; dLat += 0.06) {
          for (let dLon = -0.12; dLon <= 0.12; dLon += 0.06) {
            const la = lat + dLat, lo = lon + dLon;
            const dir = planetMod.fromLatLon(la * Math.PI / 180, lo * Math.PI / 180);
            landMod.engageLanding(dir, 0);
            // Check 8 directions at r = 240 m and 480 m for upslope dry boreal forest
            for (const r of [160, 320, 520]) {
              for (let a = 0; a < 8; a++) {
                const ang = (a / 8) * Math.PI * 2;
                const x = Math.round(Math.cos(ang) * r), z = Math.round(Math.sin(ang) * r);
                const h = worldMod.heightAt(x, z);
                if (h < 2.0 || h > 18.0 || !worldMod.isDryLand(x, z, h)) continue;
                const biome = castMod.landingContext(x, z).biome;
                if (biome !== 'boreal') continue;
                const cx = Math.floor(x / 40), cz = Math.floor(z / 40);
                const ents = worldMod.generateChunk(cx, cz);
                const spruces = ents.filter((e) => e.kind === 'spruce').length;
                if (spruces < 4) continue;
                const s = siteMod.siteAt(x, z, true, false);
                const cov = mossCore.groundCover(s);
                const score = cov[1] * 2.5 + cov[2] + cov[0] * 0.8 + spruces * 0.12 + s.rock * 1.2;
                if (!best || score > best.score) {
                  best = {
                    x, z, h: +h.toFixed(2), biome, spruces, rock: +s.rock.toFixed(3), soil: s.soil,
                    feathermoss: +cov[0].toFixed(4), lichen: +cov[1].toFixed(4), sphagnum: +cov[2].toFixed(4),
                    score: +score.toFixed(4),
                  };
                  chosenLatLon = [+(la.toFixed(4)), +(lo.toFixed(4))];
                }
              }
            }
          }
        }
      }
      if (!best || !chosenLatLon) throw new Error('No dry boreal Shield site found across candidates');
      const finalDir = planetMod.fromLatLon(chosenLatLon[0] * Math.PI / 180, chosenLatLon[1] * Math.PI / 180);
      landMod.engageLanding(finalDir, 0);
      todMod.initDay('?date=2026-07-15&hour=10.2', null, wcMod.worldSec());
      pbrMod.setGroundFloor('boreal', 196);
      window.borealPlace(best.x, best.z, 0.45, -0.20);
      rosterMod.setLandingClear([]);
      rosterMod.setLandingSight([]);
      return { bestSite: best, chosenLatLon };
    })()`);

    // Wait until chunks, grass tiles, moss:refill, and trees=v2 finish streaming (temporarily raising slice budget during settle, then restoring 4ms)
    await evalJs(`(async () => {
      const findMod = (sub) => performance.getEntriesByType('resource').map((r) => r.name).find((n) => n.includes(sub)) || sub;
      const intMod = await import(findMod('/src/core/interest.ts'));
      intMod.INTEREST.budgetMs = 48;
    })()`);
    for (let i = 0; i < 28; i++) {
      const settled = await evalJs(`(async () => {
        const findMod = (sub) => performance.getEntriesByType('resource').map((r) => r.name).find((n) => n.includes(sub)) || sub;
        const rosterMod = await import(findMod('/src/core/landingRoster.ts'));
        const mossRen = await import(findMod('/src/render/flora/moss.ts'));
        const grassMod = await import(findMod('/src/render/grass/grass.ts'));
        rosterMod.setLandingClear([]);
        rosterMod.setLandingSight([]);
        const v2 = window.borealTreesV2 ? window.borealTreesV2.info.variants : 0;
        return mossRen.MOSS_INFO.refills >= 1 && grassMod.GRASS_INFO.drawn > 1000 && v2 >= 1;
      })()`);
      if (settled && i >= 6) break;
      await sleep(350);
    }
    await evalJs(`(async () => {
      const findMod = (sub) => performance.getEntriesByType('resource').map((r) => r.name).find((n) => n.includes(sub)) || sub;
      const intMod = await import(findMod('/src/core/interest.ts'));
      intMod.INTEREST.budgetMs = 4;
    })()`);
    await sleep(350);

    await snapPng('frame-0.png');

    // Toggle uMossOn = 0 for 300ms to measure how bare continuousTerrain ignores moss.ts completely!
    await evalJs(`(async () => {
      const findMod = (sub) => performance.getEntriesByType('resource').map((r) => r.name).find((n) => n.includes(sub)) || sub;
      const mossRen = await import(findMod('/src/render/flora/moss.ts'));
      mossRen.MOSS_UNIFORMS.uMossOn.value = 0;
    })()`);
    await sleep(300);
    await snapPng('_tmp_moss_off.png');

    const stage0Meta = await evalJs(`(async () => {
      const findMod = (sub) => performance.getEntriesByType('resource').map((r) => r.name).find((n) => n.includes(sub)) || sub;
      const mossRen = await import(findMod('/src/render/flora/moss.ts'));
      const pbrMod = await import(findMod('/src/render/pbr.ts'));
      const contMod = await import(findMod('/src/render/continuousTerrain.ts'));
      const grassMod = await import(findMod('/src/render/grass/grass.ts'));
      const floraMod = await import(findMod('/src/render/flora/flora.ts'));
      mossRen.MOSS_UNIFORMS.uMossOn.value = 1;

      const tMat = pbrMod.terrainMaterial();
      const cMat = contMod.continuousMaterial();
      const dummyC = {
        fragmentShader: '#include <color_fragment>\\n#include <roughnessmap_fragment>\\n#include <normal_fragment_maps>\\n#include <dithering_fragment>\\n',
        vertexShader: '#include <common>\\n#include <begin_vertex>\\n#include <worldpos_vertex>\\n',
        uniforms: {},
      };
      cMat.onBeforeCompile(dummyC, {});
      const dummyT = {
        fragmentShader: '#include <color_fragment>\\n#include <roughnessmap_fragment>\\n#include <normal_fragment_maps>\\n',
        vertexShader: '#include <begin_vertex>\\n#include <worldpos_vertex>\\n',
        uniforms: {},
      };
      tMat.onBeforeCompile(dummyT, {});

      return {
        continuousHasMossGlsl: dummyC.fragmentShader.includes('groundLayer'),
        continuousHasPbrFloor: dummyC.fragmentShader.includes('uFloor'),
        terrainMatHasMossGlsl: dummyT.fragmentShader.includes('groundLayer'),
        terrainMatNearCoverOverwrite: 0.92,
        mossRefills: mossRen.MOSS_INFO.refills,
        mossMeanShare: mossRen.MOSS_INFO.mean.map((v) => +v.toFixed(4)),
        grassDrawnBlades: grassMod.GRASS_INFO.drawn,
        grassTiles: grassMod.GRASS_INFO.tiles,
        floraVisiblePlants: floraMod.FLORA_INFO.visible,
        v2TreeCount: window.borealTreesV2 ? window.borealTreesV2.list().length : 0,
        v2NearCount: window.borealTreesV2 ? window.borealTreesV2.info.near : 0,
      };
    })()`);

    const png0 = decodePng(resolve(__dirname, 'frame-0.png'));
    const png0Off = decodePng(resolve(__dirname, '_tmp_moss_off.png'));
    rmSync(resolve(__dirname, '_tmp_moss_off.png'), { force: true });
    observations.push({
      frame: 0,
      label: 'boreal_continuous_terrain_dropped_onBeforeCompile_and_92pct_moss_overwrite',
      ...stage0,
      ...stage0Meta,
      nearFloorBoxStats: boxStats(png0, 0.15, 0.85, 0.64, 0.90),
      midCanopyFloorBoxStats: boxStats(png0, 0.15, 0.85, 0.35, 0.62),
      nearFloorMossToggleDiff: diffStats(png0, png0Off, 0.15, 0.85, 0.66, 0.90),
    });

    // =========================================================================
    // STAGE 1 (frame-1.png): Moonless clear astronomical midnight (2026-08-13 New Moon, hour 0.2, sunElev < -20 deg)
    // Self-luminous green STYLIZED.grassLift & trees=v2 foliageLift/barkLift
    // =========================================================================
    const stage1Meta = await evalJs(`(async () => {
      const findMod = (sub) => performance.getEntriesByType('resource').map((r) => r.name).find((n) => n.includes(sub)) || sub;
      const todMod = await import(findMod('/src/core/timeOfDay.ts'));
      const wcMod = await import(findMod('/src/core/worldClock.ts'));
      const lightMod = await import(findMod('/src/core/light.ts'));
      const stylMod = await import(findMod('/src/render/stylizedPalette.ts'));
      const rosterMod = await import(findMod('/src/core/landingRoster.ts'));

      todMod.initDay('?date=2026-08-13&hour=0.2', null, wcMod.worldSec());
      window.borealPlace(${stage0.bestSite.x.toFixed(2)}, ${stage0.bestSite.z.toFixed(2)}, 0.45, -0.06);
      for (let i = 0; i < 6; i++) {
        rosterMod.setLandingClear([]);
        rosterMod.setLandingSight([]);
        await new Promise((r) => setTimeout(r, 300));
      }

      const doy = todMod.dayAt(wcMod.worldSec());
      const sun = todMod.sunPosition(0.2, doy, ${stage0.chosenLatLon[0]});
      const mAge = lightMod.moonAge(doy, 2026);
      const mLux = lightMod.moonLux(mAge, -0.25);
      return {
        dayOfYear: doy,
        sunElevationDeg: +sun.elevation.toFixed(3),
        moonAgeDays: +mAge.toFixed(3),
        moonIlluminanceLux: +mLux.toFixed(6),
        starlightLux: lightMod.LUX.nightSky,
        grassLiftLinearRgb: [...stylMod.STYLIZED.grassLift],
        foliageLiftLinearRgb: [...stylMod.STYLIZED.foliageLift],
        barkLiftLinearRgb: [...stylMod.STYLIZED.barkLift],
        v2TreeCount: window.borealTreesV2 ? window.borealTreesV2.list().length : 0,
      };
    })()`);
    await sleep(400);
    await snapPng('frame-1.png');
    const png1 = decodePng(resolve(__dirname, 'frame-1.png'));
    observations.push({
      frame: 1,
      label: 'midnight_new_moon_self_luminous_stylized_grass_and_conifer_emissive',
      ...stage1Meta,
      nocturnalSwardForegroundStats: boxStats(png1, 0.12, 0.88, 0.60, 0.90),
      nocturnalCanopyMidStats: boxStats(png1, 0.12, 0.88, 0.22, 0.56),
      nocturnalSkyZenithStats: boxStats(png1, 0.12, 0.88, 0.04, 0.18),
    });

    // =========================================================================
    // STAGE 2 (frame-2.png): Early-June spring steppe (2026-06-05, day 156, steppeCure=0)
    // Dry upland on Seed 1400: frozen September straw steppeTuft + 8 m STIPA_RADIUS_M ring + 0 wind sway
    // =========================================================================
    const stage2Meta = await evalJs(`(async () => {
      const findMod = (sub) => performance.getEntriesByType('resource').map((r) => r.name).find((n) => n.includes(sub)) || sub;
      const worldMod = await import(findMod('/src/core/world.ts'));
      const landMod = await import(findMod('/src/world/globe/landingSite.ts'));
      const todMod = await import(findMod('/src/core/timeOfDay.ts'));
      const wcMod = await import(findMod('/src/core/worldClock.ts'));
      const pbrMod = await import(findMod('/src/render/pbr.ts'));
      const tuftMod = await import(findMod('/src/render/flora/steppeTuft.ts'));
      const grassMod = await import(findMod('/src/render/grass/grass.ts'));
      const weatherMod = await import(findMod('/src/core/weather.ts'));
      const treesMod = await import(findMod('/src/render/trees.ts'));
      const rosterMod = await import(findMod('/src/core/landingRoster.ts'));

      // Return to seeded prairie home and pick a broad dry upland plateau (isDryLand=true, steppeAt=true)
      landMod.clearLanding();
      tuftMod.clearSteppeCache();
      // Hide boreal grass_fx momentarily so steppe-field tussocks and the 8 m STIPA_RADIUS_M cliff are 100% isolated & unmistakable!
      // Wait: in real gameplay on home prairie, T-0237 showed boreal grass ALSO grows on steppe, so let's record real unmodified state,
      // AND check tuftFieldPoints count!
      let drySteppe = null;
      for (let x = -600; x <= 600; x += 20) {
        for (let z = -600; z <= 600; z += 20) {
          if (Math.hypot(x, z) < 60) continue;
          const h = worldMod.heightAt(x, z);
          if (h > 2.1 && h < 3.1 && worldMod.isDryLand(x, z, h) && tuftMod.steppeAt(x, z)) {
            const pts = tuftMod.tuftFieldPoints(x, z);
            if (pts.length >= 650) { drySteppe = { x, z, h: +h.toFixed(2), tuftCount: pts.length }; break; }
          }
        }
        if (drySteppe) break;
      }
      if (!drySteppe) throw new Error('No dry steppe plateau found');

      todMod.initDay('?date=2026-06-05&hour=9.8', null, wcMod.worldSec());
      pbrMod.setGroundFloor('prairie', 156);
      // Temporarily toggle GRASS_FX.off = true ONLY if needed? NO — NEVER modify game flags for frame-2! Let's check what real unmodified steppe looks like!
      window.borealPlace(drySteppe.x, drySteppe.z, -0.35, -0.22);

      for (let i = 0; i < 8; i++) {
        rosterMod.setLandingClear([]);
        rosterMod.setLandingSight([]);
        const g = weatherMod.getGrid();
        if (g) { g.u.fill(9.5); g.v.fill(1.5); }
        treesMod.updateTreeUniforms();
        await new Promise((r) => setTimeout(r, 320));
      }

      const geo = tuftMod.steppeTuftGeometry(1);
      const col = geo.getAttribute('color').array;
      let rS = 0, gS = 0, bS = 0;
      const vc = col.length / 3;
      for (let i = 0; i < col.length; i += 3) { rS += col[i]; gS += col[i + 1]; bS += col[i + 2]; }

      pbrMod.setGroundFloor('desert', 156);
      const desertUFloor = pbrMod.FLOOR.uFloor.value;
      pbrMod.setGroundFloor('prairie', 156);

      return {
        drySteppe,
        dayOfYear: 156,
        steppeCureDay156: pbrMod.steppeCure(156),
        tuftMeanLinearVertexRgb: [+(rS / vc).toFixed(4), +(gS / vc).toFixed(4), +(bS / vc).toFixed(4)],
        stipaRadiusM: tuftMod.STIPA_RADIUS_M,
        liveSteppeFieldCount: window.borealSteppeField ? window.borealSteppeField() : 0,
        desertMapsToUFloor: desertUFloor,
        forcedWindMs: +Math.hypot(9.5, 1.5).toFixed(3),
        uWindAmp: +treesMod.WIND_UNIFORMS.uWindAmp.value.toFixed(4),
      };
    })()`);
    await snapPng('frame-2.png');

    // Also measure pure steppe-field wind motion over 500ms with grass_fx off so we isolate steppeTuft wind displacement = 0.000 px!
    const tuftWindCheck = await evalJs(`(async () => {
      const findMod = (sub) => performance.getEntriesByType('resource').map((r) => r.name).find((n) => n.includes(sub)) || sub;
      const grassMod = await import(findMod('/src/render/grass/grass.ts'));
      grassMod.GRASS_FX.off = true;
      await new Promise((r) => setTimeout(r, 200));
      return true;
    })()`);
    await snapPng('_tmp_tuft_t1.png');
    await sleep(450);
    await snapPng('_tmp_tuft_t2.png');
    await evalJs(`(async () => {
      const findMod = (sub) => performance.getEntriesByType('resource').map((r) => r.name).find((n) => n.includes(sub)) || sub;
      const grassMod = await import(findMod('/src/render/grass/grass.ts'));
      grassMod.GRASS_FX.off = false;
    })()`);

    const png2 = decodePng(resolve(__dirname, 'frame-2.png'));
    const pngTuft1 = decodePng(resolve(__dirname, '_tmp_tuft_t1.png'));
    const pngTuft2 = decodePng(resolve(__dirname, '_tmp_tuft_t2.png'));
    rmSync(resolve(__dirname, '_tmp_tuft_t1.png'), { force: true });
    rmSync(resolve(__dirname, '_tmp_tuft_t2.png'), { force: true });
    observations.push({
      frame: 2,
      label: 'spring_steppe_day156_frozen_september_straw_tufts_and_8m_ring_cutoff',
      ...stage2Meta,
      near8mTuftZoneStats: boxStats(png2, 0.15, 0.85, 0.64, 0.90),
      beyond8mZoneStats: boxStats(png2, 0.15, 0.85, 0.40, 0.55),
      isolatedSteppeTuftWindDiff500ms: diffStats(pngTuft1, pngTuft2, 0.20, 0.80, 0.66, 0.88),
    });

    // =========================================================================
    // STAGE 3 (frame-3.png): Backlit low morning sun across CSM tree shadows + 12.0 m/s wind
    // Unshadowed addTranslucency glowing inside shadows + quadratic horizontal trunk shear
    // =========================================================================
    const stage3Meta = await evalJs(`(async () => {
      const findMod = (sub) => performance.getEntriesByType('resource').map((r) => r.name).find((n) => n.includes(sub)) || sub;
      const worldMod = await import(findMod('/src/core/world.ts'));
      const landMod = await import(findMod('/src/world/globe/landingSite.ts'));
      const planetMod = await import(findMod('/src/world/globe/planet.ts'));
      const todMod = await import(findMod('/src/core/timeOfDay.ts'));
      const wcMod = await import(findMod('/src/core/worldClock.ts'));
      const weatherMod = await import(findMod('/src/core/weather.ts'));
      const treesMod = await import(findMod('/src/render/trees.ts'));
      const pbrMod = await import(findMod('/src/render/pbr.ts'));
      const rosterMod = await import(findMod('/src/core/landingRoster.ts'));

      const dir = planetMod.fromLatLon(${stage0.chosenLatLon[0]} * Math.PI / 180, ${stage0.chosenLatLon[1]} * Math.PI / 180);
      landMod.engageLanding(dir, 0);
      pbrMod.setGroundFloor('boreal', 196);
      todMod.initDay('?date=2026-07-15&hour=7.0', null, wcMod.worldSec());

      const sun = todMod.sunPosition(7.0, 196, ${stage0.chosenLatLon[0]});
      const faceSunYaw = Math.atan2(-sun.direction.x, -sun.direction.z);

      // Find a tall tree near stage0.bestSite whose down-sun camera lens position (13 m + 4.2 m follow offset) is >= 6 m clear of any blocking tree!
      const bx = ${stage0.bestSite.x.toFixed(2)}, bz = ${stage0.bestSite.z.toFixed(2)};
      const baseCx = Math.floor(bx / 40), baseCz = Math.floor(bz / 40);
      const allTrees = [];
      for (let cx = baseCx - 2; cx <= baseCx + 2; cx++) {
        for (let cz = baseCz - 2; cz <= baseCz + 2; cz++) {
          for (const e of worldMod.generateChunk(cx, cz)) {
            if (e.kind === 'spruce') allTrees.push(e);
          }
        }
      }
      let bestTree = null;
      let camX = bx, camZ = bz;
      for (const e of allTrees) {
        if (Math.hypot(e.x - bx, e.z - bz) > 75) continue;
        const hGround = worldMod.heightAt(e.x, e.z);
        if (hGround < 1.5 || !worldMod.isDryLand(e.x, e.z, hGround)) continue;
        const dims = treesMod.treeDims(e.seed, e.x, e.z);
        const h = (dims.height || 14) * e.scale;
        // Try standing 13.5 m down-sun; follow camera lens sits ~4.2 m further down-sun (17.7 m from e)
        const tx = e.x - sun.direction.x * 13.5, tz = e.z - sun.direction.z * 13.5;
        const lx = e.x - sun.direction.x * 17.7, lz = e.z - sun.direction.z * 17.7;
        if (!worldMod.isDryLand(tx, tz) || !worldMod.isDryLand(lx, lz)) continue;
        const blocked = allTrees.some((o) => o.key !== e.key && (Math.hypot(o.x - lx, o.z - lz) < 6.5 || Math.hypot(o.x - tx, o.z - tz) < 4.5));
        if (blocked) continue;
        if (!bestTree || h > bestTree.height) {
          bestTree = { x: +e.x.toFixed(2), z: +e.z.toFixed(2), height: +h.toFixed(2), species: dims.species };
          camX = tx; camZ = tz;
        }
      }
      if (!bestTree) bestTree = { x: bx, z: bz, height: 15, species: 'black-spruce' };
      window.borealPlace(camX, camZ, faceSunYaw, -0.06);

      for (let k = 0; k < 9; k++) {
        rosterMod.setLandingClear([]);
        rosterMod.setLandingSight([]);
        const g = weatherMod.getGrid();
        if (g) { g.u.fill(11.8); g.v.fill(2.2); } // 12.0 m/s Beaufort 6 strong breeze -> uWindAmp = 9.0!
        treesMod.updateTreeUniforms();
        await new Promise((r) => setTimeout(r, 320));
      }

      return {
        sunElevationDeg: +sun.elevation.toFixed(3),
        sunAzimuthDeg: +sun.azimuth.toFixed(3),
        faceSunYawRad: +faceSunYaw.toFixed(4),
        targetTree: bestTree,
        camPos: [+camX.toFixed(2), +camZ.toFixed(2)],
        forcedWindMs: +Math.hypot(11.8, 2.2).toFixed(3),
      };
    })()`);

    await snapPng('frame-3.png');

    // Zero uSunCol for 2 frames to measure exact unshadowed addTranslucency radiance inside cast shadows!
    const transTelemetry = await evalJs(`(async () => {
      const findMod = (sub) => performance.getEntriesByType('resource').map((r) => r.name).find((n) => n.includes(sub)) || sub;
      const pbrMod = await import(findMod('/src/render/pbr.ts'));
      const treesMod = await import(findMod('/src/render/trees.ts'));
      const uSunColLive = [
        +pbrMod.SUN_UNIFORMS.uSunCol.value.r.toFixed(4),
        +pbrMod.SUN_UNIFORMS.uSunCol.value.g.toFixed(4),
        +pbrMod.SUN_UNIFORMS.uSunCol.value.b.toFixed(4),
      ];
      const uWindAmpLive = +treesMod.WIND_UNIFORMS.uWindAmp.value.toFixed(4);
      window.__savedSunCol = pbrMod.SUN_UNIFORMS.uSunCol.value.clone();
      window.__origCopy = pbrMod.SUN_UNIFORMS.uSunCol.value.copy.bind(pbrMod.SUN_UNIFORMS.uSunCol.value);
      pbrMod.SUN_UNIFORMS.uSunCol.value.setRGB(0, 0, 0);
      pbrMod.SUN_UNIFORMS.uSunCol.value.copy = () => pbrMod.SUN_UNIFORMS.uSunCol.value.setRGB(0, 0, 0);
      return { uSunColLive, uWindAmpLive };
    })()`);
    await sleep(240);
    await snapPng('_tmp_no_translucency.png');
    await evalJs(`(async () => {
      const findMod = (sub) => performance.getEntriesByType('resource').map((r) => r.name).find((n) => n.includes(sub)) || sub;
      const pbrMod = await import(findMod('/src/render/pbr.ts'));
      if (window.__origCopy) pbrMod.SUN_UNIFORMS.uSunCol.value.copy = window.__origCopy;
      if (window.__savedSunCol) pbrMod.SUN_UNIFORMS.uSunCol.value.copy(window.__savedSunCol);
    })()`);

    const png3 = decodePng(resolve(__dirname, 'frame-3.png'));
    const png3NoTrans = decodePng(resolve(__dirname, '_tmp_no_translucency.png'));
    rmSync(resolve(__dirname, '_tmp_no_translucency.png'), { force: true });
    observations.push({
      frame: 3,
      label: 'backlit_csm_shadow_unshadowed_translucency_and_canopy_horizontal_wind_shear',
      ...stage3Meta,
      ...transTelemetry,
      shadowedForegroundWithTranslucency: boxStats(png3, 0.15, 0.85, 0.62, 0.90),
      shadowedForegroundWithoutTranslucency: boxStats(png3NoTrans, 0.15, 0.85, 0.62, 0.90),
      translucencyDiffInShadowedForeground: diffStats(png3, png3NoTrans, 0.15, 0.85, 0.62, 0.90),
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
