// Globe start, then G, the way a player drops. Does not try to fix a failed descent.
import { writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
const ROOT = new URL('..', import.meta.url).pathname;
const OUT = `${ROOT}tasks/evidence/T-0134`;
const pw = await import('playwright-core');
const chromium = pw.chromium ?? pw.default.chromium;
const preview = spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', '4179', '--strictPort'], { cwd: ROOT, stdio: 'inherit' });
const wait = (ms) => new Promise(r => setTimeout(r, ms));
await wait(1200);
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const notes = [];
page.on('pageerror', e => notes.push(String(e).slice(0, 200)));
try {
  await page.goto('http://127.0.0.1:4179/?start=globe&stages=1&trees=v2', { waitUntil: 'domcontentloaded', timeout: 120000 });
  let hud = null;
  for (let i = 0; i < 40; i++) {
    hud = await page.evaluate(() => {
      const c = window.__inpage;
      return { mode: c?.mode ?? null, h: c && c.height != null ? Math.round(c.height) : null, phase: c?.flightPhase ?? null };
    });
    if (hud.mode === 'globe') break;
    await wait(3000);
  }
  await page.screenshot({ path: `${OUT}/fly-globe.png` });
  await page.keyboard.press('g');
  const trail = [hud];
  for (let i = 0; i < 6; i++) {
    await wait(3000);
    const step = await page.evaluate(() => {
      const c = window.__inpage;
      return { mode: c?.mode ?? null, h: c && c.height != null ? Math.round(c.height) : null, phase: c?.flightPhase ?? null };
    });
    trail.push(step);
    await page.screenshot({ path: `${OUT}/fly-g-${i}.png` });
    if (step.mode === 'game' && step.h != null && step.h < 30) break;
  }
  writeFileSync(`${OUT}/flydown.json`, JSON.stringify({ trail, notes }, null, 2));
} finally {
  await browser.close();
  preview.kill('SIGTERM');
}
console.log('fly shots done');
