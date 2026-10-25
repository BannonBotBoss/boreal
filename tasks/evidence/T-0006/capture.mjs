/**
 * T-0006 live probe. Headless Chrome, SwiftShader. Serves the dev server.
 * node tasks/evidence/T-0006/capture.mjs <port>
 * URL places the wolf where pushContact succeeds on stones:-2:-2:2, facing the log -2:-2:1.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = process.argv[2] ?? '5276';
const out = new URL('.', import.meta.url).pathname;
const sleep = ms => new Promise(r => setTimeout(r, ms));
mkdirSync(out, { recursive: true });
const profile = mkdtempSync(join(tmpdir(), 'boreal-t0006-'));
const debug = 9400 + (Number(PORT) % 20);
const chrome = spawn('google-chrome', [
  '--headless=new', '--disable-extensions', '--no-first-run', '--disable-gpu',
  '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
  `--remote-debugging-port=${debug}`, `--user-data-dir=${profile}`, 'about:blank',
], { stdio: 'ignore' });
let ws;
const begins = [], ends = [], errors = [];
try {
  let tabs;
  for (let i = 0; i < 40; i++) {
    try { tabs = await (await fetch(`http://127.0.0.1:${debug}/json`)).json(); break; }
    catch { await sleep(250); }
  }
  if (!tabs) throw Error('chrome debug port closed');
  ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise(r => { ws.onopen = r; });
  let id = 0; const pending = new Map();
  ws.onmessage = e => {
    const d = JSON.parse(e.data);
    if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); }
    if (d.method === 'Runtime.exceptionThrown') errors.push(d.params?.exceptionDetails?.exception?.description ?? d.params?.exceptionDetails?.text);
    if (d.method === 'Runtime.consoleAPICalled') {
      const line = d.params.args?.map(a => a.value ?? a.description).join(' ') ?? '';
      if (line.startsWith('[contacts] begin')) begins.push({ t: Date.now(), line });
      if (line.startsWith('[contacts] end')) ends.push({ t: Date.now(), line });
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
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  const at = '74.9745,-66.3155,0';
  const url = `http://127.0.0.1:${PORT}/?nomenu&contacts=1&rec&stages=1&hour=12&at=${at}`;
  await cdp('Page.navigate', { url });
  // detect-gpu's tier probe does not resolve under SwiftShader (the loading step stays on "Measuring your graphics hardware").
  // Chunks and contact edges are already live behind that screen, so the probe waits for the log's begin and then removes the cover.
  const logKey = '1:-2:9';
  let ready = false;
  for (let i = 0; i < 40; i++) {
    await sleep(1000);
    if (begins.some(b => b.line.startsWith(`[contacts] begin ${logKey} |`))) { ready = true; break; }
  }
  if (!ready) throw Error('log contact did not begin');
  await ev(`document.getElementById('loading')?.remove(); Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });`);
  // Neighbouring chunks are still streaming. Wait until no new edge for 2 s (or 25 s) before the idle window.
  let quietAt = begins.length + ends.length;
  for (let i = 0; i < 25; i++) {
    await sleep(1000);
    const n = begins.length + ends.length;
    if (n === quietAt && i > 1) break;
    quietAt = n;
  }
  const loaded = begins.length;
  const loadedEnds = ends.length;
  const loadedKeys = new Set(begins.map(b => b.line.split(' ')[2]));
  await sleep(6000);
  const idleBegins = begins.length - loaded;
  const idleEnds = ends.length - loadedEnds;
  const idleRepeat = begins.slice(loaded).filter(b => loadedKeys.has(b.line.split(' ')[2])).length;
  const saveBefore = await ev(`localStorage.getItem('boreal.events.v1')`);
  const shot = async name => {
    const s = await cdp('Page.captureScreenshot', { format: 'png' }, 60000);
    writeFileSync(`${out}/${name}.png`, Buffer.from(s.result.data, 'base64'));
  };
  const key = async (keyName, type) => ev(`window.dispatchEvent(new KeyboardEvent('${type}', { key: ${JSON.stringify(keyName)}, bubbles: true }))`);
  await key('ArrowDown', 'keydown'); await sleep(1200); await key('ArrowDown', 'keyup');
  await ev(`window.showWhy?.(${JSON.stringify(logKey)})`);
  const whyLines = async () => ev(`(() => { const rows = [...document.querySelectorAll('#inspector .row')]; const hit = rows.filter(r => ['now','chain'].includes(r.querySelector('.name')?.textContent ?? '')); hit[0]?.scrollIntoView({ block: 'center' }); return hit.map(r => r.innerText.replace(/\\s+/g, ' ')); })()`);
  const logWhy = await whyLines();
  await sleep(200);
  await shot('log-why');
  const actBefore = await ev(`({text: document.getElementById('act')?.textContent, disabled: document.getElementById('act')?.disabled, target: document.getElementById('target')?.textContent})`);
  await ev(`document.getElementById('act')?.click()`);
  await sleep(1200);
  const notice = await ev(`document.getElementById('notice')?.textContent ?? ''`);
  const saveAfter = await ev(`localStorage.getItem('boreal.events.v1')`);
  const status = await ev(`document.getElementById('status')?.innerText ?? ''`);
  const remembered = saveAfter ? Object.keys(JSON.parse(saveAfter).records ?? {}) : [];
  const rockKey = remembered[0] ?? 'stones:1:-2:41';
  let rockWhy = [];
  for (let i = 0; i < 16; i++) {
    await ev(`window.showWhy?.(${JSON.stringify(rockKey)})`);
    rockWhy = await whyLines() ?? [];
    if (rockWhy.some(t => String(t).includes('moved by the player'))) break;
    await sleep(500);
  }
  await shot('rock-why');
  const player0 = await ev(`window.__boreal?.player?.()`);
  await key('Shift', 'keydown'); await key('w', 'keydown');
  await sleep(12000);
  await key('w', 'keyup'); await key('Shift', 'keyup');
  await sleep(2000);
  const player1 = await ev(`window.__boreal?.player?.()`);
  const walkEnds = ends.length - loadedEnds - idleEnds;
  const walkBegins = begins.length - loaded - idleBegins;
  const keysInSave = saveAfter ? Object.keys(JSON.parse(saveAfter).records ?? {}) : [];
  const report = {
    url, ready, loadedBegins: loaded, idleBegins, idleEnds, idleRepeat, walkBegins, walkEnds,
    logSeen: begins.some(b => b.line.startsWith(`[contacts] begin ${logKey} |`)),
    logLines: begins.filter(b => b.line.startsWith(`[contacts] begin ${logKey} |`)).length,
    saveBeforeBytes: saveBefore ? saveBefore.length : 0,
    saveAfterKeys: keysInSave,
    saveHasLog: keysInSave.some(k => k.includes(':') && !k.startsWith('stones')),
    status: status?.split('\n')[0],
    actBefore, notice,
    logWhy, rockWhy,
    player0, player1,
    sampleBegins: begins.slice(0, 5).map(b => b.line),
    errors: errors.slice(0, 8),
  };
  writeFileSync(`${out}/capture.json`, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally {
  ws?.close();
  chrome.kill('SIGKILL');
  try { rmSync(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }); } catch { /* profile */ }
}
