// River inspection capture (claude loop, 2026-10-21). Same CDP pattern as refs/water/shore-audit/capture.mjs (codex's
// refs/sky/season-audit/capture.mjs). One bench-lock hold per site (max hold 10 min; release kills the Edge it launched).
// Run from the worktree root with a dev server on PORT: node refs/water/river-audit/capture.mjs <port> [site ...]
// Sites come from views.json (pick-views.ts). Per site at noon: 3 stills facing across the river, a 6 s webm of the same view
// (motion of the flow ripples and foam), 2 stills facing downstream. DOM overlays (HUD, title, buttons) are hidden for the
// shots so the canvas is measurable; nothing in the game changes.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { acquire, track, release } from '../../../tools/bench-lock.mjs';
const BROWSER = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe', process.env.CHROME, '/usr/bin/google-chrome-stable', '/usr/bin/google-chrome', '/usr/local/bin/google-chrome'].find(p => p && existsSync(p));
const [PORT = '5214', ...want] = process.argv.slice(2), out = resolve('refs/water/river-audit'), views = JSON.parse(readFileSync(`${out}/views.json`, 'utf8'));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = [];
for (const site of want.length ? want : Object.keys(views)) {
  const v = views[site]; if (!v) continue; const name = `claude: river audit ${site}`, dir = `${out}/${site}`; mkdirSync(dir, { recursive: true });
  if (!await acquire(name, { waitMs: 10 * 60 * 1000 })) throw Error('GPU busy');
  // a fresh profile per site, outside the worktree (vite watches it): a profile reused after a forced kill kept the
  // debug port closed on the next launch (2026-10-21)
  let ws; const profile = mkdtempSync(join(tmpdir(), "claude-river-edge-")), port = 9480 + Object.keys(views).indexOf(site) * 3 + (Date.now() % 3);
  try {
    if (!BROWSER) throw Error('no Chrome or Edge binary');
    const gl = process.platform === 'win32' ? ['--use-angle=d3d11', '--enable-gpu'] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
    const p = spawn(BROWSER, ['--headless=new', '--disable-extensions', '--no-first-run', '--disable-gpu-vsync', '--disable-frame-rate-limit', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--disable-background-timer-throttling', ...gl, '--ignore-gpu-blocklist', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' }); track(p.pid);
    let tabs; for (let i = 0; i < 120; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (tabs.find(t => t.type === "page")) break; } catch {} await sleep(500); }
    if (!tabs) throw Error("Edge debug port did not open");
    ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
    let id = 0; const pending = new Map(), errors = [];
    ws.onmessage = e => { const d = JSON.parse(e.data); if (d.id) { pending.get(d.id)?.(d.result); pending.delete(d.id); } if (d.method === 'Runtime.exceptionThrown') errors.push(d.params.exceptionDetails?.exception?.description?.slice(0, 300) ?? d.params.exceptionDetails?.text); };
    const cdp = (method, params = {}) => new Promise((r, j) => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); setTimeout(() => { if (pending.delete(n)) j(Error(method + ' timeout')); }, 60000).unref(); });
    const ev = async expression => { const r = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails)); return r.result?.value; };
    await cdp('Runtime.enable'); await cdp('Page.enable'); await cdp('Page.bringToFront'); await cdp('Emulation.setFocusEmulationEnabled', { enabled: true });
    await cdp('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
    const shots = [];
    const hideUi = () => ev(`(()=>{const c=document.querySelector('canvas');for(const el of document.body.querySelectorAll('*')){if(el===c||el.contains(c)||el.tagName==='SCRIPT')continue;el.style.visibility='hidden';}c.style.visibility='visible';return 1})()`);
    const shoot = async (label, n, gapMs) => { for (let i = 0; i < n; i++) { const s = await cdp('Page.captureScreenshot', { format: 'png' }); const f = `${label}-${i}.png`; writeFileSync(`${dir}/${f}`, Buffer.from(s.data, 'base64')); shots.push({ f, at: new Date().toISOString() }); await sleep(gapMs); } };
    const go = async (heading) => { const url = `http://127.0.0.1:${PORT}/?nomenu&hour=12&at=${v.view.x},${v.view.z},${heading}`; await cdp('Page.navigate', { url });
      let ok = false; for (let i = 0; i < 150; i++) { await sleep(1000); if (await ev("document.readyState==='complete' && !document.getElementById('loading')")) { ok = true; break; } } if (!ok) throw Error('not ready ' + url); await sleep(8000); await hideUi(); await sleep(500); return url; };
    const rec = () => ev(`(()=>{const c=document.querySelector('canvas');window.auditChunks=[];window.auditRecorder=new MediaRecorder(c.captureStream(15),{mimeType:'video/webm'});auditRecorder.ondataavailable=e=>auditChunks.push(e.data);auditRecorder.start();})()`);
    const stop = async (file) => { const b = await ev(`new Promise(r=>{auditRecorder.onstop=()=>{const f=new FileReader();f.onload=()=>r(f.result.split(',')[1]);f.readAsDataURL(new Blob(auditChunks,{type:'video/webm'}));};auditRecorder.stop();})`); writeFileSync(`${dir}/${file}`, Buffer.from(b, 'base64')); };
    const urlAcross = await go(v.view.across); await shoot('across', 3, 1000); await rec(); await sleep(6000); await stop('across.webm');
    const urlDown = await go(v.view.downstream); await shoot('downstream', 2, 1000);
    const info = await ev(`({w:innerWidth,h:innerHeight,status:document.getElementById('status')?.textContent})`);
    log.push({ site, river: v.river, urlAcross, urlDown, info, shots, errors });
    writeFileSync(`${dir}/observations.json`, JSON.stringify(log.at(-1), null, 2)); console.log(site, shots.length, 'shots', errors.length, 'errors');
  } finally { ws?.close(); release(name); await sleep(1500); try { rmSync(profile, { recursive: true, force: true }); } catch {} }
}
