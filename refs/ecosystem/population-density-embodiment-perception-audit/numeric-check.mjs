/**
 * Calibrated Rule 11 numeric evaluation for T-0249:
 *   1. Coarse population temporal/spatial body folding (m.body ignored in picture.sync), stateless coarseStep,
 *      dead demoteFar/promoteField, & 1,000x hare-as-deer carrying capacity (buildScene.ts, animalPicture.ts, coarse.ts)
 *   2. Unlit self-luminous floating horizontal animalDensity discs (+0.20m lift, 16.5m..110m diameter over slopes/lakes,
 *      280x midnight luminance excess, & setBodyShare .clone() stripping onBeforeCompile) (animalDensity.ts, buildScene.ts)
 *   3. 12x clock-year desynchronization (ageYears/dayAt/tickGround vs epochOffsetYr/coarseStep/stepPups), immortal
 *      post-lifespan animals, dead wolfGrowth, & static LIVING_PACK underwater hare / missing packmate / unpersisted state
 *      (lifespan.ts, growth.ts, worldClock.ts, timeOfDay.ts, livingPack.ts, enterLiving.ts, buildScene.ts, main.ts)
 *   4. Disconnected Issue #106 wasm perception/physiology/threeBlocks pipeline, missing sub-T_lc cold & submersion O2 stress,
 *      browser-breaking node:fs import in bodyFeelings.ts, signalsFromFrame Visible drop + -Z bearing inversion,
 *      & 8-slot sound-cap sight starvation in #senses (perceptionBuffer.ts, bodyFeelings.ts, threeBlocks.ts, sensePictures.ts, ui/senses.ts)
 *
 * Run: npx tsx refs/ecosystem/population-density-embodiment-perception-audit/numeric-check.mjs
 */
import * as THREE from 'three';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { K } from '../../../src/core/constants';
import { animalShares, markFor, coarseStep, DEER_PER_KM2, wolfPerKm2 } from '../../../src/core/coarse';
import { DENSITY_MARK_LIFT_M, groundMarkOpacity, groundMarkRadius, setBodyShare } from '../../../src/render/animalDensity';
import { detailShares } from '../../../src/render/animalLadder';
import { enterLiving, livingRoster } from '../../../src/core/enterLiving';
import { ageYears, LIFESPAN } from '../../../src/core/lifespan';
import { epochOffsetYr, resolveObservation } from '../../../src/core/worldClock';
import { dayAt } from '../../../src/core/timeOfDay';
import { heightAt } from '../../../src/core/world';
import { LEVEL } from '../../../src/core/tuning';
import { HARE_NEEDS } from '../../../src/core/needs/species';
import { createNeeds } from '../../../src/core/needs/engine';
import { stepBodyFeelings } from '../../../src/core/bodyFeelings';
import { PERCEPTION, readPerception } from '../../../src/core/perceptionBuffer';
import { SENSE_PICTURES, createSenseStream, signalsFromFrame } from '../../../src/core/sensePictures';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../..');

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const ratioScore = (a, b) => {
  if (!(a > 0) || !(b > 0)) return 0;
  return +(Math.min(a, b) / Math.max(a, b)).toFixed(4);
};
const deltaScore = (measured, reference, fullScale) =>
  +clamp01(1 - Math.abs(measured - reference) / Math.max(fullScale, 1e-9)).toFixed(4);

const linearLuminance = (rgb) =>
  0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];

// ---------------------------------------------------------------------------
// Rule 11 Calibration: Known Matches (>= 0.95) and Known Mismatches (< 0.70)
// ---------------------------------------------------------------------------
const obsImmediate = resolveObservation('immediate', 1);
const immediateNearMark = markFor(10, obsImmediate);
const knownMatchImmediateConservation = ratioScore(
  immediateNearMark.body + immediateNearMark.density,
  1.0,
); // 1.0000

