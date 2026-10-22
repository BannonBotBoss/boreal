// node tools/music-shot.mjs <url> <outPrefix>: headless Edge proof of the Music picker (T-0033). Opens Menu > Music,
// screenshots it, picks Campfire, checks the track file loaded and ambience still loads, saves a second screenshot.
// Same CDP pattern as tools/strip-shot.mjs; the Edge process tree is always killed and its temp profile removed.
import { spawn, execSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const [url, out = 'music'] = process.argv.slice(2), w = 1280, h = 800;
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', port = 9400 + Math.floor(Math.random() * 90), profile = mkdtempSync(join(tmpdir(), 'grok-music-'));
const p = spawn(edge, ['--headless=new', `--window-size=${w},${h}`, '--hide-scrollbars', '--autoplay-policy=no-user-gesture-required', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
let id = 0; const pending = new Map(); const errors = []; const audioReqs = [];
const report = {};
try {
  let t; for (let i = 0; i < 60; i++) { try { t = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (t.find(x => x.type === 'page')) break; } catch {} await sleep(500); }
  const ws = new WebSocket(t.find(x => x.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d.result ?? d); pending.delete(d.id); }
    if (d.method === 'Network.requestWillBeSent' && /\.mp3/.test(d.params.request.url)) audioReqs.push(d.params.request.url.split('/').pop());
    if (d.method === 'Runtime.exceptionThrown') errors.push(d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text); };
  const cdp = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async e => (await cdp('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.value;
  const shot = async f => { const s = await cdp('Page.captureScreenshot', { format: 'png' }); writeFileSync(f, Buffer.from(s.data, 'base64')); };
  const click = async (x, y) => { for (const type of ['mousePressed', 'mouseReleased']) await cdp('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 }); };
  await cdp('Runtime.enable'); await cdp('Page.enable'); await cdp('Network.enable'); await cdp('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  await cdp('Page.navigate', { url });
  const findBtn = label => `(() => { const b = [...document.querySelectorAll('#start-menu button')].find(b => b.textContent === ${JSON.stringify(label)}); if (!b) return null; const r = b.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`;
  let at = null; for (let i = 0; i < 180 && !at; i++) { await sleep(1000); at = await ev(findBtn('Music')); }
  report.menu = !!at; if (!at) throw new Error('no Music button');
  await click(5, 5); await sleep(300); await click(...at); await sleep(1500); // real input events = the first user gesture
  await shot(`${out}-picker.png`);
  report.panel = await ev(`[...document.querySelectorAll('#start-menu label')].slice(0, 4).map(l => l.textContent)`);
  report.options = await ev(`[...document.querySelector('#start-menu select').options].map(o => o.value + (o.selected ? '*' : ''))`);
  await sleep(5000);
  const loaded = () => audioReqs.filter(n => /guitar|amb-|wind|water/.test(n)).join(' ');
  report.loadedBefore = loaded(); report.ctxState = await ev(`(() => { try { return [...document.querySelectorAll('audio')].length } catch { return -1 } })()`);
  report.picked = await ev(`(() => { const s = document.querySelector('#start-menu select'); s.value = 'Campfire'; s.dispatchEvent(new Event('input', { bubbles: true })); return s.value; })()`);
  await sleep(6000);
  report.loadedAfter = loaded();
  report.saved = await ev(`localStorage.getItem('boreal.music.v1')`);
  report.volume = await ev(`localStorage.getItem('boreal.volume.v1')`);
  report.audioCtx = await ev(`typeof AudioContext`);
  await shot(`${out}-campfire.png`);
  report.errors = errors.slice(0, 5); console.log(JSON.stringify(report, null, 1)); ws.close();
} catch (e) { report.error = String(e); report.errors = errors.slice(0, 5); console.log(JSON.stringify(report, null, 1)); }
finally { try { execSync(`taskkill /PID ${p.pid} /T /F`, { stdio: 'ignore' }); } catch {} await sleep(1500); try { rmSync(profile, { recursive: true, force: true }); } catch {} }
