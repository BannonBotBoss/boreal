import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-dev-shm-usage', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const url = 'http://127.0.0.1:5173/?nomenu&bench&hour=12&stages=1&rec&timescale=0.05&trees=v2&at=65.86,32.36,-1.5708';
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('#loading', { state: 'detached', timeout: 90000 });
const rows = [];
for (let i = 0; i < 24; i++) {
  await page.waitForTimeout(5000);
  const info = await page.evaluate(() => {
    const b = globalThis.borealTreesV2;
    const info = b?.info ?? {};
    return { variants: info.variants ?? 0, trees: info.trees ?? 0, near: info.near ?? 0, mid: info.mid ?? 0, crown: info.crown ?? 0, far: info.far ?? 0, stepMaxMs: info.stepMaxMs ?? 0, slow: (info.slow ?? []).slice(0, 4), buildMs: info.buildMs ?? [] };
  });
  rows.push({ t: (i + 1) * 5, ...info });
  console.log(JSON.stringify(rows.at(-1)));
  if (info.variants > 0 && info.near > 0) break;
}
await page.screenshot({ path: new URL('./still-bark-built.png', import.meta.url).pathname });
writeFileSync(new URL('./probe-trees.json', import.meta.url), JSON.stringify(rows, null, 2));
await browser.close();
