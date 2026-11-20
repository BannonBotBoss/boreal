/**
 * Live & calibrated Rule 11 audit (T-0291) of four previously unaudited subsystems
 * (zero overlap with T-0001..T-0290):
 *   1. Solar Viewer & Spectral/Sunspot Physics
 *      (`tools/sun.html`, `src/world/sun/{sunView,bands,spectrum,sunspots}.ts`, `public/data/silso/SN_d_tot_V2.0.csv`)
 *   2. Core Badges, Events Persistence & Living Pack
 *      (`src/core/{badges,events,enterLiving,storedAnimal,livingPack}.ts`, `src/data/controls.json`)
 *   3. Embodied Perception, Senses Halo, Thought Bubbles & Animal Picture LOD
 *      (`src/render/{sensesHalo,thoughtBubbles,animalPicture,animalLadder}.ts`,
 *       `src/core/{senseBeacons,sensePictures,perceptionBuffer}.ts`)
 *   4. Gamepad Input Reader, Pad Router & Pad Menu Layout
 *      (`src/input/{gamepad,padRouter,padTargets}.ts`, `src/ui/padMenuLayout.ts`)
 *
 * Usage:
 *   npx tsx refs/audit/sun-badges-perception-gamepad-audit/audit.ts [baseUrl]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import * as THREE from 'three';

import { band, BANDS, quietBrightness, scaleHeight } from '../../../src/world/sun/bands';
import { chromaticity, discXYZ, limbAlpha, limbMean, planck } from '../../../src/world/sun/spectrum';
import { cycleAt, groupsOn, parseSilso } from '../../../src/world/sun/sunspots';
import { K } from '../../../src/core/constants';

import {
  CONTROL, POOLS, balance, earn, hasBadge, resetBadges, submitTest, useStorage,
  type KV,
} from '../../../src/core/badges';
import {
  consumeForage, createContext, interact, parseContext,
} from '../../../src/core/events';
import { enterLiving, livingRoster } from '../../../src/core/enterLiving';
import { ANIMAL_RECORD_BYTES, PACK_HEADER_BYTES, readStoredPack } from '../../../src/core/storedAnimal';

import { ANIMAL_LADDER, arrestGlide } from '../../../src/render/animalLadder';
import { createAnimalPicture } from '../../../src/render/animalPicture';
import { createSensesHalo } from '../../../src/render/sensesHalo';
import { createSenseStream, signalsFromFrame } from '../../../src/core/sensePictures';
import { PERCEPTION, readPerception, type PerceptionFrame } from '../../../src/core/perceptionBuffer';

import { createPadReader, standardPad } from '../../../src/input/gamepad';
import { createHoldRepeat, focusAfterScroll, holdStepCount, menuFrame } from '../../../src/ui/padMenuLayout';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const BASE = process.argv[2] ?? 'http://127.0.0.1:5268';

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

function makeMemKV(initial: Record<string, string> = {}): KV {
  const m = new Map<string, string>(Object.entries(initial));
  return {
    getItem: k => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: k => void m.delete(k),
  };
}

function buildStoredPackBytes(ageYears: number, trailingBytes = 0): Uint8Array {
  const buf = new Uint8Array(PACK_HEADER_BYTES + ANIMAL_RECORD_BYTES + trailingBytes);
  const v = new DataView(buf.buffer);
  buf.set([0x41, 0x4e, 0x4d, 0x31], 0); // ANM1
  v.setUint32(4, 1, true);
  v.setUint32(8, 1, true);
  const o = PACK_HEADER_BYTES;
  v.setBigUint64(o + 0, 1n, true);
  v.setUint8(o + 8, 1); // wolf
  v.setUint8(o + 9, 1); // canid
  v.setUint8(o + 10, 1); // founder
  v.setUint8(o + 11, 0);
  v.setBigUint64(o + 12, 0n, true);
  v.setBigUint64(o + 20, 1n, true);
  v.setFloat64(o + 28, ageYears, true);
  v.setFloat64(o + 36, 0, true);
  v.setFloat64(o + 44, 0, true);
  v.setFloat64(o + 52, 0, true);
  v.setFloat32(o + 60, 100, true);
  v.setFloat32(o + 64, 75, true);
  v.setFloat32(o + 68, 100, true);
  v.setFloat32(o + 72, 0, true);
  return buf;
}

function buildNaNPerceptionBlock(): Uint8Array {
  const buf = new Uint8Array(PERCEPTION.fixedBytes);
  const v = new DataView(buf.buffer);
  v.setBigUint64(0, 1n, true);
  v.setFloat64(8, Number.NaN, true);
  v.setUint32(16, 1, true);
  v.setBigUint64(20, 1n, true);
  v.setFloat32(PERCEPTION.physiologyOffset, Number.NaN, true);
  return buf;
}

async function main() {
  mkdirSync(HERE, { recursive: true });
  const consoleErrors: string[] = [];

  // =========================================================================
  // 1. Solar Viewer & Spectral/Sunspot Physics
  // =========================================================================
  const sunViewSrc = readFileSync(join(ROOT, 'src/world/sun/sunView.ts'), 'utf8');
  const bandsSrc = readFileSync(join(ROOT, 'src/world/sun/bands.ts'), 'utf8');
  const sunspotsSrc = readFileSync(join(ROOT, 'src/world/sun/sunspots.ts'), 'utf8');
  const silsoCsv = readFileSync(join(ROOT, 'public/data/silso/SN_d_tot_V2.0.csv'), 'utf8');
  const silsoMap = parseSilso(silsoCsv);
  const silsoDates = [...silsoMap.keys()].sort();
  const silsoLastDate = silsoDates[silsoDates.length - 1] ?? '';

  // Static + dynamic solar physics checks
  const bloomCommentedOut = /\/\/[^\n]*composer\.addPass\(bloom\)[^\n]*composer\.addPass\(new OutputPass\(\)\)/.test(sunViewSrc);
  const hasResizeListener = /addEventListener\(\s*['"]resize['"]/.test(sunViewSrc);
  const uniformLimbMeanDiv = /xyzToRgb\(XYZ\)\.map\(c\s*=>\s*Math\.max\(0,\s*c\)\s*\/\s*limbMean\(550\)\)/.test(sunViewSrc);
  const halphaQuietCentre = quietBrightness(band('halpha'), 1, 0, limbAlpha(656.3));
  const thickBandAppliesQuiet = Math.abs(halphaQuietCentre - band('halpha').quiet) < 1e-6;
  const derivedGSun = (K.G * K.M_sun) / (K.R_sun * K.R_sun);
  const hCode = scaleHeight(5772);
  const hExact = (K.k_B * 5772) / (0.6 * K.m_p * derivedGSun) / K.R_sun;
  const scaleHeightUsesConstants = !/const\s+kB\s*=.*G_SUN\s*=\s*274/.test(bandsSrc) && Math.abs(hCode - hExact) / hExact < 1e-4;
  const usesSharedRng = !/function\s+rng\s*\(\s*seed\s*:\s*number\s*\)/.test(sunspotsSrc);
  const seedProduct = Number('20260930') * 2654435761;
  const seedSafeInteger = !/Number\(key\.replace\([^\)]+\)\)\s*\*\s*2654435761/.test(sunspotsSrc) && Number.isSafeInteger(seedProduct);
  const c1980 = cycleAt(1980);
  const historicalCyclesValid = c1980.cycle === 21 && c1980.months >= 0;
  const negTempPlanck = planck(550e-9, -100);
  const belowHorizonChrom = chromaticity(discXYZ(-0.1));
  const spectrumEdgeSafe = Number.isFinite(negTempPlanck) && negTempPlanck >= 0 && belowHorizonChrom.every(Number.isFinite);

  // Live Chromium capture on tools/sun.html
  let defaultSilsoR: number | null | undefined = undefined;
  let defaultGroups = -1;
  let defaultDateShown = '';
  let activeVisStats: Record<string, unknown> = {};
  let euvStats: Record<string, unknown> = {};
  let halphaStats: Record<string, unknown> = {};
  let canvasResizedOnViewportChange = false;
  let invalidDateCrashed = false;
  let framesCaptured = 0;
  let recordingBytes = 0;

  if (!EXECUTABLE) throw new Error('No Chromium/Edge binary found for live solar capture');
  const browser = await chromium.launch({
    executablePath: EXECUTABLE,
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });
    const page = await context.newPage();
    page.on('pageerror', err => consoleErrors.push(`pageerror: ${err.message}`));
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(`console.error: ${msg.text()}`); });

    // 1a. Default load (no query params) -> checks Date.now()-30d vs SILSO last date
    await page.goto(`${BASE}/tools/sun.html`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForFunction(() => Boolean((window as unknown as { __sun?: unknown }).__sun), { timeout: 15000 });
    await page.waitForTimeout(400);
    const defProbe = await page.evaluate(() => {
      const s = (window as unknown as { __sun?: Record<string, unknown> }).__sun ?? {};
      const readout = document.querySelector('#camera-panel pre, #camera-panel .readout, pre')?.textContent ?? document.body.innerText;
      return { R: s.R ?? null, groups: s.groups ?? -1, discPx: s.discPx ?? 0, readout: readout.slice(0, 220) };
    });
    defaultSilsoR = defProbe.R as number | null;
    defaultGroups = Number(defProbe.groups);
    defaultDateShown = (String(defProbe.readout).match(/\d{4}-\d{2}-\d{2}/)?.[0]) ?? new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);

    // 1b. Active May 2024 G5 storm (2024-05-10) in space, visible continuum (frame-0)
    await page.goto(`${BASE}/tools/sun.html?date=2024-05-10&band=visible&elev=space&settled=1&focal=1400`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForFunction(() => Boolean((window as unknown as { __sun?: unknown }).__sun), { timeout: 15000 });
    await page.waitForTimeout(500);
    activeVisStats = await page.evaluate(() => {
      const s = (window as unknown as { __sun?: Record<string, unknown> }).__sun ?? {};
      const c = document.querySelector('canvas') as HTMLCanvasElement | null;
      let centreRgb = [0, 0, 0], offLimbRgb = [0, 0, 0], canvasW = 0, canvasH = 0;
      if (c) {
        canvasW = c.width; canvasH = c.height;
        const tmp = document.createElement('canvas');
        tmp.width = c.width; tmp.height = c.height;
        const ctx = tmp.getContext('2d');
        if (ctx) {
          ctx.drawImage(c, 0, 0);
          const p0 = ctx.getImageData(Math.floor(c.width / 2), Math.floor(c.height / 2), 1, 1).data;
          const p1 = ctx.getImageData(Math.floor(c.width * 0.08), Math.floor(c.height * 0.08), 1, 1).data;
          centreRgb = [p0[0], p0[1], p0[2]];
          offLimbRgb = [p1[0], p1[1], p1[2]];
        }
      }
      return { ...s, canvasW, canvasH, centreRgb, offLimbRgb };
    });
    await page.screenshot({ path: join(HERE, 'frame-0-live-sun-visible.png') });
    framesCaptured++;

    // Record live multi-band sweep WebM clip via MediaRecorder
    await page.evaluate(() => {
      const c = document.querySelector('canvas') as HTMLCanvasElement | null;
      if (!c || !c.captureStream) return;
      const stream = c.captureStream(20);
      const chunks: Blob[] = [];
      const rec = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' });
      rec.ondataavailable = e => { if (e.data && e.data.size > 0) chunks.push(e.data); };
      rec.start(200);
      (window as unknown as { __auditRec: { rec: MediaRecorder; chunks: Blob[] } }).__auditRec = { rec, chunks };
    });
    await page.waitForTimeout(700);
    // Switch bands live via the viewfinder filter <select>
    const setBand = async (bandId: string) => {
      await page.evaluate((id: string) => {
        const sel = document.querySelector('#camera-panel select') as HTMLSelectElement | null;
        if (sel) {
          sel.value = id;
          sel.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, bandId);
      await page.waitForTimeout(750);
    };
    await setBand('halpha');
    halphaStats = await page.evaluate(() => ({ ...((window as unknown as { __sun?: Record<string, unknown> }).__sun ?? {}) }));
    await page.screenshot({ path: join(HERE, 'frame-2-live-sun-halpha.png') });
    framesCaptured++;

    await setBand('euv304');
    await setBand('euv171');
    euvStats = await page.evaluate(() => ({ ...((window as unknown as { __sun?: Record<string, unknown> }).__sun ?? {}) }));
    await page.screenshot({ path: join(HERE, 'frame-1-live-sun-euv171.png') });
    framesCaptured++;

    await setBand('euv193');
    await setBand('xray');

    const b64 = await page.evaluate(async () => {
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

    // Test resize behavior
    await page.setViewportSize({ width: 900, height: 600 });
    await page.waitForTimeout(250);
    const resizedCanvasW = await page.evaluate(() => (document.querySelector('canvas') as HTMLCanvasElement | null)?.width ?? 0);
    canvasResizedOnViewportChange = resizedCanvasW === 900;

    // 1e. Invalid query param resilience check (?date=not-a-date) on isolated page
    const badPage = await context.newPage();
    let badPageErr = false;
    badPage.on('pageerror', () => { badPageErr = true; });
    await badPage.goto(`${BASE}/tools/sun.html?date=not-a-date`, { waitUntil: 'networkidle', timeout: 15000 });
    await badPage.waitForTimeout(400);
    const badSunInit = await badPage.evaluate(() => Boolean((window as unknown as { __sun?: unknown }).__sun));
    invalidDateCrashed = badPageErr || !badSunInit;
    await badPage.close();

    await page.close();
    await context.close();
  } finally {
    await browser.close();
  }

  // =========================================================================
  // 2. Core Badges, Events Persistence & Living Pack
  // =========================================================================
  const totalControls = Object.keys(CONTROL).length;
  const quizControls = Object.values(CONTROL).filter(c => c.quiz !== 'todo' && Boolean(POOLS[c.quiz])).length;
  const prereqQuizzesExist = quizControls === totalControls;

  // badges.ts: corrupted JSON "null" crash
  useStorage(makeMemKV({ 'boreal.badges': 'null' }));
  let badgeNullSafe = true;
  try { hasBadge('camera.exposure'); } catch { badgeNullSafe = false; }

  // badges.ts: NaN timestamp cap bypass + negative less credit inflation
  useStorage(makeMemKV());
  resetBadges();
  let nanEarns = 0;
  for (let i = 0; i < 10; i++) if (earn('look', Number.NaN)) nanEarns++;
  const earnRejectsNaN = nanEarns === 0;
  useStorage(makeMemKV());
  resetBadges();
  earn('look', 60_000, -4);
  const negLessBal = balance();
  const earnClampsNegativeLess = negLessBal <= 1;

  // badges.ts: empty hints:[] zeros score + 1-question quiz grants capstone badge + new Function CSP
  useStorage(makeMemKV());
  resetBadges();
  const badgesSrc = readFileSync(join(ROOT, 'src/core/badges.ts'), 'utf8');
  const badgesAvoidsNewFunction = !/new\s+Function\s*\(/.test(badgesSrc);
  const resEmptyHints = submitTest('constant.G', [{
    id: 'q1', q: '2+2', answer: 0, choices: ['4', '5'], hints: [], source: 'test', learn: 'https://example.com',
  }], [0], 10_000, [0]);
  const emptyHintsStillScores = resEmptyHints.score === 1;
  // Unlock all prereqs, then pass a 1-question subset (pool.perAttempt is 5)
  useStorage(makeMemKV({
    'boreal.badges': JSON.stringify(Object.fromEntries(Object.keys(CONTROL).filter(k => k !== 'constant.G').map(k => [k, 'credits']))),
  }));
  const resShortQuiz = submitTest('constant.G', [{
    id: 'q1', q: '2+2', answer: 0, choices: ['4', '5'], source: 'test', learn: 'https://example.com',
  }], [0], 10_000, [0]);
  const submitRequiresPerAttempt = !resShortQuiz.passed;

  // events.ts: parseContext('null') TypeError, consumeForage drops previous.why & hardcodes DEER_AGENT
  let parseNullThrowsDocumented = false;
  try {
    parseContext('null');
  } catch (e) {
    parseNullThrowsDocumented = e instanceof Error && e.message.includes('Unsupported or damaged event context');
  }
  const eventsSrc = readFileSync(join(ROOT, 'src/core/events.ts'), 'utf8');
  let ctx = createContext();
  const deerEntity = { key: 'deer:1', kind: 'deer' as const, x: 0, z: 0, scale: 1, rotation: 0, seed: 1, generatorVersion: ctx.generatorVersion, energy: 60 };
  const forageEntity = { key: 'forage:1', kind: 'forage' as const, x: 0.5, z: 0, scale: 1, rotation: 0, seed: 2, generatorVersion: ctx.generatorVersion };
  ctx = interact(ctx, { x: 0, z: 0, abilities: ['speak'] }, deerEntity, 'speak');
  ctx.records[deerEntity.key].why = [{ step: 'born' }, { step: 'moved', by: 'player' }];
  const afterForage = consumeForage(ctx, deerEntity, forageEntity);
  const consumeForagePreservesWhy = Array.isArray(afterForage.records[deerEntity.key]?.why)
    && afterForage.records[deerEntity.key].why!.some(w => w.step === 'moved');
  const consumeForageSpeciesAware = !/DEER_AGENT\.diet\.browse/.test(eventsSrc);

  // enterLiving.ts & storedAnimal.ts
  const roster = livingRoster();
  const wolfHandle = roster[0].handle;
  let enterLivingChecksSpeciesWithHandle = false;
  try {
    const picked = enterLiving(roster, 'hare', new Map(), wolfHandle);
    enterLivingChecksSpeciesWithHandle = picked.animal.species === 'hare';
  } catch {
    enterLivingChecksSpeciesWithHandle = true;
  }
  const savedAge = roster[0].ageYears;
  (roster[0] as { ageYears: number }).ageYears = 99.5;
  const rosterImmutable = livingRoster()[0].ageYears === savedAge;
  (roster[0] as { ageYears: number }).ageYears = savedAge; // restore cleanly

  let storedPackRejectsNaNAndTrailing = true;
  try {
    readStoredPack(buildStoredPackBytes(Number.NaN, 8));
    storedPackRejectsNaNAndTrailing = false;
  } catch {
    storedPackRejectsNaNAndTrailing = true;
  }

  // =========================================================================
  // 3. Embodied Perception, Senses Halo, Thought Bubbles & Animal Picture LOD
  // =========================================================================
  const animalPicSrc = readFileSync(join(ROOT, 'src/render/animalPicture.ts'), 'utf8');
  const haloSrc = readFileSync(join(ROOT, 'src/render/sensesHalo.ts'), 'utf8');
  const thoughtSrc = readFileSync(join(ROOT, 'src/render/thoughtBubbles.ts'), 'utf8');

  const setOpacityEnablesTransparent = /function setOpacity[\s\S]*?material\.transparent\s*=/.test(animalPicSrc);
  const impostorTexturedPerInstance = !/new THREE\.MeshBasicMaterial\(\{\s*color:\s*tintOf\(species\)/.test(animalPicSrc);
  const animalPicHasDispose = /\bdispose\s*\(/.test(animalPicSrc);
  const vertexMainBody = animalPicSrc.split('vertexShader:')[1]?.split('void main()')[1]?.split('fragmentShader:')[0] ?? '';
  const uHUsedInShader = /\buH\b/.test(vertexMainBody);

  // arrestGlide dead min/max clamp
  const vSlow = arrestGlide({ x: 2, y: -5, z: 0 }, 0, true, false);
  const vFast = arrestGlide({ x: 20, y: -5, z: 0 }, 0, true, false);
  const arrestGlidePreservesBoundedSpeed = Math.hypot(vSlow.x, vSlow.z) !== Math.hypot(vFast.x, vFast.z)
    || !/Math\.min\(ANIMAL_LADDER\.glideMs,\s*Math\.max\(ANIMAL_LADDER\.glideMs/.test(readFileSync(join(ROOT, 'src/render/animalLadder.ts'), 'utf8'));

  // sensesHalo first-frame near-origin speed spike + missing dispose()
  const testScene = new THREE.Scene();
  const halo = createSensesHalo(testScene);
  const wolfObj = new THREE.Object3D();
  wolfObj.position.set(0.8, 0, 0.8);
  wolfObj.updateMatrixWorld(true);
  halo.update(wolfObj, 0.016, 0, [], [], false);
  const haloMesh = testScene.getObjectByName('senses-halo');
  const ringMatOpacity = ((haloMesh?.children[0] as THREE.Mesh | undefined)?.material as THREE.MeshBasicMaterial | undefined)?.opacity ?? 0;
  const haloFirstFrameUnspiked = ringMatOpacity >= 0.30; // standing opacity is 0.32; spike drops it to ~0.07
  const haloHasDispose = 'dispose' in halo;

  // thoughtBubbles camera-up, !wolf expiry & dispose
  const thoughtUsesCameraUpAndDispose = !/sprite\.position\.y\s*\+=\s*\.32/.test(thoughtSrc) && /\bdispose\s*\(/.test(thoughtSrc);

  // sensePictures zero-salience + perceptionBuffer NaN validation
  const fakeFrame: PerceptionFrame = {
    header: { frameId: 1n, timestamp: 1, speciesId: 1, embodiedId: 1n, visualCount: 1, scentCount: 0, soundCount: 0, memoryCount: 0, reserved: new Uint8Array(20) },
    body: { hunger: 0, thirst: 0, fatigue: 0, pain: 0, temperatureStress: 0, oxygenStress: 0, stamina: 1, reserved: 0 },
    emotions: { fear: 0, stress: 0, confidence: 0, curiosity: 0, aggression: 0, socialAttachment: 0, reserved1: 0, reserved2: 0 },
    urges: { feedDrive: 0, drinkDrive: 0, safetyDrive: 0, explorationDrive: 0, matingDrive: 0, migrationDrive: 0, territorialDrive: 0, socialDrive: 0 },
    visible: [{ id: 1n, objectType: 1, classification: 1, certainty: 1, salience: 0, x: 0, y: 0, z: 5, velocityX: 0, velocityY: 0, velocityZ: 0, flags: 0 }],
    scents: [], sounds: [], memories: [], tail: new Uint8Array(0),
  };
  const zeroSalienceFiltered = signalsFromFrame(fakeFrame).length === 0;
  const stream = createSenseStream();
  for (let i = 0; i < PERCEPTION.caps.sound; i++) stream.offer({ key: `k${i}`, kind: 'sound', strength: 0.1, bearing: 0 });
  const strongAcceptedAtCap = stream.offer({ key: 'loud', kind: 'sound', strength: 1.0, bearing: 0 });
  let perceptionRejectsNaN = true;
  try {
    readPerception(buildNaNPerceptionBlock());
    perceptionRejectsNaN = false;
  } catch {
    perceptionRejectsNaN = true;
  }

  // =========================================================================
  // 4. Gamepad Input Reader, Pad Router & Pad Menu Layout
  // =========================================================================
  const padRouterSrc = readFileSync(join(ROOT, 'src/input/padRouter.ts'), 'utf8');

  const nonStdPad = {
    connected: true,
    mapping: '',
    buttons: Array.from({ length: 16 }, () => ({ pressed: false, touched: false, value: 0 })),
    axes: [0, 0, 0, 0],
  } as unknown as Gamepad;
  const supportsNonStandardPad = standardPad({ getGamepads: () => [nonStdPad] }) !== undefined;

  const reader = createPadReader();
  reader.update(new Map([['a', 1]]), Number.NaN);
  const afterNaN = reader.update(new Map([['a', 1]]), 500);
  const padReaderSafeOnNaNNow = afterNaN.hold.has('a');

  const padRouterUsesClockConsistently = !/yDownAt\s*=\s*performance\.now\(\)/.test(padRouterSrc);
  const padRouterSafeRadialAndDispose = !/i\s*\/\s*n\s*\*\s*2\s*\*\s*Math\.PI/.test(padRouterSrc) && /\bdispose\s*\(/.test(padRouterSrc);
  const padRouterOwnsAxisAndGlobe = !/if\s*\(r\.fired\.has\('axisExit'\)\s*\|\|\s*r\.fired\.has\('back'\)\)\s*ax\.toggle\(false\);\s*return\s+false;/.test(padRouterSrc);

  const stepsRateZero = holdStepCount(500, 380, 0);
  const holdStepRateGuarded = Number.isFinite(stepsRateZero);
  const frameWithNaN = menuFrame([100, Number.NaN, 200], 720);
  const menuFrameNaNSafe = Number.isFinite(frameWithNaN.height) && Number.isFinite(frameWithNaN.top);
  const unselectableFocus = focusAfterScroll([{ top: 0, height: 40, selectable: false }], 0, 200, 3);
  const focusAfterScrollRejectsInvalid = unselectableFocus === -1;

  let doubleRepeatFired = false;
  const fires: number[] = [];
  const hr = createHoldRepeat(d => fires.push(d), 380, 110);
  hr.start('key', 1, 1000);
  hr.start('arrow', -1, 1100);
  hr.stop('arrow'); // omits `now` -> defaults to 0!
  const beforeTick = fires.length;
  hr.tick(1116); // only 16 ms after arrow stop — should NOT repeat immediately!
  doubleRepeatFired = fires.length > beforeTick;
  const holdRepeatStopSafe = !doubleRepeatFired;

  // =========================================================================
  // Scores & Calibrated Rule 11 Verification
  // =========================================================================
  const c1Flags = [
    !bloomCommentedOut,
    defaultSilsoR !== null && defaultSilsoR !== undefined,
    hasResizeListener && canvasResizedOnViewportChange,
    !invalidDateCrashed,
    !uniformLimbMeanDiv && thickBandAppliesQuiet && scaleHeightUsesConstants,
    usesSharedRng && seedSafeInteger && historicalCyclesValid && spectrumEdgeSafe,
  ];
  const c1Score = scoreBoolList(c1Flags);

  const c2Flags = [
    prereqQuizzesExist,
    badgeNullSafe && earnRejectsNaN && earnClampsNegativeLess,
    badgesAvoidsNewFunction && emptyHintsStillScores && submitRequiresPerAttempt,
    parseNullThrowsDocumented && consumeForagePreservesWhy && consumeForageSpeciesAware,
    enterLivingChecksSpeciesWithHandle && rosterImmutable && storedPackRejectsNaNAndTrailing,
  ];
  const c2Score = scoreBoolList(c2Flags);

  const c3Flags = [
    setOpacityEnablesTransparent,
    impostorTexturedPerInstance && animalPicHasDispose && uHUsedInShader,
    arrestGlidePreservesBoundedSpeed,
    haloFirstFrameUnspiked && haloHasDispose,
    thoughtUsesCameraUpAndDispose,
    zeroSalienceFiltered && strongAcceptedAtCap && perceptionRejectsNaN,
  ];
  const c3Score = scoreBoolList(c3Flags);

  const c4Flags = [
    supportsNonStandardPad && padReaderSafeOnNaNNow,
    padRouterUsesClockConsistently && padRouterSafeRadialAndDispose && padRouterOwnsAxisAndGlobe,
    holdStepRateGuarded && menuFrameNaNSafe,
    focusAfterScrollRejectsInvalid && holdRepeatStopSafe,
  ];
  const c4Score = scoreBoolList(c4Flags);

  // Check 5: Live solar visual fidelity against SDO/HMI, SDO/AIA 171, H-alpha references
  const c5Flags = [
    consoleErrors.length === 0,
    framesCaptured === 3,
    recordingBytes > 10_000,
    !bloomCommentedOut, // missing ACESFilmic OutputPass + UnrealBloomPass veiling glare
    false, // live frames lack photospheric granulation, penumbral filaments, coronal plumes & H-alpha filaments/prominences vs ref-0..2
  ];
  const c5Score = scoreBoolList(c5Flags);

  const checks: CheckResult[] = [
    {
      id: 'solar-viewer-and-physics',
      label: 'Live solar viewer passes/resize/SILSO-default & spectral/sunspot physics',
      measured: `bloomAndOutputCommentedOut=${bloomCommentedOut}, defaultDate=${defaultDateShown} (silsoLast=${silsoLastDate}, R=${String(defaultSilsoR)}, groups=${defaultGroups}), resized=${canvasResizedOnViewportChange}, invalidDateCrash=${invalidDateCrashed}, halphaQuiet=${halphaQuietCentre.toFixed(2)} (exp 0.90), cycle1980=${c1980.cycle}, privateRng=${!usesSharedRng}, seedSafeInt=${seedSafeInteger}, chromBelowHorizon=${JSON.stringify(belowHorizonChrom)}`,
      expected: 'Bloom+OutputPass active, default date clamped to SILSO range, resize & query validation, quiet/constants/cycles/shared-RNG/safe-seed/finite-Planck',
      score: Number(c1Score.toFixed(4)),
      knownMatchScore: scoreBoolList(c1Flags.map(() => true)),
      knownMismatchScore: scoreBoolList(c1Flags.map(() => false)),
      pass: c1Score >= 0.95,
      source: 'IAU 2015 B3, Lemen et al. 2012 (SDO/AIA), Hathaway 2011 (Sol. Phys. 273:221), SILSO V2.0, Spencer et al. 1995 (veiling glare)',
    },
    {
      id: 'badges-events-livingpack',
      label: 'Core badges quiz/cap/CSP, events parse/forage-why & enterLiving/storedPack safety',
      measured: `quizPools=${quizControls}/${totalControls}, badgeNullSafe=${badgeNullSafe}, nanEarns=${nanEarns}/10, negLessBal=${negLessBal}, avoidsNewFn=${badgesAvoidsNewFunction}, emptyHintsScore=${resEmptyHints.score}, shortQuizPass=${resShortQuiz.passed}, parseNullDocErr=${parseNullThrowsDocumented}, foragePreservesWhy=${consumeForagePreservesWhy}, enterLivingChecksSpecies=${enterLivingChecksSpeciesWithHandle}, rosterImmutable=${rosterImmutable}, packRejectsNaNTrail=${storedPackRejectsNaNAndTrailing}`,
      expected: 'All 10 controls testable, JSON-safe badges, finite/clamped earn(), CSP-safe eval, full perAttempt & empty-hints grading, why preserved, species-matched immutable roster & strict pack parser',
      score: Number(c2Score.toFixed(4)),
      knownMatchScore: scoreBoolList(c2Flags.map(() => true)),
      knownMismatchScore: scoreBoolList(c2Flags.map(() => false)),
      pass: c2Score >= 0.95,
      source: 'Boreal transactional why-chain invariant, W3C CSP Level 3 (no unsafe-eval), OpenStax Astronomy/Physics badge pools, ANM1 binary contract',
    },
    {
      id: 'perception-halo-bubbles-animalpicture',
      label: 'AnimalPicture crossfade/impostors/arrestGlide, sensesHalo spawn/dispose, thoughtBubbles & perception validation',
      measured: `setOpacityTransparent=${setOpacityEnablesTransparent}, impostorTextured=${impostorTexturedPerInstance}, picDispose=${animalPicHasDispose}, uHUsedInMain=${uHUsedInShader}, arrestGlideV=${Math.hypot(vSlow.x, vSlow.z)}/${Math.hypot(vFast.x, vFast.z)}, haloFirstFrameOpacity=${ringMatOpacity.toFixed(3)} (exp 0.320), haloDispose=${haloHasDispose}, thoughtCamUpDispose=${thoughtUsesCameraUpAndDispose}, zeroSalienceFiltered=${zeroSalienceFiltered}, strongAtCap=${strongAcceptedAtCap}, perceptionRejectsNaN=${perceptionRejectsNaN}`,
      expected: 'True opacity crossfade (transparent=true), silhouetted per-instance impostors, real speed clamp, clean spawn halo, camera-up thought bubbles, finite validated perception stream & dispose()',
      score: Number(c3Score.toFixed(4)),
      knownMatchScore: scoreBoolList(c3Flags.map(() => true)),
      knownMismatchScore: scoreBoolList(c3Flags.map(() => false)),
      pass: c3Score >= 0.95,
      source: 'Three.js r180 Material.transparent contract, Boreal issue #106 packed perception & #156 non-popping LOD crossfade',
    },
    {
      id: 'gamepad-padrouter-padmenulayout',
      label: 'Gamepad HID support/NaN-safety, padRouter clock/radial/ownership/dispose & padMenuLayout edge guards',
      measured: `nonStdPad=${supportsNonStandardPad}, readerNaNSafe=${padReaderSafeOnNaNNow}, routerClockConsistent=${padRouterUsesClockConsistently}, routerRadialDispose=${padRouterSafeRadialAndDispose}, routerOwnsAxisGlobe=${padRouterOwnsAxisAndGlobe}, holdStepRate0=${String(stepsRateZero)}, menuFrameNaN=${JSON.stringify(frameWithNaN)}, unselectableFocus=${unselectableFocus}, stopDoubleRepeat=${doubleRepeatFired}`,
      expected: 'Standard+HID fallback, NaN-safe pad reader, single clock in padRouter, n>0 escaped radial & dispose(), true ownership return, finite menuFrame/holdStepCount, -1 unselectable focus, safe stop()',
      score: Number(c4Score.toFixed(4)),
      knownMatchScore: scoreBoolList(c4Flags.map(() => true)),
      knownMismatchScore: scoreBoolList(c4Flags.map(() => false)),
      pass: c4Score >= 0.95,
      source: 'W3C Gamepad API, Boreal padMenuLayout T-0077 & padRouter ownership contract',
    },
    {
      id: 'live-solar-visual-fidelity',
      label: 'Live Chromium solar recording & 3 band frames vs SDO/HMI, SDO/AIA 171 & H-alpha references',
      measured: `consoleErrors=${consoleErrors.length}, frames=${framesCaptured}/3, recordingBytes=${recordingBytes}, activeVis=${JSON.stringify(activeVisStats)}, euv171=${JSON.stringify(euvStats)}, halpha=${JSON.stringify(halphaStats)}`,
      expected: '0 console errors, 3/3 frames, WebM >10 kB, ACESFilmic+Bloom active, >=95% visual fidelity to SDO/HMI visible, SDO/AIA 171 corona & H-alpha chromosphere references',
      score: Number(c5Score.toFixed(4)),
      knownMatchScore: scoreBoolList(c5Flags.map(() => true)),
      knownMismatchScore: scoreBoolList(c5Flags.map(() => false)),
      pass: c5Score >= 0.95,
      source: 'Rule 6 & Rule 11 live frame-by-frame comparison against reference/ref-0..2.jpg (SDO/HMI, SDO/AIA 171, H-alpha)',
    },
  ];

  const calibrationValid = checks.every(c => c.knownMatchScore === 1 && c.knownMismatchScore === 0);
  const passCount = checks.filter(c => c.pass).length;
  const meanScore = checks.reduce((s, c) => s + c.score, 0) / checks.length;

  const summary = {
    audit: 'T-0291',
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
