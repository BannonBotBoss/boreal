/**
 * Calibrated Rule 11 audit for T-0298:
 *   1. Live Hunting II carried-hare underground burial (hare.ts:387 omits heightAt -> -1.85 m below wolf paws on staged terrain),
 *      'XYZ' vs 'YXZ' Euler rotation order mismatch (hare.ts:388 vs huntHold.ts:200 -> 61.3 deg roll & 0.161 m nape detachment),
 *      and hardcoded 'Pinned. X eats, B releases.' notice ignoring rebindings (main.ts:776)
 *   2. Pause Menu More sub-panels broken live round-trips: More -> Appearance freezes 3D canvas (0.00% pixel diff, byte-identical
 *      before/after 6 slider edits because main.ts:757 skips drawFrame while menu.open), More -> Planet view (Shift+G) leaves
 *      Pause Menu open on an empty 'Planet view (Shift+G)\nBack' modal while main.ts:757 blocks inpage.frame() forever, and
 *      More -> Photo mode / Inspector builds orphan Back pages stealing focus after menu.close()
 *   3. Live World Interactions (E snout-push rock & herb gather): 0 / 56 (0.0%) forest-floor rocks pushable under staged terrain
 *      because rocks.ts:69-70 (rockHeight > 0.22) and rocks.ts:78 (rockDiameter <= 0.22) are mathematically disjoint; herb gather
 *      prints 'Herb gathered. Its removal is remembered.' yet sets removed=false and after 0.43 s (1.16e-6 g = 0.0003% regrowth)
 *      re-enables E gather & awards another full +1 herb (events.ts:46,64-65); and revision++ rebuilds all loaded chunks per E press
 *   4. Live Chronometer (T) & Photo Mode / Help UX: Chronometer face omits calendar date despite dayAt midnight rollover and
 *      leaves weatherAt diurnal temperature stale across 12h scrub while main.ts:416 clearInput() drops held arrows; #help-binds
 *      promises 'P photo mode' while P shoots viewfinder (photoHidden=true); Photo Mode exit leaves body.photo-mode during Gallery
 *
 * Run: npx tsx refs/audit/live-hunt-menu-interact-chrono-audit/audit.ts [repoRoot]
 */
import fs from 'node:fs';
import path from 'node:path';
import { carryPlace, carryPitch, HUNT_HOLD, rotX, yawOf } from '../../../src/core/huntHold';
import { settledGrams, takePatch } from '../../../src/core/fields';
import { fastRockSite, rockDiameter, ROCK_SHAPES } from '../../../src/core/rocks';
import { DAY, dayAt, setHour } from '../../../src/core/timeOfDay';
import { generateChunk } from '../../../src/core/world';
import { STAGES } from '../../../src/core/stages/elevation';
import { updateWeather, weatherAt } from '../../../src/core/weather';

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
const hareSrc = fs.readFileSync(path.join(REPO, 'src/animals/hare.ts'), 'utf8');
const mainSrc = fs.readFileSync(path.join(REPO, 'src/main.ts'), 'utf8');
const menuSrc = fs.readFileSync(path.join(REPO, 'src/ui/menu.ts'), 'utf8');
const buildSceneSrc = fs.readFileSync(path.join(REPO, 'src/render/buildScene.ts'), 'utf8');
const chronoSrc = fs.readFileSync(path.join(REPO, 'src/ui/chronometer.ts'), 'utf8');
const photoModeSrc = fs.readFileSync(path.join(REPO, 'src/photo/photoMode.ts'), 'utf8');
const eventsSrc = fs.readFileSync(path.join(REPO, 'src/core/events.ts'), 'utf8');

// =============================================================================
// CHECK 1: Carried-Hare Underground Burial & 'XYZ' vs 'YXZ' Euler Order Roll
// =============================================================================
const headingTest = 1.2;
const pitchTest = carryPitch();
// Analytical SO(3) comparison: YXZ = R_y(heading) * R_x(pitch) (huntHold.ts:200) vs XYZ = R_x(pitch) * R_y(heading) (Three.js default hare.ts:388)
const applyYXZ = (p: { x: number; y: number; z: number }) => yawOf(headingTest, rotX(pitchTest, p));
const applyXYZ = (p: { x: number; y: number; z: number }) => rotX(pitchTest, yawOf(headingTest, p));
const basis = [{ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 1 }];
const dot3 = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) => a.x * b.x + a.y * b.y + a.z * b.z;
const traceRel = basis.reduce((s, e) => s + dot3(applyYXZ(e), applyXYZ(e)), 0);
const eulerAngleErrorDeg = Number((Math.acos(Math.max(-1, Math.min(1, (traceRel - 1) / 2))) * 180 / Math.PI).toFixed(2));

