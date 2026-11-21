/**
 * Calibrated Rule 11 audit for T-0301:
 *   1. Live Standalone & In-Page Globe Layer Panel Dead Toggles, Hadean Orbital Clouds, Focus Wipe & Universe Seed Ignore:
 *      - At orbital altitude (14,016 km), globeView.ts:681 calls setOrbitView(alt, 0) -> ORBIT_DRAW.uOrbitDeck = 1
 *        unconditionally, ignoring isOn('clouds') completely. Even at ?deep=-4.45e9 (Hadean magma ocean where
 *        #globe-layers explicitly disables Clouds, Ocean, Vegetation, Snow/ice as "(not yet formed)"), the live
 *        compositor renders 38.88% white NASA Blue Marble cyclone clouds & 15.25% blue ocean (vs 38.88% / 14.98%
 *        present-day).
 *      - isOn('vegetation'), isOn('ocean'), and isOn('venus') have 0 references in globeView.ts: unchecking Clouds,
 *        Vegetation, Ocean, or Venus yields bit-identical disc metrics (21,019 white px / 8,222 blue px / 0.5693 lum
 *        across all 4), whereas positive control Sunlight drops white px to 18 (0.04%) & lum to 0.1370 (MAD 78.67).
 *      - layerPanel.ts:43 calls box.replaceChildren() on every toggle, wiping keyboard focus on 5/5 tested checkboxes
 *        (focusedBefore=true -> activeTagAfterClick='BODY', sameDomNodeAfterClick=false).
 *      - startGlobe (globeView.ts:101) ignores boreal.universe.seed.v1 (worldSeedFromUniverse(1400) = 1587008242),
 *        booting legacy WORLD_SEED = 1400 instead; and globeView.ts:194 never mounts #globe-layers on in-page Shift+G.
 *   2. Live Through-Planet Axis Cutaway (axisView.ts) & SPH Parcels (parcels.ts) Broken Picking, Commented Log-Depth,
 *      White-on-White Buttons, Occluded Core & Dispose Leak:
 *      - axisView.ts:24 accidentally embeds `lineMat.onBeforeCompile = withLogDepth;` inside a `//` line comment.
 *      - globeView.ts:320 dblclick in axis mode calls `axis.pick([dir.x, dir.y, dir.z])` (camera nadir) instead of
 *        `pickSurface(e)` -> off-center dblclick at (770, 290) snapped û to exact camera nadir 49.77°N, 65.54°E (0.00°).
 *      - axisView.ts:55 buttons inherit light button styling over white fill (unreadable white-on-white in frame-1);
 *        clicking × hides the UI forever with zero reopen affordance; and globeView.ts:523-530 dispose() never removes
 *        axis UI DOM or disposes its GPU resources (stillInDomAfterDispose = true).
 *      - parcels.ts:35 clamps gl_PointSize up to 48 px without clipping to the cutaway hemisphere, producing oversized
 *        opaque brown discs protruding outside the limb and occluding the iron core in frame-1.
 *   3. Live In-Page Globe (Shift+G) Escape Trap / Prompt Overlap / Missing WASD Orbit & C Stealth-Camera Key Collision:
 *      - Pressing default Stealth key `c` (`bindings.ts:39`, footer `"C stealth"`) in live gameplay triggers
 *        `cameraPanel.ts:25` (`if (e.key === 'c') body.hidden = !body.hidden;`), popping the 266 px-tall #camera-panel
 *        open over the footer buttons on every single stealth press, while Shift+C (`'C'`) is ignored (`camBodyHiddenAfterUpperC = true`).
 *      - Pressing Escape on in-page globe calls `openStart()` (`main.ts:451`, mode = 'start') without hiding
 *        `#flight-prompt` (overlaps "Universe options..." / "Controls" in frame-2) and traps Escape (`menu.ts:117`
 *        only closes on `mode === 'pause'`, so a 2nd Escape leaves `menuStillTrappedVisible = true`).
 *      - `inpage.ts:217-222` (`toGlobe(true)`) resets orbit aim back to `forestLanding()` after walking away; and
 *        `globeView.ts:324-332` never binds W/A/S/D orbit keys despite `bindings.ts:71-74` defining `globeOrbit*`.
 *   4. Live Mobile 390×844 Portrait Responsive Layout Collapse & Missing Touch Controls (style.css):
 *      - In live gameplay (`390×844`, `isMobile: true`): `#interaction` (`right: 548`) & `#camera-panel` (`top: 1145`,
 *        301 px below screen bottom) force layout viewport zoom-out to `548×1186`; `#status` swallows `Boreal`
 *        (`headerVsStatus = 12,194 px²` overlap) while `Data (U)` covers `#status`; footer hint clips vertically;
 *        and `touchControlsCount = 0` (zero touch movement/interact controls).
 *      - In Photo Mode (`frame-4`): `#photo-bar` (`left: 14px; right: 300px`) is crushed to `76 px` wide
 *        (`scrollWidth = 535 px`, `internalOverflowPx = 459 px`), spilling `Photo`/`Rec`/`Grid`/`Exit` under
 *        `#photo-panel` (`270 px` = 69.2% of screen) and off-screen; `#photo-hints` (`width = 1372 px`, `left = -491 px`)
 *        clips on both edges and collides behind `Data (U)`.
 *      - In Pause -> Controls: `.ctl-screen` (`minmax(300px,430px) minmax(380px,1fr)`) has zero `@media` stacking
 *        (`ctlWidth = 698 px` inside `374 px` panel -> `panelHorizontalOverflowPx = 324 px`).
 *
 * Run: npx tsx refs/audit/live-globe-layers-axis-inpage-mobile-audit/audit.ts [repoRoot]
 */
