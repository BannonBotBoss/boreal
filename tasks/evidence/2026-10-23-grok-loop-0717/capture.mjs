// Headless Chrome for the 2026-10-23 07:17 PT loop.
// Water entry, spruce trunk, a dry slope, dusk and night. Vite on 127.0.0.1:5173.
import { chromium } from 'playwright-core';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { acquire, release, track } from '../../../tools/bench-lock.mjs';

const dir = dirname(fileURLToPath(import.meta.url));
const base = 'http://127.0.0.1:5173/';
const profile = mkdtempSync(join(tmpdir(), 'grok-loop-0717-'));
const errors = [];
const shots = [];
const lockName = 'grok: loop 0717';

function sunBlob(file) {
  const png = PNG.sync.read(readFileSync(file));
  let n = 0, sx = 0, sy = 0, sky = 0, skyN = 0, ground = 0, groundN = 0, bright = 0;
  const skyCut = Math.floor(png.height * 0.45);
  for (let y = 0; y < png.height; y += 2) for (let x = 0; x < png.width; x += 2) {
    const i = (y * png.width + x) * 4;
    const r = png.data[i], g = png.data[i + 1], b = png.data[i + 2];
    const v = 0.299 * r + 0.587 * g + 0.114 * b;
    if (y < skyCut) { sky += v; skyN++; } else { ground += v; groundN++; }
    if (r > 230 && g > 200 && b > 150 && y < png.height * 0.85) { n++; sx += x; sy += y; if (v > 245) bright++; }
  }
  return {
    skyLuma: skyN ? +(sky / skyN).toFixed(1) : null,
    groundLuma: groundN ? +(ground / groundN).toFixed(1) : null,
    blob: n > 8 ? { n, x: +(sx / n).toFixed(1), y: +(sy / n).toFixed(1), bright } : null,
  };
}

/** Predicted sun-disk pixel for a vertical fov, a centre-ray elevation, and the sun elevation. */
function predictSun(sunElDeg, centreElDeg, width, height, fovDeg = 48) {
  const off = (sunElDeg - centreElDeg) * Math.PI / 180;
  const half = Math.tan(fovDeg * Math.PI / 360);
  const ndc = Math.tan(off) / half;
  return { x: width / 2, y: +(height / 2 - ndc * height / 2).toFixed(1), inFrame: Math.abs(ndc) < 1 };
}

const q = (extra) => `${base}?nomenu&bench&rec&stages=1&walkprobe&${extra}`;

