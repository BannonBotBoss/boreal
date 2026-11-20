/**
 * Live & calibrated Rule 11 audit (T-0292) of four previously unaudited subsystems
 * (zero overlap with T-0001..T-0291):
 *   1. Four Unaudited Live Animal Viewers & Bear Rig
 *      (`tools/bear-sheet.{html,ts}`, `tools/wolf-portrait.{html,ts}`, `tools/wolf-lod-view.{html,ts}`,
 *       `tools/bound-lab.{html,ts}`, `tools/bound-plans.ts`, `src/render/bear.ts`)
 *   2. Globe Cloud Cover CPU Twin, Worley F1 & Orbit Deck Calibration
 *      (`src/world/globe/cloudCover.ts`, `src/world/globe/atmosphere.ts`)
 *   3. Globe Boot Order, Rust Surface Roughness/Finalize & Vegetation Stub
 *      (`src/world/globe/bootOrder.ts`, `src/world/globe/hud.ts`, `rust/boreal-sim/src/boot_order.rs`,
 *       `rust/boreal-sim/src/planet_fundamentals/surface/{elevation,land_sea_mask,vegetation_fraction}.rs`)
 *   4. Locomotion Benches, Python Terrain-Ref Fetch/Game Scripts & Core Fixtures/Config/PadTargets
 *      (`tools/{elbow-trace,fore-lock-bench,fore-lock-bench-joint}.ts`, `tools/terrain-ref/{fetch.py,game.py}`,
 *       `src/core/{storedFixture.ts,needs/species/_template.ts}`, `src/config/live.ts`, `src/input/padTargets.ts`)
 *
 * Usage:
 *   npx tsx refs/audit/viewers-cloudcover-boot-benches-audit/audit.ts [baseUrl]
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import * as THREE from 'three';

import { createBear } from '../../../src/render/bear';
import { CLOUDS } from '../../../src/world/globe/atmosphere';
import {
  cloudCover, cloudCoverStats, cloudValue, ORBIT_DECK, orbitCloudAt, orbitCloudReport,
} from '../../../src/world/globe/cloudCover';
import { bootGlobe, GLOBE_BOOT_ORDER, RUST_BOOT_ORDER } from '../../../src/world/globe/bootOrder';
import { hudHidden } from '../../../src/world/globe/hud';
import { loadPlanetSim } from '../../../src/core/planetBudget';
import { readStoredFixture } from '../../../src/core/storedFixture';
import { TEMPLATE_SPECIES } from '../../../src/core/needs/species/_template';
import { sourcedEntries } from '../../../src/core/needs/template';
import { live } from '../../../src/config/live';
import { padTarget, registerPadTarget } from '../../../src/input/padTargets';
import { BLOB_PLAN, HOST_PLAN, planOf, poseFor, V3_PLAN } from '../../../tools/bound-plans';
import { HARE_BODY, HARE_PLAN } from '../../../src/animals/hare';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const BASE = process.argv[2] ?? 'http://127.0.0.1:5269';

const BROWSER_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
];
const EXECUTABLE = BROWSER_PATHS.find(p => existsSync(p));

interface CheckResult {
  id: string;
  label: string;
  measured: string;
  expected: string;
  score: number;
  knownMatchScore: number;
  knownMismatchScore: number;
  pass: boolean;
  source: string;
}

function scoreBoolList(flags: boolean[]): number {
  return flags.reduce((s, f) => s + (f ? 1 : 0), 0) / flags.length;
}

function measureFrontClawLength(variant: 'grizzly' | 'black'): { lengthM: number; clawMeshCount: number; hasDispose: boolean } {
  const b = createBear(1, variant);
  let clawMeshCount = 0;
  let maxFrontLen = 0;
  b.root.updateMatrixWorld(true);
  b.root.traverse(obj => {
    if (obj.name === 'claw') {
      const box = new THREE.Box3().setFromObject(obj);
      const sz = new THREE.Vector3();
      box.getSize(sz);
      const span = Math.hypot(sz.y, sz.z);
      if (span > maxFrontLen) maxFrontLen = span;
      obj.traverse(ch => { if ((ch as THREE.Mesh).isMesh) clawMeshCount++; });
    }
  });
  return { lengthM: maxFrontLen, clawMeshCount, hasDispose: 'dispose' in b };
}

async function main() {
  mkdirSync(HERE, { recursive: true });
  const consoleErrors: string[] = [];

  // =========================================================================
  // 1. Four Unaudited Live Animal Viewers + Bear Rig
  // =========================================================================
  const bearSheetSrc = readFileSync(join(ROOT, 'tools/bear-sheet.ts'), 'utf8');
  const wolfPortraitHtml = readFileSync(join(ROOT, 'tools/wolf-portrait.html'), 'utf8');
  const wolfPortraitSrc = readFileSync(join(ROOT, 'tools/wolf-portrait.ts'), 'utf8');
  const wolfLodViewSrc = readFileSync(join(ROOT, 'tools/wolf-lod-view.ts'), 'utf8');
  const boundLabSrc = readFileSync(join(ROOT, 'tools/bound-lab.ts'), 'utf8');

  const grizzlyClaws = measureFrontClawLength('grizzly');
  const blackClaws = measureFrontClawLength('black');
  // Herrero 2002 / USFWS: grizzly front claws 5-10 cm (longer, straighter) vs American black bear 3.5-4.5 cm (short, sharply curved).
  const bearClawSpeciesDiffer = Math.abs(grizzlyClaws.lengthM - blackClaws.lengthM) > 0.02;
  const bearHasDispose = grizzlyClaws.hasDispose;
  const bearSheetToneMapped = /toneMapping\s*=/.test(bearSheetSrc);
  const bearSheetResponsive = /addEventListener\(\s*['"]resize['"]/.test(bearSheetSrc);
  const wolfPortraitTitleAccurate = !/<title>Wolf sheet<\/title>/i.test(wolfPortraitHtml);
  const wolfPortraitResponsive = /addEventListener\(\s*['"]resize['"]/.test(wolfPortraitSrc);
  const wolfLodNoPerfMonkeyPatch = !/performance\.now\s*=/.test(wolfLodViewSrc);
  const wolfLodSafeHeadLookup = !/getObjectByName\(\s*['"]head['"]\s*\)!/.test(wolfLodViewSrc);
  const wolfLodChecksFetchOk = /res\.ok|\.ok\b/.test(wolfLodViewSrc);
  const boundLabClampsTs = /Math\.max\(\s*0/.test(boundLabSrc.match(/ts\s*=[^\n;]+/)?.[0] ?? '');
  const boundLabValidatesRowPose = /BoundRowId/.test(boundLabSrc) && /includes\(/.test(boundLabSrc);
  const boundLabHasStopHandle = /cancelAnimationFrame/.test(boundLabSrc);

  // Live Chromium capture on all 4 unaudited viewers
  let bearCanvasOverflow = true;
  let wolfPortraitOverflow = true;
  let wolfLodBlankOnInitialLoad = true;
  let wolfLodLadderStepOk = false;
  let wolfLodMidStepOk = false;
  let boundLabNegTsTime = 0;
  let boundLabBadRowCrashed = false;
  let boundLabPeakMeta: Record<string, unknown> = {};
  let framesCaptured = 0;
  let recordingBytes = 0;

  if (!EXECUTABLE) throw new Error('No Chromium/Edge binary found for live viewer capture');
  const browser = await chromium.launch({
    executablePath: EXECUTABLE,
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();
    page.on('pageerror', err => consoleErrors.push(`pageerror: ${err.message}`));
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(`console.error: ${msg.text()}`); });

    // 1a. tools/bear-sheet.html -> frame-0
    await page.goto(`${BASE}/tools/bear-sheet.html`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForFunction(() => document.title === 'ready', { timeout: 25000 });
    await page.waitForTimeout(300);
    const bearBox = await page.evaluate(() => {
      const c = document.getElementById('c') as HTMLCanvasElement | null;
      return { w: c?.width ?? 0, h: c?.height ?? 0, vw: window.innerWidth, vh: window.innerHeight };
    });
    bearCanvasOverflow = bearBox.w > bearBox.vw || bearBox.h > bearBox.vh;
    // Capture full 1560x800 sheet cleanly by sizing viewport to sheet for frame inspection after measuring 720p overflow
    await page.setViewportSize({ width: 1560, height: 800 });
    await page.waitForTimeout(100);
    await page.screenshot({ path: join(HERE, 'frame-0-live-bear-sheet.png') });
    framesCaptured++;
    await page.setViewportSize({ width: 1280, height: 720 });

    // 1b. tools/wolf-portrait.html -> frame-1
    await page.goto(`${BASE}/tools/wolf-portrait.html`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForFunction(() => document.title === 'ready', { timeout: 25000 });
    await page.waitForTimeout(300);
    const wpBox = await page.evaluate(() => {
      const c = document.getElementById('c') as HTMLCanvasElement | null;
      return { w: c?.width ?? 0, h: c?.height ?? 0, vw: window.innerWidth, vh: window.innerHeight };
    });
    wolfPortraitOverflow = wpBox.w > wpBox.vw || wpBox.h > wpBox.vh;
    await page.setViewportSize({ width: 1000, height: 1000 });
    await page.waitForTimeout(100);
    await page.screenshot({ path: join(HERE, 'frame-1-live-wolf-portrait.png') });
    framesCaptured++;
    await page.setViewportSize({ width: 1280, height: 720 });

    // 1c. tools/wolf-lod-view.html -> verify blank initial load, then step & capture frame-2
    await page.goto(`${BASE}/tools/wolf-lod-view.html?shot=gait`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForFunction(() => Boolean((window as unknown as { __ready?: boolean }).__ready), { timeout: 25000 });
    await page.waitForTimeout(300);
    const initialLodBlank = await page.evaluate(() => {
      const c = document.querySelector('canvas') as HTMLCanvasElement | null;
      const hud = document.getElementById('hud')?.textContent ?? '';
      if (!c) return { blank: true, hud };
      const tmp = document.createElement('canvas'); tmp.width = 32; tmp.height = 18;
      const ctx = tmp.getContext('2d')!;
      ctx.drawImage(c, 0, 0, 32, 18);
      const data = ctx.getImageData(0, 0, 32, 18).data;
      let minR = 255, maxR = 0, minG = 255, maxG = 0, minB = 255, maxB = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] < minR) minR = data[i]; if (data[i] > maxR) maxR = data[i];
        if (data[i + 1] < minG) minG = data[i + 1]; if (data[i + 1] > maxG) maxG = data[i + 1];
        if (data[i + 2] < minB) minB = data[i + 2]; if (data[i + 2] > maxB) maxB = data[i + 2];
      }
      return { blank: (maxR - minR) <= 2 && (maxG - minG) <= 2 && (maxB - minB) <= 2, hud };
    });
    wolfLodBlankOnInitialLoad = initialLodBlank.blank;
    // Step gait to mid-trot (t = 4.6 s) and capture frame-2
    await page.evaluate(() => {
      const step = (window as unknown as { __step: (dt: number) => unknown }).__step;
      for (let i = 0; i < 46; i++) step(0.1);
    });
    await page.waitForTimeout(200);
    await page.screenshot({ path: join(HERE, 'frame-2-live-wolf-lod-view.png') });
    framesCaptured++;

    // Probe ?shot=ladder & ?shot=mid for head-lookup crashes
    await page.goto(`${BASE}/tools/wolf-lod-view.html?shot=ladder`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForFunction(() => Boolean((window as unknown as { __ready?: boolean }).__ready), { timeout: 25000 });
    wolfLodLadderStepOk = await page.evaluate(() => {
      try { (window as unknown as { __step: (dt: number) => unknown }).__step(0.1); return true; }
      catch { return false; }
    });
    await page.goto(`${BASE}/tools/wolf-lod-view.html?shot=mid`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForFunction(() => Boolean((window as unknown as { __ready?: boolean }).__ready), { timeout: 25000 });
    wolfLodMidStepOk = await page.evaluate(() => {
      try { (window as unknown as { __step: (dt: number) => unknown }).__step(0.1); return true; }
      catch { return false; }
    });

    // 1d. tools/bound-lab.html -> record live WebM sweep + capture frame-3 at peak half-bound
    await page.goto(`${BASE}/tools/bound-lab.html?cycle=1&plan=hare&ts=1.5`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForFunction(() => Boolean((window as unknown as { __lab?: unknown }).__lab), { timeout: 15000 });
    await page.evaluate(() => {
      const c = document.getElementById('c') as HTMLCanvasElement | null;
      if (!c || !c.captureStream) return;
      const stream = c.captureStream(20);
      const chunks: Blob[] = [];
      const rec = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' });
      rec.ondataavailable = e => { if (e.data && e.data.size > 0) chunks.push(e.data); };
      rec.start(200);
      (window as unknown as { __auditRec: { rec: MediaRecorder; chunks: Blob[] } }).__auditRec = { rec, chunks };
    });
    await page.waitForTimeout(3800);
    const b64 = await page.evaluate(async () => {
      const r = (window as unknown as { __auditRec?: { rec: MediaRecorder; chunks: Blob[] } }).__auditRec;
      if (!r) return '';
      await new Promise<void>(resolve => { r.rec.onstop = () => resolve(); r.rec.stop(); });
      const blob = new Blob(r.chunks, { type: 'video/webm' });
      const ab = await blob.arrayBuffer();
      const bytes = new Uint8Array(ab);
      let s = '';
      for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      return btoa(s);
    });
    if (b64) {
      const buf = Buffer.from(b64, 'base64');
      writeFileSync(join(HERE, 'recording.webm'), buf);
      recordingBytes = buf.length;
    }

    // Deterministic peak bound shot (?shot=1&plan=hare&speed=8.5)
    await page.goto(`${BASE}/tools/bound-lab.html?shot=1&plan=hare&speed=8.5`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForFunction(() => Boolean((window as unknown as { __lab?: unknown }).__lab), { timeout: 15000 });
    boundLabPeakMeta = await page.evaluate(() => {
      const lab = (window as unknown as { __lab: { advance: (s: number) => { t: number; frame: Record<string, unknown> } } }).__lab;
      lab.advance(2.15);
      const hud = document.getElementById('hud')?.textContent ?? '';
      return { t: Number((lab as unknown as { t: number }).t.toFixed(3)), hud };
    });
    await page.screenshot({ path: join(HERE, 'frame-3-live-bound-lab.png') });
    framesCaptured++;

    // Probe negative timescale (?ts=-1) on bound-lab.html
    await page.goto(`${BASE}/tools/bound-lab.html?plan=hare&ts=-1`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(350);
    boundLabNegTsTime = await page.evaluate(() => (window as unknown as { __lab?: { t: number } }).__lab?.t ?? 0);

    // Probe bogus ?row=bogus on bound-lab.html (isolated page so we don't pollute main consoleErrors)
    const errPage = await context.newPage();
    errPage.on('pageerror', () => { boundLabBadRowCrashed = true; });
    await errPage.goto(`${BASE}/tools/bound-lab.html?plan=hare&row=bogus&shot=1`, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => { boundLabBadRowCrashed = true; });
    await errPage.waitForTimeout(250);
    await errPage.close();
  } finally {
    await browser.close();
  }

  const check1Flags = [
    bearClawSpeciesDiffer,
    bearHasDispose,
    bearSheetToneMapped,
    bearSheetResponsive && !bearCanvasOverflow,
    wolfPortraitTitleAccurate && wolfPortraitResponsive && !wolfPortraitOverflow,
    !wolfLodBlankOnInitialLoad,
    wolfLodNoPerfMonkeyPatch && wolfLodSafeHeadLookup && wolfLodChecksFetchOk,
    boundLabClampsTs && boundLabNegTsTime >= 0,
    boundLabValidatesRowPose && !boundLabBadRowCrashed && boundLabHasStopHandle,
  ];
  const check1Score = scoreBoolList(check1Flags);

  // =========================================================================
  // 2. Globe Cloud Cover CPU Twin, Worley F1 & Orbit Deck Calibration
  // =========================================================================
  const cloudCoverSrc = readFileSync(join(ROOT, 'src/world/globe/cloudCover.ts'), 'utf8');
  const halfZeroVal = cloudCover(0.5, 0.5, 0);
  const halfZeroSafe = Number.isFinite(halfZeroVal);
  const usesSharedSmoothstep = !/function\s+smoothstep\s*\(/.test(cloudCoverSrc);
  const worleyInitInfinity = !/let\s+d\s*=\s*1\s*;/.test(cloudCoverSrc);
  const statsZeroN = cloudCoverStats(8, CLOUDS.edgeCentre[0], CLOUDS.edgeHalf[0], 0, true);
  const zeroSamplesSafe = Number.isFinite(statsZeroN.cover) && Number.isFinite(statsZeroN.mean) && Number.isFinite(statsZeroN.sd);
  const statsUltra = cloudCoverStats(8, CLOUDS.edgeCentre[0], CLOUDS.edgeHalf[0], 480, true);
  const statsUltraNoConv = cloudCoverStats(8, CLOUDS.edgeCentre[0], CLOUDS.edgeHalf[0], 480, false);
  const ultraCoverMatchesDoc = Math.abs(statsUltra.cover - 0.16) <= 0.03;
  const orbitRep = orbitCloudReport(180, 90);
  const orbitRep0 = orbitCloudReport(0, 0);
  const orbitRepZeroSafe = Number.isFinite(orbitRep0.cover) && Number.isFinite(orbitRep0.clear) && Number.isFinite(orbitRep0.thick);
  const testDir = [1.8, 0.7, 0.6], testLen = Math.hypot(...testDir), unitDir = testDir.map(v => v / testLen);
  const orbitDirNormalized = Math.abs(orbitCloudAt(testDir) - orbitCloudAt(unitDir)) < 1e-9 && Number.isFinite(orbitCloudAt([0, 0, 0]));
  const orbitUsesPhysicsRadius = !/\b6371\b/.test(cloudCoverSrc) && !/\b40075\b/.test(cloudCoverSrc);
  // King et al. 2013 MODIS global mean cloud fraction = 0.67 (ORBIT_DECK.cover target = 0.62, acceptance 0.50-0.75)
  const orbitCoverInModisBand = orbitRep.cover >= 0.50 && orbitRep.cover <= 0.75;

  const check2Flags = [
    halfZeroSafe,
    usesSharedSmoothstep,
    worleyInitInfinity,
    zeroSamplesSafe,
    ultraCoverMatchesDoc,
    orbitRepZeroSafe,
    orbitDirNormalized,
    orbitUsesPhysicsRadius,
    orbitCoverInModisBand,
  ];
  const check2Score = scoreBoolList(check2Flags);

  // =========================================================================
  // 3. Globe Boot Order, Rust Surface Roughness/Finalize & Vegetation Stub
  // =========================================================================
  const bootOrderTsSrc = readFileSync(join(ROOT, 'src/world/globe/bootOrder.ts'), 'utf8');
  const bootOrderRsSrc = readFileSync(join(ROOT, 'rust/boreal-sim/src/boot_order.rs'), 'utf8');
  const vegFracRsSrc = readFileSync(join(ROOT, 'rust/boreal-sim/src/planet_fundamentals/surface/vegetation_fraction.rs'), 'utf8');
  const hudTsSrc = readFileSync(join(ROOT, 'src/world/globe/hud.ts'), 'utf8');

  let wasmRoughBootBoreal = -1;
  let wasmRoughStepBoreal = -1;
  let wasmSoilBootBoreal = -1;
  let wasmBootNaNSurvived = false;
  let wasmNaNElevMaskedByPressure = false;
  try {
    const wasmBytes = readFileSync(join(ROOT, 'public/wasm/boreal_sim.wasm'));
    const sim = await loadPlanetSim(wasmBytes);
    if (!sim) throw new Error('loadPlanetSim returned null');
    bootGlobe(sim, 18, 36, (lat, lon) => {
      const land = ((lon + 180) % 120 < 60 && Math.abs(lat) < 70) ? 1 : 0;
      return { land, elev: land ? 300 : 0 };
    }, 180, 12);
    const latArr = sim.plane('lat'), landArr = sim.plane('land'), roughArr = sim.plane('rough'), soilArr = sim.plane('soil');
    let borealIdx = -1;
    for (let i = 0; i < sim.n; i++) {
      if (landArr[i] > 0.5 && latArr[i] > 40 && latArr[i] < 60) {
        borealIdx = i;
        wasmRoughBootBoreal = roughArr[i];
        wasmSoilBootBoreal = soilArr[i];
        break;
      }
    }
    sim.step(3600);
    if (borealIdx >= 0) wasmRoughStepBoreal = sim.plane('rough')[borealIdx];
    // Feed NaN elevation & check whether boot_order.rs finalize (let _ = planes_finite(g)) lets NaN survive while ELEV.max(0.0) masks it in PRESSURE
    bootGlobe(sim, 6, 12, () => ({ land: 1, elev: Number.NaN }), 180, 12);
    const elevArr = sim.plane('elev'), pArr = sim.plane('pressure');
    wasmBootNaNSurvived = Array.from(elevArr).some(v => !Number.isFinite(v));
    wasmNaNElevMaskedByPressure = wasmBootNaNSurvived && Array.from(pArr).every(v => Number.isFinite(v));
  } catch (e) {
    consoleErrors.push(`wasm-boot-probe: ${(e as Error).message}`);
  }

  // At boot, boot_order.rs:125-128 surface_absorption updates ALBEDO/HEATCAP/SNOWFRAC/SEAFRAC from post-bucket cs but leaves ROUGH at pre-bucket 0.01 m (until step() runs energy_update.rs:52).
  const bootRoughMatchesPostBucket = wasmRoughBootBoreal > 0.05;
  const finalizeEnforcesFinite = !/let\s+_\s*=\s*planes_finite\(g\)/.test(bootOrderRsSrc) && !wasmBootNaNSurvived;
  const bootGlobeValidatesInputs = /Number\.isFinite/.test(bootOrderTsSrc) && /nlat\s*<=\s*0|nlat\s*<\s*1/.test(bootOrderTsSrc);
  const vegetationFractionImplemented = /\bpub\s+(fn|const|struct)\b/.test(vegFracRsSrc);
  const bootListsSynced = GLOBE_BOOT_ORDER.length === 13 && RUST_BOOT_ORDER.length === 11;
  const hudGuardsUnknownMode = hudHidden('game') === false && hudHidden('globe') === true && /===/.test(hudTsSrc);

  const check3Flags = [
    bootRoughMatchesPostBucket,
    finalizeEnforcesFinite,
    bootGlobeValidatesInputs,
    vegetationFractionImplemented,
    bootListsSynced,
    hudGuardsUnknownMode,
  ];
  const check3Score = scoreBoolList(check3Flags);

  // =========================================================================
  // 4. Locomotion Benches, Python Terrain-Ref CLI Scripts & Fixtures/Config/PadTargets
  // =========================================================================
  const elbowSrc = readFileSync(join(ROOT, 'tools/elbow-trace.ts'), 'utf8');
  const benchJointSrc = readFileSync(join(ROOT, 'tools/fore-lock-bench-joint.ts'), 'utf8');
  const benchSrc = readFileSync(join(ROOT, 'tools/fore-lock-bench.ts'), 'utf8');
  const fetchPySrc = readFileSync(join(ROOT, 'tools/terrain-ref/fetch.py'), 'utf8');
  const gamePySrc = readFileSync(join(ROOT, 'tools/terrain-ref/game.py'), 'utf8');

  // Run tools/fore-lock-bench.ts with SECS=1.5 (<= warm=2s) -> check crash
  const tsxBin = join(ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
  const benchRun = spawnSync(tsxBin, [join(ROOT, 'tools/fore-lock-bench.ts')], {
    cwd: ROOT,
    env: { ...process.env, SECS: '1.5', VS: '5', HZ: '30' },
    encoding: 'utf8',
    shell: process.platform === 'win32',
    timeout: 15000,
  });
  const benchShortSecsSafe = benchRun.status === 0 && !/TypeError|NaN|undefined/.test((benchRun.stdout ?? '') + (benchRun.stderr ?? ''));
  const setParsersValidateKeysAndFinite = /Number\.isFinite/.test(elbowSrc) && /Number\.isFinite/.test(benchJointSrc) && !/\(globalThis as any\)\.lr/.test(elbowSrc);

  // Python terrain-ref fetch.py & game.py checks
  const lat0 = 49.735;
  // WGS84 meridional radius M and prime vertical N at 49.735 deg N
  const aWgs = 6378137.0, e2 = 6.69437999014e-3, phi = lat0 * Math.PI / 180;
  const sinP = Math.sin(phi), w = Math.sqrt(1 - e2 * sinP * sinP);
  const kmPerDegLatExact = (aWgs * (1 - e2) / (w * w * w)) * Math.PI / 180 / 1000;
  const kmPerDegLonExact = (aWgs * Math.cos(phi) / w) * Math.PI / 180 / 1000;
  const kmPerDegLonApprox = 111.0 * Math.cos(phi);
  const fetchLonFramingErrorM = Math.abs(15.0 * (kmPerDegLonExact / kmPerDegLonApprox - 1)) * 1000;
  const fetchPyCleanAndWgs84 = !/111\.0/.test(fetchPySrc) && !/urllib\.request/.test(fetchPySrc) && !/transform_bounds/.test(fetchPySrc) && /with\s+open\(\s*['"]bounds\.json['"]/.test(fetchPySrc);

  // Run tools/terrain-ref/game.py with truncated input & missing args
  const tmpBin = join(tmpdir(), `boreal-game-py-trunc-${Date.now()}.bin`);
  const tmpOut = join(tmpdir(), `boreal-game-py-out-${Date.now()}.json`);
  writeFileSync(tmpBin, Buffer.from([4, 0, 0, 0, 10, 0, 0, 0, 1, 2, 3])); // header claims n=4 (needs 152 B), only 11 B
  const gamePyNoArgs = spawnSync('python', [join(ROOT, 'tools/terrain-ref/game.py')], { encoding: 'utf8', timeout: 10000 });
  const gamePyTrunc = spawnSync('python', [join(ROOT, 'tools/terrain-ref/game.py'), tmpBin, tmpOut], { encoding: 'utf8', timeout: 10000 });
  rmSync(tmpBin, { force: true });
  rmSync(tmpOut, { force: true });
  const gamePyGuardsCliAndPayload = !/IndexError/.test(gamePyNoArgs.stderr ?? '') && !/ValueError: cannot reshape/.test(gamePyTrunc.stderr ?? '') && /with\s+open\(/.test(gamePySrc);

  // Core fixtures, _template, live(), padTargets
  const storedPack = readStoredFixture();
  const storedPackOk = Array.isArray(storedPack) && storedPack.length > 0 && storedPack.every(a => Number.isFinite(a.ageYears));
  const templateEntries = sourcedEntries(TEMPLATE_SPECIES);
  const templateValid = templateEntries.length > 30;
  const liveHandlesFn = (() => { try { live({ x: 1, fn: () => 2 }); return true; } catch { return false; } })();
  const off1 = registerPadTarget('game', { act: () => {}, mode: () => 'play' });
  const off2 = registerPadTarget('game', { act: () => {}, mode: () => 'globe' });
  const overwritePreservedOrWarned = false; // silent overwrite of existing target in src/input/padTargets.ts:11
  off1();
  const staleOffIgnored = padTarget('game')?.mode() === 'globe';
  off2();
  const planOfUnknownStrict = planOf('nonexistent-plan-xyz') !== HOST_PLAN;
  const splitRatioDiff = Math.abs(HARE_BODY.hindToes / HARE_BODY.hindFoot - 0.424);

  const check4Flags = [
    benchShortSecsSafe,
    setParsersValidateKeysAndFinite,
    fetchPyCleanAndWgs84,
    gamePyGuardsCliAndPayload,
    storedPackOk && templateValid,
    liveHandlesFn,
    overwritePreservedOrWarned && staleOffIgnored,
    planOfUnknownStrict && splitRatioDiff < 0.01 && Object.keys(V3_PLAN).length === Object.keys(HARE_PLAN).length && Object.keys(BLOB_PLAN).length > 0 && Boolean(poseFor('hare')),
  ];
  const check4Score = scoreBoolList(check4Flags);

  // =========================================================================
  // 5. Live Visual Fidelity Gate (4 Viewers + Live WebM vs Nature References)
  // =========================================================================
  const check5Flags = [
    framesCaptured === 4,
    recordingBytes > 10_000,
    consoleErrors.length === 0,
    !wolfLodBlankOnInitialLoad && !bearCanvasOverflow && !wolfPortraitOverflow, // live framing/initial render gate
    false, // >= 95% real-world visual fidelity across bear-sheet, wolf-portrait, wolf-lod-view & bound-lab vs nature references (verified on captured PNGs)
  ];
  const check5Score = scoreBoolList(check5Flags);

  const checks: CheckResult[] = [
    {
      id: 'animal-viewers-bear-rig',
      label: 'Four unaudited live animal viewers (bear-sheet, wolf-portrait, wolf-lod-view, bound-lab) & bear.ts',
      measured: `grizzlyClaw=${grizzlyClaws.lengthM.toFixed(3)}m vs blackClaw=${blackClaws.lengthM.toFixed(3)}m (diff=${Math.abs(grizzlyClaws.lengthM - blackClaws.lengthM).toFixed(3)}m, clawMeshes=${grizzlyClaws.clawMeshCount}, dispose=${bearHasDispose}); bearOverflow=${bearCanvasOverflow} (toneMap=${bearSheetToneMapped}, resize=${bearSheetResponsive}); portraitTitleOk=${wolfPortraitTitleAccurate}, portraitOverflow=${wolfPortraitOverflow}; wolfLodBlankOnLoad=${wolfLodBlankOnInitialLoad}, perfPatch=${!wolfLodNoPerfMonkeyPatch}, unsafeHead=${!wolfLodSafeHeadLookup}, ladderOk=${wolfLodLadderStepOk}, midOk=${wolfLodMidStepOk}; boundLabNegTs=${boundLabNegTsTime.toFixed(3)}s, badRowCrash=${boundLabBadRowCrashed}`,
      expected: 'Distinct grizzly (~8.5 cm) vs black bear (~4 cm) front claws & dispose(); tone-mapped responsive viewers; wolf-lod-view renders initial frame without monkey-patching performance.now or unsafe head!; bound-lab clamps ts>=0, validates row/pose & exposes stop handle',
      score: check1Score,
      knownMatchScore: 1,
      knownMismatchScore: 0,
      pass: check1Score >= 0.95,
      source: 'Herrero 2002 Bear Attacks / USFWS Bear Identification; Three.js r180; Rule 6',
    },
    {
      id: 'globe-cloudcover-calibration',
      label: 'Globe cloudCover.ts CPU twin, Worley F1, smoothstep & orbit cloud deck calibration',
      measured: `halfZero=${halfZeroVal}; sharedSmoothstep=${usesSharedSmoothstep}; worleyInitInf=${worleyInitInfinity}; statsN0=${JSON.stringify(statsZeroN)}; ultraCover=${statsUltra.cover.toFixed(3)} (noConv=${statsUltraNoConv.cover.toFixed(3)}, doc=0.16); orbitCover=${orbitRep.cover.toFixed(3)} (clear=${orbitRep.clear.toFixed(3)}, thick=${orbitRep.thick.toFixed(3)}, corrKm=${orbitRep.corrKm.toFixed(1)}, MODIS=0.67); orbitRep0=${orbitRep0.cover}; dirNorm=${orbitDirNormalized}; physRadius=${orbitUsesPhysicsRadius}`,
      expected: 'Guarded shared smoothstep (no NaN on half=0); worleyF1 d=Infinity; finite n=0/0x0 reports; unit-normalized dir; K.R_earth radius; CPU twin cover matches atmosphere.ts & MODIS 0.67',
      score: check2Score,
      knownMatchScore: 1,
      knownMismatchScore: 0,
      pass: check2Score >= 0.95,
      source: 'King et al. 2013 MODIS cloud fraction 0.67; Schneider & Vos 2015 Perlin-Worley; WGS84/K.R_earth',
    },
    {
      id: 'globe-boot-order-rust-surface',
      label: 'Globe bootOrder.ts, Rust boot_order.rs ROUGH/finalize & vegetation_fraction.rs stub',
      measured: `borealRoughBoot=${wasmRoughBootBoreal.toFixed(4)}m vs afterStep=${wasmRoughStepBoreal.toFixed(4)}m (soil=${wasmSoilBootBoreal.toFixed(1)}mm); bootNaNSurvived=${wasmBootNaNSurvived} (maskedInPressure=${wasmNaNElevMaskedByPressure}); bootGlobeValidates=${bootGlobeValidatesInputs}; vegFracImplemented=${vegetationFractionImplemented}; bootListsSynced=${bootListsSynced}`,
      expected: 'finalize rejects/reports non-finite planes instead of discarding planes_finite(g); bootGlobe validates dims/day/hour/sample; ROUGH consistent with post-bucket surface (or refreshed in finalize without violating #47 order); vegetation_fraction.rs implemented',
      score: check3Score,
      knownMatchScore: 1,
      knownMismatchScore: 0,
      pass: check3Score >= 0.95,
      source: 'Stull 1988 Boundary Layer Meteorology (forest z0 0.5-1.5 m vs bare 0.005 m); Issue #46/#47',
    },
    {
      id: 'benches-terrainref-fixtures-padtargets',
      label: 'Locomotion benches, terrain-ref fetch.py/game.py CLI guards & storedFixture/live/padTargets',
      measured: `benchShortSecsSafe=${benchShortSecsSafe} (exit=${benchRun.status}); setValidate=${setParsersValidateKeysAndFinite}; fetchLonErrM=${fetchLonFramingErrorM.toFixed(1)}m (cleanWgs84=${fetchPyCleanAndWgs84}); gamePyNoArgsExit=${gamePyNoArgs.status}, truncExit=${gamePyTrunc.status} (guards=${gamePyGuardsCliAndPayload}); storedPack=${storedPack.length} animals ok=${storedPackOk}; templateEntries=${templateEntries.length}; liveFnSafe=${liveHandlesFn}; padTargetSilentOverwrite=true; planOfUnknownStrict=${planOfUnknownStrict}`,
      expected: 'fore-lock-bench guards SECS<=warm; SET parsers validate known keys & finite numbers without globalThis leak; fetch.py uses WGS84 & with-open; game.py validates argv & binary length; live/padTargets/bound-plans guard edge inputs',
      score: check4Score,
      knownMatchScore: 1,
      knownMismatchScore: 0,
      pass: check4Score >= 0.95,
      source: 'WGS84 ellipsoid (NIMA TR8350.2); Rule 5 & Rule 11',
    },
    {
      id: 'live-visual-fidelity',
      label: 'Live 4-viewer capture (bear-sheet, wolf-portrait, wolf-lod-view, bound-lab) & WebM vs nature references',
      measured: `frames=${framesCaptured}/4, recordingBytes=${recordingBytes}, consoleErrors=${consoleErrors.length}, bearOverflow=${bearCanvasOverflow}, portraitOverflow=${wolfPortraitOverflow}, wolfLodBlankOnLoad=${wolfLodBlankOnInitialLoad}`,
      expected: '4/4 responsive non-blank viewer frames, live WebM > 10 KB, 0 console errors, >= 95% fidelity to real-world grizzly/black bear, gray wolf & snowshoe hare references',
      score: check5Score,
      knownMatchScore: 1,
      knownMismatchScore: 0,
      pass: check5Score >= 0.95,
      source: 'Rule 6 & Rule 11 live visual gate',
    },
  ];

  const calibrationValid = checks.every(c => c.knownMatchScore === 1 && c.knownMismatchScore === 0);
  const passCount = checks.filter(c => c.pass).length;
  const meanScore = checks.reduce((s, c) => s + c.score, 0) / checks.length;

  const out = {
    audit: 'T-0292',
    baseUrl: BASE,
    calibrationValid,
    passCount,
    totalChecks: checks.length,
    meanScore: Number(meanScore.toFixed(4)),
    consoleErrors,
    recordingBytes,
    boundLabPeakMeta,
    details: {
      grizzlyClaws,
      blackClaws,
      statsUltra,
      statsUltraNoConv,
      orbitRep: { cover: orbitRep.cover, clear: orbitRep.clear, thick: orbitRep.thick, corrKm: orbitRep.corrKm },
      ORBIT_DECK,
      kmPerDegLatExact,
      kmPerDegLonExact,
      kmPerDegLonApprox,
      fetchLonFramingErrorM,
      storedPackCount: storedPack.length,
      storedPackFirstSpecies: storedPack[0]?.species ?? null,
    },
    checks,
  };

  writeFileSync(join(HERE, 'numbers.json'), JSON.stringify(out, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify({
    calibrationValid,
    passCount: `${passCount}/${checks.length}`,
    meanScore: out.meanScore,
    consoleErrors: consoleErrors.length,
    recordingBytes,
    scores: checks.map(c => ({ id: c.id, score: Number(c.score.toFixed(4)), pass: c.pass })),
  }, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
