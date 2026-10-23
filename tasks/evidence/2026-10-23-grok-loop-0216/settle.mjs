// Settled ground stills. Wait 10s after #loading so streamed terrain is in frame.
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const base = 'http://127.0.0.1:5173/';
const q = 'nomenu&bench&hour=12&stages=1&rec';
const shots = [
  { name: 'settled-deer', at: '66.27,24.5,3.14159', trees: 'v2' },
  { name: 'settled-person', at: '68.57,23,3.14159', trees: 'v2' },
  { name: 'settled-bark', at: '65.86,32.36,-1.5708', trees: 'v2' },
  { name: 'settled-stand', at: '67.4,8,3.14159', trees: 'v2' },
  { name: 'settled-stand-default', at: '67.4,8,3.14159', trees: '' },
];
const urlOf = s => `${base}?${q}&at=${s.at}${s.trees ? '&trees=' + s.trees : ''}`;

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-dev-shm-usage', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e).slice(0, 400)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 400)); });

const log = [];
for (const s of shots) {
  const url = urlOf(s);
  const before = errors.length;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#loading', { state: 'detached', timeout: 90000 });
  await page.waitForTimeout(10000);
  const file = join(dir, s.name + '.png');
  await page.screenshot({ path: file });
  const player = await page.evaluate(() => {
    const api = window.__boreal;
    return api?.player ? api.player() : null;
  }).catch(e => String(e).slice(0, 200));
  log.push({ name: s.name, url, file, player, errors: errors.slice(before) });
  console.log(JSON.stringify({ name: s.name, errors: errors.length - before }));
}
writeFileSync(join(dir, 'settled.json'), JSON.stringify({
  commit: '8be743c',
  viewport: [960, 540],
  waitMsAfterLoading: 10000,
  shots: log,
}, null, 2));
await browser.close();
