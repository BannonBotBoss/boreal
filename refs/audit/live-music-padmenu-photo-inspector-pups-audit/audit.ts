/**
 * Calibrated Rule 11 audit for T-0300:
 *   1. Live Pause -> Music Reset-to-Defaults Volume/Mute Wipe, #sound Button Desync & Stale Controls Copy:
 *      - Pressing M mutes boreal.volume.v1 (volume.muted = true) while top-bar #sound remains "Sound on"
 *        (main.ts:392-397 never subscribes soundLabel() to onBusChange) with zero notice().
 *      - Clicking "Reset to defaults" in Pause -> Music fires settingsPanel.ts:27 form.replaceWith(...),
 *        rebuilding only bare MUSIC_PANEL: deleting all 6 volume sliders (6 -> 0) and both Mute/Music-on
 *        checkboxes (2 -> 0), restoring the bogus "* applies when you resume (the world regenerates)." legend,
 *        detaching the Track -> musicOn sync listener, and leaving volume.musicOn = false after Off -> Reset.
 *      - controls.ts:58 still advertises "V flora view" while V is bound to cameraMode (bindings.ts:67).
 *   2. Live Tab Pad Menu Unclickable Rows / Unclosed Debug HUD & Photo Mode Preset Snap-Back / G-Gallery Stack / Edit Esc Trap:
 *      - padMenu.ts:215 listens only to [data-tab] clicks (0 click handler on .padm-body .it rows), and
 *        padMenu.ts:94 Debug HUD omits host.close(), leaving .padm (z-index: 70) open over the world.
 *      - photoMode.ts:62 hardcodes 'None' in buildPanel(), snapping the Preset dropdown back to "None" immediately
 *        after picking "B&W" (saturation = -1); pressing G in Photo Mode fires gameCamera.ts:87 showGallery(),
 *        stacking #photo-gallery directly over active #photo; clicking Edit -> Escape traps the user because
 *        photoMode.ts:199,239 return early while editing; gallery.ts:113-115 never revokes preview ObjectURLs.
 *   3. Live AnimalPicture-Broken view.pick() (0/7 Wolf Clicks Hit), Inspector 6 Hz Focus Wipe & Fox/Pup-Blind Senses HUD:
 *      - buildScene.ts:411 calls setBodyShare(row.root, row.proc) (animalDensity.ts:242 sets root.visible = false
 *        once AnimalPicture swaps in the Meshy GLB), while buildScene.ts:669-674 pick() raycasts only hidden
 *        procedural rigs (rejecting o?.visible === false) and omits AnimalPicture GLBs, litter pups & landing fox
 *        -> 0 / 7 live clicks directly on the visible mother wolf in frame-3 resolve any object.
 *      - inspector.ts:195-198,268 calls root.replaceChildren(...) every 10 frames (~6 Hz) on live animals,
 *        wiping DOM focus & active edits; inspector.ts:63-64 traces chunkSeed(cx, cz) twice; senses.ts:104-126
 *        never adds drivePose() (Red Fox) or pupCloud() (5 wolf pups) to sources or visualBodies.
 *   4. Live driveBridge.ts Rust-WASM Telemetry Freeze (21.194 m Drift), Mother Wolf 3.2 m/s Treadmill at CHARGE_M,
 *      & Wolf Pup Non-Uniform Scale Overwrite / Rigid sit/sniff/pounce/tumble Animation:
 *      - Once Rust WASM loads, driveBridge.ts:62-68 steps wasm.drives_tick() without updating globalThis.__borealDrive
 *        or drives.ts's last/driveParams(), freezing telemetry at 1 frame-0 sample while the rendered Red Fox moves
 *        across 14 distinct positions (21.194 m drift in live-capture.json).
 *      - Deterministically verified via stepDrives(): once mama reaches CHARGE_M = 4.5 m (room = 0, displacement = 0.000 m),
 *        now.hold stays true while fox finishes fleeing to > 18 m, yet main.ts:709 unconditionally sets
 *        brain.motion = 'run'; brain.speed = 3.2; brain.gaitSpeed = 3.2; (running in place at 3.2 m/s!).
 *      - pups.ts:82 sets non-uniform pup scale (grown * 1.1 * bulk, grown * bulk, grown * 1.12 * bulk) that
 *        pups.ts:115 immediately overwrites every draw frame with uniform (fit, fit, fit), and pups.ts:118 calls
 *        row.wolf.animate(clock, row.wolf.brain.motion === 'walk', undefined, 0, 'walk') — passing moving = false
 *        during 'jump' pounces/tumbles and zero sit/sniff posture differentiation.
 *
 * Run: npx tsx refs/audit/live-music-padmenu-photo-inspector-pups-audit/audit.ts [repoRoot]
 */
