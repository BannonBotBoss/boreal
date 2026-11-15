/**
 * Calibrated Rule 11 numeric audit for T-0232:
 * Wolf litter ontogeny, seasonal whelping phenology, #109 clock-dial / coarse-scale coupling,
 * instantaneous 0.2 m teleportation, staged-lake underwater submergence, and #309 Red Fox
 * maternal-defense perpetual control-hijack loop & zero-census phantom fox.
 *
 * Sources:
 * - Mech, L. D. & Boitani, L. (2003), Wolves: Behavior, Ecology, and Conservation (Univ. Chicago Press),
 *   Ch. 1 (Mech) & Ch. 2 (Packard, pp. 35–65): boreal gray wolf whelping late April–early May (DOY ~120),
 *   den emergence at 3–4 weeks (late May, ~2.5–3.5 kg), January pups ~8.5 months (0.71 yr) subadults.
 * - Peterson, R. O., Woolington, J. D. & Bailey, T. N. (1984), Wildl. Monogr. 88 & Kreeger, T. J. (2003,
 *   Wolves Ch. 7): 12-month yearling skeletal shoulder height ~0.92–0.96x adult female (~30–34 kg vs 36–40 kg),
 *   never >1.0x adult; neonate woolly undercoat molts by 8–12 weeks (~0.19 yr); 1 calendar year = 31,557,600 s.
 * - Ballard, W. B., Carbyn, L. N. & Smith, D. W. (2003), Wolves Ch. 10 ("Wolf Interactions with Non-Prey",
 *   pp. 259–271) & GitHub Issue #309: a 5 kg red fox charged by a 40 kg maternal wolf flees the den site
 *   rather than rebounding to 11 m in 3.75 s in a 9.8 s infinite loop; #309 effort curve E = exp(4*(m_p/m - 1))
 *   makes grown >30 kg yearlings prohibitive to a 5 kg fox; zero census red_fox = no fox encounter.
 * - GitHub Issue #109 (Dial), T-0104 & T-0106 (coarse.ts, worldClock.ts), and PROJECT-RULES Rule 5:
 *   simWorldSec = 0 during rewind (<0x) and above Immediate (>12x, bodyShare = 0); no bare timers or >0.2 m teleports.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { K } from '../../../src/core/constants.ts';
import {
  LITTER,
  actMps,
  ageAfter,
  followStep,
  pupAim,
  pupScale,
} from '../../../src/core/litter.ts';
import {
  LINGER_RING,
  bodyKg,
  effort,
  resetDrives,
  stepDrives,
} from '../../../src/core/drives.ts';
import {
  resolveObservation,
  simWorldSec,
} from '../../../src/core/worldClock.ts';
import { animalShares } from '../../../src/core/coarse.ts';
import { surfaceAt } from '../../../src/core/stages/surfaceAt.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
mkdirSync(__dirname, { recursive: true });

/**
 * Rule 11 Metric & Calibration:
 * - ratioScore(measured, target) = min(measured, target) / max(measured, target) for strictly positive ratios/scales
 * - unitScore(measured, target, fullScale) = max(0, 1 - |measured - target| / fullScale)
 * Pass threshold: >= 0.95 (unrounded).
 */
const ratioScore = (a, b) => {
  if (a <= 0 || b <= 0) return a === b ? 1 : 0;
  return Math.min(a, b) / Math.max(a, b);
};
const unitScore = (measured, target, fullScale) =>
  Math.max(0, 1 - Math.abs(measured - target) / Math.max(1e-9, fullScale));

// Calibration checks (known match vs known mismatch)
const calKnownMatchLitterCount = unitScore(LITTER.count, 5, 5); // 1.0000 >= 0.95 (Mech & Boitani 2003: 4–6 pups)
const calKnownMatchYearlingScale = ratioScore(0.95, 0.95); // 1.0000 >= 0.95
const calKnownMismatchHyperGrowth = ratioScore(LITTER.growthGameSPerYear, K.julian_year_s); // 0.0005 < 0.95
const calKnownMismatchOversizedPup = unitScore(1.2096, 0.95, 0.95); // 0.7267 < 0.95

// ---------------------------------------------------------------------------
// 1. Ontogeny, Yearling Scale, Prey-Effort Mass, & January Whelping Phenology
// ---------------------------------------------------------------------------
// 1a. Calendar seconds per year of ontogenetic growth:
const realJulianYearSec = K.julian_year_s; // 31,557,600 s
const gameGrowthSecPerYear = LITTER.growthGameSPerYear; // 14,400 s (4.0 game hours!)
const growthRateScore = ratioScore(gameGrowthSecPerYear, realJulianYearSec);

