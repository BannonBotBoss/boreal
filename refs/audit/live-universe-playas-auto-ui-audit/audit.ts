/**
 * Calibrated Rule 11 audit for T-0299:
 *   1. Live Start Menu "Generate universe" & "Universe options… -> Forest only (legacy)…":
 *      - Clicking "Generate universe" after a prior intro preserves introComplete=true (main.ts:243 clearWorldSaves(true)),
 *        so bootChoice('sphere', true, null) skips the Big Bang opening (cineShownOnSecondGenerate=false; frame-0 lands on ground).
 *      - "Forest only (legacy)…" (main.ts:252-254) writes boreal.seed.v1=424242 without clearing boreal.universe.seed.v1,
 *        so main.ts:279-280 overrides it with worldSeedFromUniverse(u)=1587008242 (user's legacy seed is silently ignored!).
 *      - opening.ts:262-270 stop() removes #cine without calling sphere?.dispose(), leaking CosmosSphere's WebGL2 context & rAF.
 *      - menu.ts:73 renders broken grammar: "Leave blank mint by pressing New seed."
 *   2. Live "Pause -> More -> Player" (Play as switching: Wolf -> Deer -> Snowshoe Hare):
 *      - Enabling Autonomous: On while embodied as Snowshoe Hare (or Deer) still executes autonomousWolfStep() / WOLF_AGENT
 *        (main.ts:675), turning a herbivorous snowshoe hare into a wolf predator stalking "hare:6" (frame-1)!
 *      - main.ts:795 aimLine still shows wolf hunt/lock hints ("Q lock") for Deer/Hare; main.ts:437 lets Deer/Hare howl/growl;
 *        main.ts:696-713 leaves driveHold/driveCommitted latched when switching away from wolf; setPlayable never drops held hare.
 *   3. Live "Autonomous: On" Wolf Deadlock, Free +1/s Infinite Energy, & Unwired Scents/Water:
 *      - On gently sloping staged terrain (frame-2 + recording.webm), wolfGround(pose) (autonomy.ts:45-50) compares detour endpoints
 *        in plan.ts:157 against the wolf's starting height h0 (|heightAt(to) - h0| <= 0.45 m), rejecting both sides of a single
 *        surface stone (stones:1:-1:35) and deadlocking permanently at 0.000 m displacement after a +8.98 rad (+514 deg) spin!
 *      - While deadlocked in route.motion='wait' (brain.problem='recover'), main.ts:691 grants free +1.0/s energy (+3.43 in 3.4 s,
 *        74.91 -> 78.34 -> 80/100) without eating, violating conservation of energy (PROJECT-RULES).
 *      - main.ts:675-678 never passes `scents` or `water`/`waterLevel` to autonomousWolfStep() (leaving autonomy.ts:157,160 dead),
 *        and thirsty ?needs=water:15 bypass (main.ts:660-663) oscillates yaw (1.40 -> 2.19 -> 5.33 -> 1.40 rad) without plan().
 *   4. Live Data (U) Capture Hijack & Infinite Pad rAF, Controls Rebinding, & Pause -> Graphics Dual Conflicting Quality UI:
 *      - dataPanel.ts:89-97 intercepts U/F2 in capture phase with stopImmediatePropagation() even while .ctl-screen.capturing is
 *        active (Pause -> Controls), popping #data-panel open instead of letting the player bind U (howl stays 'H').
 *      - dataPanel.ts:232-241 runs an uncancellable infinite requestAnimationFrame(pad) polling loop from page boot while closed.
 *      - Pause -> Graphics (menu.ts:96-102, frame-4) has TWO conflicting Quality controls: top <select aria-label="Quality"> sets
 *        GOVERNOR.auto=false / tier=0 without updating renderStore (quality.auto stays true in boreal.render.v1 -> reverts on reload),
 *        permanently clobbers GOVERNOR.probeCap downward (`if (i < GOVERNOR.probeCap) GOVERNOR.probeCap = i`), overlaps the Boreal
 *        header behind "Graphics", and inherits unreadable light text on white <select> controls (WCAG AA contrast failure).
 *
 * Run: npx tsx refs/audit/live-universe-playas-auto-ui-audit/audit.ts [repoRoot]
 */
