// Second pass: follow camera only, several headings, so the jack pine and the wolf
// are both in a frame that is not the blown-out north view.
import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquire, release, track } from '../../../tools/bench-lock.mjs';
import { execFileSync } from 'node:child_process';

const dir = dirname(fileURLToPath(import.meta.url));
const base = 'http://127.0.0.1:5173/';
const PINE = { x: 141.89987828023732, z: 196.9830065406859, r: 0.153 };
const lockName = 'grok: loop 0926 retake';
if (!(await acquire(lockName, { waitMs: 20000, pollMs: 1000 }))) process.exit(1);

const browser = await chromium.launch({
  executablePath: '/usr/local/bin/google-chrome',
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-dev-shm-usage', '--no-sandbox', '--disable-extensions', '--no-first-run'],
});
const proc = typeof browser.process === 'function' ? browser.process() : null;
if (proc?.pid) track(proc.pid);
const context = await browser.newContext({ viewport: { width: 960, height: 540 } });
const page = await context.newPage();
const out = { pine: PINE, shots: [] };

function wrap(yaw) {
  while (yaw > Math.PI) yaw -= Math.PI * 2;
  while (yaw < -Math.PI) yaw += Math.PI * 2;
  return yaw;
}
async function read() {
  return page.evaluate((pine) => {
    const p = window.__boreal?.player?.() ?? null;
    const frames = window.walkProbe?.frames ?? [];
    const last = frames[frames.length - 1];
    const status = document.querySelector('#status')?.textContent ?? '';
    const d = p ? Math.hypot(p.x - pine.x, p.z - pine.z) : null;
    const round = (n) => Math.round(n * 1000) / 1000;
    return {
      status: status.slice(0, 80),
      photo: status.includes('PHOTO') || document.body.classList.contains('photo-mode'),
      x: p?.x, z: p?.z, yaw: p?.yaw,
      d: d === null ? null : round(d),
      cam: last ? [round(last.cx), round(last.cy), round(last.cz)] : null,
      by: last ? round(last.by) : null,
    };
  }, PINE);
}
function meanLuma(file) {
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']);
  let s = 0; const n = raw.length / 3;
  for (let i = 0; i < raw.length; i += 3) s += raw[i] + raw[i + 1] + raw[i + 2];
  return Math.round(s / n / 3);
}
async function nudge(key, ms) {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
  await page.waitForTimeout(50);
}
async function face(target) {
  for (let i = 0; i < 30; i++) {
    const s = await read();
    const d = wrap(target - s.yaw);
    if (Math.abs(d) < 0.05) return s;
    await nudge(d > 0 ? 'a' : 'd', Math.min(380, Math.abs(d) / 2.2 * 1000 + 40));
  }
  return read();
}
async function goTo(x, z) {
  for (let i = 0; i < 24; i++) {
    const s = await read();
    const dx = x - s.x, dz = z - s.z, dist = Math.hypot(dx, dz);
    if (dist < 0.06) return s;
    await face(Math.atan2(-dx, -dz));
    await nudge('w', Math.min(400, dist / 2 * 1000 + 40));
  }
  return read();
}
async function shot(name, lookDown) {
  if (lookDown) await page.keyboard.down('ArrowDown');
  await page.waitForTimeout(lookDown ? 700 : 350);
  const file = join(dir, name + '.png');
  await page.locator('canvas').screenshot({ path: file });
  const s = await read();
  const luma = meanLuma(file);
  if (lookDown) await page.keyboard.up('ArrowDown');
  const row = { name, luma, ...s };
  out.shots.push(row);
  console.log(name, JSON.stringify({ d: s.d, yaw: s.yaw && +s.yaw.toFixed(3), photo: s.photo, luma, cam: s.cam }));
  return row;
}

try {
  const url = `${base}?nomenu&bench&rec&stages=1&walkprobe&hour=10&at=${PINE.x},${PINE.z},0.8`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  const t0 = Date.now();
  for (;;) {
    if (await page.locator('#loading').count() === 0) break;
    if (Date.now() - t0 > 180000) throw new Error('loading timeout');
    await page.waitForTimeout(4000);
    console.log('loading', Math.round((Date.now() - t0) / 1000));
  }
  await page.waitForTimeout(3000);
  await page.mouse.click(480, 270);
  // hour 10 so the sun is east, not blasting a north or south view.
  const yaws = [0.8, 2.4, -2.4, -0.8, 1.6];
  for (const y of yaws) {
    await face(y);
    await page.waitForTimeout(200);
    const tag = 'yaw' + String(y).replace('-', 'm').replace('.', '_');
    await shot('ring-' + tag, false);
    await shot('ring-' + tag + '-down', true);
  }
  await goTo(PINE.x + 0.62, PINE.z + 0.05);
  await face(0.8);
  await shot('east-of-pine', false);
  await shot('east-of-pine-down', true);
} catch (e) {
  out.error = String(e);
  console.error(e);
} finally {
  writeFileSync(join(dir, 'retake.json'), JSON.stringify(out, null, 2));
  try { await context.close(); } catch {}
  try { await browser.close(); } catch {}
  release(lockName);
}
console.log('retake done', out.shots.length);