if (!(await acquire(lockName, { waitMs: 15000, pollMs: 1000 }))) {
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
page.on('pageerror', e => errors.push(String(e).slice(0, 400)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });

async function shot(name) {
  const file = join(dir, name + '.png');
  await page.screenshot({ path: file });
  shots.push({ name, ...sunBlob(file), url: page.url() });
  console.log('shot', name, page.url());
  return file;
}

async function settle(url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForSelector('#loading', { state: 'detached', timeout: 180000 });
  await page.waitForTimeout(6000);
  if (!page.url().startsWith(base)) throw new Error('unexpected url ' + page.url());
  await page.mouse.click(480, 270);
  await page.waitForTimeout(300);
}

async function sample() {
  return page.evaluate(async () => {
    const p = window.__boreal?.player?.() ?? null;
    const world = await import('/src/core/world.ts');
    const tuning = await import('/src/core/tuning.ts');
    const surfaceMod = await import('/src/core/stages/surfaceAt.ts');
    const pbr = await import('/src/render/pbr.ts');
    const tod = await import('/src/core/timeOfDay.ts');
    if (!p) return { href: location.href, status: document.querySelector('#status')?.textContent ?? '' };
    const h = world.heightAt(p.x, p.z);
    const s = surfaceMod.surfaceAt(p.x, p.z);
    const waterY = s.lake ? s.lake.surface : (h < tuning.LEVEL.waterSurface ? tuning.LEVEL.waterSurface : null);
    const frames = window.walkProbe?.frames ?? [];
    const last = frames.length ? frames[frames.length - 1] : null;
    let camH = null;
    if (last) camH = world.heightAt(last.cx, last.cz);
    const sun = tod.sunPosition(tod.hourAt(0));
    return {
      href: location.href,
      status: document.querySelector('#status')?.textContent ?? '',
      player: p,
      h: Math.round(h * 1000) / 1000,
      waterY,
      depth: waterY === null ? 0 : Math.round((waterY - h) * 1000) / 1000,
      drawnY: last ? Math.round(last.by * 1000) / 1000 : null,
      speed: last ? Math.round(last.speed * 100) / 100 : null,
      cam: last ? { x: Math.round(last.cx * 100) / 100, y: Math.round(last.cy * 100) / 100, z: Math.round(last.cz * 100) / 100, ground: Math.round(camH * 1000) / 1000 } : null,
      lux: Math.round(pbr.LIGHTING.lux * 1000) / 1000,
      Esun: Math.round(pbr.LIGHTING.Esun * 10) / 10,
      Emoon: Math.round(pbr.LIGHTING.Emoon * 10000) / 10000,
      gain: Math.round(pbr.LIGHTING.gain * 100) / 100,
      sunEl: Math.round(sun.elevation * 1000) / 1000,
      sunAz: Math.round(sun.azimuth * 100) / 100,
      hour: document.querySelector('#status')?.textContent?.slice(0, 5) ?? '',
    };
  });
}

const pages = {};
try {
  // Shore, then walk the heading from scout.json into the lake.
  const waterUrl = q('hour=12&at=175.67,281.69,3.534');
  await settle(waterUrl);
  pages.waterStart = await sample();
  console.log('water start', JSON.stringify(pages.waterStart));
  await shot('water-shore');
  await page.keyboard.down('w');
  const waterTrail = [pages.waterStart];
  for (let i = 0; i < 24; i++) {
    await page.waitForTimeout(2000);
    const s = await sample();
    waterTrail.push(s);
    console.log('water', i, s.player && s.player.x, s.h, s.depth, s.drawnY, s.speed);
    if (s.depth >= 0.7) break;
  }
  await page.keyboard.up('w');
  pages.waterEnd = waterTrail[waterTrail.length - 1];
  pages.waterTrail = waterTrail.map(s => ({ x: s.player?.x, z: s.player?.z, h: s.h, waterY: s.waterY, depth: s.depth, drawnY: s.drawnY, speed: s.speed, cam: s.cam }));
  await shot('water-in');

  // Spruce trunk. Walk from 5 m south of 146.77, 198.85.
  const treeUrl = q('hour=12&at=146.77,203.85,0');
  await settle(treeUrl);
  pages.treeStart = await sample();
  await shot('tree-before');
  await page.keyboard.down('w');
  let best = { d: 99 };
  const treeTrail = [];
  for (let i = 0; i < 16; i++) {
    await page.waitForTimeout(1000);
    const s = await sample();
    const d = s.player ? Math.hypot(s.player.x - 146.77, s.player.z - 198.85) : 99;
    treeTrail.push({ x: s.player?.x, z: s.player?.z, d: Math.round(d * 100) / 100, h: s.h, drawnY: s.drawnY, speed: s.speed });
    if (d < best.d) best = { d: Math.round(d * 100) / 100, ...s.player, h: s.h, drawnY: s.drawnY };
    console.log('tree', i, d.toFixed(2), s.speed);
    if (s.player && s.player.z < 196) break;
  }
  await page.keyboard.up('w');
  pages.tree = { closest: best, trail: treeTrail };
  await shot('tree-through');

  // Steepest dry grade from the scout (0.165), heading east.
  const slopeUrl = q('hour=12&at=144,236,-1.571');
  await settle(slopeUrl);
  pages.slopeStart = await sample();
  await shot('slope-before');
  await page.keyboard.down('w');
  const slopeTrail = [];
  for (let i = 0; i < 8; i++) {
    await page.waitForTimeout(1500);
    const s = await sample();
    slopeTrail.push({ x: s.player?.x, z: s.player?.z, h: s.h, drawnY: s.drawnY, speed: s.speed, cam: s.cam });
    console.log('slope', i, s.h, s.drawnY, s.cam);
  }
  await page.keyboard.up('w');
  pages.slope = slopeTrail;
  await shot('slope-after');

  // Dusk, local-solar sunset hour 19.16, facing the sun (yaw 1.180). Default pitch, no look keys.
  const duskUrl = q('hour=19.16&at=200,250,1.180');
  await settle(duskUrl);
  await page.waitForTimeout(2000);
  pages.dusk = await sample();
  console.log('dusk', JSON.stringify(pages.dusk));
  await shot('dusk-sunset');

  const civilUrl = q('hour=19.85&at=200,250,1.180');
  await settle(civilUrl);
  await page.waitForTimeout(1500);
  pages.civil = await sample();
  console.log('civil', JSON.stringify(pages.civil));
  await shot('dusk-civil');

  const nightUrl = q('hour=22&at=200,250,1.180');
  await settle(nightUrl);
  await page.waitForTimeout(1500);
  pages.night = await sample();
  console.log('night', JSON.stringify(pages.night));
  await shot('night');
  // Look up so the sky, not the wolf, fills the upper frame. ArrowUp is lookUp.
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(1500);
  await page.keyboard.up('ArrowUp');
  await page.waitForTimeout(400);
  pages.nightUp = await sample();
  await shot('night-up');
} finally {
  await page.keyboard.up('w').catch(() => {});
  await page.keyboard.up('ArrowUp').catch(() => {});
  await context.close().catch(() => {});
  release(lockName);
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}

const predict = {
  dusk: predictSun(pages.dusk?.sunEl ?? 0, -10, 960, 540),
  civil: predictSun(pages.civil?.sunEl ?? -6, -10, 960, 540),
  night: predictSun(pages.night?.sunEl ?? -21, -10, 960, 540),
  noonMismatch: predictSun(54.801, -10, 960, 540),
};
writeFileSync(join(dir, 'capture.json'), JSON.stringify({
  commit: process.env.CAPTURE_COMMIT ?? '',
  viewport: [960, 540],
  fovDeg: 48,
  centreElDeg: -10,
  note: 'Centre elevation is -defaultPitchDeg while no look key is held (systemProperties camera.defaultPitchDeg 10).',
  shots, pages, predict, errors: errors.slice(0, 30),
}, null, 2));
console.log('done shots', shots.map(s => s.name).join(','));
console.log('errors', errors.length);
