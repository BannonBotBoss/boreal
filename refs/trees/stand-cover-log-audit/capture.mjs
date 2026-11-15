/**
 * Live browser screen recording + frame sampler + runtime telemetry for T-0237:
 * 1. Frame 0 (Kenora Staged Upland Lake/River): applyPopulation extra-spruce & farTrees standing inside open lake/river water;
 * 2. Frame 1 (Sahara Hyper-Arid Erg, 23.5 N, 12.0 E): boreal spruce/pine/birch stand, logs, bluejoint grass, & moss carpeting Sahara sand;
 * 3. Frame 2 (Greenland Continental Ice Sheet, 75.0 N, -40.0 W, ~2500 m): boreal conifers, logs, & green sedge/grass blades growing out of glacial ice;
 * 4. Frame 3 (Kenora Forest Floor Close-up): 75-95 cm coastal-giant chainsaw-cut round log at ~90 deg yaw with grass/plants growing straight through its trunk, plus narrow LOD-2 paper birch crowns & leafless snags.
 *
 * Uses agy preview port 5261 and tools/bench-lock.mjs, terminating Vite and headless Edge cleanly on exit.
 */
import { spawn, execSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquire, track, release } from '../../../tools/bench-lock.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
mkdirSync(__dirname, { recursive: true });

