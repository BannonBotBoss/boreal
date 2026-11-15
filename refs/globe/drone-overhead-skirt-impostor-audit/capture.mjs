/**
 * Live browser screen recording + 4-stage PNG frame sampler + runtime telemetry for T-0245
 * (Drone / Glide / Overhead Landscape, Horizon Skirt, Overhead Crowns & Mid-Distance Impostor Audit).
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
const CDP_PORT = 9375;
const WORK_ROOT = resolve(__dirname, '../../../work-t0245');
const PROFILE = resolve(WORK_ROOT, 'edge-drone-overhead-audit-profile');
const LOCK_NAME = 'agy: T-0245-drone-overhead-skirt-impostor-audit';

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
        await srv.transformRequest('/src/world/globe/inpage.ts');
        await srv.transformRequest('/src/world/globe/globeView.ts');
        await srv.transformRequest('/src/render/horizonMesh.ts');
        await srv.transformRequest('/src/render/horizonCover.ts');
        await srv.transformRequest('/src/render/trees/overheadCrowns.ts');
        await srv.transformRequest('/src/world/globe/aerialExemplar.ts');
        await srv.transformRequest('/src/world/globe/openTiles.ts');
      `;
      viteProc = spawn(process.execPath, ['--input-type=module', '-e', viteBoot], {
        stdio: 'ignore',
        cwd: resolve(__dirname, '../../..'),
      });
      if (viteProc.pid) track(viteProc.pid);
      let up = false;
      for (let i = 0; i < 60; i++) {
        try {
          const r = await fetch(`${BASE_URL}/src/render/horizonMesh.ts`);
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
      for (let i = 0; i < 240; i++) {
        await sleep(500);
        ready = await evalJs(`Boolean(
          document.readyState === 'complete' &&
          !document.getElementById('loading') &&
          window.__boreal &&
          window.__inpage &&
          typeof window.borealPlace === 'function'
        )`);
        if (ready) break;
      }
      if (!ready) throw new Error(`Game did not finish booting: ${JSON.stringify(pageErrors)}`);
    };

    await send('Page.navigate', {
      url: `${BASE_URL}/?nomenu=1&noprobe=1&view=ground&transition=inpage&inpagedev=1&stages=1&trees=v2&date=2026-08-15&hour=13.5&rec`,
    });
    await waitBoot();

    // Fast (<1 s) setup: locate home shoreline, check seeded home EOX mismatch, and locate both boreal and desert landing sites!
    const setupInfo = await evalJs(`(async () => {
      const findMod = (sub) => {
        const entries = performance.getEntriesByType('resource').map((r) => r.name);
        return entries.find((n) => n.includes(sub)) || sub;
      };
      const worldMod = await import(findMod('/src/core/world.ts'));
      const tuningMod = await import(findMod('/src/core/tuning.ts'));
      const planetMod = await import(findMod('/src/world/globe/planet.ts'));
      const coverSampleMod = await import(findMod('/src/world/globe/coverSample.ts'));
      const openTilesMod = await import(findMod('/src/world/globe/openTiles.ts'));
      const elevMod = await import(findMod('/src/core/stages/elevation.ts'));

      worldMod.setPictureFit(null);
      await window.__inpage.whenBooted();

      const globe = window.__inpage.globe;
      const planet = globe.planet;
      const ws = tuningMod.LEVEL.waterSurface;

      // Fast coarse scan of home [-1200..1200] every 200 m (only 169 outer points x 25 inner points = 4,225 samples -> <15 ms!)
      let bestShore = { x: 0, z: 0, yaw: 0, waterCount: 0, dryCount: 0, score: -Infinity };
      for (let x = -1200; x <= 1200; x += 200) {
        for (let z = -1200; z <= 1200; z += 200) {
          const h0 = worldMod.heightAt(x, z);
          if (h0 < ws + 0.5 || h0 > ws + 7.0) continue;
          let water = 0, dry = 0, bestDirX = 0, bestDirZ = -1;
          for (let dx = -160; dx <= 160; dx += 40) {
            for (let dz = -160; dz <= 160; dz += 40) {
              const r = Math.hypot(dx, dz);
              if (r < 36 || r > 200) continue;
              const hd = worldMod.heightAt(x + dx, z + dz);
              const lk = elevMod.STAGES.on ? elevMod.lakeAt(elevMod.STAGES.seed, x + dx, z + dz) : undefined;
              if (lk || hd < ws) {
                water++;
                bestDirX += dx / r;
                bestDirZ += dz / r;
              } else {
                dry++;
              }
            }
          }
          if (water >= 4 && dry >= 4) {
            const balance = Math.min(water, dry) * 2 - Math.abs(water - dry) * 0.25;
            if (balance > bestShore.score) {
              const yaw = Math.atan2(-bestDirX, -bestDirZ);
              bestShore = { x, z, yaw, waterCount: water, dryCount: dry, score: balance };
            }
          }
        }
      }

      const homeDir = planet.fromLocal(bestShore.x, bestShore.z);
      const homeLL = planetMod.toLatLon(homeDir);
      const homeLat = homeLL.lat * 180 / Math.PI;
      const homeLon = homeLL.lon * 180 / Math.PI;

      // Warm EOX tiles for seeded home AND Sahara (23.5 N, 25.0 E) AND Superior/Ontario boreal (48.5 N, -91.5 W)
      openTilesMod.warmPhotoTiles(homeLat, homeLon);
      openTilesMod.warmPhotoTiles(23.5, 25.0);
      openTilesMod.warmPhotoTiles(48.5, -91.5);
      await new Promise((r) => setTimeout(r, 1200));

      const seededHomeCover = coverSampleMod.coverSampleLatLon(homeLat, homeLon, homeDir, planet);

      // Find a dry 'boreal' remote lake-shore / low-relief site AND a dry 'desert' remote site on the planet!
      let bestBorealSite = null;
      for (let lat = 46; lat <= 58; lat += 2) {
        for (let lon = -160; lon <= 160; lon += 6) {
          const dir = planetMod.fromLatLon(lat * Math.PI / 180, lon * Math.PI / 180);
          const s = planet.sampleSurface(dir);
          if (s.kind !== '' || s.h < 20 || s.h > 450) continue;
          const cs = coverSampleMod.coverSampleLatLon(lat, lon, dir, planet);
          if (!cs.water && cs.biome === 'boreal') {
            // Check if there is an inland lake nearby within ~180 m so coverSpots plants grid rows in water too!
            let nearLake = false;
            for (let dlat = -0.002; dlat <= 0.002; dlat += 0.001) {
              for (let dlon = -0.003; dlon <= 0.003; dlon += 0.0015) {
                const s2 = planet.sampleSurface(planetMod.fromLatLon((lat + dlat) * Math.PI / 180, (lon + dlon) * Math.PI / 180));
                if (s2.kind === 'lake' || s2.h < s2.level) nearLake = true;
              }
            }
            if (!bestBorealSite || (nearLake && !bestBorealSite.nearLake)) {
              bestBorealSite = { lat, lon, nearLake, elevM: Number(cs.elevM.toFixed(1)), biome: cs.biome };
              if (nearLake) break;
            }
          }
        }
        if (bestBorealSite?.nearLake) break;
      }

      // Scan for dry 'desert' site (either Sahara with EOX or 64..66 deg treeline-aridity transition where vegetationWeight < 0.12)
      let bestDesert = null;
      const candLats = [23.5, 22, 25, 20, -24, 65.2, 65.4, 65.6, 64.8, -65.2, -65.4];
      for (const lat of candLats) {
        for (let lon = -170; lon <= 170; lon += 5) {
          const dir = planetMod.fromLatLon(lat * Math.PI / 180, lon * Math.PI / 180);
          const s = planet.sampleSurface(dir);
          if (s.home > 0 || s.kind !== '' || s.h < 15 || s.h > 600) continue;
          const cs = coverSampleMod.coverSampleLatLon(lat, lon, dir, planet);
          if (!cs.water && cs.biome === 'desert') {
            bestDesert = {
              lat: Number(lat.toFixed(3)),
              lon: Number(lon.toFixed(3)),
              elevM: Number(cs.elevM.toFixed(1)),
              vegetation: Number(cs.vegetation.toFixed(4)),
              biome: cs.biome,
              treeShare: Number(cs.treeShare.toFixed(6)),
              stemsPerHa: cs.stemsPerHa,
              heightM: Number(cs.heightM.toFixed(2)),
            };
            break;
          }
        }
        if (bestDesert) break;
      }

      return {
        bestShore,
        seededHomeLat: Number(homeLat.toFixed(4)),
        seededHomeLon: Number(homeLon.toFixed(4)),
        seededHomeClassifiedBiome: seededHomeCover.biome,
        seededHomeVegetation: Number(seededHomeCover.vegetation.toFixed(4)),
        bestBorealSite,
        bestDesert,
      };
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

    const observations = [];

    // =========================================================================
    // STAGE 0: Globe Nadir View at 450 m over Home Boreal Lake Shore at Astronomical Midnight (hour=0.05)
    // =========================================================================
    const probe0 = await evalJs(`(async () => {
      const findMod = (sub) => {
        const entries = performance.getEntriesByType('resource').map((r) => r.name);
        return entries.find((n) => n.includes(sub)) || sub;
      };
      const todMod = await import(findMod('/src/core/timeOfDay.ts'));
      const wcMod = await import(findMod('/src/core/worldClock.ts'));
      const aerialMod = await import(findMod('/src/world/globe/aerialExemplar.ts'));

      todMod.initDay('?date=2026-08-15&hour=0.05', null, wcMod.worldSec());
      window.__inpage.enter();
      await new Promise((r) => setTimeout(r, 500));
      const g = window.__inpage.globe;
      g.lookOver(${setupInfo.bestShore.x.toFixed(1)}, ${setupInfo.bestShore.z.toFixed(1)});
      g.jumpTo(450);
      await new Promise((r) => setTimeout(r, 1800));

      const doy = todMod.dayAt(wcMod.worldSec());
      const hour = todMod.hourAt(wcMod.worldSec());
      const sun = todMod.sunPosition(hour, doy);

      const crownsGroup = g.scene.getObjectByName('overhead-crowns');
      const floorMesh = crownsGroup?.getObjectByName('overhead-floor');
      const shadowMesh = crownsGroup?.getObjectByName('overhead-shadows');
      const spruceMesh = crownsGroup?.children?.find((c) => c.isInstancedMesh && c !== shadowMesh);
      const aspenMesh = crownsGroup?.children?.find((c) => c.isInstancedMesh && c !== shadowMesh && c !== spruceMesh);

      const glCanvas = document.getElementById('world') || document.querySelector('canvas');
      const tmp = document.createElement('canvas');
      tmp.width = 1280; tmp.height = 720;
      const tctx = tmp.getContext('2d');
      tctx.drawImage(glCanvas, 0, 0, 1280, 720);
      const d = tctx.getImageData(160, 120, 960, 480).data;
      let sumL = 0, sumR = 0, sumG = 0, sumB = 0, brightPx = 0;
      const nPx = d.length / 4;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i] / 255, gr = d[i + 1] / 255, b = d[i + 2] / 255;
        const l = 0.2126 * r + 0.7152 * gr + 0.0722 * b;
        sumR += r; sumG += gr; sumB += b; sumL += l;
        if (l > 0.20) brightPx++;
      }

      return {
        frame: 0,
        label: 'globe_450m_midnight_uCrownFloor_post_tonemap_daylight_override_and_unlit_floor_over_lake_with_midnight_shadows',
        mode: window.__inpage.mode,
        altitudeM: Number(g.altitude.toFixed(1)),
        hour: Number(hour.toFixed(3)),
        sunElevationDeg: Number(sun.elevation.toFixed(2)),
        uCrownFloor: aerialMod.AERIAL.uCrownFloor.value,
        overheadFloorVisible: Boolean(floorMesh?.visible),
        overheadFloorScaleM: floorMesh ? [Number(floorMesh.scale.x.toFixed(1)), Number(floorMesh.scale.y.toFixed(1))] : null,
        overheadFloorToneMapped: Boolean(floorMesh?.material?.toneMapped),
        overheadFloorDepthTest: Boolean(floorMesh?.material?.depthTest),
        spruceCount: spruceMesh?.count ?? 0,
        aspenCount: aspenMesh?.count ?? 0,
        midnightShadowCount: shadowMesh?.count ?? 0,
        spruceEmissiveRGB: spruceMesh?.material?.emissive ? [spruceMesh.material.emissive.r, spruceMesh.material.emissive.g, spruceMesh.material.emissive.b] : null,
        spruceDepthTest: Boolean(spruceMesh?.material?.depthTest),
        midnightCenterSrgbMeanRGB: [
          Number((sumR / nPx).toFixed(4)),
          Number((sumG / nPx).toFixed(4)),
          Number((sumB / nPx).toFixed(4)),
        ],
        midnightCenterSrgbMeanLuma: Number((sumL / nPx).toFixed(4)),
        midnightBrightPixelFractionGt020: Number((brightPx / nPx).toFixed(4)),
      };
    })()`);
    await snapPng('frame-0.png');
    observations.push(probe0);

    // =========================================================================
    // STAGE 1: In-Page Band Drone View (135 m altitude, daytime hour=13.5) over Boreal Site
    // Demonstrates:
    //  - 4,096 billboards on an exact 6 m x 6 m Cartesian grid (Clark-Evans R = 2.000) truncated abruptly at 219.6 m!
    //  - Zero water check on horizonCover (planting trees straight across lakes/depressions < LEVEL.waterSurface)!
    //  - Also records how seeded homeLon (49.77 N, Central Asia) drapes steppe EOX imagery over home Kenora boreal forest!
    // =========================================================================
    const probe1 = await evalJs(`(async () => {
      const findMod = (sub) => {
        const entries = performance.getEntriesByType('resource').map((r) => r.name);
        return entries.find((n) => n.includes(sub)) || sub;
      };
      const todMod = await import(findMod('/src/core/timeOfDay.ts'));
      const wcMod = await import(findMod('/src/core/worldClock.ts'));
      const tuningMod = await import(findMod('/src/core/tuning.ts'));
      const coverKindMod = await import(findMod('/src/world/globe/coverKind.ts'));
      const coverSampleMod = await import(findMod('/src/world/globe/coverSample.ts'));

      todMod.initDay('?date=2026-08-15&hour=13.5', null, wcMod.worldSec());
      const bSite = ${JSON.stringify(setupInfo.bestBorealSite)};
      if (bSite) {
        window.__inpage.placeAt(bSite.lat, bSite.lon, 135);
      } else {
        window.__inpage.placeAt(${setupInfo.seededHomeLat}, ${setupInfo.seededHomeLon}, 135);
      }
      window.__inpage.setEye(135, -0.45);

      for (let i = 0; i < 25; i++) {
        await new Promise((r) => setTimeout(r, 200));
        const hc = window.__inpage.view.scene.getObjectByName('horizon-cover');
        if (hc && hc.count > 0 && hc.material?.map?.image?.width >= 512) break;
      }
      await new Promise((r) => setTimeout(r, 1000));

      const scene = window.__inpage.view.scene;
      const cam = window.__inpage.view.camera;
      const hc = scene.getObjectByName('horizon-cover');
      const ws = tuningMod.LEVEL.waterSurface;
      const liveCover = coverSampleMod.coverSampleAt(cam.position.x, cam.position.z);

      let inWaterCount = 0, minR = Infinity, maxR = 0;
      const pts = [];
      if (hc && hc.count > 0) {
        const m = hc.instanceMatrix.array;
        for (let i = 0; i < hc.count; i++) {
          const x = m[i * 16 + 12];
          const y = m[i * 16 + 13];
          const z = m[i * 16 + 14];
          const r = Math.hypot(x - cam.position.x, z - cam.position.z);
          if (r < minR) minR = r;
          if (r > maxR) maxR = r;
          if (y < ws) inWaterCount++;
          pts.push([x, z]);
        }
      }

      const uncapped = coverKindMod.coverSpots(cam.position.x, cam.position.z, 'boreal', 36, 900, 1000000);
      let nnSum = 0, nnCount = 0;
      for (let i = 0; i < Math.min(pts.length, 600); i++) {
        let best = Infinity;
        for (let j = 0; j < pts.length; j++) {
          if (i === j) continue;
          const d = Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]);
          if (d < best) best = d;
        }
        if (Number.isFinite(best)) { nnSum += best; nnCount++; }
      }
      const meanNN = nnCount > 0 ? nnSum / nnCount : 0;
      const density = 1 / (6 * 6);
      const clarkEvansR = 2 * Math.sqrt(density) * meanNN;

      return {
        frame: 1,
        label: 'band_drone_135m_daytime_horizonCover_6m_grid_truncated_at_220m_in_water_and_glb_impostors',
        mode: window.__inpage.mode,
        heightM: Number(window.__inpage.height.toFixed(1)),
        siteBiome: liveCover.biome,
        seededHomeMisclassifiedBiome: ${JSON.stringify(setupInfo.seededHomeClassifiedBiome)},
        horizonCoverCount: hc?.count ?? 0,
        uncapped900mSpotCount: uncapped.length,
        annulusCoverageFraction: Number.isFinite(maxR) && maxR > 36 ? Number(((maxR * maxR - 36 * 36) / (900 * 900 - 36 * 36)).toFixed(4)) : 0,
        minSpotRadiusM: Number.isFinite(minR) ? Number(minR.toFixed(2)) : null,
        maxSpotRadiusM: Number.isFinite(maxR) ? Number(maxR.toFixed(2)) : null,
        spotsPlantedBelowWaterSurface: inWaterCount,
        spotsInWaterFraction: hc?.count ? Number((inWaterCount / hc.count).toFixed(4)) : 0,
        meanNearestNeighbourM: Number(meanNN.toFixed(3)),
        clarkEvansIndexR: Number(clarkEvansR.toFixed(4)),
        atlasWidthPx: hc?.material?.map?.image?.width ?? hc?.material?.map?.source?.data?.width ?? null,
        atlasColorSpace: hc?.material?.map?.colorSpace ?? null,
        horizonCoverEmissiveRGB: hc?.material?.emissive ? [hc.material.emissive.r, hc.material.emissive.g, hc.material.emissive.b] : null,
      };
    })()`);
    await snapPng('frame-1.png');
    observations.push(probe1);

    // =========================================================================
    // STAGE 2: In-Page Band Drone View (260 m altitude) at Astronomical Midnight (hour=0.05)
    // =========================================================================
    const probe2 = await evalJs(`(async () => {
      const findMod = (sub) => {
        const entries = performance.getEntriesByType('resource').map((r) => r.name);
        return entries.find((n) => n.includes(sub)) || sub;
      };
      const todMod = await import(findMod('/src/core/timeOfDay.ts'));
      const wcMod = await import(findMod('/src/core/worldClock.ts'));

      todMod.initDay('?date=2026-08-15&hour=0.05', null, wcMod.worldSec());
      window.__inpage.setEye(260, -0.26);
      await new Promise((r) => setTimeout(r, 1400));

      const doy = todMod.dayAt(wcMod.worldSec());
      const hour = todMod.hourAt(wcMod.worldSec());
      const sun = todMod.sunPosition(hour, doy);
      const scene = window.__inpage.view.scene;
      const fogCol = scene.fog?.color ? [Number(scene.fog.color.r.toFixed(3)), Number(scene.fog.color.g.toFixed(3)), Number(scene.fog.color.b.toFixed(3))] : null;

      const glCanvas = document.getElementById('world') || document.querySelector('canvas');
      const tmp = document.createElement('canvas');
      tmp.width = 1280; tmp.height = 720;
      const tctx = tmp.getContext('2d');
      tctx.drawImage(glCanvas, 0, 0, 1280, 720);

      let peakRow = 0, peakLuma = 0, peakRGB = [0, 0, 0];
      for (let y = 40; y < 560; y += 4) {
        const row = tctx.getImageData(200, y, 880, 2).data;
        let sr = 0, sg = 0, sb = 0;
        const n = row.length / 4;
        for (let i = 0; i < row.length; i += 4) {
          sr += row[i] / 255; sg += row[i + 1] / 255; sb += row[i + 2] / 255;
        }
        const mr = sr / n, mg = sg / n, mb = sb / n;
        const l = 0.2126 * mr + 0.7152 * mg + 0.0722 * mb;
        if (l > peakLuma) { peakLuma = l; peakRow = y; peakRGB = [Number(mr.toFixed(4)), Number(mg.toFixed(4)), Number(mb.toFixed(4))]; }
      }
      const skyTop = tctx.getImageData(200, 12, 880, 24).data;
      let topL = 0;
      for (let i = 0; i < skyTop.length; i += 4) {
        topL += (0.2126 * skyTop[i] + 0.7152 * skyTop[i + 1] + 0.0722 * skyTop[i + 2]) / 255;
      }
      topL /= (skyTop.length / 4);

      return {
        frame: 2,
        label: 'band_drone_260m_midnight_uSkirtHazeColor_daylight_blue_horizon_glowing_green_cover_and_inpage_fog_override',
        mode: window.__inpage.mode,
        heightM: Number(window.__inpage.height.toFixed(1)),
        hour: Number(hour.toFixed(3)),
        sunElevationDeg: Number(sun.elevation.toFixed(2)),
        sceneFogColorRGB: fogCol,
        topSkyMeanSrgbLuma: Number(topL.toFixed(4)),
        peakSkirtHorizonRowY: peakRow,
        peakSkirtHorizonMeanSrgbRGB: peakRGB,
        peakSkirtHorizonMeanSrgbLuma: Number(peakLuma.toFixed(4)),
      };
    })()`);
    await snapPng('frame-2.png');
    observations.push(probe2);

    // =========================================================================
    // STAGE 3: In-Page Band Drone View (220 m altitude, daytime hour=13.5) over Remote Arid DESERT Site
    // =========================================================================
    const probe3 = await evalJs(`(async () => {
      const findMod = (sub) => {
        const entries = performance.getEntriesByType('resource').map((r) => r.name);
        return entries.find((n) => n.includes(sub)) || sub;
      };
      const todMod = await import(findMod('/src/core/timeOfDay.ts'));
      const wcMod = await import(findMod('/src/core/worldClock.ts'));
      const coverSampleMod = await import(findMod('/src/world/globe/coverSample.ts'));
      const siteMod = await import(findMod('/src/core/sitePhase.ts'));
      const aerialMod = await import(findMod('/src/world/globe/aerialExemplar.ts'));
      const openTilesMod = await import(findMod('/src/world/globe/openTiles.ts'));

      const des = ${JSON.stringify(setupInfo.bestDesert)} || { lat: 23.5, lon: 25.0 };
      openTilesMod.warmPhotoTiles(des.lat, des.lon);
      todMod.initDay('?date=2026-08-15&hour=13.5', null, wcMod.worldSec());
      window.__inpage.placeAt(des.lat, des.lon, 220);
      window.__inpage.setEye(220, -0.38);
      await new Promise((r) => setTimeout(r, 2200));

      const scene = window.__inpage.view.scene;
      const cam = window.__inpage.view.camera;
      const hc = scene.getObjectByName('horizon-cover');
      const skirt = scene.getObjectByName('horizon-skirt');
      const liveCover = coverSampleMod.coverSampleAt(cam.position.x, cam.position.z);

      const slotAttr = hc?.geometry?.getAttribute('aTree');
      const slotCounts = {};
      if (hc && slotAttr) {
        for (let i = 0; i < hc.count; i++) {
          const sv = slotAttr.getX(i);
          slotCounts[sv] = (slotCounts[sv] || 0) + 1;
        }
      }

      const g = window.__inpage.globe;
      const crownsGroup = g?.scene?.getObjectByName('overhead-crowns');
      const floorMesh = crownsGroup?.getObjectByName('overhead-floor');

      return {
        frame: 3,
        label: 'band_drone_220m_remote_desert_unread_uForest_conifer_canopy_oak_broadleaf_billboards_and_boreal_floor',
        mode: window.__inpage.mode,
        heightM: Number(window.__inpage.height.toFixed(1)),
        desertSite: {
          latDeg: Number(siteMod.SITE.latDeg.toFixed(3)),
          lonDeg: Number(siteMod.SITE.lonDeg.toFixed(3)),
          remote: siteMod.SITE.remote,
          biome: liveCover.biome,
          vegetation: Number(liveCover.vegetation.toFixed(4)),
          treeShare: Number(liveCover.treeShare.toFixed(6)),
          heightM: Number(liveCover.heightM.toFixed(2)),
        },
        horizonCoverKind: hc?.userData?.kind ?? null,
        horizonCoverDesertTreeCount: hc?.count ?? 0,
        horizonCoverDesertTreeSlotHistogram: slotCounts,
        uCrownFloorOnDesert: aerialMod.AERIAL.uCrownFloor.value,
        overheadBorealFloorVisibleOnDesert: Boolean(floorMesh?.visible),
        skirtVisible: Boolean(skirt?.visible),
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
    const horizonMeshRaw = readFileSync(resolve(repoRoot, 'src/render/horizonMesh.ts'), 'utf8');
    const horizonCoverRaw = readFileSync(resolve(repoRoot, 'src/render/horizonCover.ts'), 'utf8');
    const cc0Raw = readFileSync(resolve(repoRoot, 'src/render/trees/cc0Impostors.ts'), 'utf8');
    const overheadRaw = readFileSync(resolve(repoRoot, 'src/render/trees/overheadCrowns.ts'), 'utf8');
    const tileRaw = readFileSync(resolve(repoRoot, 'src/world/globe/tile.ts'), 'utf8');
    const exemplarRaw = readFileSync(resolve(repoRoot, 'src/world/globe/aerialExemplar.ts'), 'utf8');
    const inpageRaw = readFileSync(resolve(repoRoot, 'src/world/globe/inpage.ts'), 'utf8');

    const uForestMatches = horizonMeshRaw.match(/\buForest\b/g) || [];
    const setHazeCalls = (horizonMeshRaw.match(/\.setHaze\s*\(/g) || []).length + (inpageRaw.match(/\.setHaze\s*\(/g) || []).length;

    const outJson = {
      capturedAt: new Date().toISOString(),
      baseUrl: BASE_URL,
      setupInfo,
      observations,
      sourceVerification: {
        horizonMeshUForestTokenCount: uForestMatches.length,
        horizonMeshUForestReadInShader: uForestMatches.length > 2,
        setHazeCallerCountAcrossCodebase: setHazeCalls,
        inpageHardcodesDaylightFogBlue: inpageRaw.includes('scene.fog.color.setRGB(0.45, 0.62, 0.9)'),
        cc0LoadsStoredGlbTrees: cc0Raw.includes('/models/trees/'),
        cc0TagsLinearRenderTargetAsSrgb: cc0Raw.includes('albedo.colorSpace = THREE.SRGBColorSpace'),
        tileOverwritesGlFragColorAfterDithering: /#include <dithering_fragment>[\s\S]*gl_FragColor\.rgb\s*=\s*floorD/.test(tileRaw),
        overheadFloorToneMappedFalse: /toneMapped:\s*false/.test(overheadRaw),
        aerialExemplarUsesNoColorSpaceOnPng: exemplarRaw.includes('tex.colorSpace = THREE.NoColorSpace'),
        horizonCoverUsesUnseededMathSin: horizonCoverRaw.includes('Math.sin('),
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