// 1b. Maximum litter member Z-scale at age 1.0 yr in pups.ts:79-80:
// bulk(slot) = 0.88 + ((slot * 3 + 1) % 5) * 0.05 -> slot 1 has bulk = 1.08; holder.scale.z = grown * 1.12 * bulk
const yearlingGrown = pupScale(1.0);
const slotBulks = [0, 1, 2, 3, 4].map((slot) => 0.88 + ((slot * 3 + 1) % 5) * 0.05);
const maxYearlingLengthScale = yearlingGrown * 1.12 * Math.max(...slotBulks); // 1.2096x adult mother!
const maxYearlingVolumeRatio = (yearlingGrown * 1.1 * Math.max(...slotBulks)) *
  (yearlingGrown * Math.max(...slotBulks)) *
  maxYearlingLengthScale; // 1.551x adult mother volume!
const natureYearlingScale = 0.95; // Peterson et al. (1984) / Mech & Boitani (2003): 12-mo yearling ~0.92–0.97x adult height
const yearlingScaleScore = unitScore(maxYearlingLengthScale, natureYearlingScale, natureYearlingScale);

// 1c. Mid-January (DOY 15) litter age at 49.8°N (born DOY ~121 May 1):
// Elapsed days from May 1 (DOY 121) to Jan 15 (DOY 365 + 15 = 380) = 259 days = 0.7091 yr (~8.5 months).
// bornLitter() spawns LITTER.emergeYears = 4/52 = 0.0769 yr (4-week neonate) in -19 °C January snow!
const gameJan15PupAgeYr = LITTER.emergeYears; // 0.07692 yr
const natureJan15SubadultAgeYr = (365 - 121 + 15) / 365.25; // 0.7091 yr
const winterPhenologyAgeScore = ratioScore(gameJan15PupAgeYr, natureJan15SubadultAgeYr);

// 1d. Red Fox (#309) prey-effort on grown 1.0 yr yearling offspring (~34 kg vs hardcoded 2.5 kg neonate):
const gameYearlingEffortForFox = effort(bodyKg('Red Fox'), bodyKg('pup')); // 0.2500 (hardcoded 2.5 kg!)
const natureYearlingMassKg = 34; // Kreeger (2003) / Peterson et al. (1984) 12-mo yearling wolf ~30–36 kg
const natureYearlingEffortForFox = effort(bodyKg('Red Fox'), natureYearlingMassKg); // exp(4*(34/5 - 1)) = 1.2026e10
// Compare log10(1 + effort) so astronomical exponential effort is bounded on a physical log-effort scale:
const yearlingFoxEffortScore = ratioScore(
  Math.log10(1 + gameYearlingEffortForFox),
  Math.log10(1 + natureYearlingEffortForFox),
);

// ---------------------------------------------------------------------------
// 2. #109 Time-Dial Rewind / Coarse-Scale Coupling & 0.20 m Frame Teleportation
// ---------------------------------------------------------------------------
// 2a. At Behavioral time scale (rate = 20x > 12x enter threshold):
// simWorldSec = 0 and coarse.ts animalShares().body = 0 for wild animals, yet main.ts:603 steps pups by wallDt (1.0 s/s)
// and pups.ts keeps holder.visible = true (visible share = 1.0 instead of 0.0)!
const obsBehavioral = resolveObservation('behavioral', 20);
const expectedSimStepAt20x = simWorldSec(20 * (1 / 60), obsBehavioral); // 0.0000
const expectedBodyShareAt20x = animalShares(1.0, obsBehavioral).body; // 0.0000
const gamePupStepPerWallSecAt20x = 1.0; // main.ts:603 passes wallDt directly
const gamePupVisibleShareAt20x = 1.0; // pups.ts ignores animalShares().body
const behavioralScaleFoldScore = unitScore(gamePupVisibleShareAt20x, expectedBodyShareAt20x, 1.0);

// 2b. During #109 Rewind (rate = -10x):
// isPaused() is false, active is true, wDt < 0 -> simWorldSec = 0, yet main.ts:603 passes wallDt = +1/60 s > 0!
const obsRewind = resolveObservation('immediate', 10);
const expectedSimStepOnRewind = simWorldSec(-10 * (1 / 60), obsRewind); // 0.0000
const gamePupStepPerWallSecOnRewind = 1.0; // wallDt > 0 advances pup clock & phase forward during rewind
const rewindFreezeScore = unitScore(gamePupStepPerWallSecOnRewind, expectedSimStepOnRewind, 1.0);

