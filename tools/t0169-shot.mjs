import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const OUT = '/agent/repos/boreal/tasks/evidence/T-0169';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-extensions', '--no-first-run'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e).slice(0, 400)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 400)); });

async function shoot(name, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
  let ready = false;
  const tEnd = Date.now() + 100000;
  while (Date.now() < tEnd) {
    ready = await page.evaluate(() => {
      const g = window.__globe;
      if (!g || !g.stats) return false;
      const s = g.stats();
      return s.drawn > 8 && s.queued === 0;
    }).catch(() => false);
    if (ready) break;
    await page.waitForTimeout(2000);
  }
  await page.waitForTimeout(1200);
  const info = await page.evaluate(async () => {
    const g = window.__globe;
    const s = g?.stats?.() ?? null;
    const hud = document.querySelector('#globe-hud, #status, body')?.innerText?.slice(0, 800) ?? '';
    const times = [];
    for (let i = 0; i < 5; i++) {
      const t0 = performance.now();
      await new Promise(r => requestAnimationFrame(r));
      times.push(performance.now() - t0);
    }
    return { stats: s, hud, times, href: location.href };
  });
  await page.screenshot({ path: `${OUT}/${name}.png` });
  writeFileSync(`${OUT}/${name}.json`, JSON.stringify({ ready, info, errors: errors.slice(-6) }, null, 2));
  console.log(name, ready, info.stats, 'frame ms', info.times.map(t => t.toFixed(1)).join(','));
  if (errors.length) console.log('errors', errors.slice(-3));
}

const base = 'http://127.0.0.1:5173/?view=globe&stages=1&trees=v2&shot=1&tier=';
try {
  await shoot('full-globe-ultra', base + '0&hour=15');
  await shoot('closeup-ultra', base + '0&hour=15&alt=420000&pitch=0');
  await shoot('glint-noon', base + '0&hour=12&latlon=25,-40&alt=1800000&pitch=0');
  await shoot('full-globe-medium', base + '2&hour=15');
} finally {
  await browser.close();
}