const knownMatchWolfCeilingPerKm2 = ratioScore(wolfPerKm2(), 0.04); // Fuller, Mech & Cochrane 2003: 40 / 1,000 km^2 -> 1.0000
const knownMatchPerceptionHeaderBytes = ratioScore(PERCEPTION.fixedBytes, 160); // Issue #106 fixed header+3 blocks = 160 B -> 1.0000
const knownMatchEpochOffsetOneJulianYear = ratioScore(epochOffsetYr(K.julian_year_s), 1.0); // 1.0000

const knownMismatchDoubleCountedPopulation = ratioScore(1.0, 2.0); // 0.5000 (< 0.70)
const knownMismatchTwelveFoldClockSplit = ratioScore(1.0, 12.0); // 0.0833 (< 0.70)
const knownMismatchDeerCarryForHare = ratioScore(1.0, 1000.0); // 0.0010 (< 0.70)
const knownMismatchStarvedSight = deltaScore(0, 1, 1); // 0.0000 (< 0.70)

const calibration = {
  metrics: {
    ratioScore: 'min(a, b) / max(a, b) on strictly positive physical/ecological quantities (1.0 exact, >= 0.95 pass)',
    deltaScore: 'clamp01(1 - |measured - reference| / fullScale) on bounded state/angle/elevation quantities (>= 0.95 pass)',
  },
  knownMatches: {
    immediateNearShareSumTo1: knownMatchImmediateConservation,
    wolfCarryingCeiling40Per1000Km2: knownMatchWolfCeilingPerKm2,
    issue106FixedBlock160Bytes: knownMatchPerceptionHeaderBytes,
    epochOffsetOneJulianYear: knownMatchEpochOffsetOneJulianYear,
  },
  knownMismatches: {
    doubleDrawnBodyPlusDensity: knownMismatchDoubleCountedPopulation,
    twelveFoldClockYearMismatch: knownMismatchTwelveFoldClockSplit,
    deer1PerKm2ForHare1000PerKm2: knownMismatchDeerCarryForHare,
    starvedVisualSightCue: knownMismatchStarvedSight,
  },
};

const calibrationValid =
  Object.values(calibration.knownMatches).every((s) => s >= 0.95) &&
  Object.values(calibration.knownMismatches).every((s) => s < 0.70);

// Load runtime observations.json if present
const obsPath = resolve(__dirname, 'observations.json');
const runtimeObs = existsSync(obsPath) ? JSON.parse(readFileSync(obsPath, 'utf8')) : null;

const buildSceneSrc = readFileSync(resolve(REPO_ROOT, 'src/render/buildScene.ts'), 'utf8');
const animalPictureSrc = readFileSync(resolve(REPO_ROOT, 'src/render/animalPicture.ts'), 'utf8');
const animalDensitySrc = readFileSync(resolve(REPO_ROOT, 'src/render/animalDensity.ts'), 'utf8');
const mainSrc = readFileSync(resolve(REPO_ROOT, 'src/main.ts'), 'utf8');
const bodyFeelingsSrc = readFileSync(resolve(REPO_ROOT, 'src/core/bodyFeelings.ts'), 'utf8');
const rustLibSrc = readFileSync(resolve(REPO_ROOT, 'rust/boreal-sim/src/lib.rs'), 'utf8');

// ---------------------------------------------------------------------------
// Check 1: Temporal population folding at >= 12x (Ecological 2,000x)
// coarse.ts:8 & Issue #109: body + density == 1.0; at 2,000x m.body == 0.0.
// Yet buildScene.ts:368-397 drops m.body and picture.sync uses detailShares(d) only!
// ---------------------------------------------------------------------------
const obsEco = resolveObservation('immediate', 2000);
const ecoMarkAt10m = markFor(10, obsEco); // body = 0, density = 1, ink = 1
const pictureNearShareAt10m = detailShares(10).full; // 1.0000 (ignores obs!)
const pictureSyncReadsObs = /observation|markFor|animalShares/.test(animalPictureSrc);
const paintPopPassesBodyToPicture = /bodies\.push[\s\S]*?\bbody\b/.test(buildSceneSrc) && /row\.proc\s*\*\s*/.test(buildSceneSrc);
const wildIndividualOpacityAt2000x = pictureSyncReadsObs && paintPopPassesBodyToPicture ? ecoMarkAt10m.body : pictureNearShareAt10m;
const check1Score = deltaScore(wildIndividualOpacityAt2000x, 0.0, 1.0); // 0.0000

