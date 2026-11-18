/**
 * Headless visit of `?autoplay=1`. The page plays itself through the real menu,
 * film, globe click, landing, and a short walk. Chrome is required.
 * Run with `npm run test:slow`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, copyFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Browser, type Page } from 'playwright-core';

const root = join(import.meta.dirname, '../..');
const port = 5217;
const chrome = ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find(p => existsSync(p));

test('autoplay reaches the end without a page error', { timeout: 840_000 }, async () => {
  assert.ok(chrome, 'Chrome is not installed (google-chrome or chromium)');
  const frames = '/opt/cursor/artifacts';
    mkdirSync(frames, { recursive: true });
    mkdirSync('/tmp/autoplay-video', { recursive: true });
  const logs: string[] = [];
  const errors: string[] = [];
  let vite: ChildProcess | undefined;
  let browser: Browser | undefined;
  let page: Page | undefined;
  try {
    vite = spawn(join(root, 'node_modules/.bin/vite'), ['--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    await waitFor(`http://127.0.0.1:${port}/`);
    browser = await chromium.launch({
      executablePath: chrome,
      headless: true,
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-sandbox', '--no-sandbox', '--disable-dev-shm-usage'],
    });
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: '/tmp/autoplay-video', size: { width: 1280, height: 720 } } });
    page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', msg => {
      const line = msg.text();
      if (msg.type() === 'error') errors.push(line);
      if (line.startsWith('AUTOPLAY ')) {
        logs.push(line);
        console.log(line);
        const slug = line.replace(/[^a-z0-9]+/gi, '-').slice(0, 80);
        void page!.screenshot({ path: join(frames, `autoplay-${logs.length}-${slug}.png`) }).catch(() => {});
      }
    });
    await page.goto(`http://127.0.0.1:${port}/?autoplay=1`, { waitUntil: 'domcontentloaded' });
    try {
      await page.waitForFunction(() => (window as unknown as { __autoplayDone?: boolean }).__autoplayDone === true, undefined, { timeout: 780_000 });
    } catch (err) {
      console.log(`LOGS\n${logs.join('\n')}\nERRORS\n${errors.join('\n')}`);
      await page.screenshot({ path: join(frames, 'autoplay-timeout.png') }).catch(() => {});
      throw err;
    }
    const shot = join(frames, 'autoplay-done.png');
    await page.screenshot({ path: shot });
    const video = page.video();
    await context.close();
    page = undefined;
    if (video) {
      const from = await video.path();
      copyFileSync(from, join(frames, 'autoplay.webm'));
    }
  } finally {
    await page?.context().close().catch(() => {});
    await browser?.close().catch(() => {});
    vite?.kill('SIGTERM');
  }
  assert.deepEqual(errors, [], `page errors:\n${errors.join('\n')}\nlog:\n${logs.join('\n')}`);
  assert.ok(logs.some(l => /clicked a land spot/.test(l)), `no land click\n${logs.join('\n')}`);
  assert.ok(logs.some(l => /clicked Explore/.test(l)), `Explore was not clicked\n${logs.join('\n')}`);
  assert.ok(logs.some(l => /finished the forest follow/.test(l)), `visit did not finish\n${logs.join('\n')}`);
  assert.equal(readdirSync(frames).some(n => n.startsWith('autoplay-')), true);
});

async function waitFor(url: string) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(url);
      if (r.ok || r.status === 404) return;
    } catch { /* not up */ }
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error(`vite did not start at ${url}`);
}
