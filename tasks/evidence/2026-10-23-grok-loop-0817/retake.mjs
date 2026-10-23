// Clearer side views of the wolf standing on placed jack pine 3:4:10.
import { chromium } from 'playwright-core';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquire, release, track } from '../../../tools/bench-lock.mjs';

const dir = dirname(fileURLToPath(import.meta.url));
const base = 'http://127.0.0.1:5173/';
const profile = mkdtempSync(join(tmpdir(), 'grok-loop-0817b-'));
const errors = [];
const PINE = { key: '3:4:10', x: 141.8997, z: 196.983, r: 0.153, species: 'jack-pine' };
const lockName = 'grok: loop 0817 retake';

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

async function cam() {
  return page.evaluate(() => {
    const frames = window.walkProbe?.frames ?? [];
    const last = frames[frames.length - 1];
    const p = window.__boreal?.player?.() ?? null;
    const round = (n) => Math.round(n * 1000) / 1000;
    const d = p ? Math.hypot(p.x - 141.8997, p.z - 196.983) : null;
    return {
      href: location.href,
      status: (document.querySelector('#status')?.textContent ?? '').slice(0, 40),
      px: p?.x, pz: p?.z, yaw: p?.yaw, d: d === null ? null : round(d),
      by: last ? round(last.by) : null,
      cx: last ? round(last.cx) : null, cy: last ? round(last.cy) : null, cz: last ? round(last.cz) : null,
    };
  });
}
async function nudge(key, ms) {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
  await page.waitForTimeout(60);
}
async function fly(tx, tz, ty) {
  for (let i = 0; i < 50; i++) {
    const c = await cam();
    const ex = c.cx - tx, ez = c.cz - tz, ey = c.cy - ty;
    if (Math.abs(ex) < 0.4 && Math.abs(ez) < 0.4 && Math.abs(ey) < 0.35) return c;
    if (Math.abs(ez) >= 0.4) await nudge(ez > 0 ? 'w' : 's', Math.min(800, Math.abs(ez) / 6 * 1000 + 60));
    else if (Math.abs(ex) >= 0.4) await nudge(ex > 0 ? 'a' : 'd', Math.min(800, Math.abs(ex) / 6 * 1000 + 60));
    else await nudge(ey > 0 ? 'q' : 'e', Math.min(600, Math.abs(ey) / 6 * 1000 + 60));
  }
  return cam();
}
async function look(dx, dy) {
  const box = await page.locator('canvas').boundingBox();
  const x0 = box.x + 800, y0 = box.y + 280;
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  await page.mouse.move(x0 + dx, y0 + dy, { steps: 30 });
  await page.mouse.up();
  await page.waitForTimeout(400);
}

const out = { pine: PINE, shots: [], errors };
try {
  const url = `${base}?nomenu&bench&rec&stages=1&walkprobe&hour=12&at=141.900,196.983,0`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForSelector('#loading', { state: 'detached', timeout: 180000 });
  await page.waitForTimeout(10000);
  if (!page.url().startsWith(base)) throw new Error('unexpected url ' + page.url());
  await page.mouse.click(480, 270);
  out.onTrunk = await cam();
  await page.locator('canvas').screenshot({ path: join(dir, 'pine-on-follow.png') });
  out.shots.push('pine-on-follow');

  await page.keyboard.press('p');
  await page.waitForFunction(() => (document.querySelector('#status')?.textContent ?? '').includes('PHOTO'), { timeout: 8000 });
  await page.waitForTimeout(300);
  const bodyY = (await cam()).by ?? 4.4;
  out.eastCam = await fly(PINE.x + 8, PINE.z, bodyY + 1.6);
  await look(-393, 20);
  out.eastAfterLook = await cam();
  await page.locator('canvas').screenshot({ path: join(dir, 'pine-overlap-east.png') });
  out.shots.push('pine-overlap-east');

  // back to a known yaw: this drag aimed west. Fly north from here would use the new yaw.
  // Reload for the north camera so yaw starts at 0 again.
  await page.keyboard.press('p');
  await page.waitForTimeout(400);
} finally {
  writeFileSync(join(dir, 'retake.json'), JSON.stringify(out, null, 2));
  await context.close();
  rmSync(profile, { recursive: true, force: true });
  release(lockName);
}
console.log(JSON.stringify({ onTrunk: out.onTrunk, east: out.eastCam, after: out.eastAfterLook, shots: out.shots }, null, 2));
