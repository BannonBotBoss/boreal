import { chromium } from 'playwright-core';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
const base = process.argv[2] ?? 'http://127.0.0.1:5195', stills = process.argv[3] !== 'timing', out = stills ? '/workspace/inertia-frames' : '/workspace/inertia-timing';
rmSync(out, { recursive: true, force: true }); mkdirSync(out, { recursive: true });
const STEP = Number(process.env.STEP ?? 12);
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] });
const log = [];
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
  page.on('console', m => { const t = m.text(); if (!/^SEAMS/.test(t)) log.push('console: ' + t); });
  page.on('pageerror', e => log.push('pageerror: ' + e.message));
  const t0 = Date.now();
  await page.goto(`${base}/?view=globe&hour=${process.env.HOUR ?? 11}`, { waitUntil: 'load' });
  // page ready: the dev handle exists, programs compiled, the frame loop running and tiles drawn
  await page.waitForFunction(() => { const g = window.__globe; return g && g.stats().drawn > 0 && g.stats().queued === 0; }, null, { timeout: 240000, polling: 500 });
  log.push(`ready in ${((Date.now() - t0) / 1000).toFixed(1)} s, renderer ${await page.evaluate(() => { const gl = document.querySelector('canvas').getContext('webgl2'); const x = gl.getExtension('WEBGL_debug_renderer_info'); return gl.getParameter(x ? x.UNMASKED_RENDERER_WEBGL : gl.RENDERER); })}`);
  await page.waitForTimeout(1500);
  // in-page recorder: every rAF, time, coasting, camera direction
  await page.evaluate(() => { const g = window.__globe, rec = window.__rec = []; const f = () => { const p = g.camera.position, l = p.length() || 1; rec.push([performance.now(), g.coasting ? 1 : 0, p.x / l, p.y / l, p.z / l]); requestAnimationFrame(f); }; requestAnimationFrame(f); });
  const shots = []; const snap = async name => { const t = await page.evaluate(() => performance.now()); const f = `${out}/${name}.jpg`; await page.screenshot({ path: f, type: 'jpeg', quality: 85 }); shots.push([name, t]); return t; };
  let n = 0; const frame = async () => stills ? snap(`f${String(n++).padStart(4, '0')}`) : page.waitForTimeout(50);
  for (let i = 0; i < 4; i++) await frame(); // before the drag
  // drag: grab at centre, sweep left->right and a little up for ~0.6 s, release while moving
  const cx = 480, cy = 300; await page.mouse.move(cx + (process.env.DIR === 'left' ? 150 : -150), cy + 30); await page.mouse.down();
  for (let i = 1; i <= 12; i++) { await page.mouse.move(cx + (process.env.DIR === 'left' ? 150 - i * STEP : -150 + i * STEP), cy + 30 - i * 2); if (i < 12) await page.waitForTimeout(50); if (i % 4 === 0 && i < 12) await frame(); }
  const tRelease = await page.evaluate(() => performance.now()); await page.mouse.up();
  if (stills) await snap('release');
  const marks = [1, 2, 3, 4]; let k = 0;
  while (true) { const now = await page.evaluate(() => performance.now()); const dt = (now - tRelease) / 1000;
    if (stills && k < marks.length && dt >= marks[k]) { await snap(`plus${marks[k]}`); k++; continue; }
    if (dt > 5) break; await frame(); }
  const rec = await page.evaluate(() => window.__rec);
  const coastOn = rec.filter(r => r[0] >= tRelease && r[1]), last = coastOn.length ? coastOn[coastOn.length - 1][0] : tRelease;
  const ang = (a, b) => Math.acos(Math.min(1, a[2] * b[2] + a[3] * b[3] + a[4] * b[4]));
  // angular speed (deg/s) around each mark, from the recorded camera directions
  const speedAt = s => { const t = tRelease + s * 1000, w = 250, a = rec.filter(r => r[0] >= t - w && r[0] <= t + w); if (a.length < 2) return null; let d = 0; for (let i = 1; i < a.length; i++) d += ang(a[i - 1], a[i]); return +(d / ((a[a.length - 1][0] - a[0][0]) / 1000) * 180 / Math.PI).toFixed(3); };
  const intervals = rec.slice(1).map((r, i) => r[0] - rec[i][0]);
  const res = { coastSec: +((last - tRelease) / 1000).toFixed(2), coastingAt: Object.fromEntries([0.1, 1, 2, 2.9, 3.2, 4].map(s => { const r = rec.find(x => x[0] >= tRelease + s * 1000); return [s, r ? !!r[1] : null]; })),
    speedDegPerSec: Object.fromEntries([0.15, 1, 2, 3, 4].map(s => [s, speedAt(s)])), frames: rec.length, fpsMedian: +(1000 / intervals.sort((a, b) => a - b)[intervals.length >> 1]).toFixed(1),
    coastingNow: await page.evaluate(() => window.__globe.coasting), shots: shots.map(([nm, t]) => [nm, +((t - tRelease) / 1000).toFixed(2)]) };
  log.push('RESULT ' + JSON.stringify(res));
  writeFileSync(`${out}/shots.json`, JSON.stringify(shots)); writeFileSync(`${out}/rec.json`, JSON.stringify({ tRelease, rec }));
} finally { await browser.close(); writeFileSync(`${out}/log.txt`, log.join('\n') + '\n'); console.log(log.join('\n')); }
