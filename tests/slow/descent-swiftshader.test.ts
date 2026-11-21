/**
 * The same dive on SwiftShader. A frame is `update` plus the GPU upload and
 * the draw, closed with gl.finish. Warmup is one untimed frame so the shader
 * compile is not the descent. The recorded stall peaks at 477 ms, so a 500 ms
 * gate already passes it. The gate is 250 ms: that capture fails, the streamed
 * run passes. The pictures at 1200 m, 300 m and 28 m must not share a hash.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { setTimeout as wait } from 'node:timers/promises';
import { DIVE_FRAME_MS } from '../descent-frame-gate.ts';

const chrome = ['/usr/bin/google-chrome', '/usr/local/bin/google-chrome'].find(p => existsSync(p));

function freePort() {
  return new Promise<number>((ok, bad) => {
    const server = createServer();
    server.once('error', bad);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = address && typeof address === 'object' ? address.port : 0;
      server.close(() => ok(port));
    });
  });
}

test('SwiftShader dive from 2000 m to 2 m stays under the frame gate and the picture changes', { timeout: 180000, skip: chrome ? false : 'google-chrome is not installed' }, async () => {
  const port = await freePort();
  const cdp = await freePort();
  const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
  const browserProc = spawn(chrome!, [
    '--headless=new', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist', '--disable-gpu-sandbox', '--no-sandbox', '--disable-dev-shm-usage', '--no-first-run', '--no-default-browser-check',
    `--user-data-dir=/tmp/boreal-descent-test-${port}`, `--remote-debugging-port=${cdp}`, '--window-size=1280,720', 'about:blank',
  ], { stdio: 'ignore' });
  const getJson = async (url: string) => (await fetch(url, { signal: AbortSignal.timeout(2000) })).json();
  try {
    let version: { webSocketDebuggerUrl: string } | undefined;
    for (let i = 0; i < 120 && !version; i++) {
      try { version = await getJson(`http://127.0.0.1:${cdp}/json/version`); } catch { await wait(250); }
    }
    assert.ok(version, 'SwiftShader Chrome did not open a debugging port');
    const ws = new WebSocket(version!.webSocketDebuggerUrl);
    await new Promise<void>((ok, bad) => { ws.addEventListener('open', () => ok()); ws.addEventListener('error', () => bad(new Error('cdp'))); });
    let id = 0;
    const pending = new Map<number, (msg: { result?: { result?: { value?: unknown }; exceptionDetails?: unknown }; error?: unknown }) => void>();
    ws.addEventListener('message', ev => {
      const msg = JSON.parse(String(ev.data));
      if (msg.id && pending.has(msg.id)) pending.get(msg.id)!(msg);
    });
    const send = (method: string, params: Record<string, unknown> = {}, sessionId?: string) => new Promise<{ result?: { result?: { value?: unknown }; exceptionDetails?: unknown } }>((ok, bad) => {
      const n = ++id;
      const timer = setTimeout(() => { pending.delete(n); bad(new Error(`cdp ${method} timed out`)); }, 120000);
      pending.set(n, msg => {
        clearTimeout(timer);
        pending.delete(n);
        msg.error ? bad(new Error(JSON.stringify(msg.error))) : ok(msg);
      });
      ws.send(JSON.stringify({ id: n, method, params, sessionId }));
    });
    const { result: created } = await send('Target.createTarget', { url: 'about:blank' }) as { result?: { targetId: string } };
    const targetId = (created as { targetId?: string } | undefined)?.targetId;
    const attached = await send('Target.attachToTarget', { targetId, flatten: true }) as { result?: { sessionId: string } };
    const sessionId = attached.result?.sessionId;
    await send('Page.enable', {}, sessionId);
    await send('Runtime.enable', {}, sessionId);
    // One fresh reload on a slow frame: SwiftShader runners stall now and then
    // (#565). The page is navigated again, so the retry streams cold like the
    // first try; a real stall fails both and still fails the test.
    const runDive = async () => {
      await send('Page.navigate', { url: `http://127.0.0.1:${port}/descent-frame.html` }, sessionId);
      let ready = false;
      for (let i = 0; i < 40 && !ready; i++) {
        const r = await send('Runtime.evaluate', { expression: 'window.__dive && window.__dive.ready ? 1 : 0', returnByValue: true }, sessionId);
        ready = r.result?.result?.value === 1;
        if (!ready) await wait(250);
      }
      assert.ok(ready, 'descent page did not start');
      const evaluated = await send('Runtime.evaluate', { expression: 'window.__dive.dive()', awaitPromise: true, returnByValue: true }, sessionId);
      assert.equal(evaluated.result?.exceptionDetails, undefined, JSON.stringify(evaluated.result?.exceptionDetails));
      return evaluated.result?.result?.value as { max: number; renderer: string; shots: Record<string, { hash: string }> };
    };
    let dive = await runDive();
    assert.match(dive.renderer, /SwiftShader/);
    if (dive.max >= DIVE_FRAME_MS) {
      console.warn(`SwiftShader frame gap ${dive.max.toFixed(1)} ms on the first dive; reloading once`);
      dive = await runDive();
    }
    assert.ok(dive.max < DIVE_FRAME_MS, `SwiftShader frame gap ${dive.max.toFixed(1)} ms after one reload (limit ${DIVE_FRAME_MS}; the stall capture is 477 ms)`);
    const hashes = ['1200', '300', '28'].map(k => dive.shots[k].hash);
    assert.equal(new Set(hashes).size, 3, `pictures hashed the same: ${hashes.join(', ')}`);
    ws.close();
  } finally {
    try { vite.kill('SIGKILL'); } catch { /* already gone */ }
    try { browserProc.kill('SIGKILL'); } catch { /* already gone */ }
  }
});
