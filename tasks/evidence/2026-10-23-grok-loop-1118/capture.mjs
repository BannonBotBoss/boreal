// 11:18 loop: UI / controls. Full page so the footer is in the frame. Wheel in play vs photo.
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';

const dir = '/workspace/tasks/evidence/2026-10-23-grok-loop-1118';
mkdirSync(dir, { recursive: true });
const base = 'http://127.0.0.1:5173/?nomenu&bench&hour=12&stages=1&at=144,236,0';

function mad(a, b) {
  const A = PNG.sync.read(a), B = PNG.sync.read(b);
  const n = Math.min(A.data.length, B.data.length);
  let s = 0, c = 0;
  for (let i = 0; i < n; i += 4) { s += Math.abs(A.data[i] - B.data[i]) + Math.abs(A.data[i + 1] - B.data[i + 1]) + Math.abs(A.data[i + 2] - B.data[i + 2]); c++; }
  return Math.round(1000 * s / (3 * c)) / 1000;
}

const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-dev-shm-usage', '--no-sandbox', '--disable-extensions', '--no-first-run'],
});
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e).slice(0, 200)));
await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 60000 });
const t0 = Date.now();
let status = '';
while (Date.now() - t0 < 40000) {
  status = await page.locator('#status').innerText().catch(() => '');
  if (/\d{2}:\d{2}/.test(status)) break;
  await page.waitForTimeout(400);
}
await page.waitForTimeout(800);
const footer = await page.locator('#device').innerText();
const buttons = await page.locator('footer').innerText();
await page.screenshot({ path: `${dir}/play-footer.png` });
const play0 = await page.locator('canvas').screenshot({ path: `${dir}/play-before-wheel.png` });
await page.locator('canvas').hover();
await page.mouse.wheel(0, -400);
await page.waitForTimeout(600);
const play1 = await page.locator('canvas').screenshot({ path: `${dir}/play-after-wheel.png` });
await page.keyboard.press('p');
await page.waitForTimeout(800);
const photoOn = await page.locator('#photo-hints').innerText().catch(() => '');
const photo0 = await page.locator('canvas').screenshot({ path: `${dir}/photo-before-wheel.png` });
await page.locator('canvas').hover();
await page.mouse.wheel(0, -400);
await page.waitForTimeout(600);
const photo1 = await page.locator('canvas').screenshot({ path: `${dir}/photo-after-wheel.png` });
const photoHints = await page.locator('#photo-hints').innerText().catch(() => '');
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
await page.locator('#menu-btn').click();
await page.waitForTimeout(400);
const menu = await page.locator('#start-menu').innerText().catch(() => '');
await page.screenshot({ path: `${dir}/pause-menu.png` });
const out = {
  status, footer, buttons, menu, photoOn, photoHints,
  playMad: mad(play0, play1),
  photoMad: mad(photo0, photo1),
  ms: Date.now() - t0,
  errors: errors.filter(e => !e.includes('detect-gpu')),
};
writeFileSync(`${dir}/capture.json`, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
await browser.close();
