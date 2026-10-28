// Capture in-game frame at seed-1400 juniper (145.16, 208.49) on tile (7, 10) using preview port 5250.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import { acquire, release, track } from '../../../tools/bench-lock.mjs';

const dir = dirname(fileURLToPath(import.meta.url));
mkdirSync(dir, { recursive: true });
const PORT = process.argv[2] ?? '5250';
const name = 'agy: t0049 juniper capture';
const sleep = ms => new Promise(r => setTimeout(r, ms));

function decodePng(d) {
  let i = 8, w = 0, h = 0, ct = 0;
  const idat = [];
  while (i < d.length) {
    const n = d.readUInt32BE(i);
    const t = d.toString('latin1', i + 4, i + 8);
    const c = d.subarray(i + 8, i + 8 + n);
    if (t === 'IHDR') { w = c.readUInt32BE(0); h = c.readUInt32BE(4); ct = c[9]; }
    if (t === 'IDAT') idat.push(c);
    i += 12 + n;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const bpp = ct === 6 ? 4 : 3;
  const stride = w * bpp;
  const rows = [];
  let prev = new Uint8Array(stride), p = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[p];
    const line = Uint8Array.from(raw.subarray(p + 1, p + 1 + stride));
    p += 1 + stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? line[x - bpp] : 0;
      const b = prev[x];
      const c = x >= bpp ? prev[x - bpp] : 0;
      if (f === 1) line[x] = (line[x] + a) & 255;
      else if (f === 2) line[x] = (line[x] + b) & 255;
      else if (f === 3) line[x] = (line[x] + ((a + b) >> 1)) & 255;
      else if (f === 4) {
        const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
        line[x] = (line[x] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
      }
    }
    rows.push(line);
    prev = line;
  }
  return { w, h, bpp, rows };
}

function stats(buf) {
  const { w, h, bpp, rows } = decodePng(buf);
  let r = 0, g = 0, b = 0, n = 0;
  const y0 = Math.floor(h * 0.45);
  for (let y = y0; y < h; y++) {
    const row = rows[y];
    for (let x = 0; x < w; x++) {
      const i = x * bpp;
      r += row[i]; g += row[i + 1]; b += row[i + 2]; n++;
    }
  }
  return { lower: [+(r / n).toFixed(1), +(g / n).toFixed(1), +(b / n).toFixed(1)] };
}

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

  await cdp('Page.navigate', { url: `http://127.0.0.1:${PORT}/?noprobe&nomenu&stages=1&hour=12&at=145.16,212.5,0` });
  for (let i = 0; i < 120; i++) {
    await sleep(1000);
    if (await ev("document.readyState==='complete' && !document.getElementById('loading')")) break;
  }

  let settled = null;
  for (let i = 0; i < 30; i++) {
    await sleep(1000);
    const s = await cdp('Page.captureScreenshot', { format: 'png' });
    const buf = Buffer.from(s.data, 'base64');
    const st = stats(buf);
    if (st.lower[0] < 118) {
      settled = st;
      break;
    }
  }

  await ev(`globalThis.borealFlora.fx.view = { x: 145.16, y: 1.15, z: 208.49 + 2.4, yaw: 0, pitch: -0.4 }`);
  await sleep(3000);
  const shot = await cdp('Page.captureScreenshot', { format: 'png' });
  const buf = Buffer.from(shot.data, 'base64');
  const st = stats(buf);
  writeFileSync(join(dir, 'juniper-close-post.png'), buf);

  const flora = await ev(`globalThis.borealFlora?.info`);
  writeFileSync(join(dir, 'capture.json'), JSON.stringify({ port: PORT, file: 'juniper-close-post.png', settled, stats: st, flora, errors }, null, 2));
  console.log(JSON.stringify({ file: 'juniper-close-post.png', settled, stats: st, flora, errors }));
} finally {
  ws?.close();
  release(name);
}
