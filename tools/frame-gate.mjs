/**
 * Headless frame gate. Fails if a standard view is a blank, pale, or black canvas.
 *
 * Chrome SwiftShader, 1280×720, fresh context.
 *   BASE=http://127.0.0.1:5173 node tools/frame-gate.mjs
 *
 * The centre of the frame (the middle 60% by 60%) is the canvas. HUD chrome
 * sits in the corners and is not part of the score.
 *   black  > 0.90  fails  (overhead 400 m at 52 N, 97 W)
 *   pale   > 0.85 and green < 0.05  fails  (ground after the splash)
 * A 404 response fails.
 */
import { chromium } from 'playwright-core';
import { PNG } from 'pngjs';

const BASE = process.env.BASE ?? 'http://127.0.0.1:5173';
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/usr/bin/google-chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-extensions', '--no-first-run'],
});

function centre(png) {
  const { width, height, data } = png;
  const x0 = Math.floor(width * 0.2), x1 = Math.floor(width * 0.8);
  const y0 = Math.floor(height * 0.15), y1 = Math.floor(height * 0.75);
  let n = 0, black = 0, pale = 0, green = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = (y * width + x) * 4;
    const R = data[i], G = data[i + 1], B = data[i + 2];
    n++;
    const mx = Math.max(R, G, B), mn = Math.min(R, G, B);
    if (mx < 18) black++;
    if (mn > 200 && mx - mn < 18) pale++;
    if (G > 40 && G > R + 12 && G > B + 8) green++;
  }
  return { black: black / n, pale: pale / n, green: green / n };
}

const failures = [];
async function shot(url, waitMs, judge) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const missed = [];
  page.on('response', r => { if (r.status() >= 400) missed.push(`${r.status()} ${r.url()}`); });
  await page.goto(BASE + url, { waitUntil: 'commit', timeout: 60000 });
  if (url.includes('view=ground')) {
    const t = Date.now();
    while (Date.now() - t < 180000) {
      if (await page.evaluate(() => !document.getElementById('loading'))) break;
      await page.waitForTimeout(500);
    }
  }
  await page.waitForTimeout(waitMs);
  const png = PNG.sync.read(await page.screenshot());
  const stats = centre(png);
  console.log(JSON.stringify({ url, stats, missed: missed.slice(0, 6) }));
  judge(stats, missed);
  await page.close();
}

await shot('/?view=globe&alt=400&latlon=52,-97&stages=1&shot=1', 16000, (stats, missed) => {
  if (stats.black > 0.9) failures.push(`overhead 400 m is black (${stats.black.toFixed(2)})`);
  if (missed.some(m => m.startsWith('404'))) failures.push('404 on the globe view: ' + missed.filter(m => m.startsWith('404')).join(', '));
});
await shot('/?view=ground&nomenu=1&noprobe=1&stages=1&trees=v2', 8000, (stats, missed) => {
  if (stats.pale > 0.85 && stats.green < 0.05) failures.push(`ground is a pale void (pale ${stats.pale.toFixed(2)}, green ${stats.green.toFixed(2)})`);
  if (missed.some(m => /favicon\.ico/.test(m))) failures.push('favicon.ico 404');
});

await browser.close();
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('frame gate passed');
