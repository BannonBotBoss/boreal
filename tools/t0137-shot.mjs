// Live Pages frames for the violet glow. Writes tasks/evidence/T-0137/.
import { mkdirSync, writeFileSync } from 'node:fs';

const OUT = new URL('../tasks/evidence/T-0137/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const pw = await import('playwright-core');
const chromium = pw.chromium ?? pw.default.chromium;
const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.setDefaultTimeout(180000);
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const notes = [];
try {
  await page.goto('https://bannonbotboss.github.io/boreal/?v=1b54848&nomenu&data=1&noprobe', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.body.innerText.includes('Planck') || document.body.innerText.includes('What is running'), undefined, { timeout: 180000 });
  await page.waitForFunction(() => {
    const loading = document.querySelector('#loading');
    return !loading || loading.classList.contains('fade');
  }, undefined, { timeout: 180000 });
  for (const [name, cycle] of [['sphere-t1.png', '1'], ['sphere-t12.png', '12'], ['sphere-t60.png', '60']]) {
    await page.evaluate(async (t) => { await window.borealData.setCycle(t); }, cycle);
    await wait(1200);
    const info = await page.evaluate(() => {
      const panel = document.querySelector('#data-panel');
      const r = panel?.getBoundingClientRect();
      return { cycle: document.querySelector('#cycle-input')?.value, panel: r ? Math.round(r.width) : 0, sphere: !!document.querySelector('#cosmos-sphere') };
    });
    notes.push(`${name} ${JSON.stringify(info)}`);
    await page.screenshot({ path: OUT + name });
  }
  const url = await page.evaluate(() => window.borealData.capture());
  if (String(url).startsWith('data:image/png')) writeFileSync(OUT + 'sphere-4k.png', Buffer.from(url.split(',')[1], 'base64'));
  notes.push('4k ' + (String(url).startsWith('data:image/png') ? 'saved' : 'missing'));
  writeFileSync(OUT + 'notes.json', JSON.stringify(notes, null, 2));
  console.log(notes.join('\n'));
} finally {
  await browser.close();
}