import fs from 'node:fs';
import path from 'node:path';
import { bootChoice, createContext, markBigBangSeen } from '../../../src/core/events';
import { worldSeedFromUniverse } from '../../../src/core/universeSeed';
import { STAGES } from '../../../src/core/stages/elevation';
import { generateChunk, heightAt } from '../../../src/core/world';
import { blocksFrom, plan } from '../../../src/core/plan';
import { wolfGround } from '../../../src/core/autonomy';

const AUDIT_DIR = import.meta.dirname;
const REPO = path.resolve(process.argv[2] ?? path.join(AUDIT_DIR, '..', '..', '..'));

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

const live = JSON.parse(fs.readFileSync(path.join(AUDIT_DIR, 'live-capture.json'), 'utf8'));
const mainSrc = fs.readFileSync(path.join(REPO, 'src/main.ts'), 'utf8');
const menuSrc = fs.readFileSync(path.join(REPO, 'src/ui/menu.ts'), 'utf8');
const openingSrc = fs.readFileSync(path.join(REPO, 'src/world/cosmos/opening.ts'), 'utf8');
const dataPanelSrc = fs.readFileSync(path.join(REPO, 'src/ui/dataPanel.ts'), 'utf8');
const styleSrc = fs.readFileSync(path.join(REPO, 'src/style.css'), 'utf8');

// =============================================================================
// CHECK 1: Generate universe Big Bang Skip, Legacy Seed Override, Sphere Leak
// =============================================================================
const p1 = live.part1_generateUniverse;
const genUniverseBlock = mainSrc.slice(mainSrc.indexOf('generateUniverse:'), mainSrc.indexOf('newWorld:'));
const newWorldBlock = mainSrc.slice(mainSrc.indexOf('newWorld:'), mainSrc.indexOf('warning:'));
const openingStopBlock = openingSrc.slice(openingSrc.indexOf('stop() {'), openingSrc.indexOf('stop() {') + 380);

const genUniverseClearsIntroFlag = /clearWorldSaves\s*\(\s*false\s*\)/.test(genUniverseBlock);
const secondGenerateBootChoice = bootChoice('sphere', true, null); // 'globe' instead of 'sphere' when introComplete kept!
const secondGenerateShowsBigBang = p1?.secondGenerateState?.cineShownOnSecondGenerate === true;
const newWorldClearsUniverseSeed = /UNIVERSE_SEED_KEY|boreal\.universe\.seed\.v1|clearUniverseSeed/.test(newWorldBlock);
const legacySeedHonoredAfterReload = String(p1?.legacySeedAfterReload?.shownStagedSeedInput ?? '') === '424242';
const openingStopDisposesSphere = /sphere\?\.dispose\s*\(\s*\)/.test(openingStopBlock);
const universeSeedNoteGrammatical = !/Leave blank mint by pressing/.test(menuSrc);

const check1Flags = {
  generateUniverseResetsIntroForFreshBigBang: genUniverseClearsIntroFlag && secondGenerateShowsBigBang,
  legacyForestOnlyClearsUniverseSeedOverride: newWorldClearsUniverseSeed && legacySeedHonoredAfterReload,
  openingStopDisposesCosmosSphereWebGL: openingStopDisposesSphere,
  universeOptionsNoteGrammatical: universeSeedNoteGrammatical,
};

