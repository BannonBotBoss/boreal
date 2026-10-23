// One settled page at the outcrop, then the flora tooling camera on each plant.
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquire, release, track } from '../../../tools/bench-lock.mjs';

const dir = dirname(fileURLToPath(import.meta.url));
const name = 'grok: plants retake';
if (!(await acquire(name))) process.exit(1);
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-dev-shm-usage', '--no-sandbox', '--disable-extensions', '--no-first-run'],
});
const proc = typeof browser.process === 'function' ? browser.process() : null;
if (proc?.pid) track(proc.pid);
const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e).slice(0, 200)));

function stats(buf) {
  const png = PNG.sync.read(buf);
  const w = png.width, h = png.height;
  let r = 0, g = 0, b = 0, n = 0, orange = 0, white = 0, red = 0, blue = 0;
  const y0 = Math.floor(h * 0.45);
  for (let y = y0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4, R = png.data[i], G = png.data[i + 1], B = png.data[i + 2];
    r += R; g += G; b += B; n++;
    if (R > 150 && G > 50 && G < 150 && B < 90 && R > G + 25) orange++;
    if (R > 200 && G > 195 && B > 175 && R < 250) white++;
    if (R > 130 && G < 90 && B < 90 && R > G + 40) red++;
    if (B > 90 && B > R + 15 && B > G && R < 120) blue++;
  }
  return { lower: [+(r / n).toFixed(1), +(g / n).toFixed(1), +(b / n).toFixed(1)], orange, white, red, blue };
}

const shots = [
  ['woodlily-prop.png', 152.78, 193.65, 1.6, 0.65, -0.55],
  ['everlasting-field.png', 144.7, 213.62, 1.4, 0.6, -0.5],
  ['bunchberry-field.png', 156.36, 203.61, 1.2, 0.45, -0.6],
  ['forage-blueberry.png', 147.93, 213.79, 1.5, 0.55, -0.5],
  ['juniper-close.png', 145.16, 208.49, 2.4, 1.15, -0.4],
];

try {
  await page.goto('http://127.0.0.1:5173/?nomenu&bench&hour=12&at=145.16,212.5,0', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#loading', { state: 'detached', timeout: 120000 });
  let settled = null;
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(2000);
    const buf = await page.screenshot();
    const s = stats(buf);
    console.log('wait', i, s.lower);
    if (s.lower[0] < 140) { settled = s; writeFileSync(join(dir, 'outcrop-settled.png'), buf); break; }
  }
  const saved = [];
  for (const [file, x, z, back, y, pitch] of shots) {
    await page.evaluate(({ x, z, back, y, pitch }) => {
      globalThis.borealFlora.fx.view = { x, y, z: z + back, yaw: 0, pitch };
    }, { x, z, back, y, pitch });
    await page.waitForTimeout(2500);
    const buf = await page.screenshot();
    const s = stats(buf);
    writeFileSync(join(dir, file), buf);
    saved.push({ file, ...s });
    console.log(file, s);
  }
  const flora = await page.evaluate(() => globalThis.borealFlora?.info);
  writeFileSync(join(dir, 'retake.json'), JSON.stringify({ settled, saved, flora, errors }, null, 2));
} finally {
  await browser.close();
  release(name);
}
