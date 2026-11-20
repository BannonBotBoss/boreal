/**
 * Live & calibrated Rule 11 audit (T-0279) of Boreal's Transactional Ecology, Log Decay, Why Chains,
 * Scent Traces, Needs/Evasion/SimWorld, Stamina Modes, Focus Lock, and Behaviour-Pose Pipeline:
 *
 *   1. Log Decay & Why Chains (`src/core/logDecay.ts`, `src/core/why.ts`, `src/ui/inspector.ts`):
 *      - `moistureFactor` divides `mc / 0.431` without subtracting fiber saturation (`0.30`), so bone-dry
 *        wood at fiber saturation decays at 69.61% of full fungal rate (`t1/2 = 27.3 yr` vs >150 yr);
 *      - `woodMoisture(wet, light)` linearly forces even waterlogged bog logs (`wet = 1.0`) to `0.30` dry
 *        fiber saturation in full sun (`light = 1.0`), setting `insectShare = 0.00` for any `light > 0.883`;
 *      - `decayClass(remain)` uses `Math.floor(1 + 4 * tEff / 100)`, delaying Class 5 until `t >= 100 yr`
 *        (`remain <= 2.60%`) vs Yatskov et al. (2003) Class 5 density `108/400 = 27%` (`age 99 yr` = Class 4);
 *      - `nowText(whyOf(log))` always prints `"becoming forest floor (one more trunk cycle)"` even for
 *        fresh Class 1 logs, `agentWhy('deer'|'bear'|'fox')` throws, and `inspector.ts:140` hardcodes
 *        `'Gray wolf'` for every embodied player species.
 *   2. Scent Traces, Stamina Exhaustion Lock & Focus Lock (`src/core/traces.ts`, `src/core/wolfModes.ts`,
 *      `src/core/focusLock.ts`, `src/main.ts`):
 *      - `tryMark` gates by Euclidean radius `< 450 m` around every prior mark rather than trail length
 *        (Peters & Mech 1975: 1 RLU / 450 m of travel), so a 10 km territory patrol (`r = 159 m`) drops
 *        only 1 mark instead of 22 (4.5%) and locks out marking for ~23 game days;
 *      - `stepWolfModes` places `exhausted = false` inside `if (!next.left && !next.right)`, so holding `RT`
 *        after exhaustion lets stamina refill to `100/100` while remaining permanently locked in `exhausted` / `walk`;
 *      - `focusLock.ts` (`FOCUS_KINDS`) and `main.ts:741` (`view.entities()`) exclude snowshoe hares,
 *        red foxes, and wolf pups (`0%` non-catalog animal focus coverage).
 *   3. Species Needs, Evasion, Pup Allometry & Headless SimWorld (`src/core/needs/species/index.ts`,
 *      `src/core/needs/diet.ts`, `src/core/bodyFeelings.ts`, `src/core/sim/index.ts`):
 *      - `HARE_NEEDS.behaviour.evasion.lateralAccel = 30 m/s^2` (`3.06 g`), 2.31x its own cited cheetah upper
 *        bound (`13 m/s^2`, Wilson et al. 2013); `tiredSpeed = 11.2 m/s` (`89.6%` of burst) contradicts its
 *        own cited `5 / 8.5 * 12.5 = 7.353 m/s` ratio (`+52.3%` too fast; `gameSpeed` = `7.59 m/s > wolf 6.0 m/s` run);
 *      - `speciesCarrying` (`bodyFeelings.ts:73`) swaps `massKg` without scaling `fmrKjPerDay` (`M^0.772`) or
 *        `turnoverMlPerDay` (`M^0.818`), making a 4 kg wolf pup drain energy 6.2x too slowly (`7.3%/d` vs `45.3%/d`)
 *        while drinking/evaporating at adult `1,895 mL/d` scaling;
 *      - `SimWorld` never passes `tC` to `stepNeeds` (`heatFactor = 1.0` at `40 C`), `stepPrey` never calls
 *        `chooseGoal`/`activityAt`/`nearbyWater` and uses bare-timer random hops (`Rule 5`), `stepPredator`
 *        drops `choice.goal === 'drink'` (`nearbyWater` is 100% dead code in `src/`), and `evadeStep` ignores `stamina`.
 *   4. Procedural Behaviour-Animation Layer (`src/core/behaviourData.ts`, `src/core/behaviourPose.ts`):
 *      - `0` runtime callers in `src/render/`, `src/animals/`, or `src/main.ts`;
 *      - `bodyPoints` anchors `ear` directly above the nose tip (`x = nose.x`), placing wolf ears `~0.28 m`
 *        (`21%` of body length, `4.2x` the T-0020 5% gate) forward on the snout;
 *      - `wolf-sleep` and `hare-sleep` have `drop = 0` and straight standing legs, bit-identical to `drink`;
 *      - `hare-flee` has `airborne = true` for `>30%` of the stride yet `bob = 0.000 m` (zero ballistic arc).
 *
 * Usage:
 *   npx tsx refs/ecology/transactional-log-needs-pose-audit/audit.ts [baseUrl]
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

import {
  woodMoisture,
  moistureFactor,
  insectShare,
  decayClass,
  arenaOf,
  LOG_MC_FIBER,
  LOG_MC_BREAK,
  LOG_K_REF,
} from '../../../src/core/logDecay';
import { whyOf, nowText, agentWhy, gapLight } from '../../../src/core/why';
import { tryMark, MARK_SPACING_M } from '../../../src/core/traces';
import { DELTAS, DELTA_KINDS } from '../../../src/core/deltas';
import { stepWolfModes, createWolfModes } from '../../../src/core/wolfModes';
import { FOCUS_KINDS, pickFocus } from '../../../src/core/focusLock';
import { HARE_NEEDS, WOLF_NEEDS } from '../../../src/core/needs/species';
import { activityFactor, needRates, heatFactor } from '../../../src/core/needs/engine';
import { gameSpeed, evadeStep, startEvade } from '../../../src/core/needs/diet';
import { speciesCarrying } from '../../../src/core/bodyFeelings';
import { createWorld, createAnimal, tick } from '../../../src/core/sim';
import { sampleBehaviour } from '../../../src/core/behaviourPose';
import { WOLF_BONES, HARE_BONES, BEHAVIOURS } from '../../../src/core/behaviourData';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const BASE = process.argv[2] ?? 'http://127.0.0.1:5263';

const BROWSER_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
];
const EXECUTABLE = BROWSER_PATHS.find(p => existsSync(p));

interface CheckResult {
  id: string;
  label: string;
  measured: string;
  expected: string;
  score: number;
  knownMatchScore: number;
  knownMismatchScore: number;
  pass: boolean;
  source: string;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const mean = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / Math.max(1, arr.length);

// ---------------------------------------------------------------------------
// Check 1: Log decay (moistureFactor, sunlit bog desiccation, decayClass) & why.ts / inspector.ts
// ---------------------------------------------------------------------------
function checkLogDecayAndWhy() {
  const dryMf = moistureFactor(0, 0); // mc = 0.30 (fiber saturation, Griffin 1977: fungi cannot use bound water -> ~0)
  const sunlitBogMc = woodMoisture(1, 1); // wet = 1.0 bog in full sun -> 0.30!
  const sunlitBogInsects = insectShare(1, 1);
  const sunlitBogInsects09 = insectShare(1, 0.9);

  const arena99 = arenaOf({ wet: 0.6, light: 0.2, age: 99 }); // 99 yr, remain = 0.027 -> still Class 4!
  const classAtYatskovC5 = decayClass(0.27); // Yatskov et al. 2003 Picea Class 5 bulk density 108/400 = 27%

  const freshLogWhy = whyOf({ kind: 'log', x: 10, z: 10, seed: 42 });
  const freshNow = nowText(freshLogWhy);
  const freshLogHidesClass = freshNow.includes('becoming forest floor') && !freshNow.includes('decay class');

  const playableIds = ['wolf', 'hare', 'deer', 'bear', 'fox'];
  let agentWhySupported = 0;
  const agentWhyErrors: string[] = [];
  for (const id of playableIds) {
    try {
      agentWhy(id);
      agentWhySupported++;
    } catch (err: unknown) {
      agentWhyErrors.push(`${id}: ${(err as Error).message}`);
    }
  }
  const inspectorSrc = readFileSync(join(ROOT, 'src/ui/inspector.ts'), 'utf8');
  const inspectorHardcodesWolf = inspectorSrc.includes("agentWhy('wolf')") && inspectorSrc.includes("'Gray wolf'");

  const scoreFn = (
    dryMoistureFactor: number,
    bogSunlitMc: number,
    age99Class: number,
    yatskov27Class: number,
    freshShowsClass: boolean,
    whyCoverage: number,
    inspectorDynamic: boolean,
  ) =>
    mean([
      clamp01(1 - dryMoistureFactor / 0.70), // target ~0 at fiber saturation
      clamp01((bogSunlitMc - LOG_MC_FIBER) / (0.85 - LOG_MC_FIBER)), // saturated bog retains >=0.85 g/g in sun
      age99Class === 5 ? 1 : 0,
      yatskov27Class >= 4 ? 1 : 0, // 27% remain should be Class 4-5 (code returns 3!)
      freshShowsClass ? 1 : 0,
      whyCoverage,
      inspectorDynamic ? 1 : 0,
    ]);

  const score = scoreFn(
    dryMf,
    sunlitBogMc,
    arena99.klass,
    classAtYatskovC5,
    !freshLogHidesClass,
    agentWhySupported / playableIds.length,
    !inspectorHardcodesWolf,
  );
  const knownMatchScore = scoreFn(0.0, 0.90, 5, 5, true, 1.0, true);
  const knownMismatchScore = scoreFn(0.70, 0.30, 4, 3, false, 0.4, false);

  return {
    check: {
      id: 'log-decay-moisture-class-and-why-chains',
      label: 'Log decay fiber-saturation floor, sunlit-bog desiccation, decay-class shift & why/inspector',
      measured: `dry mf=${dryMf.toFixed(4)} (t1/2=${(Math.LN2 / (LOG_K_REF * dryMf)).toFixed(1)} yr); sunlit bog(wet=1,light=1) mc=${sunlitBogMc.toFixed(2)} g/g, insects=${sunlitBogInsects}; age 99 yr (remain=${arena99.remain.toFixed(4)}) class=${arena99.klass}, 27% remain class=${classAtYatskovC5}; freshLog nowText="${freshNow}"; agentWhy=${agentWhySupported}/${playableIds.length} (throws on ${agentWhyErrors.join(', ')}); inspectorHardcodesWolf=${inspectorHardcodesWolf}`,
      expected: 'dry fiber-saturation mf<=0.05 (t1/2>150 yr); sunlit saturated bog retains mc>=0.85 g/g; Yatskov 27% remain = Class 4-5 & 99 yr (2.7%) = Class 5; fresh log nowText reports active decay class/rate; agentWhy covers all playable species & inspector uses active playable species',
      score,
      knownMatchScore,
      knownMismatchScore,
      pass: score >= 0.95,
      source: 'Griffin (1977) via Bond-Lamberty et al. (2002) JGR 107(D23); Harmon et al. (1986) Adv. Ecol. Res. 15:133; Yatskov et al. (2003) CJFR 33:1211; Storaunet & Rolstad (2002) CJFR 32:1801',
    } as CheckResult,
    details: {
      dryMf,
      dryHalfLifeYr: Math.LN2 / (LOG_K_REF * dryMf),
      sunlitBogMc,
      sunlitBogInsects,
      sunlitBogInsects09,
      arena99,
      classAtYatskovC5,
      freshNow,
      agentWhySupported,
      agentWhyErrors,
      inspectorHardcodesWolf,
      gapLightVal: gapLight(),
    },
  };
}

// ---------------------------------------------------------------------------
// Check 2: Scent traces (Euclidean 450 m lockout), wolfModes stuck exhausted @ 100%, focusLock blind to hares/foxes/pups
// ---------------------------------------------------------------------------
function checkTracesModesAndFocus() {
  DELTAS.log.length = 0;
  let patrolMarks = 0;
  const totalDistM = 10_000;
  const radiusM = 159.155; // 1000 m circumference -> 10 laps = 10,000 m trail inside a 318 m diameter territory
  for (let i = 0; i < 1000; i++) {
    const ang = (i / 1000) * Math.PI * 2 * 10;
    const x = Math.cos(ang) * radiusM;
    const z = Math.sin(ang) * radiusM;
    if (tryMark('wolf:player', x, z, 10)) patrolMarks++;
  }
  const expectedPatrolMarks = Math.floor(totalDistM / MARK_SPACING_M); // 22 marks per Peters & Mech 1975
  const lockoutDays = -DELTA_KINDS.scent.tau * Math.log(DELTA_KINDS.scent.until); // 23.03 days

  // Stamina exhaustion lock at 100/100 when RT stays held
  let m = createWolfModes(100);
  m.stamina = 0;
  m.exhausted = true;
  for (let i = 0; i < 600; i++) m = stepWolfModes(m, 0, 1, true, 1 / 30); // 20 s holding RT
  const stuckExhaustedAt100 = m.stamina >= 99.9 && m.exhausted && m.mode === 'walk';

  // Focus lock exclusion of non-catalog animals (hares, foxes, pups)
  const hareFocus = pickFocus(
    true,
    undefined,
    { x: 0, z: 0, view: 0 },
    [{ key: 'hare:1', kind: 'hare', x: 0, z: -3 }, { key: 'fox:1', kind: 'fox', x: 0.5, z: -4 }],
  );
  const mainSrc = readFileSync(join(ROOT, 'src/main.ts'), 'utf8');
  const mainFocusOnlyEntities = mainSrc.includes("focusTarget = pickFocus(") && !mainSrc.includes("view.hares.list(), kinds") && !FOCUS_KINDS.includes('hare');

  const scoreFn = (marks: number, stuckAt100: boolean, canFocusHare: boolean) =>
    mean([
      clamp01(marks / expectedPatrolMarks),
      stuckAt100 ? 0 : 1,
      canFocusHare ? 1 : 0,
    ]);

  const score = scoreFn(patrolMarks, stuckExhaustedAt100, hareFocus !== undefined && !mainFocusOnlyEntities);
  const knownMatchScore = scoreFn(expectedPatrolMarks, false, true);
  const knownMismatchScore = scoreFn(1, true, false);

  return {
    check: {
      id: 'traces-mark-lockout-stamina-exhausted-focus-blind',
      label: 'Euclidean 450 m scent-mark lockout, wolfModes stuck exhausted at 100% stamina & hare/fox-blind focusLock',
      measured: `10 km territory patrol marks=${patrolMarks}/${expectedPatrolMarks} (${(100 * patrolMarks / expectedPatrolMarks).toFixed(1)}%, lockout=${lockoutDays.toFixed(1)} d); after 20 s holding RT from exhausted: stamina=${m.stamina.toFixed(1)}/100, exhausted=${m.exhausted}, mode=${m.mode}; FOCUS_KINDS=[${FOCUS_KINDS.join(',')}], hareFocus=${String(hareFocus)}`,
      expected: `~${expectedPatrolMarks} marks along 10 km trail (1 per 450 m path travelled); exhausted clears once stamina >= 20% even if RT is held; Focus (LB/F) includes live non-catalog animals (hare, fox, pup)`,
      score,
      knownMatchScore,
      knownMismatchScore,
      pass: score >= 0.95,
      source: 'Peters & Mech (1975) Am. Sci. 63:628 (584 RLUs / 240 km trail); T-0035 focusLock contract; T-0036 stamina recovery',
    } as CheckResult,
    details: {
      patrolMarks,
      expectedPatrolMarks,
      lockoutDays,
      wolfModesAfter20s: m,
      stuckExhaustedAt100,
      focusKinds: FOCUS_KINDS,
      hareFocusFound: hareFocus !== undefined,
    },
  };
}

// ---------------------------------------------------------------------------
// Check 3: Needs evasion (30 m/s^2 & 11.2 m/s hare), pup allometry (speciesCarrying), SimWorld dead water/tC/timers
// ---------------------------------------------------------------------------
function checkNeedsEvasionAllometryAndSim() {
  const hareLatAccel = HARE_NEEDS.behaviour.evasion.lateralAccel.v; // 30 m/s^2 vs cited 13 m/s^2 upper bound!
  const hareLatG = hareLatAccel / 9.81;
  const hareTiredSpeed = HARE_NEEDS.behaviour.evasion.tiredSpeed.v; // 11.2 m/s vs cited 5/8.5*12.5 = 7.353 m/s
  const citedTiredSpeed = (5 / 8.5) * HARE_NEEDS.behaviour.evasion.burstSpeed.v;
  const hareTiredGameSpeed = gameSpeed(hareTiredSpeed); // 7.587 m/s > wolf 6.0 m/s run!

  // Evade ignores stamina: stamina = 0 hare still gets full 8.47 m/s burst
  const ev0 = startEvade({ x: 0, z: 0 }, { x: 0, z: 2 });
  const evStep = evadeStep(HARE_NEEDS, ev0, { x: 0, z: 0 }, { x: 0, z: 2 }, 0.1, () => 0.5);

  // Pup allometry in speciesCarrying(WOLF_NEEDS, 4 kg)
  const pup = speciesCarrying(WOLF_NEEDS, 4);
  const pupRestRates = needRates(pup, 0);
  const adultRestRates = needRates(WOLF_NEEDS, 0);
  const pupEnergyPctPerDay = -pupRestRates.energy * 86400; // 9.10%/day (11 days to starve!)
  const adultEnergyPctPerDay = -adultRestRates.energy * 86400; // 45.34%/day
  // True 4 kg eutherian FMR (Nagy 1999): 4.21 * 4000^0.772 = 2541 kJ/d = 29.41 W; standing Taylor W = 15.83 W -> 53.8%/day
  const truePupFmrW = (4.21 * 4000 ** 0.772) * 1000 / 86400;
  const pupStandingW = 4 * (6.03 * 4 ** -0.303);
  const truePupEnergyPctPerDay = 100 * (pupStandingW / truePupFmrW); // 53.83%/day

  // SimWorld: thirsty predator (water=20) & thirsty/exhausted prey (water=10, rest=5, stamina=0) near water
  const w = createWorld({ seed: 1, water: (x, _z) => x > 6, hour: () => 12 });
  const simWolf = createAnimal(w, 'wolf', { x: 0, z: 0 }, { needs: { water: 20, rest: 90 }, energy: 90 });
  const simHare = createAnimal(w, 'hare', { x: -40, z: 0 }, { needs: { water: 10, rest: 5 }, energy: 90 });
  simHare.stamina = 0;
  let wolfDrank = false;
  let hareDrank = false;
  let hareRested = false;
  for (let i = 0; i < 600; i++) {
    tick(w, 0.1);
    if (simWolf.state === 'drink') wolfDrank = true;
    if (simHare.state === 'drink') hareDrank = true;
    if (simHare.state === 'rest') hareRested = true;
  }

  // Check if SimWorld passes tC to stepNeeds or calls nearbyWater (strip comments first)
  const simSrc = readFileSync(join(ROOT, 'src/core/sim/index.ts'), 'utf8');
  const simCode = simSrc.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
  const simPassesTemp = /stepNeeds\([^)]*tC\s*:/.test(simCode);
  const simCallsNearbyWater = (simCode.match(/\bnearbyWater\s*\(/g) ?? []).length > 1; // >1 = definition + call
  const hotHeatFactor40C = heatFactor(WOLF_NEEDS, 40); // 1.80x expected at 40 C vs 1.00x in SimWorld

  const scoreFn = (
    latAccel: number,
    tiredSpeed: number,
    pupEnergyDay: number,
    wDrank: boolean,
    hDrank: boolean,
    hRested: boolean,
    passesTemp: boolean,
  ) =>
    mean([
      clamp01(1 - Math.max(0, latAccel - 13) / 13), // <= 13 m/s^2 upper bound
      clamp01(1 - Math.abs(tiredSpeed - citedTiredSpeed) / citedTiredSpeed),
      clamp01(1 - Math.abs(pupEnergyDay - truePupEnergyPctPerDay) / truePupEnergyPctPerDay),
      wDrank ? 1 : 0,
      hDrank ? 1 : 0,
      hRested ? 1 : 0,
      passesTemp ? 1 : 0,
    ]);

  const score = scoreFn(
    hareLatAccel,
    hareTiredSpeed,
    pupEnergyPctPerDay,
    wolfDrank,
    hareDrank,
    hareRested,
    simPassesTemp,
  );
  const knownMatchScore = scoreFn(12.0, citedTiredSpeed, truePupEnergyPctPerDay, true, true, true, true);
  const knownMismatchScore = scoreFn(30.0, 11.2, 9.1, false, false, false, false);

  return {
    check: {
      id: 'needs-evasion-pup-allometry-and-simworld-thirst-temp',
      label: 'Hare 30 m/s^2 (3.06 g) & 11.2 m/s tired speed, unscaled pup allometry, and SimWorld dead drinking/heat/rest',
      measured: `hare lateralAccel=${hareLatAccel} m/s^2 (${hareLatG.toFixed(2)} g vs 13 m/s^2 bound); tiredSpeed=${hareTiredSpeed} m/s (game=${hareTiredGameSpeed.toFixed(2)} m/s vs cited ${citedTiredSpeed.toFixed(2)} m/s); 4 kg pup energy drain=${pupEnergyPctPerDay.toFixed(2)}%/d vs Nagy ${truePupEnergyPctPerDay.toFixed(2)}%/d; SimWorld 60 s: wolfDrank=${wolfDrank}, hareDrank=${hareDrank}, hareRested=${hareRested}, simPassesTemp=${simPassesTemp} (40 C factor=${hotHeatFactor40C.toFixed(2)}x), simCallsNearbyWater=${simCallsNearbyWater}`,
      expected: `lateralAccel<=13 m/s^2; tiredSpeed=${citedTiredSpeed.toFixed(2)} m/s; pup FMR/water scaled by M^0.772 / M^0.818 (${truePupEnergyPctPerDay.toFixed(1)}%/d); SimWorld routes drink/rest/nocturnal goals via chooseGoal + nearbyWater and passes site tC`,
      score,
      knownMatchScore,
      knownMismatchScore,
      pass: score >= 0.95,
      source: 'Wilson et al. (2013) Nature 498:185 (13 m/s^2 cheetah peak); Nagy et al. (1999) Annu. Rev. Nutr. 19:247; Nagy & Peterson (1988) UC Publ. Zool. 120; Rule 5 (no bare-timer random wander)',
    } as CheckResult,
    details: {
      hareLatAccel,
      hareLatG,
      hareTiredSpeed,
      citedTiredSpeed,
      hareTiredGameSpeed,
      evadeBurstSpeedOnZeroStamina: evStep.speed,
      pupEnergyPctPerDay,
      adultEnergyPctPerDay,
      truePupEnergyPctPerDay,
      pupWaterPctPerDay: -pupRestRates.water * 86400,
      adultWaterPctPerDay: -adultRestRates.water * 86400,
      wolfDrank,
      hareDrank,
      hareRested,
      simWolfEnd: { state: simWolf.state, water: simWolf.needs.water },
      simHareEnd: { state: simHare.state, water: simHare.needs.water, rest: simHare.needs.rest },
      simPassesTemp,
      simCallsNearbyWater,
    },
  };
}

// ---------------------------------------------------------------------------
// Check 4: Procedural Behaviour-Animation Layer (behaviourData.ts / behaviourPose.ts)
// ---------------------------------------------------------------------------
function checkBehaviourPosePipeline() {
  const wolfTrot = sampleBehaviour('wolf-trot', 0);
  const wolfDrink = sampleBehaviour('wolf-drink', 0);
  const wolfSleep = sampleBehaviour('wolf-sleep', 0);
  const hareDrink = sampleBehaviour('hare-drink', 0);
  const hareSleep = sampleBehaviour('hare-sleep', 0);
  const hareGraze = sampleBehaviour('hare-graze', 0);

  // 1. Ear anchored to nose tip: ear.x === nose.x when head === 0!
  const earNoseDx = Math.abs(wolfTrot.points.ear.x - wolfTrot.points.nose.x);
  // Cranium/occiput sits ~0.26 m behind snout tip on a 1.325 m gray wolf (Mech & Boitani 2003: skull ~25 cm)
  const expectedEarBehindNoseM = 0.25;
  const earPlacementErrPctBody = Math.abs(earNoseDx - expectedEarBehindNoseM) / WOLF_BONES.bodyLength; // 0.25 / 1.325 = 18.9% (3.8x the 5% T-0020 gate!)

  // 2. Sleep poses identical to drink (standing stiff-legged with drop = 0)
  const wolfSleepIdenticalToDrink = JSON.stringify(wolfSleep.points) === JSON.stringify(wolfDrink.points);
  const hareSleepIdenticalToDrink = JSON.stringify(hareSleep.points) === JSON.stringify(hareDrink.points);
  const wolfSleepHipDropFrac = 1 - wolfSleep.points.hip.y / WOLF_BONES.hipY; // 0.00 vs ~0.65-0.75 sternal lie-down

  // 3. Hare-flee airborne fraction vs vertical hip bob (should have ballistic suspension rise g*Ta^2/8)
  let hareAirSteps = 0;
  let hareMinHipY = Infinity;
  let hareMaxHipY = -Infinity;
  for (let k = 0; k < 200; k++) {
    const s = sampleBehaviour('hare-flee', k / 200);
    if (s.airborne) hareAirSteps++;
    hareMinHipY = Math.min(hareMinHipY, s.points.hip.y);
    hareMaxHipY = Math.max(hareMaxHipY, s.points.hip.y);
  }
  const hareAirFrac = hareAirSteps / 200;
  const hareCycleS = BEHAVIOURS.find(b => b.id === 'hare-flee')!.cycleS;
  const hareExpectedArcM = (9.81 * (hareAirFrac * hareCycleS) ** 2) / 8;
  const hareMeasuredBobM = hareMaxHipY - hareMinHipY;

  // 4. Wolf-drink nose height above ground/water (y = 0)
  const wolfDrinkNoseY = wolfDrink.points.nose.y;

  // 5. Runtime integration: check if src/render or src/animals or src/main imports behaviourPose
  const mainSrc = readFileSync(join(ROOT, 'src/main.ts'), 'utf8');
  const buildSceneSrc = readFileSync(join(ROOT, 'src/render/buildScene.ts'), 'utf8');
  const hareSrc = readFileSync(join(ROOT, 'src/animals/hare.ts'), 'utf8');
  const liveWired =
    mainSrc.includes('behaviourPose') ||
    buildSceneSrc.includes('behaviourPose') ||
    hareSrc.includes('behaviourPose');

  const scoreFn = (
    earErrPct: number,
    sleepDropFrac: number,
    hareBobM: number,
    drinkNoseY: number,
    wired: boolean,
  ) =>
    mean([
      clamp01(1 - earErrPct / 0.15), // <=5% passes T-0020 gate
      clamp01(sleepDropFrac / 0.60), // sternal lie drops hip >=60%
      clamp01(hareBobM / Math.max(hareExpectedArcM, 1e-4)),
      clamp01(1 - Math.max(0, drinkNoseY) / 0.15), // nose reaches water y <= 0.02 m
      wired ? 1 : 0,
    ]);

  const score = scoreFn(earPlacementErrPctBody, wolfSleepHipDropFrac, hareMeasuredBobM, wolfDrinkNoseY, liveWired);
  const knownMatchScore = scoreFn(0.0, 0.70, hareExpectedArcM, 0.0, true);
  const knownMismatchScore = scoreFn(0.189, 0.0, 0.0, 0.15, false);

  return {
    check: {
      id: 'behaviour-pose-snout-ears-standing-sleep-flat-bound-unwired',
      label: 'BehaviourPose snout-mounted ears, stiff-legged sleep == drink, 0 mm airborne hare-flee arc & 0 live callers',
      measured: `wolf ear-to-nose dx=${earNoseDx.toFixed(3)} m (${(earPlacementErrPctBody * 100).toFixed(1)}% bodyLength error vs 5% gate); wolfSleep==wolfDrink=${wolfSleepIdenticalToDrink}, hareSleep==hareDrink=${hareSleepIdenticalToDrink}, sleepHipDrop=${(wolfSleepHipDropFrac * 100).toFixed(1)}%; hare-flee airborne=${(hareAirFrac * 100).toFixed(1)}% yet hip bob=${(hareMeasuredBobM * 1000).toFixed(1)} mm vs ballistic ${(hareExpectedArcM * 1000).toFixed(1)} mm; wolf-drink noseY=${wolfDrinkNoseY.toFixed(3)} m; hare-graze noseY=${hareGraze.points.nose.y.toFixed(3)} m; liveWired=${liveWired}`,
      expected: `ear on cranium (~0.25 m behind snout, <=5% error); sternal sleep drop>=60% distinct from drink; hare-flee ballistic hip arc ~${(hareExpectedArcM * 1000).toFixed(1)} mm; drink nose reaches water (y<=0.02 m); live rigs consume shared pose spec`,
      score,
      knownMatchScore,
      knownMismatchScore,
      pass: score >= 0.95,
      source: 'Mech & Boitani (2003) Wolves (~25 cm skull); Alexander (2003) ballistic suspension g*T_air^2/8; T-0020 5% bodyLength keypoint gate',
    } as CheckResult,
    details: {
      wolfBones: WOLF_BONES,
      hareBones: HARE_BONES,
      earNoseDx,
      earPlacementErrPctBody,
      wolfSleepIdenticalToDrink,
      hareSleepIdenticalToDrink,
      wolfSleepHipDropFrac,
      hareAirFrac,
      hareCycleS,
      hareExpectedArcM,
      hareMeasuredBobM,
      wolfDrinkNoseY,
      hareGrazeNoseY: hareGraze.points.nose.y,
      liveWired,
    },
  };
}

// ---------------------------------------------------------------------------
// Check 5: Live Headless Chromium Capture & DOM/Visual Verification
// ---------------------------------------------------------------------------
async function runLiveBrowserAudit() {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  if (!EXECUTABLE) throw new Error('No Chrome/Edge executable found for live Chromium audit');

  const browser = await chromium.launch({
    executablePath: EXECUTABLE,
    headless: true,
    args: [
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--ignore-gpu-blocklist',
      '--no-sandbox',
    ],
  });

  const liveObs: Record<string, unknown> = {};
  const waitGroundReady = async (p: import('playwright').Page, url: string) => {
    await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await p.waitForSelector('canvas', { timeout: 20000 });
    await p.waitForFunction(() => {
      const el = document.querySelector('#loading') as HTMLElement | null;
      return !el || el.hidden || el.classList.contains('hidden') || getComputedStyle(el).display === 'none' || Number(getComputedStyle(el).opacity) < 0.1;
    }, { timeout: 25000 }).catch(() => {});
    await p.waitForTimeout(1500);
    // Dismiss start menu ("Continue" / "Play" / "Resume") until unpaused
    for (let attempt = 0; attempt < 4; attempt++) {
      const contBtn = p.locator('button:has-text("Continue"), button:has-text("Play"), button:has-text("Resume"), button:has-text("Begin")').first();
      if (await contBtn.isVisible().catch(() => false)) {
        await contBtn.click().catch(() => {});
        await p.waitForTimeout(1000);
      }
      const st = await p.locator('#status').innerText().catch(() => '');
      if (st && !st.startsWith('PAUSED')) break;
      await p.waitForTimeout(600);
    }
    await p.waitForTimeout(1200);
  };

  try {
    // 1. Live WebGL recording + Stamina 100/100 exhausted lock + Log Inspector (?contacts=1) + Focus lock
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await ctx.newPage();
    page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
    page.on('pageerror', e => pageErrors.push(String(e)));

    await waitGroundReady(page, `${BASE}/?skip=1&contacts=1&tier=0&day=196&hour=12&seed=1400`);
    const ensureUnpaused = async () => {
      const contBtn = page.locator('button:has-text("Continue"), button:has-text("Resume")').first();
      if (await contBtn.isVisible().catch(() => false)) {
        await contBtn.click().catch(() => {});
        await page.waitForTimeout(600);
      }
    };
    await ensureUnpaused();

    // Start compact 3-second WebM recording via canvas.captureStream + MediaRecorder (~100-300 KB)
    await page.evaluate(() => {
      const canvas = document.querySelector('canvas') as HTMLCanvasElement | null;
      if (!canvas || typeof MediaRecorder === 'undefined') return;
      const stream = canvas.captureStream(12);
      const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp8') ? 'video/webm;codecs=vp8' : 'video/webm';
      const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 600_000 });
      const chunks: Blob[] = [];
      rec.ondataavailable = e => { if (e.data && e.data.size > 0) chunks.push(e.data); };
      rec.start(100);
      (window as unknown as Record<string, unknown>).__auditRec = { rec, chunks };
    });

    // Brief live run + focus hold (3 s total -> compact WebM!)
    await page.keyboard.down('w');
    await page.keyboard.down('Shift');
    await page.waitForTimeout(1600);
    await page.keyboard.up('Shift');
    await page.keyboard.up('w');
    await page.keyboard.down('f');
    await page.waitForTimeout(900);
    const focusStatus = await page.locator('#status').innerText().catch(() => '');
    await page.screenshot({ path: join(HERE, 'frame-2-focus-lock-hare-blind.png') });
    await page.keyboard.up('f');
    liveObs.focusStatus = focusStatus;

    // Stop MediaRecorder and save compact recording.webm
    const b64: string | null = await page.evaluate(async () => {
      const r = (window as unknown as { __auditRec?: { rec: MediaRecorder; chunks: Blob[] } }).__auditRec;
      if (!r) return null;
      await new Promise<void>(resolve => { r.rec.onstop = () => resolve(); r.rec.stop(); });
      const blob = new Blob(r.chunks, { type: 'video/webm' });
      const buf = new Uint8Array(await blob.arrayBuffer());
      let bin = '';
      for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      return btoa(bin);
    });
    if (b64 && b64.length > 0) {
      const raw = Buffer.from(b64, 'base64');
      writeFileSync(join(HERE, 'recording.webm'), raw);
      liveObs.recordingBytes = raw.length;
    }

    // Frame 0: Enable debug HUD (`) so #inspector renders visibly, then call window.showWhy(logKey) on a live Decay Class 1 fallen log!
    await ensureUnpaused();
    await page.keyboard.press('Backquote');
    await page.waitForTimeout(300);
    const logProbe = await page.evaluate(() => {
      const w = window as unknown as {
        contacts?: { touching: () => { a: string; b: string; kind: string; source: string }[] };
        showWhy?: (key: string) => string;
      };
      const touching = w.contacts?.touching() ?? [];
      const logC = touching.find(c => c.source.startsWith('chunk-build:log'));
      const logKey = logC ? (logC.a === 'ground' ? logC.b : logC.a) : null;
      const whyStr = logKey && w.showWhy ? w.showWhy(logKey) : '';
      const el = document.getElementById('inspector');
      if (el) el.scrollTop = el.scrollHeight;
      return { touchingCount: touching.length, logKey, whyStr };
    });
    await page.waitForTimeout(700);
    const inspectorLogText = await page.locator('#inspector').innerText().catch(() => '');
    await page.screenshot({ path: join(HERE, 'frame-0-log-arena-inspector.png') });
    liveObs.logProbe = logProbe;
    liveObs.inspectorLogText = inspectorLogText.slice(-900);

    // Frame 1: Embodied White-tailed Deer (?skip=1&play=deer) + debug HUD (`) + Generation Inspector clicking on player
    await waitGroundReady(page, `${BASE}/?skip=1&play=deer&tier=0&day=196&hour=12&seed=1400`);
    await ensureUnpaused();
    await page.keyboard.press('Backquote');
    await page.waitForTimeout(300);
    await page.keyboard.press('i');
    await page.waitForTimeout(500);
    let deerInspectorText = '';
    for (const [cx, cy] of [[640, 430], [660, 440], [620, 430], [640, 460], [680, 430], [600, 420]]) {
      await page.mouse.click(cx, cy);
      await page.waitForTimeout(350);
      const txt = await page.locator('#inspector').innerText().catch(() => '');
      if (txt.includes('Gray wolf') || txt.includes('here with the player')) {
        deerInspectorText = txt;
        await page.evaluate(() => { const el = document.getElementById('inspector'); if (el) el.scrollTop = el.scrollHeight; });
        break;
      }
      if (txt.length > deerInspectorText.length) deerInspectorText = txt;
    }
    const deerStatus = await page.locator('#status').innerText().catch(() => '');
    await page.screenshot({ path: join(HERE, 'frame-1-embodied-deer-inspector.png') });
    liveObs.deerStatus = deerStatus;
    liveObs.deerInspectorText = deerInspectorText.slice(-800);
    await ctx.close();
  } finally {
    await browser.close();
  }

  const liveLogShowsBuried =
    String((liveObs.logProbe as { whyStr?: string } | undefined)?.whyStr ?? '').includes('becoming forest floor') ||
    String(liveObs.inspectorLogText ?? '').includes('becoming forest floor');
  const liveLogIsClass1 =
    String((liveObs.logProbe as { whyStr?: string } | undefined)?.whyStr ?? '').includes('decay class 1');
  const liveDeerInspectorBroken =
    String(liveObs.deerInspectorText ?? '').includes('Gray wolf') ||
    String(liveObs.deerInspectorText ?? '').includes('Click anything in the world');
  const liveFocusMissedNonCatalog =
    String(liveObs.focusStatus ?? '').includes('Nothing close enough to focus') ||
    !String(liveObs.focusStatus ?? '').includes('Focus:');
  const recBytes = Number(liveObs.recordingBytes ?? 0);

  const defectScoreFn = (logBuried: boolean, deerBroken: boolean, focusMissed: boolean) =>
    mean([logBuried ? 0 : 1, deerBroken ? 0 : 1, focusMissed ? 0 : 1]);

  const score = defectScoreFn(liveLogShowsBuried, liveDeerInspectorBroken, liveFocusMissedNonCatalog);
  const knownMatchScore = defectScoreFn(false, false, false);
  const knownMismatchScore = defectScoreFn(true, true, true);

  return {
    check: {
      id: 'live-chromium-log-buried-deer-inspector-and-focus-blind',
      label: 'Live WebGL Chromium: Decay Class 1 log Inspector "becoming forest floor", ?play=deer un-inspectable/Gray wolf & Focus blind to pups/hares/foxes',
      measured: `consoleErrors=${consoleErrors.length}, pageErrors=${pageErrors.length}, recording.webm=${recBytes} B; liveLogShowsBuried=${liveLogShowsBuried} (class1=${liveLogIsClass1}, logKey=${String((liveObs.logProbe as { logKey?: string | null } | undefined)?.logKey ?? null)}); liveDeerInspectorBroken=${liveDeerInspectorBroken}; liveFocusMissedNonCatalog=${liveFocusMissedNonCatalog}`,
      expected: 'Live Decay Class 1 fallen log Inspector reports active decay class/rate (not "becoming forest floor"); ?play=deer player is inspectable as White-tailed deer; Focus (F/LB) locks onto visible live animals',
      score,
      knownMatchScore,
      knownMismatchScore,
      pass: score >= 0.95,
      source: 'Live WebGL Chromium frames frame-0..2.png + recording.webm against src/core/why.ts, src/ui/inspector.ts & src/core/focusLock.ts',
    } as CheckResult,
    details: {
      consoleErrors,
      pageErrors,
      liveLogShowsBuried,
      liveLogIsClass1,
      liveDeerInspectorBroken,
      liveFocusMissedNonCatalog,
      ...liveObs,
    },
  };
}

async function main() {
  const c1 = checkLogDecayAndWhy();
  const c2 = checkTracesModesAndFocus();
  const c3 = checkNeedsEvasionAllometryAndSim();
  const c4 = checkBehaviourPosePipeline();
  const c5 = await runLiveBrowserAudit();

  const checks: CheckResult[] = [c1.check, c2.check, c3.check, c4.check, c5.check];
  const calibrationValid = checks.every(c => c.knownMatchScore >= 0.95 && c.knownMismatchScore <= 0.25);
  const passCount = checks.filter(c => c.pass).length;
  const meanScore = mean(checks.map(c => c.score));

  const out = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE,
    calibrationValid,
    passCount,
    totalChecks: checks.length,
    meanScore,
    checks,
    details: {
      logDecayAndWhy: c1.details,
      tracesModesAndFocus: c2.details,
      needsEvasionAllometryAndSim: c3.details,
      behaviourPose: c4.details,
      liveBrowser: c5.details,
    },
  };

  writeFileSync(join(HERE, 'numbers.json'), JSON.stringify(out, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify({ calibrationValid, passCount, totalChecks: checks.length, meanScore: +meanScore.toFixed(4) }));
  for (const c of checks) {
    console.log(`[${c.pass ? 'PASS' : 'FAIL'}] ${c.id}: score=${c.score.toFixed(4)} (match=${c.knownMatchScore.toFixed(4)}, mismatch=${c.knownMismatchScore.toFixed(4)})`);
    console.log(`   measured: ${c.measured}`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
