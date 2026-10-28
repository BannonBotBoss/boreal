/**
 * T-0106 frames. Same place, three rates.
 * Real time: animals are bodies. The 8×–12× overlap: bodies still up, density patch on.
 * Past Immediate (20×): bodies gone, the same animals are the step 14 density.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';

const dir = new URL('.', import.meta.url).pathname;
mkdirSync(dir, { recursive: true });

const chrome = spawn('google-chrome', [
  '--headless=new',
  '--no-sandbox',
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--window-size=1280,720',
  '--remote-debugging-port=9226',
  '--user-data-dir=/tmp/boreal-chrome-t0106',
  'about:blank',
], { stdio: 'ignore' });

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function connect() {
  for (let i = 0; i < 40; i++) {
    try {
      const list = await fetch('http://127.0.0.1:9226/json/list').then(r => r.json());
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
  return (method, params = {}) => new Promise((resolve, reject) => {
    const msgId = ++id;
    pending.set(msgId, msg => msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result));
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });
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
await send('Runtime.enable');
const logs = [];
ws.addEventListener('message', ev => {
  const msg = JSON.parse(ev.data);
  if (msg.method === 'Runtime.consoleAPICalled') {
    const text = (msg.params?.args ?? []).map(a => a.value ?? a.description ?? '').join(' ');
    if (/error|warn|chunk|weather|fail/i.test(text)) logs.push(text.slice(0, 240));
  }
});

const deer = { x: -4.590422557666898, z: -13.43928494490683 };
const len = Math.hypot(deer.x, deer.z) || 1;
const ux = deer.x / len, uz = deer.z / len;
const boot = { x: deer.x - ux * 12, z: deer.z - uz * 12, yaw: Math.atan2(-ux, -uz) };
await send('Page.navigate', { url: `http://127.0.0.1:5282/?nomenu=1&noprobe=1&hour=11&at=${boot.x},${boot.z},${boot.yaw}` });
const booted = await evalJson(send, `new Promise(resolve => {
  const t0 = performance.now();
  const tick = () => {
    const loading = document.getElementById('loading');
    const info = window.borealDensity?.();
    const waited = performance.now() - t0;
    const animal = info?.animals?.find(a => a.body > 0.5);
    if (!loading && info?.chunks >= 3 && animal) resolve({ waited, info, errs: window.__errs });
    else if (waited > 80000) resolve({ waited, info, timeout: true, errs: window.__errs });
    else setTimeout(tick, 300);
  };
  tick();
})`);
console.log('boot', JSON.stringify({ waited: booted.waited, timeout: booted.timeout, chunks: booted.info?.chunks, n: booted.info?.animals?.length, errs: booted.errs, logs }));

function face(from, to, dist) {
  const dx = to.x - from.x, dz = to.z - from.z, len = Math.hypot(dx, dz) || 1;
  const ux = dx / len, uz = dz / len;
  return { x: to.x - ux * dist, z: to.z - uz * dist, yaw: Math.atan2(-ux, -uz) };
}

const info = booted.info;
const animals = info?.animals ?? [];
const near = animals.filter(a => Math.hypot(a.x - boot.x, a.z - boot.z) < 25 && a.body > 0.4);
const target = (near.length ? near : animals).slice().sort((a, b) => Math.hypot(a.x - boot.x, a.z - boot.z) - Math.hypot(b.x - boot.x, b.z - boot.z))[0];
const home = target ? face(boot, target, 4.5) : boot;
console.log('target', JSON.stringify(target), 'home', JSON.stringify(home));

async function place(rate) {
  await evalJson(send, `window.borealPlace(${home.x}, ${home.z}, ${home.yaw}, 0.42); window.borealRate(${rate});`);
}
async function snap(rate) {
  // Freeze after one frame at this rate. The picture stays, and the screenshot stall does not move the hares.
  return evalJson(send, `new Promise(resolve => {
    window.borealHold(false);
    window.borealRate(0);
    requestAnimationFrame(() => {
      window.borealRate(${rate});
      requestAnimationFrame(() => {
        window.borealHold(true);
        resolve(window.borealDensity?.() ?? null);
      });
    });
  })`);
}
async function shoot(name, note, rate) {
  const d = await snap(rate);
  const png = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${dir}${name}.png`, Buffer.from(png.data, 'base64'));
  console.log(name, JSON.stringify({
    note, scale: d?.scale, blend: d?.blend, lower: d?.lower, higher: d?.higher, chunks: d?.chunks,
    animals: d?.animals,
  }));
  return { name, note, rate, census: d };
}

const report = [];
if (!target) report.push({ name: 'none', note: 'no animal loaded', boot: booted });
else {
  await place(1);
  let warm = null;
  for (let i = 0; i < 40; i++) {
    await sleep(250);
    warm = await evalJson(send, `window.borealDensity?.() ?? null`);
    if ((warm?.chunks ?? 0) >= 3) break;
  }
  console.log('warm', warm?.chunks);
  report.push(await shoot('slow-individuals', 'Same place, real time. Animals are bodies.', 1));
  report.push(await shoot('mid-blend', 'Same place, 10×, inside the 8×–12× overlap. Bodies still up, density already on.', 10));
  report.push(await shoot('fast-density', 'Same place, 20×, behavioral. The same animals are the density.', 20));
}
writeFileSync(`${dir}frames.json`, JSON.stringify(report, null, 2));
chrome.kill('SIGKILL');
ws.close();
console.log('wrote', report.map(r => r.name).join(', '));
