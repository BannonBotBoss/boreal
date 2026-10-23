// 2026-10-23 12:55 PT loop. Sound toggle, jump frames, controls footer.
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
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.addInitScript(() => {
  const log = [];
  window.__audioLog = log;
  const Orig = window.AudioContext || window.webkitAudioContext;
  if (!Orig) return;
  function Wrapped(...args) {
    const ctx = new Orig(...args);
    log.push({ t: Math.round(performance.now()), kind: 'new', state: ctx.state });
    const origResume = ctx.resume.bind(ctx);
    ctx.resume = () => { log.push({ t: Math.round(performance.now()), kind: 'resume', state: ctx.state }); return origResume(); };
    const origSuspend = ctx.suspend.bind(ctx);
    ctx.suspend = () => { log.push({ t: Math.round(performance.now()), kind: 'suspend', state: ctx.state }); return origSuspend(); };
    return ctx;
  }
  Wrapped.prototype = Orig.prototype;
  window.AudioContext = Wrapped;
});
page.setDefaultTimeout(90000);
await page.goto('http://127.0.0.1:5173/?nomenu&bench&rec&hour=12', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('canvas', { timeout: 30000 });
const started = Date.now();
while (Date.now() - started < 80000) {
  const step = await page.evaluate(() => document.querySelector('#loading .loading-step')?.textContent ?? null);
  if (!step) break;
  console.log('loading', step);
  await page.waitForTimeout(2000);
}
if (await page.evaluate(() => !!document.getElementById('loading'))) throw new Error('loading screen stayed up');
await page.waitForTimeout(800);
const audioBefore = await page.evaluate(() => window.__audioLog ?? []);
await page.screenshot({ path: join(dir, 'stand.png') });
const footer = await page.evaluate(() => ({
  footer: document.body.innerText.slice(0, 500),
  sound: document.getElementById('sound')?.textContent ?? null,
}));
await page.keyboard.down('Space');
await page.waitForTimeout(180);
await page.screenshot({ path: join(dir, 'jump-180ms.png') });
await page.waitForTimeout(400);
await page.screenshot({ path: join(dir, 'jump-580ms.png') });
await page.keyboard.up('Space');
await page.click('#sound').catch(() => {});
await page.waitForTimeout(300);
const soundAfter = await page.evaluate(() => ({ label: document.getElementById('sound')?.textContent ?? null, log: window.__audioLog ?? [] }));
await page.screenshot({ path: join(dir, 'sound-toggle.png') });
writeFileSync(join(dir, 'capture.json'), JSON.stringify({ audioBefore, footer, soundAfter, errors }, null, 2));
await browser.close();
console.log(JSON.stringify({ soundBefore: footer.sound, soundAfter: soundAfter.label, resumes: soundAfter.log.filter(e => e.kind === 'resume').length, errors: errors.length }));
