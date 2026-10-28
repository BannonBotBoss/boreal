/**
 * T-0113 stills. Parade of skinned Meshy animals, then the home landing and a
 * landing that is not home, each close enough that the full mesh is on, two
 * frames apart so a gait step can show.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';

const dir = new URL('.', import.meta.url).pathname;
mkdirSync(dir, { recursive: true });
const port = process.env.PORT || '5288';
const debugPort = process.env.CDP || '9334';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const chrome = spawn('google-chrome', [
  '--headless=new',
  '--no-sandbox',
  '--disable-gpu',
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--window-size=1280,720',
  `--remote-debugging-port=${debugPort}`,
  '--user-data-dir=/tmp/boreal-chrome-t0110',
  'about:blank',
], { stdio: 'ignore' });

async function connect() {
  for (let i = 0; i < 40; i++) {
    try {
      const list = await fetch(`http://127.0.0.1:${debugPort}/json/list`).then(r => r.json());
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

async function shot(send, name) {
  await evalJson(send, `document.getElementById('photo-gallery')?.remove(); document.querySelectorAll('dialog').forEach(d => d.remove());`);
  await sleep(150);
  const png = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${dir}${name}.png`, Buffer.from(png.data, 'base64'));
}

const wsUrl = await connect();
const ws = new WebSocket(wsUrl);
await new Promise((resolve, reject) => { ws.addEventListener('open', resolve); ws.addEventListener('error', reject); });
const send = cdp(ws);
await send('Page.enable');
await send('Runtime.enable');
await send('Page.addScriptToEvaluateOnNewDocument', { source: "Object.defineProperty(Navigator.prototype, 'deviceMemory', { get: () => 8 });" });

const report = [];
if (process.env.SKIP_PARADE) {
  report.push({ name: 'parade', skipped: true });
} else {
await send('Page.navigate', { url: `http://127.0.0.1:${port}/tasks/evidence/T-0113/parade.html` });
const parade = await evalJson(send, `new Promise(resolve => {
  const t0 = performance.now();
  const tick = () => {
    if (document.title === 'ready') resolve({ waited: performance.now() - t0 });
    else if (performance.now() - t0 > 60000) resolve({ timeout: true, title: document.title });
    else setTimeout(tick, 200);
  };
  tick();
})`);
await evalJson(send, `window.__hold = true; window.__pose(0.05)`);
await sleep(300);
await shot(send, 'parade-a');
await evalJson(send, `window.__pose(0.55)`);
await sleep(250);
await shot(send, 'parade-b');
report.push({ name: 'parade', ...parade });
console.log('parade', JSON.stringify(parade));
}

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
report.push({ name: 'boot', ...booted });

async function settle(target) {
  return evalJson(send, `new Promise(resolve => {
    const t0 = performance.now();
    const target = ${target};
    const tick = () => {
      const page = window.__inpage;
      const density = window.borealDensity?.();
      const picture = window.borealPicture?.();
      const waited = performance.now() - t0;
      const heightOk = page && Math.abs(page.height - target) < 30;
      const models = picture && picture.fulls > 0;
      const ready = !document.getElementById('loading') && heightOk && (density?.chunks > 0 || waited > 20000);
      if ((ready && (models || waited > 12000) && waited > 1500) || waited > 40000) resolve({ waited, height: page && page.height, chunks: density && density.chunks, animals: density && density.animals && density.animals.length, picture });
      else setTimeout(tick, 400);
    };
    tick();
  })`);
}

async function embody(name, lat, lon) {
  await evalJson(send, `window.__inpage.placeAt(${lat}, ${lon}, 12)`);
  await settle(12);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'g', code: 'KeyG', windowsVirtualKeyCode: 71 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'g', code: 'KeyG', windowsVirtualKeyCode: 71 });
  const landed = await evalJson(send, `new Promise(resolve => {
    const t0 = performance.now();
    const tick = () => {
      const page = window.__inpage;
      const picture = window.borealPicture?.();
      const waited = performance.now() - t0;
      if (page && page.mode === 'game') resolve({ waited, mode: page.mode, picture });
      else if (waited > 40000) resolve({ waited, timeout: true, mode: page && page.mode, phase: page && page.flightPhase, picture });
      else setTimeout(tick, 200);
    };
    tick();
  })`);
  await evalJson(send, `(() => {
    document.querySelectorAll('dialog').forEach(d => d.close());
    for (const b of document.querySelectorAll('button')) if (b.textContent.trim() === 'Resume' || b.textContent.trim() === 'Done') b.click();
    const view = window.__inpage && window.__inpage.view;
    if (!view) return 'no-view';
    const cam = view.camera;
    if (cam.__aimed) return 'already';
    const prev = cam.updateMatrixWorld.bind(cam);
    let aiming = false;
    cam.updateMatrixWorld = function (force) {
      if (aiming) return prev(force);
      let animal = null;
      view.scene.traverse(o => { if (!animal && o.visible && typeof o.name === 'string' && o.name.startsWith('meshy-')) animal = o; });
      if (!animal) return prev(force);
      aiming = true;
      const q = cam.position.clone();
      animal.getWorldPosition(q);
      cam.position.set(q.x + 2.4, q.y + 0.9, q.z + 3.6);
      cam.lookAt(q.x, q.y + 0.45, q.z);
      aiming = false;
      return prev(force);
    };
    cam.__aimed = true;
    return 'aimed';
  })()`);
  await sleep(500);
  await shot(send, `${name}-a`);
  await sleep(600);
  await shot(send, `${name}-b`);
  const picture = await evalJson(send, `window.borealPicture?.() || null`);
  const row = { name, lat, lon, ...landed, after: picture };
  console.log(name, JSON.stringify(row));
  return row;
}

if (booted.lat || booted.lat === 0) {
  const home = booted;
  report.push(await embody('home', home.lat, home.lon));
  report.push(await embody('boreal', 55, home.lon + 18));
} else {
  report.push({ name: 'landings', skipped: true, reason: 'globe did not boot' });
}

writeFileSync(`${dir}frames.json`, JSON.stringify(report, null, 2));
chrome.kill('SIGKILL');
ws.close();
console.log('wrote', report.map(r => r.name).join(', '));
