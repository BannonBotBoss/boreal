// __boreal.animals() was a temporary ?rec field for this capture. It is not on the branch.
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch({
  channel: 'chrome', headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-dev-shm-usage', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const shots = [
  ['close-deer', '66.27,27,3.14159'],
  ['side-deer', '62.27,28.91,-1.5708'],
];
const out = [];
for (const [name, at] of shots) {
  const url = `http://127.0.0.1:5173/?nomenu&bench&hour=12&stages=1&rec&timescale=0.05&at=${at}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#loading', { state: 'detached', timeout: 90000 });
  await page.waitForTimeout(8000);
  const info = await page.evaluate(async () => {
    const interest = await import('/src/core/interest.ts');
    const kinds = {};
    for (const [k, v] of Object.entries(interest.STATS.kinds)) kinds[k] = { slices: v.slices, maxSlice: +v.maxSlice.toFixed(1), dones: v.dones };
    return {
      animals: globalThis.__boreal?.animals?.() ?? null,
      player: globalThis.__boreal?.player?.() ?? null,
      queued: interest.queued(),
      jobsRun: interest.STATS.jobsRun,
      kinds,
    };
  });
  await page.screenshot({ path: join(dir, name + '.png') });
  out.push({ name, url, ...info });
  console.log(JSON.stringify({ name, animals: info.animals, queued: info.queued, kinds: info.kinds }));
}
writeFileSync(join(dir, 'diag.json'), JSON.stringify(out, null, 2));
await browser.close();
