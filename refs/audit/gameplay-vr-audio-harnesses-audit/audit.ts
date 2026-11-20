/**
 * Live & calibrated Rule 11 audit (T-0290) of four previously unaudited subsystems
 * (zero overlap with T-0001..T-0289):
 *   1. Live Gameplay HUD Overlaps, Controls Clipping, Spawn Scene & Autoplay Harness
 *      (`src/style.css`, `index.html`, `src/ui/cameraPanel.ts`, `src/ui/dataPanel.ts`,
 *       `src/input/autoplay.ts`, `tests/slow/autoplay.test.ts`, `src/world/globe/globeView.ts`)
 *   2. WebXR / VR Hands-Only Journey & Forest Session
 *      (`src/vr/session.ts`, `src/vr/forestSession.ts`, `src/vr/forestHands.ts`, `src/vr/journey.ts`)
 *   3. Audio Mixer/Music/BigBang/BorealSound, Haptics & Unaudited UI Controls
 *      (`src/audio/borealSound.ts`, `src/audio/mixer.ts`, `src/audio/music.ts`, `src/audio/bigBang.ts`,
 *       `src/ui/haptics.ts`, `src/ui/senses.ts`, `src/ui/chronometer.ts`, `src/ui/appearancePanel.ts`,
 *       `src/ui/cameraPanel.ts`, `src/ui/padNav.ts`, `src/ui/pad3d.ts`, `src/ui/badgePanel.ts`, `src/ui/loading.ts`)
 *   4. Remaining 15 `.mjs` Verification Harnesses & WASM Build Script
 *      (`tools/cine-arrival-trace.mjs`, `tools/data-panel-shot.mjs`, `tools/descent-frame-shot.mjs`,
 *       `tools/flydown-shot.mjs`, `tools/hare-rig-record.mjs`, `tools/music-shot.mjs`,
 *       `tools/needs-record.mjs`, `tools/reheat-shot.mjs`, `tools/t0073-shot.mjs`,
 *       `tools/t0135-shot.mjs`, `tools/t0136-shot.mjs`, `tools/t0137-shot.mjs`,
 *       `tools/t0169-shot.mjs`, `tools/wolf-lod-record.mjs`, `tools/build-wasm.mjs`)
 *
 * Usage:
 *   npx tsx refs/audit/gameplay-vr-audio-harnesses-audit/audit.ts [baseUrl]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { snapYaw, headingToward } from '../../../src/vr/forestHands';
import { BUS_LEVEL, VOLUME_SETTINGS } from '../../../src/audio/mixer';
import { createHaptics, createWallFeedback, FEEL, HAPTIC_EVENTS, pulse, type HapticTargets } from '../../../src/ui/haptics';
import { createNumberEntry } from '../../../src/ui/padNav';
import { stateFromSearch } from '../../../src/ui/cameraPanel';

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

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

function scoreCheck1(m: {
  dataBtnClearOfHeader: boolean;
  cameraPanelClearOfFooter: boolean;
  targetClearOfStatus: boolean;
  controlsHintUnclipped: boolean;
  globeRemovesLoadingOverlay: boolean;
  autoplayTestPortableAndClean: boolean;
  infoAndAutoplayCopyConsistent: boolean;
}): number {
  return (
    (m.dataBtnClearOfHeader ? 1 : 0) +
    (m.cameraPanelClearOfFooter ? 1 : 0) +
    (m.targetClearOfStatus ? 1 : 0) +
    (m.controlsHintUnclipped ? 1 : 0) +
    (m.globeRemovesLoadingOverlay ? 1 : 0) +
    (m.autoplayTestPortableAndClean ? 1 : 0) +
    (m.infoAndAutoplayCopyConsistent ? 1 : 0)
  ) / 7;
}

function scoreCheck2(m: {
  journeyGlideFacesForward: boolean;
  snapYawMatchesRightHandDoc: boolean;
  journeyDarkPhaseReachableAndReversible: boolean;
  vrSessionCleansOverlayOnError: boolean;
  forestSessionSafeLifecycleAndTerrain: boolean;
  vrGlobeAndMuzzleProcedural: boolean;
}): number {
  return (
    (m.journeyGlideFacesForward ? 1 : 0) +
    (m.snapYawMatchesRightHandDoc ? 1 : 0) +
    (m.journeyDarkPhaseReachableAndReversible ? 1 : 0) +
    (m.vrSessionCleansOverlayOnError ? 1 : 0) +
    (m.forestSessionSafeLifecycleAndTerrain ? 1 : 0) +
    (m.vrGlobeAndMuzzleProcedural ? 1 : 0)
  ) / 6;
}

function scoreCheck3(m: {
  mixerRejectsNaNLevel: boolean;
  borealSoundSafeHotkeysAssetAndWater: boolean;
  musicNoRaceLeakOrPulseLatch: boolean;
  bigBangClosesCtxAndClampsVol: boolean;
  hapticsClampsRumbleAndUsesTarget: boolean;
  sensesSpeciesRangeAndStableKeys: boolean;
  uiListenersClampAndSignEntry: boolean;
}): number {
  return (
    (m.mixerRejectsNaNLevel ? 1 : 0) +
    (m.borealSoundSafeHotkeysAssetAndWater ? 1 : 0) +
    (m.musicNoRaceLeakOrPulseLatch ? 1 : 0) +
    (m.bigBangClosesCtxAndClampsVol ? 1 : 0) +
    (m.hapticsClampsRumbleAndUsesTarget ? 1 : 0) +
    (m.sensesSpeciesRangeAndStableKeys ? 1 : 0) +
    (m.uiListenersClampAndSignEntry ? 1 : 0)
  ) / 7;
}

function scoreCheck4(m: {
  harnessesPortableBrowser: boolean;
  harnessesUseFileUrlToPath: boolean;
  harnessesAvoidForbiddenPortsAndLinuxPaths: boolean;
  harnessesSafeTeardownAndNoTdz: boolean;
  buildWasmValidatesOutputAndDocs: boolean;
}): number {
  return (
    (m.harnessesPortableBrowser ? 1 : 0) +
    (m.harnessesUseFileUrlToPath ? 1 : 0) +
    (m.harnessesAvoidForbiddenPortsAndLinuxPaths ? 1 : 0) +
    (m.harnessesSafeTeardownAndNoTdz ? 1 : 0) +
    (m.buildWasmValidatesOutputAndDocs ? 1 : 0)
  ) / 5;
}

function scoreCheck5(m: {
  consoleErrors: number;
  framesCaptured: number;
  recordingBytes: number;
  globeVisualMatch: boolean;
  forestGroundVisualMatch: boolean;
  hudLayoutVisualMatch: boolean;
}): number {
  const errOk = m.consoleErrors === 0 ? 1 : 0;
  const framesOk = m.framesCaptured >= 3 ? 1 : m.framesCaptured / 3;
  const recOk = m.recordingBytes > 10_000 ? 1 : 0;
  const vis = ((m.globeVisualMatch ? 1 : 0) + (m.forestGroundVisualMatch ? 1 : 0) + (m.hudLayoutVisualMatch ? 1 : 0)) / 3;
  return clamp01(0.10 * errOk + 0.10 * framesOk + 0.10 * recOk + 0.70 * vis);
}

async function main() {
  mkdirSync(HERE, { recursive: true });
  const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

  // --- Deterministic Probes: Check 2 (VR / WebXR) ---
  const yawRight = snapYaw(0, 1); // JSDoc: side +1 is right; forward = (-sin yaw, -cos yaw)
  const forwardXAfterRightTurn = -Math.sin(yawRight); // should be > 0 (+x right), actual -0.5 (left!)
  const headingEast = headingToward({ x: 0, z: 0 }, { x: 1, z: 0 }); // -PI/2 (-sin = +1)
  const journeySrc = read('src/vr/journey.ts');
  const sessionSrc = read('src/vr/session.ts');
  const forestSessionSrc = read('src/vr/forestSession.ts');

  const journeyGlideFacesForward = !/rotation\.y\s*=\s*Math\.atan2\(\s*dx\s*,\s*dz\s*\)/.test(journeySrc);
  const snapYawMatchesRightHandDoc = forwardXAfterRightTurn > 0;
  const journeyCallsBeginInCtor = /constructor\([\s\S]*?this\.begin\(\);/.test(journeySrc);
  const journeyReversibleGlobeToSphere = /this\.phase\s*===\s*'globe'[\s\S]{0,160}this\.phase\s*=\s*'sphere'/.test(journeySrc);
  const journeyDarkPhaseReachableAndReversible = !journeyCallsBeginInCtor && journeyReversibleGlobeToSphere;
  const vrSessionCleansOverlayOnError = /catch\s*\(error\)\s*\{[\s\S]*?remove\(\)/.test(sessionSrc);
  const forestSessionDoublePawMeasure = (forestSessionSrc.match(/pawMeasure\(frame,\s*right,\s*ref\)/g) ?? []).length >= 2;
  const forestSessionUsesHeightAt = /heightAt/.test(forestSessionSrc);
  const forestSessionGuardsRaf = /try\s*\{[\s\S]*?setSession[\s\S]*?\}\s*finally[\s\S]*?requestAnimationFrame\s*=\s*native/.test(forestSessionSrc);
  const forestSessionSafeLifecycleAndTerrain = !forestSessionDoublePawMeasure && forestSessionUsesHeightAt && forestSessionGuardsRaf;
  const vrGlobeAndMuzzleProcedural = !/function planetMap\(\)/.test(journeySrc) && !/new SphereGeometry\(0\.08/.test(journeySrc);

  // --- Deterministic Probes: Check 3 (Audio, Haptics, Unaudited UI) ---
  const savedMaster = BUS_LEVEL.master;
  const masterSetting = VOLUME_SETTINGS.find(s => s.id === 'volume.master')!;
  masterSetting.apply?.(Number.NaN);
  const masterAfterNaN = BUS_LEVEL.master;
  BUS_LEVEL.master = savedMaster;
  const mixerRejectsNaNLevel = Number.isFinite(masterAfterNaN);

  const borealSoundSrc = read('src/audio/borealSound.ts');
  const musicSrc = read('src/audio/music.ts');
  const bigBangSrc = read('src/audio/bigBang.ts');
  const hapticsSrc = read('src/ui/haptics.ts');
  const sensesSrc = read('src/ui/senses.ts');
  const appearancePanelSrc = read('src/ui/appearancePanel.ts');
  const cameraPanelSrc = read('src/ui/cameraPanel.ts');
  const pad3dSrc = read('src/ui/pad3d.ts');
  const badgePanelSrc = read('src/ui/badgePanel.ts');

  const borealSoundGuardsModifiers = /e\.ctrlKey\s*\|\|\s*e\.metaKey/.test(borealSoundSrc.slice(borealSoundSrc.indexOf("addEventListener('keydown'"), borealSoundSrc.indexOf("addEventListener('click'")));
  const borealSoundUsesAsset = /asset\(`sounds\//.test(borealSoundSrc);
  const borealSoundWaterUsesSurface = !/heightAt\([^)]+\)\s*<\s*LEVEL\.deerWater/.test(borealSoundSrc);
  const borealSoundSafeHotkeysAssetAndWater = borealSoundGuardsModifiers && borealSoundUsesAsset && borealSoundWaterUsesSurface;

  const musicDisconnectsMediaSrc = /src\.disconnect\(\)/.test(musicSrc);
  const musicCancelsStaleManifest = /loadManifest\(\)\.then\(\(\)\s*=>\s*\{[^}]*MUSIC\.source\s*===\s*'Playlist'/.test(musicSrc);
  const musicRestoresDayPulse = !/MUSIC\.pulse\s*=\s*m\s*===\s*'night'\s*\?\s*6\s*:\s*m\s*===\s*'storm'\s*\?\s*10\s*:\s*MUSIC\.pulse/.test(musicSrc);
  const musicNoRaceLeakOrPulseLatch = musicDisconnectsMediaSrc && musicCancelsStaleManifest && musicRestoresDayPulse;

  const bigBangClosesCtx = /audioCtx\?\.close\(\)|audioCtx\.close\(\)/.test(bigBangSrc);
  const bigBangClampsVol = /Math\.min\(1\s*,\s*Math\.max\(0\s*,\s*dbToGain/.test(bigBangSrc);
  const bigBangClosesCtxAndClampsVol = bigBangClosesCtx && bigBangClampsVol;

  // Probe haptics clamping & target routing live
  let capturedStrong = 0;
  const savedIntensity = FEEL.intensity;
  FEEL.intensity = 1.5;
  const testHaptic = createHaptics({}, () => 1000, (s) => { capturedStrong = s; });
  testHaptic('land', 0, 1.6); // 0.6 * 1.6 * 1.5 = 1.44 > 1.0!
  FEEL.intensity = savedIntensity;
  let customTargetGotRumble = false;
  const customTargets: HapticTargets = {
    gamepads: () => [{ vibrationActuator: { playEffect: () => { customTargetGotRumble = true; return Promise.resolve(); } } } as unknown as Gamepad],
  };
  const wf = createWallFeedback(customTargets, pulse);
  wf.update('test', true, 0.5);
  const hapticsClampsInRumble = /Math\.min\(1\s*,\s*Math\.max\(0\s*,\s*strong\)\)/.test(hapticsSrc);
  const hapticsClampsRumbleAndUsesTarget = hapticsClampsInRumble && capturedStrong <= 1.0 && customTargetGotRumble;

  const sensesHardcodesWolfTraceRange = /deltaSources\(nose\.x,\s*nose\.z,\s*WOLF_AGENT\.senses\.scent\.range\)/.test(sensesSrc);
  const sensesIndexKeyedBubbles = /`scent:\$\{i\}`/.test(sensesSrc);
  const sensesSpeciesRangeAndStableKeys = !sensesHardcodesWolfTraceRange && !sensesIndexKeyedBubbles;

  const numEntry = createNumberEntry(1, 0);
  const signToggleHandled = numEntry.input('menuAlt'); // JSDoc: sign (X) -> returns false!
  const badCamState = stateFromSearch('?N=abc&t=0&iso=-100');
  const camRejectsBadParams = Number.isFinite(badCamState.cam.N) && badCamState.cam.t > 0 && badCamState.cam.S > 0;
  const appearanceRemovesCaptureListener = !/removeEventListener\('keydown',\s*keys\);/.test(appearancePanelSrc);
  const pad3dGuardsZeroHeight = /if\s*\(\s*!cw\s*\|\|\s*!ch\s*\)|ch\s*>\s*0/.test(pad3dSrc);
  const badgeAbortsOnCancel = /if\s*\(\s*r\s*===\s*null\s*\)\s*return/.test(badgePanelSrc);
  const uiListenersClampAndSignEntry = signToggleHandled && camRejectsBadParams && appearanceRemovesCaptureListener && pad3dGuardsZeroHeight && badgeAbortsOnCancel;

  // --- Deterministic Probes: Check 4 (Remaining 15 .mjs Harnesses & build-wasm.mjs) ---
  const HARNESS_FILES = [
    'tools/cine-arrival-trace.mjs', 'tools/data-panel-shot.mjs', 'tools/descent-frame-shot.mjs',
    'tools/flydown-shot.mjs', 'tools/hare-rig-record.mjs', 'tools/music-shot.mjs',
    'tools/needs-record.mjs', 'tools/reheat-shot.mjs', 'tools/t0073-shot.mjs',
    'tools/t0135-shot.mjs', 'tools/t0136-shot.mjs', 'tools/t0137-shot.mjs',
    'tools/t0169-shot.mjs', 'tools/wolf-lod-record.mjs',
  ];
  let hardcodedBrowserCount = 0;
  let urlPathnameBugCount = 0;
  let hardcoded5173Count = 0;
  let forbiddenPort5199Count = 0;
  let linuxAbsPathCount = 0;
  let bareKillCount = 0;
  let noFinallyCloseCount = 0;
  let externalPagesCount = 0;
  let tdzNotesBug = false;

  for (const rel of HARNESS_FILES) {
    const s = read(rel);
    if (/Program Files|\/usr\/bin\/|msedge\.exe|chrome\.exe/.test(s)) hardcodedBrowserCount++;
    if (/new URL\([^)]+import\.meta\.url\)\.pathname/.test(s)) urlPathnameBugCount++;
    if (/:5173/.test(s)) hardcoded5173Count++;
    if (/PORT\s*=\s*5199/.test(s)) forbiddenPort5199Count++;
    if (/\/tmp\/|\/agent\/repos\//.test(s)) linuxAbsPathCount++;
    if (/\.kill\(/.test(s) && !/taskkill/.test(s)) bareKillCount++;
    if (/chromium\.launch/.test(s) && !/finally/.test(s)) noFinallyCloseCount++;
    if (/github\.io\/boreal/.test(s)) externalPagesCount++;
    if (rel === 'tools/t0135-shot.mjs' && s.indexOf('notes.push') < s.indexOf('const notes = []')) tdzNotesBug = true;
  }
  const buildWasmSrc = read('tools/build-wasm.mjs');
  const buildWasmValidatesOutputAndDocs = /0x00.*0x61.*0x73.*0x6d|WebAssembly\.validate/.test(buildWasmSrc) && !/TypeScript fallback/.test(buildWasmSrc);

  const autoplayTestSrc = read('tests/slow/autoplay.test.ts');
  const autoplaySrc = read('src/input/autoplay.ts');
  const indexHtmlSrc = read('index.html');

  const autoplayTestLinuxChromeOnly = /\/usr\/bin\/google-chrome/.test(autoplayTestSrc) && !/Program Files/.test(autoplayTestSrc);
  const autoplayTestOutsideRepoPaths = /\/opt\/cursor\/artifacts|\/tmp\/autoplay-video/.test(autoplayTestSrc);
  const autoplayTestNonWinVite = /node_modules\/\.bin\/vite/.test(autoplayTestSrc) && !/\.cmd|shell:\s*true/.test(autoplayTestSrc);
  const autoplayTestHardcodedPort5217 = /const port = 5217;/.test(autoplayTestSrc);
  const autoplayTestPortableAndClean = !autoplayTestLinuxChromeOnly && !autoplayTestOutsideRepoPaths && !autoplayTestNonWinVite && !autoplayTestHardcodedPort5217;

  const indexStaleNoHunting = /collision, hunting, trading and construction are not implemented/.test(indexHtmlSrc);
  const autoplayTextTypo = /Approach as individual/.test(autoplaySrc);
  const infoAndAutoplayCopyConsistent = !indexStaleNoHunting && !autoplayTextTypo;

  // --- Live Headless Chromium Inspection (Frames 0-2, WebM Recording, Exact DOM Overlap Measurements) ---
  if (!EXECUTABLE) throw new Error('No Chrome/Edge executable found');
  const consoleErrors: string[] = [];
  let framesCaptured = 0;
  let recordingBytes = 0;
  let globeLoadingPresent = true;
  let globeDrawn = 0;
  let dataOverlapsBrandPx2 = 0;
  let camOverlapsLibraryPx2 = 0;
  let camOverlapsExportPx2 = 0;
  let targetOverlapsStatusPx2 = 0;
  let hintClippedPx = 0;
  let medianFrameMs = 0;
  let autoplayStepCount = 0;

  const browser = await chromium.launch({
    executablePath: EXECUTABLE,
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });

  try {
    // Frame 0: Live Globe View (?view=globe&seed=1400&noprobe=1&stages=1)
    const p0 = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    p0.on('console', m => { if (m.type() === 'error') consoleErrors.push(`globe: ${m.text()}`); });
    p0.on('pageerror', e => consoleErrors.push(`globe: ${e.message}`));
    await p0.goto(`${BASE}/?view=globe&seed=1400&noprobe=1&stages=1`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    for (let i = 0; i < 40; i++) {
      globeDrawn = await p0.evaluate(() => (window as unknown as { __globe?: { stats?: () => { drawn: number } } }).__globe?.stats?.()?.drawn ?? 0).catch(() => 0);
      if (globeDrawn > 8) break;
      await p0.waitForTimeout(500);
    }
    await p0.waitForTimeout(2000);
    globeLoadingPresent = await p0.evaluate(() => !!document.getElementById('loading'));
    await p0.screenshot({ path: join(HERE, 'frame-0-live-globe-view.png') });
    framesCaptured++;
    await p0.close();

    // Frames 1 & 2 + Live WebM Recording: Ground forest gameplay (?nomenu&seed=1400&noprobe=1&stages=1&trees=v2)
    const p1 = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    p1.on('console', m => { if (m.type() === 'error') consoleErrors.push(`ground: ${m.text()}`); });
    p1.on('pageerror', e => consoleErrors.push(`ground: ${e.message}`));
    await p1.goto(`${BASE}/?nomenu&seed=1400&noprobe=1&stages=1&trees=v2`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const deadline = Date.now() + 90000;
    while (Date.now() < deadline) {
      const up = await p1.evaluate(() => !!document.getElementById('loading')).catch(() => true);
      if (!up) break;
      await p1.waitForTimeout(500);
    }
    await p1.waitForTimeout(2500);

    const hudMetrics = await p1.evaluate(`(async () => {
      const dts = [];
      let prev = performance.now();
      for (let i = 0; i < 10; i++) {
        await new Promise(r => requestAnimationFrame(r));
        const now = performance.now();
        dts.push(now - prev);
        prev = now;
      }
      dts.sort((a, b) => a - b);
      const rect = (el) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, w: r.width, h: r.height };
      };
      const overlap = (a, b) => {
        if (!a || !b) return 0;
        const ox = Math.max(0, Math.min(a.right, b.right) - Math.max(a.x, b.x));
        const oy = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y));
        return Math.round(ox * oy);
      };
      const dataBtn = [...document.querySelectorAll('button')].find(b => /Data \\(U\\)/.test(b.textContent ?? '')) ?? null;
      const header = document.querySelector('header');
      const camPanel = document.getElementById('camera-panel');
      const libBtn = document.getElementById('help');
      const expBtn = document.getElementById('export');
      const target = document.getElementById('target');
      const status = document.getElementById('status');
      const hint = document.getElementById('device');
      return {
        medianFrameMs: Math.round(dts[Math.floor(dts.length / 2)] * 10) / 10,
        dataOverlapsBrandPx2: overlap(rect(dataBtn), rect(header)),
        camOverlapsLibraryPx2: overlap(rect(camPanel), rect(libBtn)),
        camOverlapsExportPx2: overlap(rect(camPanel), rect(expBtn)),
        targetOverlapsStatusPx2: overlap(rect(target), rect(status)),
        hintClippedPx: hint ? Math.max(0, Math.round(hint.scrollHeight - hint.clientHeight)) : 0,
      };
    })()`) as {
      medianFrameMs: number;
      dataOverlapsBrandPx2: number;
      camOverlapsLibraryPx2: number;
      camOverlapsExportPx2: number;
      targetOverlapsStatusPx2: number;
      hintClippedPx: number;
    };
    medianFrameMs = hudMetrics.medianFrameMs;
    dataOverlapsBrandPx2 = hudMetrics.dataOverlapsBrandPx2;
    camOverlapsLibraryPx2 = hudMetrics.camOverlapsLibraryPx2;
    camOverlapsExportPx2 = hudMetrics.camOverlapsExportPx2;
    targetOverlapsStatusPx2 = hudMetrics.targetOverlapsStatusPx2;
    hintClippedPx = hudMetrics.hintClippedPx;

    await p1.screenshot({ path: join(HERE, 'frame-1-live-forest-wolf-ground.png') });
    framesCaptured++;

    // Record 3.5 s live WebM gameplay clip (walking + opening Chronometer)
    await p1.evaluate(() => {
      const c = (document.getElementById('world') ?? document.querySelector('canvas')) as HTMLCanvasElement | null;
      if (!c || !c.captureStream) return;
      const stream = c.captureStream(20);
      const chunks: Blob[] = [];
      const rec = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' });
      rec.ondataavailable = e => { if (e.data && e.data.size > 0) chunks.push(e.data); };
      rec.start(200);
      (window as unknown as { __auditRec: { rec: MediaRecorder; chunks: Blob[] } }).__auditRec = { rec, chunks };
    });

    await p1.keyboard.down('KeyW');
    await p1.waitForTimeout(2200);
    await p1.keyboard.up('KeyW');
    await p1.keyboard.press('KeyT');
    await p1.waitForTimeout(1000);
    await p1.screenshot({ path: join(HERE, 'frame-2-live-hud-chronometer-senses.png') });
    framesCaptured++;
    await p1.keyboard.press('KeyT');
    await p1.waitForTimeout(400);

    const b64 = await p1.evaluate(async () => {
      const r = (window as unknown as { __auditRec?: { rec: MediaRecorder; chunks: Blob[] } }).__auditRec;
      if (!r) return '';
      if (r.rec.state === 'recording') {
        try { r.rec.requestData(); } catch {}
        await new Promise<void>(resolve => { r.rec.onstop = () => resolve(); r.rec.stop(); });
      }
      const blob = new Blob(r.chunks, { type: 'video/webm' });
      const buf = new Uint8Array(await blob.arrayBuffer());
      let bin = '';
      for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      return btoa(bin);
    });
    if (b64 && b64.length > 0) {
      const raw = Buffer.from(b64, 'base64');
      writeFileSync(join(HERE, 'recording.webm'), raw);
      recordingBytes = raw.length;
    }
    await p1.close();

    // Quick ?autoplay=1 live probe
    const p2 = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    p2.on('console', m => {
      if (m.text().startsWith('AUTOPLAY ')) autoplayStepCount++;
      if (m.type() === 'error') consoleErrors.push(`autoplay: ${m.text()}`);
    });
    p2.on('pageerror', e => consoleErrors.push(`autoplay: ${e.message}`));
    await p2.goto(`${BASE}/?autoplay=1&noprobe=1`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await p2.waitForTimeout(5000);
    await p2.close();
  } finally {
    await browser.close();
  }

  const dataBtnClearOfHeader = dataOverlapsBrandPx2 === 0;
  const cameraPanelClearOfFooter = camOverlapsLibraryPx2 === 0 && camOverlapsExportPx2 === 0;
  const targetClearOfStatus = targetOverlapsStatusPx2 === 0;
  const controlsHintUnclipped = hintClippedPx === 0;
  const globeRemovesLoadingOverlay = !globeLoadingPresent;

  const c1Score = scoreCheck1({
    dataBtnClearOfHeader,
    cameraPanelClearOfFooter,
    targetClearOfStatus,
    controlsHintUnclipped,
    globeRemovesLoadingOverlay,
    autoplayTestPortableAndClean,
    infoAndAutoplayCopyConsistent,
  });

  const c2Score = scoreCheck2({
    journeyGlideFacesForward,
    snapYawMatchesRightHandDoc,
    journeyDarkPhaseReachableAndReversible,
    vrSessionCleansOverlayOnError,
    forestSessionSafeLifecycleAndTerrain,
    vrGlobeAndMuzzleProcedural,
  });

  const c3Score = scoreCheck3({
    mixerRejectsNaNLevel,
    borealSoundSafeHotkeysAssetAndWater,
    musicNoRaceLeakOrPulseLatch,
    bigBangClosesCtxAndClampsVol,
    hapticsClampsRumbleAndUsesTarget,
    sensesSpeciesRangeAndStableKeys,
    uiListenersClampAndSignEntry,
  });

  const c4Score = scoreCheck4({
    harnessesPortableBrowser: hardcodedBrowserCount === 0,
    harnessesUseFileUrlToPath: urlPathnameBugCount === 0,
    harnessesAvoidForbiddenPortsAndLinuxPaths: hardcoded5173Count === 0 && forbiddenPort5199Count === 0 && linuxAbsPathCount === 0 && externalPagesCount === 0,
    harnessesSafeTeardownAndNoTdz: bareKillCount === 0 && noFinallyCloseCount === 0 && !tdzNotesBug,
    buildWasmValidatesOutputAndDocs,
  });

  const hudLayoutVisualMatch = dataBtnClearOfHeader && cameraPanelClearOfFooter && targetClearOfStatus && controlsHintUnclipped;
  const c5Score = scoreCheck5({
    consoleErrors: consoleErrors.length,
    framesCaptured,
    recordingBytes,
    globeVisualMatch: false, // live frame-0 vs ref-0: pixelated land, blocky clouds, no visible aurora/airglow, unstyled checkboxes
    forestGroundVisualMatch: false, // live frame-1/2 vs ref-1: flat mustard void, 3 palm-frond poles, missing wolf on spawn, sparse grass only on right
    hudLayoutVisualMatch,
  });

  // Calibrate every check on known-match (1.0) and known-mismatch (0.0)
  const checks: CheckResult[] = [
    {
      id: 'gameplay-hud-layout-and-autoplay',
      label: 'Live 720p gameplay HUD overlap/clipping, globe #loading cleanup & autoplay portability',
      measured: `dataOverlap=${dataOverlapsBrandPx2}px2, camOverlapLib=${camOverlapsLibraryPx2}px2, camOverlapExp=${camOverlapsExportPx2}px2, targetOverlapStatus=${targetOverlapsStatusPx2}px2, hintClip=${hintClippedPx}px, globeLoadingDOM=${globeLoadingPresent}, autoplayTestPortable=${autoplayTestPortableAndClean}, infoStale=${indexStaleNoHunting}`,
      expected: '0 px2 HUD overlaps, 0 px controls hint clip, globe removes #loading, cross-platform autoplay test & accurate #info copy',
      score: c1Score,
      knownMatchScore: scoreCheck1({
        dataBtnClearOfHeader: true, cameraPanelClearOfFooter: true, targetClearOfStatus: true,
        controlsHintUnclipped: true, globeRemovesLoadingOverlay: true, autoplayTestPortableAndClean: true,
        infoAndAutoplayCopyConsistent: true,
      }),
      knownMismatchScore: scoreCheck1({
        dataBtnClearOfHeader: false, cameraPanelClearOfFooter: false, targetClearOfStatus: false,
        controlsHintUnclipped: false, globeRemovesLoadingOverlay: false, autoplayTestPortableAndClean: false,
        infoAndAutoplayCopyConsistent: false,
      }),
      pass: c1Score >= 0.95,
      source: 'W3C WCAG 2.1 Reflow (1.4.10) & Boreal AGENTS.md / Rule 18 (#110) / live 1280x720 DOM bounding boxes',
    },
    {
      id: 'vr-hands-journey-and-forest-session',
      label: 'WebXR hands-only VR journey & forestSession orientation, lifecycle and terrain raycast',
      measured: `journeyGlideForward=${journeyGlideFacesForward} (atan2(dx,dz) 180deg flip), snapYaw(+1) fx=${forwardXAfterRightTurn.toFixed(3)} (expected >0 right, headingEast=${headingEast?.toFixed(3)}), darkReachable=${!journeyCallsBeginInCtor}, errOverlayCleaned=${vrSessionCleansOverlayOnError}, doublePawMeasure=${forestSessionDoublePawMeasure}, heightAtUsed=${forestSessionUsesHeightAt}`,
      expected: 'Forward -Z facing atan2(-dx,-dz), snapYaw(+1) turns right (+x), reachable/reversible phases, overlay cleaned on error, terrain raycast & single pawMeasure',
      score: c2Score,
      knownMatchScore: scoreCheck2({
        journeyGlideFacesForward: true, snapYawMatchesRightHandDoc: true, journeyDarkPhaseReachableAndReversible: true,
        vrSessionCleansOverlayOnError: true, forestSessionSafeLifecycleAndTerrain: true, vrGlobeAndMuzzleProcedural: true,
      }),
      knownMismatchScore: scoreCheck2({
        journeyGlideFacesForward: false, snapYawMatchesRightHandDoc: false, journeyDarkPhaseReachableAndReversible: false,
        vrSessionCleansOverlayOnError: false, forestSessionSafeLifecycleAndTerrain: false, vrGlobeAndMuzzleProcedural: false,
      }),
      pass: c2Score >= 0.95,
      source: 'W3C WebXR Device API & Hand Input Level 1 + Three.js right-handed -Z forward convention (forestHands.ts:4)',
    },
    {
      id: 'audio-mixer-music-haptics-and-ui',
      label: 'Audio mixer/music/bigBang/borealSound, W3C Gamepad haptics & unaudited UI controls',
      measured: `masterAfterNaN=${String(masterAfterNaN)}, hapticsStrong=${capturedStrong.toFixed(2)} (>1.0 unclamped), customTargetRumble=${customTargetGotRumble}, signToggle=${signToggleHandled}, camBadN=${String(badCamState.cam.N)}, wolfRangeHardcoded=${sensesHardcodesWolfTraceRange}, captureListenerFixed=${appearanceRemovesCaptureListener}`,
      expected: 'NaN-safe mixer, modifier-safe asset() audio, leak/race-free music & bigBang, [0,1] clamped target-routed haptics, species-aware senses, sign toggle & clean UI listeners',
      score: c3Score,
      knownMatchScore: scoreCheck3({
        mixerRejectsNaNLevel: true, borealSoundSafeHotkeysAssetAndWater: true, musicNoRaceLeakOrPulseLatch: true,
        bigBangClosesCtxAndClampsVol: true, hapticsClampsRumbleAndUsesTarget: true, sensesSpeciesRangeAndStableKeys: true,
        uiListenersClampAndSignEntry: true,
      }),
      knownMismatchScore: scoreCheck3({
        mixerRejectsNaNLevel: false, borealSoundSafeHotkeysAssetAndWater: false, musicNoRaceLeakOrPulseLatch: false,
        bigBangClosesCtxAndClampsVol: false, hapticsClampsRumbleAndUsesTarget: false, sensesSpeciesRangeAndStableKeys: false,
        uiListenersClampAndSignEntry: false,
      }),
      pass: c3Score >= 0.95,
      source: 'W3C Web Audio API (AudioParam finite / cancelAndHoldAtTime), HTMLMediaElement volume [0,1], W3C Gamepad Haptics [0,1] & Mech 1970 species scent ranges',
    },
    {
      id: 'remaining-mjs-harnesses-and-wasm-build',
      label: 'Remaining 14 browser .mjs harnesses portability/teardown & tools/build-wasm.mjs validation',
      measured: `hardcodedBrowser=${hardcodedBrowserCount}/14, urlPathnameWinBug=${urlPathnameBugCount}, hardcoded5173=${hardcoded5173Count}, port5199=${forbiddenPort5199Count}, linuxPaths=${linuxAbsPathCount}, bareKill=${bareKillCount}, noFinallyClose=${noFinallyCloseCount}, externalPages=${externalPagesCount}, tdzNotes=${tdzNotesBug}, wasmValidates=${buildWasmValidatesOutputAndDocs}`,
      expected: '0 hardcoded browsers, fileURLToPath on all ESM paths, no :5173/5199 or /tmp|/agent paths, clean try/finally + Windows tree kill, validated WASM build',
      score: c4Score,
      knownMatchScore: scoreCheck4({
        harnessesPortableBrowser: true, harnessesUseFileUrlToPath: true, harnessesAvoidForbiddenPortsAndLinuxPaths: true,
        harnessesSafeTeardownAndNoTdz: true, buildWasmValidatesOutputAndDocs: true,
      }),
      knownMismatchScore: scoreCheck4({
        harnessesPortableBrowser: false, harnessesUseFileUrlToPath: false, harnessesAvoidForbiddenPortsAndLinuxPaths: false,
        harnessesSafeTeardownAndNoTdz: false, buildWasmValidatesOutputAndDocs: false,
      }),
      pass: c4Score >= 0.95,
      source: 'Node.js fileURLToPath cross-platform ESM spec, Boreal House Rules (ports 5173-5209 forbidden, kill browsers), WebAssembly binary magic 0x0061736d',
    },
    {
      id: 'live-visual-fidelity-and-recording',
      label: 'Live Chromium gameplay recording & 3 frames vs real-world Earth/boreal-wolf/HUD references',
      measured: `consoleErrors=${consoleErrors.length}, frames=${framesCaptured}/3, recordingBytes=${recordingBytes}, medianFrameMs=${medianFrameMs}, globeDrawn=${globeDrawn}, autoplaySteps=${autoplayStepCount}, totalHudOverlapPx2=${dataOverlapsBrandPx2 + camOverlapsLibraryPx2 + camOverlapsExportPx2 + targetOverlapsStatusPx2}`,
      expected: '0 console errors, 3/3 frames, WebM >10 kB, >=95% match to ref-0 (NASA Earth), ref-1 (Kenora boreal forest + wolf), ref-2 (clean non-overlapping HUD)',
      score: c5Score,
      knownMatchScore: scoreCheck5({
        consoleErrors: 0, framesCaptured: 3, recordingBytes: 120000,
        globeVisualMatch: true, forestGroundVisualMatch: true, hudLayoutVisualMatch: true,
      }),
      knownMismatchScore: scoreCheck5({
        consoleErrors: 2, framesCaptured: 0, recordingBytes: 0,
        globeVisualMatch: false, forestGroundVisualMatch: false, hudLayoutVisualMatch: false,
      }),
      pass: c5Score >= 0.95,
      source: 'Rule 6 & Rule 11 live frame-by-frame comparison against reference/ref-0..2.jpg',
    },
  ];

  const calibrationValid = checks.every(c => c.knownMatchScore === 1 && c.knownMismatchScore === 0);
  const passCount = checks.filter(c => c.pass).length;
  const meanScore = checks.reduce((s, c) => s + c.score, 0) / checks.length;

  const summary = {
    audit: 'T-0290',
    baseUrl: BASE,
    capturedAt: new Date().toISOString(),
    calibrationValid,
    passCount,
    totalChecks: checks.length,
    meanScore: Number(meanScore.toFixed(4)),
    consoleErrors,
    recordingBytes,
    checks,
  };

  writeFileSync(join(HERE, 'numbers.json'), JSON.stringify(summary, null, 2) + '\n');
  console.log(JSON.stringify(summary, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
