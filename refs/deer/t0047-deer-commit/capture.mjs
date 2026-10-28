// Capture in-game frames of deer 1:0:34 at (66.27, 30.91) on seed 1400, hour 12 after chunk 1:0 commits (T-0047).
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquire, release, track } from '../../../tools/bench-lock.mjs';

const dir = dirname(fileURLToPath(import.meta.url));
mkdirSync(dir, { recursive: true });
const PORT = process.argv[2] ?? '5250';
const name = 'agy: t0047 deer-rig-commit capture';
const sleep = ms => new Promise(r => setTimeout(r, ms));

if (!(await acquire(name, { waitMs: 5 * 60 * 1000 }))) throw Error('GPU busy');
let ws;
try {
  const p = spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', [
    '--headless=new',
    '--disable-extensions',
    '--no-first-run',
    '--disable-gpu-vsync',
    '--disable-frame-rate-limit',
    '--remote-debugging-port=9475',
    '--user-data-dir=C:/dev/boreal-agy-edge',
    'about:blank',
  ], { stdio: 'ignore' });
  track(p.pid);

  let tabs;
  for (let i = 0; i < 40; i++) {
    try {
      tabs = await (await fetch('http://127.0.0.1:9475/json')).json();
      break;
    } catch {
      await sleep(500);
    }
  }
  ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise(r => (ws.onopen = r));

  let id = 0;
  const pending = new Map(), errors = [];
  ws.onmessage = e => {
    const d = JSON.parse(e.data);
    if (d.id) {
      pending.get(d.id)?.(d.result);
      pending.delete(d.id);
    }
    if (d.method === 'Runtime.exceptionThrown') errors.push(d.params.exceptionDetails?.text);
  };
  const cdp = (method, params = {}) => new Promise((r, j) => {
    const n = ++id;
    pending.set(n, r);
    ws.send(JSON.stringify({ id: n, method, params }));
    setTimeout(() => { if (pending.delete(n)) j(Error(method + ' timeout')); }, 30000).unref();
  });
  const ev = async expression => {
    const r = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails));
    return r.result?.value;
  };

  await cdp('Runtime.enable');
  await cdp('Page.enable');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 960, height: 540, deviceScaleFactor: 1, mobile: false });

  const url = `http://127.0.0.1:${PORT}/?noprobe&nomenu&hour=12&stages=1&rec&at=66.27,27,3.14159`;
  await cdp('Page.navigate', { url });
  for (let i = 0; i < 120; i++) {
    await sleep(100);
    const ready = await ev(`(() => {
      if (typeof window.borealHold === 'function') window.borealHold(true);
      return typeof window.borealHold === 'function' && !document.getElementById('loading');
    })()`);
    if (ready) break;
  }
  for (let i = 0; i < 60; i++) {
    await sleep(500);
    const q = await ev(`(async () => {
      if (typeof window.borealHold === 'function') window.borealHold(true);
      const interest = await import('/src/core/interest.ts');
      const d = typeof globalThis.borealDensity === 'function' ? globalThis.borealDensity() : null;
      return { queued: interest.queued(), chunks: d?.chunks ?? 0 };
    })()`);
    if (q && q.queued === 0 && q.chunks >= 25) break;
  }
  await sleep(1500);

  const readState = () => ev(`(async () => {
    const interest = await import('/src/core/interest.ts');
    const density = typeof globalThis.borealDensity === 'function' ? globalThis.borealDensity() : null;
    const deerMarks = density ? density.animals.filter(a => a.species === 'deer') : [];
    const chunk1_0_deer = deerMarks.filter(a => a.x >= 48 && a.x < 96 && a.z >= 0 && a.z < 48);
    return {
      queued: interest.queued(),
      jobsRun: interest.STATS.jobsRun,
      chunks: density?.chunks ?? null,
      census: density?.census ?? null,
      deerCount: deerMarks.length,
      chunk1_0_deerCount: chunk1_0_deer.length,
      chunk1_0_deer,
      deerMarks,
      player: globalThis.__boreal?.player?.() ?? null,
    };
  })()`);

  const results = [];
  const infoClose = await readState();
  const shotClose = await cdp('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(dir, 'close-deer-post.png'), Buffer.from(shotClose.data, 'base64'));
  results.push({ name: 'close-deer-post', at: '66.27,27,3.14159', file: 'close-deer-post.png', ...infoClose });

  await ev(`window.borealPlace?.(66.27, 24.5, 3.14159)`);
  await sleep(1500);
  const infoStill = await readState();
  const shotStill = await cdp('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(dir, 'still-deer-post.png'), Buffer.from(shotStill.data, 'base64'));
  results.push({ name: 'still-deer-post', at: '66.27,24.5,3.14159', file: 'still-deer-post.png', ...infoStill });

  const measure = {
    task: 'T-0047',
    seed: 1400,
    hour: 12,
    metric: 'chunkDeerSurvivalRatio = survivingChunkDeer / generatedChunkDeer',
    calibration: {
      knownMismatchPreFix: {
        source: 'tasks/evidence/2026-10-23-grok-loop-0216/deer-drop.json',
        chunk1_0_created: ['1:0:1', '1:0:15', '1:0:34'],
        chunk1_0_dropped: ['1:0:1', '1:0:15', '1:0:34'],
        survivingChunk1_0: 0,
        generatedChunk1_0: 3,
        score: 0.0,
      },
      knownMatchPostFix: {
        chunk1_0_created: ['1:0:1', '1:0:15', '1:0:34'],
        chunk1_0_dropped: [],
        survivingChunk1_0: infoClose.chunk1_0_deerCount,
        generatedChunk1_0: 3,
        score: infoClose.chunk1_0_deerCount / 3,
      },
    },
    shots: results,
    errors,
  };
  writeFileSync(join(dir, 'measure.json'), JSON.stringify(measure, null, 2));
  console.log(JSON.stringify({
    score: measure.calibration.knownMatchPostFix.score,
    chunk1_0_deerCount: infoClose.chunk1_0_deerCount,
    chunk1_0_deer: infoClose.chunk1_0_deer,
  }));
} finally {
  ws?.close();
  release(name);
}
