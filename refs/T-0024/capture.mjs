// T-0024 frame capture. Linux Chrome, not the Windows Edge path in refs/water/shore-audit/capture.mjs.
// The dev server must already be listening: npx vite --host 127.0.0.1 --port 5273
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const PORT = process.argv[2] ?? '5273';
const out = resolve('refs/T-0024');
const sleep = ms => new Promise(r => setTimeout(r, ms));
mkdirSync(out, { recursive: true });
const chrome = '/usr/bin/google-chrome';
const p = spawn(chrome, [
  '--headless=new', '--no-sandbox', '--disable-dev-shm-usage',
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--remote-debugging-port=9473', '--user-data-dir=/tmp/boreal-wake-chrome',
  '--window-size=1280,720', 'about:blank',
], { stdio: 'ignore' });
let ws;
try {
  let tabs;
  for (let i = 0; i < 40; i++) {
    try { tabs = await (await fetch('http://127.0.0.1:9473/json')).json(); break; }
    catch { await sleep(250); }
  }
  if (!tabs) throw Error('chrome devtools did not open');
  ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise(r => { ws.onopen = r; });
  let id = 0; const pending = new Map(); const errors = [];
  ws.onmessage = e => {
    const d = JSON.parse(e.data);
    if (d.id && pending.has(d.id)) { pending.get(d.id)(d.result); pending.delete(d.id); }
    if (d.method === 'Runtime.exceptionThrown') errors.push(d.params?.exceptionDetails?.text ?? 'exception');
  };
  const cdp = (method, params = {}) => new Promise((res, rej) => {
    const n = ++id; pending.set(n, res); ws.send(JSON.stringify({ id: n, method, params }));
    setTimeout(() => { if (pending.delete(n)) rej(Error(method + ' timeout')); }, 45000).unref();
  });
  const ev = async expression => {
    const r = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails).slice(0, 500));
    return r.result?.value;
  };
  const key = (type, k, code, vk) => cdp('Input.dispatchKeyEvent', { type, key: k, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
  await cdp('Runtime.enable'); await cdp('Page.enable');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  const shots = [];
  const shoot = async label => {
    const wake = await ev('window.wake ? window.wake() : null');
    const s = await cdp('Page.captureScreenshot', { format: 'png' });
    writeFileSync(`${out}/${label}.png`, Buffer.from(s.data, 'base64'));
    writeFileSync(`${out}/${label}.json`, JSON.stringify(wake));
    shots.push(label);
  };
  const go = async url => {
    await cdp('Page.navigate', { url });
    let ok = false;
    for (let i = 0; i < 90; i++) {
      await sleep(1000);
      const ready = await ev("document.readyState==='complete' && !document.getElementById('loading') && !!window.wake");
      if (ready) { ok = true; break; }
    }
    if (!ok) throw Error('page not ready ' + url);
    await sleep(1500);
  };
  // Open water with a clear run ahead. Seed 1400, staged: (20, -60) stays wet for 40 m walking +z
  // (heading π). 0,0 is a pond the wolf leaves in a few strides, so rings there fall under the shore.
  await go(`http://127.0.0.1:${PORT}/?nomenu&bench&hour=12&top=1&wake&at=20,-60,3.141592653589793`);
  await sleep(6000); // let the meter move off the first blown frame (render/exposure tauLight 0.4 s of sim)
  await shoot('top-before');
  await key('keyDown', 'w', 'KeyW', 87);
  // Stay on the key. Headless sim is slower than the wall clock, and the 8-ring cap keeps only the last
  // strides, so the walk has to be long before the oldest front is outside the body.
  await sleep(16000); await shoot('top-walk');
  await key('keyUp', 'w', 'KeyW', 87);
  await sleep(6000); await shoot('top-stop');
  // He has stopped on the dark water. More waiting only ages the rings; it does not walk him into the glint.
  await sleep(20000); await shoot('top-aged');
  // Third person, from dry ground at x=18 walking west (heading pi/2) into the water at x≈12.
  await go(`http://127.0.0.1:${PORT}/?nomenu&bench&hour=12&wake&at=18,0,1.571`);
  await key('keyDown', 'w', 'KeyW', 87);
  await sleep(2500); await shoot('wade-3');
  await sleep(2000); await shoot('wade-5');
  await key('keyUp', 'w', 'KeyW', 87);
  await sleep(1200); await shoot('wade-stop');
  const info = await ev(`({href:location.href,w:innerWidth,h:innerHeight,gl:!!document.querySelector('canvas')})`);
  writeFileSync(`${out}/observations.json`, JSON.stringify({ port: PORT, info, shots, errors }, null, 2));
  console.log(JSON.stringify({ shots, errors, info }));
} finally { ws?.close(); p.kill(); }
