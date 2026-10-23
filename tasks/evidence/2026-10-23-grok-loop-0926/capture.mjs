// T-0055 recheck. Follow camera only. Never press P (photo mode flew away from the trunk).
// Steer into jack pine 3:4:10, then frame the body and the trunk from the side and from above.
import { chromium } from 'playwright-core';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquire, release, track } from '../../../tools/bench-lock.mjs';

const dir = dirname(fileURLToPath(import.meta.url));
const base = 'http://127.0.0.1:5173/';
const profile = mkdtempSync(join(tmpdir(), 'grok-loop-0926-'));
const errors = [];
const PINE = { key: '3:4:10', x: 141.8997, z: 196.983, r: 0.153 };
const lockName = 'grok: loop 0926 tree';

if (!(await acquire(lockName, { waitMs: 20000, pollMs: 1000 }))) {
  console.error('bench lock not acquired');
  process.exit(1);
}

const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/usr/local/bin/google-chrome',
  headless: true,
  args: [
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist', '--disable-dev-shm-usage', '--no-sandbox',
    '--disable-extensions', '--no-first-run', '--autoplay-policy=no-user-gesture-required',
  ],
});
const proc = typeof browser.process === 'function' ? browser.process() : null;
if (proc?.pid) track(proc.pid);
const context = await browser.newContext({
  viewport: { width: 960, height: 540 },
  recordVideo: { dir, size: { width: 960, height: 540 } },
});
const page = await context.newPage();
page.on('pageerror', e => errors.push(String(e).slice(0, 300)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 240)); });

const out = { pine: PINE, shots: [], errors, photo: [] };

function wrap(yaw) {
  while (yaw > Math.PI) yaw -= Math.PI * 2;
  while (yaw < -Math.PI) yaw += Math.PI * 2;
  return yaw;
}

async function read() {
  return page.evaluate((pine) => {
    const p = window.__boreal?.player?.() ?? null;
    const frames = window.walkProbe?.frames ?? [];
    const last = frames[frames.length - 1] ?? null;
    const status = document.querySelector('#status')?.textContent ?? '';
    const d = p ? Math.hypot(p.x - pine.x, p.z - pine.z) : null;
    const round = (n) => Math.round(n * 1000) / 1000;
    return {
      href: location.href,
      status: status.slice(0, 160),
      photo: status.includes('PHOTO') || document.body.classList.contains('photo-mode'),
      x: p?.x, z: p?.z, yaw: p?.yaw,
      d: d === null ? null : round(d),
      insideWood: d !== null && d < pine.r,
      drawn: last ? {
        x: round(last.bx), y: round(last.by), z: round(last.bz),
        cx: round(last.cx), cy: round(last.cy), cz: round(last.cz),
        speed: last.speed, phase: last.phase, gait: last.gait,
      } : null,
    };
  }, PINE);
}

async function shot(name) {
  const s = await read();
  if (s.photo) out.photo.push(name);
  await page.screenshot({ path: join(dir, name + '.png') });
  await page.locator('canvas').screenshot({ path: join(dir, name + '-canvas.png') });
  out.shots.push({ name, ...s });
  console.log(name, JSON.stringify({ d: s.d, inside: s.insideWood, yaw: s.yaw, photo: s.photo, cam: s.drawn && [s.drawn.cx, s.drawn.cy, s.drawn.cz], speed: s.drawn?.speed }));
  return s;
}

async function nudge(key, ms) {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
  await page.waitForTimeout(40);
}

async function holdShot(name, key, ms) {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  const s = await shot(name);
  await page.keyboard.up(key);
  await page.waitForTimeout(80);
  return s;
}

async function face(target) {
  for (let i = 0; i < 24; i++) {
    const s = await read();
    const d = wrap(target - s.yaw);
    if (Math.abs(d) < 0.06) return s;
    await nudge(d > 0 ? 'a' : 'd', Math.min(420, Math.abs(d) / 2.2 * 1000 + 30));
  }
  return read();
}

async function goTo(x, z) {
  for (let i = 0; i < 28; i++) {
    const s = await read();
    const dx = x - s.x, dz = z - s.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.07) return s;
    const heading = Math.atan2(-dx, -dz);
    await face(heading);
    await nudge('w', Math.min(480, dist / 2 * 1000 + 40));
  }
  return read();
}

