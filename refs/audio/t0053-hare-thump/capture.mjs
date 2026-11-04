import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
mkdirSync(dir, { recursive: true });
try { rmSync(join(dir, '.tmp-edge-profile'), { recursive: true, force: true }); } catch {}

const PORT = 5250;
const CDP_PORT = 9365;
const URL = `http://127.0.0.1:${PORT}/?noprobe&nomenu&hour=12&rec&stages=1&at=200,250,-1.553`;
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const profileDir = mkdtempSync(join(tmpdir(), 'agy-t0053-'));

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function waitForUrl(url, timeoutMs = 30000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try {
      const r = await fetch(url);
      if (r.ok) return true;
    } catch {}
    await sleep(250);
  }
  throw new Error(`Timeout waiting for ${url}`);
}

const SOUND_HOOK = `
(() => {
  const events = [];
  const bufId = new WeakMap();
  const abUrl = new WeakMap();
  window.__soundLog = events;
  const origAB = Response.prototype.arrayBuffer;
  Response.prototype.arrayBuffer = async function () {
    const buf = await origAB.call(this);
    try { if (this.url && this.url.includes('/sounds/')) abUrl.set(buf, this.url.split('/').pop().replace('.mp3', '')); } catch {}
    return buf;
  };
  const origDec = AudioContext.prototype.decodeAudioData;
  AudioContext.prototype.decodeAudioData = function (data) {
    const id = abUrl.get(data);
    const p = origDec.apply(this, arguments);
    return Promise.resolve(p).then(audio => { if (id && audio) bufId.set(audio, id); return audio; });
  };
  const origCreate = AudioContext.prototype.createBufferSource;
  AudioContext.prototype.createBufferSource = function () {
    const src = origCreate.call(this);
    let buf = null;
    try {
      Object.defineProperty(src, 'buffer', {
        configurable: true,
        get() { return buf; },
        set(v) { buf = v; src.__id = (v && bufId.get(v)) || src.__id || null; },
      });
    } catch {}
    return src;
  };
  const origStart = AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start = function (when, offset, duration) {
    events.push({ t: Math.round(performance.now()), kind: 'start', id: this.__id || null, loop: !!this.loop, offset: offset ?? null, duration: duration ?? null });
    return origStart.apply(this, arguments);
  };
  const NativePanner = window.PannerNode;
  function WrappedPanner(ctx, opts) {
    const p = new NativePanner(ctx, opts);
    events.push({ t: Math.round(performance.now()), kind: 'pan', x: opts && opts.positionX, z: opts && opts.positionZ });
    return p;
  }
  WrappedPanner.prototype = NativePanner.prototype;
  window.PannerNode = WrappedPanner;
})();
`;

/**
 * Calibrated metric for T-0053:
 * - On an approach where >= 1 hare bolts, the Web Audio start log must contain >= 1 'hare-hop' and 0 'hare-squeak'.
 * - On a capture, the Web Audio start log must contain exactly 1 'hare-squeak'.
 */
function scoreHareAudio(approachNonLoopIds, captureIds) {
  const hasBoltThump = approachNonLoopIds.includes('hare-hop');
  const noBoltSqueak = !approachNonLoopIds.includes('hare-squeak');
  const captureSqueaks = captureIds.filter(id => id === 'hare-squeak').length;
  const checks = [hasBoltThump, noBoltSqueak, captureSqueaks === 1];
  return checks.filter(Boolean).length / checks.length;
}