import fs from 'node:fs';
import path from 'node:path';
import { resetDrives, stepDrives, CHARGE_M } from '../../../src/core/drives';

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
const controlsSrc = fs.readFileSync(path.join(REPO, 'src/ui/controls.ts'), 'utf8');
const padMenuSrc = fs.readFileSync(path.join(REPO, 'src/ui/padMenu.ts'), 'utf8');
const photoModeSrc = fs.readFileSync(path.join(REPO, 'src/photo/photoMode.ts'), 'utf8');
const gallerySrc = fs.readFileSync(path.join(REPO, 'src/photo/gallery.ts'), 'utf8');
const gameCamSrc = fs.readFileSync(path.join(REPO, 'src/camera/gameCamera.ts'), 'utf8');
const buildSceneSrc = fs.readFileSync(path.join(REPO, 'src/render/buildScene.ts'), 'utf8');
const inspectorSrc = fs.readFileSync(path.join(REPO, 'src/ui/inspector.ts'), 'utf8');
const sensesSrc = fs.readFileSync(path.join(REPO, 'src/ui/senses.ts'), 'utf8');
const driveBridgeSrc = fs.readFileSync(path.join(REPO, 'src/render/driveBridge.ts'), 'utf8');
const pupsSrc = fs.readFileSync(path.join(REPO, 'src/animals/pups.ts'), 'utf8');

