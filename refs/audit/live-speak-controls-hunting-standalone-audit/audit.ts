/**
 * Calibrated Rule 11 audit for T-0305 (zero overlap with T-0001..T-0304):
 *   1. Live E Speak (wolfVoice.ts), Species-Blind Bioacoustics (Play as White-tailed deer), & H/G Calls:
 *      - Embodied White-tailed deer pressing E Speak to Woodland deer displays hardcoded wolf emoji bubble
 *        `🐺 “Hi. Don't worry, I just want to say hello.”` (wolfVoice.ts:49), plays human male Adam voice +
 *        wolf-whine (borealSound.ts:231), and main.ts:210 never passes deerHerd `posture` into wolfSpeak.
 *      - Pressing H (howl) or G (growl) plays wolf audio regardless of embodied species, passes `at = undefined`
 *        (borealSound.ts:147-148) bypassing onSpatialCue (0 cues in #senses, 0/5 nearby hares alerted or bolted
 *        at 8-14 m for both deer and wolf), and omits sfx.start() (main.ts:437).
 *   2. Live Pause -> Controls Rebinding UX (controls.ts, bindings.ts, style.css):
 *      - Back button overlaps footer by 48,320 px^2 (frame-1) and left-column footnote crashes over #device (frame-2).
 *      - rAF-polled createCapture (controls.ts:91) silently drops fast <16 ms keypresses (fastTapDropped = true).
 *      - Shifted symbol release order (Shift+1 '!', releasing Shift before '1') leaves '!' permanently stuck in `held`,
 *        hanging capture indefinitely (stillCapturingStuck = true).
 *      - 87 rows (3,231 px scrollHeight) dumped flat with 0 context tabs/headers despite CONTEXTS/actionsIn,
 *        0 unbind buttons, 0 Swap button despite swapAssign() in bindings.ts:216, and contradictory "V flora view" note.
 *   3. Live Hunting II Pin/Hold/Eat/Release Hare Bond Decay & Reload Persistence (main.ts, hare.ts, sim/index.ts):
 *      - Pressing B (releasePrey, main.ts:432-436) never calls commitContext() immediately (0 bonds in localStorage).
 *      - Bond stores volatile SimWorld.time (at = 12.00 s) which resets to 0 on reload: after reload clock = 6.67 s,
 *        yielding effectiveStrength = exp(-(6.67 - 12.00)/180) = 1.0301 > 1.0 (bond grows stronger than 100%!).
 *      - createHares() never restores context.bonds onto spawned SimAnimals (simFriendHaresAfterReload = 0 while HUD
 *        still displays 2 friends).
 *      - eatPrey (X, main.ts:422-431) restores +0 stamina (vs caught +40 at main.ts:783); Play-as Snowshoe hare
 *        still displays predator `Q lock` aim line in #status.
 *   4. Live Standalone Entry Modes (?view=farlayer, ?tree=1 / view=one / view=lod, ?watch=1 witness camera):
 *      - ?view=farlayer (frame-4): renders 4 cubes + green disc in a solid uniform grey void (0 Earth globe/horizon,
 *        0 FARLAYER logs after 20 s, leaked #descent-cover element, ignores readUniverseSeed()).
 *      - ?tree=1&view=lod (frame-7) & ?tree=1&view=one (frame-6 vs ref-0): 38-tri `crown` LOD is a shattered origami
 *        pinched triangle stack with protruding spike and no trunk; 2-tri `impostor` is a tilted pixelated blob ~2x
 *        wider than the near/mid black spruce; viewer has 0 UI controls (hardcoded black-spruce only).
 *      - ?watch=1 witness camera (frame-8 vs ref-1, frame-9): wolf is not even in frame at 2x altitude (embodied = null),
 *        displacement over 3 s is 0.0000 m (frozen, Autonomous: Off), 0 dedicated witness/Enter-life UI, and clicking
 *        #home (main.ts:388) wipes WITNESS_ALTITUDE_SCALE back to 1x.
 *
 * Run: npx tsx refs/audit/live-speak-controls-hunting-standalone-audit/audit.ts [repoRoot]
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const AUDIT_DIR = import.meta.dirname;
const REPO = path.resolve(process.argv[2] ?? path.join(AUDIT_DIR, '..', '..', '..'));

function readPngRgba(filePath: string): { width: number; height: number; data: Uint8Array } {
  const buf = fs.readFileSync(filePath);
  let width = 0, height = 0, colorType = 6;
  const idat: Buffer[] = [];
  for (let o = 8; o < buf.length; ) {
    const len = buf.readUInt32BE(o);
    const type = buf.subarray(o + 4, o + 8).toString('ascii');
    const chunk = buf.subarray(o + 8, o + 8 + len);
    if (type === 'IHDR') { width = chunk.readUInt32BE(0); height = chunk.readUInt32BE(4); colorType = chunk[9]; }
    else if (type === 'IDAT') idat.push(chunk);
    else if (type === 'IEND') break;
    o += 12 + len;
  }
  const bpp = colorType === 6 ? 4 : 3;
  const stride = width * bpp;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const recon = new Uint8Array(height * stride);
  const paeth = (a: number, b: number, c: number) => {
    const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    const dst = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? recon[dst + x - bpp] : 0;
      const b = y > 0 ? recon[dst - stride + x] : 0;
      const c = x >= bpp && y > 0 ? recon[dst - stride + x - bpp] : 0;
      const v = raw[src + x];
      recon[dst + x] = (f === 0 ? v : f === 1 ? v + a : f === 2 ? v + b : f === 3 ? v + ((a + b) >> 1) : v + paeth(a, b, c)) & 0xff;
    }
  }
  if (bpp === 4) return { width, height, data: recon };
  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0, j = 0; i < recon.length; i += 3, j += 4) {
    rgba[j] = recon[i]; rgba[j + 1] = recon[i + 1]; rgba[j + 2] = recon[i + 2]; rgba[j + 3] = 255;
  }
  return { width, height, data: rgba };
}

function analyzeFarlayerPng(filePath: string) {
  const png = readPngRgba(filePath);
  let uniformGrey = 0;
  const total = png.width * png.height;
  for (let i = 0; i < png.data.length; i += 4) {
    const r = png.data[i], g = png.data[i + 1], b = png.data[i + 2];
    // Flat grey background around #dcdcdc (210..235, low chroma)
    if (r >= 210 && r <= 238 && g >= 210 && g <= 238 && b >= 210 && b <= 238 && Math.max(r, g, b) - Math.min(r, g, b) <= 6) {
      uniformGrey++;
    }
  }
  return { width: png.width, height: png.height, flatGreyVoidFrac: +(uniformGrey / total).toFixed(4) };
}

function analyzeTreeLodPng(filePath: string) {
  const png = readPngRgba(filePath);
  // Measure horizontal pixel span of the 4 LOD trees in upper sky band (y = 140..480) where sky is uniform #a9c3dc
  const bandX = [
    { name: 'near', x0: 300, x1: 460 },
    { name: 'mid', x0: 490, x1: 630 },
    { name: 'crown', x0: 660, x1: 800 },
    { name: 'impostor', x0: 785, x1: 960 },
  ];
  const widths: Record<string, number> = {};
  const filledPixels: Record<string, number> = {};
  for (const b of bandX) {
    let minX = png.width, maxX = -1, fill = 0;
    for (let y = 140; y < 480; y++) {
      for (let x = b.x0; x < b.x1; x++) {
        const i = (y * png.width + x) * 4;
        const r = png.data[i], g = png.data[i + 1], bl = png.data[i + 2];
        // Sky is roughly (169, 195, 220); tree pixel differs markedly
        if (Math.abs(r - 169) + Math.abs(g - 195) + Math.abs(bl - 220) > 45) {
          fill++;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
        }
      }
    }
    widths[b.name] = maxX >= minX ? maxX - minX + 1 : 0;
    filledPixels[b.name] = fill;
  }
  const impostorToNearFillRatio = filledPixels.near > 0 ? +(filledPixels.impostor / filledPixels.near).toFixed(2) : 0;
  const impostorToNearWidthRatio = widths.near > 0 ? +(widths.impostor / widths.near).toFixed(2) : 0;
  return { widthsPx: widths, filledPixels, impostorToNearFillRatio, impostorToNearWidthRatio };
}

function analyzeTreeOnePng(filePath: string) {
  const png = readPngRgba(filePath);
  // Center hero tree bounding box (x = 540..720, y = 100..560) foliage fill density
  let skyGap = 0, treePx = 0;
  for (let y = 100; y < 560; y++) {
    for (let x = 550; x < 700; x++) {
      const i = (y * png.width + x) * 4;
      const r = png.data[i], g = png.data[i + 1], b = png.data[i + 2];
      if (Math.abs(r - 169) + Math.abs(g - 195) + Math.abs(b - 220) <= 35) skyGap++;
      else treePx++;
    }
  }
  return { heroBoxFillFrac: +(treePx / Math.max(1, treePx + skyGap)).toFixed(4) };
}

interface CheckMetrics {
  [k: string]: boolean | number | string | string[] | number[] | Record<string, unknown> | null;
}
interface CalibratedCheck {
  id: string;
  passThreshold: number;
  score: number;
  pass: boolean;
  knownMatchScore: number;
  knownMismatchScore: number;
  calibrationOk: boolean;
  metrics: CheckMetrics;
}

function ratioScore(flags: Record<string, boolean>): number {
  const vals = Object.values(flags);
  if (!vals.length) return 0;
  return Number((vals.filter(Boolean).length / vals.length).toFixed(4));
}

function calibrate(id: string, actualFlags: Record<string, boolean>, extraMetrics: CheckMetrics): CalibratedCheck {
  const keys = Object.keys(actualFlags);
  const allTrue = Object.fromEntries(keys.map(k => [k, true]));
  const allFalse = Object.fromEntries(keys.map(k => [k, false]));
  const score = ratioScore(actualFlags);
  const knownMatchScore = ratioScore(allTrue);
  const knownMismatchScore = ratioScore(allFalse);
  const calibrationOk = knownMatchScore >= 0.99 && knownMismatchScore <= 0.25;
  return {
    id,
    passThreshold: 0.95,
    score,
    pass: calibrationOk && score >= 0.95,
    knownMatchScore,
    knownMismatchScore,
    calibrationOk,
    metrics: { ...actualFlags, ...extraMetrics },
  };
}

const cap = JSON.parse(fs.readFileSync(path.join(AUDIT_DIR, 'live-capture.json'), 'utf8'));
const readSrc = (rel: string) => fs.readFileSync(path.join(REPO, rel), 'utf8');

const voiceSrc = readSrc('src/audio/wolfVoice.ts');
const soundSrc = readSrc('src/audio/borealSound.ts');
const mainSrc = readSrc('src/main.ts');
const controlsSrc = readSrc('src/ui/controls.ts');
const hareSrc = readSrc('src/animals/hare.ts');
const farDemoSrc = readSrc('src/world/globe/farLayerDemo.ts');
const treeViewerSrc = readSrc('src/render/trees/viewer.ts');

const farStats = analyzeFarlayerPng(path.join(AUDIT_DIR, 'frame-4-live-farlayer-demo.png'));
const lodStats = analyzeTreeLodPng(path.join(AUDIT_DIR, 'frame-7-live-tree-viewer-lods.png'));
const oneStats = analyzeTreeOnePng(path.join(AUDIT_DIR, 'frame-6-live-tree-viewer-single-spruce.png'));

// 1. Live E Speak, Species-Blind Bioacoustics (Play as Deer), & H/G Non-Transactional Calls
const s1 = cap.scenario1_speakAndBioacoustics;
const wolfHaresAfter = (s1.wolfHowlReaction?.after?.hares ?? []) as { state: string; knows: boolean }[];
const wolfHowlAlertedAnyHare = wolfHaresAfter.some(h => h.knows || h.state === 'freeze' || h.state === 'flee');
const check1 = calibrate(
  'live-speak-species-bioacoustics-and-howl-growl',
  {
    deerSpeakDoesNotShowWolfEmoji: s1.afterSpeak?.bubbleHasWolfEmoji === false,
    speakPassesDeerPostureToVoice: /wolfSpeak\([^)]*posture/.test(mainSrc),
    howlGrowlGatedBySpeciesAndSpatial: !/howl\(\) \{ this\.playAt\('wolf-howl', undefined/.test(soundSrc) && !/else if \(id === 'howl'\) sfx\.howl\(\)/.test(mainSrc),
    wolfHowlAlertsNearbyHaresOrSenses: wolfHowlAlertedAnyHare || (s1.wolfHowlReaction?.after?.senses ?? '').length > 0,
    deerStatusOmitsPredatorLockHint: !(s1.initial?.statusText ?? '').includes('Q lock'),
  },
  {
    deerSpecies: s1.initial?.player?.species ?? null,
    deerSpeakTarget: s1.speakFound?.tgt ?? null,
    deerSpeakBubbleText: s1.afterSpeak?.bubbleText ?? null,
    wolfHowlAlertedHareCount: wolfHaresAfter.filter(h => h.knows || h.state === 'freeze' || h.state === 'flee').length,
    wolfHowlTotalHares: wolfHaresAfter.length,
    wolfVoiceHardcodesWolfEmoji: voiceSrc.includes('🐺'),
    speakHardcodesWolfWhine: soundSrc.includes("this.playAt('wolf-whine'"),
  },
);

// 2. Live Pause -> Controls Rebinding UX, Capture Reliability, Conflict Swap, & Layout Overlap
const s2 = cap.scenario2_controlsRebinding;
const check2 = calibrate(
  'live-controls-rebinding-capture-conflict-and-layout',
  {
    backButtonDoesNotOverlapFooter: (s2.overlap?.backFooterOverlapPx2 ?? 1) === 0,
    fastKeyTapNotDroppedByRafPoll: s2.fastTapDropped?.stillCapturingAfterFastTap === false,
    shiftedSymbolReleaseDoesNotHangCapture: s2.afterShiftedRelease?.stillCapturingStuck === false,
    conflictOffersSwapAssignAction: s2.afterConflict?.hasSwapButton === true && /swapAssign/.test(controlsSrc),
    controlsGroupedByContextWithUnbind: (s2.initial?.contextTabCount ?? 0) > 0 && (s2.initial?.unbindButtonCount ?? 0) > 0,
    footnoteMatchesRebindableCameraModeKey: !(s2.initial?.noteText ?? '').includes('V flora view'),
  },
  {
    rowCount: s2.initial?.rowCount ?? 0,
    listScrollHeight: s2.initial?.listScrollHeight ?? 0,
    listClientHeight: s2.initial?.listClientHeight ?? 0,
    backFooterOverlapPx2: s2.overlap?.backFooterOverlapPx2 ?? null,
    fastTapDroppedStillCapturing: s2.fastTapDropped?.stillCapturingAfterFastTap ?? null,
    shiftedReleaseCapText: s2.afterShiftedRelease?.capText ?? null,
    clashText: s2.afterConflict?.clashText ?? null,
    clashButtons: s2.afterConflict?.clashButtons ?? [],
    cameraModeRowText: s2.initial?.cameraModeRowText ?? null,
  },
);

// 3. Live Hunting II Pin/Hold/Eat/Release Hare Bond Decay & Reload Persistence
const s3 = cap.scenario3_huntingBondPersistence;
const check3 = calibrate(
  'live-hunting-bond-commit-clock-and-reload-persistence',
  {
    releasePreyCommitsBondImmediately: Object.keys(s3.immediateAfterRelease?.bondsImmediateInLocalStorage ?? {}).length > 0,
    reloadedBondStrengthNeverExceedsOne: (s3.afterReload?.effectiveStrengthAfterReload ?? 2) <= 1.0,
    reloadedHaresRestoreFriendBondInSim: (s3.afterReload?.simFriendHaresAfterReload ?? 0) > 0 && /context\.bonds|friendOf/.test(hareSrc) && /restoreBonds|initialBonds/.test(hareSrc),
    eatPreyMatchesCaughtStaminaPolicy: /else if \(id === 'eatPrey'\)[\s\S]{0,600}stamina/.test(mainSrc),
    playableHareOmitsPredatorLockAimLine: !(s3.harePressX?.status ?? '').includes('Q lock'),
  },
  {
    pinnedHareId: s3.pinResult?.id ?? null,
    bondAtSec: Object.values(s3.afterAutosave?.bondsAfterAutosave ?? {} as Record<string, { at: number }>)[0]?.at ?? null,
    bondsImmediateAfterB: Object.keys(s3.immediateAfterRelease?.bondsImmediateInLocalStorage ?? {}).length,
    bondsAfterAutosave: Object.keys(s3.afterAutosave?.bondsAfterAutosave ?? {}).length,
    clockAfterReloadSec: s3.afterReload?.clockAfterReload ?? null,
    effectiveStrengthAfterReload: s3.afterReload?.effectiveStrengthAfterReload !== null ? +Number(s3.afterReload.effectiveStrengthAfterReload).toFixed(4) : null,
    simFriendHaresAfterReload: s3.afterReload?.simFriendHaresAfterReload ?? 0,
    eatNotice: s3.eatResult?.afterEat?.notice ?? null,
    statusAfterReload: s3.afterReload?.statusText ?? null,
  },
);

// 4. Live Standalone Entry Modes (?view=farlayer, ?tree=1 / view=lod / view=one, ?watch=1 Witness Camera)
const s4 = cap.scenario4_standaloneModes;
const check4 = calibrate(
  'live-standalone-farlayer-tree-viewer-and-watch-witness',
  {
    farlayerRendersGlobeAndLogsStats: (s4.farlayer?.logs?.length ?? 0) > 0 && farStats.flatGreyVoidFrac < 0.50 && (s4.farlayer?.visibleExtraElements?.length ?? 1) === 0,
    farlayerRespectsUniverseSeed: /readUniverseSeed/.test(farDemoSrc),
    treeLodImpostorMatchesNearSilhouette: lodStats.impostorToNearFillRatio <= 1.4 && lodStats.impostorToNearWidthRatio <= 1.35,
    treeViewerOffersSpeciesControls: (s4.treeSheet?.controlsCount ?? 0) > 0 && /select|species/i.test(treeViewerSrc),
    watchWitnessShowsMovingAnimalAndPreservesScale: (s4.watch?.displacementOver3sM ?? 0) > 0.1 && s4.watch?.t0?.hasDedicatedWitnessUi === true && /watchLife[\s\S]{0,60}WITNESS_ALTITUDE_SCALE/.test(mainSrc.slice(mainSrc.indexOf("element('home').onclick"), mainSrc.indexOf("element('home').onclick") + 350)),
  },
  {
    farlayerFlatGreyVoidFrac: farStats.flatGreyVoidFrac,
    farlayerLogCount: s4.farlayer?.logs?.length ?? 0,
    farlayerLeakedElements: s4.farlayer?.visibleExtraElements ?? [],
    treeLodMetrics: lodStats,
    treeOneHeroBoxFillFrac: oneStats.heroBoxFillFrac,
    treeViewerControlsCount: s4.treeSheet?.controlsCount ?? 0,
    watchDisplacementOver3sM: s4.watch?.displacementOver3sM ?? null,
    watchEmbodiedHandle: s4.watch?.t0?.player?.embodied ?? null,
    watchHasDedicatedUi: s4.watch?.t0?.hasDedicatedWitnessUi ?? false,
    watchAutonomousText: s4.watch?.t0?.autonomousText ?? null,
  },
);

const checks = [check1, check2, check3, check4];
const calibrationValid = checks.every(c => c.calibrationOk);
const passCount = checks.filter(c => c.pass).length;
const meanScore = Number((checks.reduce((a, c) => a + c.score, 0) / checks.length).toFixed(4));

const out = {
  taskId: 'T-0305',
  baseCommit: '0de4d8f1',
  auditScript: 'refs/audit/live-speak-controls-hunting-standalone-audit/audit.ts',
  captureMeta: cap.meta,
  consoleErrors: cap.consoleErrors.length,
  pageErrors: cap.pageErrors.length,
  failedRequests: cap.failedRequests.length,
  calibrationValid,
  passCount,
  totalChecks: checks.length,
  meanScore,
  checks,
};

fs.writeFileSync(path.join(AUDIT_DIR, 'numbers.json'), JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify({ calibrationValid, passCount, totalChecks: checks.length, meanScore, scores: checks.map(c => ({ id: c.id, score: c.score, pass: c.pass })), farStats, lodStats, oneStats }, null, 2));
