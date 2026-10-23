// T-0055 recheck. The 07:17 point is jack pine 3:4:1, dropped by applyPopulation.
// The placed trunk is jack pine 3:4:10. Side camera is photo mode, so the follow
// camera is not hiding the wood inside the wolf.
import { chromium } from 'playwright-core';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquire, release, track } from '../../../tools/bench-lock.mjs';

const dir = dirname(fileURLToPath(import.meta.url));
const base = 'http://127.0.0.1:5173/';
const profile = mkdtempSync(join(tmpdir(), 'grok-loop-0817-'));
const errors = [];
const PHANTOM = { key: '3:4:1', x: 146.7723066918552, z: 198.8493807706982, species: 'jack-pine', placed: false, r: 0.16015470691130818 };
const PINE = { key: '3:4:10', x: 141.8997, z: 196.983, species: 'jack-pine', placed: true, r: 0.153 };
const lockName = 'grok: loop 0817 tree';
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
  await page.waitForTimeout(10000);
  if (!page.url().startsWith(base)) throw new Error('unexpected url ' + page.url());
  await page.mouse.click(480, 270);
  await page.waitForTimeout(300);
}

async function sample(tree) {
  return page.evaluate((tree) => {
    const p = window.__boreal?.player?.() ?? null;
    const frames = window.walkProbe?.frames ?? [];
    const last = frames.length ? frames[frames.length - 1] : null;
    const d = p ? Math.hypot(p.x - tree.x, p.z - tree.z) : null;
    const round = (n) => Math.round(n * 1000) / 1000;
    return {
      href: location.href,
      status: document.querySelector('#status')?.textContent?.slice(0, 80) ?? '',
      x: p?.x, z: p?.z, yaw: p?.yaw,
      d: d === null ? null : round(d),
      insideWood: d !== null && d < tree.r,
      drawn: last ? { x: round(last.bx), y: round(last.by), z: round(last.bz), cx: round(last.cx), cy: round(last.cy), cz: round(last.cz), speed: last.speed } : null,
    };
  }, tree);
}

async function shot(name) {
  const file = join(dir, name + '.png');
  await page.locator('canvas').screenshot({ path: file });
  return name;
}

async function cam() {
  return page.evaluate(() => {
    const frames = window.walkProbe?.frames ?? [];
    const last = frames[frames.length - 1];
    const p = window.__boreal?.player?.() ?? null;
    return last && p ? { px: p.x, pz: p.z, cx: last.cx, cy: last.cy, cz: last.cz } : null;
  });
}

async function nudge(key, ms) {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
  await page.waitForTimeout(80);
}

/** Photo mode, camera ~5 m east of the wolf, looking west, about chest height. */
async function sideView() {
  await page.keyboard.press('p');
  await page.waitForFunction(() => (document.querySelector('#status')?.textContent ?? '').includes('PHOTO'), { timeout: 8000 });
  await page.waitForTimeout(400);
  for (let i = 0; i < 40; i++) {
    const c = await cam();
    if (!c) break;
    const ez = c.cz - c.pz;
    const ex = c.cx - (c.px + 5);
    if (Math.abs(ez) < 0.35 && Math.abs(ex) < 0.35) break;
    if (Math.abs(ez) >= 0.35) await nudge(ez > 0 ? 'w' : 's', Math.min(700, Math.abs(ez) / 6 * 1000 + 80));
    else await nudge(ex > 0 ? 'a' : 'd', Math.min(700, Math.abs(ex) / 6 * 1000 + 80));
  }
  const box = await page.locator('canvas').boundingBox();
  const x0 = box.x + 780, y0 = box.y + 270;
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  await page.mouse.move(x0 - 393, y0 - 40, { steps: 25 });
  await page.mouse.up();
  await page.waitForTimeout(500);
  return cam();
}

const out = { phantom: PHANTOM, pine: PINE, shots: [], note: '3:4:1 is removed by applyPopulation (keep roll 0.952 > treeMult 0.45). 3:4:10 is the placed jack pine.' };
try {
  await settle(q('at=146.772,198.849,0'));
  out.phantomFollow = await sample(PHANTOM);
  out.phantomToPine = await sample(PINE);
  out.shots.push(await shot('phantom-follow'));
  out.phantomSideCam = await sideView();
  out.phantomSide = await sample(PHANTOM);
  out.shots.push(await shot('phantom-side'));
  console.log('phantom', JSON.stringify({ follow: out.phantomFollow, sideCam: out.phantomSideCam }));

  await settle(q('at=141.900,198.183,0'));
  out.pineStart = await sample(PINE);
  out.shots.push(await shot('pine-start'));
  await page.keyboard.down('w');
  out.walk = [out.pineStart];
  for (let i = 0; i < 16; i++) {
    await page.waitForTimeout(500);
    const s = await sample(PINE);
    out.walk.push(s);
    console.log('walk', i, s.d, s.insideWood, s.drawn && s.drawn.speed);
    if (s.d !== null && s.d < PINE.r) break;
  }
  await page.keyboard.up('w');
  out.pineInside = out.walk[out.walk.length - 1];
  out.shots.push(await shot('pine-inside-follow'));
  out.pineSideCam = await sideView();
  out.pineSide = await sample(PINE);
  out.shots.push(await shot('pine-inside-side'));
  console.log('pine inside', JSON.stringify(out.pineInside));
  console.log('pine side cam', JSON.stringify(out.pineSideCam));
} finally {
  out.errors = errors;
  out.url = page.url();
  writeFileSync(join(dir, 'capture.json'), JSON.stringify(out, null, 2));
  await context.close();
  rmSync(profile, { recursive: true, force: true });
  release(lockName);
}
console.log('EXIT shots', out.shots.join(','));
