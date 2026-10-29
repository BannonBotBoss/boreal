// usage: node capture.mjs <url> <outdir> [seconds]
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
const [url, out, secsArg] = process.argv.slice(2); const secs = +(secsArg ?? 40);
fs.mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: true,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1280,800'] });
const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 800 });
const cdp = await page.createCDPSession();
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
await cdp.send('Network.enable');
await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 120, downloadThroughput: 1.5e6 / 8 * 8, uploadThroughput: 1e6 });
await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
const errors = []; page.on('pageerror', e => errors.push('pageerror ' + e.message)); page.on('console', m => { if (m.type() === 'error' || /Failed|startup/.test(m.text())) errors.push(m.type() + ' ' + m.text()); });
page.on('requestfailed', r => errors.push('requestfailed ' + r.url() + ' ' + r.failure()?.errorText));
const t0 = Date.now(); const nav = page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 }).catch(e => errors.push('goto ' + e.message));
const log = []; let i = 0, globeAt = null;
while (Date.now() - t0 < secs * 1000) {
  const t = Date.now() - t0;
  try {
    const probe = await page.evaluate(() => { const l = document.getElementById('loading'); const cs = l && getComputedStyle(l);
      return { ready: document.readyState, loading: l ? (cs.display === 'none' ? 'hidden' : cs.position + ' ' + cs.backgroundColor + ' op' + cs.opacity) : 'gone',
        bodyBg: document.body ? getComputedStyle(document.body).backgroundColor : null, htmlBg: getComputedStyle(document.documentElement).backgroundColor,
        onGlobe: document.body?.classList.contains('on-globe') ?? false, sheets: document.styleSheets.length }; });
    const f = `${out}/f${String(i).padStart(3, '0')}.jpg`;
    await page.screenshot({ path: f, type: 'jpeg', quality: 60 });
    log.push({ i, t, ...probe }); i++;
    if (probe.onGlobe && probe.loading === 'gone' && globeAt === null) globeAt = t;
    if (globeAt !== null && t - globeAt > 2500) break;
  } catch (e) { log.push({ i: -1, t, err: String(e.message).slice(0, 120) }); }
  await new Promise(r => setTimeout(r, 100));
}
fs.writeFileSync(`${out}/frames.json`, JSON.stringify({ url, cpuThrottle: 4, latencyMs: 120, globeAt, errors, log }, null, 1));
console.log('frames', i, 'globeAt', globeAt, 'errors', errors.length); console.log(errors.slice(0, 8).join('\n'));
await browser.close();
