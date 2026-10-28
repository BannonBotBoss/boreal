/**
 * T-0112 stills. Same landings as T-0108: home, boreal, prairie, at glide and low.
 * The drone after the same descend a double-click uses.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';

const dir = new URL('.', import.meta.url).pathname;
mkdirSync(dir, { recursive: true });
const port = process.env.PORT || '5286';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const chrome = spawn('google-chrome', [
  '--headless=new',
  '--no-sandbox',
  '--disable-gpu',
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--window-size=1280,720',
  '--remote-debugging-port=9337',
  '--user-data-dir=/tmp/boreal-chrome-t0112',
  'about:blank',
], { stdio: 'ignore' });

async function connect() {
  for (let i = 0; i < 40; i++) {
    try {
      const list = await fetch('http://127.0.0.1:9337/json/list').then(r => r.json());
      const page = list.find(t => t.type === 'page');
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch { /* chrome still starting */ }
    await sleep(250);
  }
  throw new Error('chrome did not open a page');
}

const logs = [];
function cdp(ws) {
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', ev => {
    const msg = JSON.parse(ev.data);
    if (msg.method === 'Runtime.consoleAPICalled') {
      const text = msg.params.args.map(a => a.value ?? a.description ?? '').join(' ');
      if (/error|warn|skirt|horizon|WebGL/i.test(text)) logs.push(text.slice(0, 300));
    }
    if (msg.method === 'Runtime.exceptionThrown') logs.push(String(msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text || 'exception').slice(0, 300));
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
await send('Page.navigate', { url: `http://127.0.0.1:${port}/?start=globe&stages=1&trees=v2&noprobe=1&hour=11&transition=inpage` });

const booted = await evalJson(send, `new Promise(resolve => {
  const t0 = performance.now();
  let asked = false;
  const tick = () => {
    const page = window.__inpage;
    if (page && page.mode === 'game' && !asked) { asked = true; try { page.enter(); } catch (e) {} }
    const g = page && page.globe;
    const waited = performance.now() - t0;
    if (g && g.planet && g.planet.home && page.mode === 'globe') {
      const h = g.planet.home;
      resolve({ waited, mode: page.mode, lat: Math.asin(Math.max(-1, Math.min(1, h[1]))) * 180 / Math.PI, lon: Math.atan2(h[2], h[0]) * 180 / Math.PI });
    } else if (waited > 180000) resolve({ waited, timeout: true, hasInpage: !!page, mode: page && page.mode });
    else setTimeout(tick, 500);
  };
  tick();
})`);
console.log('boot', JSON.stringify(booted));
if (!booted.lat && booted.lat !== 0) { chrome.kill('SIGKILL'); process.exit(1); }

async function settle(target) {
  return evalJson(send, `new Promise(resolve => {
    const t0 = performance.now();
    const target = ${target};
    const tick = () => {
      const page = window.__inpage;
      const density = window.borealDensity?.();
      const waited = performance.now() - t0;
      const heightOk = page && Math.abs(page.height - target) < 25;
      const skirt = page && page.view && page.view.scene.children.find(o => o.userData && o.userData.horizonSkirt);
      const ready = !document.getElementById('loading') && heightOk && skirt && skirt.userData.triangles > 0 && (density?.chunks > 0 || waited > 20000);
      if ((ready && waited > 8000) || waited > 45000) resolve({
        waited, height: page && page.height, fade: page && page.fade, chunks: density && density.chunks,
        skirt: skirt ? { triangles: skirt.userData.triangles, outerM: skirt.userData.outerM, visible: skirt.visible } : null,
      });
      else setTimeout(tick, 400);
    };
    tick();
  })`);
}

async function shoot(name, lat, lon, height, pitch, back) {
  const placed = await evalJson(send, `window.__inpage.placeAt(${lat}, ${lon}, ${height})`);
  if (pitch !== undefined || back) await evalJson(send, `window.__inpage.setEye(${height}, ${pitch ?? 'undefined'}, ${back || 0})`);
  const info = await settle(height);
  const png = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${dir}${name}.png`, Buffer.from(png.data, 'base64'));
  const row = { name, lat, lon, height, placed, ...info };
  console.log(name, JSON.stringify(row));
  return row;
}

const home = booted;
const report = [];
// The glide pitch is the isometric aim the fall actually hands over (about 35° below the horizon).
report.push(await shoot('home-glide', home.lat, home.lon, 400, -0.615, 0));
report.push(await shoot('home-low', home.lat, home.lon, 36, -0.45, 6));
report.push(await shoot('boreal-glide', 55, home.lon + 18, 400, -0.615, 0));
report.push(await shoot('boreal-low', 55, home.lon + 18, 40, -0.45, 8));
report.push(await shoot('prairie-glide', 42, home.lon - 22, 400, -0.615, 0));
report.push(await shoot('prairie-low', 42, home.lon - 22, 36, -0.45, 8));
writeFileSync(`${dir}frames.json`, JSON.stringify({ report, logs: logs.slice(0, 40) }, null, 2));
chrome.kill('SIGKILL');
ws.close();
console.log('wrote', report.map(r => r.name).join(', '));
