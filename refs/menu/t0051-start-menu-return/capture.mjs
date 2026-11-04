// Headless Edge CDP verification capture for T-0051 on preview port 5250.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const root = join(dir, '..', '..', '..');
const port = 5250;
const cdpPort = 9355 + Math.floor(Math.random() * 30);
const base = `http://127.0.0.1:${port}/`;
const edgePath = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const profile = mkdtempSync(join(tmpdir(), 'agy-t0051-'));
const sleep = ms => new Promise(r => setTimeout(r, ms));

const server = spawn(process.execPath, [join(root, 'node_modules', 'vite', 'bin', 'vite.js'), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
  cwd: root,
  stdio: 'ignore',
});

const edge = spawn(edgePath, [
  '--headless=new',
  '--disable-gpu-vsync',
  '--disable-frame-rate-limit',
  '--window-size=960,540',
  '--autoplay-policy=no-user-gesture-required',
  '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows',
  '--disable-background-timer-throttling',
  `--remote-debugging-port=${cdpPort}`,
  `--user-data-dir=${profile}`,
  'about:blank',
], { stdio: 'ignore' });

async function waitForUrl(url, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(url);
      if (r.ok) return r;
    } catch { /* wait */ }
    await sleep(200);
  }
  throw new Error(`Timeout waiting for ${url}`);
}

