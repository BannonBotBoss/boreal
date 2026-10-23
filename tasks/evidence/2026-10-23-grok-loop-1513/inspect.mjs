// 15:13 PT loop. Sound, physics, controls, UI, and one terrain look-down with a long wait.
// Headless Chrome, SwiftShader, isolated profile. No photo mode. No ?bench (that sweep changes tiers).
import { chromium } from 'playwright-core';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { acquire, release, track } from '../../../tools/bench-lock.mjs';
import { heightAt } from '../../../src/core/world.ts';
import { apexHeight } from '../../../src/animals/locomotion/jump.ts';

const dir = dirname(fileURLToPath(import.meta.url));
mkdirSync(dir, { recursive: true });
const base = 'http://127.0.0.1:5173/';
const url = base + '?nomenu&stages=1&hour=10&at=144,236,0&rec&walkprobe';
const profile = mkdtempSync(join(tmpdir(), 'grok-loop-1513-'));
const errors = [];
const lockName = 'grok: loop 1513 inspect';
const out = {
  base, url, profile, commit: 'fd65b8d game via board-loop',
  apexHeight: apexHeight(),
  heightAtSpawn: heightAt(144, 236),
  shots: [], errors, samples: [],
};

function imageStats(file) {
  const png = PNG.sync.read(readFileSync(file));
  const { width, height, data } = png;
  const acc = (y0, y1) => {
    let n = 0, r = 0, g = 0, b = 0, green = 0, white = 0, sum = 0, sum2 = 0;
    for (let y = y0; y < y1; y++) for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const R = data[i], G = data[i + 1], B = data[i + 2];
      n++; r += R; g += G; b += B;
      const Y = 0.2126 * R + 0.7152 * G + 0.0722 * B;
      sum += Y; sum2 += Y * Y;
      if (G > R && G > B && G > 40) green++;
      if (Math.min(R, G, B) >= 240) white++;
    }
    const mean = sum / n;
    const sd = Math.sqrt(Math.max(0, sum2 / n - mean * mean));
    return {
      n,
      meanRGB: [r / n, g / n, b / n].map(v => +v.toFixed(1)),
      green: +(green / n).toFixed(4),
      white: +(white / n).toFixed(4),
      lumaSd: +sd.toFixed(2),
    };
  };
  const y0 = Math.floor(height / 2);
  return { file, width, height, full: acc(0, height), lower: acc(y0, height) };
}

if (!(await acquire(lockName, { waitMs: 20000, pollMs: 1000 }))) {
  console.error('bench lock not acquired');
  process.exit(1);
}

const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/usr/bin/google-chrome',
  headless: true,
  args: [
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist', '--disable-dev-shm-usage', '--no-sandbox',
    '--disable-extensions', '--no-first-run',
  ],
});
const proc = typeof browser.process === 'function' ? browser.process() : null;
if (proc?.pid) track(proc.pid);

