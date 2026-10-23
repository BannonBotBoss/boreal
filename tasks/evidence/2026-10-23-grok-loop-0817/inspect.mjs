// Terrain, morning sun, and plants. Canvas shots only (no HUD).
import { chromium } from 'playwright-core';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquire, release, track } from '../../../tools/bench-lock.mjs';

const dir = dirname(fileURLToPath(import.meta.url));
const base = 'http://127.0.0.1:5173/';
const profile = mkdtempSync(join(tmpdir(), 'grok-loop-0817c-'));
const errors = [];
const lockName = 'grok: loop 0817 inspect';
const q = (extra) => `${base}?nomenu&bench&rec&stages=1&walkprobe&${extra}`;

if (!(await acquire(lockName, { waitMs: 20000, pollMs: 1000 }))) {
  console.error('bench lock not acquired');
  process.exit(1);
}
const context = await chromium.launchPersistentContext(profile, {
  executablePath: process.env.CHROME ?? '/usr/bin/google-chrome',
  headless: true,
  viewport: { width: 960, height: 540 },
  args: [
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist', '--disable-dev-shm-usage', '--no-sandbox',
    '--disable-extensions', '--no-first-run', '--autoplay-policy=no-user-gesture-required',
  ],
});
const browser = context.browser();
if (browser?.process()?.pid) track(browser.process().pid);
const page = context.pages()[0] ?? await context.newPage();
page.on('pageerror', e => errors.push(String(e).slice(0, 300)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 240)); });

async function settle(url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForSelector('#loading', { state: 'detached', timeout: 180000 });
  await page.waitForTimeout(8000);
  if (!page.url().startsWith(base)) throw new Error('unexpected url ' + page.url());
  await page.mouse.click(480, 270);
  await page.waitForTimeout(200);
}
async function info() {
  return page.evaluate(() => {
    const frames = window.walkProbe?.frames ?? [];
    const last = frames[frames.length - 1];
    const p = window.__boreal?.player?.() ?? null;
    const round = (n) => Math.round(n * 1000) / 1000;
    return {
      href: location.href,
      status: (document.querySelector('#status')?.textContent ?? '').replace(/\s+/g, ' ').slice(0, 120),
      x: p?.x, z: p?.z, yaw: p?.yaw,
      cam: last ? { x: round(last.cx), y: round(last.cy), z: round(last.cz) } : null,
      body: last ? { y: round(last.by) } : null,
    };
  });
}
async function shot(name) {
  await page.locator('canvas').screenshot({ path: join(dir, name + '.png') });
  return { name, ...(await info()) };
}

const out = { shots: [], errors };
try {
  await settle(q('hour=12&at=144,236,-1.571'));
  out.shots.push(await shot('terrain-ahead'));
  await page.keyboard.down('ArrowDown');
  await page.waitForTimeout(1200);
  out.shots.push(await shot('terrain-down'));
  await page.keyboard.up('ArrowDown');

  await settle(q('hour=12&at=152,208,0'));
  out.shots.push(await shot('plants-outcrop'));

  await settle(q('hour=12&at=148,64,0'));
  out.shots.push(await shot('plants-forest'));

  // Hour 7, yaw faces local-solar azimuth 91.854° (yaw -1.6031). ArrowUp settles pitch at -20°.
  await settle(q('hour=7&at=200,250,-1.6031'));
  out.shots.push(await shot('sun-level'));
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(1600);
  out.shots.push(await shot('sun-up'));
  await page.keyboard.up('ArrowUp');
} finally {
  writeFileSync(join(dir, 'inspect.json'), JSON.stringify(out, null, 2));
  await context.close();
  rmSync(profile, { recursive: true, force: true });
  release(lockName);
}
console.log(JSON.stringify(out.shots.map(s => ({ name: s.name, status: s.status, yaw: s.yaw, cam: s.cam })), null, 2));