// 2c. Instantaneous single-frame teleportation in followStep (litter.ts:187 `moving && d > 0.2`):
// Place 4-week pup 0.45 m behind its aim slot while mother moves on a 60 Hz frame (dt = 1/60 s):
const aim0 = pupAim(0, 0, 0, 0, 0, true, LITTER.emergeYears, false);
const startX = aim0.x;
const startZ = aim0.z + 0.45; // 0.45 m gap (< rejoinM 4.0 m, > 0.20 m threshold!)
const dtFrame = 1 / 60;
const after1Frame = followStep(startX, startZ, 0, 0, 0, 0, dtFrame, LITTER.emergeYears, 0, true, false);
const frameJumpDistM = Math.hypot(after1Frame.x - startX, after1Frame.z - startZ); // 0.45 m in 16.7 ms!
const impliedPupSpeedMps = frameJumpDistM / dtFrame; // 27.0 m/s!
const maxPhysPupSpeedMps = actMps('pounce', LITTER.emergeYears); // 1.125 m/s (0.9 * 1.25)
const pupTeleportSpeedScore = ratioScore(maxPhysPupSpeedMps, impliedPupSpeedMps);

// ---------------------------------------------------------------------------
// 3. Staged-Lake Underwater Pup & Fox Submergence (pups.ts:116 & drives.ts)
// ---------------------------------------------------------------------------
const waterSurfaceOf = (pt) => pt.lake?.surface ?? pt.river?.surface ?? null;

// Deterministic shoreline encounter on dry bank at (-1188, -964, yaw = 1.9635) next to home upland lake (17.631 m):
// 1. Mother starts dry (ground 17.703 m > lake 17.631 m).
// 2. stepDrives spawns Red Fox 11 m ahead at (-1198.16, -959.79) on lake bed (16.265 m -> 1.366 m underwater!).
// 3. After 2.27 s (tick 68), protect >= 0.50 sets hold = true and forcibly marches mother + all 5 pups into the lake!
resetDrives();
let shoreMx = -1188;
let shoreMz = -964;
let shoreYaw = 1.9635;
const startMotherPt = surfaceAt(shoreMx, shoreMz, 1400);
let initialFoxDepthM = 0;
let initialFoxPos = null;
for (let t = 0; t < 95; t++) {
  const p0 = pupAim(0, shoreMx, shoreMz, shoreYaw, t / 30, true, LITTER.emergeYears, false);
  const now = stepDrives(shoreMx, shoreMz, shoreYaw, p0.x, p0.z, true, 1 / 30);
  if (t === 0) {
    const sf0 = surfaceAt(now.foxX, now.foxZ, 1400);
    const wf0 = waterSurfaceOf(sf0);
    initialFoxDepthM = wf0 !== null ? Math.max(0, wf0 - sf0.height) : 0;
    initialFoxPos = { x: Number(now.foxX.toFixed(2)), z: Number(now.foxZ.toFixed(2)), groundY: Number(sf0.height.toFixed(3)), lakeY: Number((wf0 ?? 0).toFixed(3)) };
  }
  if (now.hold) {
    shoreMx = now.mamaX;
    shoreMz = now.mamaZ;
    shoreYaw = now.mamaYaw + Math.PI;
  }
}
const endMotherPt = surfaceAt(shoreMx, shoreMz, 1400);
const lakeSurfaceY = waterSurfaceOf(endMotherPt) ?? 0;
let submergedPups = 0;
let maxPupWaterDepthM = 0;
for (let s = 0; s < 5; s++) {
  const p = pupAim(s, shoreMx, shoreMz, shoreYaw, 95 / 30, true, LITTER.emergeYears, true);
  const sp = surfaceAt(p.x, p.z, 1400);
  const wp = waterSurfaceOf(sp);
  const pupY = Math.max(sp.height, -0.2); // exact formula in pups.ts:116!
  if (wp !== null && wp > pupY) {
    submergedPups++;
    maxPupWaterDepthM = Math.max(maxPupWaterDepthM, wp - pupY);
  }
}
const shoreProbe = {
  startPose: { x: -1188, z: -964, yaw: 1.9635, motherStartDryGroundY: Number(startMotherPt.height.toFixed(3)), lakeSurfaceY: Number(lakeSurfaceY.toFixed(3)) },
  initialFoxSpawn: { ...initialFoxPos, foxWaterDepthM: Number(initialFoxDepthM.toFixed(3)) },
  afterForcedChargeAt3_17s: {
    motherX: Number(shoreMx.toFixed(2)),
    motherZ: Number(shoreMz.toFixed(2)),
    motherWaterDepthM: Number(Math.max(0, lakeSurfaceY - endMotherPt.height).toFixed(3)),
    submergedPupsOutOf5: submergedPups,
    maxPupWaterDepthM: Number(maxPupWaterDepthM.toFixed(3)),
  },
  foxWaterDepthM: Number(initialFoxDepthM.toFixed(3)),
  maxPupWaterDepthM: Number(maxPupWaterDepthM.toFixed(3)),
};
const pupShoulderHeight4WkM = 0.74 * pupScale(LITTER.emergeYears); // ~0.264 m
const pupSubmergenceScore = unitScore(shoreProbe.maxPupWaterDepthM, 0, pupShoulderHeight4WkM);
const foxLakeSubmergenceScore = unitScore(shoreProbe.foxWaterDepthM, 0, 0.40); // red fox shoulder height ~0.40 m