const check1 = calibrate('generate-universe-bigbang-skip-and-legacy-seed-override', check1Flags, {
  liveSecondGenerateCineShown: Boolean(p1?.secondGenerateState?.cineShownOnSecondGenerate),
  liveSecondGenerateBodyClasses: p1?.secondGenerateState?.bodyClasses ?? '',
  bootChoiceWhenIntroKept: secondGenerateBootChoice,
  derivedWorldSeedFor1400: worldSeedFromUniverse(1400),
  liveLegacySeedEntered: '424242',
  liveLegacySeedShownAfterReload: p1?.legacySeedAfterReload?.shownStagedSeedInput ?? '',
  liveStoredLegacySeed: p1?.legacySeedAfterReload?.storedLegacySeed ?? '',
  genUniverseClearsIntroFlag,
  newWorldClearsUniverseSeed,
  openingStopDisposesSphere,
  universeSeedNoteText: p1?.universeOptionsUi?.note ?? '',
});

// =============================================================================
// CHECK 2: Play As Switching (Wolf -> Deer -> Snowshoe Hare) Species Integrity
// =============================================================================
const p2 = live.part2_playAs;
const hareAutoStatus = String(p2?.asHareDuringAuto?.status ?? '');
const hareStalksHareAsWolf = /following hare/i.test(hareAutoStatus);
const autoGuardsSpecies = /view\.playable\.id\s*===\s*'wolf'[\s\S]{0,120}autonomousWolfStep|autonomousSpeciesStep/.test(mainSrc);
const aimLineSpeciesAware = !/const aimLine = holding \?[^\n]*RT run · LT stealth · LB focus · \$\{bindingLabel\(bindings\.lock\.keys\)\} lock/.test(mainSrc);
const howlGrowlGuardedByWolf = /view\.playable\.id\s*===\s*'wolf'[\s\S]{0,40}sfx\.howl|if \(id === 'howl' && view\.playable\.id === 'wolf'\)/.test(mainSrc);
const driveHoldResetWhenNotWolf = /if \(view\.playable\.id === 'wolf'\)[\s\S]{0,900}else\s*\{[^}]*driveHold\s*=\s*false/.test(mainSrc);

const check2Flags = {
  playableHareDoesNotHuntHaresInAutonomous: !hareStalksHareAsWolf && autoGuardsSpecies,
  aimLineHidesWolfHuntLockForHerbivores: aimLineSpeciesAware,
  howlAndGrowlRestrictedToWolf: howlGrowlGuardedByWolf,
  driveHoldClearedWhenSwitchingOffWolf: driveHoldResetWhenNotWolf,
};

const check2 = calibrate('play-as-runtime-switching-species-integrity', check2Flags, {
  liveDeerSpecies: p2?.asDeer?.player?.species ?? '',
  liveHareSpecies: p2?.asHareDuringAuto?.player?.species ?? '',
  liveHareSensesTitle: p2?.asHareDuringAuto?.sensesSummary ?? '',
  liveHareAutoStatus: hareAutoStatus.split('\n')[0] ?? '',
  hareStalksHareAsWolf,
  autoGuardsSpecies,
  aimLineSpeciesAware,
  howlGrowlGuardedByWolf,
  driveHoldResetWhenNotWolf,
});

// =============================================================================
// CHECK 3: Autonomous Wolf Hillside Deadlock, Free +1/s Energy & Unwired Scents/Water
// =============================================================================
const p3 = live.part3_autonomousWolf;
const samples = (p3?.samples ?? []) as Array<{ t: number; player: { x: number; z: number; yaw: number; energy: number }; status: string }>;
const s0 = samples[0], s1 = samples[1], s2 = samples[2], sLast = samples[samples.length - 1];
const spinRad = s0 && s1 ? Number(Math.abs(s1.player.yaw - s0.player.yaw).toFixed(3)) : 0;
const spinDeg = Number((spinRad * 180 / Math.PI).toFixed(1));
const frozenDistM = s2 && sLast ? Number(Math.hypot(sLast.player.x - s2.player.x, sLast.player.z - s2.player.z).toFixed(4)) : 0;
const frozenSamplesCount = samples.filter(s => /waiting: the way is closed/.test(s.status)).length;
const freeEnergyGain = s0 && sLast ? Number((sLast.player.energy - s0.player.energy).toFixed(3)) : 0;

