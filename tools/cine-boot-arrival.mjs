/**
 * Browser evidence for the first-visit boot budget.
 * Cloud VM, Chrome SwiftShader. Not an omen run.
 * Writes PNGs under /tmp/cine-arrival/.
 */
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const outDir = '/tmp/cine-arrival';
mkdirSync(outDir, { recursive: true });
const base = 'http://127.0.0.1:5173/?start=sphere&stages=1&trees=v2&noprobe=1';
const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

async function play(name, { abortGlobe }) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const logs = [];
  page.on('console', m => {
    const t = m.text();
    if (/cine earth ready|inpage prewarm|boot failed|STARTUP|PAGEERROR/i.test(t)) logs.push(t.slice(0, 240));
  });
  page.on('pageerror', e => logs.push('PAGEERROR ' + e.message));
  if (abortGlobe) {
    await page.route('**/*globeView*', route => route.abort('failed'));
  }
  const t0 = Date.now();
  await page.goto(base, { waitUntil: 'commit', timeout: 60000 });
  await page.waitForSelector('#cine .prompt', { timeout: 120000 });
  const loadMs = Date.now() - t0;
  await page.locator('#cine').click({ position: { x: 280, y: 280 }, force: true });
  const samples = [];
  const deadline = Date.now() + 150000;
  let todayShot = false;
  let done = false;
  while (Date.now() < deadline && !done) {
    const snap = await page.evaluate(() => {
      const count = document.querySelector('#cine-panel .count')?.textContent ?? '';
      const hero = document.querySelector('#cine .hero-line')?.textContent ?? '';
      const cine = !!document.getElementById('cine');
      const mode = window.__inpage?.mode ?? null;
      const seen = window.__borealSave?.hasSeenBigBang?.() ?? null;
      return { count, hero, cine, mode, seen, elapsed: window.__borealOpening?.elapsed ?? null };
    });
    samples.push({ t: Date.now() - t0, ...snap });
    if (!todayShot && (snap.count === 'Today' || snap.hero.includes('Today'))) {
      await page.screenshot({ path: `${outDir}/${name}-today.png` });
      todayShot = true;
    }
    if (snap.seen === true && !snap.cine) { done = true; break; }
    if (snap.seen === true && snap.cine && snap.elapsed != null && snap.elapsed >= 108) {
      await page.screenshot({ path: `${outDir}/${name}-b14.png` });
      done = true;
      break;
    }
    await page.waitForTimeout(1000);
  }
  await page.screenshot({ path: `${outDir}/${name}-arrival.png` });
  const last = samples[samples.length - 1];
  const clocks = [...new Set(samples.map(s => s.count).filter(Boolean))];
  const row = { name, abortGlobe, loadMs, todayShot, done, last, clocks, logs, renderer: 'SwiftShader' };
  process.stderr.write(JSON.stringify(row) + '\n');
  await context.close();
  return row;
}

const rows = [];
rows.push(await play('reject-globe', { abortGlobe: true }));
rows.push(await play('normal', { abortGlobe: false }));
process.stdout.write(JSON.stringify(rows, null, 2) + '\n');
await browser.close();
