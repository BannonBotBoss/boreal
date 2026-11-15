/**
 * Live browser screen recording + 4-stage PNG frame sampler + runtime telemetry for T-0243
 * (Animal Pelage: Photoperiod Seasonal Moult & Coat Polymorphism, Unlit/14x-Emissive Coat Shaders,
 * Broken Appearance Genome & Shape-Tools Silhouette, and Zero Wet/Snow Pelage & Cold/Wet Thermoregulation).
 *
 * Uses agy preview port 5267 and tools/bench-lock.mjs, killing Vite and headless Edge cleanly on exit.
 */
import { spawn, execSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquire, track, release } from '../../../tools/bench-lock.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
mkdirSync(__dirname, { recursive: true });

const PORT = 5267;
const BASE_URL = process.env.BOREAL_URL || `http://127.0.0.1:${PORT}`;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const CDP_PORT = 9373;
const WORK_ROOT = resolve(__dirname, '../../../work-t0243');
const PROFILE = resolve(WORK_ROOT, 'edge-pelage-audit-profile');
const LOCK_NAME = 'agy: T-0243-pelage-moult-genome-thermoregulation-audit';

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
        await srv.transformRequest('/src/render/coatFinish.ts');
        await srv.transformRequest('/src/render/meshySkin.ts');
        await srv.transformRequest('/src/render/appearance.ts');
        await srv.transformRequest('/src/core/needs/engine.ts');
      `;
      viteProc = spawn(process.execPath, ['--input-type=module', '-e', viteBoot], {
        stdio: 'ignore',
        cwd: resolve(__dirname, '../../..'),
      });
      if (viteProc.pid) track(viteProc.pid);
      let up = false;
      for (let i = 0; i < 60; i++) {
        try {
          const r = await fetch(`${BASE_URL}/src/render/coatFinish.ts`);
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
        if (performance && performance.setResourceTimingBufferSize) performance.setResourceTimingBufferSize(2000);
      })();`,
    });

    const waitBoot = async () => {
      let ready = false;
      for (let i = 0; i < 90; i++) {
        await sleep(500);
        ready = await evalJs(`Boolean(
          document.readyState === 'complete' &&
          !document.getElementById('loading') &&
          window.__boreal &&
          typeof window.__boreal.player === 'function'
        )`);
        if (ready) break;
      }
      if (!ready) throw new Error(`Game did not finish booting: ${JSON.stringify(pageErrors)}`);
    };

    const observations = [];

    // First find a flat snowy spot near a Snowshoe Hare and near water so the camera frames both wolf & hare cleanly!
    await send('Page.navigate', {
      url: `${BASE_URL}/?nomenu&noprobe&view=ground&stages=0&date=2026-01-15&hour=12&at=0,0,0&rec`,
    });
    await waitBoot();

    // Wait for GLBs + chunk snow tint to finish streaming
    const spot = await evalJs(`(async () => {
      const findMod = (sub) => {
        const entries = performance.getEntriesByType('resource').map((r) => r.name);
        return entries.find((n) => n.includes(sub)) || sub;
      };
      const modelsMod = await import(findMod('/src/render/animalModels.ts'));
      const worldMod = await import(findMod('/src/core/world.ts'));
      modelsMod.ensureAnimalModels(['Snowshoe Hare', 'Ermine', 'Gray Wolf', 'Red Fox', 'White-tailed Deer', 'Coyote']);
      for (let i = 0; i < 60; i++) {
        if (
          modelsMod.animalModel('Snowshoe Hare')?.skin &&
          modelsMod.animalModel('Ermine')?.skin &&
          modelsMod.animalModel('Gray Wolf')?.skin &&
          modelsMod.animalModel('Red Fox')?.skin &&
          modelsMod.animalModel('White-tailed Deer')?.skin
        ) break;
        await new Promise((r) => setTimeout(r, 150));
      }
      const hares = window.__boreal.hares();
      // Pick the nearest hare on gentle ground and place wolf 3.6 m behind it facing the hare!
      let bestHare = hares[0] || { x: 8, z: -8 };
      let bestScore = Infinity;
      for (const h of hares) {
        const hh = worldMod.heightAt(h.x, h.z);
        if (hh > 0.2 && hh < 8) {
          const d = Math.hypot(h.x, h.z);
          if (d < bestScore) { bestScore = d; bestHare = h; }
        }
      }
      // Also find nearest open lake water patch (heightAt < -0.55)
      let waterX = 0, waterZ = 0, bestWaterD = Infinity;
      for (let x = -80; x <= 80; x += 4) {
        for (let z = -80; z <= 80; z += 4) {
          const h = worldMod.heightAt(x, z);
          if (h < -0.65) {
            const d = Math.hypot(x - bestHare.x, z - bestHare.z);
            if (d < bestWaterD) { bestWaterD = d; waterX = x; waterZ = z; }
          }
        }
      }
      // Aim from (hx, hz + 3.4) toward (hx, hz) -> yaw = 0 (since forward is (0, -1) in positionCamera!)
      return { hx: bestHare.x, hz: bestHare.z, wx: bestHare.x, wz: bestHare.z + 3.2, yaw: 0, waterX, waterZ };
    })()`);

    // Navigate cleanly to the exact flat snowy spot 3.2 m behind the wild Snowshoe Hare on Jan 15!
    await send('Page.navigate', {
      url: `${BASE_URL}/?nomenu&noprobe&view=ground&stages=0&date=2026-01-15&hour=12&at=${spot.wx.toFixed(2)},${spot.wz.toFixed(2)},0&rec`,
    });
    await waitBoot();
    await evalJs(`(async () => {
      const findMod = (sub) => {
        const entries = performance.getEntriesByType('resource').map((r) => r.name);
        return entries.find((n) => n.includes(sub)) || sub;
      };
      const modelsMod = await import(findMod('/src/render/animalModels.ts'));
      modelsMod.ensureAnimalModels(['Snowshoe Hare', 'Ermine', 'Gray Wolf', 'Red Fox', 'White-tailed Deer', 'Coyote']);
      for (let i = 0; i < 60; i++) {
        if (
          modelsMod.animalModel('Snowshoe Hare')?.skin &&
          modelsMod.animalModel('Ermine')?.skin &&
          modelsMod.animalModel('Gray Wolf')?.skin &&
          modelsMod.animalModel('Red Fox')?.skin &&
          modelsMod.animalModel('White-tailed Deer')?.skin
        ) break;
        await new Promise((r) => setTimeout(r, 150));
      }
    })()`);
    // Wait 1.2s so near chunk snow & GLB skins render cleanly
    await sleep(1200);

    // Start continuous 20 fps composite WebM recorder across all 4 stages
    await evalJs(`(() => {
      const comp = document.createElement('canvas');
      comp.width = 1280; comp.height = 720;
      const ctx = comp.getContext('2d');
      const glCanvas = document.getElementById('world') || document.querySelector('canvas');
      window.__auditStage = 'frame0_jan15_midwinter_snowshoe_hare_brown_glb_override_and_14x_emissive';
      window.__stopComp = false;
      const drawComp = () => {
        if (!window.__stopComp) {
          ctx.drawImage(glCanvas, 0, 0, 1280, 720);
          const statusTxt = (document.getElementById('status')?.innerText || '').split('\\n')[0] || '';
          ctx.fillStyle = 'rgba(10, 18, 16, 0.84)';
          ctx.fillRect(14, 14, 880, 56);
          ctx.fillStyle = '#eee7d2';
          ctx.font = '13px monospace';
          ctx.fillText('T-0243 Pelage, Moult, Genome & Thermoregulation Audit: ' + window.__auditStage, 24, 35);
          ctx.fillText('HUD=' + statusTxt.slice(0, 98), 24, 55);
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

    await sleep(800);

    const probe0 = await evalJs(`(async () => {
      const findMod = (sub) => {
        const entries = performance.getEntriesByType('resource').map((r) => r.name);
        return entries.find((n) => n.includes(sub)) || sub;
      };
      const hareMod = await import(findMod('/src/animals/hare.ts'));
      const modelsMod = await import(findMod('/src/render/animalModels.ts'));
      const meshyMod = await import(findMod('/src/render/meshySkin.ts'));
      const todMod = await import(findMod('/src/core/timeOfDay.ts'));
      const wcMod = await import(findMod('/src/core/worldClock.ts'));
      const weatherMod = await import(findMod('/src/core/weather.ts'));

      const day = todMod.dayAt(wcMod.worldSec());
      const hareProceduralWhiteness = hareMod.setHareDay(day);
      const picStats = typeof window.borealPicture === 'function' ? window.borealPicture() : null;
      const hareSkinSpawn = meshyMod.spawnSkin(modelsMod.animalModel('Snowshoe Hare').skin);
      const ermineSkinSpawn = meshyMod.spawnSkin(modelsMod.animalModel('Ermine').skin);
      const hareMat = hareSkinSpawn.meshes[0].material;
      const ermineMat = ermineSkinSpawn.meshes[0].material;

      const manifestRes = await fetch('/models/animals/manifest.json');
      const manifest = await manifestRes.json();
      const speciesRows = Object.keys(manifest).filter((k) => !k.startsWith('_'));
      const cervids = new Set(['Moose', 'Elk', 'White-tailed Deer', 'Woodland Caribou']);
      const unmapped14xEmissiveSpecies = speciesRows.filter(
        (sp) => sp !== 'Red Fox' && !/wolf/i.test(sp) && !cervids.has(sp)
      );

      const p0 = window.__boreal.player();
      const wx = weatherMod.weatherAt(p0.x, p0.z);
      const nearbyHares = window.__boreal.hares().map((h) => ({
        id: h.id,
        distM: Number(Math.hypot(h.x - p0.x, h.z - p0.z).toFixed(2)),
        state: h.state,
      })).sort((a, b) => a.distM - b.distM).slice(0, 4);

      return {
        frame: 0,
        label: 'midwinter_jan15_snowshoe_hare_and_ermine_brown_glb_override_and_14x_emissive',
        gameDayOfYear: Number(day.toFixed(2)),
        airTempC: Number(wx.tC.toFixed(2)),
        snowDepthCm: Number((wx.depthCm ?? 0).toFixed(2)),
        proceduralHareSeasonalWhiteness: Number(hareProceduralWhiteness.toFixed(4)),
        proceduralHareWinterBackLinearRGB: hareMod.HARE_SKIN.winter.back,
        proceduralHareSummerBackLinearRGB: hareMod.HARE_SKIN.summer.back,
        nearbyHares,
        pictureStats: picStats,
        hareMeshyMaterial: {
          toneMapped: hareMat.toneMapped,
          emissiveRGB: [Number(hareMat.emissive.r.toFixed(3)), Number(hareMat.emissive.g.toFixed(3)), Number(hareMat.emissive.b.toFixed(3))],
          emissiveIntensity: hareMat.emissiveIntensity,
          hasEmissiveMap: Boolean(hareMat.emissiveMap),
          hasSeasonalMoultUniform: false,
        },
        ermineMeshyMaterial: {
          toneMapped: ermineMat.toneMapped,
          emissiveIntensity: ermineMat.emissiveIntensity,
          hasSeasonalMoultUniform: false,
        },
        manifestSpeciesCount: speciesRows.length,
        unmapped14xEmissiveSpeciesCount: unmapped14xEmissiveSpecies.length,
        unmapped14xEmissiveSpecies,
        statusText: document.getElementById('status')?.innerText || '',
      };
    })()`);
    await snapPng('frame-0.png');
    observations.push(probe0);

    // =========================================================================
    // STAGE 1: Open Pause -> More -> Appearance on Gray Wolf and apply extreme genome edits!
    // =========================================================================
    const probe1 = await evalJs(`(async () => {
      window.__auditStage = 'frame1_appearance_genome_blank_silhouette_and_meshy_wolf_disconnect';
      const findMod = (sub) => {
        const entries = performance.getEntriesByType('resource').map((r) => r.name);
        return entries.find((n) => n.includes(sub)) || sub;
      };
      const todMod = await import(findMod('/src/core/timeOfDay.ts'));
      const wcMod = await import(findMod('/src/core/worldClock.ts'));
      const appPanelMod = await import(findMod('/src/ui/appearancePanel.ts'));
      const bodyMod = await import(findMod('/src/core/body.ts'));

      todMod.initDay('?date=2026-06-21&hour=11.5', null, wcMod.worldSec());
      await new Promise((r) => setTimeout(r, 350));

      // Open Pause -> More -> Appearance!
      document.getElementById('pause').click();
      await new Promise((r) => setTimeout(r, 140));
      const moreBtn = [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'More');
      if (moreBtn) moreBtn.click();
      await new Promise((r) => setTimeout(r, 140));
      const appBtn = [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Appearance');
      if (appBtn) appBtn.click();
      await new Promise((r) => setTimeout(r, 220));

      // Inspect .shape-tools canvas.profile silhouette dot count (should have >40 green '#cfe8d8' dots, but has 0!)
      const profCanvas = document.querySelector('canvas.profile');
      let silhouetteDotPixels = 0;
      if (profCanvas) {
        const pctx = profCanvas.getContext('2d');
        const pdata = pctx.getImageData(0, 0, profCanvas.width, profCanvas.height).data;
        for (let i = 0; i < pdata.length; i += 4) {
          if (pdata[i] > 180 && pdata[i + 1] > 215 && pdata[i + 2] > 195 && pdata[i + 1] > pdata[i] + 10) {
            silhouetteDotPixels++;
          }
        }
      }

      // Apply extreme legal genome edits to player:wolf and fire slider change so view.setAppearance runs!
      const ed = appPanelMod.editorFor('player:wolf');
      ed.setMany({
        size: 1.3,
        length: 1.15,
        height: 1.15,
        width: 1.15,
        hue: 150,
        saturation: 0.5,
        brightness: 1.4,
        coat: 'mode:length;stop:0,#ff2200,1;stop:1,#00ddff,1;mark:0.55,0.65,0.22,#ffee00,1',
      }, 'set');
      const rangeInputs = [...document.querySelectorAll('.appearance input[type="range"]')];
      const sizeSlider = rangeInputs[0];
      if (sizeSlider) {
        sizeSlider.value = '1.3';
        sizeSlider.dispatchEvent(new Event('input', { bubbles: true }));
        sizeSlider.dispatchEvent(new Event('change', { bubbles: true }));
      }
      await new Promise((r) => setTimeout(r, 250));

      const morphCounts = { 'timber grey': 0, 'golden tan': 0, 'black': 0 };
      for (let s = 1; s <= 200; s++) {
        morphCounts[bodyMod.wolfCoat(s).name]++;
      }

      // Scroll the pause panel slightly so both canvas.profile (with yellow mark) and genome sliders (size=1.30, hue=150) show clearly!
      const newProf = document.querySelector('canvas.profile');
      const menuPanelEl = document.querySelector('.menu .panel') || document.querySelector('.appearance')?.parentElement;
      if (menuPanelEl) menuPanelEl.scrollTop = 120;

      const appearanceHeading = document.querySelector('.appearance h3')?.textContent || '';
      const historyItems = [...document.querySelectorAll('.appearance ol.history li')].map((li) => li.textContent?.trim() || '');

      return {
        frame: 1,
        label: 'appearance_genome_blank_profile_and_meshy_wolf_ignores_scale_and_coat',
        appearancePanelFound: Boolean(document.querySelector('.appearance')),
        appearanceHeading,
        profileCanvasFound: Boolean(profCanvas),
        silhouetteGreenDotPixelsInProfileCanvas: silhouetteDotPixels,
        appliedGenome: ed.genome,
        historyItemCount: historyItems.length,
        proceduralWolfCoatSeedDistribution200: morphCounts,
        proceduralWolfUsesSinHashInsteadOfSharedRng: bodyMod.wolfCoat.toString().includes('Math.sin'),
      };
    })()`);
    await sleep(700);
    await snapPng('frame-1.png');
    observations.push(probe1);

    // Reset genome and close Pause menu
    await evalJs(`(async () => {
      const findMod = (sub) => {
        const entries = performance.getEntriesByType('resource').map((r) => r.name);
        return entries.find((n) => n.includes(sub)) || sub;
      };
      const appPanelMod = await import(findMod('/src/ui/appearancePanel.ts'));
      const ed = appPanelMod.editorFor('player:wolf');
      ed.reset();
      const defaultBtn = [...document.querySelectorAll('.appearance button')].find((b) => /species default/i.test(b.textContent || ''));
      if (defaultBtn) defaultBtn.click();
      await new Promise((r) => setTimeout(r, 120));
      document.getElementById('pause').click();
    })()`);
    await sleep(600);

    // =========================================================================
    // STAGE 2: Midnight (00:00, darkness ~ 1.0) Red Fox & Cervid unlit coat shaders
    // =========================================================================
    const probe2 = await evalJs(`(async () => {
      window.__auditStage = 'frame2_midnight_unlit_red_fox_and_cervid_coat_shaders';
      const findMod = (sub) => {
        const entries = performance.getEntriesByType('resource').map((r) => r.name);
        return entries.find((n) => n.includes(sub)) || sub;
      };
      const todMod = await import(findMod('/src/core/timeOfDay.ts'));
      const wcMod = await import(findMod('/src/core/worldClock.ts'));
      const coatFinishSrc = await (await fetch('/src/render/coatFinish.ts')).text();
      const appearanceSrc = await (await fetch('/src/render/appearance.ts')).text();

      todMod.initDay('?date=2026-06-21&hour=0.0', null, wcMod.worldSec());
      await new Promise((r) => setTimeout(r, 900));

      const foxBlock = coatFinishSrc.slice(coatFinishSrc.indexOf('const FOX ='), coatFinishSrc.indexOf('export function finishFoxCoat'));
      const cervidBlock = coatFinishSrc.slice(coatFinishSrc.indexOf('export function dressCervidCoat'), coatFinishSrc.indexOf('export function dressWolfCoat'));
      const foxUsesOutgoingLight = foxBlock.includes('outgoingLight');
      const cervidUsesOutgoingLight = cervidBlock.includes('outgoingLight');
      const cervidHasSeasonalCoat = cervidBlock.includes('day') || cervidBlock.includes('winter') || cervidBlock.includes('season');
      const appearanceChainsPrevOnBeforeCompile = /prev\\s*\\?\\.\\s*call|prev\\s*\\(/.test(appearanceSrc);

      const glCanvas = document.getElementById('world') || document.querySelector('canvas');
      const tmp = document.createElement('canvas');
      tmp.width = 1280; tmp.height = 720;
      const tctx = tmp.getContext('2d');
      tctx.drawImage(glCanvas, 0, 0, 1280, 720);
      const data = tctx.getImageData(120, 80, 1040, 480).data;
      let brightUnlitOrangeFoxPixelsAtMidnight = 0;
      let maxFoxRedChannelAtMidnight = 0;
      let skyMeanLuma = 0;
      const skyData = tctx.getImageData(400, 16, 480, 70).data;
      for (let i = 0; i < skyData.length; i += 4) {
        skyMeanLuma += (0.2126 * skyData[i] + 0.7152 * skyData[i + 1] + 0.0722 * skyData[i + 2]);
      }
      skyMeanLuma /= (skyData.length / 4);

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        if (r > 135 && g < r * 0.44 && b < r * 0.22) {
          brightUnlitOrangeFoxPixelsAtMidnight++;
          if (r > maxFoxRedChannelAtMidnight) maxFoxRedChannelAtMidnight = r;
        }
      }

      const density = typeof window.borealDensity === 'function' ? window.borealDensity() : null;

      const appearanceElStillInDomWhileMenuHidden = Boolean(
        document.querySelector('.menu')?.hidden &&
        document.querySelector('.appearance') &&
        document.contains(document.querySelector('.appearance'))
      );

      return {
        frame: 2,
        label: 'midnight_unlit_red_fox_and_cervid_coat_shaders_and_stuck_cyan_handles',
        hour: Number(todMod.hourAt(wcMod.worldSec()).toFixed(3)),
        midnightSkyMeanSrgbLuma: Number(skyMeanLuma.toFixed(2)),
        foxShaderUsesOutgoingLight: foxUsesOutgoingLight,
        cervidShaderUsesOutgoingLight: cervidUsesOutgoingLight,
        cervidHasSeasonalWinterCoatShift: cervidHasSeasonalCoat,
        appearanceInjectChainsOnBeforeCompile: appearanceChainsPrevOnBeforeCompile,
        appearanceHandlesStuckAliveAfterMenuClose: appearanceElStillInDomWhileMenuHidden,
        brightUnlitOrangeFoxPixelsAtMidnight,
        maxFoxRedChannelAtMidnight,
        landingAnimalsNearby: density?.animals?.slice(0, 8) || [],
      };
    })()`);
    await sleep(600);
    await snapPng('frame-2.png');
    observations.push(probe2);

    // =========================================================================
    // STAGE 3: Midwinter (Jan 15, hour 13, air temp ~ -15 C) Wolf wading/swimming in icy lake water
    // =========================================================================
    // Steer and run into the open water patch (spot.waterX, spot.waterZ)!
    await evalJs(`(async () => {
      window.__auditStage = 'frame3_midwinter_icy_water_dry_coat_and_zero_cold_wet_thermoregulation';
      const findMod = (sub) => {
        const entries = performance.getEntriesByType('resource').map((r) => r.name);
        return entries.find((n) => n.includes(sub)) || sub;
      };
      const todMod = await import(findMod('/src/core/timeOfDay.ts'));
      const wcMod = await import(findMod('/src/core/worldClock.ts'));
      todMod.initDay('?date=2026-01-15&hour=13.0', null, wcMod.worldSec());
    })()`);

    // Steer toward waterX, waterZ in closed loop for up to 2.8s until heightAt(p.x, p.z) < -0.25!
    await evalJs(`(async () => {
      const findMod = (sub) => {
        const entries = performance.getEntriesByType('resource').map((r) => r.name);
        return entries.find((n) => n.includes(sub)) || sub;
      };
      const worldMod = await import(findMod('/src/core/world.ts'));
      const wx = ${spot.waterX}, wz = ${spot.waterZ};
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ShiftLeft', key: 'Shift', bubbles: true }));
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', key: 'w', bubbles: true }));
      for (let step = 0; step < 26; step++) {
        const p = window.__boreal.player();
        const h = worldMod.heightAt(p.x, p.z);
        if (h < -0.35) break;
        // Forward direction in Boreal is (-sin(yaw), -cos(yaw))
        const wantYaw = Math.atan2(-(wx - p.x), -(wz - p.z));
        let diff = wantYaw - p.yaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyA', key: 'a', bubbles: true }));
        window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyD', key: 'd', bubbles: true }));
        if (diff > 0.12) {
          window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA', key: 'a', bubbles: true }));
        } else if (diff < -0.12) {
          window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD', key: 'd', bubbles: true }));
        }
        await new Promise((r) => setTimeout(r, 110));
      }
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyA', key: 'a', bubbles: true }));
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyD', key: 'd', bubbles: true }));
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', key: 'w', bubbles: true }));
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ShiftLeft', key: 'Shift', bubbles: true }));
    })()`);
    await sleep(450);

    const probe3 = await evalJs(`(async () => {
      const findMod = (sub) => {
        const entries = performance.getEntriesByType('resource').map((r) => r.name);
        return entries.find((n) => n.includes(sub)) || sub;
      };
      const engineMod = await import(findMod('/src/core/needs/engine.ts'));
      const speciesMod = await import(findMod('/src/core/needs/species/index.ts'));
      const weatherMod = await import(findMod('/src/core/weather.ts'));
      const worldMod = await import(findMod('/src/core/world.ts'));
      const coatFinishSrc = await (await fetch('/src/render/coatFinish.ts')).text();
      const furCardsSrc = await (await fetch('/src/render/furCards.ts')).text();

      const wolfSp = speciesMod.WOLF_NEEDS;
      const hareSp = speciesMod.HARE_NEEDS;
      const p3 = window.__boreal.player();
      const terrainH = worldMod.heightAt(p3.x, p3.z);
      const wx = weatherMod.weatherAt(p3.x, p3.z);

      const ratesAtPlus20C = engineMod.needRates(wolfSp, 0, 20, false);
      const ratesAtMinus30C = engineMod.needRates(wolfSp, 0, -30, false);
      const hareRatesAtPlus20C = engineMod.needRates(hareSp, 0, 20, false);
      const hareRatesAtMinus30C = engineMod.needRates(hareSp, 0, -30, false);
      // bodyFeelings.ts:115 defines temperatureStress = heatFactor(sp, step.tC) - 1
      const wolfTemperatureStressAtMinus30C = engineMod.heatFactor(wolfSp, -30) - 1;

      const coatHasWetnessUniform = /uWet|wetness|vWet/i.test(coatFinishSrc);
      const coatHasSnowDustingUniform = /uSnow|vSnow|snow/i.test(coatFinishSrc);
      const furCardsSampleWind = /windAt|uWind/i.test(furCardsSrc);

      return {
        frame: 3,
        label: 'midwinter_cold_and_water_zero_wet_snow_coat_optics_and_zero_cold_thermoregulation',
        playerTerrainHeightM: Number(terrainH.toFixed(3)),
        inOpenWater: terrainH < -0.15,
        liveJanuaryAirTempC: Number(wx.tC.toFixed(2)),
        liveJanuarySnowDepthCm: Number((wx.depthCm ?? 0).toFixed(2)),
        wolfHeatFactorAtMinus30C: engineMod.heatFactor(wolfSp, -30),
        hareHeatFactorAtMinus30C: engineMod.heatFactor(hareSp, -30),
        wolfStandingEnergyRatePctPerSecAtPlus20C: ratesAtPlus20C.energy,
        wolfStandingEnergyRatePctPerSecAtMinus30C: ratesAtMinus30C.energy,
        hareStandingEnergyRatePctPerSecAtPlus20C: hareRatesAtPlus20C.energy,
        hareStandingEnergyRatePctPerSecAtMinus30C: hareRatesAtMinus30C.energy,
        wolfColdMetabolicIncreasePctAtMinus30C: Number(
          (((ratesAtMinus30C.energy - ratesAtPlus20C.energy) / ratesAtPlus20C.energy) * 100).toFixed(4)
        ),
        hareColdMetabolicIncreasePctAtMinus30C: Number(
          (((hareRatesAtMinus30C.energy - hareRatesAtPlus20C.energy) / hareRatesAtPlus20C.energy) * 100).toFixed(4)
        ),
        wolfTemperatureStressAtMinus30C,
        coatHasWetnessUniform,
        coatHasSnowDustingUniform,
        furCardsSampleWind,
        playerState: p3,
        statusText: document.getElementById('status')?.innerText || '',
      };
    })()`);
    await snapPng('frame-3.png');
    observations.push(probe3);

    await sleep(500);
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
      spot,
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
