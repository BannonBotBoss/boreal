// Gaits and ground plants. Follow camera. No photo mode.
import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquire, release, track } from '../../../tools/bench-lock.mjs';

const dir = dirname(fileURLToPath(import.meta.url));
const lockName = 'grok: loop 0926 inspect';
if (!(await acquire(lockName, { waitMs: 25000, pollMs: 1000 }))) process.exit(1);
const browser = await chromium.launch({
  executablePath: '/usr/local/bin/google-chrome',
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-dev-shm-usage', '--no-sandbox', '--disable-extensions', '--no-first-run'],
});
const proc = typeof browser.process === 'function' ? browser.process() : null;
if (proc?.pid) track(proc.pid);
const context = await browser.newContext({ viewport: { width: 960, height: 540 }, recordVideo: { dir, size: { width: 960, height: 540 } } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e).slice(0, 200)));
const out = { errors };

async function settle(url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  const t0 = Date.now();
  for (;;) {
    if (await page.locator('#loading').count() === 0) break;
    if (Date.now() - t0 > 180000) throw new Error('loading');
    await page.waitForTimeout(4000);
    console.log('loading', Math.round((Date.now() - t0) / 1000));
  }
  await page.waitForTimeout(2500);
  await page.mouse.click(480, 270);
}

async function shot(name) {
  await page.locator('canvas').screenshot({ path: join(dir, name + '.png') });
  const s = await page.evaluate(() => {
    const p = window.__boreal?.player?.() ?? null;
    const frames = window.walkProbe?.frames ?? [];
    const last = frames[frames.length - 1];
    const status = document.querySelector('#status')?.textContent ?? '';
    return {
      status: status.slice(0, 100),
      photo: status.includes('PHOTO'),
      x: p?.x, z: p?.z, yaw: p?.yaw,
      hares: window.__boreal?.hares?.() ?? [],
      last: last ? { x: last.bx, z: last.bz, y: last.by, speed: last.speed, phase: last.phase, gait: last.gait } : null,
    };
  });
  console.log(name, JSON.stringify({ photo: s.photo, gait: s.last?.gait, speed: s.last?.speed, hares: s.hares?.length }));
  return s;
}

try {
  await settle('http://127.0.0.1:5173/?nomenu&bench&rec&stages=1&walkprobe&hour=10&at=144,236,0');
  out.stand = await shot('plants-stand');
  await page.keyboard.down('ArrowDown');
  await page.waitForTimeout(800);
  out.plants = await shot('plants-down');
  await page.keyboard.up('ArrowDown');
  await page.waitForTimeout(200);

  await page.evaluate(() => window.walkProbe?.clear?.());
  await page.keyboard.down('w');
  out.gaitShots = [];
  for (let i = 0; i < 4; i++) {
    await page.waitForTimeout(700);
    out.gaitShots.push(await shot('gait-' + i));
  }
  await page.keyboard.up('w');
  out.probe = await page.evaluate(() => {
    const frames = window.walkProbe?.frames ?? [];
    return frames.filter((_, i) => i % 3 === 0).slice(-80).map(f => ({
      t: f.t, x: f.bx, z: f.bz, speed: f.speed, phase: f.phase, gait: f.gait,
    }));
  });
  console.log('probe', out.probe.length);
} catch (e) {
  out.error = String(e);
  console.error(e);
} finally {
  out.errors = errors.slice(0, 12);
  writeFileSync(join(dir, 'inspect.json'), JSON.stringify(out, null, 2));
  const video = page.video();
  try { await context.close(); } catch {}
  try { await browser.close(); } catch {}
  if (video) {
    try {
      const { renameSync } = await import('node:fs');
      renameSync(await video.path(), join(dir, 'inspect.webm'));
    } catch (e) { console.error('video', e); }
  }
  release(lockName);
}
console.log('inspect done');
