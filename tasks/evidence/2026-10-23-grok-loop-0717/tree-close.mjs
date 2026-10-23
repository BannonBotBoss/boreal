// Follow-up: put the wolf on spruce 3:4:1. The first walk stopped 1.03 m short.
// Trunk base radius is 0.160 m at scale (treeDims trunkRadius 0.119 × scale 1.346).
import { chromium } from 'playwright-core';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquire, release, track } from '../../../tools/bench-lock.mjs';

const dir = dirname(fileURLToPath(import.meta.url));
const base = 'http://127.0.0.1:5173/';
const profile = mkdtempSync(join(tmpdir(), 'grok-loop-0717-tree-'));
const errors = [];
const TREE = { x: 146.7723066918552, z: 198.8493807706982, r: 0.16015470691130818 };
const lockName = 'grok: loop 0717 tree';
const q = (extra) => `${base}?nomenu&bench&rec&stages=1&walkprobe&hour=12&${extra}`;

if (!(await acquire(lockName, { waitMs: 20000, pollMs: 1000 }))) {
  console.error('bench lock not acquired');
  process.exit(1);
}

const context = await chromium.launchPersistentContext(profile, {
  executablePath: process.env.CHROME ?? '/usr/bin/google-chrome',
  headless: true,
  viewport: { width: 960, height: 540 },
  args: [
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist', '--disable-dev-shm-usage', '--no-sandbox',
    '--disable-extensions', '--no-first-run', '--autoplay-policy=no-user-gesture-required',
  ],
});
const browser = context.browser();
if (browser?.process()?.pid) track(browser.process().pid);
const page = context.pages()[0] ?? await context.newPage();
page.on('pageerror', e => errors.push(String(e).slice(0, 300)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 240)); });

async function settle(url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForSelector('#loading', { state: 'detached', timeout: 180000 });
  await page.waitForTimeout(5000);
  if (!page.url().startsWith(base)) throw new Error('unexpected url ' + page.url());
  await page.mouse.click(480, 270);
  await page.waitForTimeout(200);
}

async function sample() {
  return page.evaluate(async (tree) => {
    const p = window.__boreal?.player?.() ?? null;
    const frames = window.walkProbe?.frames ?? [];
    const last = frames.length ? frames[frames.length - 1] : null;
    const d = p ? Math.hypot(p.x - tree.x, p.z - tree.z) : null;
    return {
      href: location.href,
      status: document.querySelector('#status')?.textContent?.slice(0, 24) ?? '',
      x: p?.x, z: p?.z, yaw: p?.yaw,
      d: d === null ? null : Math.round(d * 1000) / 1000,
      inside: d !== null && d < tree.r,
      drawn: last ? { x: Math.round(last.bx * 1000) / 1000, y: Math.round(last.by * 1000) / 1000, z: Math.round(last.bz * 1000) / 1000, speed: last.speed } : null,
    };
  }, TREE);
}

const out = { tree: TREE, blockTrunk: 0.7, shots: [] };
try {
  await settle(q('at=146.772,198.849,0'));
  out.onTrunk = await sample();
  const onFile = join(dir, 'tree-on-trunk.png');
  await page.screenshot({ path: onFile });
  out.shots.push('tree-on-trunk');
  console.log('on trunk', JSON.stringify(out.onTrunk));

  await settle(q('at=146.772,199.85,0'));
  out.walkStart = await sample();
  await page.screenshot({ path: join(dir, 'tree-walk-start.png') });
  await page.keyboard.down('w');
  out.walk = [out.walkStart];
  for (let i = 0; i < 14; i++) {
    await page.waitForTimeout(1000);
    const s = await sample();
    out.walk.push(s);
    console.log('walk', i, s.d, s.inside, s.drawn && s.drawn.speed);
    if (s.d !== null && s.d < 0.05) break;
  }
  await page.keyboard.up('w');
  out.walkEnd = out.walk[out.walk.length - 1];
  await page.screenshot({ path: join(dir, 'tree-walk-end.png') });
  out.shots.push('tree-walk-start', 'tree-walk-end');
} finally {
  out.errors = errors;
  writeFileSync(join(dir, 'tree-close.json'), JSON.stringify(out, null, 2));
  await context.close();
  rmSync(profile, { recursive: true, force: true });
  release(lockName);
}
console.log('EXIT', out.walkEnd && out.walkEnd.d, 'inside-start', out.onTrunk && out.onTrunk.inside);
