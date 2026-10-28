/**
 * T-0108 stills. The drone after the same descend a double-click uses.
 * Home, a northern boreal point, and a temperate point. Glide, low, and close.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';

const dir = new URL('.', import.meta.url).pathname;
mkdirSync(dir, { recursive: true });
const port = process.env.PORT || '5199';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const chrome = spawn('google-chrome', [
  '--headless=new',
  '--no-sandbox',
  '--disable-gpu',
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--window-size=1280,720',
  '--remote-debugging-port=9333',
  '--user-data-dir=/tmp/boreal-chrome-t0108',
  'about:blank',
], { stdio: 'ignore' });

async function connect() {
  for (let i = 0; i < 40; i++) {
    try {
      const list = await fetch('http://127.0.0.1:9333/json/list').then(r => r.json());
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
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails.exception?.description || r.exceptionDetails));
  return r.result.value;
}

const wsUrl = await connect();
const ws = new WebSocket(wsUrl);
await new Promise((resolve, reject) => { ws.addEventListener('open', resolve); ws.addEventListener('error', reject); });
const send = cdp(ws);
await send('Page.enable');
await send('Runtime.enable');
await send('Page.addScriptToEvaluateOnNewDocument', { source: "Object.defineProperty(Navigator.prototype, 'deviceMemory', { get: () => 8 });" });
await send('Page.navigate', { url: `http://127.0.0.1:${port}/?start=globe&stages=1&trees=v2&nomenu=1&noprobe=1&hour=11&transition=inpage` });

const booted = await evalJson(send, `new Promise(resolve => {
  const t0 = performance.now();
  const tick = () => {
    const g = window.__inpage && window.__inpage.globe;
    const waited = performance.now() - t0;
    if (g && g.planet && g.planet.home) {
      const h = g.planet.home;
      resolve({ waited, lat: Math.asin(Math.max(-1, Math.min(1, h[1]))) * 180 / Math.PI, lon: Math.atan2(h[2], h[0]) * 180 / Math.PI });
    } else if (waited > 120000) resolve({ waited, timeout: true, hasInpage: !!window.__inpage, mode: window.__inpage && window.__inpage.mode, errs: window.__errs || [] });
    else setTimeout(tick, 400);
  };
  tick();
})`);
console.log('boot', JSON.stringify(booted));
if (!booted.lat && booted.lat !== 0) { chrome.kill('SIGKILL'); process.exit(1); }

async function settle() {
  return evalJson(send, `new Promise(resolve => {
    const t0 = performance.now();
    const tick = () => {
      const page = window.__inpage;
      const density = window.borealDensity?.();
      const picture = window.borealPicture?.();
      const waited = performance.now() - t0;
      const ready = page && page.height < 500 && (density?.chunks > 0 || waited > 25000);
      if (ready || waited > 40000) resolve({ waited, height: page?.height, fade: page?.fade, chunks: density?.chunks, animals: density?.animals?.length, picture, remote: density?.animals?.slice?.(0, 4) });
      else setTimeout(tick, 400);
    };
    tick();
  })`);
}

async function shoot(name, lat, lon, height, pitch, back) {
  const placed = await evalJson(send, `window.__inpage.placeAt(${lat}, ${lon}, ${height})`);
  if (pitch !== undefined || back) await evalJson(send, `window.__inpage.setEye(${height}, ${pitch ?? 'undefined'}, ${back || 0})`);
  const info = await settle();
  const png = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${dir}${name}.png`, Buffer.from(png.data, 'base64'));
  const row = { name, lat, lon, height, placed, ...info };
  console.log(name, JSON.stringify(row));
  return row;
}

const home = booted;
const report = [];
report.push(await shoot('home-glide', home.lat, home.lon, 400));
report.push(await shoot('home-low', home.lat, home.lon, 36, -0.9, 0));
report.push(await shoot('home-wolf', home.lat, home.lon, 8, -0.7, 10));
report.push(await shoot('boreal-glide', 55, home.lon + 18, 400));
report.push(await shoot('boreal-low', 55, home.lon + 18, 40, -0.8, 0));
report.push(await shoot('prairie-glide', 42, home.lon + 28, 400));
report.push(await shoot('prairie-close', 42, home.lon + 28, 14, -0.6, 8));
writeFileSync(`${dir}frames.json`, JSON.stringify(report, null, 2));
chrome.kill('SIGKILL');
ws.close();
console.log('wrote', report.map(r => r.name).join(', '));
