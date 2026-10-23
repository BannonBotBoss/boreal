// T-0057: same orbit over a day-227 noon terminator (lat -60, lon -25, cosZ ~ 0).
// Tier 0 draws aAbsorbed. Tier 5 is Minimum (CLOUDS.octaves 0), so the layer is off.
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
const look = '0.4532,-0.8660,-0.2113';
const shots = [];
for (const tier of [0, 5]) {
  const url = `http://127.0.0.1:5174/?view=globe&tier=${tier}&hour=12&workers=0&shot=1&dir=${look}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('canvas', { timeout: 30000 });
  const started = Date.now();
  let hud = '';
  while (Date.now() - started < 25000) {
    hud = await page.evaluate(() => document.body.innerText);
    if (/tiles drawn/.test(hud) && /queued 0/.test(hud)) break;
    await page.waitForTimeout(1000);
  }
  await page.waitForTimeout(1500);
  hud = await page.evaluate(() => document.body.innerText.slice(0, 700));
  const attr = await page.evaluate(() => {
    const tiles = [...window.__globe.tiles.values()];
    let withAttr = 0, min = Infinity, max = -Infinity;
    for (const t of tiles) {
      const a = t.mesh.geometry.getAttribute('aAbsorbed');
      if (!a) continue;
      withAttr++;
      for (let i = 0; i < a.count; i += 40) { const v = a.getX(i); if (v < min) min = v; if (v > max) max = v; }
    }
    return { tiles: tiles.length, withAttr, min: withAttr ? min : null, max: withAttr ? max : null };
  });
  const name = tier === 0 ? 'orbit-tier0.png' : 'orbit-tier5-minimum.png';
  await page.screenshot({ path: join(dir, name) });
  shots.push({ tier, name, hud, attr });
  console.log(name, attr, hud.split('\n')[1], hud.split('\n')[4]);
}
writeFileSync(join(dir, 'capture.json'), JSON.stringify({ look, shots, errors }, null, 2));
await browser.close();
console.log('errors', errors.length);