import fs from 'node:fs';
import path from 'node:path';

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
const globeSrc = fs.readFileSync(path.join(REPO, 'src/world/globe/globeView.ts'), 'utf8');
const layerPanelSrc = fs.readFileSync(path.join(REPO, 'src/world/globe/layerPanel.ts'), 'utf8');
const orbitAlbedoSrc = fs.readFileSync(path.join(REPO, 'src/world/globe/orbitAlbedo.ts'), 'utf8');
const axisSrc = fs.readFileSync(path.join(REPO, 'src/world/globe/axisView.ts'), 'utf8');
const parcelsSrc = fs.readFileSync(path.join(REPO, 'src/world/globe/parcels.ts'), 'utf8');
const inpageSrc = fs.readFileSync(path.join(REPO, 'src/world/globe/inpage.ts'), 'utf8');
const camPanelSrc = fs.readFileSync(path.join(REPO, 'src/ui/cameraPanel.ts'), 'utf8');
const menuSrc = fs.readFileSync(path.join(REPO, 'src/ui/menu.ts'), 'utf8');
const styleSrc = fs.readFileSync(path.join(REPO, 'src/style.css'), 'utf8');

// =============================================================================
// CHECK 1: Globe Layer Panel Dead Toggles, Hadean Clouds, Focus Wipe & Seed/In-Page Sync
// =============================================================================
const p1 = live.part1_globeLayersAndHadean;
const p3 = live.part3_inpageGlobeAndCameraHijack;

