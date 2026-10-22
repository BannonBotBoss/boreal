// Littoral plants inspection & verification capture (T-0025, agy).
// Adapted from refs/water/shore-audit/capture.mjs; waits for grass/flora interest jobs to settle before shooting.
// Run from the worktree root with a dev server on PORT: node refs/water/littoral-audit/capture.mjs [port]
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { acquire, track, release } from '../../../tools/bench-lock.mjs';

const PORT = process.argv[2] ?? '5250', name = 'agy: littoral plants T-0025', out = resolve('refs/water/littoral-audit');
const sleep = ms => new Promise(r => setTimeout(r, ms));
mkdirSync(out, { recursive: true });
if (!await acquire(name, { waitMs: 5 * 60 * 1000 })) throw Error('GPU busy');
let ws;
try {
  const p = spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', [
    '--headless=new', '--disable-extensions', '--no-first-run',
    '--remote-debugging-port=9475', '--user-data-dir=C:/dev/boreal-agy-edge', 'about:blank'
  ], { stdio: 'ignore' });
  track(p.pid);
  let tabs;
  for (let i = 0; i < 40; i++) {
    try { tabs = await (await fetch('http://127.0.0.1:9475/json')).json(); break; } catch { await sleep(500); }
  }
  ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  let id = 0;
  const pending = new Map(), errors = [];
  ws.onmessage = e => {
    const d = JSON.parse(e.data);
    if (d.id) { pending.get(d.id)?.(d.result); pending.delete(d.id); }
    if (d.method === 'Runtime.exceptionThrown') errors.push(d.params.exceptionDetails?.text);
  };
  const cdp = (method, params = {}) => new Promise((r, j) => {
    const n = ++id; pending.set(n, r);
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
  const go = async (url) => {
    await cdp('Page.navigate', { url: 'about:blank' });
    await sleep(300);
    await cdp('Page.navigate', { url });
    let ok = false;
    for (let i = 0; i < 120; i++) {
      await sleep(1000);
      try {
        if (await ev("Boolean(document.querySelector('canvas')) && document.readyState==='complete' && !document.getElementById('loading')")) { ok = true; break; }
      } catch {}
    }
    if (!ok) throw Error('not ready ' + url);
    // Wait for sliced grass and flora jobs around the shore to finish building
    for (let i = 0; i < 20; i++) {
      await sleep(500);
      try {
        const ready = await ev(`(window.borealGrass?.info?.tiles ?? 0) >= 20 && (window.borealFlora?.info?.geometries ?? 0) > 0 && (window.borealFlora?.info?.tiles ?? 0) >= 9`);
        if (ready && i >= 8) break;
      } catch {}
    }
  };
  const rec = () => ev(`(()=>{const c=document.querySelector('canvas');window.auditChunks=[];window.auditRecorder=new MediaRecorder(c.captureStream(15),{mimeType:'video/webm'});auditRecorder.ondataavailable=e=>auditChunks.push(e.data);auditRecorder.start();})()`);
  const stop = async (file) => {
    const v = await ev(`new Promise(r=>{auditRecorder.onstop=()=>{const f=new FileReader();f.onload=()=>r(f.result.split(',')[1]);f.readAsDataURL(new Blob(auditChunks,{type:'video/webm'}));};auditRecorder.stop();})`);
    writeFileSync(`${out}/${file}`, Buffer.from(v, 'base64'));
  };

  // 1) Noon, shore at x=30 facing west (heading pi/2 = -x) across open water (same view as refs/water/shore-audit)
  await go(`http://127.0.0.1:${PORT}/?nomenu&bench&hour=12&at=30,0,1.571`);
  const statsNoon30 = await ev(`({ grass: window.borealGrass?.info, flora: window.borealFlora?.info })`);
  await rec();
  await shoot('noon', 4, 900);

  // 2) Walk west into the littoral shallows: W held ~4.8 s
  await cdp('Page.bringToFront');
  await key('keyDown', 'w', 'KeyW', 87);
  await shoot('wade', 6, 800);
  await key('keyUp', 'w', 'KeyW', 87);
  await sleep(1500);
  await shoot('wade-stop', 2, 900);
  await stop('noon-wade.webm');
  const statsWadeStop = await ev(`({ grass: window.borealGrass?.info, flora: window.borealFlora?.info })`);

  // 3) Shoreline close view at x=17.5 facing west (matching t0025-littoral.png 1.6 m eye-level littoral belt composition)
  await go(`http://127.0.0.1:${PORT}/?nomenu&bench&hour=12&at=17.5,0,1.571`);
  await rec();
  await shoot('littoral-close', 3, 900);
  await stop('littoral-close.webm');
  const statsClose = await ev(`({ grass: window.borealGrass?.info, flora: window.borealFlora?.info })`);

  // 4) Evening (19:30) on the x=30 view
  await go(`http://127.0.0.1:${PORT}/?nomenu&bench&hour=19.5&at=30,0,1.571`);
  await rec();
  await shoot('evening', 4, 900);
  await stop('evening.webm');

  const info = await ev(`({href:location.href, w:innerWidth, h:innerHeight, status:document.getElementById('status')?.textContent})`);
  writeFileSync(`${out}/observations.json`, JSON.stringify({ port: PORT, info, statsNoon30, statsWadeStop, statsClose, shots, errors }, null, 2));
  console.log(JSON.stringify({ shots: shots.length, errors, statsNoon30, statsWadeStop, statsClose }));
} finally {
  ws?.close();
  release(name);
}