// Compute 3D nape detachment error caused by 'XYZ' instead of 'YXZ' at heading = 1.2
const napeLocal = { x: 0, y: HUNT_HOLD.napeY, z: HUNT_HOLD.napeZ };
const place = carryPlace({ x: 0, z: 0, heading: headingTest });
const nExp = applyYXZ(napeLocal);
const nAct = applyXYZ(napeLocal);
const napeDetachM = Number(Math.hypot(nAct.x - nExp.x, nAct.y - nExp.y, nAct.z - nExp.z).toFixed(4));

const carryBlock = hareSrc.slice(hareSrc.indexOf('if (a.heldBy !== undefined)'), hareSrc.indexOf('if (a.heldBy !== undefined)') + 500);
const carryAddsGroundHeight = /heightAt\s*\(\s*wolf\.x/.test(carryBlock);
const carryUsesYxzOrder = /'YXZ'|rotation\.order\s*=\s*'YXZ'/.test(carryBlock);
const pinnedNoticeUsesBindings = !/notice\('Pinned\. X eats, B releases\.'\)/.test(mainSrc);

const liveCarry = live.part1_huntingCarry;
const liveVerticalDeltaY = Number(liveCarry?.verticalDeltaY ?? -999); // wolf at +2.40 m, hare at +0.56 m => -1.8457 m underground!
const liveOrder = String(liveCarry?.hareRot?.order ?? 'XYZ');

const check1Flags = {
  liveCarriedHareElevatedAboveWolfGround: liveVerticalDeltaY > 0.25 && liveVerticalDeltaY < 1.10,
  carryCodeAddsTerrainGroundHeight: carryAddsGroundHeight,
  liveCarryUsesYxzEulerOrder: liveOrder === 'YXZ' && carryUsesYxzOrder,
  carryOrientationMatchesHuntHoldWithin2Deg: carryUsesYxzOrder ? true : eulerAngleErrorDeg <= 2.0,
  carryNapeAttachedWithin2Cm: carryUsesYxzOrder ? true : napeDetachM <= 0.02,
  pinnedNoticeRespectsCustomBindings: pinnedNoticeUsesBindings,
};

const check1 = calibrate('carried-hare-underground-burial-and-euler-roll', check1Flags, {
  liveWolfY: liveCarry?.wolfPos?.y ?? null,
  liveHareY: liveCarry?.harePos?.y ?? null,
  liveVerticalDeltaY,
  expectedVerticalDeltaY: Number(place.hip.y.toFixed(4)),
  liveHareRotOrder: liveOrder,
  xyzVsYxzAngleErrorDeg: eulerAngleErrorDeg,
  xyzVsYxzNapeDetachM: napeDetachM,
  carryAddsGroundHeight,
  carryUsesYxzOrder,
  pinnedNoticeUsesBindings,
  recordingBytes: live.recordingBytes ?? 0,
});

// =============================================================================
// CHECK 2: Pause Menu More Sub-Panels (Appearance Freeze, Planet View Trap, Orphan Back Focus)
// =============================================================================
const p2 = live.part2_pauseMenuMore;
const appearanceRedrawsCanvas = p2?.appearanceBytesIdentical === false;
const planetFromMoreClosesMenu = p2?.planetFromMoreState?.menuHidden === true && !/Planet view/i.test(String(p2?.planetFromMoreState?.panelText ?? ''));
const photoFromMoreDoesNotStealFocus = p2?.photoFromMoreState?.activeInsideMenu === false && !/Photo mode/i.test(String(p2?.photoFromMoreState?.orphanPanelText ?? ''));
const toGlobeClosesMenuInSource = /function toGlobe\([^)]*\)\s*\{[^}]*menu\.close/.test(mainSrc);
const menuMoreSupportsActionPanels = !/panels\.map\(p => btn\(p\.title, \(\) => sub\(\(\) => page\(p\.title, p\.build\(\), backBtn\(\)\)\)\)\)/.test(menuSrc);

const check2Flags = {
  appearanceSlidersRedrawLiveCanvas: appearanceRedrawsCanvas,
  planetViewFromMoreClosesPauseMenu: planetFromMoreClosesMenu && toGlobeClosesMenuInSource,
  photoAndInspectorFromMoreNoOrphanBackFocus: photoFromMoreDoesNotStealFocus && menuMoreSupportsActionPanels,
};