const orbitCloudRespectsToggle = /setOrbitView\s*\([^)]*isOn\s*\(\s*['"]clouds['"]\s*\)/.test(globeSrc)
  || /ORBIT_DRAW\.uOrbitDeck\.value\s*=.*isOn\s*\(\s*['"]clouds['"]\s*\)/.test(globeSrc)
  || /setOrbitView\s*\([^,]+,[^,]+,\s*[^)]+\)/.test(orbitAlbedoSrc);
const hadeanCloudless = (p1?.hadeanCompositorAnalysis?.whiteCloudFrac ?? 1) < 0.05
  && (p1?.hadeanCompositorAnalysis?.blueOceanFrac ?? 1) < 0.05;
const vegOceanVenusWired = /isOn\s*\(\s*['"]vegetation['"]\s*\)/.test(globeSrc)
  && /isOn\s*\(\s*['"]ocean['"]\s*\)/.test(globeSrc)
  && /isOn\s*\(\s*['"]venus['"]\s*\)/.test(globeSrc);
const layerPanelPreservesFocus = !/box\.replaceChildren\s*\(\s*\)/.test(layerPanelSrc)
  && p1?.layerTests?.clouds?.activeTagAfterClick !== 'BODY';
const startGlobeReadsUniverseSeed = /readUniverseSeed|boreal\.universe\.seed\.v1/.test(globeSrc.slice(0, 6000));
const inpageMountsLayerPanel = p3?.onInpageGlobe?.globeLayersElExists === true;

const check1Flags = {
  orbitalCloudDeckRespectsCloudsToggle: orbitCloudRespectsToggle,
  hadeanEarthHasNoModernCloudsOrOceans: hadeanCloudless,
  vegetationOceanVenusCheckboxesWired: vegOceanVenusWired,
  layerPanelPreservesCheckboxFocus: layerPanelPreservesFocus,
  standaloneGlobeHonorsUniverseSeed: startGlobeReadsUniverseSeed,
  inpageGlobeMountsLayerPanel: inpageMountsLayerPanel,
};

const check1 = calibrate('globe-layer-panel-hadean-clouds-focus-and-seed', check1Flags, {
  liveHadeanWhiteCloudFrac: p1?.hadeanCompositorAnalysis?.whiteCloudFrac ?? null,
  liveHadeanBlueOceanFrac: p1?.hadeanCompositorAnalysis?.blueOceanFrac ?? null,
  livePresentWhiteCloudFrac: p1?.compositorBaseDisc?.whiteCloudFrac ?? null,
  liveCloudsOffWhiteCloudPx: p1?.compositorDiffs?.clouds?.offDisc?.whiteCloudPx ?? null,
  liveVegOffWhiteCloudPx: p1?.compositorDiffs?.vegetation?.offDisc?.whiteCloudPx ?? null,
  liveOceanOffWhiteCloudPx: p1?.compositorDiffs?.ocean?.offDisc?.whiteCloudPx ?? null,
  liveVenusOffWhiteCloudPx: p1?.compositorDiffs?.venus?.offDisc?.whiteCloudPx ?? null,
  liveSunlightControlOffWhiteCloudPx: p1?.compositorDiffs?.sunlight?.offDisc?.whiteCloudPx ?? null,
  liveSunlightControlMeanAbsDiff: p1?.compositorDiffs?.sunlight?.diff?.meanAbsDiff ?? null,
  liveActiveTagAfterCloudsClick: p1?.layerTests?.clouds?.activeTagAfterClick ?? null,
  liveStandaloneSeedWithUniverse1400: p1?.globeInit?.seed ?? null,
  liveInpageGlobeLayersElExists: p3?.onInpageGlobe?.globeLayersElExists ?? null,
});

// =============================================================================
// CHECK 2: Through-Planet Axis Cutaway & SPH Parcels Bugs
// =============================================================================
const p2 = live.part2_axisCutawayAndParcels;
const lineMatLogDepthNotCommented = !/\/\/[^\n]*lineMat\.onBeforeCompile\s*=\s*withLogDepth/.test(axisSrc)
  && /^\s*lineMat\.onBeforeCompile\s*=\s*withLogDepth/m.test(axisSrc);
const axisDblclickUsesPickSurface = !/if\s*\(\s*axis\.on\s*\)\s*\{\s*axis\.pick\s*\(\s*\[\s*dir\.x\s*,\s*dir\.y\s*,\s*dir\.z\s*\]\s*\)/.test(globeSrc);
const axisHasDisposeAndGlobeCallsIt = /dispose\s*\(\s*\)\s*\{/.test(axisSrc)
  && /axis\.dispose\s*\(\s*\)/.test(globeSrc)
  && p2?.axisAfterCloseAndR?.stillInDomAfterDispose === false;
const axisButtonsStyledReadable = /ui\.querySelectorAll\s*\(\s*['"]button['"]\s*\)|button\s*\{\s*background:/.test(axisSrc)
  || /style="[^"]*background:[^"]*color:/.test(axisSrc);
const parcelsReasonablePointSizeAndClip = !/gl_PointSize\s*=\s*clamp\([^)]*48\.0\s*\)/.test(parcelsSrc);

const check2Flags = {
  axisLineLogDepthActiveNotCommented: lineMatLogDepthNotCommented,
  axisDblclickUsesPickedSurfaceNotNadir: axisDblclickUsesPickSurface,
  axisDisposedOnGlobeDispose: axisHasDisposeAndGlobeCallsIt,
  axisButtonsHaveReadableDarkContrast: axisButtonsStyledReadable,
  parcelsDiscSizeAndCutawayBounded: parcelsReasonablePointSizeAndClip,
};

const check2 = calibrate('axis-cutaway-logdepth-pick-dispose-and-parcels', check2Flags, {
  liveDblclickSnappedToCameraSubLat: p2?.axisAfterDblClick?.cameraSubLatDeg ?? null,
  liveDblclickSnappedToCameraSubLon: p2?.axisAfterDblClick?.cameraSubLonDeg ?? null,
  liveAxisPreAfterDblclickFirstLine: (p2?.axisAfterDblClick?.preText ?? '').split('\n')[0] ?? '',
  liveDisplayAfterCloseAndR: p2?.axisAfterCloseAndR?.displayAfterCloseAndR ?? null,
  liveStillInDomAfterDispose: p2?.axisAfterCloseAndR?.stillInDomAfterDispose ?? null,
});

// =============================================================================
// CHECK 3: In-Page Globe Menu Escape Trap / Prompt Overlap / WASD Orbit & C Stealth-Camera Collision
// =============================================================================
const cStealthDoesNotOpenCameraPanel = p3?.cStealthCameraCollision?.afterC?.camBodyHidden === true
  && !/if\s*\(\s*e\.key\s*===\s*['"]c['"]\s*\)\s*body\.hidden\s*=\s*!body\.hidden/.test(camPanelSrc);
const cameraShortcutCaseInsensitiveOrRebindable = !/if\s*\(\s*e\.key\s*===\s*['"]c['"]\s*\)/.test(camPanelSrc)
  && p3?.camBodyHiddenAfterUpperC === false;
const inpageGlobeEscDismissesMenu = p3?.inpageEscapeAndWheelLeak?.afterSecondEsc?.menuStillTrappedVisible === false
  && !/else if\s*\(\s*e\.key\s*===\s*['"]Escape['"]\s*\)\s*\{[^}]*else if\s*\(\s*mode\s*===\s*['"]pause['"]\s*\)\s*close\s*\(\s*\)/.test(menuSrc);
const flightPromptHiddenWhenMenuOpen = !/showPrompt\s*\(\s*flightPrompt\s*\(\s*entryName\s*\(\s*\)\s*,\s*padOn\s*\(\s*\)\s*\)\s*\)/.test(inpageSrc)
  || /overlayOpen\s*\(\s*\)\s*\?\s*['"]['"]/.test(inpageSrc);
const globeSupportsWasdOrbitBindings = /e\.key\s*===\s*['"]w['"]|globeOrbitLeft/.test(globeSrc);

const check3Flags = {
  stealthKeyCDoesNotPopupCameraPanel: cStealthDoesNotOpenCameraPanel,
  cameraPanelKeyNotCaseSensitiveLowerCOnly: cameraShortcutCaseInsensitiveOrRebindable,
  inpageGlobeEscapeClosesMenuCleanly: inpageGlobeEscDismissesMenu,
  flightPromptHidesUnderOpenMenu: flightPromptHiddenWhenMenuOpen,
  globeHandlesDeclaredWasdOrbitKeys: globeSupportsWasdOrbitBindings,
};

const check3 = calibrate('inpage-globe-escape-prompt-wasd-and-c-stealth-collision', check3Flags, {
  liveCamHiddenBeforeC: p3?.cStealthCameraCollision?.beforeC?.camBodyHidden ?? null,
  liveCamHiddenAfterC: p3?.cStealthCameraCollision?.afterC?.camBodyHidden ?? null,
  liveCamPanelHeightAfterC: p3?.cStealthCameraCollision?.afterC?.camPanelHeight ?? 0,
  liveCamHiddenAfterUpperC: p3?.camBodyHiddenAfterUpperC ?? null,
  liveMenuStillTrappedAfterSecondEsc: p3?.inpageEscapeAndWheelLeak?.afterSecondEsc?.menuStillTrappedVisible ?? null,
  liveFlightPromptVisibleBehindMenu: p3?.inpageEscapeAndWheelLeak?.afterFirstEsc?.flightPromptVisible ?? null,
});

// =============================================================================
// CHECK 4: Live Mobile 390×844 Responsive Layout Collapse & Touch Controls
// =============================================================================
const p4 = live.part4_mobileResponsive;
const mobileNoViewportBlowout = (p4?.mobileHud?.viewport?.w ?? 999) <= 400
  && (p4?.mobileHud?.overlaps?.headerVsStatus ?? 99999) === 0;
const mobilePhotoBarFitsWithoutOverflow = (p4?.mobilePhoto?.photoBar?.internalOverflowPx ?? 999) <= 4
  && (p4?.mobilePhoto?.photoBar?.width ?? 0) >= 240
  && /@media[^{]*\{[^}]*#photo-bar/.test(styleSrc);
const mobilePhotoHintsNoHorizontalClip = (p4?.mobilePhoto?.photoHints?.clippedLeftPx ?? 999) <= 4
  && (p4?.mobilePhoto?.photoHints?.width ?? 9999) <= 390;
const mobileControlsStackVertically = (p4?.mobileControls?.panelHorizontalOverflowPx ?? 999) <= 4
  && /@media[^{]*\{[^}]*\.ctl-screen/.test(styleSrc);
const mobileHasTouchControls = (p4?.mobileHud?.touchControlsCount ?? 0) > 0;

const check4Flags = {
  mobileHudNoViewportBlowoutOrHeaderStatusOverlap: mobileNoViewportBlowout,
  mobilePhotoBarFitsWithout459pxOverflow: mobilePhotoBarFitsWithoutOverflow,
  mobilePhotoHintsWrapWithoutEdgeClip: mobilePhotoHintsNoHorizontalClip,
  mobileControlsScreenStacksWithout324pxOverflow: mobileControlsStackVertically,
  mobileProvidesTouchMovementControls: mobileHasTouchControls,
};

const check4 = calibrate('mobile-390x844-responsive-collapse-and-touch', check4Flags, {
  liveMobileViewportW: p4?.mobileHud?.viewport?.w ?? null,
  liveMobileViewportH: p4?.mobileHud?.viewport?.h ?? null,
  liveHeaderVsStatusOverlapPx2: p4?.mobileHud?.overlaps?.headerVsStatus ?? null,
  liveCameraPanelTopPx: p4?.mobileHud?.cameraPanel?.top ?? null,
  livePhotoBarWidthPx: p4?.mobilePhoto?.photoBar?.width ?? null,
  livePhotoBarScrollWidthPx: p4?.mobilePhoto?.photoBar?.scrollWidth ?? null,
  livePhotoBarInternalOverflowPx: p4?.mobilePhoto?.photoBar?.internalOverflowPx ?? null,
  livePhotoHintsWidthPx: p4?.mobilePhoto?.photoHints?.width ?? null,
  livePhotoHintsClippedLeftPx: p4?.mobilePhoto?.photoHints?.clippedLeftPx ?? null,
  liveControlsWidthPx: p4?.mobileControls?.ctlWidth ?? null,
  liveControlsPanelHorizontalOverflowPx: p4?.mobileControls?.panelHorizontalOverflowPx ?? null,
  liveTouchControlsCount: p4?.mobileHud?.touchControlsCount ?? null,
});

const checks = [check1, check2, check3, check4];
const calibrationValid = checks.every(c => c.calibrationOk);
const passCount = checks.filter(c => c.pass).length;
const meanScore = Number((checks.reduce((s, c) => s + c.score, 0) / checks.length).toFixed(4));

const report = {
  task: 'T-0301',
  measuredAt: new Date().toISOString(),
  liveCaptureFile: 'refs/audit/live-globe-layers-axis-inpage-mobile-audit/live-capture.json',
  recordingFile: 'refs/audit/live-globe-layers-axis-inpage-mobile-audit/recording.webm',
  recordingBytes: p1?.recordingBytes ?? 0,
  consoleErrors: (live.consoleErrors?.length ?? 0) + (live.extraConsoleErrors?.length ?? 0),
  pageErrors: (live.pageErrors?.length ?? 0) + (live.extraPageErrors?.length ?? 0),
  calibrationValid,
  passCount,
  totalChecks: checks.length,
  meanScore,
  checks,
};

fs.writeFileSync(path.join(AUDIT_DIR, 'numbers.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ calibrationValid, passCount, totalChecks: checks.length, meanScore, scores: checks.map(c => ({ id: c.id, score: c.score, pass: c.pass, km: c.knownMatchScore, kmm: c.knownMismatchScore })) }, null, 2));
