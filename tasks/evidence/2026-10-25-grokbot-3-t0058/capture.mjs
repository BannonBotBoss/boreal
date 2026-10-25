// T-0058: January hydrosphere layer. Tier 0 draws it. Tier 5 is Minimum (octaves 0), so the layer is off.
// latlon 80 is the winter pole. latlon 0 is the equator. hydro=0 is the same pose with the paint forced off.
import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--use-angle=swiftshader', '--use-gl=angle', '--ignore-gpu-blocklist', '--headless=new'],
});
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.setDefaultTimeout(90000);
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
const shots = [
  { name: 'jan-pole-tier0.png', lat: 80, tier: 0, hydro: '1' },
  { name: 'jan-eq-tier0.png', lat: 0, tier: 0, hydro: '1' },
  { name: 'jan-pole-hydro0.png', lat: 80, tier: 0, hydro: '0' },
  { name: 'jan-pole-tier5.png', lat: 80, tier: 5, hydro: '1' },
];
const out = [];
for (const s of shots) {
  const url = `http://127.0.0.1:5174/?view=globe&tier=${s.tier}&day=15&hour=12&workers=0&shot=1&atmos=0&layers=0&hydro=${s.hydro}&latlon=${s.lat},0`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('canvas', { timeout: 30000 });
  const started = Date.now();
  let hud = '', hydro = null;
  while (Date.now() - started < 40000) {
    const state = await page.evaluate(() => {
      const g = window.__globe;
      const text = document.body.innerText;
      return { text, hydro: g && g.hydroLayer ? g.hydroLayer() : null };
    });
    hud = state.text; hydro = state.hydro;
    if (/tiles drawn/.test(hud) && /queued 0/.test(hud)) break;
    await page.waitForTimeout(1000);
  }
  await page.waitForTimeout(2000);
  hud = await page.evaluate(() => document.body.innerText.slice(0, 800));
  hydro = await page.evaluate(() => window.__globe && window.__globe.hydroLayer ? window.__globe.hydroLayer() : null);
  await page.locator('canvas').screenshot({ path: join(dir, s.name) });
  out.push({ ...s, url, hud, hydro });
  console.log(s.name, hydro, hud.split('\n')[1]);
}
writeFileSync(join(dir, 'capture.json'), JSON.stringify({ shots: out, errors }, null, 2));
await browser.close();
console.log('errors', errors.length);