try {
  const url = `${base}?nomenu&bench&rec&stages=1&walkprobe&hour=12&at=141.900,198.283,0`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  const load0 = Date.now();
  for (;;) {
    const gone = await page.locator('#loading').count().then(n => n === 0).catch(() => false);
    if (gone) break;
    if (Date.now() - load0 > 240000) throw new Error('loading still up after 240s');
    await page.waitForTimeout(5000);
    console.log('loading', Math.round((Date.now() - load0) / 1000) + 's', (await page.locator('body').innerText().catch(() => '')).slice(0, 80).replace(/\n/g, ' | '));
  }
  console.log('loaded in', Math.round((Date.now() - load0) / 1000) + 's');
  await page.waitForTimeout(4000);
  if (!page.url().startsWith(base)) throw new Error('unexpected url ' + page.url());
  await page.mouse.click(480, 270);
  out.start = await shot('pine-start');

  out.placed = await page.evaluate(async () => {
    const world = await import('/src/core/world.ts');
    const pop = await import('/src/core/population.ts');
    const trees = await import('/src/render/trees.ts');
    const stages = await import('/src/core/stages/elevation.ts');
    stages.STAGES.on = true;
    const raw = world.generateChunk(3, 4);
    const placed = pop.applyPopulation(raw, 3, 4);
    const one = (e) => {
      const id = trees.treeSpecies(e.seed, e.x, e.z);
      const dims = trees.treeDims(e.seed, e.x, e.z);
      return {
        key: e.key,
        species: typeof id === 'string' ? id : id?.id,
        x: e.x, z: e.z, scale: e.scale,
        baseRadius: (dims.trunkRadius ?? 0) * e.scale,
      };
    };
    const t = raw.find(e => e.key === '3:4:10');
    return { kept: placed.some(e => e.key === '3:4:10'), tree: t ? one(t) : null };
  });
  console.log('placed', JSON.stringify(out.placed));

  await page.keyboard.down('w');
  out.walk = [out.start];
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(250);
    const s = await read();
    out.walk.push(s);
    console.log('walk', i, s.d, s.insideWood, s.drawn?.speed);
    if (s.d !== null && s.d < PINE.r) break;
  }
  await page.keyboard.up('w');
  await page.waitForTimeout(200);
  out.overlapRear = await shot('pine-overlap-follow');
  out.overlapAbove = await holdShot('pine-overlap-above', 'ArrowDown', 900);

  // East of the trunk, facing north: follow camera sits south and sees the trunk beside the flank.
  out.beside = await goTo(PINE.x + 0.55, PINE.z);
  await face(0);
  await page.waitForTimeout(250);
  out.besideRear = await shot('pine-beside-follow');
  out.besideSide = await holdShot('pine-beside-side', 'ArrowLeft', 700);
  await face(0);
  out.besideAbove = await holdShot('pine-beside-above', 'ArrowDown', 900);

  // On the axis again, turned so the camera is east of the body (a true side of the pair).
  out.returnAxis = await goTo(PINE.x, PINE.z);
  await face(-Math.PI / 2);
  await page.waitForTimeout(250);
  out.axisSide = await shot('pine-axis-side');
  out.axisAbove = await holdShot('pine-axis-above', 'ArrowDown', 900);
} finally {
  out.errors = errors.slice(0, 30);
  try { out.url = page.url(); } catch { /* already closed */ }
  const video = page.video();
  try { await context.close(); } catch (e) { out.closeError = String(e).slice(0, 200); }
  try { await browser.close(); } catch { /* already closed */ }
  if (video) {
    try {
      const { renameSync } = await import('node:fs');
      renameSync(await video.path(), join(dir, 'walk.webm'));
      out.video = 'walk.webm';
    } catch (e) { out.videoError = String(e); }
  }
  writeFileSync(join(dir, 'capture.json'), JSON.stringify(out, null, 2));
  rmSync(profile, { recursive: true, force: true });
  release(lockName);
}
console.log('done', out.shots.map(s => s.name).join(','), 'photo', out.photo);
