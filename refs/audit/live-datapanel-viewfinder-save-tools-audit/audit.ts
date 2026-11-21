/**
 * Calibrated Rule 11 audit for T-0302:
 *   1. Live Data (U) Panel & Early-Universe CosmosSphere:
 *      - dataPanel.ts:494 appends all 8 `planet` params to every non-planet/spacetime/reheating engine card
 *        (11 extra cards including hunger/senses/prey/danger/protect) -> 12x duplication (144 inputs for 56 unique keys,
 *        88 duplicate DOM inputs).
 *      - `Drives` section (`paintDrives()`, dataPanel.ts:343) reports `Mother effort 1.45e+12` while the Rust `prey`
 *        card right above it reports `mama effort: 1.000e+6` (a 1,450,000x discrepancy, plus diverged H/S/D/P values).
 *      - Pressing Escape while #data-panel is open leaves #data-panel open (z-index 70) and opens Pause Menu behind it (z-index 40).
 *      - Selecting #tier-lock ("high") and #tier-target ("33.3") before clicking #view-early does nothing (`sphere === null`),
 *        booting #cosmos-sphere at low 1280x720; clicking #follow-clock removes #cosmos-sphere yet leaves stale FPS
 *        ("1250 fps, this frame 0.8 ms") and stale #tier-lock; Expansion & Reheating plots have zero axis scales/ticks.
 *   2. Live Viewfinder #camera-panel Badge Dead-Lock, Broken Shift+P EXR, & Photo Gallery Export / Contrast / URL Leaks:
 *      - earn() has 0 call sites across src/ outside badges.ts:122 (submitTest) and mountBadgePanel() is unmounted,
 *        leaving 7/9 #camera-panel controls permanently disabled behind 🔒 with balance() === 0 forever.
 *      - #camera-panel readout advertises "Shift+P photo+EXR" in game view (gameCamera.ts:82), yet Shift+P captures
 *        0 photos & 0 EXRs in live gameplay (idbPhotoCount = 0; gameCamera.ts:86 skips view === 'game' and main.ts:419
 *        omits shiftKey).
 *      - gallery.ts:127 adds viewfinder shots with `selected: false` -> clicking Export says "Exported 0 file(s)." (0 downloads).
 *      - After checking the shot and selecting Resolution=4K, Aspect=16:9, Format=jpeg, Export ignores all 3 options
 *        and downloads raw screen-size `boreal_shot_1.png` (image/png, 192,252 B, gallery.ts:52).
 *      - #photo-gallery `<select>` dropdowns render unreadable white-on-white (frame-1), and Preview leaks unrevoked
 *        ObjectURLs (created = 2, revoked = 0, gallery.ts:113-115).
 *   3. Live Corrupted localStorage Boot Crash, Auto-Hidden Save Warning, Zero Recovery UI & Lying Pause->Save:
 *      - `localStorage.setItem('boreal.badges', 'null')` throws uncaught TypeError in `hasBadge` -> `mountCameraPanel`
 *        -> `buildScene`, causing main.ts:156 to falsely print "3D unavailable... WebGL2" and hang #loading forever.
 *      - Corrupt `boreal.events.v1 = "{not-valid-json"` disables all interactions (`saveBlocked = true`), auto-hides
 *        its 6 s warning before #loading finishes (`bootCorruptNotice.visible = false`), provides 0 reset/recovery
 *        buttons in Pause/Start Menu, and Pause -> Save prints "Saved 4:48:44 AM" while leaving `boreal.events.v1`
 *        untouched and corrupt (`rawEventsStorageStillCorrupt = true`, frame-2).
 *   4. Live Standalone Interactive Tools (`gamepad.html`, `locomotion-lab.html`, `planet-layers.html`, `deep-time.html`):
 *      - `tools/gamepad.html` (`gamepadSettings.ts`) has 0 mouse click listeners on `.tab` or `.row`
 *        (`mouseClickChangedTab = false`, `mouseClickChangedRow = false`, frame-3).
 *      - `tools/locomotion-lab.html` (`lab.ts`) renders `<select>` (`gait`, `LOD`) and `<button>` (`pause`, `pounce`)
 *        as unreadable white-on-white (frame-5).
 *      - `tools/planet-layers.html` (`planet-layers.ts`) lacks any colorbar legend/ticks and lat/lon graticule (frame-4 vs ref-1).
 *      - `tools/deep-time.html` (`deepTime.ts`) quantizes clicking "Earth forms (-4.54 Gyr)" into "Before the Earth / No globe"
 *        and labels `-538.8 Ma` Cambrian as "Oceans, forests and animals" (~154 Myr before Middle Devonian forests, ~385 Ma, Stein et al. 2007/2012).
 *
 * Run: npx tsx refs/audit/live-datapanel-viewfinder-save-tools-audit/audit.ts [repoRoot]
 */
