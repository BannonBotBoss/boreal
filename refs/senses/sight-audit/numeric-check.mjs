import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { WOLF_NEEDS } from '../../../src/core/needs/species/index.ts';
import { perceive } from '../../../src/core/needs/senses.ts';
import { SENSES, smell, scentLevel } from '../../../src/core/senses.ts';

const outDir = import.meta.dirname;

const nose = { x: 0, z: 0 };
const heading = 0; // facing -Z
const daylight = 1.0;
const upwind = { x: 0, z: 3 };
const downwind = { x: 0, z: -3 };

// Known-match control case: Moving hare (speed = 2.91 m/s) at 3.5 m ahead (0, -3.5)
// inside both presenceM (6 m) and scent threshold (0.025).
const hareControl = { key: 'hare:0', kind: 'hare', x: 0, z: -3.5, potency: 0.7, speed: 2.91 };
const controlScent = scentLevel(nose, hareControl, upwind);
const controlSmellHits = smell(nose, [hareControl], upwind, heading);
const controlExpectedPercept = perceive(WOLF_NEEDS, { ...nose, heading }, hareControl, { daylight, wind: upwind });
// Current HUD path evaluates perceive() on lastHits using speedOf(h.key), which works for 'hare:*' when in lastHits:
const controlActualHudSight = controlSmellHits.length > 0
  ? perceive(WOLF_NEEDS, { ...nose, heading }, { x: hareControl.x, z: hareControl.z, speed: hareControl.speed }, { daylight, wind: upwind }).sight
  : 0;
const controlMatchError = Math.abs(controlActualHudSight - controlExpectedPercept.sight);

// Case 1: Moving hare (speed = 2.91 m/s, HARE_NEEDS.body.speeds.run) at 20 m ahead (0, -20),
// with wind blowing from the wolf toward the hare (downwind of wolf: wind = { x: 0, z: -3 }).
const hare20 = { key: 'hare:1', kind: 'hare', x: 0, z: -20, potency: 0.7, speed: 2.91 };
const hareDownwindScent = scentLevel(nose, hare20, downwind);
const hareDownwindSmellHits = smell(nose, [hare20], downwind, heading);
const hareExpectedPercept = perceive(WOLF_NEEDS, { ...nose, heading }, hare20, { daylight, wind: downwind });
const hareActualHudSight = hareDownwindSmellHits.length > 0 ? hareExpectedPercept.sight : 0;

// Maximum distance at which a downwind hare (wind = {x: 0, z: -3}) passes SENSES.threshold (0.025) via local diffusion:
let maxDownwindHareScentM = 0;
for (let d = 0; d <= 48; d += 0.01) {
  if (scentLevel(nose, { key: 'hare:1', kind: 'hare', x: 0, z: -d, potency: 0.7 }, downwind) >= SENSES.threshold) {
    maxDownwindHareScentM = Number(d.toFixed(2));
  }
}

// Case 2: Moving deer (speed = 2.0 m/s) and walking visitor (speed = 1.2 m/s) at 20 m ahead (0, -20),
// upwind of the wolf (wind = { x: 0, z: 3 }, blowing from target to wolf so smell() includes them).
const deer20 = { key: '0:0:deer1', kind: 'deer', x: 0, z: -20, potency: 1.0, speed: 2.0 };
const person20 = { key: '0:0:person1', kind: 'person', x: 0, z: -20, potency: 0.85, speed: 1.2 };
const deerExpectedSight = perceive(WOLF_NEEDS, { ...nose, heading }, deer20, { daylight, wind: upwind }).sight;
// ui/senses.ts speedOf(key) returns 0 for any key not starting with 'hare:'
const deerActualHudSight = perceive(WOLF_NEEDS, { ...nose, heading }, { ...deer20, speed: 0 }, { daylight, wind: upwind }).sight;
const personExpectedSight = perceive(WOLF_NEEDS, { ...nose, heading }, person20, { daylight, wind: upwind }).sight;
const personActualHudSight = perceive(WOLF_NEEDS, { ...nose, heading }, { ...person20, speed: 0 }, { daylight, wind: upwind }).sight;

// Case 3: Invisible territory scent mark (kind: 'scent') at 2 m ahead (0, -2) from deltaSources
const scentMark2 = { key: 'delta:scent:1', kind: 'scent', x: 0, z: -2, potency: 0.9, range: 2400 };
const scentMarkHits = smell(nose, [scentMark2], upwind, heading);
const scentMarkFalseSight = scentMarkHits.length > 0
  ? perceive(WOLF_NEEDS, { ...nose, heading }, { x: scentMark2.x, z: scentMark2.z, speed: 0 }, { daylight, wind: upwind }).sight
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
    scentLevel: controlScent,
    inSmellLastHits: controlSmellHits.length > 0,
    expectedSightStrength: controlExpectedPercept.sight,
    actualHudSightStrength: controlActualHudSight,
    error: controlMatchError,
  },
  case1_downwindMovingHareAt20m: {
    distanceM: 20,
    speedMps: 2.91,
    wind: downwind,
    scentLevel: hareDownwindScent,
    inSmellLastHits: hareDownwindSmellHits.length > 0,
    maxDownwindHareScentDistanceM: maxDownwindHareScentM,
    expectedSightStrength: hareExpectedPercept.sight,
    actualHudSightStrength: hareActualHudSight,
    error: hareActualHudSight - hareExpectedPercept.sight,
  },
  case2_upwindMovingDeerAndPersonAt20m: {
    distanceM: 20,
    deerSpeedMps: 2.0,
    deerExpectedSightStrength: deerExpectedSight,
    deerActualHudSightStrength: deerActualHudSight,
    deerError: deerActualHudSight - deerExpectedSight,
    personSpeedMps: 1.2,
    personExpectedSightStrength: personExpectedSight,
    personActualHudSightStrength: personActualHudSight,
    personError: personActualHudSight - personExpectedSight,
  },
  case3_invisibleScentMarkAt2m: {
    distanceM: 2,
    kind: 'scent',
    expectedSightStrength: 0,
    actualHudSightStrength: scentMarkFalseSight,
    error: scentMarkFalseSight,
  },
  calibration: {
    knownMatchError: controlMatchError,
    knownMismatchCase1Error: Math.abs(hareActualHudSight - hareExpectedPercept.sight),
    knownMismatchCase2DeerError: Math.abs(deerActualHudSight - deerExpectedSight),
    knownMismatchCase3FalseSightError: scentMarkFalseSight,
  },
};

writeFileSync(join(outDir, 'numbers.json'), JSON.stringify(summary, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(summary, null, 2));
