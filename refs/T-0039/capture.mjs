// T-0039 captures (grok-globe): for each base URL (label=url args): bare load -> globe, Esc -> menu, descent -> band, landing; logs HUD visibility. Holds the bench lock.
import { spawn, execSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { acquire, track, release } from 'file:///C:/dev/boreal-grok-globe-hud/tools/bench-lock.mjs';
const outDir = process.argv[2], bases = process.argv.slice(3).map(a => a.split('=')), name = 'grok-globe: T-0039 captures', port = 9800 + Math.floor(Math.random() * 90);
if (!await acquire(name)) { console.log('lock busy'); process.exit(1); }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', profile = mkdtempSync(join(tmpdir(), 't0039-edge-'));
const proc = spawn(edge, ['--disable-gpu-vsync', '--disable-frame-rate-limit', '--headless=new', '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-gpu-sandbox', '--hide-scrollbars', '--window-size=1280,800',
  '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--disable-background-timer-throttling', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
track(proc.pid); const errors = [];
try {
  let t; for (let k = 0; k < 60 && !t; k++) { await sleep(500); try { t = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); } catch {} }
  const ws = new WebSocket(t.find(x => x.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const pend = new Map();
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); }
    if (d.method === 'Runtime.exceptionThrown') errors.push('exception: ' + (d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text).slice(0, 300)); };
  const cdp = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async e => { const r = await cdp('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); return r.result?.result?.value; };
  await cdp('Page.enable'); await cdp('Runtime.enable'); await cdp('Page.bringToFront'); await cdp('Emulation.setFocusEmulationEnabled', { enabled: true });
  const state = () => ev(`JSON.stringify({ search: location.search, mode: window.__inpage?.mode ?? 'no inpage', alt: Math.round(window.__inpage?.globe?.altitude ?? -1), menu: !!document.getElementById('start-menu') && !document.getElementById('start-menu').hidden && !document.getElementById('start-menu').classList.contains('fade'), hud: document.body.classList.contains('on-globe'), shown: ['header', '#status', '#interaction', 'footer>span', '#act', '#home', '#menu-btn'].filter(s => { const e = document.querySelector(s); return e && e.getClientRects().length > 0; }) })`);
  const shot = async f => { const r = await cdp('Page.captureScreenshot', { format: 'jpeg', quality: 85 }); writeFileSync(join(outDir, f), Buffer.from(r.result.data, 'base64')); console.log('saved ' + f + ' ' + await state()); };
  const load = async url => { const t0 = Date.now(); await cdp('Page.navigate', { url }); await sleep(3000);
    while (!(await ev(`document.readyState === 'complete' && !document.getElementById('loading')`))) { if (Date.now() - t0 > 240000) throw new Error('loading screen up after 240 s: ' + url); await sleep(1000); }
    console.log(`loaded ${url} in ${((Date.now() - t0) / 1000).toFixed(0)} s`); };
  const key = async k => { for (const type of ['keyDown', 'keyUp']) await cdp('Input.dispatchKeyEvent', { type, key: k, code: k, windowsVirtualKeyCode: k === 'Escape' ? 27 : 0 }); };
  for (const [label, base] of bases) {
    await load(`${base}/`); await sleep(8000); await shot(`${label}-globe.jpg`);
    await key('Escape'); await sleep(1500); await shot(`${label}-globe-menu.jpg`);
    await ev(`(() => { const b = [...document.querySelectorAll('#start-menu button')].find(b => /continue/i.test(b.textContent)); b?.click(); return !!b; })()`);
    await sleep(1000); console.log(label + ' after continue: ' + await state());
    await ev(`window.__inpage.globe.zoomTo(1000)`);
    let band = false;
    for (let k = 0; k < 240; k++) { await sleep(250); const s = JSON.parse(await state());
      if (s.mode === 'band' && !band) { band = true; await sleep(1500); await shot(`${label}-band.jpg`); }
      if (s.mode === 'game') { console.log(label + ' landed after ' + (k / 4).toFixed(1) + ' s'); break; } }
    await sleep(5000); await shot(`${label}-landed.jpg`);
  }
  ws.close();
} catch (e) { errors.push('capture: ' + (e.stack ?? e)); }
finally { try { execSync(`taskkill /PID ${proc.pid} /T /F`, { stdio: 'ignore' }); } catch { proc.kill(); } await sleep(1000); try { rmSync(profile, { recursive: true, force: true }); } catch {} release(name); }
for (const e of errors) console.log('ERR ' + e); console.log('done');