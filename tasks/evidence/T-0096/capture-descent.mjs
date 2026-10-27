// Descent stills for T-0096. Headless Chrome, swiftshader, same viewport as the earlier stills.
// node tasks/evidence/T-0096/capture-descent.mjs <port> <outdir>
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = process.argv[2] ?? '5275';
const out = process.argv[3] ?? 'tasks/evidence/T-0096';
const sleep = ms => new Promise(r => setTimeout(r, ms));
mkdirSync(out, { recursive: true });
const profile = mkdtempSync(join(tmpdir(), 'boreal-descent-'));
const debug = 9410 + (Number(PORT) % 20);
const chromeBin = process.env.CHROME ?? 'google-chrome';
const chrome = spawn(chromeBin, [
  '--headless=new', '--disable-extensions', '--no-first-run', '--disable-gpu',
  '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
  `--remote-debugging-port=${debug}`, `--user-data-dir=${profile}`, 'about:blank',
], { stdio: 'ignore' });
const log = [];
try {
  let tabs;
  for (let i = 0; i < 80; i++) {
    try { tabs = await (await fetch(`http://127.0.0.1:${debug}/json`)).json(); break; }
    catch { await sleep(250); }
  }
  if (!tabs) throw Error('chrome debug port closed');
  const ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise(r => { ws.onopen = r; });
  let id = 0;
  const pending = new Map();
  ws.onmessage = e => {
    const d = JSON.parse(e.data);
    if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); }
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
  const url = `http://127.0.0.1:${PORT}/?start=globe&stages=1&trees=v2&noprobe&inpagedev`;
  await cdp('Page.navigate', { url });
  const shot = async name => {
    const s = await cdp('Page.captureScreenshot', { format: 'png' }, 90000);
    writeFileSync(`${out}/${name}.png`, Buffer.from(s.result.data, 'base64'));
  };
  const probe = `(() => {
    const g = window.__inpage?.globe, cam = g?.camera, st = g?.stats?.() ?? {};
    let el = null;
    if (cam) {
      const e = cam.matrixWorld.elements, fx = -e[8], fy = -e[9], fz = -e[10];
      const pl = Math.hypot(cam.position.x, cam.position.y, cam.position.z) || 1;
      const dot = (fx * cam.position.x + fy * cam.position.y + fz * cam.position.z) / pl;
      el = Math.asin(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI;
    }
    const pad = document.querySelector('.padm');
    const pst = pad ? getComputedStyle(pad) : null;
    const ip = window.__inpage;
    const who = ip?.player?.();
    const vc = ip?.view?.camera;
    const far = ip?.far;
    return {
      mode: window.__inpage?.mode ?? null,
      phase: window.__inpage?.flightPhase ?? null,
      alt: g ? g.altitude : null,
      height: window.__inpage?.height ?? null,
      el, fade: window.__inpage?.fade ?? null, ready: window.__inpage?.STATS?.ready ?? null,
      drawn: st.drawn ?? null, inView: st.inView ?? null, deepest: st.deepest ?? null, queued: st.queued ?? null,
      splitDepth: st.splitDepth ?? null, splitK: st.splitK ?? null, lodSplit: st.lodSplit ?? null, nearK: st.nearK ?? null, hold: st.hold ?? null,
      tier: st.tier ?? null, segments: st.segments ?? null,
      padDisplay: pst ? pst.display : null,
      padHidden: pad ? pad.hidden : null,
      px: who?.x ?? null, pz: who?.z ?? null, pyaw: who?.yaw ?? null,
      cx: vc?.position?.x ?? null, cy: vc?.position?.y ?? null, cz: vc?.position?.z ?? null,
      farScale: far?.scale ?? null, farW: far?.target?.width ?? null, farH: far?.target?.height ?? null,
    };
  })()`;
  const loading = `(() => { const l = document.getElementById('loading'); if (!l) return false; const st = getComputedStyle(l); return st.pointerEvents !== 'none' && Number(st.opacity) > 0.05; })()`;
  let opened = null;
  for (let i = 0; i < 180; i++) {
    await sleep(1000);
    opened = await ev(probe);
    const busy = await ev(loading);
    if (opened?.mode === 'globe' && opened.alt > 1e6 && opened.drawn > 0 && !busy) break;
    opened = null;
  }
  if (!opened) throw Error('globe did not open ' + JSON.stringify(log.slice(-8)));
  const observations = {};
  async function settle(name, pred, ms = 40000) {
    const t0 = Date.now();
    let stable = 0, last = '', best = null;
    while (Date.now() - t0 < ms) {
      await sleep(500);
      const s = await ev(probe);
      best = s;
      const key = [s?.drawn, s?.queued, s?.deepest, Math.round(s?.height ?? -1), Math.round(s?.alt ?? -1)].join(':');
      if (pred(s) && key === last) stable++;
      else stable = 0;
      last = key;
      if (stable >= 3) break;
    }
    await sleep(400);
    await shot(name);
    const s = await ev(probe);
    observations[name] = s ?? best;
    console.log(name, JSON.stringify(observations[name]));
    return observations[name];
  }
  await settle('orbit', s => s?.mode === 'globe' && s.drawn >= 8 && s.queued === 0, 25000);
  await ev(`window.__inpage.globe.jumpTo(10000)`);
  await settle('10km', s => s?.mode === 'globe' && s.alt > 8000 && s.alt < 14000 && s.queued === 0 && s.drawn >= 8, 35000);
  await ev(`window.__inpage.DEBUG.holdH = 2000; window.__inpage.globe.jumpTo(3600);`);
  await sleep(300);
  await ev(`(() => {
    const c = document.querySelector('canvas'), r = c.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const p = (type, buttons) => c.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, buttons, pointerId: 1, pointerType: 'mouse', isPrimary: true }));
    p('pointerdown', 1); p('pointerup', 0); p('pointerdown', 1); p('pointerup', 0);
    c.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: x, clientY: y, button: 0, detail: 2 }));
    return true;
  })()`);
  // The draw cap can collapse the tree for a couple of seconds, then the near split rebuilds it.
  // A queued===0 check alone photographs that collapse. Wait until the cell under the camera has refined.
  await settle('2km', s => s?.mode === 'band' && s.height > 1900 && s.height < 2200 && s.alt < 4000 && s.queued === 0 && s.deepest >= 10, 70000);
  await ev(`window.__inpage.DEBUG.holdH = 600`);
  await settle('600m', s => s?.mode === 'band' && s.height > 560 && s.height < 700 && s.fade > 0.9 && s.queued === 0 && s.deepest >= 12, 70000);
  await ev(`window.__inpage.DEBUG.holdH = 100`);
  await settle('100m', s => s?.mode === 'band' && s.height > 90 && s.height < 140 && s.fade > 0.9 && s.queued === 0 && s.deepest >= 14, 70000);
  await ev(`window.__inpage.DEBUG.holdH = 1`);
  await settle('ground', s => s?.mode === 'band' && s.height < 8 && s.fade > 0.9 && s.queued === 0 && s.deepest >= 12, 70000);
  writeFileSync(`${out}/descent.json`, JSON.stringify({ url, at: new Date().toISOString(), observations, log: log.slice(-20) }, null, 2));
  console.log('wrote', out);
  ws.close();
} finally {
  chrome.kill();
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* chrome may still be releasing the profile */ }
}
