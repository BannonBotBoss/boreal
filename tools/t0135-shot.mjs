// Real-browser check of the Pages bundle for T-0135. SwiftShader, 1280×720.
import { mkdirSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';

const ROOT = new URL('..', import.meta.url).pathname;
const OUT = `${ROOT}tasks/evidence/T-0135`;
mkdirSync(OUT, { recursive: true });
const pw = await import('playwright-core');
const chromium = pw.chromium ?? pw.default.chromium;
const port = 4182;
const preview = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1', '--directory', '/tmp/pages-root'], { cwd: ROOT, stdio: 'inherit' });
const wait = (ms) => new Promise(r => setTimeout(r, ms));
await wait(1200);
const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.setDefaultTimeout(180000);
page.on('pageerror', e => notes.push('pageerror ' + String(e).slice(0, 300)));
page.on('console', msg => { if (msg.type() === 'error') notes.push('console ' + msg.text().slice(0, 300)); });
const notes = [];
const shot = (name) => page.screenshot({ path: `${OUT}/${name}` });
async function openApp() {
  const urls = [`http://127.0.0.1:${port}/boreal/?nomenu&data=1&noprobe`];
  let last = '';
  for (const url of urls) {
    const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(e => { last = String(e); return null; });
    if (res && res.ok()) return url;
  }
  throw new Error(last || 'preview did not serve the bundle');
}
try {
  const url = await openApp();
  notes.push(`opened ${url}`);
  await page.waitForFunction(() => document.body.innerText.includes('spacetime') || document.body.innerText.includes('not loaded'), undefined, { timeout: 180000 });
  await shot('01-panel-open.png');

  const typeCycle = async (text) => {
    const input = page.locator('#cycle-input');
    await input.click();
    await input.fill(text);
    await input.dispatchEvent('input');
    await wait(1400);
    const value = await input.inputValue();
    const same = await input.evaluate(el => el.isConnected);
    return { value, connected: same };
  };
  const scrollEngine = async (type) => page.evaluate((id) => {
    const card = document.querySelector(`#data-panel [data-engine="${id}"]`);
    card?.scrollIntoView({ block: 'start' });
  }, type);
  const scrollIn = async (type, text) => page.evaluate(({ id, text }) => {
    const card = document.querySelector(`#data-panel [data-engine="${id}"]`);
    const hit = [...(card?.querySelectorAll('div') ?? [])].find(n => n.textContent.trim() === text);
    (hit ?? card)?.scrollIntoView({ block: 'start' });
  }, { id: type, text });

  const c1 = await typeCycle('1');
  notes.push(`cycle 1 field=${c1.value} connected=${c1.connected}`);
  await scrollIn('spacetime', 'Friedmann');
  await shot('02-cycle-1-equations.png');
  const h1 = await page.evaluate(() => {
    const card = document.querySelector('[data-engine="spacetime"]');
    return card ? card.innerText : '';
  });

  const c12 = await typeCycle('12');
  notes.push(`cycle 12 field=${c12.value} connected=${c12.connected}`);
  await scrollIn('spacetime', 'Friedmann');
  await shot('03-cycle-12-equations.png');
  const h12 = await page.evaluate(() => document.querySelector('[data-engine="spacetime"]')?.innerText ?? '');

  const c60 = await typeCycle('60');
  notes.push(`cycle 60 field=${c60.value} connected=${c60.connected}`);
  await scrollIn('spacetime', 'Friedmann');
  await shot('04-cycle-60-equations.png');
  const h60 = await page.evaluate(() => document.querySelector('[data-engine="spacetime"]')?.innerText ?? '');

  await scrollEngine('planet');
  await shot('05-planet-card.png');
  await scrollIn('reheating', 'Inputs');
  await shot('06-reheating-masses.png');
  await scrollEngine('climate');
  await shot('07-climate-card.png');

  const controls = await page.evaluate(() => ({
    capture: !!document.querySelector('#capture-4k'),
    tier: !!document.querySelector('#tier-lock'),
    view: !!document.querySelector('#view-early'),
    follow: !!document.querySelector('#follow-clock'),
    reset: document.querySelectorAll('[data-role="reset"]').length,
    calls: [...document.querySelectorAll('[data-role="calls"]')].map(n => n.textContent),
    katex: document.querySelectorAll('.katex').length,
  }));
  notes.push(JSON.stringify(controls));
  await page.locator('#view-early').click();
  await wait(1500);
  const sphere = await page.evaluate(() => {
    const c = document.querySelector('#cosmos-sphere');
    if (!c) return { present: false };
    const r = c.getBoundingClientRect();
    return { present: true, w: r.width, h: r.height, hidden: c.hidden };
  });
  notes.push(`sphere ${JSON.stringify(sphere)}`);
  await shot('08-early-universe-sphere.png');

  // U must open the data panel and must not open the start menu.
  await page.keyboard.press('u');
  await wait(300);
  const afterClose = await page.evaluate(() => ({
    panel: document.querySelector('#data-panel')?.hidden ?? null,
    menu: document.querySelector('#start-menu')?.className ?? null,
  }));
  await page.keyboard.press('u');
  await wait(600);
  const afterOpen = await page.evaluate(() => ({
    panel: document.querySelector('#data-panel')?.hidden ?? null,
    menu: document.querySelector('#start-menu')?.className ?? null,
    text: document.querySelector('#data-panel')?.innerText?.slice(0, 80) ?? '',
  }));
  notes.push(`U close ${JSON.stringify(afterClose)} open ${JSON.stringify(afterOpen)}`);
  await shot('09-u-key.png');

  // Globe entry. G on the ground is growl. Shift+G is the planet view.
  await page.locator('#follow-clock').click();
  await wait(1500);
  await scrollEngine('planet');
  await shot('11-today-planet.png');
  await scrollIn('climate', 'Budyko temperature');
  await shot('12-today-climate.png');
  await page.evaluate(() => { const a = document.activeElement; if (a instanceof HTMLElement) a.blur(); });
  await page.keyboard.press('Shift+g');
  await wait(4000);
  const globe = await page.evaluate(() => ({
    href: location.href,
    menu: document.querySelector('#start-menu')?.className ?? null,
    text: document.body.innerText.slice(0, 500),
  }));
  notes.push(`shift+G ${JSON.stringify(globe)}`);
  await shot('10-shift-g.png');
  writeFileSync(`${OUT}/notes.json`, JSON.stringify({ notes, h1: h1.slice(0, 800), h12: h12.slice(0, 800), h60: h60.slice(0, 800) }, null, 2));
} catch (err) {
  const text = await page.evaluate(() => document.body.innerText.slice(0, 800)).catch(() => '');
  writeFileSync(`${OUT}/error.txt`, `${err}\n\n${notes.join('\n')}\n\n${text}`);
  await page.screenshot({ path: `${OUT}/error.png` }).catch(() => {});
  throw err;
} finally {
  await browser.close();
  preview.kill('SIGTERM');
}
console.log('t0135 shots written');
