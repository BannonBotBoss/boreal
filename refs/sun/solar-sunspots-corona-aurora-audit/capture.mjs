/**
 * Live browser screen recording + frame sampler + pixel/uniform telemetry for T-0242:
 * Solar Astrophysics, Photosphere Limb Darkening, Cycle-25 Sunspot Synthesis,
 * SDO/AIA Coronal Passbands, and Solar-Wind Magnetosphere/Aurora Coupling.
 *
 * Uses agy preview port 5266 and tools/bench-lock.mjs, terminating Vite and headless Edge cleanly on exit.
 * Two-tab CDP setup (no nested iframes):
 *  - Tab 0: 1280x720 2D MediaRecorder canvas fed continuously by Tab 1's Page.startScreencast
 *  - Tab 1: Direct top-level navigation to /tools/sun.html and /?view=globe with WebGL preserveDrawingBuffer
 */
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquire, track, release } from '../../../tools/bench-lock.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
mkdirSync(__dirname, { recursive: true });

const PORT = 5266;
const BASE_URL = process.env.BOREAL_URL || `http://127.0.0.1:${PORT}`;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const CDP_PORT = 9376;
const WORK_ROOT = resolve(__dirname, '../../../work-t0242');
const PROFILE = resolve(WORK_ROOT, 'edge-solar-audit-profile');
const LOCK_NAME = 'agy: T-0242-solar-sunspots-corona-aurora-audit';

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
        await srv.transformRequest('/src/world/sun/sunView.ts');
        await srv.transformRequest('/src/world/globe/entry.ts');
        await srv.transformRequest('/src/world/globe/globeView.ts');
      `;
      viteProc = spawn(process.execPath, ['--input-type=module', '-e', viteBoot], {
        stdio: 'ignore',
        cwd: resolve(__dirname, '../../..'),
      });
      if (viteProc.pid) track(viteProc.pid);
      let up = false;
      for (let i = 0; i < 60; i++) {
        try {
          const r = await fetch(`${BASE_URL}/tools/sun.html`);
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

    // Tab 0: 2D MediaRecorder stage
    const recCdp = await connectCdp(pages[0].webSocketDebuggerUrl);
    await recCdp.send('Runtime.enable');
    await recCdp.evalJs(`(() => {
      const c = document.createElement('canvas');
      c.width = 1280; c.height = 720;
      document.body.style.margin = '0';
      document.body.appendChild(c);
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#03060c';
      ctx.fillRect(0, 0, 1280, 720);
      window.__label = 'Booting T-0242 Solar & Magnetosphere Audit...';
      window.__lastImg = null;
      window.__pushFrame = (b64, label) => {
        if (label) window.__label = label;
        const img = new Image();
        img.onload = () => { window.__lastImg = img; };
        img.src = 'data:image/png;base64,' + b64;
      };
      window.__pushJpeg = (b64, label) => {
        if (label) window.__label = label;
        const img = new Image();
        img.onload = () => { window.__lastImg = img; };
        img.src = 'data:image/jpeg;base64,' + b64;
      };
      window.__timer = setInterval(() => {
        if (window.__lastImg) ctx.drawImage(window.__lastImg, 0, 0, 1280, 720);
        ctx.fillStyle = 'rgba(8, 12, 20, 0.84)';
        ctx.fillRect(14, 672, 960, 36);
        ctx.fillStyle = '#ffd27d';
        ctx.font = '13px monospace';
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

    let currentStageLabel = 'Init';
    let auditCdp = null;
    auditCdp = await connectCdp(pages[1].webSocketDebuggerUrl, (msg) => {
      if (msg.method === 'Runtime.exceptionThrown') {
        pageErrors.push(msg.params?.exceptionDetails?.text || 'exception');
      } else if (msg.method === 'Page.screencastFrame' && auditCdp) {
        const { data, sessionId } = msg.params;
        auditCdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
        recCdp.evalJs(`window.__pushJpeg(${JSON.stringify(data)}, ${JSON.stringify(currentStageLabel)})`).catch(() => {});
      }
    });

    await auditCdp.send('Page.enable');
    await auditCdp.send('Runtime.enable');
    await auditCdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
    await auditCdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `(() => {
        const origGetContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function(type, opts) {
          if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') {
            opts = Object.assign({}, opts || {}, { preserveDrawingBuffer: true });
          }
          return origGetContext.call(this, type, opts);
        };
      })();`,
    });
    await auditCdp.send('Page.startScreencast', { format: 'jpeg', quality: 84, maxWidth: 1280, maxHeight: 720 });

    const snapPng = async (outFile) => {
      const res = await Promise.race([
        auditCdp.send('Page.captureScreenshot', { format: 'png' }),
        sleep(15000).then(() => { throw new Error('captureScreenshot timeout'); }),
      ]);
      writeFileSync(resolve(__dirname, outFile), Buffer.from(res.data, 'base64'));
      await recCdp.evalJs(`window.__pushFrame(${JSON.stringify(res.data)}, ${JSON.stringify(currentStageLabel)})`).catch(() => {});
    };

    const waitSunReady = async () => {
      for (let i = 0; i < 80; i++) {
        await sleep(200);
        try {
          const ok = await auditCdp.evalJs(`Boolean(window.__sun && document.querySelector('canvas'))`);
          if (ok) break;
        } catch {}
      }
      await sleep(900);
    };

    const waitGlobeReady = async () => {
      for (let i = 0; i < 120; i++) {
        await sleep(250);
        try {
          const ok = await auditCdp.evalJs(`Boolean(window.__globe && window.__globe.bootSettled && window.__globe.stats().drawn > 0)`);
          if (ok) break;
        } catch {}
      }
      await sleep(1400);
    };

    const observations = [];

    // =========================================================================
    // FRAME 0: Cycle-25 Date (`2026-11-15`) White-Light Photosphere at 2200 mm
    // =========================================================================
    currentStageLabel = 'Frame 0: 2026-11-15 White-Light (65.8% Disc Clipped RGB=255, SILSO R=- / 0 Sunspots)';
    await auditCdp.send('Page.navigate', {
      url: `${BASE_URL}/tools/sun.html?date=2026-11-15&elev=space&focal=2200&settled=1`,
    });
    await waitSunReady();
    const entryCheck = await fetch(`${BASE_URL}/src/world/globe/entry.ts`).then((r) => r.text());
    const entryHandlesViewSun = /get\(['"]view['"]\)\s*===\s*['"]sun['"]/.test(entryCheck);

    const frame0Obs = await auditCdp.evalJs(`(() => {
      const camBtn = document.querySelector('#camera-panel button');
      if (camBtn) camBtn.click();
      document.querySelector('#camera-panel input[type="range"]')?.dispatchEvent(new Event('input'));
      const c = document.querySelector('canvas');
      const tmp = document.createElement('canvas');
      tmp.width = c.width; tmp.height = c.height;
      const ctx = tmp.getContext('2d');
      ctx.drawImage(c, 0, 0);
      const cx = Math.floor(c.width / 2), cy = Math.floor(c.height / 2);
      const Rpx = window.__sun.discPx / 2;
      const sampleAtRho = (rho) => {
        const x = Math.round(cx + rho * Rpx);
        const px = ctx.getImageData(x, cy, 1, 1).data;
        return [px[0], px[1], px[2]];
      };
      const x0 = Math.max(0, Math.floor(cx - Rpx)), y0 = Math.max(0, Math.floor(cy - Rpx));
      const img = ctx.getImageData(x0, y0, Math.min(c.width - x0, Math.ceil(2 * Rpx)), Math.min(c.height - y0, Math.ceil(2 * Rpx)));
      let discCount = 0, clippedCount = 0;
      for (let py = 0; py < img.height; py++) {
        for (let px = 0; px < img.width; px++) {
          const dx = (x0 + px - cx) / Rpx, dy = (y0 + py - cy) / Rpx;
          if (dx * dx + dy * dy <= 0.99) {
            discCount++;
            const idx = (py * img.width + px) * 4;
            if (img.data[idx] >= 254 && img.data[idx + 1] >= 254 && img.data[idx + 2] >= 254) clippedCount++;
          }
        }
      }
      return {
        stage: 'frame-0-2026-11-15-photosphere',
        viewSunRoutedInEntry: ${JSON.stringify(entryHandlesViewSun)},
        sunMeta: window.__sun,
        readoutText: document.querySelector('#camera-panel pre')?.textContent || '',
        radialProfileRGB: {
          rho0_00: sampleAtRho(0.0),
          rho0_50: sampleAtRho(0.5),
          rho0_70: sampleAtRho(0.7),
          rho0_85: sampleAtRho(0.85),
          rho0_95: sampleAtRho(0.95),
          rho1_03_offLimbGlare: sampleAtRho(1.03),
        },
        clippedDiscFraction: discCount > 0 ? Number((clippedCount / discCount).toFixed(4)) : 0,
      };
    })()`);
    await sleep(600);
    await snapPng('frame-0.png');
    observations.push(frame0Obs);

    // =========================================================================
    // FRAME 1: Historical Storm (`2024-05-10`, R=172) Requesting `?band=euv171&auto=0` WITHOUT `?unlockAll=1`
    // =========================================================================
    currentStageLabel = 'Frame 1: 2024-05-10 (?band=euv171 Wiped to Visible, Locked Controls, Grey R=G=B Spots, B0=0)';
    await auditCdp.send('Page.navigate', {
      url: `${BASE_URL}/tools/sun.html?date=2024-05-10&elev=space&band=euv171&auto=0&N=16&nd=16.5&focal=2200&settled=1`,
    });
    await waitSunReady();
    const frame1Obs = await auditCdp.evalJs(`(() => {
      const camBtn = document.querySelector('#camera-panel button');
      if (camBtn) camBtn.click();
      document.querySelector('#camera-panel input[type="range"]')?.dispatchEvent(new Event('input'));
      const sel = document.querySelector('#camera-panel select');
      const disabledControls = document.querySelectorAll('#camera-panel [disabled]').length;
      const lockBadges = Array.from(document.querySelectorAll('#camera-panel span')).map((s) => s.textContent).filter((t) => t && t.includes('locked'));
      const c = document.querySelector('canvas');
      const tmp = document.createElement('canvas');
      tmp.width = c.width; tmp.height = c.height;
      const ctx = tmp.getContext('2d');
      ctx.drawImage(c, 0, 0);
      const cx = Math.floor(c.width / 2), cy = Math.floor(c.height / 2);
      const Rpx = window.__sun.discPx / 2;
      const x0 = Math.max(0, Math.floor(cx - Rpx * 0.9)), y0 = Math.max(0, Math.floor(cy - Rpx * 0.9));
      const w0 = Math.min(c.width - x0, Math.ceil(Rpx * 1.8)), h0 = Math.min(c.height - y0, Math.ceil(Rpx * 1.8));
      const img = ctx.getImageData(x0, y0, w0, h0);
      let darkestL = 999, darkestRGB = [255, 255, 255];
      for (let py = 0; py < h0; py++) {
        for (let px = 0; px < w0; px++) {
          const dx = (x0 + px - cx) / Rpx, dy = (y0 + py - cy) / Rpx;
          if (dx * dx + dy * dy > 0.72) continue;
          const idx = (py * w0 + px) * 4;
          const r = img.data[idx], g = img.data[idx + 1], b = img.data[idx + 2];
          const L = r + g + b;
          if (L < darkestL && L > 10) {
            darkestL = L;
            darkestRGB = [r, g, b];
          }
        }
      }
      return {
        stage: 'frame-1-2024-05-10-band-locked-and-grey-sunspots',
        requestedBand: 'euv171',
        activeBandSelectValue: sel ? sel.value : 'unknown',
        disabledControlCount: disabledControls,
        lockBadges,
        sunMeta: window.__sun,
        darkestUmbraPixelRGB: darkestRGB,
        umbraRedToBlueRatio: darkestRGB[2] > 0 ? Number((darkestRGB[0] / darkestRGB[2]).toFixed(4)) : null,
      };
    })()`);
    await sleep(600);
    await snapPng('frame-1.png');
    observations.push(frame1Obs);

    // =========================================================================
    // FRAME 2: Dev Bypass `?unlockAll=1&band=euv171` on `2024-05-10` (`focal=1400`)
    // =========================================================================
    currentStageLabel = 'Frame 2: EUV 171 A (?unlockAll=1) — Dark Raw-Linear Disc RGB(15,12,4) & 2D Co-Planar Chords';
    await auditCdp.send('Page.navigate', {
      url: `${BASE_URL}/tools/sun.html?date=2024-05-10&elev=space&band=euv171&unlockAll=1&focal=1400&settled=1`,
    });
    await waitSunReady();
    const frame2Obs = await auditCdp.evalJs(`(() => {
      const camBtn = document.querySelector('#camera-panel button');
      if (camBtn) camBtn.click();
      document.querySelector('#camera-panel input[type="range"]')?.dispatchEvent(new Event('input'));
      const c = document.querySelector('canvas');
      const tmp = document.createElement('canvas');
      tmp.width = c.width; tmp.height = c.height;
      const ctx = tmp.getContext('2d');
      ctx.drawImage(c, 0, 0);
      const cx = Math.floor(c.width / 2), cy = Math.floor(c.height / 2);
      const Rpx = window.__sun.discPx / 2;
      const sampleAtRho = (rho) => {
        const x = Math.round(cx + rho * Rpx);
        const px = ctx.getImageData(x, cy, 1, 1).data;
        return [px[0], px[1], px[2]];
      };
      const img = ctx.getImageData(0, 0, c.width, c.height);
      let brightPixels = 0, clippedBlueChannelPixels = 0;
      for (let i = 0; i < img.data.length; i += 4) {
        if (img.data[i] >= 250) {
          brightPixels++;
          if (img.data[i + 1] >= 250 && img.data[i + 2] >= 200) clippedBlueChannelPixels++;
        }
      }
      return {
        stage: 'frame-2-2024-05-10-euv171-corona',
        sunMeta: window.__sun,
        euv171ProfileRGB: {
          rho0_00_centre: sampleAtRho(0.0),
          rho0_98_innerLimb: sampleAtRho(0.98),
          rho1_00_limb: sampleAtRho(1.00),
          rho1_04_corona: sampleAtRho(1.04),
          rho1_10_corona: sampleAtRho(1.10),
        },
        brightPixelsCount: brightPixels,
        clippedWhiteActiveRegionPixels: clippedBlueChannelPixels,
      };
    })()`);
    await sleep(600);
    await snapPng('frame-2.png');
    observations.push(frame2Obs);

    // =========================================================================
    // FRAME 3: Polar Nightside/Twilight Orbit View (`?view=globe&omni=gannon`)
    // `hide=plates,clouds` enables `fieldLines` and `aurora` cleanly; `ev=16` matches ISS night exposure!
    // =========================================================================
    currentStageLabel = 'Frame 3: Globe Gannon Aurora & Field Lines (100 km Limb Cutoff, 0.16x Disk Step, L=8 Dipole)';
    await auditCdp.send('Page.navigate', {
      url: `${BASE_URL}/?view=globe&omni=gannon&date=2024-05-11&hour=04&latlon=62,antisun&alt=9500000&ev=16&hide=plates,clouds&tier=1`,
    });
    await waitGlobeReady();
    const frame3Obs = await auditCdp.evalJs(`(() => {
      const labels = Array.from(document.querySelectorAll('#globe-layers label'));
      const flLabel = labels.find((l) => /Field lines/i.test(l.textContent || ''));
      const auLabel = labels.find((l) => /Aurora/i.test(l.textContent || ''));
      const c = document.querySelector('canvas');
      const tmp = document.createElement('canvas');
      tmp.width = c.width; tmp.height = c.height;
      const ctx = tmp.getContext('2d');
      ctx.drawImage(c, 0, 0);
      const img = ctx.getImageData(0, 0, c.width, c.height);
      let greenAuroraPixels = 0, fieldLineBluePixels = 0, nonBlackPixels = 0;
      for (let i = 0; i < img.data.length; i += 4) {
        const r = img.data[i], g = img.data[i + 1], b = img.data[i + 2];
        if (r + g + b > 12) nonBlackPixels++;
        if (g > 35 && g > r * 1.35 && g > b * 1.25) greenAuroraPixels++;
        if (b > 90 && b > r * 1.35) fieldLineBluePixels++;
      }
      return {
        stage: 'frame-3-globe-gannon-aurora-and-magnetosphere',
        globeStats: window.__globe?.stats?.() ?? null,
        layerCount: labels.length,
        auroraChecked: auLabel?.querySelector('input')?.checked ?? false,
        fieldLinesChecked: flLabel?.querySelector('input')?.checked ?? false,
        nonBlackPixels,
        greenAuroraPixels,
        fieldLineBluePixels,
      };
    })()`);
    await sleep(800);
    await snapPng('frame-3.png');
    observations.push(frame3Obs);

    await auditCdp.send('Page.stopScreencast').catch(() => {});

    // Stop MediaRecorder on Tab 0 and write recording.webm
    const webmBase64 = await recCdp.evalJs(`new Promise((resolve) => {
      clearInterval(window.__timer);
      const rec = window.__rec;
      rec.onstop = async () => {
        const blob = new Blob(window.__chunks, { type: 'video/webm' });
        const buf = await blob.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let bin = '';
        for (let i = 0; i < bytes.length; i += 32768) {
          bin += String.fromCharCode(...bytes.subarray(i, i + 32768));
        }
        resolve(btoa(bin));
      };
      rec.stop();
    })`);
    const webmBuf = Buffer.from(webmBase64, 'base64');
    writeFileSync(resolve(__dirname, 'recording.webm'), webmBuf);

    const out = {
      capturedAt: new Date().toISOString(),
      port: PORT,
      recordingBytes: webmBuf.byteLength,
      pageErrors,
      observations,
    };
    writeFileSync(resolve(__dirname, 'observations.json'), JSON.stringify(out, null, 2));
    console.log(JSON.stringify({ ok: true, recordingBytes: webmBuf.byteLength, stages: observations.length, frame3: frame3Obs }, null, 2));

    auditCdp.ws.close();
    recCdp.ws.close();
  } finally {
    if (edge && edge.pid) {
      try { process.kill(edge.pid); } catch {}
    }
    if (viteProc && viteProc.pid) {
      try { process.kill(viteProc.pid); } catch {}
    }
    release();
  }
}

main().catch((err) => {
  console.error(err);
  release();
  process.exit(1);
});
