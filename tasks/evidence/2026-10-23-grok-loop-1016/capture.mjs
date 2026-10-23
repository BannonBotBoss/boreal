// Issue #43: standalone globe at 3000 m, and the same pose with the atmosphere off.
// Orbit (no alt) is the existing full-disc start. No photo mode. No keys.
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { acquire, release, track } from '../../../tools/bench-lock.mjs';

const dir = dirname(fileURLToPath(import.meta.url));
mkdirSync(dir, { recursive: true });
const base = 'http://127.0.0.1:5173/';
const profile = mkdtempSync(join(tmpdir(), 'grok-loop-1016-'));
const lockName = 'grok: loop 1016 globe';

const shots = [
  { name: 'alt3000', search: '?start=globe&stages=1&trees=v2&view=globe&at=30,0,-0.35&alt=3000' },
  { name: 'alt3000-atmos0', search: '?start=globe&stages=1&trees=v2&view=globe&at=30,0,-0.35&alt=3000&atmos=0' },
  { name: 'orbit', search: '?start=globe&stages=1&trees=v2&view=globe&at=30,0,-0.35' },
  { name: 'orbit-atmos0', search: '?start=globe&stages=1&trees=v2&view=globe&at=30,0,-0.35&atmos=0' },
];

function stats(png, y0, y1) {
  let n = 0, r = 0, g = 0, b = 0, l2 = 0, beige = 0;
  const yA = Math.max(0, y0), yB = Math.min(png.height, y1);
  for (let y = yA; y < yB; y++) {
    for (let x = 0; x < png.width; x++) {
      const i = (png.width * y + x) << 2;
      const R = png.data[i], G = png.data[i + 1], B = png.data[i + 2];
      const L = 0.2126 * R + 0.7152 * G + 0.0722 * B;
      r += R; g += G; b += B; l2 += L * L; n++;
      if (R > 170 && G > 150 && B > 110 && R + 15 > G && G + 10 > B) beige++;
    }
  }
  const meanL = n ? (0.2126 * r + 0.7152 * g + 0.0722 * b) / n : 0;
  return {
    n,
    mean: [r / n, g / n, b / n].map(v => Math.round(v * 10) / 10),
    stdL: Math.round(Math.sqrt(Math.max(0, l2 / n - meanL * meanL)) * 10) / 10,
    beige: Math.round(1000 * beige / n) / 1000,
  };
}

if (!(await acquire(lockName, { waitMs: 20000, pollMs: 1000 }))) {
  console.error('bench lock not acquired');
  process.exit(1);
}

const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/usr/local/bin/google-chrome',
  headless: true,
  args: [
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist', '--disable-dev-shm-usage', '--no-sandbox',
    '--disable-extensions', '--no-first-run',
  ],
});
const proc = typeof browser.process === 'function' ? browser.process() : null;
if (proc?.pid) track(proc.pid);
const context = await browser.newContext({ viewport: { width: 960, height: 540 } });
const out = { profile, shots: [], errors: [] };

try {
  for (const shot of shots) {
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e).slice(0, 300)));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 240)); });
    await page.goto(base + shot.search, { waitUntil: 'domcontentloaded', timeout: 60000 });
    let hud = '';
    const t0 = Date.now();
    while (Date.now() - t0 < 25000) {
      hud = await page.locator('#status').innerText().catch(() => '');
      const queued = /queued (\d+)/.exec(hud);
      const drawn = /tiles drawn (\d+)/.exec(hud);
      if (drawn && Number(drawn[1]) > 20 && queued && Number(queued[1]) === 0) break;
      await page.waitForTimeout(500);
    }
    await page.waitForTimeout(1500);
    hud = await page.locator('#status').innerText().catch(() => '');
    const buf = await page.locator('canvas').screenshot({ path: join(dir, shot.name + '.png') });
    const png = PNG.sync.read(buf);
    const row = {
      name: shot.name,
      search: shot.search,
      href: page.url(),
      hud,
      ms: Date.now() - t0,
      lower: stats(png, Math.floor(png.height * 0.55), png.height),
      upper: stats(png, 0, Math.floor(png.height * 0.28)),
      errors: errors.filter(e => !e.includes('detect-gpu.esm.js.map')),
    };
    out.shots.push(row);
    console.log(shot.name, JSON.stringify({ hud: hud.split('\n')[1], lower: row.lower, upper: row.upper, ms: row.ms }));
    await page.close();
  }
} finally {
  writeFileSync(join(dir, 'capture.json'), JSON.stringify(out, null, 2));
  await browser.close();
  release(lockName);
}