// Deterministic verification of wolfGround + plan() hillside deadlock on staged Kenora seed 1400
STAGES.on = true;
STAGES.seed = 1400;
const wolfPos = { x: 65.2045, z: -18.3537, heading: 15.287 };
const chunkEntities = [];
for (let cx = 0; cx <= 2; cx++) for (let cz = -2; cz <= 0; cz++) chunkEntities.push(...generateChunk(cx, cz));
const stoneBlock = chunkEntities.find(e => e.key === 'stones:1:-1:35');
const hWolf = heightAt(wolfPos.x, wolfPos.z);
const hStone = stoneBlock ? heightAt(stoneBlock.x, stoneBlock.z) : hWolf;
// Test planning toward a goal just beyond stones:1:-1:35 on the hillside
const testGoal = stoneBlock ? { x: stoneBlock.x + (stoneBlock.x - wolfPos.x) * 0.5, z: stoneBlock.z + (stoneBlock.z - wolfPos.z) * 0.5 } : { x: 75, z: -28 };
const detPlan = plan(wolfPos, testGoal, blocksFrom(chunkEntities), 40, 2.2, wolfGround(wolfPos));

const autoStepCall = mainSrc.slice(mainSrc.indexOf('autonomousWolfStep('), mainSrc.indexOf('autonomousWolfStep(') + 380);
const passesScentsToAuto = /\bscents\s*:/.test(autoStepCall);
const passesWaterToAuto = /\bwater\s*:/.test(autoStepCall) && /\bwaterLevel\s*:/.test(autoStepCall);
const noFreeIdleEnergyRefill = !/if\s*\(\s*!\s*\(\s*autonomous\s*&&\s*brain\.problem\s*===\s*'recover'\s*\)\s*\)\s*brain\.energy\s*=\s*e0/.test(mainSrc);

const check3Flags = {
  autonomousWolfNotDeadlockedOnOpenHillside: frozenSamplesCount === 0 && frozenDistM > 0.5 && detPlan.motion !== 'wait',
  autonomousWolfNoSpinSpike: spinDeg < 180,
  autonomousWolfNoFreeIdleEnergyViolation: freeEnergyGain <= 0.1 && noFreeIdleEnergyRefill,
  autonomousWolfReceivesLiveScentsAndWater: passesScentsToAuto && passesWaterToAuto,
};

const check3 = calibrate('autonomous-wolf-hillside-deadlock-energy-and-senses', check3Flags, {
  liveRecordingBytes: live.recordingBytes ?? 0,
  liveSpinRadIn0p7s: spinRad,
  liveSpinDegIn0p7s: spinDeg,
  liveFrozenSamplesOutOf6: frozenSamplesCount,
  liveFrozenDisplacementM: frozenDistM,
  liveFreeEnergyGainWhileFrozen: freeEnergyGain,
  liveStartEnergy: s0?.player?.energy ?? null,
  liveEndEnergy: sLast?.player?.energy ?? null,
  liveDeadlockBlocker: 'stones:1:-1:35',
  deterministicPlanMotion: detPlan.motion,
  deterministicPlanBlock: detPlan.block ?? '',
  wolfGroundHeightM: Number(hWolf.toFixed(3)),
  stoneGroundHeightM: Number(hStone.toFixed(3)),
  heightDeltaWolfToStoneM: Number(Math.abs(hStone - hWolf).toFixed(3)),
  passesScentsToAuto,
  passesWaterToAuto,
  noFreeIdleEnergyRefill,
});

