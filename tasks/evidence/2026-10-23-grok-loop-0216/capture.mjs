// Headless ground-view stills for the 2026-10-23 02:16 PT loop. Chrome via Playwright, SwiftShader (no GPU).
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const base = 'http://127.0.0.1:5173/';
const q = 'nomenu&bench&hour=12&stages=1';
const shots = [
  { name: 'deer-visitor', at: '67.4,22,3.14159', trees: 'v2', series: true },
  { name: 'bark', at: '66.2,32.36,-1.5708', trees: 'v2' },
  { name: 'crown', at: '72.75,-0.53,3.14159', trees: 'v2' },
  { name: 'stand', at: '67.4,8,3.14159', trees: 'v2' },
  { name: 'stand-default-trees', at: '67.4,8,3.14159', trees: '' },
];
const urlOf = s => `${base}?${q}&at=${s.at}${s.trees ? '&trees=' + s.trees : ''}`;

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-dev-shm-usage', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
await page.addInitScript(() => {
  const Orig = window.AudioContext;
  window.AudioContext = new Proxy(Orig, {
    construct(target, args) {
      const ctx = new target(...args);
      window.__borealAudio = ctx;
      return ctx;
    },
  });
});
const errors = [];
page.on('pageerror', e => errors.push(String(e).slice(0, 400)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 400)); });

async function settle() {
  await page.waitForSelector('#loading', { state: 'detached', timeout: 90000 });
  await page.waitForTimeout(1800);
}

const log = [];
for (const s of shots) {
  const url = urlOf(s);
  const before = errors.length;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await settle();
  const file = join(dir, s.name + '.png');
  await page.screenshot({ path: file });
  const row = { name: s.name, url, file, errors: errors.slice(before) };
  if (s.series) {
    await page.waitForTimeout(8000);
    await page.screenshot({ path: join(dir, 'deer-8s.png') });
    await page.waitForTimeout(8000);
    await page.screenshot({ path: join(dir, 'deer-16s.png') });
    const clicked = await page.locator('#sound').click({ timeout: 5000 }).then(() => true).catch(e => String(e).slice(0, 200));
    await page.waitForTimeout(1200);
    await page.screenshot({ path: join(dir, 'sound-hud.png') });
    row.audio = await page.evaluate(() => {
      const ctx = window.__borealAudio;
      const label = document.getElementById('sound')?.textContent ?? '';
      return { clicked: true, label, state: ctx?.state ?? null, sampleRate: ctx?.sampleRate ?? null, currentTime: ctx?.currentTime ?? null };
    });
    row.audio.clicked = clicked;
  }
  log.push(row);
  console.log(JSON.stringify({ name: s.name, errors: row.errors.length, audio: row.audio?.state }));
}
writeFileSync(join(dir, 'capture.json'), JSON.stringify({
  commit: process.env.CAPTURE_COMMIT ?? '',
  viewport: [960, 540],
  clock: '2026-10-23 02:16 PT inspection',
  shots: log,
}, null, 2));
await browser.close();