const PORT = 5261;
const BASE_URL = process.env.BOREAL_URL || `http://127.0.0.1:${PORT}`;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const CDP_PORT = 9375;
const WORK_ROOT = resolve(__dirname, '../../../work');
const PROFILE = resolve(WORK_ROOT, 'edge-stand-cover-log-audit-profile');
const LOCK_NAME = 'agy: T-0237-stand-cover-log-audit';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const numbers = JSON.parse(readFileSync(resolve(__dirname, 'numbers.json'), 'utf8'));
  const scenes = numbers.scenesForCapture;

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
        await srv.transformRequest('/src/core/population.ts');
        await srv.transformRequest('/src/render/flora/fartrees.ts');
      `;
      viteProc = spawn(process.execPath, ['--input-type=module', '-e', viteBoot], {
        stdio: 'ignore',
        cwd: resolve(__dirname, '../../..'),
      });
      if (viteProc.pid) track(viteProc.pid);
      let up = false;
      for (let i = 0; i < 60; i++) {
        try {
          const r = await fetch(`${BASE_URL}/src/core/population.ts`);
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
          window.__boreal &&
          window.__inpage
        )`);
        if (ready) break;
      }
      if (!ready) throw new Error(`Game did not finish booting: ${JSON.stringify(pageErrors)}`);
    };

    await send('Page.enable');
    await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });

    const wCam = scenes.frame0_kenoraWaterTrees.camera;
    const bootUrl = `${BASE_URL}/?nomenu&noprobe&view=ground&transition=inpage&stages=1&date=2026-08-15&hour=13&at=${wCam.x},${wCam.z},${wCam.yaw}&unlockAll=1&rec`;
    await send('Page.navigate', { url: bootUrl });
    await waitBoot();

    await evalJs(`(() => {
      window.__pinPose = { x: ${wCam.x}, z: ${wCam.z}, yaw: ${wCam.yaw} };
      const keepPose = () => {
        if (window.__pinPose && window.__inpage) window.__inpage.showForest(window.__pinPose);
        requestAnimationFrame(keepPose);
      };
      requestAnimationFrame(keepPose);
    })()`);

    // Wait for chunks & farTrees & grass around Frame 0 to settle
    const waitWorldJobs = async (msMin = 2600) => {
      await sleep(msMin);
      await evalJs(`(async () => {
        const findMod = (sub) => performance.getEntriesByType('resource').map((r) => r.name).find((n) => n.includes(sub)) || sub;
        const intMod = await import(findMod('/src/core/interest.ts'));
        for (let i = 0; i < 35; i++) {
          if ((intMod.STATS?.queued ?? 0) === 0) break;
          await new Promise((r) => setTimeout(r, 150));
        }
        await new Promise((r) => setTimeout(r, 350));
      })()`);
    };

    await waitWorldJobs(2800);

    // Start continuous WebM composite screen recorder across all 4 scenes
    await evalJs(`(() => {
      const comp = document.createElement('canvas');
      comp.width = 1280; comp.height = 720;
      const ctx = comp.getContext('2d');
      const glCanvas = document.getElementById('world');
      window.__auditStage = 'Frame 0: Kenora Upland Lake/River - extra-spruce & far-trees inside open water';
      window.__stopComp = false;
      const drawComp = () => {
        if (!window.__stopComp) {
          ctx.drawImage(glCanvas, 0, 0, 1280, 720);
          ctx.fillStyle = 'rgba(10, 16, 20, 0.84)';
          ctx.fillRect(12, 12, 860, 56);
          ctx.fillStyle = '#eaf2ee';
          ctx.font = '13px monospace';
          const p = window.__boreal?.player?.() || {};
          const ft = window.borealFarTrees?.info || {};
          const fl = window.borealFlora?.info || {};
          ctx.fillText(window.__auditStage, 22, 34);
          ctx.fillText(\`pos=(\${(p.x ?? 0).toFixed(1)}, \${(p.z ?? 0).toFixed(1)}) yaw=\${(p.yaw ?? 0).toFixed(2)} | farTrees=\${ft.instances ?? 0} | floraInstances=\${fl.instances ?? 0}\`, 22, 54);
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

    const observations = [];

    // =========================================================================
    // FRAME 0: Kenora Staged Upland Lake/River - standing spruce & farTrees in open water
    // =========================================================================
    await sleep(2400);
    const obs0 = await evalJs(`(async () => {
      const findMod = (sub) => performance.getEntriesByType('resource').map((r) => r.name).find((n) => n.includes(sub)) || sub;
      const coverMod = await import(findMod('/src/world/globe/coverSample.ts'));
      const p = window.__boreal.player();
      const cov = coverMod.coverSampleAt(p.x, p.z);
      return {
        frame: 0,
        scene: 'kenora_staged_upland_water_trees',
        player: { x: Number(p.x.toFixed(2)), z: Number(p.z.toFixed(2)), yaw: Number(p.yaw.toFixed(4)) },
        cover: cov,
        farTreesInstances: window.borealFarTrees?.info?.instances ?? 0,
        floraInstances: window.borealFlora?.info?.instances ?? 0,
      };
    })()`);
    observations.push(obs0);
    await snapPng('frame-0.png');

    // =========================================================================
    // FRAME 1: Hyper-Arid Subtropical Desert (BWh, biome = desert)
    // =========================================================================
    const sahScene = scenes.frame1_saharaBorealForest;
    const sahCam = sahScene.bestChunk.camera;
    await evalJs(`(async () => {
      const findMod = (sub) => performance.getEntriesByType('resource').map((r) => r.name).find((n) => n.includes(sub)) || sub;
      const siteMod = await import(findMod('/src/world/globe/landingSite.ts'));
      const sitePhaseMod = await import(findMod('/src/core/sitePhase.ts'));
      const coverKindMod = await import(findMod('/src/world/globe/coverKind.ts'));
      const planetMod = await import(findMod('/src/world/globe/planet.ts'));
      const dir = planetMod.fromLatLon(${sahScene.latDeg} * Math.PI / 180, ${sahScene.lonDeg} * Math.PI / 180);
      siteMod.engageLanding(dir, 0);
      sitePhaseMod.SITE.treeShare = coverKindMod.coverTreeShare('desert');
      window.__pinPose = { x: ${sahCam.x}, z: ${sahCam.z}, yaw: ${sahCam.yaw} };
      window.__inpage.showForest(window.__pinPose);
      window.__auditStage = 'Frame 1: Subtropical Desert (${sahScene.latDeg} deg, ${sahScene.lonDeg} deg, biome=desert) - boreal spruce, logs & grass';
    })()`);
    await waitWorldJobs(3200);
    const obs1 = await evalJs(`(async () => {
      const findMod = (sub) => performance.getEntriesByType('resource').map((r) => r.name).find((n) => n.includes(sub)) || sub;
      const coverMod = await import(findMod('/src/world/globe/coverSample.ts'));
      const sitePhaseMod = await import(findMod('/src/core/sitePhase.ts'));
      const p = window.__boreal.player();
      const cov = coverMod.coverSampleAt(p.x, p.z);
      return {
        frame: 1,
        scene: 'sahara_hyperarid_erg_boreal_forest_bug',
        latLon: [sitePhaseMod.SITE.latDeg, sitePhaseMod.SITE.lonDeg],
        siteTreeShare: sitePhaseMod.SITE.treeShare,
        player: { x: Number(p.x.toFixed(2)), z: Number(p.z.toFixed(2)), yaw: Number(p.yaw.toFixed(4)) },
        cover: cov,
        farTreesInstances: window.borealFarTrees?.info?.instances ?? 0,
        floraInstances: window.borealFlora?.info?.instances ?? 0,
      };
    })()`);
    observations.push(obs1);
    await snapPng('frame-1.png');

    // =========================================================================
    // FRAME 2: Polar Glacial Ice Sheet (EF, biome = ice)
    // =========================================================================
    const grlScene = scenes.frame2_greenlandIceForest;
    const grlCam = grlScene.bestChunk.camera;
    await evalJs(`(async () => {
      const findMod = (sub) => performance.getEntriesByType('resource').map((r) => r.name).find((n) => n.includes(sub)) || sub;
      const siteMod = await import(findMod('/src/world/globe/landingSite.ts'));
      const planetMod = await import(findMod('/src/world/globe/planet.ts'));
      const dir = planetMod.fromLatLon(${grlScene.latDeg} * Math.PI / 180, ${grlScene.lonDeg} * Math.PI / 180);
      siteMod.engageLanding(dir, 0);
      window.__pinPose = { x: ${grlCam.x}, z: ${grlCam.z}, yaw: ${grlCam.yaw} };
      window.__inpage.showForest(window.__pinPose);
      window.__auditStage = 'Frame 2: Polar Ice Sheet (${grlScene.latDeg} deg, ${grlScene.lonDeg} deg, biome=ice) - boreal spruce, logs & sedge on glacier ice';
    })()`);
    await waitWorldJobs(3200);
    const obs2 = await evalJs(`(async () => {
      const findMod = (sub) => performance.getEntriesByType('resource').map((r) => r.name).find((n) => n.includes(sub)) || sub;
      const coverMod = await import(findMod('/src/world/globe/coverSample.ts'));
      const sitePhaseMod = await import(findMod('/src/core/sitePhase.ts'));
      const p = window.__boreal.player();
      const cov = coverMod.coverSampleAt(p.x, p.z);
      return {
        frame: 2,
        scene: 'greenland_ice_sheet_boreal_spruce_and_grass_bug',
        latLon: [sitePhaseMod.SITE.latDeg, sitePhaseMod.SITE.lonDeg],
        datumM: sitePhaseMod.SITE.datumM,
        siteTreeShare: sitePhaseMod.SITE.treeShare,
        player: { x: Number(p.x.toFixed(2)), z: Number(p.z.toFixed(2)), yaw: Number(p.yaw.toFixed(4)) },
        cover: cov,
        farTreesInstances: window.borealFarTrees?.info?.instances ?? 0,
        floraInstances: window.borealFlora?.info?.instances ?? 0,
      };
    })()`);
    observations.push(obs2);
    await snapPng('frame-2.png');

    // =========================================================================
    // FRAME 3: Kenora Forest Floor Close-up - 95 cm chainsaw-cut log at ~90 deg yaw
    // with grass piercing straight through rotated trunk + narrow birch crowns
    // =========================================================================
    const logScene = scenes.frame3_rotatedGiantLog;
    const logCam = logScene.camera;
    await evalJs(`(async () => {
      const findMod = (sub) => performance.getEntriesByType('resource').map((r) => r.name).find((n) => n.includes(sub)) || sub;
      const siteMod = await import(findMod('/src/world/globe/landingSite.ts'));
      siteMod.clearLanding();
      window.__pinPose = { x: ${logCam.x}, z: ${logCam.z}, yaw: ${logCam.yaw} };
      window.__inpage.showForest(window.__pinPose);
      window.__auditStage = 'Frame 3: Kenora Floor - 0.9m chainsaw-cut round log (yaw ~90 deg) pierced by grass + narrow birch';
    })()`);
    await waitWorldJobs(3200);
    const obs3 = await evalJs(`(async () => {
      const p = window.__boreal.player();
      return {
        frame: 3,
        scene: 'kenora_rotated_giant_chainsaw_log_and_birch_crown',
        targetLog: ${JSON.stringify(logScene)},
        player: { x: Number(p.x.toFixed(2)), z: Number(p.z.toFixed(2)), yaw: Number(p.yaw.toFixed(4)) },
        farTreesInstances: window.borealFarTrees?.info?.instances ?? 0,
        floraInstances: window.borealFlora?.info?.instances ?? 0,
      };
    })()`);
    observations.push(obs3);
    await snapPng('frame-3.png');

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
