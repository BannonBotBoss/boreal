/**
 * T-0104 frames. One deer from the generator, three distances and one fast clock.
 * The deer is the nearest generated deer to the origin (tools run once: x -4.59, z -13.44).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';

const deer = { x: -4.590422557666898, z: -13.43928494490683 };
const dir = new URL('.', import.meta.url).pathname;
const outDir = dir;
mkdirSync(outDir, { recursive: true });

function stand(dist) {
  const len = Math.hypot(deer.x, deer.z);
  const ux = deer.x / len, uz = deer.z / len;
  return { x: deer.x - ux * dist, z: deer.z - uz * dist, yaw: Math.atan2(-ux, -uz) };
}

const chrome = spawn('google-chrome', [
  '--headless=new',
  '--no-sandbox',
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--window-size=1280,720',
  '--remote-debugging-port=9222',
  '--user-data-dir=/tmp/boreal-chrome-t0104',
  'about:blank',
], { stdio: 'ignore' });

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function connect() {
  for (let i = 0; i < 40; i++) {
    try {
      const list = await fetch('http://127.0.0.1:9222/json/list').then(r => r.json());
      const page = list.find(t => t.type === 'page');
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch { /* chrome still starting */ }
    await sleep(250);
  }
  throw new Error('chrome did not open a page');
}

function cdp(ws) {
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', ev => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const msgId = ++id;
    pending.set(msgId, msg => msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result));
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });
  return send;
}

async function evalJson(send, expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
}

const wsUrl = await connect();
const ws = new WebSocket(wsUrl);
await new Promise((resolve, reject) => { ws.addEventListener('open', resolve); ws.addEventListener('error', reject); });
const send = cdp(ws);
await send('Page.enable');
await send('Runtime.enable');
await send('Page.addScriptToEvaluateOnNewDocument', { source: 'window.__errs=[];addEventListener("error",e=>window.__errs.push(String(e.message)));' });

const home = stand(12);
await send('Page.navigate', { url: `http://127.0.0.1:5280/?nomenu=1&noprobe=1&hour=11&at=${home.x},${home.z},${home.yaw}` });
const booted = await evalJson(send, `new Promise(resolve => {
  const t0 = performance.now();
  const tick = () => {
    const loading = document.getElementById('loading');
    const info = window.borealDensity?.();
    const waited = performance.now() - t0;
    const deer = info?.animals?.find(a => a.species === 'deer');
    if (!loading && deer) resolve({ waited, info });
    else if (waited > 50000) resolve({ waited, info, timeout: true });
    else setTimeout(tick, 300);
  };
  tick();
})`);
console.log('boot', JSON.stringify(booted));

function face(from, to, dist) {
  const dx = to.x - from.x, dz = to.z - from.z, len = Math.hypot(dx, dz) || 1;
  const ux = dx / len, uz = dz / len;
  return { x: to.x - ux * dist, z: to.z - uz * dist, yaw: Math.atan2(-ux, -uz) };
}

async function shoot(name, note, place) {
  if (place) await evalJson(send, `window.borealPlace(${place.x}, ${place.z}, ${place.yaw}, 0.42)`);
  await sleep(2500);
  const census = await evalJson(send, `window.borealDensity?.() ?? null`);
  const png = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${outDir}${name}.png`, Buffer.from(png.data, 'base64'));
  console.log(name, JSON.stringify({ note, chunks: census?.chunks, near: census?.near, mid: census?.mid, animals: census?.animals }));
  return { name, note, census };
}

const info = booted.info;
const target = info?.animals?.find(a => a.species === 'deer') ?? info?.animals?.[0];
const nearR = info?.near ?? 40;
const midR = info?.mid ?? 70;
const report = [];
if (!target) {
  report.push({ name: 'none', note: 'no animal loaded', boot: booted });
} else {
  report.push(await shoot('near-individual', 'Close, real time. The animal is a body.', face(home, target, 8)));
  const leave = Math.min(nearR + 6, (nearR + midR) / 2);
  report.push(await shoot('leaving-near', `Just outside the live near radius (${nearR} m). Body and disc together.`, face(home, target, leave)));
  const far = Math.min(midR - 3, nearR + (midR - nearR) * 0.85);
  report.push(await shoot('far-density', `Inside the mid radius (${midR} m), density share leading. The disc has replaced the body.`, face(home, target, far)));
  await evalJson(send, `window.borealRate(20)`);
  report.push(await shoot('fast-herd', 'Back close, clock at 20× (behavioral). The same animal is a herd disc.', face(home, target, 8)));
}
writeFileSync(`${outDir}frames.json`, JSON.stringify(report, null, 2));
chrome.kill('SIGKILL');
ws.close();
console.log('wrote', report.map(r => r.name).join(', '));
