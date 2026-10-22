// T-0034 rule-6 recording (Grok Bot, rule 8 fill): bare load -> globe (no menu) -> wheel scroll in -> landing.
// Headless Edge 1280x800 via CDP, JPEG frames with timestamps (frames.json); encoded to descent.mp4 at real time. Holds the bench lock.
// node refs/T-0034/record.mjs <base> <outDir>
import { spawn, execSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { acquire, track, release } from 'file:///C:/dev/boreal-grok-globe-default/tools/bench-lock.mjs';
const base = process.argv[2], outDir = process.argv[3], name = 'grok: T-0034 descent recording', port = 9700 + Math.floor(Math.random() * 90);
mkdirSync(join(outDir, 'frames'), { recursive: true });
if (!await acquire(name)) { console.log('lock busy'); process.exit(1); }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', profile = mkdtempSync(join(tmpdir(), 't0034-rec-'));
const proc = spawn(edge, ['--headless=new', '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--hide-scrollbars', '--window-size=1280,800',
  '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--disable-background-timer-throttling', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
track(proc.pid); const errors = [], frames = [];
try {
  let t; for (let k = 0; k < 60 && !t?.find?.(x => x.type === 'page'); k++) { await sleep(500); try { t = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); } catch {} }
  const ws = new WebSocket(t.find(x => x.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const pend = new Map();
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); }
    if (d.method === 'Runtime.exceptionThrown') errors.push('exception: ' + (d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text).slice(0, 300)); };
  const cdp = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async e => { const r = await cdp('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); return r.result?.result?.value; };
  await cdp('Page.enable'); await cdp('Runtime.enable'); await cdp('Page.bringToFront'); await cdp('Emulation.setFocusEmulationEnabled', { enabled: true });
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  const state = async () => JSON.parse(await ev(`JSON.stringify({ search: location.search, mode: window.__inpage?.mode ?? 'none', alt: Math.round(window.__inpage?.globe?.altitude ?? -1), menu: !!document.getElementById('start-menu') && !document.getElementById('start-menu').hidden && !document.getElementById('start-menu').classList.contains('fade'), loading: !!document.getElementById('loading') })`));
  let t0 = 0, k = 0;
  const shot = async phase => { const r = await cdp('Page.captureScreenshot', { format: 'jpeg', quality: 80 }); const f = `f${String(k++).padStart(3, '0')}.jpg`;
    writeFileSync(join(outDir, 'frames', f), Buffer.from(r.result.data, 'base64')); const s = await state(); frames.push({ f, t: +((Date.now() - t0) / 1000).toFixed(2), phase, ...s }); return s; };
  await cdp('Page.navigate', { url: `${base}/` }); const tl = Date.now();
  await sleep(2000); while ((await state()).loading) { if (Date.now() - tl > 240000) throw new Error('loading > 240 s'); await sleep(500); }
  console.log(`loaded in ${((Date.now() - tl) / 1000).toFixed(0)} s`);
  for (let i = 0; i < 40 && (await state()).mode !== 'globe'; i++) await sleep(250);
  await sleep(1500); t0 = Date.now();
  // phase 1: the globe as it opens (3 s)
  while (Date.now() - t0 < 3000) await shot('globe');
  // phase 2: the user's scroll-in (mouse wheel over the screen centre) until the game mode, then 4 s on the ground
  let landed = 0, wheel = 0;
  while (Date.now() - t0 < 40000) {
    const s = await shot(landed ? 'ground' : 'descent');
    if (!landed && s.mode === 'game') { landed = Date.now(); console.log(`landed at ${((landed - t0) / 1000).toFixed(1)} s`); }
    if (!landed && s.mode === 'globe' && wheel < 400) { for (let j = 0; j < 3; j++, wheel++) await cdp('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 640, y: 400, deltaX: 0, deltaY: -120 }); }
    if (landed && Date.now() - landed > 4000) break;
  }
  console.log('wheel events: ' + wheel + ', final ' + JSON.stringify(await state()));
  ws.close();
} catch (e) { errors.push('record: ' + (e.stack ?? e)); }
finally { try { execSync(`taskkill /PID ${proc.pid} /T /F`, { stdio: 'ignore' }); } catch { proc.kill(); } await sleep(1000); try { rmSync(profile, { recursive: true, force: true }); } catch {} release(name); }
writeFileSync(join(outDir, 'frames.json'), JSON.stringify(frames, null, 1));
for (const e of errors) console.log('ERR ' + e); console.log('frames ' + frames.length + ' done');