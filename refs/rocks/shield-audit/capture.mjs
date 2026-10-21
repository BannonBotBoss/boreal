// Rock, boulder & Canadian Shield outcrop inspection capture (agy loop).
// Run from the worktree root with a dev server on PORT: node refs/rocks/shield-audit/capture.mjs [port]
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { acquire, track, release } from '../../../tools/bench-lock.mjs';

const PORT = process.argv[2] ?? '5250';
const name = 'agy: rock shield audit';
const out = resolve('refs/rocks/shield-audit');
const sleep = ms => new Promise(r => setTimeout(r, ms));
mkdirSync(out, { recursive: true });

if (!await acquire(name, { waitMs: 5 * 60 * 1000 })) throw Error('GPU busy');
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
  await new Promise(r => ws.onopen = r);

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
    setTimeout(() => { if (pending.delete(n)) j(Error(method + ' timeout')); }, 60000).unref();
  });
  const ev = async expression => {
    const r = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails));
    return r.result?.value;
  };
  const key = (type, k, code, vk) => cdp('Input.dispatchKeyEvent', { type, key: k, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });

  await cdp('Runtime.enable');
  await cdp('Page.enable');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });

  const shots = [];
  const shoot = async (label, n, gapMs) => {
    for (let i = 0; i < n; i++) {
      const s = await cdp('Page.captureScreenshot', { format: 'png' });
      const f = `${label}-${i}.png`;
      writeFileSync(`${out}/${f}`, Buffer.from(s.data, 'base64'));
      shots.push({ f, t: Date.now() });
      await sleep(gapMs);
    }
  };
  const go = async url => {
    await cdp('Page.navigate', { url });
    let ok = false;
    for (let i = 0; i < 120; i++) {
      await sleep(1000);
      if (await ev("document.readyState==='complete' && !document.getElementById('loading')")) {
        ok = true;
        break;
      }
    }
    if (!ok) throw Error('not ready ' + url);
    await sleep(5500);
  };
  const rec = () => ev(`(()=>{const c=document.querySelector('canvas');window.auditChunks=[];window.auditRecorder=new MediaRecorder(c.captureStream(15),{mimeType:'video/webm'});auditRecorder.ondataavailable=e=>auditChunks.push(e.data);auditRecorder.start();})()`);
  const stop = async file => {
    const v = await ev(`new Promise(r=>{auditRecorder.onstop=()=>{const f=new FileReader();f.onload=()=>r(f.result.split(',')[1]);f.readAsDataURL(new Blob(auditChunks,{type:'video/webm'}));};auditRecorder.stop();})`);
    writeFileSync(`${out}/${file}`, Buffer.from(v, 'base64'));
  };

  // 1) Forest floor on clay/till near (38.5, -1.5) facing north (yaw=0 -> -z)
  await go(`http://127.0.0.1:${PORT}/?nomenu&bench&hour=11&at=38.5,-1.5,0`);
  await rec();
  await shoot('forest-floor', 3, 900);
  await cdp('Page.bringToFront');
  await key('keyDown', 'w', 'KeyW', 87);
  await shoot('forest-walk', 4, 800);
  await key('keyUp', 'w', 'KeyW', 87);
  await stop('forest-rocks.webm');

  // 2) Upland Canadian Shield bedrock ridge (soil='bedrock', siteAt.rock = 0.85, h=7.2..8.8 m) at (128.7, 21.5) facing north (yaw=0 -> -z)
  await go(`http://127.0.0.1:${PORT}/?nomenu&bench&hour=11&at=128.7,21.5,0`);
  await rec();
  await shoot('upland-ridge', 3, 900);
  await cdp('Page.bringToFront');
  await key('keyDown', 'w', 'KeyW', 87);
  await shoot('upland-walk', 4, 800);
  await key('keyUp', 'w', 'KeyW', 87);
  await stop('upland-ridge.webm');

  const info = await ev(`({href:location.href, w:innerWidth, h:innerHeight, status:document.getElementById('status')?.textContent})`);
  writeFileSync(`${out}/observations.json`, JSON.stringify({ port: PORT, info, shots, errors }, null, 2));
  console.log(JSON.stringify({ shots: shots.length, errors }));
} finally {
  ws?.close();
  release(name);
}