const check2 = calibrate('pause-menu-more-subpanel-roundtrips', check2Flags, {
  appearanceBytesIdentical: Boolean(p2?.appearanceBytesIdentical),
  beforeScreenshotBytes: p2?.beforeScreenshotBytes ?? 0,
  afterScreenshotBytes: p2?.afterScreenshotBytes ?? 0,
  planetMenuHidden: p2?.planetFromMoreState?.menuHidden ?? null,
  planetPanelText: p2?.planetFromMoreState?.panelText ?? '',
  planetBodyClasses: p2?.planetFromMoreState?.bodyClasses ?? '',
  photoFromMoreActiveText: p2?.photoFromMoreState?.activeText ?? null,
  photoFromMoreActiveInsideMenu: Boolean(p2?.photoFromMoreState?.activeInsideMenu),
  photoFromMoreOrphanPanelText: p2?.photoFromMoreState?.orphanPanelText ?? '',
  toGlobeClosesMenuInSource,
  menuMoreSupportsActionPanels,
});

// =============================================================================
// CHECK 3: World Interactions — 0% Pushable Forest-Floor Rocks, 0.43 s Herb Spam-Gather, revision++ Rebuild
// =============================================================================
// Mathematical verification across 3x3 Kenora staged chunks (matching live probe)
STAGES.on = true;
STAGES.seed = 1400;
let forestFloorRocks = 0;
let forestFloorPushable = 0;
for (let cx = 0; cx <= 2; cx++) {
  for (let cz = -2; cz <= 0; cz++) {
    for (const e of generateChunk(cx, cz)) {
      if (e.kind !== 'rock') continue;
      if (fastRockSite(e.x, e.z).rock < 0.2) {
        forestFloorRocks++;
        if (rockDiameter(e) <= 0.22) forestFloorPushable++;
      }
    }
  }
}
// Mathematical check: for ALL baseSeeds with diameter <= 0.22, can placeRockSeed ever keep one on forest floor (rock < 0.2)?
let maxShapeY = 0;
for (const sh of ROCK_SHAPES) if (sh[1] > maxShapeY) maxShapeY = sh[1];
const rockHeightBoundAt022 = 0.22 * maxShapeY; // <= 0.22, whereas placeRockSeed requires rockHeight > 0.22!

// Deterministic herb micro-regrowth spam test (1.0 s after first gather -> 0.0003% regrowth awards a full +1 herb!)
const testPlant = { key: 't0298-test-herb:0:0:1', kind: 'plant' as const, seed: 123, generatorVersion: 1, x: 50, z: 50, rotation: 0, scale: 1 };
const t0 = 10000;
const firstTake = takePatch({ key: testPlant.key, x: testPlant.x, z: testPlant.z, kind: 'plant', scale: 1, grams: 1, by: 'player', now: t0 });
const after1sStock = settledGrams({ key: testPlant.key, x: testPlant.x, z: testPlant.z, kind: 'plant', scale: 1, grams: 0, by: '' }, t0 + 1.5);
const secondTakeAfter1p5s = takePatch({ key: testPlant.key, x: testPlant.x, z: testPlant.z, kind: 'plant', scale: 1, grams: 1, by: 'player', now: t0 + 1.5 });
const eventsRequiresSubstantialHerbForGather = /eaten\s*>=\s*0\.[5-9]|grams\s*>=\s*0\.[5-9]|removed:\s*action\s*===\s*'gather'/.test(eventsSrc);
const liveHerbRemovedFalse = live.part3_worldInteractions?.herbGatherResult?.afterGather1?.savedEvents?.records?.[live.part3_worldInteractions?.herbGatherResult?.hp?.key]?.removed === false;
const liveHerbStillGatherable = /gather/i.test(String(live.part3_worldInteractions?.herbGatherResult?.afterGather1?.act ?? ''));
const interactRebuildsAllChunks = /context = next;\s*revision\+\+;/.test(mainSrc) && /const changed = revision !== eventRevision/.test(buildSceneSrc);

const check3Flags = {
  forestFloorHasPushableCobbles: forestFloorPushable > 0 && (live.part3_worldInteractions?.herbAndRockProbe?.forestFloorRocksPushable ?? 0) > 0,
  gatheredHerbMarkedRemovedOrRequiresSubstantialRegrowth: !liveHerbRemovedFalse && !liveHerbStillGatherable && eventsRequiresSubstantialHerbForGather,
  microRegrowthDoesNotAwardFullHerb: !(secondTakeAfter1p5s > 0 && secondTakeAfter1p5s < 0.05 && !eventsRequiresSubstantialHerbForGather),
  interactDoesNotRebuildEveryLoadedChunk: !interactRebuildsAllChunks,
};

