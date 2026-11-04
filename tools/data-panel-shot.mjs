// Headless frames of the data panel and the early-universe sphere.
// SwiftShader, 1280x720 page. 4K stills come from the panel's capture, which forces the Ultra tier.
import { mkdirSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';

const ROOT = new URL('..', import.meta.url).pathname;
const OUT = `${ROOT}tasks/evidence/T-0134`;
for (const d of ['', '/sphere', '/lod', '/reheating']) mkdirSync(OUT + d, { recursive: true });
const pw = await import('playwright-core');
const chromium = pw.chromium ?? pw.default.chromium;
const port = 4178;
const preview = spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: ROOT, stdio: 'inherit' });
const wait = (ms) => new Promise(r => setTimeout(r, ms));
await wait(1500);
const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const notes = [];
page.on('pageerror', e => notes.push(String(e).slice(0, 240)));
const shot = (name) => page.screenshot({ path: `${OUT}/${name}` });
const cycleForSeconds = (seconds) => Math.log10(Math.abs(seconds) / 5.39e-44) + 1;
try {
  await page.goto(`http://127.0.0.1:${port}/?data=1&noprobe`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => document.body.innerText.includes('What is running') || document.body.innerText.includes('not loaded'), { timeout: 180000 });
  await page.waitForFunction(() => document.body.innerText.includes('spacetime') || document.body.innerText.includes('not loaded'), { timeout: 180000 });
  await shot('panel-start.png');
  const set = async (text) => page.evaluate(async (t) => {
    window.borealData.expand('spacetime');
    window.borealData.expand('reheating');
    await window.borealData.setCycle(t);
  }, text);
  await set('0'); await wait(400); await shot('time-0.png');
  await set('1'); await wait(600); await shot('time-1.png');
  await set(String(cycleForSeconds(1e-34))); await wait(500); await shot('time-inflation-mid.png');
  await set(String(cycleForSeconds(1.02e-32))); await wait(700); await shot('time-inflation-end.png');
  await set(String(cycleForSeconds(100))); await wait(700); await shot('time-nucleosynthesis.png');
  await set(String(cycleForSeconds(9.2e9 * 365.25 * 86400))); await wait(1500); await shot('time-planet.png');
  await set(String(cycleForSeconds(13.8e9 * 365.25 * 86400))); await wait(800); await shot('time-today.png');
  const edited = await page.evaluate(() => {
    const input = [...document.querySelectorAll('#data-panel input')].find(el => el.value && Math.abs(Number(el.value) - 1361) < 1);
    if (!input) return 'no solar field';
    input.value = '2000';
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return 'set';
  });
  await wait(800);
  await shot('param-solar-2000.png');
  const logText = await page.evaluate(() => window.borealData.text());
  writeFileSync(`${OUT}/panel-nucleosynthesis.txt`, logText);
  // Sphere stills. Capture forces Ultra (3840×2160).
  const times = [
    ['planck', '1'],
    ['inflation-mid', String(cycleForSeconds(1e-34))],
    ['inflation-end', String(cycleForSeconds(1.02e-32))],
    ['nucleosynthesis', String(cycleForSeconds(100))],
  ];
  for (const [name, cycle] of times) {
    await set(cycle);
    await wait(500);
    await shot(`sphere/page-${name}.png`);
    const url = await page.evaluate(() => window.borealData.capture());
    if (url.startsWith('data:image/png')) {
      writeFileSync(`${OUT}/sphere/${name}-4k.png`, Buffer.from(url.split(',')[1], 'base64'));
    }
  }
  // LOD: benchmark, then force each tier and grab a page shot plus frame numbers.
  await set('1');
  const bench = await page.evaluate(async () => window.borealData.bench());
  writeFileSync(`${OUT}/lod/benchmark.json`, JSON.stringify({ bench, gpu: await page.evaluate(() => document.body.innerText.includes('GPU')) }, null, 2));
  for (const id of ['ultra', 'high', 'medium', 'low']) {
    await page.evaluate((tier) => {
      const sel = document.querySelector('#data-panel select');
      if (!sel) return;
      // the tier select is the one whose first option is automatic
      const all = [...document.querySelectorAll('#data-panel select')];
      const tierSel = all.find(s => [...s.options].some(o => o.value === 'low'));
      if (!tierSel) return;
      tierSel.value = tier;
      tierSel.dispatchEvent(new Event('change', { bubbles: true }));
    }, id);
    await wait(400);
    await shot(`lod/${id}.png`);
  }
  const tierText = await page.evaluate(() => window.borealData.text());
  writeFileSync(`${OUT}/lod/panel.txt`, tierText);
  // Fly-down, as a player: the page is already the game. Press G once the globe has input.
  const fly = [];
  for (let i = 0; i < 8; i++) {
    const hud = await page.evaluate(() => {
      const c = window.__inpage;
      return { mode: c?.mode ?? null, h: c ? Math.round(c.height) : null, text: document.body.innerText.slice(0, 400) };
    });
    fly.push(hud);
    if (hud.mode === 'globe') break;
    await wait(3000);
  }
  await page.keyboard.press('g');
  await wait(4000);
  await shot('flydown-after-g.png');
  const after = await page.evaluate(() => {
    const c = window.__inpage;
    return { mode: c?.mode ?? null, h: c ? Math.round(c.height) : null, phase: c?.flightPhase ?? null };
  });
  fly.push({ after });
  writeFileSync(`${OUT}/flydown.json`, JSON.stringify({ fly, after, notes, edited }, null, 2));
  await shot('flydown-later.png');
} finally {
  await browser.close();
  preview.kill('SIGTERM');
}
console.log('shots written');
