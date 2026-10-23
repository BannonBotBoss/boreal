// Second capture: morning sun aimed at local-solar azimuth, after the exposure settles.
import { chromium } from 'playwright-core';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquire, release, track } from '../../../tools/bench-lock.mjs';
import { sunPosition } from '../../../src/core/timeOfDay.ts';

const dir = dirname(fileURLToPath(import.meta.url));
const base = 'http://127.0.0.1:5173/';
const profile = mkdtempSync(join(tmpdir(), 'grok-loop-1422b-'));
const lockName = 'grok: loop 1422 sun';
const sun = sunPosition(7.1667);
const yaw = -1.6031;
if (!(await acquire(lockName, { waitMs: 15000, pollMs: 500 }))) process.exit(1);
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/usr/local/bin/google-chrome',
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-dev-shm-usage', '--no-sandbox', '--disable-extensions', '--no-first-run'],
});
const proc = typeof browser.process === 'function' ? browser.process() : null;
if (proc?.pid) track(proc.pid);
const errors = [];
try {
  const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 180)); });
  const url = `${base}?nomenu&bench&stages=1&hour=7&at=144,236,${yaw}`;
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !document.querySelector('#loading'), { timeout: 60000 });
  if (!page.url().startsWith(base)) throw new Error(page.url());
  await page.waitForTimeout(12000);
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(1600);
  await page.keyboard.up('ArrowUp');
  await page.screenshot({ path: join(dir, 'sun-aimed.png') });
  const status = await page.locator('#status').innerText().catch(() => '');
  writeFileSync(join(dir, 'sun-aimed.json'), JSON.stringify({ url: page.url(), status: status.slice(0, 160), sun, yaw, errors }, null, 2));
  console.log(status.slice(0, 80));
} finally {
  await browser.close().catch(() => {});
  release(lockName);
  rmSync(profile, { recursive: true, force: true });
}
