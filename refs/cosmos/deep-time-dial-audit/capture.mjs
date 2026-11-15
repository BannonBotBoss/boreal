/**
 * Live browser screen recording + frame sampler + runtime telemetry for T-0236:
 * Deep-time planetary evolution (?deep= / earthState / layerExistence), #109 12-decade
 * orbit Time Dial & epochOffsetYr coupling, Gough (1981) / RGB stellar evolution in
 * globeView + sunView, and Big Bang Opening Film (cineBeats.ts / opening.ts) cosmic-to-geological
 * chronology synchronization.
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
const CDP_PORT = 9374;
const WORK_ROOT = resolve(__dirname, '../../../work');
const PROFILE = resolve(WORK_ROOT, 'edge-deep-time-dial-audit-profile');
const LOCK_NAME = 'agy: T-0236-deep-time-dial-audit';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function connectCdp(wsUrl, onEvent) {
  return new Promise((resConn, rejConn) => {
    const ws = new WebSocket(wsUrl);
    let seq = 1;
    const pending = new Map();
    ws.onopen = () => {
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
      resConn({ ws, send, evalJs });
    };
    ws.onerror = rejConn;
    ws.onmessage = (ev) => {
      const msg = JSON.parse(String(ev.data));
      if (msg.id && pending.has(msg.id)) {
        const { resolve: r, reject: j } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) j(new Error(msg.error.message));
        else r(msg.result);
      } else if (msg.method && onEvent) {
        onEvent(msg);
      }
    };
  });
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
          server: { host: '127.0.0.1', port: ${PORT}, strictPort: true, watch: null },
          logLevel: 'error',
        });
        await srv.listen();
        await srv.transformRequest('/src/world/globe/entry.ts');
        await srv.transformRequest('/src/world/globe/globeView.ts');
        await srv.transformRequest('/src/world/cosmos/opening.ts');
        await srv.transformRequest('/src/main.ts');
      `;
      viteProc = spawn(process.execPath, ['--input-type=module', '-e', viteBoot], {
        stdio: 'ignore',
        cwd: resolve(__dirname, '../../..'),
      });
      if (viteProc.pid) track(viteProc.pid);
      let up = false;
      for (let i = 0; i < 60; i++) {
        try {
          const r = await fetch(`${BASE_URL}/src/core/deepTime.ts`);
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

    let pages = [];
    for (let i = 0; i < 60; i++) {
      await sleep(250);
      try {
        const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
        const list = await res.json();
        pages = list.filter((p) => p.type === 'page' && p.webSocketDebuggerUrl);
        if (pages.length >= 1) break;
      } catch {}
    }
    if (pages.length < 1) throw new Error('Failed to connect to headless Edge CDP');
    if (pages.length < 2) {
      let rNew = await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, { method: 'PUT' });
      if (!rNew.ok) rNew = await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`);
      const created = await rNew.json();
      if (created?.webSocketDebuggerUrl) pages.push(created);
    }

    const pageErrors = [];
    const recCdp = await connectCdp(pages[0].webSocketDebuggerUrl);
    await recCdp.send('Runtime.enable');
    await recCdp.evalJs(`(() => {
      const c = document.createElement('canvas');
      c.width = 1280; c.height = 720;
      document.body.style.margin = '0';
      document.body.appendChild(c);
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#05070d';
      ctx.fillRect(0, 0, 1280, 720);
      window.__label = 'Booting T-0236 deep-time & cosmos audit...';
      window.__lastImg = null;
      window.__pushFrame = (b64, label) => {
        if (label) window.__label = label;
        const img = new Image();
        img.onload = () => { window.__lastImg = img; };
        img.src = 'data:image/jpeg;base64,' + b64;
      };
      window.__timer = setInterval(() => {
        if (window.__lastImg) ctx.drawImage(window.__lastImg, 0, 0, 1280, 720);
        ctx.fillStyle = 'rgba(8, 12, 20, 0.84)';
        ctx.fillRect(14, 672, 920, 36);
        ctx.fillStyle = '#eef5ff';
        ctx.font = '14px monospace';
        ctx.fillText(window.__label, 24, 695);
      }, 66);
      const stream = c.captureStream(15);
      const chunks = [];
      const rec = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' });
      rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
      window.__chunks = chunks;
      window.__rec = rec;
      rec.start(100);
      return true;
    })()`);

    let currentStageLabel = 'Scene 0: Hadean Earth (?deep=-4500000000)';
    let auditCdp = null;
    auditCdp = await connectCdp(pages[1].webSocketDebuggerUrl, (msg) => {
      if (msg.method === 'Runtime.exceptionThrown') {
        pageErrors.push(msg.params?.exceptionDetails?.text || 'exception');
      } else if (msg.method === 'Page.screencastFrame' && auditCdp) {
        const { data, sessionId } = msg.params;
        auditCdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
        recCdp.evalJs(`window.__pushFrame(${JSON.stringify(data)}, ${JSON.stringify(currentStageLabel)})`).catch(() => {});
      }
    });

    await auditCdp.send('Page.enable');
    await auditCdp.send('Runtime.enable');
    await auditCdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
    await auditCdp.send('Page.startScreencast', { format: 'jpeg', quality: 82, maxWidth: 1280, maxHeight: 720 });

    const snapPng = async (outFile) => {
      const res = await Promise.race([
        auditCdp.send('Page.captureScreenshot', { format: 'png' }),
        sleep(15000).then(() => { throw new Error('captureScreenshot timeout'); }),
      ]);
      writeFileSync(resolve(__dirname, outFile), Buffer.from(res.data, 'base64'));
      await recCdp.evalJs(`window.__pushFrame(${JSON.stringify(res.data)}, ${JSON.stringify(currentStageLabel)})`).catch(() => {});
    };

    const waitGlobeReady = async () => {
      for (let i = 0; i < 120; i++) {
        await sleep(250);
        try {
          const ok = await auditCdp.evalJs(`Boolean(window.__globe && window.__globe.bootSettled && window.__globe.stats().drawn > 0)`);
          if (ok) break;
        } catch {}
      }
      await sleep(1200);
    };

    // Sample RGB classifications across the central Earth disc on the WebGL canvas
    const sampleGlobeDisc = `(() => {
      const glCanvas = document.querySelector('canvas');
      const c = document.createElement('canvas');
      c.width = 320; c.height = 180;
      const ctx = c.getContext('2d');
      ctx.drawImage(glCanvas, 0, 0, 320, 180);
      const img = ctx.getImageData(0, 0, 320, 180).data;
      let total = 0, blueOcean = 0, greenVeg = 0, whiteIceCloud = 0, magmaGlow = 0, aridTanRock = 0;
      // Central circle r = 56 px around (160, 90) stays well inside the rendered Earth disc
      for (let y = 34; y <= 146; y++) {
        for (let x = 104; x <= 216; x++) {
          const dx = x - 160, dy = y - 90;
          if (dx * dx + dy * dy > 52 * 52) continue;
          const idx = (y * 320 + x) * 4;
          const r = img[idx], g = img[idx + 1], b = img[idx + 2];
          if (r + g + b < 24) continue; // unlit night side or space
          total++;
          if (b > r * 1.22 && b > g * 1.05 && b > 45) blueOcean++;
          if (g > r * 1.08 && g > b * 1.12 && g > 40) greenVeg++;
          if (r > 175 && g > 175 && b > 175 && Math.max(r, g, b) - Math.min(r, g, b) < 38) whiteIceCloud++;
          if (r > 150 && r > g * 1.45 && g > b * 1.3) magmaGlow++;
          if (r > g && g > b && r > 70 && b < 130 && r < 185) aridTanRock++;
        }
      }
      const frac = (n) => total > 0 ? Number((n / total).toFixed(4)) : 0;
      return {
        litDiscSamples: total,
        blueOceanFrac: frac(blueOcean),
        greenVegFrac: frac(greenVeg),
        whiteIceOrCloudFrac: frac(whiteIceCloud),
        magmaGlowFrac: frac(magmaGlow),
        aridTanRockFrac: frac(aridTanRock),
      };
    })()`;

    const observations = [];

    // =========================================================================
    // SCENE 0 (frame-0.png): Hadean Molten Magma-Ocean Earth (?deep=-4500000000)
    // Uncheck Clouds so the raw Hadean surface (blue oceans, green forests,
    // polar snow/ice!) is unobstructed alongside the Layer Panel showing
    // "Ocean (not yet formed)", "Vegetation (not yet formed)", "Snow / ice (not yet formed)"!
    // =========================================================================
    currentStageLabel = 'Scene 0: Hadean (-4.50 Gyr) — moltenSurface=true yet blue oceans, green forests & polar ice render!';
    await auditCdp.send('Page.navigate', {
      url: `${BASE_URL}/?view=globe&deep=-4500000000&panel=1&date=2026-06-21&hour=12&tier=1`,
    });
    await waitGlobeReady();
    // Uncheck Clouds if enabled so underlying ocean/land/ice surface is 100% visible, and show ` HUD
    const probe0 = await auditCdp.evalJs(`(async () => {
      const findMod = (sub) => performance.getEntriesByType('resource').map((r) => r.name).find((n) => n.includes(sub)) || sub;
      const deepMod = await import(findMod('/src/core/deepTime.ts'));
      const layerMod = await import(findMod('/src/core/layerExistence.ts'));
      const tileMod = await import(findMod('/src/world/globe/tile.ts'));
      // Uncheck Clouds checkbox to expose the surface directly under Hadean sky
      const labels = [...document.querySelectorAll('label')];
      const cloudLbl = labels.find((l) => l.textContent?.includes('Clouds'));
      const cloudCb = cloudLbl?.querySelector('input[type="checkbox"]');
      if (cloudCb && cloudCb.checked) cloudCb.click();
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '\`', code: 'Backquote', bubbles: true }));
      await new Promise((r) => setTimeout(r, 500));

      const dt = deepMod.deepTimeAt(-4.50e9);
      const le = layerMod.layerExistence(-4.50e9);
      const panelLabels = labels.map((l) => l.textContent?.trim());
      const era = tileMod.GLOBE_ERA.uEra.value;
      const disc = ${sampleGlobeDisc};
      return {
        offsetYr: -4.50e9,
        deepTimeState: dt,
        layerExistence: le,
        panelLabels,
        globeEraUniform: [era.x, era.y, era.z, era.w],
        globeCrackUniform: tileMod.GLOBE_ERA.uCrack.value,
        drawnTiles: window.__globe.stats().drawn,
        discSample: disc,
      };
    })()`);
    await sleep(600);
    await snapPng('frame-0.png');
    observations.push({ frame: 0, label: 'hadean_molten_earth_minus_4_50_gyr', probe: probe0 });

    // Quick check of pre-Earth solar nebula (?deep=-4560000000): planet=false ('no-planet') yet solid globe renders!
    currentStageLabel = 'Scene 0b: Pre-Earth solar nebula (-4.56 Gyr, planet=false) — solid Earth globe still drawn!';
    await auditCdp.send('Page.navigate', {
      url: `${BASE_URL}/?view=globe&deep=-4560000000&panel=1&date=2026-06-21&hour=12&tier=1`,
    });
    await waitGlobeReady();
    const probeNoPlanet = await auditCdp.evalJs(`(async () => {
      const findMod = (sub) => performance.getEntriesByType('resource').map((r) => r.name).find((n) => n.includes(sub)) || sub;
      const deepMod = await import(findMod('/src/core/deepTime.ts'));
      const layerMod = await import(findMod('/src/core/layerExistence.ts'));
      return {
        offsetYr: -4.56e9,
        deepTimeState: deepMod.deepTimeAt(-4.56e9),
        layerExistence: layerMod.layerExistence(-4.56e9),
        drawnTilesWhenNoPlanet: window.__globe.stats().drawn,
        discSample: ${sampleGlobeDisc},
      };
    })()`);
    await sleep(400);

    // =========================================================================
    // SCENE 1 (frame-1.png): Cryogenian Sturtian Snowball Earth (?deep=-700000000)
    // earthState.snowball === true & Vegetation (not yet formed), yet globe draws
    // green continents & open blue tropical oceans with 0% equatorial glaciation!
    // =========================================================================
    currentStageLabel = 'Scene 1: Cryogenian Snowball Earth (-700 Myr) — snowball=true yet green forests & open blue seas!';
    await auditCdp.send('Page.navigate', {
      url: `${BASE_URL}/?view=globe&deep=-700000000&panel=1&date=2026-06-21&hour=12&tier=1`,
    });
    await waitGlobeReady();
    const probe1 = await auditCdp.evalJs(`(async () => {
      const findMod = (sub) => performance.getEntriesByType('resource').map((r) => r.name).find((n) => n.includes(sub)) || sub;
      const deepMod = await import(findMod('/src/core/deepTime.ts'));
      const layerMod = await import(findMod('/src/core/layerExistence.ts'));
      const labels = [...document.querySelectorAll('label')];
      const cloudLbl = labels.find((l) => l.textContent?.includes('Clouds'));
      const cloudCb = cloudLbl?.querySelector('input[type="checkbox"]');
      if (cloudCb && cloudCb.checked) cloudCb.click();
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '\`', code: 'Backquote', bubbles: true }));
      await new Promise((r) => setTimeout(r, 500));

      return {
        offsetYr: -700e6,
        deepTimeState: deepMod.deepTimeAt(-700e6),
        layerExistence: layerMod.layerExistence(-700e6),
        panelLabels: labels.map((l) => l.textContent?.trim()),
        discSample: ${sampleGlobeDisc},
      };
    })()`);
    await sleep(600);
    await snapPng('frame-1.png');
    observations.push({
      frame: 1,
      label: 'cryogenian_snowball_earth_minus_700_myr',
      probe: probe1,
      noPlanetProbe: probeNoPlanet,
    });

    // =========================================================================
    // SCENE 2 (frame-2.png): Future Runaway / Oceans Boiled Away (?deep=2000000000)
    // + Engulfed (+7.60 Gyr), SunView (+7.50 Gyr red giant), & In-Page #109 Time Dial
    // =========================================================================
    currentStageLabel = 'Scene 2: Future Oceans Lost (+2.00 Gyr) — Ocean/Clouds/Veg/Ice all (gone) yet modern blue/green globe renders!';
    await auditCdp.send('Page.navigate', {
      url: `${BASE_URL}/?view=globe&deep=2000000000&panel=1&date=2026-06-21&hour=12&tier=1`,
    });
    await waitGlobeReady();
    const probe2 = await auditCdp.evalJs(`(async () => {
      const findMod = (sub) => performance.getEntriesByType('resource').map((r) => r.name).find((n) => n.includes(sub)) || sub;
      const deepMod = await import(findMod('/src/core/deepTime.ts'));
      const layerMod = await import(findMod('/src/core/layerExistence.ts'));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '\`', code: 'Backquote', bubbles: true }));
      await new Promise((r) => setTimeout(r, 500));
      const labels = [...document.querySelectorAll('label')];
      return {
        offsetYr: 2.00e9,
        deepTimeState: deepMod.deepTimeAt(2.00e9),
        layerExistence: layerMod.layerExistence(2.00e9),
        panelLabels: labels.map((l) => l.textContent?.trim()),
        drawnTiles: window.__globe.stats().drawn,
        discSample: ${sampleGlobeDisc},
      };
    })()`);
    await sleep(600);
    await snapPng('frame-2.png');

    // Probe Engulfed (+7.60 Gyr) & SunView (+7.50 Gyr red giant) & In-Page Orbit #109 Time Dial
    currentStageLabel = 'Scene 2b: Red-Giant Engulfed (+7.60 Gyr), SunView (+7.50 Gyr), & In-Page #109 Time Dial dead in orbit';
    await auditCdp.send('Page.navigate', {
      url: `${BASE_URL}/?view=globe&deep=7600000000&panel=1&date=2026-06-21&hour=12&tier=1`,
    });
    await waitGlobeReady();
    const engulfedProbe = await auditCdp.evalJs(`({
      offsetYr: 7.60e9,
      drawnTilesWhenEngulfed: window.__globe.stats().drawn,
    })`);

    await auditCdp.send('Page.navigate', {
      url: `${BASE_URL}/?view=sun&deep=7500000000&elev=space&settled=1`,
    });
    for (let i = 0; i < 60; i++) {
      await sleep(200);
      const ok = await auditCdp.evalJs(`Boolean(window.__sun && Number.isFinite(window.__sun.discPx))`);
      if (ok) break;
    }
    await sleep(400);
    const sunViewProbe = await auditCdp.evalJs(`({
      deepParamYr: 7.50e9,
      sunTelemetry: window.__sun,
    })`);

    // Navigate to default in-page game in orbit (/?start=globe&noprobe=1&seed=1400&tier=1) and press '.' 12 times!
    await auditCdp.send('Page.navigate', {
      url: `${BASE_URL}/?start=globe&noprobe=1&seed=1400&tier=1`,
    });
    for (let i = 0; i < 80; i++) {
      await sleep(250);
      const ok = await auditCdp.evalJs(`Boolean(window.__inpage && window.__inpage.mode === 'globe' && window.__inpage.globe?.bootSettled)`);
      if (ok) break;
    }
    await sleep(500);
    const inpageDialProbe = await auditCdp.evalJs(`(async () => {
      const findMod = (sub) => performance.getEntriesByType('resource').map((r) => r.name).find((n) => n.includes(sub)) || sub;
      const clockMod = await import(findMod('/src/core/worldClock.ts'));
      const ip = window.__inpage;
      const dialBefore = clockMod.dialPosition();
      const rateBefore = clockMod.clockRate();
      for (let k = 0; k < 12; k++) {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: '.', code: 'Period', bubbles: true }));
        window.dispatchEvent(new KeyboardEvent('keyup', { key: '.', code: 'Period', bubbles: true }));
      }
      await new Promise((r) => setTimeout(r, 200));
      const dialAfter = clockMod.dialPosition();
      const rateAfter = clockMod.clockRate();
      return {
        inpageMode: ip.mode,
        dialBeforePeriodKeys: dialBefore,
        dialAfter12PeriodKeys: dialAfter,
        dialDeltaInOrbit: Number((dialAfter - dialBefore).toFixed(6)),
        rateBefore,
        rateAfter,
      };
    })()`);

    observations.push({
      frame: 2,
      label: 'future_oceans_lost_plus_2_00_gyr_and_orbit_time_dial_audit',
      probe: probe2,
      engulfedProbe,
      sunViewProbe,
      inpageDialProbe,
    });

    // =========================================================================
    // SCENE 3 (frame-3.png): Big Bang Opening Film (/?seed=1400&cine=B5)
    // Capture the live #cine-panel chronology & physics contradictions across
    // t = 35.8 s (10^-6 s QGP cooling showing "Energy ≈ 100 GeV per particle"),
    // t = 83.5..91.0 s (Earth globe shown at 4.57 Gya before 4.54 Gya accretion & Theia at 4.45 Gya),
    // and t = 102.5..106.1 s ("2.4 Gya" held until 488 Mya while faded out for 2.85 s).
    // =========================================================================
    // Clear localStorage so hasSeenBigBang(context) is false before launching ?start=sphere&cine=B7&noprobe=1!
    await auditCdp.evalJs(`(() => { try { localStorage.clear(); } catch {} return true; })()`);
    currentStageLabel = 'Scene 3: Big Bang Opening Film — #cine-panel clock vs milestone figure & physics contradictions!';
    await auditCdp.send('Page.navigate', {
      url: `${BASE_URL}/?start=sphere&cine=B7&noprobe=1&seed=1400&tier=1`,
    });
    for (let i = 0; i < 80; i++) {
      await sleep(250);
      const ok = await auditCdp.evalJs(`Boolean(window.__borealOpening && document.getElementById('cine-panel'))`);
      if (ok) break;
    }
    await sleep(500);

    // Seek to t = 35.8 s first (10^-6 s vs "Energy ≈ 100 GeV per particle" both visible on #cine-panel!)
    const cineProbeA = await auditCdp.evalJs(`(async () => {
      const op = window.__borealOpening;
      op.seek(35.8);
      // Pause progression slightly by seeking on rAF so we read exact rendered DOM
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      op.seek(35.8);
      const countText = document.querySelector('#cine-panel .count')?.textContent?.trim() || '';
      const figEl = document.querySelector('#cine-panel .fig');
      const figText = figEl?.textContent?.trim() || '';
      const figOpacity = figEl ? getComputedStyle(figEl).opacity : '';
      return { t: 35.8, countText, figText, figOpacity };
    })()`);
    await sleep(500);
    // Capture frame-3.png at t = 102.8 s OR t = 35.8 s? Let's check t = 102.8 s too and capture t = 35.8 s!
    // Wait: at t = 35.8 s the glowing quark-gluon plasma cosmos AND "#cine-panel: 10^-6 s / Energy ≈ 100 GeV per particle" are both super clear!
    // Let's also record t = 83.5 s, t = 89.5 s, t = 102.5 s, and t = 105.5 s into recording.webm AND snap frame-3.png at t = 35.8 s (or t = 102.55 s where Earth + "1.99 billion years ago" + "2.4 Gya" are all visible)!
    // Let's inspect t = 102.55 s too!
    const cineProbeB = await auditCdp.evalJs(`(async () => {
      const findMod = (sub) => performance.getEntriesByType('resource').map((r) => r.name).find((n) => n.includes(sub)) || sub;
      const beatsMod = await import(findMod('/src/world/cosmos/cineBeats.ts'));
      const samples = [];
      for (const t of [26.0, 35.8, 82.0, 83.5, 89.5, 102.55, 104.5, 105.8, 106.0]) {
        window.__borealOpening.seek(t);
        await new Promise((r) => setTimeout(r, 120));
        window.__borealOpening.seek(t);
        const countText = document.querySelector('#cine-panel .count')?.textContent?.trim() || '';
        const figEl = document.querySelector('#cine-panel .fig');
        const figText = figEl?.textContent?.trim() || '';
        const figOpacity = figEl ? Number(Number(getComputedStyle(figEl).opacity).toFixed(3)) : 0;
        samples.push({
          t,
          formatClock: beatsMod.formatClock(t),
          panelFigure: beatsMod.panelFigure(t),
          domCount: countText,
          domFig: figText,
          domFigOpacity: figOpacity,
          earthShown: document.documentElement.dataset.cineEarth === '1',
        });
      }
      // Leave at t = 102.55 s where glowing/ocean Earth + "2.04 billion years ago" + "2.4 Gya" are ALL visible on screen!
      window.__borealOpening.seek(102.55);
      return {
        sunKeyframeCheck: beatsMod.sunKeyframeCheck(),
        timelineSamples: samples,
      };
    })()`);
    await sleep(300);
    await auditCdp.evalJs(`window.__borealOpening.seek(102.55)`);
    await snapPng('frame-3.png');

    observations.push({
      frame: 3,
      label: 'big_bang_opening_chronology_and_particle_energy_desync',
      cineAt35_8: cineProbeA,
      cineTimelineAudit: cineProbeB,
    });

    await sleep(600);
    await auditCdp.send('Page.stopScreencast').catch(() => {});

    const webmB64 = await recCdp.evalJs(`new Promise((resolve) => {
      clearInterval(window.__timer);
      const rec = window.__rec;
      rec.onstop = () => {
        const blob = new Blob(window.__chunks, { type: 'video/webm' });
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

    auditCdp.ws.close();
    recCdp.ws.close();
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