let ws;
try {
  await waitForUrl(base);
  await waitForUrl(`http://127.0.0.1:${cdpPort}/json`);
  const list = await (await fetch(`http://127.0.0.1:${cdpPort}/json`)).json();
  const page = list.find(t => t.type === 'page');
  if (!page) throw new Error('No page target');
  ws = new WebSocket(page.webSocketDebuggerUrl);
  let seq = 0;
  const pending = new Map();
  const errors = [];
  ws.addEventListener('message', ev => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      errors.push((msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text).slice(0, 300));
    }
  });
  await new Promise(r => ws.addEventListener('open', r, { once: true }));
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, m => m.error ? reject(new Error(method + ' ' + JSON.stringify(m.error))) : resolve(m.result));
    ws.send(JSON.stringify({ id, method, params }));
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); reject(new Error('timeout ' + method)); } }, 30000);
  });
  const evalJs = async expr => {
    const r = await call('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    return r.result?.value;
  };
  const shot = async name => {
    const png = await call('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(dir, `${name}.png`), Buffer.from(png.data, 'base64'));
  };
  const pressEscape = async () => {
    await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  };

  await call('Page.enable');
  await call('Runtime.enable');
  await call('Page.bringToFront');
  await call('Emulation.setFocusEmulationEnabled', { enabled: true });
  await call('Emulation.setDeviceMetricsOverride', { width: 960, height: 540, deviceScaleFactor: 1, mobile: false });

  const url = `${base}?noprobe&nomenu&hour=12&rec&stages=1&needs=water:40,energy:70,rest:80&at=200,250,-1.553`;
  await call('Page.navigate', { url });

  for (let i = 0; i < 120; i++) {
    await sleep(300);
    const ready = await evalJs(`document.readyState === 'complete' && !document.getElementById('loading') && !!window.__boreal && !!document.getElementById('start-menu')`);
    if (ready) break;
  }
  await sleep(1500);

  // Clear save keys so hooks.hasSave() is strictly false while the world is running.
  await evalJs(`(() => {
    for (const k of ['boreal-events-v1', 'boreal.deltas.v1', 'boreal.ground.v1']) localStorage.removeItem(k);
  })()`);

  const beforeMenu = await evalJs(`({
    status: document.querySelector('#status')?.textContent ?? '',
    player: window.__boreal?.player?.() ?? null,
  })`);

  // 1. Check Pause Menu (known match baseline)
  await pressEscape();
  await sleep(250);
  const pauseOpen = await evalJs(`(() => {
    const m = document.querySelector('#start-menu');
    const btns = Array.from(m?.querySelectorAll('button') ?? []).map(b => ({ label: b.textContent, disabled: b.disabled }));
    return { hidden: m?.hidden ?? null, className: m?.className ?? '', buttons: btns };
  })()`);
  await shot('pause-menu');

  await pressEscape();
  await sleep(250);
  const pauseAfterEsc = await evalJs(`(() => {
    const m = document.querySelector('#start-menu');
    return { hidden: m?.hidden ?? null, className: m?.className ?? '' };
  })()`);

  // 2. Clear save keys right before clicking footer Menu button (#menu-btn)
  await evalJs(`(() => {
    for (const k of ['boreal-events-v1', 'boreal.deltas.v1', 'boreal.ground.v1']) localStorage.removeItem(k);
    document.querySelector('#menu-btn').click();
  })()`);
  await sleep(250);
  const startMenuOpen = await evalJs(`(() => {
    const m = document.querySelector('#start-menu');
    const btns = Array.from(m?.querySelectorAll('button') ?? []).map(b => ({ label: b.textContent, disabled: b.disabled }));
    return {
      hidden: m?.hidden ?? null,
      className: m?.className ?? '',
      text: (m?.innerText ?? '').slice(0, 400),
      buttons: btns,
      continueDisabled: btns.find(b => b.label === 'Continue')?.disabled ?? null,
      resumeDisabled: btns.find(b => b.label === 'Resume')?.disabled ?? null,
    };
  })()`);
  await shot('start-menu-open');

  // 3. Press Escape on the open start menu
  await pressEscape();
  await sleep(600);
  const menuAfterEsc = await evalJs(`(() => {
    const m = document.querySelector('#start-menu');
    const st = document.querySelector('#status');
    const rect = st?.getBoundingClientRect();
    return {
      hidden: m?.hidden ?? null,
      className: m?.className ?? '',
      statusVisible: !!rect && rect.width > 0 && rect.height > 0 && getComputedStyle(st).display !== 'none',
      statusText: st?.textContent ?? '',
      player: window.__boreal?.player?.() ?? null,
    };
  })()`);
  await shot('world-after-esc');

  // 4. Also check Resume button click on start menu
  await evalJs(`(() => {
    for (const k of ['boreal-events-v1', 'boreal.deltas.v1', 'boreal.ground.v1']) localStorage.removeItem(k);
    document.querySelector('#menu-btn').click();
  })()`);
  await sleep(150);
  await evalJs(`Array.from(document.querySelectorAll('#start-menu button')).find(b => b.textContent === 'Resume')?.click()`);
  await sleep(150);
  const menuAfterResumeClick = await evalJs(`(() => {
    const m = document.querySelector('#start-menu');
    return { hidden: m?.hidden ?? null, className: m?.className ?? '' };
  })()`);

  const out = {
    task: 'T-0051',
    url,
    viewport: [960, 540],
    beforeMenu,
    pauseOpen,
    pauseAfterEsc,
    startMenuOpen,
    menuAfterEsc,
    menuAfterResumeClick,
    calibration: {
      metric: 'Number(menuAfterEsc.hidden === true && menuAfterEsc.className.includes("fade") && startMenuOpen.continueDisabled === true && menuAfterEsc.statusVisible === true)',
      knownMatch: pauseAfterEsc.hidden === true && pauseAfterEsc.className.includes('fade') ? 1 : 0,
      knownMismatchPreFix: 0,
      postFixScore: menuAfterEsc.hidden === true && menuAfterEsc.className.includes('fade') && startMenuOpen.continueDisabled === true && menuAfterEsc.statusVisible === true ? 1 : 0,
    },
    errors,
  };
  writeFileSync(join(dir, 'capture.json'), JSON.stringify(out, null, 2) + '\n');
  console.log(JSON.stringify(out, null, 2));
} finally {
  try { ws?.close(); } catch { /* ignore */ }
  try { edge.kill(); } catch { /* ignore */ }
  try { server.kill(); } catch { /* ignore */ }
  await sleep(400);
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* ignore */ }
}
