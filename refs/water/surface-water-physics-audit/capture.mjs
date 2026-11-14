/**
 * Live browser screen recording + frame sampler + runtime telemetry for T-0225
 * (surface-water decoupling across drinking, wading wakes, ground column, and animal passability).
 * Uses agy preview port 5255 and tools/bench-lock.mjs, killing Vite and headless Edge cleanly on exit.
 */
import { spawn, execSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquire, track, release } from '../../../tools/bench-lock.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
mkdirSync(__dirname, { recursive: true });

const PORT = 5255;
const BASE_URL = process.env.BOREAL_URL || `http://127.0.0.1:${PORT}`;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const CDP_PORT = 9366;
const WORK_ROOT = resolve(__dirname, '../../../work');
const PROFILE = resolve(WORK_ROOT, 'edge-water-physics-audit-profile');
const LOCK_NAME = 'agy: T-0225-water-physics-audit';

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
        await srv.transformRequest('/src/core/needs/water.ts');
        await srv.transformRequest('/src/core/waterWake.ts');
        await srv.transformRequest('/src/core/ground.ts');
      `;
      viteProc = spawn(process.execPath, ['--input-type=module', '-e', viteBoot], {
        stdio: 'ignore',
        cwd: resolve(__dirname, '../../..'),
      });
      if (viteProc.pid) track(viteProc.pid);
      let up = false;
      for (let i = 0; i < 60; i++) {
        try {
          const r = await fetch(`${BASE_URL}/src/core/needs/water.ts`);
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
      await evalJs(`(() => { if (window.__rec && window.__rec.state === 'recording') window.__rec.pause(); return true; })()`);
      await sleep(100);
      const res = await Promise.race([
        send('Page.captureScreenshot', { format: 'png' }),
        sleep(15000).then(() => { throw new Error('captureScreenshot timeout'); }),
      ]);
      writeFileSync(resolve(__dirname, outFile), Buffer.from(res.data, 'base64'));
      await evalJs(`(() => { if (window.__rec && window.__rec.state === 'paused') window.__rec.resume(); return true; })()`);
    };

    await send('Page.enable');
    await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });

    const url = `${BASE_URL}/?nomenu&noprobe&view=ground&stages=1&wake=1&rec&day=227&hour=12`;
    await send('Page.navigate', { url });
    let ready = false;
    for (let i = 0; i < 80; i++) {
      await sleep(500);
      ready = await evalJs(`Boolean(document.readyState === 'complete' && !document.getElementById('loading') && document.getElementById('status'))`);
      if (ready) break;
    }
    if (!ready) throw new Error(`Game did not finish loading: ${JSON.stringify(pageErrors)}`);
    await sleep(1500);

    await evalJs(`(async () => {
      const findMod = (sub) => {
        const entries = performance.getEntriesByType('resource').map((r) => r.name);
        return entries.find((n) => n.includes(sub)) || sub;
      };
      window.__tod = await import(findMod('/src/core/timeOfDay.ts'));
      window.__wc = await import(findMod('/src/core/worldClock.ts'));
      window.__sp = await import(findMod('/src/core/sitePhase.ts'));
      window.__cs = await import(findMod('/src/world/globe/coverSample.ts'));
      window.__sa = await import(findMod('/src/core/stages/surfaceAt.ts'));
      window.__wd = await import(findMod('/src/core/world.ts'));
      window.__nw = await import(findMod('/src/core/needs/water.ts'));
      window.__ww = await import(findMod('/src/core/waterWake.ts'));
      window.__gr = await import(findMod('/src/core/ground.ts'));
      window.__au = await import(findMod('/src/core/autonomy.ts'));
      window.__tu = await import(findMod('/src/core/tuning.ts'));
      const canvas = document.querySelector('canvas');
      const stream = canvas.captureStream(20);
      const chunks = [];
      const rec = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' });
      rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
      window.__recChunks = chunks;
      window.__rec = rec;
      rec.start(100);
      return true;
    })()`);

    const observations = [];

    // Frame 0: Standing at dry swale edge (21, -15.5) facing yaw = 0 where drawOpenWater === false,
    // HUD button offers "E / click · drink" and clicking #action triggers "DRINKING" on dry ground!
    await evalJs(`(() => {
      window.__sp.clearSite();
      const sec = window.__wc.worldSec();
      window.__tod.setDay(227, sec);
      window.__tod.setHour(12.0, sec);
      window.borealPlace?.(21, -15.5, 0, 0.16);
      return true;
    })()`);
    await sleep(1600);
    const beforeClickBtn = await evalJs(`document.getElementById('action')?.textContent || ''`);
    await evalJs(`(() => { document.getElementById('action')?.click(); return true; })()`);
    await sleep(500);
    const obs0 = await evalJs(`(() => {
      const p = window.__boreal.player();
      const aheadOpen = window.__cs.drawOpenWater(21, -16.7);
      const aheadWaterAt = window.__nw.waterAt(21, -16.7);
      const canDrink = window.__nw.waterAhead(p.x, p.z, 0);
      return {
        frame: 0,
        label: 'dry_swale_phantom_drinking_21_-15_5',
        pos: { x: Math.round(p.x * 100) / 100, z: Math.round(p.z * 100) / 100 },
        drawOpenWaterAhead: aheadOpen,
        waterAtAhead: aheadWaterAt,
        waterAheadCanDrink: canDrink,
        actionButtonBeforeClick: ${JSON.stringify(beforeClickBtn)},
        actionButtonAfterClick: document.getElementById('action')?.textContent || '',
        statusFirstLine: (document.getElementById('status')?.innerText || '').split('\\n')[0] || '',
      };
    })()`);
    observations.push(obs0);
    await snapPng('frame-0.png');

    // Frame 1: Walking across dry swale (21, -26.5 -> 21, -27.5) where drawOpenWater === false:
    // WAKES.debug() reports wet wake contact ("player") and ground.column reports 0.396 m liquid water on dry ground!
    await evalJs(`(() => {
      window.borealPlace?.(21, -25.5, 0, 0.18);
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', key: 'w', bubbles: true }));
      return true;
    })()`);
    await sleep(1400);
    await evalJs(`(() => {
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', key: 'w', bubbles: true }));
      return true;
    })()`);
    await sleep(200);
    const obs1 = await evalJs(`(() => {
      const p = window.__boreal.player();
      const wk = typeof window.wake === 'function' ? window.wake() : null;
      const col = window.__gr.column(p.x, p.z);
      const waterLayer = col.layers.find((l) => l.id === 'water');
      return {
        frame: 1,
        label: 'dry_swale_phantom_wakes_and_water_column_21_-27',
        pos: { x: Math.round(p.x * 100) / 100, z: Math.round(p.z * 100) / 100 },
        drawOpenWaterAtPos: window.__cs.drawOpenWater(p.x, p.z),
        bedHeightM: Math.round(window.__wd.heightAt(p.x, p.z) * 1000) / 1000,
        wakeOwnedWetContacts: wk?.owned ?? [],
        activeWakeSlots: wk?.wakes?.length ?? 0,
        activePawRings: wk?.rings?.length ?? 0,
        groundWaterLayerThicknessM: waterLayer ? Math.round(waterLayer.thickness * 1000) / 1000 : 0,
        wolfGroundPassable: window.__au.wolfGround(p)(p.x, p.z),
        statusFirstLine: (document.getElementById('status')?.innerText || '').split('\\n')[0] || '',
      };
    })()`);
    observations.push(obs1);
    await snapPng('frame-1.png');

    // Frame 2: Perched 3.06 ha boreal lake shore (-1192, -980) looking across (-1230, -920) (surface = 17.631 m, depth = 2.364 m):
    // Ground column at (-1230, -920) has 0 m water layer (and in winter day=15 has submerged snowpack!), and wolf/deer/hare walkability are all true 2.36 m underwater!
    await evalJs(`(() => {
      const sec = window.__wc.worldSec();
      window.__tod.setDay(15, sec);
      window.__tod.setHour(11.5, sec);
      window.borealPlace?.(-1192, -980, -2.15, 0.14);
      return true;
    })()`);
    await sleep(1800);
    const obs2 = await evalJs(`(() => {
      const lx = -1230, lz = -920;
      const surf = window.__sa.surfaceAt(lx, lz, window.__wd.WORLD_SEED);
      const bedH = window.__wd.heightAt(lx, lz);
      const col = window.__gr.column(lx, lz);
      const waterLayer = col.layers.find((l) => l.id === 'water');
      const snowLayer = col.layers.find((l) => l.id === 'snow');
      return {
        frame: 2,
        label: 'perched_lake_submerged_bed_missing_water_column_and_walkable_animals',
        cameraShorePos: { x: -1192, z: -980 },
        submergedProbePos: { x: lx, z: lz },
        lakeSurfaceM: Math.round((surf.lake?.surface ?? 0) * 1000) / 1000,
        lakeBedHeightM: Math.round(bedH * 1000) / 1000,
        trueWaterDepthM: Math.round(((surf.lake?.surface ?? 0) - bedH) * 1000) / 1000,
        groundWaterLayerThicknessM: waterLayer ? Math.round(waterLayer.thickness * 1000) / 1000 : 0,
        groundSubmergedSnowThicknessCm: snowLayer ? Math.round(snowLayer.thickness * 10000) / 100 : 0,
        wolfWalkable2_36mUnderwater: window.__au.wolfGround({ x: lx, z: lz })(lx, lz),
        deerWalkable2_36mUnderwater: bedH >= window.__tu.LEVEL.deerWater,
        harePassable2_36mUnderwater: bedH > window.__tu.LEVEL.hareWater,
        statusFirstLine: (document.getElementById('status')?.innerText || '').split('\\n')[0] || '',
      };
    })()`);
    observations.push(obs2);
    await snapPng('frame-2.png');

    const webmB64 = await evalJs(`new Promise((resolve) => {
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