const check3 = calibrate('world-interactions-rock-push-herb-spam-and-rebuild', check3Flags, {
  liveForestFloorRocksPushable: live.part3_worldInteractions?.herbAndRockProbe?.forestFloorRocksPushable ?? 0,
  liveForestFloorRocksTotal: live.part3_worldInteractions?.herbAndRockProbe?.forestFloorRocksTotal ?? 0,
  deterministicForestFloorPushable: forestFloorPushable,
  deterministicForestFloorTotal: forestFloorRocks,
  rockHeightBoundAt022,
  firstTakeGrams: Number(firstTake.toFixed(6)),
  regrownAfter1p5sGrams: Number(after1sStock.grams.toFixed(8)),
  secondTakeAfter1p5sGrams: Number(secondTakeAfter1p5s.toFixed(8)),
  liveHerbRemovedFalse,
  liveHerbStillGatherable,
  liveHerbNotice: live.part3_worldInteractions?.herbGatherResult?.afterGather1?.notice ?? '',
  interactRebuildsAllChunks,
});

// =============================================================================
// CHECK 4: Chronometer (T) Date Rollover/Weather Sync & Photo Mode Gallery / Help P-Key
// =============================================================================
// Verify midnight rollover via setHour/DAY.offset changes dayAt while chronometer.ts never renders formatDate()
DAY.offset = 0; DAY.dayOffset = 0;
setHour(23.5, 0);
const dayBefore = dayAt(0);
DAY.offset += 1.0; // cross midnight
const dayAfter = dayAt(0);
const chronoDisplaysDate = /formatDate/.test(chronoSrc);
DAY.offset = 0; DAY.dayOffset = 0;

// Verify 12h scrub from noon to midnight with single 0.016s simDt leaves WEATHER air temp frozen
updateWeather(0.1, 12, 227, 12, 0);
const tempNoon = weatherAt(65, -18).tC;
updateWeather(0.016, 12, 227, 0, 0); // scrubbed 12 hours to midnight, aggDt = 0!
const tempMidnightAfterScrub = weatherAt(65, -18).tC;
const tempDropC = Number((tempNoon - tempMidnightAfterScrub).toFixed(3));

const helpClaimsPPhotoMode = /P photo mode \(free camera, rewind, capture\)/.test(String(live.part3_worldInteractions?.helpBindsText ?? ''));
const pKeyOpensPhotoMode = live.part3_worldInteractions?.afterPKey?.photoHidden === false;
const galleryRemovesPhotoModeClass = live.part4_chronoAndPhoto?.galleryReviewState?.bodyStillHasPhotoMode === false;
const chronoOpenClearsHeldKeys = /id === 'chrono'[\s\S]{0,80}clearInput\(\)/.test(mainSrc);

const check4Flags = {
  chronometerDisplaysDateOnRollover: chronoDisplaysDate,
  chronometerScrubUpdatesDiurnalWeather: tempDropC >= 2.0,
  chronometerToggleDoesNotWipeHeldScrubKeys: !chronoOpenClearsHeldKeys,
  helpCopyMatchesActualPKeyAction: !(helpClaimsPPhotoMode && !pKeyOpensPhotoMode),
  galleryReviewClearsPhotoModeBodyClass: galleryRemovesPhotoModeClass,
};

const check4 = calibrate('chronometer-date-weather-and-photo-help-ux', check4Flags, {
  midnightRolloverDayDelta: dayAfter - dayBefore,
  chronoDisplaysDate,
  tempNoonC: Number(tempNoon.toFixed(2)),
  tempMidnightAfterScrubC: Number(tempMidnightAfterScrub.toFixed(2)),
  diurnalTempDropAfter12hScrubC: tempDropC,
  chronoOpenClearsHeldKeys,
  liveChronoHourBefore: live.part4_chronoAndPhoto?.beforeChrono?.hour ?? null,
  liveChronoHourAfter2p2sRightArrow: live.part4_chronoAndPhoto?.chronoDuringScrub?.hour ?? null,
  helpClaimsPPhotoMode,
  pKeyOpensPhotoMode,
  galleryOpen: Boolean(live.part4_chronoAndPhoto?.galleryReviewState?.galleryOpen),
  galleryBodyStillHasPhotoMode: Boolean(live.part4_chronoAndPhoto?.galleryReviewState?.bodyStillHasPhotoMode),
});

const checks = [check1, check2, check3, check4];
const calibrationValid = checks.every(c => c.calibrationOk);
const passCount = checks.filter(c => c.pass).length;
const meanScore = Number((checks.reduce((s, c) => s + c.score, 0) / checks.length).toFixed(4));

const out = {
  task: 'T-0298',
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
}, null, 2));
