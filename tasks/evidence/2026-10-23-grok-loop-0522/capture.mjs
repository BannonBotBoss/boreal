// Headless Chrome stills for the 2026-10-23 05:22 PT loop.
// Production preview (vite build + vite preview). ?bench skips the GPU probe.
import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const base = process.env.PREVIEW ?? 'http://127.0.0.1:4173/';
const errors = [];
const shots = [];

const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/usr/local/bin/google-chrome',
  headless: true,
  args: [
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist', '--disable-dev-shm-usage', '--no-sandbox',
    '--disable-extensions', '--no-first-run',
  ],
});
const context = await browser.newContext({ viewport: { width: 960, height: 540 } });
const page = await context.newPage();
page.on('pageerror', e => errors.push(String(e).slice(0, 400)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 400)); });

async function shot(name) {
  const file = join(dir, name + '.png');
  await page.screenshot({ path: file });
  shots.push(name);
  console.log('shot', name);
}

let hud, dialog, chrono, menuAfterEsc;
try {
const url = `${base}?nomenu&bench&hour=12&rec&stages=1&needs=water:40,energy:70,rest:80&at=200,250,-1.553`;
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('#loading', { state: 'detached', timeout: 120000 });
await page.waitForTimeout(10000);

const hud = await page.evaluate(() => {
  const status = document.querySelector('#status')?.textContent ?? '';
  const help = document.querySelector('#help-binds')?.textContent ?? '';
  const library = document.querySelector('#info')?.innerText ?? '';
  const device = document.querySelector('#device')?.textContent ?? '';
  const probe = window.__boreal?.player?.() ?? null;
  return { status, help, library, device, probe, href: location.href };
});
console.log('hud', JSON.stringify(hud).slice(0, 2000));
await shot('hud-noon');

await page.keyboard.press('Escape');
await page.waitForTimeout(400);
await shot('pause-menu');
await page.keyboard.press('Escape');
await page.waitForTimeout(400);

await page.click('#help');
await page.waitForTimeout(500);
await shot('controls');
const libraryBtn = page.getByRole('button', { name: 'Library (about the game)' });
await libraryBtn.click();
await page.waitForTimeout(300);
const dialog = await page.evaluate(() => ({
  help: document.querySelector('#help-binds')?.textContent ?? '',
  info: document.querySelector('#info')?.innerText ?? '',
}));
console.log('dialog', JSON.stringify(dialog).slice(0, 2500));
await shot('library');
await page.click('#close');
await page.waitForTimeout(400);
await page.keyboard.press('Escape');
await page.waitForTimeout(500);

await page.keyboard.press('t');
await page.waitForTimeout(400);
const chrono = await page.evaluate(() => {
  const root = document.querySelector('.chronometer');
  return {
    open: !!root && root.hidden === false,
    time: root?.querySelector('b')?.textContent ?? '',
    sun: root?.querySelector('small')?.textContent ?? '',
  };
});
console.log('chrono', JSON.stringify(chrono));
await shot('chrono');
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

await page.keyboard.down('ArrowDown');
await page.waitForTimeout(900);
await page.keyboard.up('ArrowDown');
await page.waitForTimeout(400);
await shot('water');

await page.click('#menu-btn');
await page.waitForTimeout(400);
await shot('menu');
await page.keyboard.press('Escape');
await page.waitForTimeout(500);
const menuAfterEsc = await page.evaluate(() => {
  const m = document.querySelector('#start-menu');
  return { hidden: m?.hidden ?? null, className: m?.className ?? '', text: (m?.innerText ?? '').slice(0, 400) };
});
console.log('menuAfterEsc', JSON.stringify(menuAfterEsc));
await shot('menu-after-esc');

writeFileSync(join(dir, 'capture.json'), JSON.stringify({
  commit: process.env.CAPTURE_COMMIT ?? '',
  url, viewport: [960, 540], hud, dialog, chrono, menuAfterEsc, shots, errors: errors.slice(0, 30),
}, null, 2));
console.log('wrote', shots.length, 'errors', errors.length);
} finally {
  await browser.close();
}