import fs from 'node:fs';
import path from 'node:path';

const AUDIT_DIR = import.meta.dirname;
const REPO = path.resolve(process.argv[2] ?? path.join(AUDIT_DIR, '..', '..', '..'));

interface CheckMetrics {
  [k: string]: boolean | number | string | string[] | Record<string, unknown> | null;
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

function walkTs(dir: string): string[] {
  const out: string[] = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walkTs(full));
    else if (ent.isFile() && ent.name.endsWith('.ts')) out.push(full);
  }
  return out;
}

const live = JSON.parse(fs.readFileSync(path.join(AUDIT_DIR, 'live-capture.json'), 'utf8'));
const dataPanelSrc = fs.readFileSync(path.join(REPO, 'src/ui/dataPanel.ts'), 'utf8');
const gameCameraSrc = fs.readFileSync(path.join(REPO, 'src/camera/gameCamera.ts'), 'utf8');
const gallerySrc = fs.readFileSync(path.join(REPO, 'src/photo/gallery.ts'), 'utf8');
const badgesSrc = fs.readFileSync(path.join(REPO, 'src/core/badges.ts'), 'utf8');
const mainSrc = fs.readFileSync(path.join(REPO, 'src/main.ts'), 'utf8');
const menuSrc = fs.readFileSync(path.join(REPO, 'src/ui/menu.ts'), 'utf8');
const styleSrc = fs.readFileSync(path.join(REPO, 'src/style.css'), 'utf8');
const gamepadSettingsSrc = fs.readFileSync(path.join(REPO, 'src/ui/gamepadSettings.ts'), 'utf8');
const labSrc = fs.readFileSync(path.join(REPO, 'src/animals/locomotion/lab.ts'), 'utf8');
const planetLayersSrc = fs.readFileSync(path.join(REPO, 'tools/planet-layers.ts'), 'utf8');
const deepTimeSrc = fs.readFileSync(path.join(REPO, 'src/core/deepTime.ts'), 'utf8');

// =============================================================================
// CHECK 1: Live Data (U) Panel & CosmosSphere
// =============================================================================
const p1 = live.part1_dataPanelAndCosmosSphere;
const noPlanetParamDuplication = (p1?.initial?.duplicatedKeyCount ?? 1) === 0
  && !/inst\.type !== 'planet' && inst\.type !== 'spacetime' && inst\.type !== 'reheating' && p\.type === 'planet'/.test(dataPanelSrc);

const preyCard = (p1?.initial?.cardSummaries ?? []).find((c: { engine: string }) => c.engine === 'prey');
const rustMamaLine = (preyCard?.sampleVars ?? []).find((v: string) => v.includes('mama effort')) ?? '';
const drivesEffortLine = (p1?.initial?.drivesText ?? []).find((d: { id: string }) => d.id === 'effort')?.text ?? '';
const rustMamaMatch = /mama effort:\s*([\d.e+-]+)/i.exec(rustMamaLine);
const drivesMamaMatch = /Mother effort\s*([\d.e+-]+)/i.exec(drivesEffortLine);
const rustMamaVal = rustMamaMatch ? Number(rustMamaMatch[1]) : NaN;
const drivesMamaVal = drivesMamaMatch ? Number(drivesMamaMatch[1]) : NaN;
const mamaEffortRatio = Number.isFinite(rustMamaVal) && Number.isFinite(drivesMamaVal) && rustMamaVal > 0
  ? Number((drivesMamaVal / rustMamaVal).toFixed(2))
  : null;
const drivesMatchesRustPrey = Number.isFinite(rustMamaVal) && Number.isFinite(drivesMamaVal)
  && Math.abs(drivesMamaVal - rustMamaVal) / Math.max(1, rustMamaVal) < 0.05;

