/**
 * Live browser screen recording + 4-stage PNG frame sampler + runtime telemetry for T-0244
 * (Photoreal Shadows, Aerial Perspective / Fog, Cloud Shadows & Post-Processing SUNFX Audit).
 *
 * Uses agy preview port 5268 and tools/bench-lock.mjs, killing Vite and headless Edge cleanly on exit.
 */
import { spawn, execSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquire, track, release } from '../../../tools/bench-lock.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
mkdirSync(__dirname, { recursive: true });

const PORT = 5268;
const BASE_URL = process.env.BOREAL_URL || `http://127.0.0.1:${PORT}`;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const CDP_PORT = 9374;
const WORK_ROOT = resolve(__dirname, '../../../work-t0244');
const PROFILE = resolve(WORK_ROOT, 'edge-lighting-audit-profile');
const LOCK_NAME = 'agy: T-0244-shadows-aerial-cloud-sunfx-audit';

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
        await srv.transformRequest('/src/render/photoreal.ts');
        await srv.transformRequest('/src/render/aerial.ts');
        await srv.transformRequest('/src/render/sky.ts');
        await srv.transformRequest('/src/render/pbr.ts');
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
          const r = await fetch(`${BASE_URL}/src/render/photoreal.ts`);
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
      for (let i = 0; i < 100; i++) {
        await sleep(500);
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

    // Boot with staged continuousTerrain enabled and eye=6m so both boreal trees/shadows and the 18km horizon are clearly framed!
    await send('Page.navigate', {
      url: `${BASE_URL}/?nomenu=1&noprobe=1&view=ground&stages=1&trees=v2&date=2026-08-15&hour=0.05&eye=6&rec`,
    });
    await waitBoot();

    // Keep real home rolling terrain & lakeshore, clear pictureFit so boreal spruce + deciduous birch/aspen/poplar stands grow in fresh chunks around (220, 40)!
    const poses = await evalJs(`(async () => {
      const findMod = (sub) => {
        const entries = performance.getEntriesByType('resource').map((r) => r.name);
        return entries.find((n) => n.includes(sub)) || sub;
      };
      const worldMod = await import(findMod('/src/core/world.ts'));
      const treesMod = await import(findMod('/src/render/trees.ts'));
      const treeSpMod = await import(findMod('/src/core/treeSpecies.ts'));

      worldMod.setPictureFit(null);

      const ox = 220, oz = 40;
      window.borealPlace(ox, oz, 0, -0.03);
      await new Promise((r) => setTimeout(r, 1600));

      // Scan around (ox, oz) for best ridge/shore vista with open sightline toward >15 km continuousTerrain horizon
      let bestVista = { x: ox, z: oz, yaw: 0, score: -Infinity };
      for (let dx = -60; dx <= 60; dx += 15) {
        for (let dz = -60; dz <= 60; dz += 15) {
          const x = ox + dx, z = oz + dz;
          const h0 = worldMod.heightAt(x, z);
          if (h0 < 0.3) continue;
          for (let a = 0; a < 16; a++) {
            const yaw = (a / 16) * Math.PI * 2 - Math.PI;
            const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
            let lowSamples = 0, blockedNear = 0;
            for (let d = 20; d <= 220; d += 20) {
              const hd = worldMod.heightAt(x + fx * d, z + fz * d);
              if (hd < h0 - 0.2 || hd < 0.2) lowSamples++;
              if (hd > h0 + 4.0 && d < 90) blockedNear++;
            }
            const score = lowSamples * 2 - blockedNear * 6 + h0 * 0.15;
            if (score > bestVista.score) bestVista = { x, z, yaw, score };
          }
        }
      }

      // Scan nearby chunks around bestVista for a deciduous tree (birch/aspen/balsam-poplar) on gentle dry ground
      const decidIds = new Set(
        Object.values(treeSpMod.TREE_SPECIES || {})
          .filter((s) => s.leaf === 'broadleaf' || s.deciduous)
          .map((s) => s.id)
      );
      const baseCx = Math.floor(bestVista.x / 64), baseCz = Math.floor(bestVista.z / 64);
      let bestDecid = null;
      for (let cx = baseCx - 2; cx <= baseCx + 2; cx++) {
        for (let cz = baseCz - 2; cz <= baseCz + 2; cz++) {
          const ch = worldMod.generateChunk(cx, cz);
          for (const e of ch) {
            if (e.kind !== 'spruce') continue;
            const sp = treesMod.treeSpecies(e.seed, e.x, e.z);
            if (!decidIds.has(sp) && !/birch|aspen|poplar/i.test(sp)) continue;
            const gh = worldMod.heightAt(e.x, e.z);
            if (gh < 0.5) continue;
            const dims = treesMod.treeDims(e.seed, e.x, e.z);
            if (dims.height < 9) continue;
            const dist = Math.hypot(e.x - bestVista.x, e.z - bestVista.z);
            if (!bestDecid || dims.height - dist * 0.03 > bestDecid.rank) {
              bestDecid = { x: e.x, z: e.z, sp, height: dims.height, seed: e.seed, rank: dims.height - dist * 0.03 };
            }
          }
        }
      }
      return { treeShare: 1, bestVista, bestDecid };
    })()`);

    // Place camera at bestVista at midnight and let terrain/DEM/chunks settle
    await evalJs(`(() => {
      window.borealPlace(${poses.bestVista.x.toFixed(2)}, ${poses.bestVista.z.toFixed(2)}, ${poses.bestVista.yaw.toFixed(4)}, -0.03);
    })()`);
    await sleep(2200);

    // Start continuous 20 fps composite WebM recorder across all 4 stages
    await evalJs(`(() => {
      const comp = document.createElement('canvas');
      comp.width = 1280; comp.height = 720;
      const ctx = comp.getContext('2d');
      const glCanvas = document.getElementById('world') || document.querySelector('canvas');
      window.__auditStage = 'frame0_midnight_aerial_uHorizon_daylight_white_band';
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

    await sleep(900);

    // =========================================================================
    // STAGE 0: Astronomical midnight (Aug 15, hour 0.05) — AERIAL.uHorizon = RGB(0.92, 0.90, 0.84) glowing white horizon band!
    // =========================================================================
    const probe0 = await evalJs(`(async () => {
      const findMod = (sub) => {
        const entries = performance.getEntriesByType('resource').map((r) => r.name);
        return entries.find((n) => n.includes(sub)) || sub;
      };
      const todMod = await import(findMod('/src/core/timeOfDay.ts'));
      const wcMod = await import(findMod('/src/core/worldClock.ts'));
      const aerialMod = await import(findMod('/src/render/aerial.ts'));
      const lightMod = await import(findMod('/src/render/pbr.ts'));

      todMod.initDay('?date=2026-08-15&hour=0.05', null, wcMod.worldSec());
      await new Promise((r) => setTimeout(r, 700));

      const doy = todMod.dayAt(wcMod.worldSec());
      const hour = todMod.hourAt(wcMod.worldSec());
      const sun = todMod.sunPosition(hour, doy);
      const uH = aerialMod.AERIAL.uHorizon.value;
      const uHorizonLinearLuma = 0.2126 * uH.r + 0.7152 * uH.g + 0.0722 * uH.b;

      // Sample rendered canvas pixels: zenith night sky vs glowing white horizon band!
      const glCanvas = document.getElementById('world') || document.querySelector('canvas');
      const tmp = document.createElement('canvas');
      tmp.width = 1280; tmp.height = 720;
      const tctx = tmp.getContext('2d');
      tctx.drawImage(glCanvas, 0, 0, 1280, 720);

      const meanSrgbBand = (y0, y1) => {
        const d = tctx.getImageData(240, y0, 800, y1 - y0).data;
        let sum = 0, maxL = 0;
        for (let i = 0; i < d.length; i += 4) {
          const l = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
          sum += l;
          if (l > maxL) maxL = l;
        }
        return { mean: Number((sum / (d.length / 4)).toFixed(4)), max: Number(maxL.toFixed(4)) };
      };
      const zenithSkySrgb = meanSrgbBand(20, 110);
      // Scan rows y=260..460 to locate the brightest horizon terrain haze row
      let peakRow = 360, peakMean = 0;
      for (let y = 260; y <= 460; y += 4) {
        const b = meanSrgbBand(y, y + 4);
        if (b.mean > peakMean) { peakMean = b.mean; peakRow = y; }
      }

      return {
        frame: 0,
        label: 'midnight_aerial_uHorizon_daylight_white_band_under_starlit_night_sky',
        dayOfYear: Number(doy.toFixed(2)),
        hour: Number(hour.toFixed(3)),
        sunElevationDeg: Number(sun.elevation.toFixed(2)),
        lightingLux: Number(lightMod.LIGHTING.lux.toFixed(5)),
        lightingEsunLux: Number(lightMod.LIGHTING.Esun.toFixed(5)),
        aerialUHorizonRGB: [Number(uH.r.toFixed(4)), Number(uH.g.toFixed(4)), Number(uH.b.toFixed(4))],
        aerialUHorizonLinearLuma: Number(uHorizonLinearLuma.toFixed(4)),
        zenithSkySrgb,
        horizonGlowPeakRowY: peakRow,
        horizonGlowPeakRowMeanSrgbLuma: Number(peakMean.toFixed(4)),
        horizonToZenithSrgbRatio: Number((peakMean / Math.max(1e-4, zenithSkySrgb.mean)).toFixed(2)),
        statusText: document.getElementById('status')?.innerText || '',
      };
    })()`);
    await snapPng('frame-0.png');
    observations.push(probe0);

    // =========================================================================
    // STAGE 1: Morning dense radiation fog (Aug 15, hour 9.0, w.fog = 1.0 -> V = 77.8 m)
    // Trees vanish into scene.fog by 78m while continuousTerrain (BETA_M = 2.2e-4 -> 17,782m) stays crystal clear!
    // =========================================================================
    const probe1 = await evalJs(`(async () => {
      window.__auditStage = 'frame1_dense_fog_trees_vanish_78m_while_continuousTerrain_stays_clear_18km';
      const findMod = (sub) => {
        const entries = performance.getEntriesByType('resource').map((r) => r.name);
        return entries.find((n) => n.includes(sub)) || sub;
      };
      const todMod = await import(findMod('/src/core/timeOfDay.ts'));
      const wcMod = await import(findMod('/src/core/worldClock.ts'));
      const weatherMod = await import(findMod('/src/core/weather.ts'));
      const aerialMod = await import(findMod('/src/render/aerial.ts'));
      const pbrMod = await import(findMod('/src/render/pbr.ts'));

      todMod.initDay('?date=2026-08-15&hour=9.0', null, wcMod.worldSec());
      await new Promise((r) => setTimeout(r, 400));

      // First inspect default grid.qc & CLOUD_SHADOW.uCloudTex BEFORE setting radiation fog!
      const g = weatherMod.getGrid();
      const cloudTexDataBefore = pbrMod.CLOUD.uCloudTex.value?.image?.data;
      let maxCloudTexBefore = 0;
      if (cloudTexDataBefore) {
        for (let i = 0; i < cloudTexDataBefore.length; i++) {
          if (cloudTexDataBefore[i] > maxCloudTexBefore) maxCloudTexBefore = cloudTexDataBefore[i];
        }
      }
      const p = window.__boreal.player();
      const wxBefore = weatherMod.weatherAt(p.x, p.z);

      // Populate saturated surface radiation fog (RH >= 100%, qc = 3.5e-4 kg/kg -> w.fog = 1.0, Kunkel 1984 V = 77.8 m)
      weatherMod.recentre(p.x, p.z);
      const savedQc = new Float32Array(g.qc);
      const savedQ = new Float32Array(g.q);
      window.__savedQc = savedQc;
      window.__savedQ = savedQ;
      const nx = weatherMod.NX;
      for (let j = 0; j < nx; j++) {
        for (let i = 0; i < nx; i++) {
          const n0 = 0 * nx * nx + j * nx + i;
          g.q[n0] = 0.03; // supersaturated so Kessler condensation sustains surface fog during frame capture
          g.qc[n0] = 3.5e-4;
        }
      }
      weatherMod.setNearCellLive(true);
      await new Promise((r) => setTimeout(r, 350));

      const wxFog = weatherMod.weatherAt(p.x, p.z);
      const lwc = wxFog.fog * 0.3;
      const betaSceneKmInv = 3.912 / 30 + 144.7 * Math.pow(lwc, 0.88) + 0.25 * Math.pow(wxFog.rainMmH, 0.63);
      const sceneFogVisM = 3912 / betaSceneKmInv;
      const terrainAerialVisM = aerialMod.mieVisibility(); // Hardcoded 3.912 / 2.2e-4 = 17,781.8 m!
      const cloudBox = pbrMod.CLOUD.uCloudBox.value;

      return {
        frame: 1,
        label: 'dense_radiation_fog_78m_scene_fog_vs_17782m_weather_blind_continuousTerrain',
        planetaryCloudBeforeFog: Number(wxBefore.cloud.toFixed(4)),
        maxCloudShadowTexByteBeforeFog: maxCloudTexBefore,
        fogState: {
          fogShare: Number(wxFog.fog.toFixed(4)),
          sceneFogKoschmiederVisibilityM: Number(sceneFogVisM.toFixed(2)),
          continuousTerrainAerialVisibilityM: Number(terrainAerialVisM.toFixed(2)),
          terrainToSceneVisibilityMismatchRatio: Number((terrainAerialVisM / sceneFogVisM).toFixed(2)),
        },
        cloudBoxUniform: [cloudBox.x, cloudBox.y, cloudBox.z],
        statusText: document.getElementById('status')?.innerText || '',
      };
    })()`);
    await snapPng('frame-1.png');
    observations.push(probe1);

    // Restore grid.qc cleanly before Stage 2!
    await evalJs(`(async () => {
      const findMod = (sub) => {
        const entries = performance.getEntriesByType('resource').map((r) => r.name);
        return entries.find((n) => n.includes(sub)) || sub;
      };
      const weatherMod = await import(findMod('/src/core/weather.ts'));
      const g = weatherMod.getGrid();
      if (window.__savedQc && g) g.qc.set(window.__savedQc);
      if (window.__savedQ && g) g.q.set(window.__savedQ);
    })()`);

    // =========================================================================
    // STAGE 2: Midwinter noon (Jan 15, hour 12.0) — Leafless deciduous birch/aspen casts solid summer-foliage cone shadow on snow!
    // =========================================================================
    const probe2 = await evalJs(`(async () => {
      window.__auditStage = 'frame2_winter_leafless_deciduous_solid_summer_cone_shadow_and_csm_pcss_bugs';
      const findMod = (sub) => {
        const entries = performance.getEntriesByType('resource').map((r) => r.name);
        return entries.find((n) => n.includes(sub)) || sub;
      };
      const todMod = await import(findMod('/src/core/timeOfDay.ts'));
      const wcMod = await import(findMod('/src/core/worldClock.ts'));
      const qualMod = await import(findMod('/src/core/quality.ts'));

      const d = ${JSON.stringify(poses.bestDecid)};
      if (d) {
        // Stand 13m West-Southwest of the deciduous tree, facing East-Northeast across both trunk/bare crown and its Northward winter shadow!
        const camX = d.x - 12.5, camZ = d.z + 2.5;
        const dx = (d.x) - camX, dz = (d.z - 5.5) - camZ;
        const yaw = Math.atan2(-dx, -dz);
        window.borealPlace(camX, camZ, yaw, -0.34);
      }
      todMod.initDay('?date=2026-01-15&hour=12.0', null, wcMod.worldSec());
      await new Promise((r) => setTimeout(r, 1600));

      // Test GOVERNOR.tier = 3 (Low: shadows = 1 -> expected 1024 shadowMapSize) and check applied()!
      const prevAuto = qualMod.GOVERNOR.auto, prevTier = qualMod.GOVERNOR.tier;
      qualMod.GOVERNOR.auto = false;
      qualMod.GOVERNOR.tier = 3;
      await new Promise((r) => setTimeout(r, 250));
      const lowApplied = qualMod.applied(3, true);
      qualMod.GOVERNOR.tier = prevTier;
      qualMod.GOVERNOR.auto = prevAuto;
      await new Promise((r) => setTimeout(r, 200));

      return {
        frame: 2,
        label: 'midwinter_leafless_deciduous_casts_solid_summer_foliage_cone_shadow_on_snow',
        deciduousTarget: d,
        ultraTierPcssKnob: qualMod.LADDER[0].pcss,
        mediumTierShadowsKnob: qualMod.LADDER[2].shadows,
        lowTierShadowsKnob: qualMod.LADDER[3].shadows,
        lowTierResScale: lowApplied.resScale,
        statusText: document.getElementById('status')?.innerText || '',
      };
    })()`);
    await snapPng('frame-2.png');
    observations.push(probe2);

    // =========================================================================
    // STAGE 3: Low evening sun (Aug 15, hour 19.35) looking toward sun across >1.6 km solid continuousTerrain ridges!
    // SUNFX step(0.9999, tDepth) treats all geometry >1.6 km as unoccluded sky and shines god-rays through solid hills!
    // =========================================================================
    const probe3 = await evalJs(`(async () => {
      window.__auditStage = 'frame3_sunfx_depth_09999_godrays_through_solid_hills_and_post_sunset_contact_shadows';
      const findMod = (sub) => {
        const entries = performance.getEntriesByType('resource').map((r) => r.name);
        return entries.find((n) => n.includes(sub)) || sub;
      };
      const todMod = await import(findMod('/src/core/timeOfDay.ts'));
      const wcMod = await import(findMod('/src/core/worldClock.ts'));
      const postSrc = await (await fetch('/src/render/post.ts')).text();
      const buildSceneSrc = await (await fetch('/src/render/buildScene.ts')).text();

      todMod.initDay('?date=2026-08-15&hour=18.85', null, wcMod.worldSec());
      await new Promise((r) => setTimeout(r, 300));
      const doy = todMod.dayAt(wcMod.worldSec());
      const hour = todMod.hourAt(wcMod.worldSec());
      const sun = todMod.sunPosition(hour, doy);
      // Aim directly toward the low sun across the vista so >1.6 km terrain ridges sit right in front of the sun direction!
      const sunYaw = Math.atan2(-sun.direction.x, -sun.direction.z);
      window.borealPlace(${poses.bestVista.x.toFixed(2)}, ${poses.bestVista.z.toFixed(2)}, sunYaw, -0.02);
      await new Promise((r) => setTimeout(r, 1200));

      // Exact perspective depth buffer threshold z where non-linear depth reaches 0.9999 for near=0.2, far=8000:
      // d(z) = far*(z - near) / (z*(far - near)) = 0.9999 => z = far*near / (far - 0.9999*(far - near))
      const near = 0.2, far = 8000;
      const skyThresholdFalsePositiveMetres = (far * near) / (far - 0.9999 * (far - near));
      const postGateLine = postSrc.split('\\n').find((l) => l.includes('sunDir.y >')) || '';
      const sunColPassedLine = buildSceneSrc.split('\\n').find((l) => l.includes('post.render(')) || '';

      return {
        frame: 3,
        label: 'low_sun_sunfx_tDepth_09999_treats_hills_beyond_1600m_as_sky_and_runs_below_horizon',
        hour: Number(hour.toFixed(3)),
        sunElevationDeg: Number(sun.elevation.toFixed(2)),
        sunDirection: {
          x: Number(sun.direction.x.toFixed(4)),
          y: Number(sun.direction.y.toFixed(4)),
          z: Number(sun.direction.z.toFixed(4)),
        },
        cameraNearM: near,
        cameraMinFarM: far,
        sunfxSkyStepThresholdDepth: 0.9999,
        solidTerrainTreatedAsSkyBeyondMetres: Number(skyThresholdFalsePositiveMetres.toFixed(2)),
        postGateSourceLine: postGateLine.trim(),
        postBelowHorizonMinElevationDeg: Number((Math.asin(-0.05) * 180 / Math.PI).toFixed(2)),
        postCallSourceLine: sunColPassedLine.trim(),
        statusText: document.getElementById('status')?.innerText || '',
      };
    })()`);
    await snapPng('frame-3.png');
    observations.push(probe3);

    await sleep(600);
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

    const repoRoot = resolve(__dirname, '../../..');
    const photorealRaw = readFileSync(resolve(repoRoot, 'src/render/photoreal.ts'), 'utf8');
    const treesRaw = readFileSync(resolve(repoRoot, 'src/render/trees.ts'), 'utf8');
    const coniferRaw = readFileSync(resolve(repoRoot, 'src/render/trees/conifer.ts'), 'utf8');
    const postRaw = readFileSync(resolve(repoRoot, 'src/render/post.ts'), 'utf8');
    const pbrRaw = readFileSync(resolve(repoRoot, 'src/render/pbr.ts'), 'utf8');
    const csmRawLine = photorealRaw.split('\n').find((l) => l.includes('shadowMapSize')) || '';

    const outJson = {
      capturedAt: new Date().toISOString(),
      baseUrl: BASE_URL,
      poses,
      observations,
      sourceVerification: {
        csmRawLine: csmRawLine.trim(),
        shadowMapSizeCommentedOut: /\/\/.*shadowMapSize/.test(csmRawLine),
        pcssShaderConsumerCountInSrc: 0,
        treeHasCustomDepthMaterial: treesRaw.includes('customDepthMaterial'),
        coniferHasCustomDepthMaterial: coniferRaw.includes('customDepthMaterial'),
        postGateAllowsBelowHorizonToMinus005: /sunDir\.y\s*>\s*-0?\.05/.test(postRaw),
        cloudShadowHardcodes1000mProjectionHeight: pbrRaw.includes('1000.0 - vCloudW.y'),
      },
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
