// One ground view, two stills. Same Chrome flags as refs/water/river-audit/capture.mjs.
// node tasks/evidence/T-0030/oneshot.mjs <port> <name> <x> <z> <yaw>
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, mkdtempSync, rmSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const [PORT = '5214', name = 'step', x = '0', z = '0', yaw = '0'] = process.argv.slice(2);
const dir = 'tasks/evidence/T-0030/' + name; mkdirSync(dir, { recursive: true });
const log = m => appendFileSync('tasks/evidence/T-0030/progress.log', new Date().toISOString() + ' ' + m + '\n');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const EST = `(()=>{const raf=window.requestAnimationFrame.bind(window);let last=0,shader=0,frames=0;window.requestAnimationFrame=function(cb){return raf(function(t){const dt=Math.min((t-last)/1000||0,.05);shader+=dt;last=t;frames++;window.__shaderEst={shader,frames,t};return cb(t);});};})();`;
const profile = mkdtempSync(join(tmpdir(), 'boreal-step-'));
const port = 9491;
const args = ['--headless=new', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-dev-shm-usage', '--no-sandbox', '--disable-extensions', '--no-first-run', '--disable-gpu-vsync', '--disable-frame-rate-limit', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--disable-background-timer-throttling', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'];
const p = spawn('/usr/local/bin/google-chrome', args, { stdio: 'ignore' });
let ws;
try {
  let tabs; for (let i = 0; i < 80; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (tabs.find(t => t.type === 'page')) break; } catch { /* */ } await sleep(400); }
  if (!tabs) throw Error('no debug port');
  ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  let id = 0; const pending = new Map();
  ws.onmessage = e => { const d = JSON.parse(e.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } };
  const cdp = (method, params = {}, ms = 180000) => new Promise((res, rej) => { const n = ++id; pending.set(n, d => d.result !== undefined || d.error ? res(d) : res(d)); ws.send(JSON.stringify({ id: n, method, params })); setTimeout(() => { if (pending.delete(n)) rej(Error(method + ' timeout')); }, ms); });
  const ev = async expression => { const r = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (r.result?.exceptionDetails || r.exceptionDetails) throw Error(JSON.stringify(r.result?.exceptionDetails ?? r.exceptionDetails).slice(0, 400)); return r.result?.result?.value; };
  await cdp('Runtime.enable'); await cdp('Page.enable'); await cdp('Page.bringToFront');
  await cdp('Emulation.setFocusEmulationEnabled', { enabled: true });
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await cdp('Page.addScriptToEvaluateOnNewDocument', { source: EST });
  const url = `http://127.0.0.1:${PORT}/?nomenu&noprobe&rec&hour=12&stages=1&at=${x},${z},${yaw}`;
  await cdp('Page.navigate', { url }); log(name + ' navigated ' + url);
  let ok = false;
  for (let i = 0; i < 240; i++) {
    await sleep(1000);
    const ready = await ev(`({go:document.readyState==='complete' && !document.getElementById('loading') && !!document.querySelector('canvas'), step:document.querySelector('.loading-step')?.textContent??''})`);
    if (i % 15 === 0) log(`${name} wait ${i} ${JSON.stringify(ready)}`);
    if (ready?.go) { ok = true; break; }
  }
  if (!ok) throw Error('not ready');
  await sleep(8000);
  for (let i = 0; i < 40; i++) {
    const est = await ev('window.__shaderEst||null');
    if (est && est.frames > 40) break;
    await sleep(500);
  }
  await ev(`(()=>{const c=document.querySelector('canvas');for(const el of document.body.querySelectorAll('*')){if(el===c||el.contains(c)||el.tagName==='SCRIPT')continue;el.style.visibility='hidden';}c.style.visibility='visible';return 1})()`);
  const shots = [];
  for (let i = 0; i < 2; i++) {
    const est = await ev('({est:window.__shaderEst||null, shader:window.__boreal?.shaderTime?.()??null})');
    const s = await cdp('Page.captureScreenshot', { format: 'png' });
    writeFileSync(`${dir}/flow-${i}.png`, Buffer.from(s.result.data, 'base64'));
    shots.push({ f: `flow-${i}.png`, at: new Date().toISOString(), est });
    log(`${name} flow ${i}`);
    await sleep(1500);
  }
  writeFileSync(`${dir}/observations.json`, JSON.stringify({ name, url, yaw: Number(yaw), shots }, null, 2));
  log(`${name} done`);
} finally { ws?.close(); try { process.kill(p.pid, 'SIGKILL'); } catch { /* */ } try { rmSync(profile, { recursive: true, force: true }); } catch { /* */ } }
