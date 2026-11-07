/**
 * Cold first-visit trace of the first B14 arrival. SwiftShader, not omen.
 * Records CINE TRACE lines, long tasks, frame gaps over 200 ms, the camera
 * at landing and one second later, then a drag.
 */
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

mkdirSync('/tmp/cine-arrival', { recursive: true });
const url = 'http://127.0.0.1:5173/?start=sphere&stages=1&trees=v2&noprobe=1';
const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await context.addInitScript(() => {
  const gaps = [];
  let last = 0;
  const tick = (t) => {
    if (last) { const g = t - last; if (g > 200) gaps.push(Math.round(g)); }
    last = t;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  window.__frameGaps = gaps;
  const longs = [];
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) if (e.duration >= 100) longs.push({ dur: Math.round(e.duration), start: Math.round(e.startTime) });
    }).observe({ type: 'longtask', buffered: true });
  } catch (e) { window.__longTaskError = String(e); }
  window.__longTasks = longs;
});
const page = await context.newPage();
const traces = [];
page.on('console', m => {
  const t = m.text();
  if (t.startsWith('CINE TRACE') || t.startsWith('STARTUP')) traces.push(t.slice(0, 500));
});
page.on('pageerror', e => traces.push('PAGEERROR ' + e.message));
const t0 = Date.now();
await page.goto(url, { waitUntil: 'commit', timeout: 60000 });
await page.waitForSelector('#cine .prompt', { timeout: 120000 });
await page.locator('#cine').click({ position: { x: 280, y: 280 }, force: true });
const deadline = Date.now() + 160000;
let landed = null;
while (Date.now() < deadline) {
  landed = await page.evaluate(() => ({
    cine: !!document.getElementById('cine'),
    seen: window.__borealSave?.hasSeenBigBang?.() ?? false,
    mode: window.__inpage?.mode ?? null,
    count: document.querySelector('#cine-panel .count')?.textContent ?? '',
    cam: window.__inpage?.globe?.camera?.position?.toArray?.() ?? null,
  }));
  if (landed.seen && !landed.cine) break;
  await page.waitForTimeout(500);
}
const atLanding = landed?.cam;
await page.waitForTimeout(1000);
const afterSecond = await page.evaluate(() => window.__inpage?.globe?.camera?.position?.toArray?.() ?? null);
const box = await page.locator('canvas').first().boundingBox();
if (box) {
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.5 + 180, box.y + box.height * 0.45, { steps: 12 });
  await page.mouse.up();
}
await page.waitForTimeout(300);
const afterDrag = await page.evaluate(() => ({
  cam: window.__inpage?.globe?.camera?.position?.toArray?.() ?? null,
  gaps: window.__frameGaps ?? [],
  longs: (window.__longTasks ?? []).slice(-30),
  longErr: window.__longTaskError ?? null,
  cursor: getComputedStyle(document.body).cursor,
}));
await page.screenshot({ path: '/tmp/cine-arrival/arrival-after-release.png' });
const dist = (a, b) => a && b ? Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) : null;
const row = {
  wallMs: Date.now() - t0,
  landed,
  stillMs: dist(atLanding, afterSecond),
  dragMs: dist(afterSecond, afterDrag.cam),
  cursor: afterDrag.cursor,
  gaps: afterDrag.gaps,
  longs: afterDrag.longs,
  longErr: afterDrag.longErr,
  traces,
  renderer: 'SwiftShader',
};
process.stdout.write(JSON.stringify(row, null, 2) + '\n');
await browser.close();
