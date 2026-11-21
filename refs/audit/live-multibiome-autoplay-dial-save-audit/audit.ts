/**
 * Calibrated Rule 11 audit for T-0297:
 *   1. Live multi-biome remote ground landings (Sahara 23.5N 10E, Greenland Ice 72.5N -40W, Pacific Ocean 0N -140W):
 *      floating +2.7 m grass wall in Pacific sky (grass.ts never clears tiles on SITE/tier change), Kenora staged lake &
 *      wading ripples + 'E / click · drink' leaking into dry Sahara/Greenland & saltwater Pacific, boreal wolf pups/hares/grass everywhere
 *   2. Live ?autoplay=1 end-to-end visit hanging >57.8 s on #loading "Ready" (main.ts runs inpage.prewarm() AFTER startup() sets Ready;
 *      startView('?autoplay=1') drops stages=1&trees=v2; autoplay.ts disables stuck() while #loading exists & clicks non-interactive #target)
 *   3. Ground Time Dial (, / . / ;) trapping continuous hold forever at ±1x detent (worldClock.ts + main.ts:601-602), zero rate/rewind
 *      indicator on #status HUD (silently rewinding 08:06 -> 08:01), and loadClock() crediting positive offlineSec while paused/rewinding
 *   4. Esc -> Save -> Reload -> Continue discarding ground player position & heading (5.92 m / 156.5° jump back to spawn because
 *      captureResume() bails on !hasSeenBigBang) and never persisting remote landing SITE coordinates
 *
 * Run: npx tsx refs/audit/live-multibiome-autoplay-dial-save-audit/audit.ts [repoRoot]
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import {
  DIAL_DEADZONE,
  DIAL_HOLD_PER_SEC,
  DIAL_NOTCH,
  clockRate,
  dialPosition,
  loadClock,
  nudgeDial,
  saveClock,
  setClockRate,
} from '../../../src/core/worldClock';

const require = createRequire(import.meta.url);
const AUDIT_DIR = import.meta.dirname;
const REPO = path.resolve(process.argv[2] ?? path.join(AUDIT_DIR, '..', '..', '..'));
// Resolve pngjs from REPO or sibling boreal-agy-loop worktree (when run inside a fresh git worktree without node_modules)
const pngjsPath = fs.existsSync(path.join(REPO, 'node_modules/pngjs'))
  ? path.join(REPO, 'node_modules/pngjs')
  : path.join(path.dirname(REPO), 'boreal-agy-loop', 'node_modules/pngjs');
const { PNG } = require(pngjsPath);

interface CheckMetrics {
  [k: string]: boolean | number | string | string[] | Record<string, unknown>;
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

function readPng(file: string) {
  return PNG.sync.read(fs.readFileSync(path.join(AUDIT_DIR, file)));
}

function regionStats(png: { width: number; height: number; data: Buffer }, x0f: number, x1f: number, y0f: number, y1f: number) {
  let count = 0, lumSum = 0, snowPx = 0, greenDomPx = 0, ochreSandPx = 0, skyBluePx = 0, grassDarkGreenPx = 0;
  for (let y = Math.floor(png.height * y0f); y < Math.floor(png.height * y1f); y++) {
    for (let x = Math.floor(png.width * x0f); x < Math.floor(png.width * x1f); x++) {
      const idx = (y * png.width + x) * 4;
      const r = png.data[idx], g = png.data[idx + 1], b = png.data[idx + 2];
      const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      lumSum += lum;
      count++;
      if (lum >= 0.65 && Math.max(r, g, b) - Math.min(r, g, b) < 35) snowPx++;
      if (g > b + 15) greenDomPx++;
      if (g > r + 4 && g > b + 15 && lum < 0.52) grassDarkGreenPx++;
      if (r > g + 10 && g > b + 15 && lum >= 0.35) ochreSandPx++;
      if (b > r + 10 && lum >= 0.55) skyBluePx++;
    }
  }
  const n = Math.max(1, count);
  return {
    samples: count,
    meanLum: Number((lumSum / n).toFixed(4)),
    snowFrac: Number((snowPx / n).toFixed(4)),
    greenDomFrac: Number((greenDomPx / n).toFixed(4)),
    grassDarkGreenFrac: Number((grassDarkGreenPx / n).toFixed(4)),
    ochreSandFrac: Number((ochreSandPx / n).toFixed(4)),
    skyBlueFrac: Number((skyBluePx / n).toFixed(4)),
  };
}

const live = JSON.parse(fs.readFileSync(path.join(AUDIT_DIR, 'live-capture.json'), 'utf8'));

// =============================================================================
// CHECK 1: Multi-biome remote ground landings (Sahara, Greenland, Pacific Ocean)
// =============================================================================
const saharaPng = readPng('frame-0-sahara-ground-landing.png');
const greenlandPng = readPng('frame-1-greenland-ice-landing.png');
const pacificPng = readPng('frame-2-pacific-ocean-landing.png');

const saharaGround = regionStats(saharaPng, 0.15, 0.85, 0.50, 0.86);
const greenlandGround = regionStats(greenlandPng, 0.15, 0.85, 0.50, 0.86);
const pacificUpperSky = regionStats(pacificPng, 0.12, 0.88, 0.02, 0.28); // where the floating grass wall hangs in mid-air!

const grassSrc = fs.readFileSync(path.join(REPO, 'src/render/grass/grass.ts'), 'utf8');
const buildSceneSrc = fs.readFileSync(path.join(REPO, 'src/render/buildScene.ts'), 'utf8');
const waterSrc = fs.readFileSync(path.join(REPO, 'src/core/needs/water.ts'), 'utf8');
const inpageSrc = fs.readFileSync(path.join(REPO, 'src/world/globe/inpage.ts'), 'utf8');

const grassInvalidatesOnSiteOrTier = /SITE\.salt|SITE\.remote|clear\s*\(/.test(grassSrc) && /grass\.clear/.test(buildSceneSrc);
const waterGatesStagedOnRemoteAndSalinity = /!SITE\.remote|SITE\.remote/.test(waterSrc) && /ocean|salin|fresh/i.test(waterSrc);
const saharaAct = String(live['0-sahara-ground-landing']?.afterState?.act ?? '');
const greenlandAct = String(live['1-greenland-ice-landing']?.afterState?.act ?? '');
const pacificAct = String(live['2-pacific-ocean-landing']?.afterState?.act ?? '');
const saharaHares = Number(live['0-sahara-ground-landing']?.afterState?.hareCount ?? 0);
const greenlandHares = Number(live['1-greenland-ice-landing']?.afterState?.hareCount ?? 0);
const pacificHares = Number(live['2-pacific-ocean-landing']?.afterState?.hareCount ?? 0);
const saharaPups = (live['0-sahara-ground-landing']?.afterState?.sceneInfo?.namedAnimals ?? []).filter((n: string) => n.startsWith('pup:')).length;
const pacificPups = (live['2-pacific-ocean-landing']?.afterState?.sceneInfo?.namedAnimals ?? []).filter((n: string) => n.startsWith('pup:')).length;
const greenlandSnowMatch = String(live['1-greenland-ice-landing']?.afterState?.status ?? '').match(/Snow\s+([\d.]+)\s*cm/);
const greenlandSnowCm = greenlandSnowMatch ? Number(greenlandSnowMatch[1]) : 0;

const check1Flags = {
  saharaNoGreenGrassOrDrink: saharaGround.grassDarkGreenFrac < 0.05 && !/drink/i.test(saharaAct),
  saharaNoBorealPupsOrHares: saharaPups === 0 && saharaHares === 0,
  greenlandShowsWhiteIceNotGreenMeadow: greenlandGround.snowFrac >= 0.50 && greenlandGround.grassDarkGreenFrac < 0.05 && greenlandSnowCm >= 20,
  greenlandNoKenoraLakeDrinkOrHares: !/drink/i.test(greenlandAct) && greenlandHares === 0,
  pacificNoFloatingSkyGrassWall: pacificUpperSky.grassDarkGreenFrac < 0.02,
  pacificNoSaltwaterDrinkOrOceanMammals: !/drink/i.test(pacificAct) && pacificPups === 0 && pacificHares === 0,
  grassClearsTilesOnRemoteLanding: grassInvalidatesOnSiteOrTier,
  waterExcludesRemoteKenoraLakesAndOcean: waterGatesStagedOnRemoteAndSalinity,
};

const check1 = calibrate('remote-multibiome-ground-landings', check1Flags, {
  saharaGround,
  saharaAct,
  saharaPups,
  saharaHares,
  greenlandGround,
  greenlandSnowCm,
  greenlandAct,
  greenlandHares,
  pacificUpperSky,
  pacificAct,
  pacificPups,
  pacificHares,
  inpagePlaceInvalidatesView: /invalidate/.test(inpageSrc),
  recordingBytes: live.recordingBytes ?? 0,
});

// =============================================================================
// CHECK 2: Live ?autoplay=1 visit hang on #loading "Ready" & autoplay.ts bugs
// =============================================================================
const mainSrc = fs.readFileSync(path.join(REPO, 'src/main.ts'), 'utf8');
const startViewSrc = fs.readFileSync(path.join(REPO, 'src/world/globe/startView.ts'), 'utf8');
const autoplaySrc = fs.readFileSync(path.join(REPO, 'src/input/autoplay.ts'), 'utf8');

const ap = live['3-autoplay-visit'];
const lastMilestone = ap?.milestones?.[ap.milestones.length - 1] ?? {};
const readyAtMilestone = (ap?.milestones ?? []).find((m: { loadingText?: string }) => String(m.loadingText ?? '').endsWith('Ready'));
const prewarmRunsAfterStartupReady = /startup\([\s\S]{0,600}\)\.then\(async result =>[\s\S]{0,400}inpage\?\.prewarm\(\)/.test(mainSrc);
const stuckDisabledDuringLoading = /if\s*\(\s*!document\.getElementById\('loading'\)\s*&&\s*stuck\(run\)\)/.test(autoplaySrc);
const clicksNonInteractiveTarget = /target\.dispatchEvent\(new MouseEvent\('click'/.test(autoplaySrc);
const hasApproachTypo = /Approach as individual/.test(autoplaySrc);
const startViewHandlesAutoplay = /autoplay/.test(startViewSrc);

const check2Flags = {
  loadingClearsWithin45s: !lastMilestone.loading && (ap?.elapsedS ?? 999) <= 45,
  autoplayAdvancesPastStep1: (ap?.finalLog?.log?.length ?? 0) >= 3,
  autoplayCompletesCleanly: Boolean(ap?.done),
  prewarmDoesNotRunAfterReady100: !prewarmRunsAfterStartupReady,
  stuckTimerCoversLoadingHang: !stuckDisabledDuringLoading,
  autoplayUsesRealControlsAndCopy: !clicksNonInteractiveTarget && !hasApproachTypo,
  startViewPreservesJourneyOnAutoplay: startViewHandlesAutoplay,
};

const check2 = calibrate('live-autoplay-boot-and-prewarm-hang', check2Flags, {
  elapsedS: ap?.elapsedS ?? null,
  done: Boolean(ap?.done),
  stepCount: ap?.finalLog?.log?.length ?? 0,
  lastStep: ap?.finalLog?.log?.[ap?.finalLog?.log?.length - 1] ?? '',
  stuckAtReadyElapsedS: readyAtMilestone?.elapsedS ?? null,
  stillLoadingAtEnd: Boolean(lastMilestone.loading),
  prewarmRunsAfterStartupReady,
  stuckDisabledDuringLoading,
  clicksNonInteractiveTarget,
  hasApproachTypo,
  startViewHandlesAutoplay,
});

// =============================================================================
// CHECK 3: Ground Time Dial (, / . / ;) detent lock, HUD rate visibility & loadClock
// =============================================================================
// Reproduce exact main.ts:598-604 continuous hold of ',' (slower / rewind) for 2.2 s at 60 Hz starting from +1x
loadClock(null, 1_700_000_000_000, 1000);
setClockRate(1, 1000);
let simDialHeld = 0;
let simPerf = 1000;
const simDt = 1 / 60;
for (let i = 0; i < Math.round(2.2 / simDt); i++) {
  simPerf += simDt * 1000;
  const dir = -1;
  if (dir !== 0 && simDt > 0) nudgeDial(dir * DIAL_HOLD_PER_SEC * simDt, simPerf);
  if (dir !== 0 && simDialHeld === 0) nudgeDial(dir * DIAL_NOTCH, simPerf);
  simDialHeld = dir;
}
const heldRewindDial = Number(dialPosition().toFixed(4));
const heldRewindRate = Number(clockRate().toFixed(4));
nudgeDial(0, simPerf);

// Also test loadClock() offlineSec behavior when saved paused (dial=0) or rewinding (dial=-0.01)
const savedRewindJson = saveClock(1_700_000_000_000, simPerf);
const loadedRewind = loadClock(savedRewindJson, 1_700_000_060_000, simPerf + 60_000); // 60s later!
setClockRate(0, simPerf + 60_000);
const savedPausedJson = saveClock(1_700_000_060_000, simPerf + 60_000);
const loadedPaused = loadClock(savedPausedJson, 1_700_000_120_000, simPerf + 120_000); // 60s later!

const ds = live['4-time-dial-save-continue'];
const liveSavedClock = ds?.savedClock ? JSON.parse(ds.savedClock) : null;
const statusShowsRateOrRewind = /formatRate|clockRate|REWIND/.test(mainSrc.slice(mainSrc.indexOf('status.innerText ='), mainSrc.indexOf('status.innerText =') + 700));
const liveContinueStatus = String(ds?.afterContinue?.status ?? '');

const check3Flags = {
  continuousHoldLeavesRewindDetent: heldRewindDial <= -0.15 && heldRewindRate <= -50,
  liveRewindHoldMovedPast1x: liveSavedClock ? liveSavedClock.dial <= -0.10 : false,
  statusHudDisplaysActiveRateOrRewind: statusShowsRateOrRewind,
  pausedSaveDoesNotCreditOfflineSec: loadedPaused.offlineSec === 0,
  rewindSaveDoesNotCreditForwardOfflineSec: loadedRewind.offlineSec <= 0,
};

const check3 = calibrate('ground-time-dial-detent-and-rate-hud', check3Flags, {
  simulated2p2sHoldDial: heldRewindDial,
  simulated2p2sHoldRate: heldRewindRate,
  expectedDialWithoutDetentTrap: Number((DIAL_DEADZONE - DIAL_NOTCH - 2.2 * DIAL_HOLD_PER_SEC).toFixed(4)),
  liveSavedDial: liveSavedClock?.dial ?? null,
  liveSavedRate: liveSavedClock ? Number(liveSavedClock.rate.toFixed(4)) : null,
  liveBeforeDialFwd: ds?.beforeDialFwdStatus?.slice(0, 20) ?? '',
  liveAfterDialFwd: ds?.afterDialFwdStatus?.slice(0, 20) ?? '',
  liveAfterDialRewind: ds?.afterDialRewindStatus?.slice(0, 20) ?? '',
  liveContinueStatusPrefix: liveContinueStatus.slice(0, 20),
  loadedPausedOfflineSec: loadedPaused.offlineSec,
  loadedRewindOfflineSec: loadedRewind.offlineSec,
  statusShowsRateOrRewind,
});

// =============================================================================
// CHECK 4: Esc -> Save -> Reload -> Continue persistence (ground pos/yaw + remote SITE)
// =============================================================================
const beforeSave = ds?.afterWalk?.player;
const afterCont = ds?.afterContinue?.player;
const posDriftM = beforeSave && afterCont ? Number(Math.hypot(afterCont.x - beforeSave.x, afterCont.z - beforeSave.z).toFixed(3)) : Infinity;
const yawDiffRaw = beforeSave && afterCont ? Math.abs(Math.atan2(Math.sin(afterCont.yaw - beforeSave.yaw), Math.cos(afterCont.yaw - beforeSave.yaw))) : Infinity;
const yawDriftRad = Number(yawDiffRaw.toFixed(4));
const yawDriftDeg = Number((yawDiffRaw * 180 / Math.PI).toFixed(1));
const savedEventsHasResume = Boolean(ds?.savedEvents?.resume);
const captureResumeGatedOnBigBang = /captureResume\s*=\s*\(\)\s*=>\s*\{\s*if\s*\([^)]*!hasSeenBigBang\(context\)/.test(mainSrc);
const resumePersistsRemoteSite = /SITE\.remote|siteLat|remoteLat/.test(mainSrc.slice(mainSrc.indexOf('captureResume = () =>'), mainSrc.indexOf('captureResume = () =>') + 650));

const check4Flags = {
  saveWritesResumeWithoutBigBangGate: savedEventsHasResume && !captureResumeGatedOnBigBang,
  continueRestoresSavedPositionWithin0p5m: posDriftM <= 0.5,
  continueRestoresSavedHeadingWithin10deg: yawDriftDeg <= 10.0,
  resumePersistsRemoteLandingSite: resumePersistsRemoteSite,
  continueDoesNotSilentlyRewindClock: !(liveSavedClock && liveSavedClock.rate < 0 && !/REWIND|−/.test(liveContinueStatus)),
};

const check4 = calibrate('save-reload-continue-persistence', check4Flags, {
  beforeSavePos: beforeSave ? [Number(beforeSave.x.toFixed(2)), Number(beforeSave.z.toFixed(2))] : null,
  afterContinuePos: afterCont ? [Number(afterCont.x.toFixed(2)), Number(afterCont.z.toFixed(2))] : null,
  posDriftM,
  beforeSaveYawRad: beforeSave ? Number(beforeSave.yaw.toFixed(4)) : null,
  afterContinueYawRad: afterCont ? Number(afterCont.yaw.toFixed(4)) : null,
  yawDriftRad,
  yawDriftDeg,
  savedNote: ds?.savedNote ?? '',
  continueEnabled: Boolean(ds?.continueEnabled),
  savedEventsHasResume,
  captureResumeGatedOnBigBang,
  resumePersistsRemoteSite,
});

const checks = [check1, check2, check3, check4];
const calibrationValid = checks.every(c => c.calibrationOk);
const passCount = checks.filter(c => c.pass).length;
const meanScore = Number((checks.reduce((s, c) => s + c.score, 0) / checks.length).toFixed(4));

const out = {
  task: 'T-0297',
  repo: REPO,
  generatedAt: new Date().toISOString(),
  consoleErrors: (live.consoleErrors ?? []).length,
  calibrationValid,
  passCount,
  totalChecks: checks.length,
  meanScore,
  checks,
};

fs.writeFileSync(path.join(AUDIT_DIR, 'numbers.json'), JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify({ calibrationValid, passCount, totalChecks: checks.length, meanScore, scores: checks.map(c => [c.id, c.score, c.pass]) }, null, 2));
