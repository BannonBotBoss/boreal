import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { WOLF_NEEDS } from '../../../src/core/needs/species/index.ts';
import { perceive, see } from '../../../src/core/needs/senses.ts';
import { SENSES, smell, scentLevel } from '../../../src/core/senses.ts';

const outDir = import.meta.dirname;
mkdirSync(outDir, { recursive: true });

const nose = { x: 0, z: 0 };
const heading = 0; // facing -Z
const daylight = 1.0;
const upwindToWolf = { x: 0, z: 3 }; // wind blowing from target (0,-d) toward wolf (0,0)
const downwindFromWolf = { x: 0, z: -3 }; // wind blowing from wolf (0,0) toward target (0,-d)

// Independent analytical reference from Miller & Murphy (1995, JAVMA 207:1623) parameters in WOLF_NEEDS.senses.sight:
// rangeM = 60 m, presenceM = 6 m, motion ramp = [0.3, 1.5] m/s, daylight = 1 -> vis = 1.
function analyticalWolfSight(distanceM, speedMps, isVisualBody = true) {
  if (!isVisualBody) return 0;
  const presence = Math.max(0, Math.min(1, 1 - distanceM / 6));
  const motionRamp = Math.max(0, Math.min(1, (speedMps - 0.3) / (1.5 - 0.3)));
  const moving = motionRamp * Math.max(0, Math.min(1, 1 - distanceM / 60));
  return Math.max(moving, presence);
}

// Known-match control case: Moving hare (speed = 2.91 m/s) at 3.5 m ahead (0, -3.5)
const hareControl = { key: 'hare:0', kind: 'hare', x: 0, z: -3.5, potency: 0.7, speed: 2.91 };
const controlAnalyticalSight = analyticalWolfSight(3.5, 2.91, true);
const controlPostFixHits = see(WOLF_NEEDS, { ...nose, heading }, [hareControl], { daylight, wind: upwindToWolf });
const controlPostFixSight = controlPostFixHits[0]?.sight ?? 0;
const controlMatchError = Math.abs(controlPostFixSight - controlAnalyticalSight);

// Case 1: Moving hare (speed = 2.91 m/s) at 20 m ahead (0, -20) upwind of wind (wind blows from wolf to hare: {x:0, z:-3})
const hare20 = { key: 'hare:1', kind: 'hare', x: 0, z: -20, potency: 0.7, speed: 2.91 };
const hare20Scent = scentLevel(nose, hare20, downwindFromWolf);
const hare20SmellHits = smell(nose, [hare20], downwindFromWolf, heading);
const hare20AnalyticalSight = analyticalWolfSight(20, 2.91, true);
const hare20PostFixHits = see(WOLF_NEEDS, { ...nose, heading }, [hare20], { daylight, wind: downwindFromWolf });
const hare20PostFixSight = hare20PostFixHits[0]?.sight ?? 0;
const hare20PreFixSight = hare20SmellHits.length > 0 ? hare20PostFixSight : 0;

// Case 2: Moving deer (speed = 2.0 m/s) and walking visitor (speed = 1.2 m/s) at 20 m ahead (0, -20)
const deer20 = { key: '0:0:deer1', kind: 'deer', x: 0, z: -20, potency: 1.0, speed: 2.0 };
const person20 = { key: '0:0:person1', kind: 'person', x: 0, z: -20, potency: 0.85, speed: 1.2 };
const deerAnalyticalSight = analyticalWolfSight(20, 2.0, true);
const personAnalyticalSight = analyticalWolfSight(20, 1.2, true);
const case2PostFixHits = see(WOLF_NEEDS, { ...nose, heading }, [deer20, person20], { daylight, wind: upwindToWolf });
const deerPostFixSight = case2PostFixHits.find(h => h.key === deer20.key)?.sight ?? 0;
const personPostFixSight = case2PostFixHits.find(h => h.key === person20.key)?.sight ?? 0;
const deerPreFixSight = perceive(WOLF_NEEDS, { ...nose, heading }, { ...deer20, speed: 0 }, { daylight, wind: upwindToWolf }).sight;
const personPreFixSight = perceive(WOLF_NEEDS, { ...nose, heading }, { ...person20, speed: 0 }, { daylight, wind: upwindToWolf }).sight;