let vite;
let edge;
try {
  vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], {
    cwd: join(dir, '../../..'),
    stdio: 'ignore',
  });
  await waitForUrl(`http://127.0.0.1:${PORT}/`);

  edge = spawn(EDGE, [
    '--headless=new',
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${profileDir}`,
    '--window-size=960,540',
    '--autoplay-policy=no-user-gesture-required',
    '--disable-gpu-vsync',
    '--disable-frame-rate-limit',
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
    '--disable-background-timer-throttling',
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank',
  ], { stdio: 'ignore' });

  await waitForUrl(`http://127.0.0.1:${CDP_PORT}/json/version`);
  const targets = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json();
  const pageTarget = targets.find(t => t.type === 'page');
  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

  let seq = 0;
  const pending = new Map();
  ws.onmessage = ev => {
    const msg = JSON.parse(String(ev.data));
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) p.rej(new Error(msg.error.message));
      else p.res(msg.result);
    }
  };
  const send = (method, params = {}) => new Promise((res, rej) => {
    const id = ++seq;
    pending.set(id, { res, rej });
    ws.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    return r.result?.value;
  };
  const shot = async name => {
    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(dir, name), Buffer.from(data, 'base64'));
  };

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Page.bringToFront');
  await send('Emulation.setFocusEmulationEnabled', { enabled: true });
  await send('Emulation.setDeviceMetricsOverride', { width: 960, height: 540, deviceScaleFactor: 1, mobile: false });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: SOUND_HOOK });
  await send('Page.navigate', { url: URL });

  // Wait for world & hares to spawn; if Vite dep optimizer reloaded on first request, reload once
  for (let i = 0; i < 120; i++) {
    const state = await evaluate(`({
      ready: Boolean(!document.querySelector('#loading') && window.borealHares?.list?.()?.length > 0),
      failed: Boolean(document.body?.innerText?.includes('could not start')),
    })`);
    if (state?.ready) break;
    if (state?.failed) {
      await send('Page.reload', {});
      await sleep(2000);
    }
    await sleep(500);
  }
  await sleep(1500);

  // Trigger user gesture to start BorealSound and wait until all sound buffers decode (loop starts)
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 480, y: 270, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 480, y: 270, button: 'left', clickCount: 1 });
  for (let i = 0; i < 60; i++) {
    const loopStarts = await evaluate(`(window.__soundLog ?? []).filter(e => e.kind === 'start' && e.loop).length`);
    if (loopStarts >= 4) break;
    await sleep(250);
  }
  await sleep(500);

  const approachStartIdx = await evaluate(`(window.__soundLog ?? []).length`);

  // Step the wolf toward hare id 2 (or nearest hare) until it bolts
  let bolted = null;
  const t0 = Date.now();
  while (Date.now() - t0 < 45000) {
    const step = await evaluate(`(() => {
      const p = window.__boreal?.player?.();
      const list = window.borealHares?.list?.() ?? [];
      if (!p || !list.length) return null;
      let best = null;
      for (const h of list) {
        const d = Math.hypot(h.x - p.x, h.z - p.z);
        if (!best || d < best.d) best = { id: h.id, x: h.x, z: h.z, d: Math.round(d * 100) / 100, state: h.state, sim: h.sim?.state, level: Math.round((h.sim?.level ?? 0) * 1000) / 1000 };
      }
      if (!best) return null;
      if (best.sim === 'flee' || best.state === 'flee') return { done: true, best, player: p };
      const dx = best.x - p.x, dz = best.z - p.z, dist = Math.hypot(dx, dz);
      const yaw = Math.atan2(-dx, -dz);
      const stepM = Math.min(0.45, Math.max(0.15, dist - 2.2));
      const nx = p.x + (dx / dist) * stepM, nz = p.z + (dz / dist) * stepM;
      window.borealPlace?.(nx, nz, yaw);
      return { done: false, best, player: { x: nx, z: nz, yaw } };
    })()`);
    if (step?.done) {
      bolted = step.best;
      break;
    }
    await sleep(120);
  }
  await sleep(300);
  await shot('hare-bolt.png');

  const approachEvents = await evaluate(`(window.__soundLog ?? []).slice(${approachStartIdx})`);
  const approachStarts = approachEvents.filter(e => e.kind === 'start');
  const approachPans = approachEvents.filter(e => e.kind === 'pan');

  // Now test capture: place the wolf directly on a hare to trigger capture (1 hare-squeak)
  const captureStartIdx = await evaluate(`(window.__soundLog ?? []).length`);
  const capturedHare = await evaluate(`(() => {
    const list = window.borealHares?.list?.() ?? [];
    const target = list.find(h => !h.sim?.heldBy) ?? list[0];
    if (!target) return null;
    window.borealPlace?.(target.x, target.z, 0);
    return { id: target.id, x: Math.round(target.x * 100) / 100, z: Math.round(target.z * 100) / 100 };
  })()`);
  await sleep(500);
  await shot('hare-capture.png');

  const captureEvents = await evaluate(`(window.__soundLog ?? []).slice(${captureStartIdx})`);
  const captureStarts = captureEvents.filter(e => e.kind === 'start');

  const knownMismatchScore = scoreHareAudio(
    ['hare-squeak', 'hare-hop', 'paw-walk', 'hare-squeak', 'hare-hop'],
    ['hare-squeak']
  );
  const knownMatchScore = scoreHareAudio(
    ['hare-hop', 'paw-walk', 'hare-hop'],
    ['hare-squeak']
  );
  const postFixScore = scoreHareAudio(
    approachStarts.filter(s => !s.loop).map(s => s.id),
    captureStarts.filter(s => !s.loop).map(s => s.id)
  );

  const report = {
    task: 'T-0053',
    url: URL,
    viewport: [960, 540],
    bolted,
    approach: {
      starts: approachStarts,
      pans: approachPans,
      nonLoopIds: approachStarts.filter(s => !s.loop).map(s => s.id),
    },
    capture: {
      hare: capturedHare,
      starts: captureStarts,
      nonLoopIds: captureStarts.filter(s => !s.loop).map(s => s.id),
    },
    calibration: {
      metric: 'scoreHareAudio(approachNonLoopIds, captureIds): fraction of 3 checks satisfied (bolt starts hare-hop, bolt starts 0 hare-squeak, capture starts 1 hare-squeak)',
      knownMismatchScore,
      knownMatchScore,
      postFixScore,
    },
  };

  writeFileSync(join(dir, 'capture.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify(report.calibration));
  ws.close();
} finally {
  try { edge?.kill(); } catch {}
  try { vite?.kill(); } catch {}
  try { rmSync(profileDir, { recursive: true, force: true }); } catch {}
  process.exit(0);
}
