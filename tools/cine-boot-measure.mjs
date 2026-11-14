/**
 * First-visit boot and prewarm timings.
 * Cloud VM, Chrome SwiftShader (ANGLE). Not an omen GPU result.
 *
 * Chrome: --use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist
 * Viewport 1280×720. A new browser context each run (empty storage).
 * URL: ?start=sphere&stages=1&trees=v2&noprobe=1
 *   That is the bare-load rewrite (startView.ts SPHERE_START) plus noprobe.
 *   Any other query without start=sphere is the ground view, which never opens this film.
 *   noprobe skips the Ultra bench on the loading card. A first visit does not prewarm during
 *   startup either way; prewarm starts on the click. The bench is not part of the timed boot.
 *   deviceMemory on this VM is 16, so transitionPath stays in-page without ?transition=.
 */
import { chromium } from 'playwright-core';

const base = process.env.BASE ?? 'http://127.0.0.1:5173/';
const runs = Number(process.env.RUNS ?? 3);
const url = new URL(base);
url.searchParams.set('start', 'sphere');
url.searchParams.set('stages', '1');
url.searchParams.set('trees', 'v2');
url.searchParams.set('noprobe', '1');
const log = (m) => process.stderr.write(m + '\n');

const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/usr/bin/google-chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

const out = [];
for (let i = 1; i <= runs; i++) {
  log(`run ${i} start ${url.href}`);
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const logs = [];
  page.on('console', msg => {
    const t = msg.text();
    if (/prewarm|PROBE|STARTUP|boot|globe|INPAGE|cine/i.test(t)) logs.push(t.slice(0, 500));
  });
  page.on('pageerror', err => logs.push('PAGEERROR ' + String(err).slice(0, 500)));
  const tNav = Date.now();
  await page.goto(url.href, { waitUntil: 'commit', timeout: 60000 });
  try {
    await page.waitForSelector('#cine .prompt', { timeout: 180000 });
  } catch (e) {
    logs.push('WAIT ' + e.message.split('\n')[0]);
  }
  const loadMs = Date.now() - tNav;
  log(`run ${i} prompt wait ${loadMs}ms`);
  const env = await page.evaluate(() => ({
    deviceMemory: navigator.deviceMemory ?? null,
    cores: navigator.hardwareConcurrency ?? null,
    inpage: !!window.__inpage,
    prompt: document.querySelector('#cine .prompt')?.textContent ?? null,
    cine: !!document.getElementById('cine'),
    renderer: (() => {
      try {
        const c = document.querySelector('canvas');
        const gl = c && (c.getContext('webgl2') || c.getContext('webgl'));
        if (!gl) return null;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : String(gl.getParameter(gl.RENDERER));
      } catch (e) { return 'renderer-error ' + e.message; }
    })(),
  }));
  if (!env.prompt) {
    out.push({ run: i, loadMs, env, logs, measure: { err: 'no cinematic prompt' } });
    log(`run ${i} no cinematic ${JSON.stringify({ env, logs })}`);
    await context.close();
    continue;
  }
  await page.evaluate(() => {
    const ip = window.__inpage;
    if (!ip?.prewarm) { window.__bootMeasure = { err: 'no prewarm' }; return; }
    const orig = ip.prewarm.bind(ip);
    ip.prewarm = async () => {
      const t0 = performance.now();
      const box = { t0, ok: null };
      window.__bootMeasure = box;
      const watch = (async () => {
        const start = performance.now();
        while (!ip.globe?.bootP) {
          if (performance.now() - start > 120000) { box.globeSeenMs = null; return; }
          await new Promise(r => setTimeout(r, 25));
        }
        box.globeSeenMs = performance.now() - t0;
        const b0 = performance.now();
        try {
          await ip.globe.bootP;
          box.bootPMs = performance.now() - t0;
          box.bootPAfterGlobeMs = performance.now() - b0;
          box.bootOk = true;
        } catch (e) {
          box.bootPMs = performance.now() - t0;
          box.bootOk = false;
          box.bootErr = String(e?.message ?? e);
        }
      })();
      try {
        const r = await orig();
        box.prewarmMs = performance.now() - t0;
        box.prewarm = r;
        box.ok = true;
      } catch (e) {
        box.prewarmMs = performance.now() - t0;
        box.ok = false;
        box.err = String(e?.message ?? e);
      }
      await watch;
    };
  });
  await page.locator('#cine').click({ position: { x: 240, y: 240 }, force: true });
  const tClick = Date.now();
  let measure = null;
  const deadline = Date.now() + 150000;
  while (Date.now() < deadline) {
    measure = await page.evaluate(() => window.__bootMeasure ?? null);
    if (measure?.prewarmMs != null && (measure.bootPMs != null || measure.bootOk === false)) break;
    await new Promise(r => setTimeout(r, 2000));
    log(`run ${i} partial ${JSON.stringify({ globeSeenMs: measure?.globeSeenMs, bootPMs: measure?.bootPMs, prewarmMs: measure?.prewarmMs, ok: measure?.ok })}`);
  }
  const row = { run: i, loadMs, clickWallMs: Date.now() - tClick, env, measure, logs };
  out.push(row);
  log(`run ${i} done ${JSON.stringify({ loadMs, clickWallMs: row.clickWallMs, measure })}`);
  await context.close();
}
await browser.close();
process.stdout.write(JSON.stringify(out, null, 2) + '\n');
