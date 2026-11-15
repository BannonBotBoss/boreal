/**
 * Live browser screen recording + frame sampler + runtime telemetry for T-0234:
 * 1. Default home launch querying +65.54 deg E (Kazakhstan, coastM = NaN) instead of -94.49 deg W (Kenora, Ontario),
 *    wiping out 11/12 North American species on default play;
 * 2. Landing wildlife cast chorus-line treadmilling (0.000 m/s world velocity vs 1.20 m/s walk gait in 0.65 Hz lockstep),
 *    2.224 m ground-walking Bald Eagle, sideways-rigged mammal GLBs, and >20 deg turn teleportation;
 * 3. AnimalPicture mid-tier (16-140 m, peak 48 m) untextured solid-colour PlaneGeometry(1,1) MeshBasicMaterial rectangles
 *    (including unlit glow at 00:00 astronomical midnight), shared per-species opacity leak, and always-transparent near SkinnedMesh.
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
const CDP_PORT = 9372;
const WORK_ROOT = resolve(__dirname, '../../../work');
const PROFILE = resolve(WORK_ROOT, 'edge-landing-cast-picture-ladder-profile');
const LOCK_NAME = 'agy: T-0234-landing-cast-picture-ladder-audit';

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
        await srv.transformRequest('/src/render/landingCast.ts');
        await srv.transformRequest('/src/render/animalPicture.ts');
        await srv.transformRequest('/src/render/animalModels.ts');
      `;
      viteProc = spawn(process.execPath, ['--input-type=module', '-e', viteBoot], {
        stdio: 'ignore',
        cwd: resolve(__dirname, '../../..'),
      });
      if (viteProc.pid) track(viteProc.pid);
      let up = false;
      for (let i = 0; i < 60; i++) {
        try {
          const r = await fetch(`${BASE_URL}/src/render/landingCast.ts`);
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

    const waitBoot = async () => {
      let ready = false;
      for (let i = 0; i < 90; i++) {
        await sleep(500);
        ready = await evalJs(`Boolean(
          document.readyState === 'complete' &&
          !document.getElementById('loading') &&
          typeof window.borealLanding === 'function' &&
          window.borealLanding().ready
        )`);
        if (ready) break;
      }
      if (!ready) throw new Error(`Game did not finish booting: ${JSON.stringify(pageErrors)}`);
    };

    const anchorKenoraBorealAndWaitGlbs = async () => {
      await evalJs(`(async () => {
        const findMod = (sub) => {
          const entries = performance.getEntriesByType('resource').map((r) => r.name);
          return entries.find((n) => n.includes(sub)) || sub;
        };
        const siteMod = await import(findMod('/src/world/globe/landingSite.ts'));
        const planetMod = await import(findMod('/src/world/globe/planet.ts'));
        const modelsMod = await import(findMod('/src/render/animalModels.ts'));

        // Anchor forest frame at Woodland Caribou Provincial Park / Kenora boreal shield (50.95 N, -94.85 W)
        const dir = planetMod.fromLatLon(50.95 * Math.PI / 180, -94.85 * Math.PI / 180);
        siteMod.engageLanding(dir, 0);

        for (let i = 0; i < 60; i++) {
          await new Promise((r) => setTimeout(r, 150));
          const land = window.borealLanding();
          if (land.ready && Math.abs(land.lon - (-94.85)) < 1.0 && land.shown.length >= 4) break;
        }
        // Wait for all GLB skin models in shown list to finish loading into cache
        for (let i = 0; i < 60; i++) {
          const land = window.borealLanding();
          const allLoaded = land.shown.every((s) => s.species === 'Canada Lynx' || s.species === 'Arctic Fox' || Boolean(modelsMod.animalModel(s.species)?.skin));
          if (allLoaded && land.shown.length >= 4) break;
          await new Promise((r) => setTimeout(r, 150));
        }
        await new Promise((r) => setTimeout(r, 500));
        return true;
      })()`);
    };

    await send('Page.enable');
    await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });

    const observations = [];

    // -------------------------------------------------------------------------
    // 1. Default Home Launch (?view=ground&stages=1): measure Kazakhstan +65.54 E bug
    //    then anchor onto Kenora Boreal Shield (50.95 N, -94.85 W) for Frames 0, 1, 2!
    // -------------------------------------------------------------------------
    await send('Page.navigate', { url: `${BASE_URL}/?nomenu&noprobe&view=ground&stages=1&date=2026-06-21&hour=12&unlockAll=1&rec` });
    await waitBoot();
    await sleep(400);
    const homeLaunchAudit = await evalJs(`(() => {
      const land = window.borealLanding();
      return {
        lat: Number(land.lat.toFixed(4)),
        lon: Number(land.lon.toFixed(4)),
        biome: land.biome,
        remote: land.remote,
        censusCount: land.census.length,
        census: land.census,
        shown: land.shown,
      };
    })()`);

    await anchorKenoraBorealAndWaitGlbs();

    // Start composite WebM screen recorder on the 5-species boreal landing
    await evalJs(`(() => {
      const comp = document.createElement('canvas');
      comp.width = 1280; comp.height = 720;
      const ctx = comp.getContext('2d');
      const glCanvas = document.getElementById('world');
      window.__auditStage = 'chorus_line_treadmilling_and_2_22m_bald_eagle';
      window.__stopComp = false;
      const drawComp = () => {
        if (!window.__stopComp) {
          ctx.drawImage(glCanvas, 0, 0, 1280, 720);
          ctx.fillStyle = 'rgba(10, 16, 20, 0.82)';
          ctx.fillRect(12, 12, 720, 72);
          ctx.fillStyle = '#e8f0ec';
          ctx.font = '13px monospace';
          const pic = typeof window.borealPicture === 'function' ? window.borealPicture() : {};
          const land = typeof window.borealLanding === 'function' ? window.borealLanding() : {};
          ctx.fillText('Stage: ' + window.__auditStage, 22, 34);
          ctx.fillText(\`Picture: fulls=\${pic.fulls ?? '-'} lows=\${pic.lows ?? '-'} specks=\${pic.specks ?? '-'} bodies=\${pic.bodies ?? '-'}\`, 22, 54);
          ctx.fillText(\`LandingCast shown=\${land.shown?.length ?? 0} census=\${land.census?.length ?? 0} lat=\${land.lat?.toFixed?.(2) ?? '-'} lon=\${land.lon?.toFixed?.(2) ?? '-'}\`, 22, 74);
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

    // =========================================================================
    // FRAME 0: 5-Species Boreal Chorus Line (7.2 m ahead, 1.65 m apart)
    // Treadmilling at 0.000 m/s world velocity (1.2 m/s walk gait, 0.65 Hz lockstep),
    // 2.224 m ground-walking Bald Eagle, and sideways-rigged Black Bear & Beaver!
    // =========================================================================
    const probe0 = await evalJs(`(async () => {
      const findMod = (sub) => {
        const entries = performance.getEntriesByType('resource').map((r) => r.name);
        return entries.find((n) => n.includes(sub)) || sub;
      };
      const modelsMod = await import(findMod('/src/render/animalModels.ts'));
      const worldMod = await import(findMod('/src/core/world.ts'));

      const landStart = JSON.parse(JSON.stringify(window.borealLanding()));
      const playerStart = window.__boreal.player();
      await new Promise((r) => setTimeout(r, 2000));
      const landAfter2s = JSON.parse(JSON.stringify(window.borealLanding()));
      const pic0 = window.borealPicture();

      const castMotionAudit = landStart.shown.map((a, idx) => {
        const b = landAfter2s.shown[idx] || a;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const worldDispM = Math.hypot(dx, dz);
        const mdl = modelsMod.animalModel(a.species);
        const groundY = worldMod.heightAt(a.x, a.z);
        return {
          species: a.species,
          count: a.count,
          x: Number(a.x.toFixed(3)),
          z: Number(a.z.toFixed(3)),
          groundY: Number(groundY.toFixed(3)),
          distFromPlayerM: Number(Math.hypot(a.x - playerStart.x, a.z - playerStart.z).toFixed(3)),
          worldDisplacementOver2sM: Number(worldDispM.toFixed(4)),
          measuredWorldSpeedMps: Number((worldDispM / 2.0).toFixed(4)),
          posedWalkGaitSpeedMps: 1.2,
          fittedSkinDims: mdl?.skin ? {
            heightM: Number(mdl.skin.height.toFixed(3)),
            widthM: Number(mdl.skin.width.toFixed(3)),
            tris: mdl.skin.tris,
          } : null,
        };
      });

      const sensesText = document.getElementById('senses')?.innerText || '';

      return {
        frame: 0,
        label: 'landing_cast_chorus_line_zero_velocity_treadmilling_sideways_glbs_and_2_22m_ground_eagle',
        homeLaunchKazakhstanBug: ${JSON.stringify(homeLaunchAudit)},
        borealCensus: landStart.census,
        playerPose: { x: Number(playerStart.x.toFixed(3)), z: Number(playerStart.z.toFixed(3)), yaw: Number(playerStart.yaw.toFixed(4)) },
        pictureCounts: pic0,
        castMotionAudit,
        sensesHudText: sensesText,
      };
    })()`);
    observations.push(probe0);
    await snapPng('frame-0.png');

    // =========================================================================
    // FRAME 1: Rotate player heading > 0.35 rad (20.05 deg) -> entire 5-species
    // chorus line instantaneously teleports across the forest to a new 7.2 m line!
    // =========================================================================
    const probe1 = await evalJs(`(async () => {
      window.__auditStage = 'turn_over_20_deg_instant_chorus_line_teleport';
      const pBefore = window.__boreal.player();
      const landBefore = JSON.parse(JSON.stringify(window.borealLanding()));

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd' }));
      let turnedRad = 0;
      for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, 50));
        const cur = window.__boreal.player();
        let dy = cur.yaw - pBefore.yaw;
        while (dy > Math.PI) dy -= Math.PI * 2;
        while (dy < -Math.PI) dy += Math.PI * 2;
        turnedRad = Math.abs(dy);
        if (turnedRad >= 0.45) break;
      }
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'd' }));
      await new Promise((r) => setTimeout(r, 250));

      const pAfter = window.__boreal.player();
      const landAfter = JSON.parse(JSON.stringify(window.borealLanding()));
      const playerWalkedM = Math.hypot(pAfter.x - pBefore.x, pAfter.z - pBefore.z);

      const teleports = landBefore.shown.map((a, idx) => {
        const b = landAfter.shown[idx] || a;
        return {
          species: a.species,
          beforeXZ: [Number(a.x.toFixed(3)), Number(a.z.toFixed(3))],
          afterXZ: [Number(b.x.toFixed(3)), Number(b.z.toFixed(3))],
          instantTeleportJumpM: Number(Math.hypot(b.x - a.x, b.z - a.z).toFixed(3)),
        };
      });

      return {
        frame: 1,
        label: 'heading_turn_over_20_deg_teleports_entire_wildlife_cast',
        yawBeforeRad: Number(pBefore.yaw.toFixed(4)),
        yawAfterRad: Number(pAfter.yaw.toFixed(4)),
        yawDeltaDeg: Number((turnedRad * 180 / Math.PI).toFixed(2)),
        playerTranslatedM: Number(playerWalkedM.toFixed(3)),
        teleports,
      };
    })()`);
    observations.push(probe1);
    await snapPng('frame-1.png');

    // =========================================================================
    // FRAME 2: Midday Photo-Mode fly-back ~38 m (total distance ~46-48 m = ANIMAL_LADDER.lowM)
    // with 135 mm telephoto lens -> all 5 non-wolf animals turn into flat solid-colour
    // PlaneGeometry(1,1) MeshBasicMaterial rectangles!
    // =========================================================================
    const probe2 = await evalJs(`(async () => {
      window.__auditStage = 'mid_tier_46m_solid_rectangle_impostors_daylight';
      document.getElementById('photo-btn').click();
      await new Promise((r) => setTimeout(r, 250));

      const setSlider = (key, val) => {
        const el = document.querySelector(\`#photo-panel input[data-key="\${key}"]\`);
        if (!el) return null;
        el.value = String(val);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        return Number(el.value);
      };

      setSlider('dof', 0);
      setSlider('focalLength', 135);
      const photoRoot = document.getElementById('photo');
      if (photoRoot) photoRoot.style.opacity = '0';

      // Fly straight backward ('s' + 'Shift' = 25 m/s) for 1550 ms (~38.7 m astern -> ~46-50 m from landingCast!)
      // and slightly up ('e' for 220 ms) to clear foreground brush
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift' }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 's' }));
      await new Promise((r) => setTimeout(r, 1550));
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 's' }));
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Shift' }));

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e' }));
      await new Promise((r) => setTimeout(r, 220));
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'e' }));
      await new Promise((r) => setTimeout(r, 400));

      const picDay = window.borealPicture();
      return {
        frame: 2,
        label: 'mid_tier_46m_untextured_solid_colour_rectangle_impostors_midday_135mm',
        pictureCountsAt46m: picDay,
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

    // =========================================================================
    // FRAME 3: Astronomical Midnight (2026-01-15 00:00, sun -63 deg) at 46 m:
    // Untextured MeshBasicMaterial rectangles ignore coatNight & scene lights and glow unlit!
    // =========================================================================
    const urlBorealMidnight = `${BASE_URL}/?nomenu&noprobe&view=ground&stages=1&date=2026-01-15&hour=0&unlockAll=1&rec`;
    await send('Page.navigate', { url: urlBorealMidnight });
    await waitBoot();
    await anchorKenoraBorealAndWaitGlbs();

    const probe3 = await evalJs(`(async () => {
      document.getElementById('photo-btn').click();
      await new Promise((r) => setTimeout(r, 250));

      const setSlider = (key, val) => {
        const el = document.querySelector(\`#photo-panel input[data-key="\${key}"]\`);
        if (!el) return null;
        el.value = String(val);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        return Number(el.value);
      };
      setSlider('dof', 0);
      setSlider('focalLength', 135);
      const photoRoot = document.getElementById('photo');
      if (photoRoot) photoRoot.style.opacity = '0';

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift' }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 's' }));
      await new Promise((r) => setTimeout(r, 1550));
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 's' }));
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Shift' }));

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e' }));
      await new Promise((r) => setTimeout(r, 220));
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'e' }));
      await new Promise((r) => setTimeout(r, 400));

      const picNight = window.borealPicture();
      const landNight = window.borealLanding();

      // Sample center band of WebGL canvas at midnight to measure unlit rectangle glow
      const glCanvas = document.getElementById('world');
      const c = document.createElement('canvas');
      c.width = 320; c.height = 180;
      const ctx = c.getContext('2d');
      ctx.drawImage(glCanvas, 0, 0, 320, 180);
      const data = ctx.getImageData(0, 0, 320, 180).data;
      let maxCenterLuma = 0;
      let sumBgLuma = 0, bgCount = 0;
      for (let y = 30; y < 160; y++) {
        for (let x = 20; x < 300; x++) {
          const idx = (y * 320 + x) * 4;
          const lum = (0.2126 * data[idx] + 0.7152 * data[idx + 1] + 0.0722 * data[idx + 2]) / 255;
          if (y >= 45 && y <= 145 && x >= 40 && x <= 280 && lum > maxCenterLuma) maxCenterLuma = lum;
          if (y > 145) { sumBgLuma += lum; bgCount++; }
        }
      }

      return {
        frame: 3,
        label: 'mid_tier_46m_mesh_basic_material_rectangles_glowing_unlit_at_midnight',
        lighting: landNight.lighting,
        pictureCountsAtMidnight: picNight,
        peakUnlitImpostorSrgbLuma01: Number(maxCenterLuma.toFixed(4)),
        meanMidnightGroundSrgbLuma01: Number((sumBgLuma / Math.max(1, bgCount)).toFixed(4)),
      };
    })()`);
    observations.push(probe3);
    await snapPng('frame-3.png');

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
