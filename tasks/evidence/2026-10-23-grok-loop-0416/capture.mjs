// Headless frames for the 2026-10-23 04:16 PT plant inspection.
// ?bench skips the GPU probe. FLORA_FX.view is the flora tooling camera (render/flora/flora.ts).
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquire, release, track } from '../../../tools/bench-lock.mjs';

const dir = dirname(fileURLToPath(import.meta.url));
const base = 'http://127.0.0.1:5173/';
const errors = [];
const shots = [];
const name = 'grok: plants 04:16';
if (!(await acquire(name))) { console.error('no bench lock'); process.exit(1); }

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-dev-shm-usage', '--no-sandbox', '--disable-extensions', '--no-first-run'],
});
const proc = typeof browser.process === 'function' ? browser.process() : null;
if (proc?.pid) track(proc.pid);
const context = await browser.newContext({
  viewport: { width: 960, height: 540 },
  recordVideo: { dir, size: { width: 960, height: 540 } },
});
const page = await context.newPage();
page.on('pageerror', e => errors.push(String(e).slice(0, 300)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });

async function settle() {
  await page.waitForSelector('#loading', { state: 'detached', timeout: 120000 });
  await page.waitForTimeout(8000);
}
async function shot(file) {
  await page.screenshot({ path: join(dir, file) });
  shots.push(file);
  console.log('shot', file);
}
async function flora() {
  return page.evaluate(() => {
    const f = globalThis.borealFlora;
    return f ? { info: f.info, view: f.fx.view ?? null, density: f.fx.density, bloomAll: f.fx.bloomAll } : null;
  });
}
async function lookAt(x, z, back, y, pitch) {
  await page.evaluate(({ x, z, back, y, pitch }) => {
    globalThis.borealFlora.fx.view = { x, y, z: z + back, yaw: 0, pitch };
  }, { x, z, back, y, pitch });
  await page.waitForTimeout(600);
}

const log = { errors, shots, pages: [] };
try {
  // Wood lily prop 3:0:29. Day 227 is outside bloom 175-205. Camera just south of it, looking north.
  await page.goto(`${base}?nomenu&bench&hour=12&at=155.04,40.2,0`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await settle();
  await shot('lily-stand.png');
  await lookAt(155.04, 36.62, 1.8, 0.7, -0.5);
  await shot('lily-close.png');
  log.pages.push({ name: 'woodlily', url: page.url(), flora: await flora() });

  // Bunchberry prop 3:0:22. Day 227 is outside bloom 155-190 (FNA fruiting month).
  await page.goto(`${base}?nomenu&bench&hour=12&at=124.78,42.2,0`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await settle();
  await lookAt(124.78, 38.52, 1.5, 0.55, -0.55);
  await shot('bunchberry-close.png');
  log.pages.push({ name: 'bunchberry', url: page.url(), flora: await flora() });

  // Juniper stem at 145.16, 208.49 (h 0.55 m in the row, tile 7,10). No ?patch, so density is the game's 6.
  await page.goto(`${base}?nomenu&bench&hour=12&at=145.16,212.5,0`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await settle();
  await shot('juniper-stand.png');
  for (let i = 0; i < 8; i++) {
    const info = await flora();
    if (info?.info?.plants > 0) break;
    await page.waitForTimeout(2000);
  }
  await lookAt(145.16, 208.49, 2.4, 1.15, -0.4);
  await page.waitForTimeout(1500);
  await shot('juniper-close.png');
  log.pages.push({ name: 'juniper', url: page.url(), flora: await flora() });
} finally {
  log.errors = errors;
  writeFileSync(join(dir, 'capture.json'), JSON.stringify(log, null, 2));
  const video = page.video();
  await context.close();
  if (video) console.log('video', await video.path());
  await browser.close();
  release(name);
}
