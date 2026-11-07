// T-0073 rule-6 descent stills attempt. SwiftShader = software GL.
// Last tried URL (T-0096 / one-viewpoint): ?start=globe&stages=1&trees=v2&noprobe=1&inpagedev=1&alt=<m>
// Note: under inpagedev, alt= did not move the camera off orbit (2026-11-07). Prefer ?view=globe&alt=
// for altitude, and wait for terrain brightness — see tasks/evidence/T-0073/README.md.
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const OUT = new URL('../tasks/evidence/T-0073/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173';

const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-extensions', '--no-first-run'],
});

const alts = [1500, 1000, 700];
const summary = [];
try {
  for (const alt of alts) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const url = `${BASE}/?view=globe&start=globe&stages=1&noprobe=1&alt=${alt}`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
    let ready = false;
    const tEnd = Date.now() + 90000;
    while (Date.now() < tEnd) {
      const drawn = await page.evaluate(() => window.__globe?.stats?.()?.drawn ?? 0).catch(() => 0);
      if (drawn > 8) { ready = true; break; }
      await page.waitForTimeout(2000);
    }
    await page.waitForTimeout(15000);
    const info = await page.evaluate(() => {
      const g = window.__globe;
      return { alt: g?.altitude ?? null, drawn: g?.stats?.()?.drawn ?? null, lc: g?.localClouds?.mesh?.visible ?? null, href: location.href };
    });
    await page.screenshot({ path: `${OUT}descent-${alt}m.png` });
    summary.push({ alt, ready, info });
    console.log(JSON.stringify({ alt, ready, info }));
    await page.close();
  }
} finally {
  await browser.close();
}
writeFileSync(`${OUT}capture-summary.json`, JSON.stringify(summary, null, 2));
