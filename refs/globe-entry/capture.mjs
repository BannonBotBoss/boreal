// Frame gate for the globe free fall. Headless Chrome (swiftshader).
// node refs/globe-entry/capture.mjs <port> <outdir>
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = process.argv[2] ?? '5275';
const out = process.argv[3] ?? 'refs/globe-entry/frames';
const sleep = ms => new Promise(r => setTimeout(r, ms));
mkdirSync(out, { recursive: true });
const profile = mkdtempSync(join(tmpdir(), 'boreal-globe-entry-'));
const debug = 9400 + (Number(PORT) % 20);
const chrome = spawn('google-chrome', [
  '--headless=new', '--disable-extensions', '--no-first-run', '--disable-gpu',
  '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
  `--remote-debugging-port=${debug}`, `--user-data-dir=${profile}`, 'about:blank',
], { stdio: 'ignore' });
let ws;
const log = [];
try {
  let tabs;
  for (let i = 0; i < 80; i++) {
    try { tabs = await (await fetch(`http://127.0.0.1:${debug}/json`)).json(); break; }
    catch { await sleep(250); }
  }
  if (!tabs) throw Error('chrome debug port closed');
  ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise(r => { ws.onopen = r; });
  let id = 0;
  const pending = new Map();
  const errors = [];
  ws.onmessage = e => {
    const d = JSON.parse(e.data);
    if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); }
    if (d.method === 'Runtime.exceptionThrown') errors.push(d.params?.exceptionDetails?.exception?.description ?? d.params?.exceptionDetails?.text);
    if (d.method === 'Runtime.consoleAPICalled') {
      const line = d.params.args?.map(a => a.value ?? a.description).join(' ');
      if (/error|INPAGE|fall/i.test(line ?? '')) log.push(line);
    }
  };
  const cdp = (method, params = {}, ms = 30000) => new Promise((res, rej) => {
    const n = ++id; pending.set(n, res); ws.send(JSON.stringify({ id: n, method, params }));
    setTimeout(() => { if (pending.delete(n)) rej(Error(method + ' timeout')); }, ms).unref();
  });
  const ev = async expression => {
    const r = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.result?.exceptionDetails || r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails ?? r.result?.exceptionDetails));
    return r.result?.result?.value;
  };
  await cdp('Runtime.enable');
  await cdp('Page.enable');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1100, height: 700, deviceScaleFactor: 1, mobile: false });
  const url = `http://127.0.0.1:${PORT}/?start=globe&stages=1&trees=v2&noprobe`;
  await cdp('Page.navigate', { url });
  const shot = async name => {
    const s = await cdp('Page.captureScreenshot', { format: 'png' }, 60000);
    writeFileSync(`${out}/${name}.png`, Buffer.from(s.result.data, 'base64'));
  };
  const probe = `(() => {
    const g = window.__inpage?.globe, cam = g?.camera;
    let el = null;
    if (cam) {
      const e = cam.matrixWorld.elements, fx = -e[8], fy = -e[9], fz = -e[10];
      const pl = Math.hypot(cam.position.x, cam.position.y, cam.position.z) || 1;
      const dot = (fx * cam.position.x + fy * cam.position.y + fz * cam.position.z) / pl;
      el = Math.asin(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI;
    }
    const layers = document.getElementById('globe-layers');
    return {
      href: location.href, mode: window.__inpage?.mode ?? null, phase: window.__inpage?.flightPhase ?? null,
      alt: g ? Math.round(g.altitude) : null, height: window.__inpage?.height ?? null, fall: g?.fallState ?? null, el,
      layersHidden: layers ? layers.hidden : null, prompt: document.getElementById('flight-prompt')?.textContent ?? '',
    };
  })()`;
  let ready = null;
  for (let i = 0; i < 150; i++) {
    await sleep(1000);
    ready = await ev(probe);
    const drawn = await ev(`window.__inpage?.globe?.stats?.().drawn ?? 0`);
    const loading = await ev(`(() => { const l = document.getElementById('loading'); if (!l) return false; const st = getComputedStyle(l); return st.pointerEvents !== 'none' && Number(st.opacity) > 0.05; })()`);
    if (ready?.mode === 'globe' && ready.alt > 1000 && drawn > 0 && !loading) break;
    ready = null;
  }
  if (!ready) throw Error('globe did not open');
  await sleep(800);
  const orbit = await ev(probe);
  await shot('01-orbit-nadir');
  const click = await ev(`(() => {
    const c = document.querySelector('canvas'), r = c.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const p = (type, buttons) => c.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, buttons, pointerId: 1, pointerType: 'mouse', isPrimary: true }));
    c.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, clientX: x, clientY: y, deltaY: 100 }));
    p('pointerdown', 1); p('pointerup', 0);
    c.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: x, clientY: y, button: 0, detail: 1 }));
    return window.__inpage.globe.fallState;
  })()`);
  await ev(`window.__inpage.globe.jumpTo(5200)`);
  await sleep(400);
  const before = await ev(probe);
  await shot('02-before-double-click');
  const started = await ev(`(() => {
    const c = document.querySelector('canvas'), r = c.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const p = (type, buttons) => c.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, buttons, pointerId: 1, pointerType: 'mouse', isPrimary: true }));
    p('pointerdown', 1); p('pointerup', 0); p('pointerdown', 1); p('pointerup', 0);
    c.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, detail: 2 }));
    return window.__inpage.globe.fallState;
  })()`);
  const marks = { early: false, mid: false, late: false };
  const samples = [];
  let handoff = null, lastFall = null;
  for (let i = 0; i < 200 && !handoff; i++) {
    await sleep(500);
    const s = await ev(probe);
    samples.push(s);
    if (s?.fall) lastFall = s;
    const ease = s?.fall?.ease ?? null;
    if (!marks.early && ease != null && ease > 0.08) { marks.early = true; await sleep(350); await shot('03-fall-early'); }
    if (!marks.mid && ease != null && ease > 0.45) { marks.mid = true; await sleep(350); await shot('04-fall-mid'); }
    if (!marks.late && ease != null && ease > 0.85) { marks.late = true; await sleep(350); await shot('05-fall-late'); }
    if (s?.mode === 'band') { handoff = s; await sleep(200); await shot('06-handoff-drone'); }
  }
  await sleep(800);
  const carried = await ev(probe);
  if (carried?.mode === 'band') await shot('07-drone-still-moving');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 750, height: 900, deviceScaleFactor: 1, mobile: false });
  await ev(`(() => {
    const buttons = Array.from({ length: 17 }, () => ({ pressed: false, value: 0, touched: false }));
    const pad = { connected: true, mapping: 'standard', buttons, axes: [0, 0, 0, 0], id: 'Fake Xbox', index: 0, timestamp: 0 };
    window.__pad = pad;
    navigator.getGamepads = () => [window.__pad];
  })()`);
  await sleep(1200);
  const layout = await ev(`(() => {
    const box = sel => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const st = getComputedStyle(el);
      if (el.hidden || st.display === 'none' || st.visibility === 'hidden') return { sel, hidden: true };
      const r = el.getBoundingClientRect();
      return { sel, t: Math.round(r.top), b: Math.round(r.bottom), l: Math.round(r.left), r: Math.round(r.right), w: Math.round(r.width), h: Math.round(r.height) };
    };
    const ids = ['footer', 'footer>span', '.padx', '#flight-prompt', '#interaction', '#globe-layers', '#menu-btn'];
    const boxes = ids.map(box);
    const area = (a, b) => {
      if (!a || !b || a.hidden || b.hidden) return 0;
      const w = Math.min(a.r, b.r) - Math.max(a.l, b.l), h = Math.min(a.b, b.b) - Math.max(a.t, b.t);
      return w > 0 && h > 0 ? w * h : 0;
    };
    const legend = boxes.find(b => b?.sel === '.padx'), prompt = boxes.find(b => b?.sel === '#flight-prompt');
    return { w: innerWidth, h: innerHeight, boxes, onGlobe: document.body.classList.contains('on-globe'), overlapPromptLegend: area(prompt, legend) };
  })()`);
  await shot('08-narrow-drone');
  // Become the wolf once the patch is allowed in, so the in-game layer panel and hint can be checked.
  let game = null;
  for (let i = 0; i < 40 && !game; i++) {
    await sleep(500);
    const s = await ev(probe);
    if (s?.mode === 'band') await ev(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'g', bubbles: true }))`);
    if (s?.mode === 'game') game = s;
  }
  await sleep(800);
  const gameLayout = await ev(`(() => {
    const box = sel => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const st = getComputedStyle(el);
      if (el.hidden || st.display === 'none' || st.visibility === 'hidden') return { sel, hidden: true };
      const r = el.getBoundingClientRect();
      return { sel, t: Math.round(r.top), b: Math.round(r.bottom), l: Math.round(r.left), r: Math.round(r.right), w: Math.round(r.width), h: Math.round(r.height) };
    };
    const ids = ['footer', 'footer>span', '.padx', '#flight-prompt', '#interaction', '#globe-layers', '#status', '#menu-btn'];
    const boxes = ids.map(box);
    const area = (a, b) => {
      if (!a || !b || a.hidden || b.hidden) return 0;
      const w = Math.min(a.r, b.r) - Math.max(a.l, b.l), h = Math.min(a.b, b.b) - Math.max(a.t, b.t);
      return w > 0 && h > 0 ? w * h : 0;
    };
    const hint = boxes.find(b => b?.sel === 'footer>span'), legend = boxes.find(b => b?.sel === '.padx'), buttons = boxes.find(b => b?.sel === 'footer'), talk = boxes.find(b => b?.sel === '#interaction');
    return { mode: window.__inpage?.mode, boxes, overlapHintLegend: area(hint, legend), overlapHintFooter: area(hint, buttons), overlapTalkLegend: area(talk, legend), w: innerWidth };
  })()`);
  await shot('09-in-game-narrow');
  const report = { url, orbit, clickFall: click, before, started, marks, lastFall, handoff, carried, layout, game, gameLayout, errors: errors.slice(0, 12), samples: samples.filter((_, i) => i % 4 === 0) };
  writeFileSync(`${out}/observations.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ orbitEl: orbit?.el, clickFall: click, started, handoff: handoff?.mode, handoffH: handoff?.height, carriedH: carried?.height, game: game?.mode, layers: gameLayout?.boxes?.find(b => b?.sel === '#globe-layers'), overlapPrompt: layout?.overlapPromptLegend, overlapTalk: gameLayout?.overlapTalkLegend, overlapHint: gameLayout?.overlapHintLegend }));
} finally {
  ws?.close();
  chrome.kill('SIGKILL');
  try { rmSync(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }); } catch { /* profile */ }
}