// ---------------------------------------------------------------------------
// 4. #309 Maternal-Defense Perpetual 9.8 s Hijack Loop, Towed Fox, & Zero-Census Bug
// ---------------------------------------------------------------------------
// Simulate 60 seconds (1,800 ticks at 30 Hz) of standing mother wolf in stepDrives:
resetDrives();
let mx = 0;
let mz = 0;
const myaw = 0;
let holdTicks = 0;
let chargeCommits = 0;
let prevCommitted = false;
const commitTimesSec = [];
for (let tick = 0; tick < 1800; tick++) {
  const now = stepDrives(mx, mz, myaw, mx + 0.4, mz + 0.55, true, 1 / 30);
  if (now.hold) {
    holdTicks++;
    mx = now.mamaX;
    mz = now.mamaZ;
  }
  if (now.committed && !prevCommitted) {
    chargeCommits++;
    commitTimesSec.push(Number((tick / 30).toFixed(3)));
  }
  prevCommitted = now.committed;
}
const hijackDutyFraction = holdTicks / 1800; // ~0.204 (20.4% of all play time!)
const meanCyclePeriodSec = commitTimesSec.length >= 2
  ? (commitTimesSec[commitTimesSec.length - 1] - commitTimesSec[0]) / (commitTimesSec.length - 1)
  : 0;
const chargesPerHour = chargeCommits * 60; // ~360 charges/hour vs <= 1 deterred encounter!
const hijackFreePlayScore = unitScore(hijackDutyFraction, 0, 0.25); // 0% hijack once fox is deterred
const postChargeDeterrenceScore = ratioScore(1, Math.max(1, chargesPerHour));

// Simulate mother wolf sprinting at 10.5 m/s for 10 s (105 m) while in 'watch'/'linger':
// Fox max flee speed is 9 m/s and linger speed is 0.8 m/s, yet pushOut tows fox 105 m along with mother!
resetDrives();
let sprintMx = 0;
const sprintMz = 0;
let lastSprintDrive = null;
for (let tick = 0; tick < 60; tick++) {
  sprintMx += 10.5 * (1 / 30); // mother sprints 21 m in 2.0 s (before protect hits 0.5 at 2.27 s)
  lastSprintDrive = stepDrives(sprintMx, sprintMz, Math.PI / 2, sprintMx - 0.5, 0, false, 1 / 30);
}
// Initial fox was at (-11, 0); after mother ran +21 m east in 2.0 s, check how far fox was towed east!
const foxMovedIn2SecM = Math.hypot((lastSprintDrive.foxX - (-11)), lastSprintDrive.foxZ);
const impliedTowedFoxSpeedMps = foxMovedIn2SecM / 2.0;
const configuredLingerFoxSpeedMps = 0.8; // drives.ts:166 linger speed = 0.8 m/s
const foxWorldSpaceIndependenceScore = ratioScore(configuredLingerFoxSpeedMps, impliedTowedFoxSpeedMps);

// Zero-census phantom fox check (main.ts:678 vs landingCast.ts:256-258):
const mainSrc = readFileSync(resolve(__dirname, '../../../src/main.ts'), 'utf8');
const mainChecksFoxCensusBeforeStepDrives = mainSrc.includes('red_fox') || mainSrc.includes('hasFox');
const zeroCensusGateScore = mainChecksFoxCensusBeforeStepDrives ? 1 : 0;

let liveObs = null;
try {
  liveObs = JSON.parse(readFileSync(resolve(__dirname, 'observations.json'), 'utf8'));
} catch {}

