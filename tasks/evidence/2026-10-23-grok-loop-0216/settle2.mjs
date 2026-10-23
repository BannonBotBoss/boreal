// Frozen-sim stills (timescale=0.05) plus the v2 tree LOD counts.
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const base = 'http://127.0.0.1:5173/';
const q = 'nomenu&bench&hour=12&stages=1&rec&timescale=0.05';
const shots = [
  { name: 'still-deer', at: '66.27,24.5,3.14159', trees: 'v2' },
  { name: 'still-person', at: '68.57,23,3.14159', trees: 'v2' },
  { name: 'still-bark', at: '69.36,32.36,-1.5708', trees: 'v2' },
  { name: 'still-stand', at: '67.4,8,3.14159', trees: 'v2' },
];
const urlOf = s => `${base}?${q}&at=${s.at}${s.trees ? '&trees=' + s.trees : ''}`;

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-dev-shm-usage', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e).slice(0, 300)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });

async function trees() {
  return page.evaluate(() => {
    const b = globalThis.borealTreesV2;
    if (!b) return null;
    const info = b.info ?? {};
    const list = typeof b.list === 'function' ? b.list().slice(0, 12) : [];
    return { on: b.fx?.on ?? null, nearM: b.fx?.nearM ?? null, trees: info.trees, near: info.near, mid: info.mid, crown: info.crown, far: info.far, variants: info.variants, full: info.full, list };
  });
}

const log = [];
for (const s of shots) {
  const before = errors.length;
  await page.goto(urlOf(s), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#loading', { state: 'detached', timeout: 90000 });
  let info = null;
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(2000);
    info = await trees();
    if (info && (info.near > 0 || info.mid > 0)) break;
  }
  const file = join(dir, s.name + '.png');
  await page.screenshot({ path: file });
  const player = await page.evaluate(() => globalThis.__boreal?.player?.() ?? null);
  log.push({ name: s.name, url: urlOf(s), trees: info, player, errors: errors.slice(before) });
  console.log(JSON.stringify({ name: s.name, trees: info && { near: info.near, mid: info.mid, crown: info.crown, far: info.far, trees: info.trees } }));
}
writeFileSync(join(dir, 'still.json'), JSON.stringify({ wait: 'poll 2s x up to 12 for a near or mid v2 tree', shots: log }, null, 2));
await browser.close();
