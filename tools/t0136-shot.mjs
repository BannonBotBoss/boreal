// Sphere colour, framing, and menu checks against the Pages bundle.
import { mkdirSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';

const ROOT = new URL('..', import.meta.url).pathname;
const OUT = `${ROOT}tasks/evidence/T-0136`;
mkdirSync(OUT, { recursive: true });
const pw = await import('playwright-core');
const chromium = pw.chromium ?? pw.default.chromium;
const port = 4184;
const preview = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1', '--directory', '/tmp/pages-root'], { stdio: 'ignore' });
const wait = (ms) => new Promise(r => setTimeout(r, ms));
await wait(400);
const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.setDefaultTimeout(180000);
const notes = [];
try {
  await page.goto(`http://127.0.0.1:${port}/boreal/?data=1&noprobe`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.body.innerText.includes('spacetime'), undefined, { timeout: 180000 });
  await page.waitForFunction(() => {
    const loading = document.querySelector('#loading');
    return !loading || loading.classList.contains('fade');
  }, undefined, { timeout: 180000 });
  const setCycle = async (text) => {
    await page.evaluate(async (t) => { await window.borealData.setCycle(t); }, text);
    await wait(900);
  };
  const menuHidden = () => page.evaluate(() => {
    const menu = document.querySelector('#start-menu');
    const style = menu ? getComputedStyle(menu).visibility : '';
    return { hidden: menu?.hidden ?? null, visibility: style, fade: menu?.className ?? '' };
  });
  for (const [name, cycle] of [['sphere-t1.png', '1'], ['sphere-t12.png', '12'], ['sphere-t60.png', '60']]) {
    await setCycle(cycle);
    const info = await page.evaluate(() => {
      const c = document.querySelector('#cosmos-sphere');
      const r = c?.getBoundingClientRect();
      return { sphere: !!c, w: r?.width ?? 0, h: r?.height ?? 0, look: document.querySelector('#data-panel')?.innerText.match(/sphere radius is [\d.]+/)?.[0] ?? '' };
    });
    notes.push(`${name} ${JSON.stringify(info)} menu ${JSON.stringify(await menuHidden())}`);
    await page.screenshot({ path: `${OUT}/${name}` });
  }
  const url = await page.evaluate(() => window.borealData.capture());
  if (url.startsWith('data:image/png')) writeFileSync(`${OUT}/sphere-4k.png`, Buffer.from(url.split(',')[1], 'base64'));
  await page.keyboard.press('u');
  await wait(500);
  const after = await page.evaluate(() => ({
    panel: document.querySelector('#data-panel')?.hidden ?? null,
    sphere: !!document.querySelector('#cosmos-sphere'),
    menu: document.querySelector('#start-menu') ? getComputedStyle(document.querySelector('#start-menu')).visibility : null,
    menuText: document.querySelector('#start-menu')?.innerText?.slice(0, 80) ?? '',
  }));
  notes.push('after U ' + JSON.stringify(after));
  await page.screenshot({ path: `${OUT}/after-u.png` });
  writeFileSync(`${OUT}/notes.json`, JSON.stringify(notes, null, 2));
  console.log(notes.join('\n'));
} finally {
  await browser.close();
  preview.kill('SIGTERM');
}
