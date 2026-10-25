// River inspection capture (claude loop, 2026-10-21). Same CDP pattern as refs/water/shore-audit/capture.mjs.
// One bench-lock hold per site (max hold 10 min; release kills the browser it launched).
// Run from the worktree root with a dev server on PORT:
//   node refs/water/river-audit/capture.mjs <port> [site ...]
// RIVER_AUDIT_OUT writes a copy (after-frames) without touching refs/water/river-audit/<site>/.
// CHROME overrides the browser. Windows stays on Edge; Linux uses Chrome + SwiftShader.
// Sites come from views.json. Per site at noon: one still facing across, two stills 1.5 s apart for the
// texture-speed measurement, one still facing downstream. DOM overlays are hidden. SwiftShader readback is slow,
// so each screenshot is allowed 180 s. ?noprobe skips the globe prewarm (main.ts).
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, mkdtempSync, rmSync, existsSync, appendFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir, platform } from 'node:os';
import { acquire, track, release } from '../../../tools/bench-lock.mjs';
const [PORT = '5214', ...want] = process.argv.slice(2);
const viewsPath = resolve('refs/water/river-audit/views.json');
const out = resolve(process.env.RIVER_AUDIT_OUT ?? 'refs/water/river-audit');
const views = JSON.parse(readFileSync(viewsPath, 'utf8'));
const linux = platform() !== 'win32';
const chrome = process.env.CHROME ?? (linux
  ? (existsSync('/usr/local/bin/google-chrome') ? '/usr/local/bin/google-chrome' : '/usr/bin/google-chrome')
  : 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = [];
const EST = `(()=>{const raf=window.requestAnimationFrame.bind(window);let last=0,shader=0,frames=0;window.requestAnimationFrame=function(cb){return raf(function(t){const dt=Math.min((t-last)/1000||0,.05);shader+=dt;last=t;frames++;window.__shaderEst={shader,frames,t};return cb(t);});};})();`;
for (const site of want.length ? want : Object.keys(views)) {
  const v = views[site]; if (!v) continue; const name = `grokbot-3: river audit ${site}`, dir = `${out}/${site}`; mkdirSync(dir, { recursive: true });
  const locked = process.env.RIVER_AUDIT_NO_LOCK ? false : await acquire(name, { waitMs: 10 * 60 * 1000 });
  if (!process.env.RIVER_AUDIT_NO_LOCK && !locked) throw Error('GPU busy');
  let ws, browserPid; const profile = mkdtempSync(join(tmpdir(), 'boreal-river-chrome-')), port = 9480 + Object.keys(views).indexOf(site) * 3 + (Date.now() % 3);
  try {
    const args = ['--headless=new', '--disable-extensions', '--no-first-run', '--disable-gpu-vsync', '--disable-frame-rate-limit', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--disable-background-timer-throttling', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'];
    if (linux) args.splice(1, 0, '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-dev-shm-usage', '--no-sandbox');
    else args.splice(1, 0, '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist');
    const p = spawn(chrome, args, { stdio: 'ignore' }); track(p.pid); browserPid = p.pid;
    let tabs; for (let i = 0; i < 120; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (tabs.find(t => t.type === 'page')) break; } catch { /* port not up */ } await sleep(500); }
    if (!tabs) throw Error('browser debug port did not open');
    ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
    let id = 0; const pending = new Map(), errors = [];
    ws.onmessage = e => { const d = JSON.parse(e.data); if (d.id) { pending.get(d.id)?.(d.result); pending.delete(d.id); } if (d.method === 'Runtime.exceptionThrown') errors.push(d.params.exceptionDetails?.exception?.description?.slice(0, 300) ?? d.params.exceptionDetails?.text); if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') errors.push(String(d.params.args?.[0]?.value ?? d.params.args?.[0]?.description ?? '').slice(0, 300)); };
    const cdp = (method, params = {}, ms = 180000) => new Promise((r, j) => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); setTimeout(() => { if (pending.delete(n)) j(Error(method + ' timeout')); }, ms).unref(); });
    const ev = async expression => { const r = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails).slice(0, 500)); return r.result?.value; };
    await cdp('Runtime.enable'); await cdp('Page.enable'); await cdp('Page.bringToFront');
    await cdp('Emulation.setFocusEmulationEnabled', { enabled: true });
    try { await cdp('Page.setWebLifecycleState', { state: 'active' }); } catch { /* older CDP */ }
    await cdp('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
    const shots = [];
    const hideUi = () => ev(`(()=>{const c=document.querySelector('canvas');for(const el of document.body.querySelectorAll('*')){if(el===c||el.contains(c)||el.tagName==='SCRIPT')continue;el.style.visibility='hidden';}c.style.visibility='visible';return 1})()`);
    const shoot = async (label, n, gapMs) => { for (let i = 0; i < n; i++) { const s = await cdp('Page.captureScreenshot', { format: 'png' }); const f = `${label}-${i}.png`; writeFileSync(`${dir}/${f}`, Buffer.from(s.data, 'base64')); const est = await ev('window.__shaderEst||null'); shots.push({ f, at: new Date().toISOString(), est }); await sleep(gapMs); } };
    const go = async (heading) => {
      await cdp('Page.addScriptToEvaluateOnNewDocument', { source: EST });
      const url = `http://127.0.0.1:${PORT}/?nomenu&noprobe&hour=12&stages=1&at=${v.view.x},${v.view.z},${heading}`;
      await cdp('Page.navigate', { url });
      let ok = false; for (let i = 0; i < 360; i++) { await sleep(1000); const ready = await ev(`({go:document.readyState==='complete' && !document.getElementById('loading') && !!document.querySelector('canvas'), step:document.querySelector('.loading-step')?.textContent??''})`); if (i % 15 === 0) appendFileSync(`${out}/progress.log`, `${new Date().toISOString()} ${site} ${heading} wait ${i} ${JSON.stringify(ready)}\n`); if (ready?.go) { ok = true; break; } }
      if (!ok) throw Error('not ready ' + url);
      await sleep(8000); await hideUi(); await sleep(500); return url;
    };
    const note = m => { appendFileSync(`${out}/progress.log`, `${new Date().toISOString()} ${m}\n`); console.log(m); };
    const urlAcross = await go(v.view.across); note(site + ' across ready'); await shoot('across', 1, 200);
    const flow = [];
    for (let i = 0; i < 2; i++) { const est = await ev('window.__shaderEst||null'); const s = await cdp('Page.captureScreenshot', { format: 'png' }); writeFileSync(`${dir}/flow-${i}.png`, Buffer.from(s.data, 'base64')); flow.push({ f: `flow-${i}.png`, at: new Date().toISOString(), est }); note(site + ' flow ' + i); await sleep(1500); }
    let urlDown = '';
    try { urlDown = await go(v.view.downstream); note(site + ' downstream ready'); await shoot('downstream', 1, 200); }
    catch (e) { errors.push('downstream ' + String(e).slice(0, 200)); note(site + ' downstream failed ' + e); }
    const info = await ev(`({w:innerWidth,h:innerHeight,vis:document.visibilityState,status:document.getElementById('status')?.textContent,canvas:!!document.querySelector('canvas')})`);
    log.push({ site, river: v.river, urlAcross, urlDown, info, shots, flow, errors });
    writeFileSync(`${dir}/observations.json`, JSON.stringify(log.at(-1), null, 2)); note(`${site} shots ${shots.length} flow ${flow.length} errors ${errors.length} ${JSON.stringify(info)}`);
  } catch (e) { appendFileSync(`${out}/progress.log`, `${new Date().toISOString()} ${site} FAILED ${e}\n`); console.error(site, 'FAILED', e); }
  finally { ws?.close(); if (!process.env.RIVER_AUDIT_NO_LOCK) release(name); else { try { process.kill(browserPid, 'SIGKILL'); } catch { /* already gone */ } } await sleep(1500); try { rmSync(profile, { recursive: true, force: true }); } catch { /* profile already gone */ } }
}
