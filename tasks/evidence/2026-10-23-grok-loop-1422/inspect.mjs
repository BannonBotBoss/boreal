// 14:22 PT loop. Plants, terrain, morning light, and whatever animal is in the follow frame.
// Headless Chrome, SwiftShader, isolated profile. No photo mode.
import { chromium } from 'playwright-core';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquire, release, track } from '../../../tools/bench-lock.mjs';
import { sunPosition } from '../../../src/core/timeOfDay.ts';

const dir = dirname(fileURLToPath(import.meta.url));
const base = 'http://127.0.0.1:5173/';
const profile = mkdtempSync(join(tmpdir(), 'grok-loop-1422-'));
const errors = [];
const lockName = 'grok: loop 1422 inspect';
const out = { base, profile, shots: [], errors, sun: sunPosition(7), commit: 'fd65b8d game via board-loop' };

if (!(await acquire(lockName, { waitMs: 20000, pollMs: 1000 }))) {
  console.error('bench lock not acquired');
  process.exit(1);
}

const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/usr/local/bin/google-chrome',
  headless: true,
  args: [
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist', '--disable-dev-shm-usage', '--no-sandbox',
    '--disable-extensions', '--no-first-run',
  ],
});
const proc = typeof browser.process === 'function' ? browser.process() : null;
if (proc?.pid) track(proc.pid);
try {
  const context = await browser.newContext({ viewport: { width: 960, height: 540 } });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(String(e).slice(0, 300)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 240)); });

  async function settle(url) {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !document.querySelector('#loading'), { timeout: 60000 });
    await page.waitForTimeout(8000);
    const href = page.url();
    if (!href.startsWith(base)) throw new Error('unexpected url ' + href);
    return href;
  }
  async function shot(name) {
    const status = await page.locator('#status').innerText().catch(() => '');
    const href = page.url();
    await page.screenshot({ path: join(dir, name + '.png') });
    out.shots.push({ name, href, status: status.slice(0, 180) });
    console.log(name, status.slice(0, 120));
  }

  const stand = await settle(base + '?nomenu&bench&stages=1&hour=10&at=144,236,0');
  out.standUrl = stand;
  await shot('stand');
  await page.keyboard.down('ArrowDown');
  await page.waitForTimeout(1200);
  await page.keyboard.up('ArrowDown');
  await shot('plants-down');
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(400);
  await page.keyboard.up('ArrowUp');
  await shot('terrain-ahead');
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(2500);
  await page.keyboard.up('KeyW');
  await shot('walk');

  const sunUrl = await settle(base + '?nomenu&bench&stages=1&hour=7&at=144,236,0');
  out.sunUrl = sunUrl;
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(1600);
  await page.keyboard.up('ArrowUp');
  await shot('sun-up');
  writeFileSync(join(dir, 'inspect.json'), JSON.stringify(out, null, 2));
} finally {
  await browser.close().catch(() => {});
  release(lockName);
  rmSync(profile, { recursive: true, force: true });
}