const checks = [
  { id: 'ontogenetic_growth_seconds_per_year', game: gameGrowthSecPerYear, target: realJulianYearSec, score: Number(growthRateScore.toFixed(4)) },
  { id: 'yearling_max_length_scale_vs_mother', game: Number(maxYearlingLengthScale.toFixed(4)), target: natureYearlingScale, score: Number(yearlingScaleScore.toFixed(4)) },
  { id: 'mid_january_litter_age_years', game: Number(gameJan15PupAgeYr.toFixed(4)), target: Number(natureJan15SubadultAgeYr.toFixed(4)), score: Number(winterPhenologyAgeScore.toFixed(4)) },
  { id: 'yearling_prey_effort_for_5kg_fox_log10', game: Number(Math.log10(1 + gameYearlingEffortForFox).toFixed(4)), target: Number(Math.log10(1 + natureYearlingEffortForFox).toFixed(4)), score: Number(yearlingFoxEffortScore.toFixed(4)) },
  { id: 'behavioral_20x_scale_pup_fold', game: gamePupVisibleShareAt20x, target: expectedBodyShareAt20x, score: Number(behavioralScaleFoldScore.toFixed(4)) },
  { id: 'rewind_pup_freeze_rate', game: gamePupStepPerWallSecOnRewind, target: expectedSimStepOnRewind, score: Number(rewindFreezeScore.toFixed(4)) },
  { id: 'pup_follow_step_max_speed_mps', game: Number(impliedPupSpeedMps.toFixed(3)), target: Number(maxPhysPupSpeedMps.toFixed(3)), score: Number(pupTeleportSpeedScore.toFixed(4)) },
  { id: 'shoreline_pup_submergence_depth_m', game: shoreProbe?.maxPupWaterDepthM ?? null, target: 0, score: Number(pupSubmergenceScore.toFixed(4)) },
  { id: 'shoreline_fox_submergence_depth_m', game: shoreProbe?.foxWaterDepthM ?? null, target: 0, score: Number(foxLakeSubmergenceScore.toFixed(4)) },
  { id: 'post_charge_fox_deterrence_charges_per_hr', game: chargesPerHour, target: 1, score: Number(postChargeDeterrenceScore.toFixed(4)) },
  { id: 'fox_linger_world_speed_vs_towed_mps', game: Number(impliedTowedFoxSpeedMps.toFixed(3)), target: configuredLingerFoxSpeedMps, score: Number(foxWorldSpaceIndependenceScore.toFixed(4)) },
  { id: 'zero_fox_census_gates_step_drives', game: mainChecksFoxCensusBeforeStepDrives ? 1 : 0, target: 1, score: zeroCensusGateScore },
];

const meanScore = checks.reduce((acc, c) => acc + c.score, 0) / checks.length;
const passingCount = checks.filter((c) => c.score >= 0.95).length;

const out = {
  generatedAt: new Date().toISOString(),
  metric: {
    name: 'Calibrated ratioScore & unitScore against Mech & Boitani (2003), Peterson et al. (1984), Ballard et al. (2003), and Issues #109 / #309',
    passThreshold: 0.95,
    calibration: {
      knownMatchLitterCountScore: Number(calKnownMatchLitterCount.toFixed(4)),
      knownMatchYearlingScaleScore: Number(calKnownMatchYearlingScale.toFixed(4)),
      knownMismatchHyperGrowthScore: Number(calKnownMismatchHyperGrowth.toFixed(4)),
      knownMismatchOversizedPupScore: Number(calKnownMismatchOversizedPup.toFixed(4)),
    },
  },
  summary: {
    totalChecks: checks.length,
    passingChecks: passingCount,
    meanScore: Number(meanScore.toFixed(4)),
    passesGate: passingCount === checks.length,
  },
  shoreProbe,
  hijackLoop60sSimulation: {
    chargeCommitsIn60s: chargeCommits,
    chargesPerHour,
    commitTimesSec,
    meanCyclePeriodSec: Number(meanCyclePeriodSec.toFixed(3)),
    holdTicksOutOf1800: holdTicks,
    hijackDutyFraction: Number(hijackDutyFraction.toFixed(4)),
    hijackFreePlayScore: Number(hijackFreePlayScore.toFixed(4)),
  },
  ontogenyDetails: {
    maxYearlingLengthScale: Number(maxYearlingLengthScale.toFixed(4)),
    maxYearlingVolumeRatio: Number(maxYearlingVolumeRatio.toFixed(4)),
    gameYearlingEffortForFox,
    natureYearlingEffortForFox: Number(natureYearlingEffortForFox.toExponential(4)),
  },
  checks,
  liveRuntimeSummary: liveObs ? liveObs.observations : null,
};

writeFileSync(resolve(__dirname, 'numbers.json'), JSON.stringify(out, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(out, null, 2));