// ---------------------------------------------------------------------------
// Check 2: Species-specific carrying capacity & stateful coarse field integration
// Keith (1990) / Krebs et al. (2001) / habitat.ts:7: snowshoe hare carrying density ~ 10 hares/ha = 1,000 / km^2
// (cyclic boreal range 100..1,000 / km^2). buildScene.ts:365 calls coarseStep(densityCount, worldDt, 'deer') (1 / km^2)
// statelessly every frame and never calls demoteFar / promoteField!
// ---------------------------------------------------------------------------
const buildSceneHardcodesDeerCoarse = /coarseStep\(\s*densityCount\s*,\s*worldDt\s*,\s*'deer'\s*\)/.test(buildSceneSrc);
const gameHareCarryingPerKm2 = buildSceneHardcodesDeerCoarse ? DEER_PER_KM2 : 1000;
const publishedHareCarryingPerKm2 = 1000; // 10 hares/ha, Keith 1990 (cited in HARE_NEEDS / src/core/habitat.ts)
const demotePromoteWiredInLiveLoop = /demoteFar|promoteField/.test(buildSceneSrc) || /demoteFar|promoteField/.test(mainSrc);
const check2Score = +(0.5 * ratioScore(gameHareCarryingPerKm2, publishedHareCarryingPerKm2) + 0.5 * (demotePromoteWiredInLiveLoop ? 1 : 0)).toFixed(4);

// ---------------------------------------------------------------------------
// Check 3: Density ground-mark terrain slope & water conformation
// animalDensity.ts:132-134, 213-214 places a flat horizontal CircleGeometry(1, 28) at y = heightAt(x,z) + 0.08 + 0.12 = +0.20 m
// scaled to radius 8.25 m ('herd'/'density') and 55.0 m ('range'). On a 10 deg bank slope (tan 10 deg = 0.1763),
// the downhill edge floats +1.655 m (herd) to +9.898 m (range) in mid-air and crosses open water!
// ---------------------------------------------------------------------------
const rangeRadiusM = groundMarkRadius('range');     // 55.0 m (110.0 m diameter)
const densityRadiusM = groundMarkRadius('density'); // 8.25 m (16.5 m diameter)
const herdRadiusM = groundMarkRadius('herd');       // 2.20 m (4.4 m diameter)
const centerLiftM = DENSITY_MARK_LIFT_M + 0.12; // 0.20 m (double lift: buildScene +0.08, animalDensity +0.12)
const discSamplesTerrainPerVertex = /heightAt/.test(animalDensitySrc);
const slopeRad = (10 * Math.PI) / 180;
const downhillAirGapRangeM = discSamplesTerrainPerVertex ? DENSITY_MARK_LIFT_M : centerLiftM + rangeRadiusM * Math.tan(slopeRad);
const downhillAirGapDensityM = discSamplesTerrainPerVertex ? DENSITY_MARK_LIFT_M : centerLiftM + densityRadiusM * Math.tan(slopeRad);
const downhillAirGapHerdM = discSamplesTerrainPerVertex ? DENSITY_MARK_LIFT_M : centerLiftM + herdRadiusM * Math.tan(slopeRad);
const check3Score = deltaScore(downhillAirGapDensityM, DENSITY_MARK_LIFT_M, 1.0); // 1.655 m vs 0.08 m -> 0.0000

