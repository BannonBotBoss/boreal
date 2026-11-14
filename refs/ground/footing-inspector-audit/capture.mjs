/**
 * Live browser screen recording + frame sampler + runtime telemetry for T-0227
 * (embodied species foot-loading, Bekker snow compaction resistance, site-climate ground decay/moss,
 * broken terrain picking in Generation Inspector, and playable species mislabeling in Inspector).
 * Uses agy preview port 5256 and tools/bench-lock.mjs, killing Vite and headless Edge cleanly on exit.
 */
import { spawn, execSync } from 'node:child_process';
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
const PROFILE = resolve(WORK_ROOT, 'edge-ground-footing-inspector-profile');
const LOCK_NAME = 'agy: T-0227-ground-footing-inspector-audit';

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
        await srv.transformRequest('/src/core/ground.ts');
        await srv.transformRequest('/src/ui/inspector.ts');
        await srv.transformRequest('/src/render/buildScene.ts');
      `;
      viteProc = spawn(process.execPath, ['--input-type=module', '-e', viteBoot], {
        stdio: 'ignore',
        cwd: resolve(__dirname, '../../..'),
      });
      if (viteProc.pid) track(viteProc.pid);
      let up = false;
      for (let i = 0; i < 60; i++) {
        try {
          const r = await fetch(`${BASE_URL}/src/core/ground.ts`);
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

    // Load directly as embodied snowshoe hare (?play=hare) in midwinter (day=15, hour=12)
    const url = `${BASE_URL}/?nomenu&noprobe&view=ground&stages=1&play=hare&rec&day=15&hour=12`;
    await send('Page.navigate', { url });
    let ready = false;
    for (let i = 0; i < 80; i++) {
      await sleep(500);
      ready = await evalJs(`Boolean(document.readyState === 'complete' && !document.getElementById('loading') && document.getElementById('status'))`);
      if (ready) break;
    }
    if (!ready) throw new Error(`Game did not finish loading: ${JSON.stringify(pageErrors)}`);
    await sleep(1800);

    await evalJs(`(async () => {
      const findMod = (sub) => {
        const entries = performance.getEntriesByType('resource').map((r) => r.name);
        return entries.find((n) => n.includes(sub)) || sub;
      };
      window.__tod = await import(findMod('/src/core/timeOfDay.ts'));
      window.__wc = await import(findMod('/src/core/worldClock.ts'));
      window.__sp = await import(findMod('/src/core/sitePhase.ts'));
      window.__gr = await import(findMod('/src/core/ground.ts'));
      window.__wx = await import(findMod('/src/core/weather.ts'));
      window.__pw = await import(findMod('/src/core/planetWeather.ts'));
      window.__ph = await import(findMod('/src/proc/physics.ts'));
      window.__mt = await import(findMod('/src/core/materials.ts'));

      // Start composite MediaRecorder (3D WebGL canvas + Inspector/HUD overlay summary) so video captures both 3D scene and UI state
      const comp = document.createElement('canvas');
      comp.width = 1280;
      comp.height = 720;
      const ctx = comp.getContext('2d');
      const glCanvas = document.querySelector('canvas');
      const drawComp = () => {
        if (!window.__stopComp) {
          ctx.drawImage(glCanvas, 0, 0, 1280, 720);
          const insp = document.getElementById('inspector');
          if (insp && !insp.hidden) {
            ctx.fillStyle = 'rgba(13, 23, 18, 0.90)';
            ctx.fillRect(880, 10, 390, 700);
            ctx.fillStyle = '#f4efe2';
            ctx.font = '13px monospace';
            const lines = (insp.innerText || '').split('\\n').slice(0, 38);
            lines.forEach((ln, idx) => ctx.fillText(ln.slice(0, 52), 890, 32 + idx * 17));
          }
          const st = document.getElementById('status');
          if (st) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
            ctx.fillRect(10, 660, 850, 50);
            ctx.fillStyle = '#ffffff';
            ctx.font = '12px sans-serif';
            const sl = (st.innerText || '').split('\\n');
            sl.forEach((ln, idx) => ctx.fillText(ln.slice(0, 115), 18, 678 + idx * 16));
          }
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

    // Open Generation Inspector ('i' key) and test clicking bare ground vs clicking player (hare)
    await evalJs(`(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyI', key: 'i', bubbles: true }));
      return true;
    })()`);
    await sleep(300);
    await evalJs(`(() => {
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyI', key: 'i', bubbles: true }));
      return true;
    })()`);
    await sleep(400);

    // Click several bare terrain pixels (avoiding the player center) to test terrain picking
    const terrainClickTest = await evalJs(`(() => {
      const c = document.querySelector('canvas');
      const r = c.getBoundingClientRect();
      const testPts = [
        [Math.round(r.width * 0.18), Math.round(r.height * 0.78)],
        [Math.round(r.width * 0.80), Math.round(r.height * 0.78)],
        [Math.round(r.width * 0.25), Math.round(r.height * 0.62)],
      ];
      const hits = [];
      for (const [x, y] of testPts) {
        c.dispatchEvent(new PointerEvent('pointerdown', { clientX: x, clientY: y, bubbles: true }));
        c.dispatchEvent(new PointerEvent('pointerup', { clientX: x, clientY: y, bubbles: true }));
        const header = document.querySelector('#inspector header b')?.textContent || null;
        hits.push({ x, y, inspectorHeader: header });
      }
      return hits;
    })()`);

    // Now scan near center-bottom to click the embodied Snowshoe hare player rig in the Inspector
    const hareClick = await evalJs(`(() => {
      const c = document.querySelector('canvas');
      const r = c.getBoundingClientRect();
      let selected = null;
      for (let dy = -80; dy <= 140 && !selected; dy += 12) {
        for (let dx = -80; dx <= 80 && !selected; dx += 12) {
          const x = Math.round(r.width * 0.5 + dx);
          const y = Math.round(r.height * 0.55 + dy);
          c.dispatchEvent(new PointerEvent('pointerdown', { clientX: x, clientY: y, bubbles: true }));
          c.dispatchEvent(new PointerEvent('pointerup', { clientX: x, clientY: y, bubbles: true }));
          const h = document.querySelector('#inspector header b')?.textContent || '';
          if (h.startsWith('player')) selected = { x, y, header: h };
        }
      }
      return selected;
    })()`);
    await sleep(1000);

    const obs0 = await evalJs(`(() => {
      const p = window.__boreal.player();
      const col = window.__gr.column(p.x, p.z);
      const g = window.__ph.gravity();
      const inspText = document.getElementById('inspector')?.innerText || '';
      const massMatch = inspText.match(/total mass \\(kg\\)\\s*([0-9.]+)/);
      const hareMassKg = massMatch ? Number(massMatch[1]) : 1.55;
      const footBugCanid = window.__gr.footing(col, hareMassKg, 'canid', g);
      const footLeporidCurrent = window.__gr.footing(col, hareMassKg, 'leporid', g);
      const whyLines = inspText.split('\\n').filter((l) => /Gray wolf|Snowshoe hare|born to a pack|why/i.test(l));
      return {
        frame: 0,
        label: 'playable_hare_winter_inspector_and_snow_footing',
        playableSpecies: p.species || 'hare',
        pos: { x: Math.round(p.x * 100) / 100, z: Math.round(p.z * 100) / 100 },
        snowLayerCm: Math.round(((col.layers.find((l) => l.id === 'snow')?.thickness ?? 0) * 100) * 100) / 100,
        terrainClickHits: ${JSON.stringify(terrainClickTest)},
        hareClickResult: ${JSON.stringify(hareClick)},
        hareRigMassKg: hareMassKg,
        footingWithHardcodedCanid: footBugCanid,
        footingWithLeporidAndWetLoamResistanceBug: footLeporidCurrent,
        inspectorHeader: document.querySelector('#inspector header b')?.textContent || '',
        inspectorWhyExcerpt: whyLines,
        statusFirstLine: (document.getElementById('status')?.innerText || '').split('\\n')[0] || '',
      };
    })()`);
    observations.push(obs0);
    await snapPng('frame-0.png');

    // Frame 1: Navigate to playable White-tailed deer (?play=deer) in midwinter (day=15, hour=12) and inspect player + snow footing
    const urlDeer = `${BASE_URL}/?nomenu&noprobe&view=ground&stages=1&play=deer&rec&day=15&hour=12`;
    await send('Page.navigate', { url: urlDeer });
    ready = false;
    for (let i = 0; i < 80; i++) {
      await sleep(500);
      ready = await evalJs(`Boolean(document.readyState === 'complete' && !document.getElementById('loading') && document.getElementById('status'))`);
      if (ready) break;
    }
    await sleep(1800);

    // Re-open inspector and click deer player
    await evalJs(`(async () => {
      const findMod = (sub) => {
        const entries = performance.getEntriesByType('resource').map((r) => r.name);
        return entries.find((n) => n.includes(sub)) || sub;
      };
      window.__gr = await import(findMod('/src/core/ground.ts'));
      window.__ph = await import(findMod('/src/proc/physics.ts'));
      window.__sp = await import(findMod('/src/core/sitePhase.ts'));
      window.__ls = await import(findMod('/src/world/globe/landingSite.ts'));
      window.__pl = await import(findMod('/src/world/globe/planet.ts'));
      window.__wx = await import(findMod('/src/core/weather.ts'));
      window.__pw = await import(findMod('/src/core/planetWeather.ts'));
      window.__tod = await import(findMod('/src/core/timeOfDay.ts'));
      window.__wc = await import(findMod('/src/core/worldClock.ts'));
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyI', key: 'i', bubbles: true }));
      return true;
    })()`);
    await sleep(300);
    await evalJs(`(() => { window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyI', key: 'i', bubbles: true })); return true; })()`);
    await sleep(400);

    const deerClick = await evalJs(`(() => {
      const c = document.querySelector('canvas');
      const r = c.getBoundingClientRect();
      let selected = null;
      for (let dy = -120; dy <= 140 && !selected; dy += 12) {
        for (let dx = -100; dx <= 100 && !selected; dx += 12) {
          const x = Math.round(r.width * 0.5 + dx);
          const y = Math.round(r.height * 0.55 + dy);
          c.dispatchEvent(new PointerEvent('pointerdown', { clientX: x, clientY: y, bubbles: true }));
          c.dispatchEvent(new PointerEvent('pointerup', { clientX: x, clientY: y, bubbles: true }));
          const h = document.querySelector('#inspector header b')?.textContent || '';
          if (h.startsWith('player')) selected = { x, y, header: h };
        }
      }
      return selected;
    })()`);
    await sleep(1000);

    const obs1 = await evalJs(`(() => {
      const p = window.__boreal.player();
      const col = window.__gr.column(p.x, p.z);
      const g = window.__ph.gravity();
      const inspText = document.getElementById('inspector')?.innerText || '';
      const massMatch = inspText.match(/total mass \\(kg\\)\\s*([0-9.]+)/);
      const deerMassKg = massMatch ? Number(massMatch[1]) : 65;
      const footBugCanid = window.__gr.footing(col, deerMassKg, 'canid', g);
      const footCervid = window.__gr.footing(col, deerMassKg, 'cervid', g);
      const whyLines = inspText.split('\\n').filter((l) => /Gray wolf|White-tailed deer|born to a pack|why/i.test(l));
      return {
        frame: 1,
        label: 'playable_deer_winter_inspector_and_canid_footing_bug',
        pos: { x: Math.round(p.x * 100) / 100, z: Math.round(p.z * 100) / 100 },
        snowLayerCm: Math.round(((col.layers.find((l) => l.id === 'snow')?.thickness ?? 0) * 100) * 100) / 100,
        deerClickResult: ${JSON.stringify(deerClick)},
        deerRigMassKg: deerMassKg,
        footingWithHardcodedCanid: footBugCanid,
        footingWithCervidHooves: footCervid,
        inspectorHeader: document.querySelector('#inspector header b')?.textContent || '',
        inspectorWhyExcerpt: whyLines,
        statusFirstLine: (document.getElementById('status')?.innerText || '').split('\\n')[0] || '',
      };
    })()`);
    observations.push(obs1);
    await snapPng('frame-1.png');

    // Frame 2: Land at hot hyper-arid Sahara desert site (23.5°N, 10.0°E) on midsummer day=196, hour=13.0,
    // and inspect ground.column + Inspector terrain click failure + boreal moss/2.5°C Q10 column on hot desert!
    await evalJs(`(async () => {
      const dir = window.__pl.fromLatLon(23.5 * Math.PI / 180, 10.0 * Math.PI / 180);
      window.__ls.engageLanding(dir, 0);
      const sec = window.__wc.worldSec();
      window.__tod.setDay(196, sec);
      window.__tod.setHour(13.0, sec);
      await window.__pw.openForestPlanet(196, 13.0);
      return window.__sp.SITE;
    })()`);
    await sleep(1600);

    // Try clicking bare desert ground in the Inspector (shows header stays stuck or empty because terrain pick returns undefined!)
    const desertClickAttempt = await evalJs(`(() => {
      // Toggle inspector off then on so selection starts clean, then click desert ground
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyI', key: 'i', bubbles: true }));
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyI', key: 'i', bubbles: true }));
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyI', key: 'i', bubbles: true }));
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyI', key: 'i', bubbles: true }));
      const c = document.querySelector('canvas');
      const r = c.getBoundingClientRect();
      c.dispatchEvent(new PointerEvent('pointerdown', { clientX: Math.round(r.width * 0.25), clientY: Math.round(r.height * 0.75), bubbles: true }));
      c.dispatchEvent(new PointerEvent('pointerup', { clientX: Math.round(r.width * 0.25), clientY: Math.round(r.height * 0.75), bubbles: true }));
      return {
        inspectorTextAfterTerrainClick: document.getElementById('inspector')?.innerText || '',
        inspectorHeaderAfterTerrainClick: document.querySelector('#inspector header b')?.textContent || null,
      };
    })()`);
    await sleep(800);

    const obs2 = await evalJs(`(() => {
      const p = window.__boreal.player();
      const pw = window.__pw.weatherAtLatLon(23.5, 10.0);
      const col = window.__gr.column(p.x, p.z);
      const mossLayer = col.layers.find((l) => l.id === 'moss');
      const duffLayer = col.layers.find((l) => l.id === 'duff');
      const wxHere = window.__wx.weatherAt(p.x, p.z);
      return {
        frame: 2,
        label: 'sahara_desert_site_boreal_moss_2_5C_decay_and_broken_terrain_pick',
        site: { lat: 23.5, lon: 10.0, biome: 'desert' },
        planetSimAirTempC: pw ? Math.round(pw.tC * 100) / 100 : null,
        localWeatherAirTempC: Math.round(wxHere.tC * 100) / 100,
        weatherStructDay: window.__wx.WEATHER.day,
        worldClockDay: window.__tod.dayAt(window.__wc.worldSec()),
        desertClickAttempt: ${JSON.stringify(desertClickAttempt)},
        groundMossThicknessCm: mossLayer ? Math.round(mossLayer.thickness * 10000) / 100 : 0,
        groundDuffAgeLabel: duffLayer?.age || '',
        groundLayerSummary: col.layers.map((l) => ({ id: l.id, cm: Math.round(l.thickness * 1000) / 10, age: l.age || null })),
        statusFirstLine: (document.getElementById('status')?.innerText || '').split('\\n')[0] || '',
      };
    })()`);
    observations.push(obs2);
    await snapPng('frame-2.png');

    // Note: page navigation between Frame 0 and Frame 1 reset window.__rec on the first page, so let's also record a continuous 4.5s WebM clip on the current page cycling Inspector + movement so recording.webm has full multi-second motion!
    await evalJs(`(async () => {
      const comp = document.createElement('canvas');
      comp.width = 1280;
      comp.height = 720;
      const ctx = comp.getContext('2d');
      const glCanvas = document.querySelector('canvas');
      window.__stopComp2 = false;
      const drawComp = () => {
        if (!window.__stopComp2) {
          ctx.drawImage(glCanvas, 0, 0, 1280, 720);
          const insp = document.getElementById('inspector');
          if (insp && !insp.hidden) {
            ctx.fillStyle = 'rgba(13, 23, 18, 0.90)';
            ctx.fillRect(820, 10, 450, 700);
            ctx.fillStyle = '#f4efe2';
            ctx.font = '13px monospace';
            const lines = (insp.innerText || '').split('\\n').slice(0, 38);
            lines.forEach((ln, idx) => ctx.fillText(ln.slice(0, 58), 830, 32 + idx * 17));
          }
          requestAnimationFrame(drawComp);
        }
      };
      requestAnimationFrame(drawComp);
      const stream = comp.captureStream(20);
      const chunks = [];
      const rec = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' });
      rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
      window.__recChunks2 = chunks;
      window.__rec2 = rec;
      rec.start(100);
      return true;
    })()`);
    // Scene A in continuous recording (1.5 s): Sahara terrain click attempt (shows unclickable terrain hint)
    await sleep(1500);
    // Scene B in continuous recording (1.5 s): Return to midwinter boreal snow & click embodied deer player (shows "Gray wolf" why chain on deer!)
    await evalJs(`(() => {
      window.__sp.clearSite();
      const sec = window.__wc.worldSec();
      window.__tod.setDay(15, sec);
      window.__tod.setHour(12.0, sec);
      const c = document.querySelector('canvas');
      const r = c.getBoundingClientRect();
      for (let dy = -120; dy <= 140; dy += 16) {
        for (let dx = -80; dx <= 80; dx += 16) {
          c.dispatchEvent(new PointerEvent('pointerdown', { clientX: Math.round(r.width * 0.5 + dx), clientY: Math.round(r.height * 0.55 + dy), bubbles: true }));
          c.dispatchEvent(new PointerEvent('pointerup', { clientX: Math.round(r.width * 0.5 + dx), clientY: Math.round(r.height * 0.55 + dy), bubbles: true }));
          if ((document.querySelector('#inspector header b')?.textContent || '').startsWith('player')) return true;
        }
      }
      return false;
    })()`);
    await sleep(1500);
    // Scene C in continuous recording (1.2 s): Walk forward as deer in snow
    await evalJs(`(() => { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', key: 'w', bubbles: true })); return true; })()`);
    await sleep(1200);
    await evalJs(`(() => { window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', key: 'w', bubbles: true })); return true; })()`);
    await sleep(200);

    const webmB64 = await evalJs(`new Promise((resolve) => {
      window.__stopComp2 = true;
      const rec = window.__rec2;
      rec.onstop = () => {
        const blob = new Blob(window.__recChunks2, { type: 'video/webm' });
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
