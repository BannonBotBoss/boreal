// SwiftShader stills of the horizon mesh at 1200 m, 300 m and 28 m.
// node tools/descent-frame-shot.mjs before|after
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { setTimeout as wait } from 'node:timers/promises';

const which = process.argv[2] === 'after' ? 'after' : 'before';
const OUT = new URL(`../tasks/evidence/T-0259/`, import.meta.url);
mkdirSync(OUT, { recursive: true });
const PORT = 5199;
const CDP = 9334;
const chromeBin = process.env.CHROME ?? '/usr/bin/google-chrome';

const vite = spawn('npx', ['vite', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'], {
  cwd: new URL('..', import.meta.url).pathname,
  stdio: ['ignore', 'pipe', 'pipe'],
});
const chrome = spawn(chromeBin, [
  '--headless=new',
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist',
  '--disable-gpu-sandbox',
  '--no-first-run',
  '--no-default-browser-check',
  '--user-data-dir=/tmp/boreal-descent-chrome',
  `--remote-debugging-port=${CDP}`,
  '--window-size=1280,720',
  'about:blank',
], { stdio: ['ignore', 'pipe', 'pipe'] });

function die(err) {
  vite.kill('SIGTERM');
  chrome.kill('SIGTERM');
  console.error(err);
  process.exit(1);
}

async function cdp() {
  let version;
  for (let i = 0; i < 40; i++) {
    try {
      version = await (await fetch(`http://127.0.0.1:${CDP}/json/version`)).json();
      break;
    } catch { await wait(250); }
  }
  if (!version) die('chrome did not open a debugging port');
  const browser = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((ok, bad) => { browser.addEventListener('open', ok); browser.addEventListener('error', bad); });
  let id = 0;
  const pending = new Map();
  browser.addEventListener('message', ev => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) pending.get(msg.id)(msg);
  });
  const send = (method, params = {}, sessionId) => new Promise((ok, bad) => {
    const n = ++id;
    pending.set(n, msg => { pending.delete(n); msg.error ? bad(new Error(JSON.stringify(msg.error))) : ok(msg.result); });
    browser.send(JSON.stringify({ id: n, method, params, sessionId }));
  });
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Page.enable', {}, sessionId);
  await send('Runtime.enable', {}, sessionId);
  await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/descent-frame.html` }, sessionId);
  let dive;
  for (let i = 0; i < 80; i++) {
    const r = await send('Runtime.evaluate', {
      expression: 'window.__dive && window.__dive.ready ? "ready" : ""',
      returnByValue: true,
    }, sessionId);
    if (r.result?.value === 'ready') break;
    await wait(500);
  }
  const evaluated = await send('Runtime.evaluate', {
    expression: 'window.__dive.dive()',
    awaitPromise: true,
    returnByValue: true,
  }, sessionId);
  if (evaluated.exceptionDetails) die(JSON.stringify(evaluated.exceptionDetails));
  dive = evaluated.result.value;
  const marks = [1200, 300, 28];
  for (const eye of marks) {
    await send('Runtime.evaluate', {
      expression: `window.__dive.step(${eye})`,
      awaitPromise: true,
      returnByValue: true,
    }, sessionId);
    // Let the fine leaves catch up on the fixed code. The old code finishes in the one call.
    await send('Runtime.evaluate', {
      expression: `(() => { let g = 0; while (window.__terrain && window.__terrain.pending > 0 && g++ < 120) window.__dive.step(${eye}); return g; })()`,
      returnByValue: true,
    }, sessionId);
    const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 80 }, sessionId);
    writeFileSync(new URL(`${which}-${eye}m.jpg`, OUT), Buffer.from(shot.data, 'base64'));
  }
  writeFileSync(new URL(`${which}.json`, OUT), JSON.stringify(dive, null, 2));
  browser.close();
  return dive;
}

try {
  const dive = await cdp();
  console.log(which, 'max', dive.max, 'renderer', dive.renderer);
  console.log(JSON.stringify(dive.shots));
} catch (err) {
  die(err?.stack || err);
} finally {
  vite.kill('SIGTERM');
  chrome.kill('SIGTERM');
  setTimeout(() => process.exit(0), 200);
}