// =============================================================================
// CHECK 1: Pause -> Music Reset-to-Defaults Wipe, #sound Sync & Stale Controls Note
// =============================================================================
const p1 = live.part1_musicAudioControls;
const soundLabelSubscribed = /onBusChange\s*\(\s*\(\)\s*=>\s*soundLabel|onBusChange\s*\(\s*soundLabel/.test(mainSrc);
const liveSoundBtnSyncedAfterM = !(p1?.afterM?.volStore?.['volume.muted'] === true && p1?.afterM?.soundBtnText === 'Sound on');
const musicResetKeepsVolumeUi = (p1?.afterMusicReset?.sliderCount ?? 0) >= 6 && (p1?.afterMusicReset?.checkboxLabels?.length ?? 0) >= 2 && p1?.afterMusicReset?.bogusRegenLegendPresent === false;
const musicResetRestoresMusicOn = p1?.afterMusicReset?.selectedTrack === 'Fingerpicked' && p1?.afterMusicReset?.volStore?.['volume.musicOn'] === true;
const controlsNoteNoStaleVFlora = !/V flora view/.test(controlsSrc);

const check1Flags = {
  soundButtonSyncedWithMuteHotkeyAndBus: soundLabelSubscribed && liveSoundBtnSyncedAfterM,
  musicResetPreservesVolumeSlidersAndCheckboxes: musicResetKeepsVolumeUi,
  musicResetRestoresMusicOnWhenTrackResets: musicResetRestoresMusicOn,
  controlsScreenNoteRemovesStaleVFloraView: controlsNoteNoStaleVFlora,
};

const check1 = calibrate('music-reset-wipe-sound-desync-and-controls-note', check1Flags, {
  liveSoundBtnAfterM: p1?.afterM?.soundBtnText ?? '',
  liveMutedAfterM: p1?.afterM?.volStore?.['volume.muted'] ?? null,
  liveSlidersBeforeReset: p1?.beforeMusicResetUi?.sliderCount ?? 0,
  liveSlidersAfterReset: p1?.afterMusicReset?.sliderCount ?? 0,
  liveCheckboxesBeforeReset: p1?.beforeMusicResetUi?.checkboxLabels?.length ?? 0,
  liveCheckboxesAfterReset: p1?.afterMusicReset?.checkboxLabels?.length ?? 0,
  liveBogusRegenLegendAfterReset: p1?.afterMusicReset?.bogusRegenLegendPresent ?? null,
  liveTrackAfterReset: p1?.afterMusicReset?.selectedTrack ?? '',
  liveMusicOnAfterReset: p1?.afterMusicReset?.volStore?.['volume.musicOn'] ?? null,
  controlsNoteMentionsVFloraView: Boolean(p1?.controlsNoteMentionsVFloraView),
});

// =============================================================================
// CHECK 2: Tab Pad Menu Mouse-Dead Rows / Stuck Debug HUD & Photo Mode UX Traps
// =============================================================================
const p2 = live.part2_padMenuAndPhotoMode;
const padBodyHasClickHandler = /body\.addEventListener\s*\(\s*'click'/.test(padMenuSrc);
const padDebugHudClosesMenu = /label:\s*'Debug HUD'[\s\S]{0,120}host\.close\s*\(\s*\)/.test(padMenuSrc);
const photoPresetPersistsSelection = !/select\s*\(\s*'Preset'\s*,\s*Object\.keys\(PRESETS\)\s*,\s*'None'/.test(photoModeSrc)
  && String(p2?.afterPresetPick?.selectedPresetAfterPick ?? '') !== 'None';
const photoModeBlocksGalleryKeyG = /body\.classList\.contains\s*\(\s*'photo-mode'\s*\)/.test(gameCamSrc.slice(gameCamSrc.indexOf('const galleryKey'), gameCamSrc.indexOf('const galleryKey') + 260))
  && !(p2?.afterGInPhotoMode?.galleryDialogOpen === true && p2?.afterGInPhotoMode?.photoStillVisible === true);
const photoEditSupportsEscape = !(p2?.editEscResult?.enteredEdit === true && p2?.editEscResult?.stillEditingAfterEsc === true)
  && /if\s*\(\s*editing\s*\)\s*\{\s*endEdit\s*\(\s*false\s*\)/.test(photoModeSrc);
const galleryPreviewRevokesObjectUrl = /box\.onclick[\s\S]{0,140}revokeObjectURL/.test(gallerySrc);

const check2Flags = {
  padMenuRowsClickableByMouse: padBodyHasClickHandler,
  padMenuDebugHudClosesOverlay: padDebugHudClosesMenu && p2?.afterEnterDebugHud?.padMenuStillOpen === false,
  photoModePresetDropdownRetainsSelection: photoPresetPersistsSelection,
  photoModePreventsGGalleryStacking: photoModeBlocksGalleryKeyG,
  photoModeEditAllowsEscapeCancel: photoEditSupportsEscape,
  galleryPreviewRevokesBlobUrls: galleryPreviewRevokesObjectUrl,
};

const check2 = calibrate('padmenu-click-close-and-photomode-ux-traps', check2Flags, {
  padBodyHasClickHandler,
  padDebugHudClosesMenu,
  livePadMenuStillOpenAfterDebugHud: p2?.afterEnterDebugHud?.padMenuStillOpen ?? null,
  livePhotoPresetAfterBW: p2?.afterPresetPick?.selectedPresetAfterPick ?? '',
  livePhotoStoredSaturation: p2?.afterPresetPick?.storedSaturation ?? null,
  liveGalleryStackedOverPhoto: Boolean(p2?.afterGInPhotoMode?.galleryDialogOpen && p2?.afterGInPhotoMode?.photoStillVisible),
  liveGalleryHeading: p2?.afterGInPhotoMode?.galleryHeading ?? '',
  liveEditEntered: p2?.editEscResult?.enteredEdit ?? null,
  liveEditStillStuckAfterEsc: p2?.editEscResult?.stillEditingAfterEsc ?? null,
  galleryPreviewRevokesObjectUrl,
});

// =============================================================================
// CHECK 3: AnimalPicture-Broken view.pick(), Inspector Focus Wipe & Fox/Pup-Blind Senses
// =============================================================================
const p3 = live.part3_inspectorAndSenses;
const pickBlock = buildSceneSrc.slice(buildSceneSrc.indexOf('function pick('), buildSceneSrc.indexOf('function lookup('));
const pickIncludesPictureOrPupsOrFox = /picture|litter|landing/.test(pickBlock);
const liveWolfPickedByClick = String(p3?.selectedHeader ?? '').includes('player');
const inspectorPreservesFocusOnLiveRefresh = !/root\.replaceChildren\s*\(\s*head\s*,\s*body/.test(inspectorSrc) || /document\.activeElement/.test(inspectorSrc.slice(inspectorSrc.indexOf('function refresh()'), inspectorSrc.indexOf('function select(')));
const inspectorNoDuplicateChunkSeed = !/chunkSeed\(cx, cz\);\s*return \[\]/.test(inspectorSrc);
const sensesIncludesFoxAndPups = /drivePose|red_fox|fox/.test(sensesSrc) && /pupCloud|pups/.test(sensesSrc);

const check3Flags = {
  inspectorPickResolvesAnimalPictureAndPupsAndFox: pickIncludesPictureOrPupsOrFox && liveWolfPickedByClick,
  inspectorLiveRefreshPreservesInputFocus: inspectorPreservesFocusOnLiveRefresh,
  inspectorNoRedundantDoubleChunkSeedTrace: inspectorNoDuplicateChunkSeed,
  sensesHudDetectsLiveRedFoxAndWolfPups: sensesIncludesFoxAndPups,
};

const check3 = calibrate('inspector-animalpicture-pick-focus-and-fox-pup-senses', check3Flags, {
  liveSelectedHeaderAfter7WolfClicks: p3?.selectedHeader ?? '',
  liveInspectorVisible: p3?.focusWipeCheck?.inspectorVisible ?? null,
  pickIncludesPictureOrPupsOrFox,
  inspectorPreservesFocusOnLiveRefresh,
  inspectorNoDuplicateChunkSeed,
  sensesIncludesFoxAndPups,
  liveFoxPresentDistM: p3?.sensesState?.foxDistM ?? null,
  livePupCount: p3?.sensesState?.pupCount ?? 0,
  liveMinPupDistM: p3?.sensesState?.minPupDistM ?? null,
});

// =============================================================================
// CHECK 4: driveBridge WASM Telemetry Freeze, CHARGE_M 3.2 m/s Treadmill & Pup Scale/Pose
// =============================================================================
const p4 = live.part4_pupsAndDriveTelemetry;
const driveBridgePublishesGlobal = /__borealDrive/.test(driveBridgeSrc);
const liveDriveTelemetryTracksFox = (p4?.uniqueWindowBorealDrivePositions ?? 0) > 1 && (p4?.driveVsRenderedFoxDriftM ?? 999) < 1.0;

// Deterministic verification of CHARGE_M stationary treadmill & return-speed mismatch in stepDrives() + main.ts:709
resetDrives({ x: 0, z: -7.5, protect: 0.49 });
let mamaX = 0, mamaZ = 0, mamaYaw = 0;
let stationaryHoldTicks = 0;
let returnSpeedMismatchTicks = 0;
let chargeTicks = 0;
for (let i = 0; i < 240; i++) {
  const prevX = mamaX, prevZ = mamaZ;
  const now = stepDrives(mamaX, mamaZ, mamaYaw, mamaX, mamaZ + 0.8, false, 1 / 30);
  if (now.hold) {
    mamaX = now.mamaX;
    mamaZ = now.mamaZ;
    mamaYaw = now.mamaYaw + Math.PI;
    const stepSpeedMps = Math.hypot(mamaX - prevX, mamaZ - prevZ) * 30;
    if (now.committed) {
      chargeTicks++;
      if (stepSpeedMps < 0.05) stationaryHoldTicks++;
    }
    if (now.returning && Math.abs(stepSpeedMps - 3.2) > 0.3) returnSpeedMismatchTicks++;
  }
}
const mainChargeSpeedUsesActualMotion = !/brain\.motion\s*=\s*'run';\s*brain\.speed\s*=\s*3\.2;\s*brain\.gaitSpeed\s*=\s*3\.2;/.test(mainSrc);
const pupsNoScaleOverwrite = !(
  /row\.holder\.scale\.set\s*\(\s*grown\s*\*\s*1\.1\s*\*\s*bulk/.test(pupsSrc) &&
  /row\.holder\.scale\.set\s*\(\s*fit\s*,\s*fit\s*,\s*fit\s*\)/.test(pupsSrc)
);
const pupsAnimateDistinctPostures = !/row\.wolf\.animate\s*\(\s*clock\s*,\s*row\.wolf\.brain\.motion\s*===\s*'walk'\s*,\s*undefined\s*,\s*0\s*,\s*'walk'\s*\)/.test(pupsSrc);

const check4Flags = {
  driveBridgePublishesLiveWasmTelemetry: driveBridgePublishesGlobal && liveDriveTelemetryTracksFox,
  maternalChargeHaltsRunAnimationAtChargeLimit: mainChargeSpeedUsesActualMotion,
  pupPlacePreservesNonUniformProportions: pupsNoScaleOverwrite,
  pupAnimateDifferentiatesSitSniffPounceTumble: pupsAnimateDistinctPostures,
};

const check4 = calibrate('drivebridge-telemetry-freeze-charge-treadmill-and-pup-poses', check4Flags, {
  liveUniqueWindowBorealDrivePositions: p4?.uniqueWindowBorealDrivePositions ?? 0,
  liveUniqueLandingRenderedFoxPositions: p4?.uniqueLandingRenderedFoxPositions ?? 0,
  liveDriveVsRenderedFoxDriftM: p4?.driveVsRenderedFoxDriftM ?? null,
  driveBridgePublishesGlobal,
  chargeLimitM: CHARGE_M,
  deterministicChargeTicks: chargeTicks,
  deterministicStationaryTreadmillHoldTicks: stationaryHoldTicks,
  deterministicReturnSpeedMismatchTicks: returnSpeedMismatchTicks,
  mainChargeSpeedUsesActualMotion,
  pupsNoScaleOverwrite,
  pupsAnimateDistinctPostures,
  liveObservedPupActs: p4?.observedPupActs ?? [],
  liveRecordingBytes: live.recordingBytes ?? 0,
});

const checks = [check1, check2, check3, check4];
const calibrationValid = checks.every(c => c.calibrationOk);
const passCount = checks.filter(c => c.pass).length;
const meanScore = Number((checks.reduce((s, c) => s + c.score, 0) / checks.length).toFixed(4));

const out = {
  task: 'T-0300',
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
  check4Det: {
    chargeTicks,
    stationaryHoldTicks,
    returnSpeedMismatchTicks,
    driftM: p4?.driveVsRenderedFoxDriftM,
  },
}, null, 2));
