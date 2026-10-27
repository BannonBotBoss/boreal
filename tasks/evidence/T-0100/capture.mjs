// T-0100: Kenora, 15 Jan, about 12:06. Same places before and after the level camera.
// Flat cell and a slope, plus the default stand from the snow-depth frame.
// node tasks/evidence/T-0100/capture.mjs before|after [baseUrl]
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { acquire, track, release } from '../../../tools/bench-lock.mjs';

const which = process.argv[2] === 'after' ? 'after' : 'before';
const base = process.argv[3] ?? 'http://127.0.0.1:5288';
const out = resolve('tasks/evidence/T-0100');
const artifacts = '/opt/cursor/artifacts';
mkdirSync(out, { recursive: true });
mkdirSync(artifacts, { recursive: true });
const shots = [
  { name: `${which}-flat`, q: '?nomenu&noprobe&day=15&hour=12&at=-82,-12,-0.35', x: -82, z: -12, yaw: -0.35 },
  { name: `${which}-slope`, q: '?nomenu&noprobe&day=15&hour=12&at=82,-32,-0.35', x: 82, z: -32, yaw: -0.35 },
  { name: `${which}-kenora`, q: '?nomenu&noprobe&day=15&hour=12&at=30,0,-0.35', x: 30, z: 0, yaw: -0.35 },
];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const name = `grokbot-3: T-0100 level view ${which}`;
if (!await acquire(name, { waitMs: 120000 })) throw new Error('GPU busy');
const cdpPort = 9440 + Math.floor(Math.random() * 200);
const profile = mkdtempSync(join(tmpdir(), 't0100-chrome-'));
const chrome = process.env.CHROME ?? '/usr/bin/google-chrome';
const proc = spawn(chrome, [
  '--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--hide-scrollbars', '--disable-extensions', '--no-first-run',
  '--window-size=1280,720', `--remote-debugging-port=${cdpPort}`, `--user-data-dir=${profile}`, 'about:blank',
], { stdio: 'ignore' });
track(proc.pid);
let ws;
try {
  let tabs;
  for (let k = 0; k < 40 && !tabs; k++) {
    await sleep(250);
    try { tabs = await (await fetch(`http://127.0.0.1:${cdpPort}/json`)).json(); } catch { /* chrome still starting */ }
  }
  if (!tabs) throw new Error('chrome devtools did not open');
  ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pend = new Map();
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } };
  const cdp = (method, params = {}) => new Promise((res, rej) => {
    const i = ++id;
    const t = setTimeout(() => { pend.delete(i); rej(new Error('cdp timeout ' + method)); }, 180000);
    pend.set(i, d => { clearTimeout(t); res(d); });
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  const ev = async expr => {
    const r = await cdp('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    const body = r.result ?? {};
    if (body.exceptionDetails) {
      const d = body.exceptionDetails;
      return { error: d.exception?.description || d.text || 'evaluate failed' };
    }
    const value = body.result?.value;
    if (value === undefined) return { error: 'no value', type: body.result?.type, subtype: body.result?.subtype, desc: String(body.result?.description ?? '').slice(0, 400) };
    return value;
  };
  await cdp('Page.enable');
  await cdp('Runtime.enable');
  await cdp('Network.enable');
  await cdp('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  const observations = [];
  for (const shot of shots) {
    const t0 = Date.now();
    await cdp('Page.navigate', { url: base + shot.q });
    let loaded = false;
    while (Date.now() - t0 < 180000) {
      await sleep(1000);
      try { loaded = await ev(`document.readyState === 'complete' && !document.getElementById('loading')`) === true; } catch { loaded = false; }
      if (loaded) break;
    }
    if (!loaded) throw new Error(shot.name + ' still loading');
    await sleep(2000);
    const sample = await ev(`(async () => {
      try {
        const names = performance.getEntriesByType('resource').map(e => e.name);
        const pick = (part) => names.filter(n => n.includes(part)).at(-1);
        const mathUrl = pick('/src/render/math.ts');
        const threeUrl = pick('/node_modules/three/build/three.module.js') || pick('three');
        const worldUrl = pick('/src/core/world.ts');
        if (!mathUrl || !threeUrl || !worldUrl) return { error: 'module url missing', mathUrl, threeUrl, worldUrl, sample: names.filter(n => n.includes('/src/') || n.includes('three')).slice(0, 8) };
        const math = await import(mathUrl);
        const THREE = await import(threeUrl);
        const world = await import(worldUrl);
        const cam = new THREE.PerspectiveCamera(48, 1280 / 720, 0.2, 700);
        math.positionCamera(cam, ${shot.x}, ${shot.z}, math.RIDER_HEIGHT, ${shot.yaw});
        const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
        const fwd = new THREE.Vector3(); cam.getWorldDirection(fwd);
        const roll = Math.asin(Math.max(-1, Math.min(1, right.y))) * 180 / Math.PI;
        const pitch = Math.asin(Math.max(-1, Math.min(1, fwd.y))) * 180 / Math.PI;
        fwd.y = 0; fwd.normalize();
        const heading = new THREE.Vector3(-Math.sin(${shot.yaw}), 0, -Math.cos(${shot.yaw}));
        const off = Math.acos(Math.max(-1, Math.min(1, fwd.dot(heading)))) * 180 / Math.PI;
        const h = world.heightAt(${shot.x}, ${shot.z});
        const hx = (world.heightAt(${shot.x} + 2, ${shot.z}) - world.heightAt(${shot.x} - 2, ${shot.z})) / 4;
        const hz = (world.heightAt(${shot.x}, ${shot.z} + 2) - world.heightAt(${shot.x}, ${shot.z} - 2)) / 4;
        const status = document.getElementById('status');
        return {
          href: location.href,
          status: status ? status.innerText.split('\\n')[0] : '',
          roll, pitch, off, h, slopeDeg: Math.atan(Math.hypot(hx, hz)) * 180 / Math.PI,
        };
      } catch (e) { return { error: String(e && e.stack || e) }; }
    })()`);
    const png = await cdp('Page.captureScreenshot', { format: 'png' });
    const file = join(out, shot.name + '.png');
    writeFileSync(file, Buffer.from(png.result.data, 'base64'));
    copyFileSync(file, join(artifacts, 'T-0100-' + shot.name + '.png'));
    observations.push({ ...shot, url: base + shot.q, ms: Date.now() - t0, sample });
    console.log(shot.name, JSON.stringify(sample));
  }
  writeFileSync(join(out, `observations-${which}.json`), JSON.stringify({
    which, viewport: { width: 1280, height: 720 },
    note: 'Kenora, day 15, hour 12. Flat cell (-82, -12), slope (82, -32), and the default stand (30, 0) from the snow-depth frame. nomenu, noprobe. Roll and heading offset are from positionCamera at that spot.',
    observations,
  }, null, 2));
} finally {
  ws?.close();
  release(name);
}