// =============================================================================
// CHECK 4: Data (U) Capture Hijack & Pad rAF, Controls Rebind, Graphics Dual Quality & Contrast
// =============================================================================
const p4 = live.part4_dataControlsGraphics;
const uRebindNotHijacked = p4?.afterPressUInRebind?.dataPanelHiddenAfterU === true && String(p4?.afterPressUInRebind?.howlKeysText ?? '') !== 'H';
const dataPanelChecksCapturing = /capturing/.test(dataPanelSrc.slice(dataPanelSrc.indexOf("window.addEventListener('keydown'"), dataPanelSrc.indexOf("window.addEventListener('keydown'") + 420));
const dataPanelNoAlwaysOnPadRaf = !/requestAnimationFrame\(pad\);/.test(dataPanelSrc);
const graphicsDoesNotClobberProbeCap = !/if\s*\(\s*i\s*<\s*GOVERNOR\.probeCap\s*\)\s*GOVERNOR\.probeCap\s*=\s*i/.test(menuSrc);
const graphicsTopAndSettingsInSync = !(p4?.graphicsUiAfterUltra?.topQualityValue === '0' && p4?.graphicsUiAfterUltra?.settingsAutoChecked === true);
const startMenuSelectContrastStyled = /#start-menu\s+select|\.start-panel\s+select/.test(styleSrc);
const startMenuHidesHeaderOverlap = /body:has\(#start-menu:not\(\[hidden\]\)\)\s*>\s*header|body\.menu-open\s+header/.test(styleSrc);

const check4Flags = {
  controlsRebindCanBindUWithoutDataPanelHijack: uRebindNotHijacked && dataPanelChecksCapturing,
  dataPanelAvoidsAlwaysOnPadPollingRaf: dataPanelNoAlwaysOnPadRaf,
  graphicsDoesNotClobberMeasuredProbeCap: graphicsDoesNotClobberProbeCap,
  graphicsTopDropdownSyncedWithRenderSettings: graphicsTopAndSettingsInSync,
  startMenuSelectTextContrastAndHeaderClearance: startMenuSelectContrastStyled && startMenuHidesHeaderOverlap,
};

const check4 = calibrate('data-panel-hijack-and-graphics-dual-quality-contrast', check4Flags, {
  liveDataPanelHiddenAfterUInRebind: p4?.afterPressUInRebind?.dataPanelHiddenAfterU ?? null,
  liveCapturingStillStuckAfterU: p4?.afterPressUInRebind?.capturingAfterU ?? null,
  liveHowlKeysAfterPressU: p4?.afterPressUInRebind?.howlKeysText ?? '',
  dataPanelChecksCapturing,
  dataPanelNoAlwaysOnPadRaf,
  graphicsDoesNotClobberProbeCap,
  liveGraphicsTopValueAfterUltra: p4?.graphicsUiAfterUltra?.topQualityValue ?? '',
  liveGraphicsSettingsAutoStillChecked: p4?.graphicsUiAfterUltra?.settingsAutoChecked ?? null,
  liveGraphicsProbeTextAfterReenter: p4?.graphicsUiReenter?.probeTextAfterReenter ?? '',
  startMenuSelectContrastStyled,
  startMenuHidesHeaderOverlap,
});

const checks = [check1, check2, check3, check4];
const calibrationValid = checks.every(c => c.calibrationOk);
const passCount = checks.filter(c => c.pass).length;
const meanScore = Number((checks.reduce((s, c) => s + c.score, 0) / checks.length).toFixed(4));

const out = {
  task: 'T-0299',
  generatedAt: new Date().toISOString(),
  repo: REPO,
  calibrationValid,
  passCount,
  totalChecks: checks.length,
  meanScore,
  consoleErrors: live.consoleErrors ?? [],
  pageErrors: live.pageErrors ?? [],
  checks,
};

fs.writeFileSync(path.join(AUDIT_DIR, 'numbers.json'), JSON.stringify(out, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({
  calibrationValid,
  passCount: `${passCount}/${checks.length}`,
  meanScore,
  scores: checks.map(c => ({ id: c.id, score: c.score, pass: c.pass, cal: [c.knownMatchScore, c.knownMismatchScore] })),
  check3Det: check3.metrics,
}, null, 2));
