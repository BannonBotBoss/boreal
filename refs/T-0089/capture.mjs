// T-0089 evidence (headless Chrome, SwiftShader software GL: pictures and uniform values, not GPU frame rates).
//   node refs/T-0089/capture.mjs <base> stills|drift
// stills: same hour, same pinned clock (?shot), dry (?envrh=0.1) vs humid (?envrh=0.95) at orbit and 2 km, Ultra and Minimum.
// drift: clock running, 12 s at 3000 km; the record's east wind forced to +4000 m/s, then -4000 m/s at 6 s (dev hook
// ENV_FORCE; real winds of ~10 m/s move the shell ~0.002 deg/s at 1x, invisible in 12 s). Logs the shell's drift angle
// (uCloudSpin) each frame against u x 12 x dt / (R cos lat).
import { chromium } from 'playwright-core';
import { writeFileSync, mkdirSync } from 'node:fs';
const base = process.argv[2] ?? 'http://127.0.0.1:5197', mode = process.argv[3] ?? 'stills', out = '/workspace/boreal-gh/refs/T-0089';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] });
const log = []; const L = s => { log.push(s); console.log(s); };
const dome = `(() => { const g = window.__globe; const d = g.scene.children.find(o => o.material && o.material.uniforms && o.material.uniforms.uCloudSpin); return d.material.uniforms; })()`;
async function open(url) {
  const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
  page.on('pageerror', e => L('pageerror: ' + e.message)); page.on('console', m => { if (m.type() === 'error') L('console.error: ' + m.text()); });
  const t0 = Date.now(); await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => { const g = window.__globe; return g && g.stats().drawn > 0; }, null, { timeout: 300000, polling: 500 });
  // tiles settle (a low, near-horizontal view may never empty its queue: cap the wait at 60 s)
  await page.waitForFunction(() => window.__globe.stats().queued === 0, null, { timeout: 60000, polling: 500 }).catch(() => L('queue not empty after 60 s: ' + JSON.stringify({})));
  await page.evaluate(async () => { window.__env = await import('/src/render/environment.ts'); }); // the app's own module instance (same URL)
  await page.waitForFunction(() => window.__env.ENV.source === 'globe', null, { timeout: 120000, polling: 500 });
  L(`ready ${((Date.now() - t0) / 1000).toFixed(1)} s ${url}`);
  return page;
}
try {
  if (mode === 'stills') {
    for (const [tag, alt, extra] of [['orbit', 3000e3, ''], ['2km', 2000, '&pitch=80']]) for (const [tn, tier] of [['ultra', 0], ['minimum', 5]]) for (const [cond, rh] of [['dry', .1], ['humid', .95]]) {
      const page = await open(`${base}/?view=globe&shot&hour=10&day=200&latlon=49.77,-94.5&alt=${alt}${extra}&tier=${tier}&envrh=${rh}`);
      await page.waitForTimeout(2500);
      const v = await page.evaluate(`(async () => { const E = window.__env.ENV, u = ${dome}; return { rh: E.rh, tC: E.tC, windE: E.windE, windN: E.windN, latDeg: E.latDeg, rate: E.rate, mieScale: u.uMieScale.value }; })()`);
      const f = `${out}/t0089-${tag}-${tn}-${cond}.jpg`; await page.screenshot({ path: f, type: 'jpeg', quality: 88 });
      L(`STILL ${f} ${JSON.stringify(v)}`); await page.close();
    }
  } else {
    const page = await open(`${base}/?view=globe&hour=10&day=200&latlon=49.77,-94.5&alt=3000000&tier=4&panel=0`);
    await page.evaluate(async () => { (await import('/src/render/environment.ts')).ENV_FORCE.windE = 4000; });
    await page.waitForTimeout(1500);
    const rec = []; const t0 = Date.now(); let n = 0, flipped = false;
    while (Date.now() - t0 < 12000) {
      if (!flipped && Date.now() - t0 > 6000) { flipped = true; await page.evaluate(async () => { (await import('/src/render/environment.ts')).ENV_FORCE.windE = -4000; }); }
      const r = await page.evaluate(`(async () => { const E = (await import('/src/render/environment.ts')).ENV, s = ${dome}.uCloudSpin.value; const w = await import('/src/core/worldClock.ts'); return [performance.now(), w.worldSec(), Math.atan2(s.y, s.x), E.windE, E.latDeg]; })()`);
      rec.push(r); await page.screenshot({ path: `/tmp/t0089-drift/f${String(n++).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 85 });
    }
    // measured angular rate vs u x 12 / (R cos lat), per half (wrap-safe differences)
    const R = 6371008.8, half = (a) => { let d = 0; for (let i = 1; i < a.length; i++) { let x = a[i][2] - a[i - 1][2]; x = Math.atan2(Math.sin(x), Math.cos(x)); d += x; } const dw = a[a.length - 1][1] - a[0][1]; return { measured: d / dw, predicted: a[a.length - 1][3] * 12 / (R * Math.cos(a[a.length - 1][4] * Math.PI / 180)), worldSec: +dw.toFixed(2), frames: a.length }; };
    const i = rec.findIndex(r => r[3] < 0);
    const settle = 3; // the record refreshes every 60 frames: skip the frames before the forced flip reaches it
    L('DRIFT +u ' + JSON.stringify(half(rec.slice(0, i))));
    L('DRIFT -u ' + JSON.stringify(half(rec.slice(i + settle))));
    L(`DRIFT frames ${n} in ${((Date.now() - t0) / 1000).toFixed(1)} s, flip seen at frame ${i}`);
    writeFileSync(`${out}/drift-rec.json`, JSON.stringify(rec));
  }
} finally { await browser.close(); writeFileSync(`${out}/${mode}-log.txt`, log.join('\n') + '\n'); }