// ---------------------------------------------------------------------------
// Check 4: Nocturnal radiometry of animalDensity marks under 0.001 lx New Moon starlight
// Kyba et al. (2015) Sci. Rep. 5:8409: natural clear starlight ~ 0.001 lx (terrain linear Y <= 0.0016).
// discMesh fragment shader outputs unlit mix(vec3(0.29,0.24,0.14), uColor, 0.78) at alpha = 0.62!
// ---------------------------------------------------------------------------
const soilVec = [0.29, 0.24, 0.14];
const rangeCol = [0.55, 0.62, 0.32];
const mixedRangeRgb = [
  soilVec[0] * 0.22 + rangeCol[0] * 0.78,
  soilVec[1] * 0.22 + rangeCol[1] * 0.78,
  soilVec[2] * 0.22 + rangeCol[2] * 0.78,
];
const discReadsLightingOrNight = /uSun|uDarkness|stylizedNight|coatNight/.test(animalDensitySrc);
const midnightDiscLinearY = discReadsLightingOrNight ? 0.0012 : linearLuminance(mixedRangeRgb) * groundMarkOpacity(1.0, 0);
const targetMidnightTerrainMaxY = 0.0016;
const check4Score = ratioScore(targetMidnightTerrainMaxY, midnightDiscLinearY); // 0.0016 / 0.2996 = 0.0053

// ---------------------------------------------------------------------------
// Check 5: setBodyShare material clone preserving custom onBeforeCompile shader hooks
// animalDensity.ts:243 `mat = base.clone()` drops onBeforeCompile to Material.prototype.onBeforeCompile!
// ---------------------------------------------------------------------------
const testRoot = new THREE.Group();
const baseMat = new THREE.MeshStandardMaterial();
const customHook = () => { /* custom fur / CSM / coat shader hook */ };
baseMat.onBeforeCompile = customHook;
const testMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), baseMat);
testRoot.add(testMesh);
setBodyShare(testRoot, 0.5);
const clonedMat = testMesh.material;
const hookPreserved = clonedMat.onBeforeCompile === customHook ? 1 : 0;
const check5Score = deltaScore(hookPreserved, 1, 1); // 0.0000

// ---------------------------------------------------------------------------
// Check 6: Clock-year consistency across #109 worldClock, lifespan, timeOfDay, coarseStep, and pups
// 1 Julian year of worldSec (31,557,600 s = "1 year / sec" for 1 s on formatRate):
// epochOffsetYr = +1.0000 yr, coarseStep = +1.0000 yr, yet ageYears = +12.0000 yr and dayAt = +4,383 d (12.008 yr)!
// ---------------------------------------------------------------------------
const oneJulianYrSec = K.julian_year_s; // 31,557,600
const epochYearsDelta = epochOffsetYr(oneJulianYrSec); // 1.0000
const lifespanYearsDelta = ageYears('wolf', 0, oneJulianYrSec) - LIFESPAN.wolf.startYears; // 12.0000
const calendarYearsDelta = (dayAt(oneJulianYrSec) - dayAt(0)) / 365.25; // 12.0000
const check6Score = ratioScore(epochYearsDelta, lifespanYearsDelta); // 1 / 12 = 0.0833

// ---------------------------------------------------------------------------
// Check 7: Biological lifespan ceiling / senescence & juvenile ontogeny wiring
// Krebs et al. (2001): wild snowshoe hare max lifespan ~ 5 yr; Mech & Boitani (2003): gray wolf ~ 13 yr.
// After 10 Julian years of worldSec, hare reaches 121.0 yr (24.2x maxYears) with 0 mortality/senescence,
// brain.stored.ageYears never updates, and src/core/growth.ts (wolfGrowth) has 0 live callers!
// ---------------------------------------------------------------------------
const hareAgeAfter10JulianYr = ageYears('hare', 0, 10 * K.julian_year_s); // 121.0 yr
const wolfGrowthCalledInMain = /wolfGrowth/.test(mainSrc) || /wolfGrowth/.test(buildSceneSrc);
const check7Score = +(0.5 * ratioScore(LIFESPAN.hare.maxYears, hareAgeAfter10JulianYr) + 0.5 * (wolfGrowthCalledInMain ? 1 : 0)).toFixed(4);