const escapeClosesDataPanel = p1?.escapeWithDataOpen?.dataPanelStillOpen === false
  && p1?.escapeWithDataOpen?.pauseMenuOpenedBehind === false;

const sphereHonorsPendingLock = (p1?.earlyUniverse?.sphereCanvasW ?? 0) >= 1920
  && /if\s*\(\s*nodes\.lock\?\.value\s*\).*lockTier/.test(dataPanelSrc);

const followClockClearsStaleFps = !/\d+\s*fps/i.test(p1?.afterFollowClock?.staleFpsText ?? '');

const plotsHaveAxisScales = /fillText\s*\([^)]*(minX|maxX|minY|maxY|10\^|tick|axis)/i.test(dataPanelSrc);

const check1 = calibrate('data-panel-param-duplication-drives-escape-and-sphere-state', {
  noPlanetParamDuplicationAcrossCards: noPlanetParamDuplication,
  drivesSectionMatchesRustPreyEngine: drivesMatchesRustPrey,
  escapeClosesDataPanelInsteadOfPauseBehind: escapeClosesDataPanel,
  sphereAppliesPendingTierLockAndTarget: sphereHonorsPendingLock,
  followClockClearsStaleSphereFpsAndTier: followClockClearsStaleFps,
  expansionAndReheatingPlotsHaveAxisScales: plotsHaveAxisScales,
}, {
  liveTotalParamInputs: p1?.initial?.totalParamInputs ?? null,
  liveUniqueParamKeys: p1?.initial?.uniqueParamKeys ?? null,
  liveDuplicatedKeyCount: p1?.initial?.duplicatedKeyCount ?? null,
  liveDuplicateCopiesPerPlanetKey: p1?.initial?.duplicatedKeysSample?.[0]?.[1] ?? null,
  liveRustMamaEffort: rustMamaVal,
  liveDrivesMamaEffort: drivesMamaVal,
  liveMamaEffortDiscrepancyFactor: mamaEffortRatio,
  liveDataPanelZ: p1?.escapeWithDataOpen?.dataPanelZ ?? null,
  livePauseMenuZ: p1?.escapeWithDataOpen?.menuZ ?? null,
  liveSphereWidthWhenLockedHigh: p1?.earlyUniverse?.sphereCanvasW ?? null,
  liveStaleFpsAfterFollowClock: p1?.afterFollowClock?.staleFpsText ?? null,
});

