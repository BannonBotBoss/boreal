/**
 * Headless ocean scorecard.
 *
 * Starts the game, opens the orbital planet view, saves PNG screenshots, and
 * scores them against the small reference photos in tests/ocean-scorecard.
 * Does not change the ocean. Rendering uses SwiftShader (software) because
 * this machine has no reliable game GPU.
 *
 *   npx tsx tools/ocean-scorecard.ts
 *
 * Screenshots and the report are written to the artifact folder, and a copy
 * of the report is written to tasks/evidence/T-0222/.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { buildScorecard, readOcean, type RgbaImage, type Scorecard } from '../tests/ocean-scorecard/metric.ts';
import { PNG } from 'pngjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REF = join(ROOT, 'tests/ocean-scorecard/references');
const ART = process.env.OCEAN_SCORECARD_OUT ?? '/opt/cursor/artifacts/ocean-scorecard';
const EVIDENCE = join(ROOT, 'tasks/evidence/T-0222');
const PORT = Number(process.env.OCEAN_SCORECARD_PORT ?? 5173);
const BASE = `http://127.0.0.1:${PORT}`;

function loadPng(path: string): RgbaImage {
  const png = PNG.sync.read(readFileSync(path));
  return { width: png.width, height: png.height, rgba: png.data };
}

function plainReport(card: Scorecard, shots: string[], renderer: string, extra: string[] = []) {
  const lines = [
    card.title,
    '',
    'This is a rough first check. A person, or a vision model later, still has to look at the pictures.',
    card.passRule,
    card.passed ? 'Result: every element reached 75, so this scorecard passes.' : 'Result: the scorecard does not pass. At least one element is under 75, or a picture was missing.',
    card.composite == null ? 'Average of the measured elements: not available.' : `Average of the measured elements (does not pass anything by itself): ${card.composite}.`,
    '',
    `Pictures were taken with ${renderer}.`,
    '',
  ];
  for (const e of card.elements) {
    lines.push(`${e.name}: ${e.score == null ? 'not measured' : e.score + ' out of 100'} — ${e.pass ? 'passes' : 'does not pass'}`);
    lines.push(e.summary);
    lines.push('');
  }
  lines.push('Calibration of the colour score: ' + card.calibration.note);
  lines.push(`Same picture against itself: ${card.calibration.knownMatch}. Brown against blue: ${card.calibration.knownMismatch}.`);
  lines.push('');
  lines.push('Screenshots:');
  for (const s of shots) lines.push(s);
  lines.push('');
  if (extra.length) { lines.push('Notes:'); for (const n of extra) lines.push(n); lines.push(''); }
  lines.push('Still to do: a vision model should judge visual likeness. The numbers above are only the rough metric.');
  return lines.join('\n');
}

async function waitForServer(url: string, child: ChildProcess) {
  const deadline = Date.now() + 40000;
  let last = '';
  while (Date.now() < deadline) {
    if (child.exitCode != null) throw new Error(`The dev server exited (${child.exitCode}). ${last}`);
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 404) return;
    } catch (e) { last = e instanceof Error ? e.message : String(e); }
    await new Promise(r => setTimeout(r, 400));
  }
  throw new Error(`The dev server did not answer. ${last}`);
}

async function shoot(page: import('playwright-core').Page, name: string, url: string) {
  const errors: string[] = [];
  const onError = (t: string) => { if (errors.length < 8) errors.push(t.slice(0, 300)); };
  page.removeAllListeners('pageerror');
  page.removeAllListeners('console');
  page.on('pageerror', e => onError(String(e)));
  page.on('console', m => { if (m.type() === 'error') onError(m.text()); });
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  let ready = false;
  const deadline = Date.now() + 70000;
  while (Date.now() < deadline) {
    ready = await page.evaluate(() => {
      const g = (window as unknown as { __globe?: { bootSettled?: boolean; stats?: () => { drawn: number; queued: number } } }).__globe;
      if (!g?.stats || !g.bootSettled) return false;
      const s = g.stats();
      return s.drawn > 8 && s.queued === 0;
    }).catch(() => false);
    if (ready) break;
    await page.waitForTimeout(1500);
  }
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    for (const sel of ['#camera-panel', '#globe-layers', '[data-debug]', '#loading', '#status']) {
      document.querySelectorAll(sel).forEach(el => { (el as HTMLElement).style.visibility = 'hidden'; });
    }
  }).catch(() => undefined);
  const path = join(ART, `${name}.png`);
  await page.screenshot({ path });
  const info = await page.evaluate(() => {
    const g = (window as unknown as { __globe?: { stats?: () => unknown; planet?: { sampleSurface: (d: number[]) => { kind: string; h: number } } } }).__globe;
    let ocean: { lat: number; lon: number; h: number } | null = null;
    const planet = g?.planet;
    if (planet) {
      const n = 1200;
      for (let k = 0; k < n; k++) {
        const y = 1 - (k + 0.5) * 2 / n;
        const rad = Math.sqrt(Math.max(0, 1 - y * y));
        const phi = Math.PI * (1 + Math.sqrt(5)) * k;
        const d = [Math.cos(phi) * rad, y, Math.sin(phi) * rad];
        const s = planet.sampleSurface(d);
        const lat = Math.asin(Math.max(-1, Math.min(1, d[1]))) * 180 / Math.PI;
        const lon = Math.atan2(d[2], d[0]) * 180 / Math.PI;
        if (s.kind === 'ocean' && s.h < -800 && Math.abs(lat) < 30) { ocean = { lat, lon, h: s.h }; break; }
      }
    }
    return { ready: true, stats: g?.stats?.() ?? null, ocean, href: location.href };
  }).catch(e => ({ ready: false, stats: null, ocean: null, href: url, error: String(e) }));
  console.log(name, ready ? 'ready' : 'NOT READY', JSON.stringify(info));
  if (errors.length) console.log(name, 'page errors', errors);
  return { path, ready, info, errors };
}

async function main() {
  mkdirSync(ART, { recursive: true });
  mkdirSync(EVIDENCE, { recursive: true });
  const vite = spawn('npx', ['vite', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'], {
    cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'],
  });
  vite.stdout?.on('data', d => process.stdout.write(d));
  vite.stderr?.on('data', d => process.stderr.write(d));
  const shots: string[] = [];
  let renderer = 'SwiftShader software rendering (Chrome ANGLE)';
  try {
    await waitForServer(BASE, vite);
    const browser = await chromium.launch({
      executablePath: process.env.CHROME ?? '/usr/bin/google-chrome',
      args: [
        '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
        '--ignore-gpu-blocklist', '--no-sandbox', '--disable-dev-shm-usage',
        '--disable-extensions', '--no-first-run',
      ],
    });
    const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
    const orbitUrl = `${BASE}/?view=globe&shot=1&tier=3&hour=15&panel=0`;
    const orbit = await shoot(page, 'orbit', orbitUrl);
    shots.push(orbit.path);
    const ocean = (orbit.info as { ocean?: { lat: number; lon: number } | null }).ocean;
    const lat = ocean?.lat ?? 10;
    const lon = ocean?.lon ?? -140;
    const glintUrl = `${BASE}/?view=globe&shot=1&tier=3&hour=12&panel=0&latlon=${lat.toFixed(2)},${lon.toFixed(2)}&alt=700000&pitch=22`;
    const glint = await shoot(page, 'sunglint-view', glintUrl);
    shots.push(glint.path);
    const closeUrl = `${BASE}/?view=globe&shot=1&tier=3&hour=12&panel=0&latlon=${lat.toFixed(2)},${lon.toFixed(2)}&alt=12000&pitch=0`;
    const close = await shoot(page, 'ocean-close', closeUrl);
    shots.push(close.path);
    const gpu = await page.evaluate(() => {
      const c = document.querySelector('canvas');
      const gl = c?.getContext('webgl2') ?? c?.getContext('webgl');
      const ext = gl?.getExtension('WEBGL_debug_renderer_info');
      return ext && gl ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
    }).catch(() => '');
    if (gpu) renderer = `SwiftShader software rendering (${gpu})`;
    await browser.close();

    const closeImg = loadPng(close.path);
    const closeOcean = readOcean(closeImg, { y0: 0.35, y1: 1 }).ocean;
    const notes: string[] = [];
    // A low pass that is still loading draws blocks, not water. Do not score that frame as a colour.
    const closeUsable = closeOcean >= 50;
    if (!closeUsable) notes.push('The 12 km picture did not finish drawing (tiles were still loading, or no blue water was found). It is saved so you can see that, and it is not used for the open-water colour score.');
    const card = buildScorecard({
      orbit: loadPng(orbit.path),
      apollo: loadPng(join(REF, 'apollo17-blue-marble.png')),
      pacific: loadPng(join(REF, 'blue-marble-pacific.png')),
      glintView: loadPng(glint.path),
      sunglint: loadPng(join(REF, 'sunglint-aegean.png')),
      close: closeUsable ? closeImg : null,
      caribbean: loadPng(join(REF, 'caribbean-deep-blue.png')),
    });
    const report = {
      ...card,
      renderer,
      notes,
      screenshots: { orbit: orbit.path, sunglintView: glint.path, oceanClose: close.path },
      capture: { orbitReady: orbit.ready, glintReady: glint.ready, closeReady: close.ready, closeOceanPixels: closeOcean, oceanPoint: ocean ?? null },
    };
    const text = plainReport(card, shots, renderer, notes);
    writeFileSync(join(ART, 'scorecard.json'), JSON.stringify(report, null, 2));
    writeFileSync(join(ART, 'scorecard.txt'), text);
    writeFileSync(join(EVIDENCE, 'scorecard.json'), JSON.stringify(report, null, 2));
    writeFileSync(join(EVIDENCE, 'scorecard.txt'), text);
    console.log('\n' + text);
  } finally {
    vite.kill('SIGTERM');
    vite.unref();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