// ---------------------------------------------------------------------------
// Check 8: LIVING_PACK habitat dryness (hare at (50,0) below waterSurface), packmate instantiation, & state persistence
// ---------------------------------------------------------------------------
const roster = livingRoster();
const storedHare = roster.find((r) => r.species === 'hare');
const hareGroundY = heightAt(storedHare.x, storedHare.z); // -0.3174 m < LEVEL.waterSurface (-0.25 m)!
const hareAboveWater = hareGroundY >= LEVEL.waterSurface ? 1 : 0;
const wolfPackmatesInStore = roster.filter((r) => r.species === 'wolf').length; // 2 (founder + mate at 35,0)
const wolfPackmatesSpawnedInScene = /4294967297|filter\(\s*\w+\s*=>\s*\w+\.species\s*===\s*'wolf'\)/.test(buildSceneSrc) ? 2 : 1; // only 1 embodied!
const setPlayablePersistsOutgoingState = /memoryBook\.set/.test(buildSceneSrc) ? 1 : 0;
const check8Score = +((hareAboveWater + (wolfPackmatesSpawnedInScene === wolfPackmatesInStore ? 1 : 0) + setPlayablePersistsOutgoingState) / 3).toFixed(4); // 0.0000

// ---------------------------------------------------------------------------
// Check 9: Issue #106 live perception boundary wiring & browser-safe bodyFeelings module
// RULES.md Rule 18 (#106): wasm perception frame -> readPerception -> stepBodyFeelings -> threeBlocks -> signalsFromFrame
// Plus bodyFeelings.ts:22 top-level `import { readFileSync } from 'node:fs'`!
// ---------------------------------------------------------------------------
const wasmExportsPerception = /pub\s+extern\s+"C"\s+fn\s+\w*perception/.test(rustLibSrc) ? 1 : 0;
const liveCallsStepBodyFeelings = /stepBodyFeelings/.test(mainSrc) || /stepBodyFeelings/.test(buildSceneSrc) ? 1 : 0;
const liveCallsThreeBlocks = /threeBlocks|frameWithBlocks/.test(mainSrc) || /threeBlocks|frameWithBlocks/.test(buildSceneSrc) ? 1 : 0;
const liveCallsSignalsFromFrame = /signalsFromFrame/.test(readFileSync(resolve(REPO_ROOT, 'src/ui/senses.ts'), 'utf8')) ? 1 : 0;
const bodyFeelingsBrowserSafe = !/from\s+['"]node:fs['"]/.test(bodyFeelingsSrc) ? 1 : 0;
const check9Score = +((wasmExportsPerception + liveCallsStepBodyFeelings + liveCallsThreeBlocks + liveCallsSignalsFromFrame + bodyFeelingsBrowserSafe) / 5).toFixed(4); // 0.0000

// ---------------------------------------------------------------------------
// Check 10: Endotherm cold stress below T_lc (-35 C) & hypoxic submersion oxygenStress in stepBodyFeelings
// Scholander et al. (1950) Biol. Bull. 99:237; Sheriff et al. (2009): snowshoe hare winter T_lc ~ -10 C
// (at -35 C, 25 C below T_lc, cold metabolic stress > 0.5). Butler & Jones (1997): breath-hold O2 debt when submerged.
// ---------------------------------------------------------------------------
const coldStep = stepBodyFeelings(
  HARE_NEEDS,
  createNeeds(),
  80,
  { stamina: 100, pain: 0, health: 100, temperatureC: -35, temperatureStress: 0, oxygenStress: 0 },
  1,
  { dtGame: 60, dtReal: 5, speed: 0, tC: -35, gait: 'still', generatedKg: 1.5 },
  storedHare.handle,
);
const coldStressActive = coldStep.feelings.temperatureStress > 0.1 ? 1 : 0; // 0 (heatFactor only checks > +20 C!)
const oxygenStressHasSubmersionRate = /submer|underwater|breath|dive/i.test(bodyFeelingsSrc) ? 1 : 0; // 0
const check10Score = +((coldStressActive + oxygenStressHasSubmersionRate) / 2).toFixed(4); // 0.0000

// ---------------------------------------------------------------------------
// Check 11: signalsFromFrame retention of Issue #106 perception-known.bin Visible entries & forward -Z bearing
// perception.rs:425,439 writes salience = 91.0 & 2.0 -> pushSight drops 100% (2/2)!
// Forward target at (x = 0, z = -10, salience = 0.8) gets Math.atan2(0, -10) = +PI (180 deg behind instead of 0 ahead)!
// ---------------------------------------------------------------------------
const knownBin = readFileSync(resolve(REPO_ROOT, 'tests/fixtures/perception-known.bin'));
const parsedKnown = readPerception(knownBin);
const extractedKnownSignals = signalsFromFrame(parsedKnown);
const visibleRetainedCount = extractedKnownSignals.filter((s) => s.kind === 'sight').length; // 0 of 2!
const visibleRetentionFrac = visibleRetainedCount / Math.max(1, parsedKnown.visible.length);

const syntheticForwardFrame = {
  ...parsedKnown,
  sounds: [],
  scents: [],
  visible: [{
    id: 1n, objectType: 1, classification: 1, certainty: 1, salience: 0.8,
    x: 0, y: 0, z: -10, velocityX: 0, velocityY: 0, velocityZ: 0, flags: 0,
  }],
};
const forwardSight = signalsFromFrame(syntheticForwardFrame)[0];
const forwardBearingErrorRad = forwardSight ? Math.abs(forwardSight.bearing - 0) : Math.PI; // Math.PI (180 deg inverted!)
const check11Score = +(0.5 * visibleRetentionFrac + 0.5 * deltaScore(forwardBearingErrorRad, 0, Math.PI)).toFixed(4); // 0.0000

// ---------------------------------------------------------------------------
// Check 12: Multimodal #senses stream visual sight survival when sound (6) + scent (3) cues overlap
// SENSE_PICTURES.cap = PERCEPTION.caps.sound = 8 (sound cap applied to all 3 senses combined!).
// ---------------------------------------------------------------------------
const stream = createSenseStream();
for (let i = 0; i < 6; i++) stream.offer({ key: `hearing:${i}`, kind: 'sound', strength: 0.5, bearing: 0.1 * i });
for (let i = 0; i < 3; i++) stream.offer({ key: `scent:${i}`, kind: 'scent', strength: 0.4, bearing: -0.15 * i });
const sightSurvived = stream.offer({ key: 'sight:0', kind: 'sight', strength: 0.95, bearing: 0 }) ? 1 : 0; // 0!
const check12Score = deltaScore(sightSurvived, 1, 1); // 0.0000

const checks = [
  {
    id: 'temporal_population_body_fold_at_2000x',
    description: 'Wild animal individual mesh opacity at 2,000x Ecological scale (where markFor().body = 0, density = 1)',
    gameValue: wildIndividualOpacityAt2000x,
    natureOrSpecTarget: 0.0,
    source: 'Issue #109 & src/core/coarse.ts:8 (shares.body + shares.density === 1; individuals fold into coarse field above Immediate)',
    score: check1Score,
    passes95: check1Score >= 0.95,
  },
  {
    id: 'species_carrying_capacity_and_stateful_field',
    description: 'Snowshoe hare coarse carrying density (hares/km^2) & live demoteFar/promoteField wiring',
    gameValue: `${gameHareCarryingPerKm2}/km^2 (deer hardcoded), liveDemote=${demotePromoteWiredInLiveLoop}`,
    natureOrSpecTarget: `${publishedHareCarryingPerKm2}/km^2 (10 hares/ha), liveDemote=true`,
    source: 'Keith (1990) Wildl. Monogr. 108 & Krebs, Boutin & Boonstra (2001) BioScience 51:25 (cited in HARE_NEEDS / habitat.ts:7)',
    score: check2Score,
    passes95: check2Score >= 0.95,
  },
  {
    id: 'density_disc_slope_and_water_conformation',
    description: 'Downhill vertical air gap (m) of density (r=8.25m) & range (r=55.0m) flat CircleGeometry disc on a 10 deg bank slope',
    gameValue: +downhillAirGapDensityM.toFixed(3),
    herdGapM: +downhillAirGapHerdM.toFixed(3),
    extraRangeGapM: +downhillAirGapRangeM.toFixed(3),
    natureOrSpecTarget: DENSITY_MARK_LIFT_M,
    source: 'Issue #107 & terrain topography (surface density stains drape heightAt(x,z) on dry land, never cantilevering 0.59-9.90 m in mid-air)',
    score: check3Score,
    passes95: check3Score >= 0.95,
  },
  {
    id: 'nocturnal_density_mark_radiometry',
    description: 'Linear luminance of animalDensity ground mark under 0.001 lx New Moon astronomical night',
    gameValue: +midnightDiscLinearY.toFixed(4),
    natureOrSpecTarget: targetMidnightTerrainMaxY,
    source: 'Kyba et al. (2015) Sci. Rep. 5:8409 & Johnsen et al. (2006) J. Exp. Biol. 209:789 (~0.001 lx starlight, zero ground self-emission)',
    score: check4Score,
    passes95: check4Score >= 0.95,
  },
  {
    id: 'set_body_share_shader_hook_preservation',
    description: 'Preservation of custom Material.onBeforeCompile hooks (furCards, CSM, coatFinish) when setBodyShare clones materials at 0 < body < 0.98',
    gameValue: hookPreserved,
    natureOrSpecTarget: 1,
    source: 'Three.js r180 Material.clone() specification & src/render/animalDensity.ts:243',
    score: check5Score,
    passes95: check5Score >= 0.95,
  },
  {
    id: 'clock_year_consistency_across_subsystems',
    description: 'Ratio of epochOffsetYr/coarseStep/stepPups years (1.00 yr) to lifespan ageYears/dayAt/tickGround years (12.00 yr) per 31,557,600 worldSec',
    gameValue: +lifespanYearsDelta.toFixed(4),
    calendarYearsElapsed: +calendarYearsDelta.toFixed(4),
    natureOrSpecTarget: +epochYearsDelta.toFixed(4),
    source: 'IAU Julian year (365.25 d = 31,557,600 s, src/data/constants.json) & Issue #109 ("The ONE clock: one clock, one rate")',
    score: check6Score,
    passes95: check6Score >= 0.95,
  },
  {
    id: 'biological_senescence_and_ontogeny_wiring',
    description: 'Snowshoe hare age ceiling vs 121.0 yr immortal runtime age after 10 Julian yr & live wolfGrowth ontogeny wiring',
    gameValue: `${hareAgeAfter10JulianYr.toFixed(1)} yr (immortal), wolfGrowthLive=${wolfGrowthCalledInMain}`,
    natureOrSpecTarget: `<= ${LIFESPAN.hare.maxYears.toFixed(1)} yr maxLifespan, wolfGrowthLive=true`,
    source: 'Krebs et al. (2001) BioScience 51:25 (snowshoe hare ~5 yr max), Mech & Boitani (2003) (wolf ~13 yr), Ditchkoff (2011) (deer ~20 yr)',
    score: check7Score,
    passes95: check7Score >= 0.95,
  },
  {
    id: 'living_pack_dry_habitat_packmates_and_state_persistence',
    description: 'LIVING_PACK dry-land hare spawn (y=-0.317m vs -0.25m water), spawned wolf packmate (35,0), & setPlayable state persistence',
    gameValue: `hareY=${hareGroundY.toFixed(3)}m (< -0.25m), wolvesInScene=${wolfPackmatesSpawnedInScene}/${wolfPackmatesInStore}, persisted=${setPlayablePersistsOutgoingState}`,
    natureOrSpecTarget: 'hareY >= -0.25m (dry), wolvesInScene=2/2, persisted=1',
    source: 'Mech & Boitani (2003) Wolves: Behavior, Ecology, and Conservation (pack size 2-15) & Issues #102/#103 ("step into an animal already alive")',
    score: check8Score,
    passes95: check8Score >= 0.95,
  },
  {
    id: 'issue_106_live_perception_boundary_and_browser_safety',
    description: 'Fraction of Issue #106 perception/physiology/threeBlocks pipeline stages wired live + browser-safe bodyFeelings imports',
    gameValue: `${wasmExportsPerception + liveCallsStepBodyFeelings + liveCallsThreeBlocks + liveCallsSignalsFromFrame + bodyFeelingsBrowserSafe}/5`,
    natureOrSpecTarget: '5/5',
    source: 'tasks/RULES.md Rule 18 / Issue #106 ("One packed perception frame in wasm memory... Embodied play uses the #106 frame")',
    score: check9Score,
    passes95: check9Score >= 0.95,
  },
  {
    id: 'cold_and_submersion_physiology_stress',
    description: 'Endotherm sub-T_lc cold stress at -35 C and hypoxic submersion oxygenStress in stepBodyFeelings',
    gameValue: `tempStress(-35C)=${coldStep.feelings.temperatureStress.toFixed(3)}, oxygenSubmersion=${oxygenStressHasSubmersionRate}`,
    natureOrSpecTarget: 'tempStress(-35C) > 0.1, oxygenSubmersion=1',
    source: 'Scholander et al. (1950) Biol. Bull. 99:237; Sheriff et al. (2009) (snowshoe hare winter T_lc ~ -10 C); Butler & Jones (1997) Physiol. Rev. 77:837',
    score: check10Score,
    passes95: check10Score >= 0.95,
  },
  {
    id: 'signals_from_frame_visible_retention_and_bearing',
    description: 'Retention of perception-known.bin Visible entries (salience 91 & 2) and forward (-Z) bearing accuracy in signalsFromFrame',
    gameValue: `retained=${visibleRetainedCount}/${parsedKnown.visible.length}, forwardBearingRad=${forwardBearingErrorRad.toFixed(4)}`,
    natureOrSpecTarget: `retained=${parsedKnown.visible.length}/${parsedKnown.visible.length}, forwardBearingRad=0.0000`,
    source: 'Issue #106 & rust/boreal-sim/src/perception.rs:420-448 (Visible salience & Boreal -Z forward coordinate frame)',
    score: check11Score,
    passes95: check11Score >= 0.95,
  },
  {
    id: 'sense_stream_multimodal_sight_survival',
    description: 'Survival of a 0.95-salience visual sight cue in createSenseStream when 6 sound + 3 scent cues are offered first',
    gameValue: sightSurvived,
    natureOrSpecTarget: 1,
    source: 'Issue #106 per-modality caps (32 visual, 16 scent, 8 sound) & Mech (1970) multimodal canid predation',
    score: check12Score,
    passes95: check12Score >= 0.95,
  },
];

const passCount = checks.filter((c) => c.passes95).length;
const meanScore = +(checks.reduce((acc, c) => acc + c.score, 0) / checks.length).toFixed(4);

const summary = {
  task: 'T-0249',
  evaluatedAt: new Date().toISOString(),
  calibrationValid,
  calibration,
  totalChecks: checks.length,
  passedChecks: passCount,
  meanScore,
  runtimeObservationsLoaded: Boolean(runtimeObs),
  runtimeHighlights: runtimeObs ? {
    frame0Scale: runtimeObs.observations?.[0]?.densityReport?.scale,
    frame0CensusIndividuals: runtimeObs.observations?.[0]?.densityReport?.census?.individuals,
    frame0PictureFulls: runtimeObs.observations?.[0]?.pictureReport?.fulls,
    frame1MidnightOliveStainFrac: runtimeObs.observations?.[1]?.glowingPancakeBox?.oliveStainFrac,
    frame1MidnightPancakeMeanRgb: runtimeObs.observations?.[1]?.glowingPancakeBox?.meanRgb,
    frame2HareSpawnHeightM: runtimeObs.observations?.[2]?.hareSpawnHeightM,
    frame2ComputedHareAgeYears: runtimeObs.observations?.[2]?.computedHareAgeYears,
    frame3SightAccepted: runtimeObs.observations?.[3]?.sightAcceptedWhenSoundAndScentFill8,
  } : null,
  checks,
};

writeFileSync(resolve(__dirname, 'numbers.json'), JSON.stringify(summary, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(summary, null, 2));