// =============================================================================
// CHECK 2: Live Viewfinder #camera-panel Dead-Lock, Shift+P EXR & Photo Gallery
// =============================================================================
const p2 = live.part2_viewfinderCameraAndGallery;
const srcFiles = walkTs(path.join(REPO, 'src'));
let externalEarnCalls = 0;
let externalBadgePanelMounts = 0;
for (const f of srcFiles) {
  const norm = f.replace(/\\/g, '/');
  const txt = fs.readFileSync(f, 'utf8');
  if (!norm.endsWith('/core/badges.ts') && /\bearn\s*\(/.test(txt)) externalEarnCalls++;
  if (!norm.endsWith('/ui/badgePanel.ts') && /\bmountBadgePanel\s*\(/.test(txt)) externalBadgePanelMounts++;
}

const gameplayEarnsCreditsOrUnlocks = externalEarnCalls > 0 || externalBadgePanelMounts > 0;
const shiftPCapturesExrInGame = (p2?.afterShiftP?.idbPhotoCount ?? 0) > 0
  && Boolean(p2?.afterShiftP?.photosMeta?.[0]?.hasExr);
const viewfinderShotsSelectedOrGuarded = p2?.galleryAudit?.initialChecked?.[0] === true
  || !/Exported 0 file\(s\)/.test(p2?.galleryAudit?.noticeAfterDefaultExport ?? '');
const galleryHonorsExportFormatForShots = (p2?.galleryAudit?.createdDuringExport?.[0]?.type === 'image/jpeg')
  && /\.jpe?g$/i.test(p2?.galleryAudit?.dlAfterJpeg4kExport?.[0]?.download ?? '');
const gallerySelectsStyledReadable = /#photo-gallery[^{]*select\s*\{[^}]*color\s*:/i.test(styleSrc);
const galleryPreviewRevokesUrls = (p2?.galleryAudit?.previewObjectUrlsCreated ?? 0) > 0
  && (p2?.galleryAudit?.previewObjectUrlsRevoked ?? 0) >= (p2?.galleryAudit?.previewObjectUrlsCreated ?? 1) - 1;

const check2 = calibrate('viewfinder-badge-deadlock-shiftp-exr-and-gallery-export', {
  gameplayCallsEarnCreditsOrMountsBadgesUi: gameplayEarnsCreditsOrUnlocks,
  shiftPCapturesExrInGameView: shiftPCapturesExrInGame,
  viewfinderShotsDefaultSelectedOrZeroExportGuarded: viewfinderShotsSelectedOrGuarded,
  galleryHonorsExportOptionsForViewfinderShots: galleryHonorsExportFormatForShots,
  gallerySelectsStyledReadableContrast: gallerySelectsStyledReadable,
  galleryPreviewRevokesObjectUrls: galleryPreviewRevokesUrls,
}, {
  liveCameraPanelLockedControls: p2?.camPanelInitial?.lockedCount ?? null,
  liveCameraPanelTotalControls: p2?.camPanelInitial?.totalControls ?? null,
  externalEarnCallSitesInSrc: externalEarnCalls,
  externalBadgePanelMountsInSrc: externalBadgePanelMounts,
  liveFocal35vs400mmMad: p2?.focalSliderDiff35vs400mm?.mad ?? null,
  liveShiftPPhotoCount: p2?.afterShiftP?.idbPhotoCount ?? null,
  liveGalleryInitialChecked: p2?.galleryAudit?.initialChecked ?? null,
  liveGalleryDefaultExportNotice: p2?.galleryAudit?.noticeAfterDefaultExport ?? null,
  liveGallery4kJpegExportFilename: p2?.galleryAudit?.dlAfterJpeg4kExport?.[0]?.download ?? null,
  liveGallery4kJpegExportMime: p2?.galleryAudit?.createdDuringExport?.[0]?.type ?? null,
  liveGalleryPreviewUrlsCreated: p2?.galleryAudit?.previewObjectUrlsCreated ?? null,
  liveGalleryPreviewUrlsRevoked: p2?.galleryAudit?.previewObjectUrlsRevoked ?? null,
});

// =============================================================================
// CHECK 3: Live Corrupted localStorage Boot Crash, Blocked Save & Lying Pause->Save
// =============================================================================
const p3 = live.part3_saveExportAndCorruptStorage;
const nullBadgesBootSafe = p3?.corruptAllStoresAndNullBadges?.loadedWithin15s === true
  && (p3?.corruptAllStoresAndNullBadges?.errors?.length ?? 1) === 0
  && !/const badges = \(\) => read<Record<string, Via>>\('boreal\.badges', \{\}\);/.test(badgesSrc);

const corruptNoticePersistsPastBoot = p3?.corruptEventsBoot?.bootCorruptNotice?.visible === true;

const pauseSaveHonestWhenBlocked = !(p3?.corruptEventsBoot?.pauseSaveWhenBlocked?.rawEventsStorageStillCorrupt === true
  && (p3?.corruptEventsBoot?.pauseSaveWhenBlocked?.pauseNoteAfterClickingSave ?? []).some((s: string) => /^Saved\b/i.test(s)));

const corruptSaveHasRecoveryAction = p3?.corruptEventsBoot?.pauseSaveWhenBlocked?.hasRecoverOrResetButton === true;

const check3 = calibrate('corrupt-localstorage-boot-crash-blocked-save-and-export', {
  nullBadgesDoesNotCrashGameBoot: nullBadgesBootSafe,
  corruptSaveNoticePersistsPastLoading: corruptNoticePersistsPastBoot,
  pauseSaveDoesNotLieWhenSaveBlocked: pauseSaveHonestWhenBlocked,
  corruptSaveOffersRecoveryAction: corruptSaveHasRecoveryAction,
}, {
  liveNullBadgesLoaded: p3?.corruptAllStoresAndNullBadges?.loadedWithin15s ?? null,
  liveNullBadgesStatusText: p3?.corruptAllStoresAndNullBadges?.state?.statusText ?? null,
  liveNullBadgesErrorCount: p3?.corruptAllStoresAndNullBadges?.errors?.length ?? null,
  liveCorruptNoticeVisibleAfterLoad: p3?.corruptEventsBoot?.bootCorruptNotice?.visible ?? null,
  liveCorruptPauseSaveNote: p3?.corruptEventsBoot?.pauseSaveWhenBlocked?.pauseNoteAfterClickingSave?.[0] ?? null,
  liveCorruptRawEventsStillDamaged: p3?.corruptEventsBoot?.pauseSaveWhenBlocked?.rawEventsStorageStillCorrupt ?? null,
  liveCorruptHasRecoveryButton: p3?.corruptEventsBoot?.pauseSaveWhenBlocked?.hasRecoverOrResetButton ?? null,
  liveHealthyExportRecordCount: p3?.healthyExportEvents?.recordCount ?? null,
});

// =============================================================================
// CHECK 4: Live Standalone Interactive Tools (gamepad, locomotion-lab, planet-layers, deep-time)
// =============================================================================
const p4 = live.part4_standaloneInteractiveTools;
const gamepadMouseSupport = p4?.gamepadHtml?.mouseClickChangedTab === true
  && p4?.gamepadHtml?.mouseClickChangedRow === true
  && /addEventListener\s*\(\s*['"]click['"]|\.onclick\s*=/.test(gamepadSettingsSrc);

const locomotionControlsContrast = /#ui\s+(select|button)[^{]*\{[^}]*color\s*:/i.test(labSrc);

const planetLayersColorbarAndGraticule = /colorbar|legend|graticule|lat.*tick/i.test(planetLayersSrc);

const earthMs = (p4?.deepTimeHtml?.milestones ?? []).find((m: { id: string }) => m.id === 'earth');
const cambrianMs = (p4?.deepTimeHtml?.milestones ?? []).find((m: { id: string }) => m.id === 'animals');
const deepTimeEarthAndCambrianAccurate = !(earthMs?.card ?? '').includes('Before the Earth')
  && !(cambrianMs?.card ?? '').includes('forests')
  && !/'living-earth':\s*\{[^}]*Oceans, forests and animals/.test(deepTimeSrc);

const check4 = calibrate('standalone-tools-mouse-contrast-colorbar-and-deeptime', {
  gamepadSettingsSupportsMouseTabAndRowClicks: gamepadMouseSupport,
  locomotionLabSelectsAndButtonsStyledReadable: locomotionControlsContrast,
  planetLayersHasColorbarLegendAndGraticule: planetLayersColorbarAndGraticule,
  deepTimeEarthMilestoneAndCambrianTextAccurate: deepTimeEarthAndCambrianAccurate,
}, {
  liveGamepadMouseChangedTab: p4?.gamepadHtml?.mouseClickChangedTab ?? null,
  liveGamepadMouseChangedRow: p4?.gamepadHtml?.mouseClickChangedRow ?? null,
  livePlanetLayersTsInfo: p4?.planetLayersHtml?.tsInfo ?? null,
  livePlanetLayersTairInfo: p4?.planetLayersHtml?.sampleLayers?.tair ?? null,
  liveDeepTimeEarthCard: earthMs?.card ?? null,
  liveDeepTimeCambrianCard: cambrianMs?.card ?? null,
  liveTreeViewerReady: p4?.treeViewerHtml?.ready ?? null,
  livePadMenuErrors: p4?.padMenuHtml?.errors?.length ?? null,
});

const checks = [check1, check2, check3, check4];
const calibrationValid = checks.every(c => c.calibrationOk);
const passCount = checks.filter(c => c.pass).length;
const meanScore = Number((checks.reduce((s, c) => s + c.score, 0) / checks.length).toFixed(4));

const out = {
  task: 'T-0302',
  auditedAt: new Date().toISOString(),
  repo: REPO,
  calibrationValid,
  passCount,
  totalChecks: checks.length,
  meanScore,
  checks,
};

fs.writeFileSync(path.join(AUDIT_DIR, 'numbers.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify({ calibrationValid, passCount, totalChecks: checks.length, meanScore, scores: checks.map(c => [c.id, c.score, c.pass]) }, null, 2));