// Case 3: Invisible territory scent mark (kind: 'scent') at 2 m ahead (0, -2) from deltaSources
const scentMark2 = { key: 'trace:scent:0.00:-2.00', kind: 'scent', x: 0, z: -2, potency: 0.9, range: 2400 };
const scentMarkSmellHits = smell(nose, [scentMark2], upwindToWolf, heading);
const scentMarkAnalyticalSight = analyticalWolfSight(2, 0, false);
// Post-fix: visualBodies excludes deltaSources, so see() receives [] when only a scent mark is present
const scentMarkPostFixHits = see(WOLF_NEEDS, { ...nose, heading }, [], { daylight, wind: upwindToWolf });
const scentMarkPostFixSight = scentMarkPostFixHits[0]?.sight ?? 0;
const scentMarkPreFixSight = scentMarkSmellHits.length > 0
  ? perceive(WOLF_NEEDS, { ...nose, heading }, { x: scentMark2.x, z: scentMark2.z, speed: 0 }, { daylight, wind: upwindToWolf }).sight
  : 0;

const summary = {
  source: 'Miller & Murphy 1995, JAVMA 207:1623 (Vision in dogs, cited in WOLF_NEEDS.senses.sight) and EPA ISC Gaussian plume model (src/core/senses.ts)',
  wolfSightSpec: {
    rangeM: WOLF_NEEDS.senses.sight.rangeM.v,
    fovDeg: WOLF_NEEDS.senses.sight.fovDeg.v,
    nightFloor: WOLF_NEEDS.senses.sight.night.v,
    motionRampMps: WOLF_NEEDS.senses.sight.motion.v,
    presenceM: WOLF_NEEDS.senses.sight.presenceM.v,
    hudThreshold: SENSES.threshold,
  },
  control_closeHareAt3_5m: {
    distanceM: 3.5,
    speedMps: 2.91,
    analyticalSightStrength: Number(controlAnalyticalSight.toFixed(4)),
    postFixHudSightStrength: Number(controlPostFixSight.toFixed(4)),
    error: Number(controlMatchError.toFixed(6)),
  },
  case1_upwindMovingHareAt20m: {
    distanceM: 20,
    speedMps: 2.91,
    wind: downwindFromWolf,
    scentLevel: Number(hare20Scent.toFixed(8)),
    inSmellLastHits: hare20SmellHits.length > 0,
    analyticalSightStrength: Number(hare20AnalyticalSight.toFixed(4)),
    preFixHudSightStrength: Number(hare20PreFixSight.toFixed(4)),
    postFixHudSightStrength: Number(hare20PostFixSight.toFixed(4)),
    postFixError: Number(Math.abs(hare20PostFixSight - hare20AnalyticalSight).toFixed(6)),
  },
  case2_movingDeerAndPersonAt20m: {
    distanceM: 20,
    deerSpeedMps: 2.0,
    deerAnalyticalSightStrength: Number(deerAnalyticalSight.toFixed(4)),
    deerPreFixHudSightStrength: Number(deerPreFixSight.toFixed(4)),
    deerPostFixHudSightStrength: Number(deerPostFixSight.toFixed(4)),
    deerPostFixError: Number(Math.abs(deerPostFixSight - deerAnalyticalSight).toFixed(6)),
    personSpeedMps: 1.2,
    personAnalyticalSightStrength: Number(personAnalyticalSight.toFixed(4)),
    personPreFixHudSightStrength: Number(personPreFixSight.toFixed(4)),
    personPostFixHudSightStrength: Number(personPostFixSight.toFixed(4)),
    personPostFixError: Number(Math.abs(personPostFixSight - personAnalyticalSight).toFixed(6)),
  },
  case3_invisibleScentMarkAt2m: {
    distanceM: 2,
    kind: 'scent',
    inSmellLastHits: scentMarkSmellHits.length > 0,
    analyticalSightStrength: scentMarkAnalyticalSight,
    preFixHudSightStrength: Number(scentMarkPreFixSight.toFixed(4)),
    postFixHudSightStrength: Number(scentMarkPostFixSight.toFixed(4)),
    postFixError: Number(Math.abs(scentMarkPostFixSight - scentMarkAnalyticalSight).toFixed(6)),
  },
  calibration: {
    metric: 'Absolute difference between HUD visual producer see() sight strength and analytical Miller & Murphy (1995) sight formula',
    knownMatchError: Number(controlMatchError.toFixed(6)),
    knownMismatchPreFixCase1Error: Number(Math.abs(hare20PreFixSight - hare20AnalyticalSight).toFixed(4)),
    knownMismatchPreFixCase2DeerError: Number(Math.abs(deerPreFixSight - deerAnalyticalSight).toFixed(4)),
    knownMismatchPreFixCase3FalseSightError: Number(Math.abs(scentMarkPreFixSight - scentMarkAnalyticalSight).toFixed(4)),
  },
};

writeFileSync(join(outDir, 'numbers.json'), JSON.stringify(summary, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(summary, null, 2));
