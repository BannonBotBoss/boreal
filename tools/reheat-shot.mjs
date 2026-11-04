// Panel frames for the reheating evidence. SwiftShader, 1280×720.
import { mkdirSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';

const ROOT = new URL('..', import.meta.url).pathname;
const OUT = `${ROOT}tasks/evidence/T-0134/reheating`;
mkdirSync(OUT, { recursive: true });
const pw = await import('playwright-core');
const chromium = pw.chromium ?? pw.default.chromium;
const port = 4180;
const preview = spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: ROOT, stdio: 'inherit' });
const wait = (ms) => new Promise(r => setTimeout(r, ms));
await wait(1500);
const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const cycleForSeconds = (seconds) => Math.log10(Math.abs(seconds) / 5.39e-44) + 1;
try {
  await page.goto(`http://127.0.0.1:${port}/?data=1&noprobe`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => document.body.innerText.includes('reheating') || document.body.innerText.includes('not loaded'), { timeout: 180000 });
  const set = async (text) => page.evaluate(async (t) => {
    window.borealData.expand('reheating');
    window.borealData.expand('spacetime');
    await window.borealData.setCycle(t);
    const panel = document.querySelector('#data-panel');
    const hit = [...panel.querySelectorAll('section')].find(n => {
      const name = n.querySelector('div');
      return name && name.textContent.trim().startsWith('reheating');
    });
    if (hit && panel) {
      const y = hit.getBoundingClientRect().top - panel.getBoundingClientRect().top + panel.scrollTop;
      panel.scrollTop = Math.max(0, y - 4);
    }
  }, text);
  const shots = [
    ['panel-inflation-end.png', cycleForSeconds(1.02e-32)],
    ['panel-decay.png', cycleForSeconds(1e-20)],
    ['panel-qcd.png', cycleForSeconds(3.2e-5)],
    ['panel-nucleosynthesis.png', cycleForSeconds(100)],
  ];
  for (const [name, cycle] of shots) {
    await set(String(cycle));
    await wait(700);
    await page.screenshot({ path: `${OUT}/${name}` });
    await page.evaluate(() => {
      const panel = document.querySelector('#data-panel');
      const hit = [...panel.querySelectorAll('div')].find(n => n.textContent.trim() === 'Inflaton decay');
      if (hit && panel) {
        const y = hit.getBoundingClientRect().top - panel.getBoundingClientRect().top + panel.scrollTop;
        panel.scrollTop = Math.max(0, y - 8);
      }
    });
    await wait(200);
    await page.screenshot({ path: `${OUT}/${name.replace('.png', '-equation.png')}` });
    const text = await page.evaluate(() => window.borealData.text());
    writeFileSync(`${OUT}/${name.replace('.png', '.txt')}`, text);
    console.log('wrote', name);
  }
  if (!process.env.SKIP_BENCH) {
    await set('1');
    const bench = await page.evaluate(async () => window.borealData.bench());
    writeFileSync(`${ROOT}tasks/evidence/T-0134/lod/benchmark.json`, JSON.stringify({
      bench,
      note: 'Timed with gl.finish() after composer.render, SwiftShader, up to 6 frames or 1.5 s per tier. Sub-millisecond numbers are the CPU return, not a 60 fps claim.',
    }, null, 2));
  }
} finally {
  await browser.close();
  preview.kill('SIGTERM');
}
console.log('reheat shots written');
