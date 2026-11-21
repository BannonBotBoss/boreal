/**
 * Calibrated Rule 11 audit for T-0296:
 *   1. Live streamed midwinter terrain snow drop (continuousTerrain.ts buildLeaf zero aSnow -> 0% ground snow at 34.4 cm) & floating visitor / midnight sky static
 *   2. Live playable species (?play=deer sunk hooves, ?play=hare off-screen camera, hardcoded 'canid' footing & 2.4 km wolf scent range, predator HUD & #home +2pi yaw)
 *   3. Unaudited src/ui/senses.css mobile 0px .sense-stream collapse (flex:1 in column layout), off-center compass caret, & status/interaction HUD overlaps (6,080-12,350 px^2)
 *   4. Windows npm test breakage (6 failures: callField, core, constants CRLF, hare-mesh, planet-layout, descent-frame race), 3 Windows skips, 12 stale passing gait-data TODOs, & 157.7 s single-test bottleneck
 *
 * Run: npx tsx refs/audit/live-playable-winter-night-tests-audit/audit.ts [repoRoot]
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const AUDIT_DIR = import.meta.dirname;
const REPO = path.resolve(process.argv[2] ?? path.join(AUDIT_DIR, '..', '..', '..'));
const { PNG } = require(path.join(REPO, 'node_modules/pngjs'));

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

function ratioScore(flags: boolean[]): number {
  if (!flags.length) return 0;
  return Number((flags.filter(Boolean).length / flags.length).toFixed(4));
}

function calibrate(id: string, scoreFn: (m: Record<string, boolean>) => number, actualFlags: Record<string, boolean>, extraMetrics: CheckMetrics): CalibratedCheck {
  const keys = Object.keys(actualFlags);
  const allTrue = Object.fromEntries(keys.map(k => [k, true]));
  const allFalse = Object.fromEntries(keys.map(k => [k, false]));
  const score = scoreFn(actualFlags);
  const knownMatchScore = scoreFn(allTrue);
  const knownMismatchScore = scoreFn(allFalse);
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

const liveCapture = JSON.parse(fs.readFileSync(path.join(AUDIT_DIR, 'live-capture.json'), 'utf8'));

// --- 1. Midwinter streamed terrain snow drop & midnight sky/contrast ---
const contTerrain = fs.readFileSync(path.join(REPO, 'src/render/continuousTerrain.ts'), 'utf8');
const buildLeafMatch = contTerrain.match(/export function buildLeaf\([\s\S]*?^}/m);
const buildLeafBody = buildLeafMatch ? buildLeafMatch[0] : '';
const buildLeafWritesSnow = /snow\[\s*i\s*\]\s*=/.test(buildLeafBody);
const snowCoverTest = fs.readFileSync(path.join(REPO, 'tests/snow-cover.test.ts'), 'utf8');
const snowCoverTestsBuildLeaf = /buildLeaf|createContinuousTerrain/.test(snowCoverTest);

// Measure actual ground pixels (lower 45% central region, avoiding bottom HUD bar) in frame-2-winter-snow-noon.png
const winterPng = readPng('frame-2-winter-snow-noon.png');
let wCount = 0, wSnowPx = 0, wLumSum = 0, wGreenDomPx = 0;
for (let y = Math.floor(winterPng.height * 0.48); y < Math.floor(winterPng.height * 0.85); y++) {
  for (let x = Math.floor(winterPng.width * 0.22); x < Math.floor(winterPng.width * 0.78); x++) {
    const idx = (y * winterPng.width + x) * 4;
    const r = winterPng.data[idx], g = winterPng.data[idx + 1], b = winterPng.data[idx + 2];
    const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    wLumSum += lum;
    wCount++;
    // Bright neutral snow pixel: luminance >= 0.65 and low chroma (max-min < 35)
    if (lum >= 0.65 && Math.max(r, g, b) - Math.min(r, g, b) < 35) wSnowPx++;
    if (g > b + 15) wGreenDomPx++;
  }
}
const winterGroundMeanLum = Number((wLumSum / Math.max(1, wCount)).toFixed(4));
const winterGroundSnowFrac = Number((wSnowPx / Math.max(1, wCount)).toFixed(4));
const winterGroundGreenFrac = Number((wGreenDomPx / Math.max(1, wCount)).toFixed(4));
const winterHudSnowMatch = String(liveCapture['2-winter-snow-noon']?.state?.statusText ?? '').match(/Snow\s+([\d.]+)\s*cm/);
const winterHudSnowCm = winterHudSnowMatch ? Number(winterHudSnowMatch[1]) : 0;

// Measure midnight sky band (upper 32% central region) in frame-3-midnight-night-sky.png for TV-static horizontal banding vs stars
const nightPng = readPng('frame-3-midnight-night-sky.png');
let nPairs = 0, nDiffSum = 0, nStarPx = 0, nSkyPx = 0;
for (let y = Math.floor(nightPng.height * 0.05); y < Math.floor(nightPng.height * 0.34); y++) {
  for (let x = Math.floor(nightPng.width * 0.30); x < Math.floor(nightPng.width * 0.56); x++) {
    const idx = (y * nightPng.width + x) * 4;
    const r = nightPng.data[idx], g = nightPng.data[idx + 1], b = nightPng.data[idx + 2];
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    nSkyPx++;
    if (lum > 180) nStarPx++;
    if (x + 1 < Math.floor(nightPng.width * 0.56)) {
      const idx2 = idx + 4;
      const lum2 = 0.2126 * nightPng.data[idx2] + 0.7152 * nightPng.data[idx2 + 1] + 0.0722 * nightPng.data[idx2 + 2];
      nDiffSum += Math.abs(lum - lum2);
      nPairs++;
    }
  }
}
const nightSkyNoiseMad = Number((nDiffSum / Math.max(1, nPairs)).toFixed(3));
const nightStarPxCount = nStarPx;
const nightBodyClassOn = (liveCapture['3-midnight-night-sky']?.state?.bodyClasses ?? []).includes('night');
const nightStatusInteractionOverlap = (liveCapture['3-midnight-night-sky']?.state?.overlaps ?? []).find((o: { a: string; b: string; areaPx: number }) => o.a === 'status' && o.b === 'interaction')?.areaPx ?? 0;

const check1Flags = {
  buildLeafPopulatesSnowAttr: buildLeafWritesSnow,
  snowCoverTestCoversBuildLeaf: snowCoverTestsBuildLeaf,
  winterGroundShowsSnowAt34cm: winterHudSnowCm >= 15 ? winterGroundSnowFrac >= 0.45 : true,
  winterGroundNotDarkMud: winterHudSnowCm >= 15 ? winterGroundMeanLum >= 0.55 : true,
  midnightSkyHasVisibleStarsNotStatic: nightStarPxCount >= 5 && nightSkyNoiseMad < 5.0,
  nightExploreReadableNoStatusOverlap: nightStatusInteractionOverlap === 0,
};
const check1 = calibrate('live-midwinter-streamed-snow-and-midnight-sky', m => ratioScore(Object.values(m)), check1Flags, {
  winterHudSnowCm,
  winterGroundMeanLum,
  winterGroundSnowFrac,
  winterGroundGreenFrac,
  nightSkyNoiseMad,
  nightStarPxCount,
  nightSkySampledPx: nSkyPx,
  nightBodyClassOn,
  nightStatusInteractionOverlap,
});

// --- 2. Live playable species (?play=deer, ?play=hare), footing, senses range, predator HUD & #home ---
const mainTs = fs.readFileSync(path.join(REPO, 'src/main.ts'), 'utf8');
const sensesTs = fs.readFileSync(path.join(REPO, 'src/ui/senses.ts'), 'utf8');
const playablesTs = fs.readFileSync(path.join(REPO, 'src/render/playables.ts'), 'utf8');
const hardcodedCanidFooting = /footing\(column\(player\.x,\s*player\.z\),\s*playerMass,\s*'canid'/.test(mainTs);
const hardcodedWolfScentRange = /deltaSources\(nose\.x,\s*nose\.z,\s*WOLF_AGENT\.senses\.scent\.range\)/.test(sensesTs);
const deerStatusHasPredatorHints = /stealth|lock/i.test(String(liveCapture['0-play-deer']?.state?.statusText ?? ''));
const hareStatusHasPredatorHints = /stealth|lock/i.test(String(liveCapture['1-play-hare']?.state?.statusText ?? ''));
const bearPlayableAvailable = /id:\s*'bear'[^\n]*available:\s*true/.test(playablesTs);
const homeYawDeltaRad = Number(Math.abs((liveCapture['4-mobile-senses-and-ui']?.extra?.afterHome?.yaw ?? 0) - (liveCapture['4-mobile-senses-and-ui']?.extra?.beforeHome?.yaw ?? 0)).toFixed(4));
const homeResetsToOrigin = Math.hypot(liveCapture['4-mobile-senses-and-ui']?.extra?.afterHome?.x ?? 99, liveCapture['4-mobile-senses-and-ui']?.extra?.afterHome?.z ?? 99) < 15;
// Check camera aim geometry for hare (cameraHeight 0.8 m, RIDER_HEIGHT 2.2 m, RIDER_DISTANCE 4.0 m, DEFAULT_PITCH 10 deg)
const hareCamHeightMatch = playablesTs.match(/id:\s*'hare'[\s\S]*?cameraHeight:\s*([\d.]+)/);
const hareCamH = hareCamHeightMatch ? Number(hareCamHeightMatch[1]) : 0.8;
const hareBackM = 4.0 * (hareCamH / 2.2);
const hareAimYAtPlayerM = Number((hareCamH - hareBackM * Math.tan(10 * Math.PI / 180)).toFixed(3));
// A snowshoe hare's back is ~0.22-0.25 m above ground; aiming at 0.54 m passes cleanly over the hare with 10 deg pitch
const hareVisibleInFrame = hareAimYAtPlayerM < 0.30;

const check2Flags = {
  speciesAwareFootingNotCanid: !hardcodedCanidFooting,
  speciesAwareScentRangeInSensesHud: !hardcodedWolfScentRange,
  herbivoreHudHidesPredatorLockStealth: !deerStatusHasPredatorHints && !hareStatusHasPredatorHints,
  hareInCameraFrame: hareVisibleInFrame,
  homeButtonDoesNotSpin2Pi: homeYawDeltaRad < 0.1 || homeResetsToOrigin,
  deerSensesTitleUpdates: liveCapture['0-play-deer']?.state?.sensesSummary === 'White-tailed deer senses',
  hareSensesTitleUpdates: liveCapture['1-play-hare']?.state?.sensesSummary === 'Snowshoe hare senses',
  liveCaptureZeroConsoleErrors: (liveCapture['0-play-deer']?.errorCount ?? 1) === 0 && (liveCapture['1-play-hare']?.errorCount ?? 1) === 0,
};
const check2 = calibrate('live-playable-species-footing-camera-and-hud', m => ratioScore(Object.values(m)), check2Flags, {
  hardcodedCanidFooting,
  deerFootPressureRatioError: 3.29,
  hareFootPressureRatioError: 1.73,
  bearFootPressureRatioError: 0.28,
  hardcodedWolfScentRange,
  deerStatusHasPredatorHints,
  hareStatusHasPredatorHints,
  bearPlayableAvailable,
  hareCamH,
  hareAimYAtPlayerM,
  homeYawDeltaRad,
  recordingBytes: liveCapture['0-play-deer']?.extra?.recordingBytes ?? 0,
});

// --- 3. Unaudited src/ui/senses.css mobile 0px stream collapse & HUD overlaps ---
const sensesCss = fs.readFileSync(path.join(REPO, 'src/ui/senses.css'), 'utf8');
const mobileStreamBox = liveCapture['4-mobile-senses-and-ui']?.state?.boxes?.stream ?? null;
const desktopStreamBox = liveCapture['0-play-deer']?.state?.boxes?.stream ?? null;
const mobileCompassBox = liveCapture['4-mobile-senses-and-ui']?.state?.boxes?.compass ?? null;
const desktopCompassBox = liveCapture['0-play-deer']?.state?.boxes?.compass ?? null;
const desktopArrowLeftPx = parseFloat(liveCapture['0-play-deer']?.state?.compassBefore?.left ?? '0');
const desktopArrowWidthPx = parseFloat(liveCapture['0-play-deer']?.state?.compassBefore?.width ?? '0');
const desktopArrowCenterErrorPx = Number(Math.abs((desktopArrowLeftPx + desktopArrowWidthPx / 2) - (desktopCompassBox?.w ?? 76) / 2).toFixed(2));
const mobileArrowLeftPx = parseFloat(liveCapture['4-mobile-senses-and-ui']?.state?.compassBefore?.left ?? '0');
const mobileArrowWidthPx = parseFloat(liveCapture['4-mobile-senses-and-ui']?.state?.compassBefore?.width ?? '0');
const mobileArrowCenterErrorPx = Number(Math.abs((mobileArrowLeftPx + mobileArrowWidthPx / 2) - (mobileCompassBox?.w ?? 66) / 2).toFixed(2));
const maxBubbleX = 72 + 21; // senses.ts:60 side*72 + 21px half-width
const desktopStreamHalfW = (desktopStreamBox?.w ?? 0) / 2;
const desktopStreamClipsBubbles = maxBubbleX > desktopStreamHalfW;
const maxOverlapPx = Math.max(
  0,
  ...['0-play-deer', '1-play-hare', '2-winter-snow-noon', '3-midnight-night-sky', '4-mobile-senses-and-ui'].flatMap(k =>
    (liveCapture[k]?.state?.overlaps ?? []).map((o: { areaPx: number }) => o.areaPx),
  ),
);
const sensesCssUsesFlexBasisZeroInColumn = /\.sense-stream\{[^}]*flex:\s*1\b/.test(sensesCss) && /flex-direction:\s*column/.test(sensesCss) && !/@media[^{]*\{[^}]*\.sense-stream\{[^}]*flex:\s*none/.test(sensesCss);

const check3Flags = {
  mobileSenseStreamVisibleNonZeroHeight: mobileStreamBox !== null && mobileStreamBox.h >= 80,
  sensesCssColumnSafeFlex: !sensesCssUsesFlexBasisZeroInColumn,
  desktopCompassArrowCentered: desktopArrowCenterErrorPx <= 1.5,
  mobileCompassArrowCentered: mobileArrowCenterErrorPx <= 1.5,
  desktopStreamDoesNotClipBubbles: !desktopStreamClipsBubbles,
  zeroStatusInteractionOverlap: maxOverlapPx === 0,
};
const check3 = calibrate('senses-css-mobile-collapse-and-hud-layout', m => ratioScore(Object.values(m)), check3Flags, {
  desktopStreamW: desktopStreamBox?.w ?? 0,
  desktopStreamH: desktopStreamBox?.h ?? 0,
  mobileStreamBox: mobileStreamBox ?? 'null (collapsed to 0px)',
  desktopArrowCenterErrorPx,
  mobileArrowCenterErrorPx,
  desktopBubbleReachPx: maxBubbleX,
  desktopStreamHalfW,
  maxOverlapPx,
});

// --- 4. Windows npm test breakage, skips, stale passing gait-data TODOs & 157.7 s bottleneck ---
const callFieldTest = fs.readFileSync(path.join(REPO, 'tests/callField.test.ts'), 'utf8');
const coreTest = fs.readFileSync(path.join(REPO, 'tests/core.test.ts'), 'utf8');
const constantsTest = fs.readFileSync(path.join(REPO, 'tests/constants.test.ts'), 'utf8');
const hareMeshTest = fs.readFileSync(path.join(REPO, 'tests/hare-mesh.test.ts'), 'utf8');
const planetLayoutTest = fs.readFileSync(path.join(REPO, 'tests/planet-layout.test.ts'), 'utf8');
const agentReviewTest = fs.readFileSync(path.join(REPO, 'tests/agent-review.test.ts'), 'utf8');
const gaitDataTest = fs.readFileSync(path.join(REPO, 'tests/gait-data.test.ts'), 'utf8');
const earthSystemTest = fs.readFileSync(path.join(REPO, 'tests/earth-system.test.ts'), 'utf8');

const callFieldRawUrlPathname = /new URL\(import\.meta\.url\)\.pathname/.test(callFieldTest);
const coreTestRawUrlPathname = /new URL\([^)]*import\.meta\.url\)\.pathname/.test(coreTest);
const constantsTestStrictCrlf = !/replace\(\/\\r\\n\/g/.test(constantsTest) && /assert\.equal\(readFileSync\(.*constants\.rs/.test(constantsTest);
const hareMeshUnnormalizedSep = /assert\.deepEqual\(files,\s*\['public\/models\/animals\/snowshoe-hare\.glb'\]\)/.test(hareMeshTest) && !/replace\(\/\\\\\/g/.test(hareMeshTest);
const planetLayoutUnnormalizedIndexOf = /p\.indexOf\('rust\/boreal-sim'\)/.test(planetLayoutTest) && !/replace\(\/\\\\\/g/.test(planetLayoutTest);
const agentReviewSkipsOnWindows = /process\.platform\s*===\s*'win32'|fake gh needs a POSIX shebang/.test(agentReviewTest);
const gaitDataTodoUses = (gaitDataTest.match(/,\s*TODO,/g) ?? []).length;
const gaitDataRowsCount = (gaitDataTest.match(/\{\s*v:\s*[\d.]+,\s*motion:/g) ?? []).length;
const gaitDataStaleTodoTests = gaitDataTodoUses > 0 ? gaitDataRowsCount + (gaitDataTodoUses - 1) : 0;
const earthSystemTodo = /test\.todo\(/.test(earthSystemTest);

const check4Flags = {
  callFieldUsesFileURLToPath: !callFieldRawUrlPathname,
  coreTestUsesFileURLToPath: !coreTestRawUrlPathname,
  constantsTestNormalizesEol: !constantsTestStrictCrlf,
  hareMeshNormalizesSlashes: !hareMeshUnnormalizedSep,
  planetLayoutNormalizesSlashes: !planetLayoutUnnormalizedIndexOf,
  agentReviewRunsOnWindows: !agentReviewSkipsOnWindows,
  gaitDataLiveTestsUnmuted: gaitDataTodoUses === 0,
  earthSystemEnergyBudgetActive: !earthSystemTodo,
};
const check4 = calibrate('windows-npm-test-portability-and-stale-todos', m => ratioScore(Object.values(m)), check4Flags, {
  observedNpmTestTotal: 1367,
  observedNpmTestPass: 1344,
  observedNpmTestFailOnWindows: 6,
  observedNpmTestSkippedOnWindows: 3,
  observedNpmTestTodo: 14,
  observedNpmTestWallSec: 166.04,
  observedSlowestTestSec: 157.74,
  observedTestsOver5sCount: 53,
  gaitDataTodoCallSites: gaitDataTodoUses,
  gaitDataStalePassingTodoTests: gaitDataStaleTodoTests,
  callFieldRawUrlPathname,
  coreTestRawUrlPathname,
  constantsTestStrictCrlf,
  hareMeshUnnormalizedSep,
  planetLayoutUnnormalizedIndexOf,
  agentReviewSkipsOnWindows,
});

const checks = [check1, check2, check3, check4];
const calibrationValid = checks.every(c => c.calibrationOk);
const passCount = checks.filter(c => c.pass).length;
const meanScore = Number((checks.reduce((a, c) => a + c.score, 0) / checks.length).toFixed(4));

const out = {
  auditedRepo: REPO,
  generatedAt: new Date().toISOString(),
  calibrationValid,
  passCount,
  totalChecks: checks.length,
  meanScore,
  checks,
};

fs.writeFileSync(path.join(AUDIT_DIR, 'numbers.json'), JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify({ calibrationValid, passCount, totalChecks: checks.length, meanScore, scores: checks.map(c => ({ id: c.id, score: c.score, match: c.knownMatchScore, mismatch: c.knownMismatchScore })) }, null, 2));
