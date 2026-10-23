// Headless Chrome stills and a video for the 2026-10-23 03:14 PT loop.
// ?bench skips the startup GPU probe (it does not finish inside two minutes on SwiftShader).
// The tier sweep starts after that; shots are taken in the first quiet stretch, which is still the start tier.
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const base = 'http://127.0.0.1:5173/';
const errors = [];
const consoleLog = [];
const shots = [];

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-dev-shm-usage', '--no-sandbox', '--disable-extensions', '--no-first-run'],
});
const context = await browser.newContext({
  viewport: { width: 960, height: 540 },
  recordVideo: { dir, size: { width: 960, height: 540 } },
});
const page = await context.newPage();
page.on('pageerror', e => errors.push(String(e).slice(0, 300)));
page.on('console', m => {
  const t = m.text().slice(0, 300);
  if (m.type() === 'error') errors.push(t);
  if (/^BENCH|^PROBE|compileAsync/.test(t)) consoleLog.push(t);
});

async function settle() {
  await page.waitForSelector('#loading', { state: 'detached', timeout: 120000 });
  await page.waitForTimeout(10000);
}
async function shot(name) {
  const file = join(dir, name + '.png');
  await page.screenshot({ path: file });
  shots.push(name);
  console.log('shot', name);
  return file;
}

// Open east shore, noon. A high point at 688,604 never left the loading screen on this GPU.
const noon = `${base}?nomenu&bench&hour=12&at=200,250,-1.553`;
await page.goto(noon, { waitUntil: 'domcontentloaded', timeout: 60000 });
await settle();
await shot('terrain-noon');
await page.keyboard.down('ArrowDown');
await page.waitForTimeout(800);
await shot('terrain-down');
await page.keyboard.up('ArrowDown');

// Open water to the east, sun elevation about 18 deg, azimuth 89 deg. yaw -1.553 faces that azimuth.
const low = `${base}?nomenu&bench&hour=6.75&at=200,250,-1.553`;
await page.goto(low, { waitUntil: 'domcontentloaded', timeout: 60000 });
await settle();
await page.keyboard.down('ArrowUp');
await page.waitForTimeout(900);
await shot('sun-low');
await page.keyboard.up('ArrowUp');
await page.waitForTimeout(500);
await shot('sun-low-level');

// Flat ground. Movement uses the same probe the walk tool uses.
const move = `${base}?nomenu&bench&walkprobe&rec&hour=12&at=148,64,0`;
await page.goto(move, { waitUntil: 'domcontentloaded', timeout: 60000 });
await settle();
await page.waitForFunction(() => window.walkProbe && window.__boreal, { timeout: 30000 });
await shot('stand-flat');

function summarise(frames) {
  if (!frames.length) return { n: 0 };
  const a = frames[0], b = frames[frames.length - 1];
  const dt = (b.t - a.t) / 1000;
  const dist = Math.hypot(b.bx - a.bx, b.bz - a.bz);
  const gaits = {};
  let speed = 0, byMin = Infinity, byMax = -Infinity;
  for (const f of frames) {
    gaits[f.gait ?? 'none'] = (gaits[f.gait ?? 'none'] ?? 0) + 1;
    speed += f.speed; if (f.by < byMin) byMin = f.by; if (f.by > byMax) byMax = f.by;
  }
  return { n: frames.length, dt: +dt.toFixed(3), dist: +dist.toFixed(3), mps: dt ? +(dist / dt).toFixed(3) : null, gaitSpeed: +(speed / frames.length).toFixed(3), gaits, byMin: +byMin.toFixed(3), byMax: +byMax.toFixed(3), rise: +(byMax - byMin).toFixed(3) };
}
async function sampleMode(name, keys, ms) {
  for (const k of keys) await page.keyboard.down(k);
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.walkProbe.clear());
  await page.waitForTimeout(ms);
  for (const k of [...keys].reverse()) await page.keyboard.up(k);
  const frames = await page.evaluate(() => window.walkProbe.frames.map(f => ({ t: f.t, bx: +f.bx.toFixed(3), by: +f.by.toFixed(3), bz: +f.bz.toFixed(3), gait: f.gait, speed: +f.speed.toFixed(3) })));
  const steps = await page.evaluate(() => window.walkProbe.steps.length);
  const row = { name, keys, steps, ...summarise(frames), frames };
  console.log(name, JSON.stringify({ ...row, frames: undefined }));
  return row;
}
const modes = [];
modes.push(await sampleMode('walk', ['w'], 4000));
await shot('move-walk');
await page.waitForTimeout(600);
modes.push(await sampleMode('run', ['Shift', 'w'], 3000));
await shot('move-run');
await page.waitForTimeout(600);
modes.push(await sampleMode('sprint', ['Shift', 'c', 'w'], 2500));
await page.waitForTimeout(800);
await page.evaluate(() => window.walkProbe.clear());
await page.keyboard.down(' ');
await page.waitForTimeout(350);
await shot('jump-air');
await page.keyboard.up(' ');
await page.waitForTimeout(700);
await shot('jump-land');
const jumpFrames = await page.evaluate(() => window.walkProbe.frames.map(f => ({ t: f.t, by: +f.by.toFixed(3), bx: +f.bx.toFixed(3), bz: +f.bz.toFixed(3), speed: +f.speed.toFixed(3) })));
const jump = summarise(jumpFrames);
console.log('jump', JSON.stringify(jump));

writeFileSync(join(dir, 'motion.json'), JSON.stringify({ modes, jump, jumpFrames }, null, 2));
writeFileSync(join(dir, 'capture.json'), JSON.stringify({
  commit: process.env.CAPTURE_COMMIT ?? '',
  viewport: [960, 540],
  clock: '2026-10-23 03:14 PT inspection',
  note: '?bench skips the SwiftShader probe. Shots are 10 s after #loading leaves. Sun yaw -1.553 faces azimuth 89 deg.',
  shots, errors: errors.slice(0, 20), consoleLog: consoleLog.slice(0, 30),
}, null, 2));
const video = page.video();
await context.close();
await browser.close();
if (video) console.log('VIDEO ' + await video.path());
console.log('done', shots.join(','));