try {
  const context = await browser.newContext({ viewport: { width: 960, height: 540 } });
  await context.addInitScript(() => {
    window.__audioLog = [];
    const Orig = window.AudioContext;
    if (Orig) {
      function Wrapped(...args) {
        const ctx = new Orig(...args);
        window.__audioLog.push({ t: performance.now(), ev: 'new', state: ctx.state });
        const resume = ctx.resume.bind(ctx);
        ctx.resume = () => { window.__audioLog.push({ t: performance.now(), ev: 'resume', state: ctx.state }); return resume(); };
        return ctx;
      }
      Wrapped.prototype = Orig.prototype;
      window.AudioContext = Wrapped;
    }
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...a) {
      window.__audioLog.push({ t: performance.now(), ev: 'buf', dur: this.buffer ? +this.buffer.duration.toFixed(3) : null, off: a[1] ?? 0 });
      return start.apply(this, a);
    };
  });
  const page = await context.newPage();
  page.setDefaultTimeout(180000);
  page.setDefaultNavigationTimeout(60000);
  page.on('pageerror', e => errors.push(String(e).slice(0, 300)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 240)); });

  async function shot(name) {
    const path = join(dir, name + '.png');
    const status = await page.locator('#status').innerText().catch(() => '');
    const footer = await page.locator('footer').innerText().catch(() => '');
    const sound = await page.locator('#sound').innerText().catch(() => '');
    const href = page.url();
    await page.screenshot({ path });
    const stats = imageStats(path);
    const row = { name, href, status: status.slice(0, 240), footer: footer.slice(0, 300), sound, stats };
    out.shots.push(row);
    console.log(name, sound, stats.lower.green, stats.lower.meanRGB.join(','), stats.lower.lumaSd, status.slice(0, 80).replace(/\n/g, ' | '));
    return row;
  }
  async function audioNow() {
    return page.evaluate(() => ({
      n: window.__audioLog.length,
      head: window.__audioLog.slice(0, 8),
      tail: window.__audioLog.slice(-6),
      buf: window.__audioLog.filter(e => e.ev === 'buf').length,
      created: window.__audioLog.some(e => e.ev === 'new'),
    }));
  }
  async function probe(keep = 12) {
    return page.evaluate(k => {
      const w = window.walkProbe;
      const frames = w?.frames ?? [];
      const steps = w?.steps ?? [];
      return {
        n: frames.length,
        steps: steps.slice(-40),
        last: frames.at(-1) ?? null,
        tail: frames.slice(-k),
        player: window.__boreal?.player?.() ?? null,
      };
    }, keep);
  }

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  // Second argument is the page function's arg, not the options (Playwright).
  await page.waitForFunction(() => !document.querySelector('#loading'), undefined, { timeout: 150000 });
  const href = page.url();
  if (!href.startsWith(base)) throw new Error('unexpected url ' + href);
  out.landed = href;

  // No keys yet: audio must stay uncreated, and the terrain must paint before the look-down.
  let settled = null;
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(2000);
    const row = await shot('ui-settled');
    const L = row.stats.lower;
    const pale = L.green < 0.1 && L.lumaSd < 15 && L.meanRGB[0] > 170;
    out.samples.push({ t: (i + 1) * 2, pale, green: L.green, lumaSd: L.lumaSd, meanRGB: L.meanRGB });
    settled = row;
    if (!pale && L.green > 0.35) break;
  }
  out.settledBeforeInput = settled ? { green: settled.stats.lower.green, pale: settled.stats.lower.green < 0.1 } : null;
  out.audioBeforeGesture = await audioNow();

  await page.locator('#sound').click();
  await page.waitForTimeout(600);
  await shot('sound-toggle');
  out.audioAfterSoundClick = await audioNow();
  const soundLabel = await page.locator('#sound').innerText();
  if (soundLabel === 'Sound off') {
    await page.locator('#sound').click();
    await page.waitForTimeout(300);
  }
  out.soundLabelAfterUnmute = await page.locator('#sound').innerText();

  await page.keyboard.down('ArrowDown');
  await page.waitForTimeout(4000);
  await shot('terrain-down-4s');
  await page.waitForTimeout(8000);
  await shot('terrain-down');
  out.probeLookDown = await probe(4);
  await page.keyboard.up('ArrowDown');
  await page.waitForTimeout(1500);
  await shot('terrain-return');

  await page.evaluate(() => window.walkProbe?.clear());
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(3000);
  await page.keyboard.up('KeyW');
  await shot('walk');
  out.probeWalk = await probe(6);

  await page.evaluate(() => window.walkProbe?.clear());
  const jumpT0 = Date.now();
  await page.keyboard.down('Space');
  await page.waitForTimeout(180);
  await shot('jump-180');
  await page.waitForTimeout(400);
  await shot('jump-580');
  await page.keyboard.up('Space');
  await page.waitForTimeout(500);
  out.probeJump = await probe(80);
  out.jumpWallMs = Date.now() - jumpT0;

  await page.locator('#help').click();
  await page.waitForTimeout(500);
  await shot('controls');
  out.controlsText = await page.locator('body').innerText().then(t => t.slice(0, 2500)).catch(() => '');
  const lib = page.getByRole('button', { name: 'Library (about the game)' });
  if (await lib.count()) {
    await lib.click();
    await page.waitForTimeout(400);
    await shot('library');
    out.libraryText = await page.locator('dialog, #help-dialog, body').innerText().then(t => t.slice(0, 2500)).catch(() => '');
    await page.locator('#close').click().catch(() => {});
    await page.waitForTimeout(200);
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  await page.locator('#menu-btn').click();
  await page.waitForTimeout(500);
  await shot('menu');
  out.menuText = await page.locator('#start-menu').innerText().catch(() => '');

  writeFileSync(join(dir, 'inspect.json'), JSON.stringify(out, null, 2));
  console.log('wrote inspect.json');
} finally {
  await browser.close().catch(() => {});
  release(lockName);
  rmSync(profile, { recursive: true, force: true });
}
