/**
 * Live & calibrated Rule 11 audit of Multi-Species Gait Kinematics, Locomotion CPG/IK LOD &
 * StickRig Alignment, Slope Jump Ballistics & ?loco=1 Wiring, Hare Side-Slope Roll/Wakes, and
 * Mammal Skeleton Resting Tail Grounding:
 *  1. src/core/animalBehavior.ts:196,205-239 & src/core/bearBody.ts:18-20 — gaitFor() restricts
 *     canidPlan/reachTargets via pointer identity `legs === WOLF_LEGS`, dropping all other canids
 *     and cloned/scaled wolf legs into alexanderGait(); inside alexanderGait(), 1.1x gallop
 *     vertical inflation collapses maxStance to 0.000 m on BEAR_LEGS (24.19 Hz at 6 m/s, 48.39 Hz
 *     at 12 m/s — 11.2x-22.4x nature's 2.16 Hz) and 0.331 m on DEER_LEGS (5.14 Hz at 6 m/s,
 *     9.46 Hz at 15.65 m/s flee — 4.1x nature's 2.29-2.36 Hz), with zero Froude hysteresis
 *     (39/39 flickers on +-0.05 m/s jitter) and hardcoded G = 9.81 instead of gravity().
 *  2. src/animals/locomotion/gaits.ts:37-46 — planGait() with override='gallop' forces static
 *     duty = 0.30 instead of g.duty (0.285 -> 0.170), shrinking 10.5 m/s stride from 4.038 m to
 *     2.288 m (+76.5% cadence, 4.59 Hz vs 2.60 Hz) and erasing extended flight suspension (0/4
 *     speeds retain extended flight).
 *  3. src/animals/locomotion/controller.ts:69-74,121-180 — 'mid' LOD evaluates 6.00 ground()
 *     calls/frame (3x the documented 2 samples) because hipGround runs unconditionally before the
 *     LOD branch, and drop() modifies tilt without updating ideal[i] rels[i], sinking mid-LOD
 *     stance feet up to 206.4 mm underground (vs 0.00 mm in 'near' LOD).
 *  4. src/animals/locomotion/stickRig.ts:35-38 — createStickRig().apply() ignores p.shift and
 *     pelvisShift(p.spineFlex), detaching stance paws from their world targets pose.feet[i] by
 *     up to ~115 mm during a 9 m/s gallop (vs 0.00 mm when shift + pelvisShift are applied).
 *  5. src/animals/locomotion/jump.ts:25-34, controller.ts:89-116, game.ts:16,38 &
 *     render/playables.ts:32 — airborne jumps add heightOff onto live ground-following base.height
 *     (riding a 20 deg slope +2.40 m upward mid-flight, d2y/dt2 = -87.2..+279.5 m/s^2 vs -9.82),
 *     jump.ts injects an airborne smoothstep impulse during air=0..0.2, game.ts clamps ground at
 *     -0.2 (ignoring LEVEL.waterSurface=-0.25 and staged lakes/rivers) and drops f.hold, and
 *     playables.ts skips mirrorStoredAnimal() when LOCO_FLAG is active.
 *  6. src/animals/locomotion/bounding.ts:755, src/animals/hare.ts:234,370-377 &
 *     src/core/skeleton.ts:172 — createBounding hardcodes roll=0 (10.0 mm slip, 9.5 mm ground
 *     error, 2 leash steps on 20 deg side-slope; poseHare never applies tilt.roll); hare.ts wakes
 *     use hardcoded 7 Hz (+59% vs HARE_GAIT 4.40 Hz) with trot offsets [0.5,0,0.5,0]; and
 *     buildMammal places 20/54 (37.0%) mammal resting tail tips underground (down to -76 mm on
 *     River Otter, -70 mm on Eastern Gray Squirrel, -56 mm on Jumping Mouse = -187% withers).
 *
 * Usage:
 *   npx tsx refs/locomotion/gait-kinematics-lod-skeleton-audit/audit.ts [baseUrl]
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { chromium } from 'playwright';

import {
  DEER_LEGS,
  WOLF_LEGS,
  gaitFor,
  pelvisShift,
} from '../../../src/core/animalBehavior';
import { BEAR_LEGS } from '../../../src/core/bearBody';
import { suspensions } from '../../../src/core/gaitData';
import { gravity } from '../../../src/proc/physics';
import { LEVEL } from '../../../src/core/tuning';
import { planGait } from '../../../src/animals/locomotion/gaits';
import { createLocomotion, referenceLayout } from '../../../src/animals/locomotion/controller';
import { createStickRig } from '../../../src/animals/locomotion/stickRig';
import { apexHeight, airSeconds, jumpFrame, jumpSeconds } from '../../../src/animals/locomotion/jump';
import { DEER_AGENT, MAMMALS, mammalSkeleton } from '../../../src/core/species';
import { validateSkeleton } from '../../../src/core/skeleton';
import { createBounding, GIRDLE } from '../../../src/animals/locomotion/bounding';
import { skeletonOf } from '../../../src/animals/locomotion/bodyPlan';
import { HARE_PLAN, HARE_RIG } from '../../../src/animals/hare';
import { HARE_GAIT } from '../../../src/core/needs/species';
import { boundCadence } from '../../../src/core/needs/bound';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const BASE = process.argv[2] ?? 'http://127.0.0.1:5260';

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
const ratioScore = (a: number, b: number) => {
  if (a <= 0 || b <= 0) return a === b ? 1 : 0;
  return clamp01(Math.min(a, b) / Math.max(a, b));
};

// --- Check 1: Multi-species alexanderGait cadence collapse, pointer-identity & zero hysteresis ---
function scoreCheck1(m: {
  bear6Hz: number;
  bear12Hz: number;
  deer15Hz: number;
  cloneWolfHz: number;
  deerHystSwitches: number;
  usesSharedGravity: boolean;
}) {
  // Heglund & Taylor 1988 JEB 138:301 Table 3: preferred/max gallop f = 4.44 M^-0.156 .. 4.70 M^-0.162
  // 100 kg bear -> ~2.16-2.23 Hz (Shine et al. 2015 JEB 218:3102: 2.0-2.4 Hz)
  // 70 kg deer -> ~2.29-2.36 Hz
  // 40 kg wolf -> ~2.60 Hz at 10.5 m/s
  const sBear6 = ratioScore(m.bear6Hz, 2.16);
  const sBear12 = ratioScore(m.bear12Hz, 2.30);
  const sDeer = ratioScore(m.deer15Hz, 2.36);
  const sClone = ratioScore(m.cloneWolfHz, 2.60);
  const sHyst = clamp01(1 - m.deerHystSwitches / 20);
  const sGrav = m.usesSharedGravity ? 1 : 0;
  return Number(((sBear6 + sBear12 + sDeer + sClone + sHyst + sGrav) / 6).toFixed(4));
}

function runCheck1() {
  const bear6 = gaitFor('walk', 6.0, BEAR_LEGS)!;
  const bear12 = gaitFor('walk', 12.0, BEAR_LEGS)!;
  const deer6 = gaitFor('walk', 6.0, DEER_LEGS)!;
  const deer15 = gaitFor('walk', DEER_AGENT.speed.flee, DEER_LEGS)!;
  const wolfRef = gaitFor('walk', 10.5, WOLF_LEGS)!;
  const wolfClone = gaitFor('walk', 10.5, { ...WOLF_LEGS })!;

  const bear6Hz = 6.0 / bear6.cycle;
  const bear12Hz = 12.0 / bear12.cycle;
  const deer6Hz = 6.0 / deer6.cycle;
  const deer15Hz = DEER_AGENT.speed.flee / deer15.cycle;
  const wolfRefHz = 10.5 / wolfRef.cycle;
  const cloneWolfHz = 10.5 / wolfClone.cycle;

  const vCenter = Math.sqrt(2.5 * 9.81 * DEER_LEGS.hip);
  let switches = 0;
  let prev: 'walk' | 'trot' | 'gallop' | undefined = undefined;
  for (let i = 0; i < 40; i++) {
    const v = vCenter + (i % 2 === 0 ? -0.05 : 0.05);
    const g = gaitFor('walk', v, DEER_LEGS, prev)!;
    if (prev && g.name !== prev) switches++;
    prev = g.name;
  }

  const abSrc = readFileSync(join(ROOT, 'src/core/animalBehavior.ts'), 'utf8');
  const usesSharedGravity = !/const G\s*=\s*9\.81\b/.test(abSrc);

  const score = scoreCheck1({
    bear6Hz,
    bear12Hz,
    deer15Hz,
    cloneWolfHz,
    deerHystSwitches: switches,
    usesSharedGravity,
  });
  const knownMatchScore = scoreCheck1({
    bear6Hz: 2.16,
    bear12Hz: 2.30,
    deer15Hz: 2.36,
    cloneWolfHz: 2.60,
    deerHystSwitches: 0,
    usesSharedGravity: true,
  });
  const knownMismatchScore = scoreCheck1({
    bear6Hz: 24.2,
    bear12Hz: 48.4,
    deer15Hz: 9.5,
    cloneWolfHz: 8.1,
    deerHystSwitches: 39,
    usesSharedGravity: false,
  });

  return {
    check: {
      id: 'alexander-gait-multispecies-cadence-and-hysteresis',
      label: 'Multi-species gallop cadence (Bear/Deer/Canid), Froude hysteresis & shared gravity()',
      measured: `Bear 6/12 m/s: ${bear6Hz.toFixed(2)}/${bear12Hz.toFixed(2)} Hz (stride ${bear6.cycle.toFixed(3)} m); Deer 6/15.65 m/s: ${deer6Hz.toFixed(2)}/${deer15Hz.toFixed(2)} Hz (stride ${deer15.cycle.toFixed(3)} m); cloned WOLF_LEGS 10.5 m/s: ${cloneWolfHz.toFixed(2)} Hz vs ${wolfRefHz.toFixed(2)} Hz; deer jitter switches=${switches}/39; hardcoded G=9.81=${!usesSharedGravity}`,
      expected: `Bear ~2.16-2.30 Hz; Deer ~2.29-2.36 Hz; cloned/other canids ~2.60 Hz (no pointer-identity lock); 0/39 hysteresis switches; shared gravity() (${gravity().toFixed(4)} m/s^2)`,
      score,
      knownMatchScore,
      knownMismatchScore,
      pass: score >= 0.95,
      source: 'Heglund & Taylor (1988) JEB 138:301 Table 3 (f = 4.44 M^-0.156 Hz); Shine et al. (2015) JEB 218:3102; Alexander & Jayes (1983) J. Zool. 201:135',
    } satisfies CheckResult,
    details: {
      bear6: { cycle: bear6.cycle, hz: bear6Hz, duty: bear6.duty },
      bear12: { cycle: bear12.cycle, hz: bear12Hz, duty: bear12.duty },
      deer6: { cycle: deer6.cycle, hz: deer6Hz, duty: deer6.duty },
      deer15: { cycle: deer15.cycle, hz: deer15Hz, duty: deer15.duty },
      wolfRef: { cycle: wolfRef.cycle, hz: wolfRefHz, duty: wolfRef.duty },
      wolfClone: { cycle: wolfClone.cycle, hz: cloneWolfHz, duty: wolfClone.duty },
      deerHystSwitches: switches,
      usesSharedGravity,
    },
  };
}

// --- Check 2: planGait(v, WOLF_LEGS, 'gallop') override duty & extended suspension loss ---
function scoreCheck2(m: {
  cadenceRatio105: number;
  duty105: number;
  extendedPreservedFrac: number;
}) {
  const sCad = ratioScore(m.cadenceRatio105, 1.0);
  const sDuty = clamp01(1 - Math.abs(m.duty105 - 0.17) / 0.13);
  const sSus = clamp01(m.extendedPreservedFrac);
  return Number(((sCad + sDuty + sSus) / 3).toFixed(4));
}

function runCheck2() {
  const speeds = [5.0, 7.0, 9.2, 10.5];
  const rows = speeds.map(v => {
    const auto = planGait(v, WOLF_LEGS);
    const over = planGait(v, WOLF_LEGS, 'gallop');
    const susAuto = suspensions(auto.offsets, auto.duty);
    const susOver = suspensions(over.offsets, over.duty);
    return {
      v,
      autoDuty: auto.duty,
      overDuty: over.duty,
      autoCycle: auto.cycle,
      overCycle: over.cycle,
      autoHz: v / auto.cycle,
      overHz: v / over.cycle,
      autoExtended: susAuto.some(s => s.kind === 'extended'),
      overExtended: susOver.some(s => s.kind === 'extended'),
    };
  });
  const r105 = rows[rows.length - 1];
  const extendedAuto = rows.filter(r => r.autoExtended).length;
  const extendedOver = rows.filter(r => r.overExtended).length;
  const extendedPreservedFrac = extendedAuto > 0 ? extendedOver / extendedAuto : 1;

  const score = scoreCheck2({
    cadenceRatio105: r105.overHz / r105.autoHz,
    duty105: r105.overDuty,
    extendedPreservedFrac,
  });
  const knownMatchScore = scoreCheck2({
    cadenceRatio105: 1.0,
    duty105: 0.17,
    extendedPreservedFrac: 1.0,
  });
  const knownMismatchScore = scoreCheck2({
    cadenceRatio105: 1.8,
    duty105: 0.30,
    extendedPreservedFrac: 0.0,
  });

  return {
    check: {
      id: 'plangait-gallop-override-duty-and-flight',
      label: 'planGait() gallop override duty ramp, stride length & extended suspension',
      measured: `At 10.5 m/s override='gallop': duty=${r105.overDuty.toFixed(3)} (vs ${r105.autoDuty.toFixed(3)}), stride=${r105.overCycle.toFixed(3)} m (vs ${r105.autoCycle.toFixed(3)} m), cadence=${r105.overHz.toFixed(2)} Hz (+${(((r105.overHz / r105.autoHz) - 1) * 100).toFixed(1)}%), extended flight preserved=${extendedOver}/${extendedAuto} speeds`,
      expected: `duty=0.170 at 10.5 m/s, stride=4.038 m, cadence=2.60 Hz (0% inflation), extended flight preserved=4/4 speeds`,
      score,
      knownMatchScore,
      knownMismatchScore,
      pass: score >= 0.95,
      source: 'Walter & Carrier (2007) JEB 210:208 (canid gallop duty ~0.21 at 9.2 m/s, 71-75 ms stance); Bertram & Gutmann (2009) J. R. Soc. Interface 6:549',
    } satisfies CheckResult,
    details: { rows, extendedAuto, extendedOver },
  };
}

// --- Check 3: controller.ts 'mid' LOD 6 ground calls & 206 mm underground feet ---
function scoreCheck3(m: { midGroundCallsPerFrame: number; midMaxUndergroundMm: number }) {
  const sCalls = clamp01(1 - Math.max(0, m.midGroundCallsPerFrame - 2) / 4);
  const sDepth = clamp01(1 - Math.max(0, m.midMaxUndergroundMm - 2) / 50);
  return Number(((sCalls + sDepth) / 2).toFixed(4));
}

function runCheck3() {
  let callsNear = 0, callsMid = 0;
  const gNear = (_x: number, _z: number) => { callsNear++; return 0; };
  const gMid = (_x: number, _z: number) => { callsMid++; return 0; };
  const layout = referenceLayout();
  const cNear = createLocomotion(layout, gNear, { x: 0, z: 0, heading: 0 });
  const cMid = createLocomotion(layout, gMid, { x: 0, z: 0, heading: 0 });
  callsNear = 0; callsMid = 0;

  let maxMidUndergroundMm = 0;
  let maxNearUndergroundMm = 0;
  let z = 0;
  const dt = 1 / 60, speed = 8.0, frames = 180;
  for (let i = 0; i < frames; i++) {
    z -= speed * dt;
    const pNear = cNear.update({ x: 0, z, heading: 0, speed }, dt, 'near');
    const pMid = cMid.update({ x: 0, z, heading: 0, speed }, dt, 'mid');
    for (let l = 0; l < 4; l++) {
      if (pMid.contacts[l]) maxMidUndergroundMm = Math.max(maxMidUndergroundMm, -pMid.feet[l].y * 1000);
      if (pNear.contacts[l]) maxNearUndergroundMm = Math.max(maxNearUndergroundMm, -pNear.feet[l].y * 1000);
    }
  }
  const midGroundCallsPerFrame = callsMid / frames;
  const nearGroundCallsPerFrame = callsNear / frames;

  const score = scoreCheck3({ midGroundCallsPerFrame, midMaxUndergroundMm: maxMidUndergroundMm });
  const knownMatchScore = scoreCheck3({ midGroundCallsPerFrame: 2.0, midMaxUndergroundMm: 0.0 });
  const knownMismatchScore = scoreCheck3({ midGroundCallsPerFrame: 6.0, midMaxUndergroundMm: 206.0 });

  return {
    check: {
      id: 'controller-mid-lod-grounding-and-samples',
      label: "controller.ts 'mid' LOD terrain sample budget & stance foot grounding",
      measured: `mid ground()=${midGroundCallsPerFrame.toFixed(2)} calls/frame (near=${nearGroundCallsPerFrame.toFixed(2)}); mid max stance foot sink=${maxMidUndergroundMm.toFixed(2)} mm underground (near=${maxNearUndergroundMm.toFixed(2)} mm)`,
      expected: `mid ground() <= 2.00 calls/frame (per controller.ts:5 contract); mid max stance foot sink <= 2.0 mm`,
      score,
      knownMatchScore,
      knownMismatchScore,
      pass: score >= 0.95,
      source: 'src/animals/locomotion/controller.ts:4-5 LOD contract (mid = 2 ground samples, feet on tilted support plane)',
    } satisfies CheckResult,
    details: { midGroundCallsPerFrame, nearGroundCallsPerFrame, maxMidUndergroundMm, maxNearUndergroundMm },
  };
}

// --- Check 4: stickRig.ts missing p.shift & pelvisShift(p.spineFlex) paw detachment ---
function scoreCheck4(m: { maxStancePawErrMm: number }) {
  return Number(clamp01(1 - Math.max(0, m.maxStancePawErrMm - 2) / 50).toFixed(4));
}

function runCheck4() {
  const layout = referenceLayout();
  const loco = createLocomotion(layout, () => 0, { x: 0, z: 0, heading: 0 });
  const stick = createStickRig(layout);
  const fixed = createStickRig(layout);

  let z = 0;
  const dt = 1 / 120, speed = 9.0;
  const maxStick = [0, 0, 0, 0];
  const maxFixed = [0, 0, 0, 0];
  let maxShiftMm = 0;
  let maxSpineDeg = 0;

  for (let i = 0; i < 360; i++) {
    z -= speed * dt;
    const p = loco.update({ x: 0, z, heading: 0, speed }, dt, 'near');
    stick.apply(p, { x: 0, z, heading: 0 });
    stick.root.updateMatrixWorld(true);

    fixed.apply(p, { x: 0, z, heading: 0 });
    fixed.tilt.position.set(0, p.shift?.y ?? 0, p.shift?.z ?? 0);
    const sh = pelvisShift(p.spineFlex ?? 0);
    fixed.legs.forEach((abd, l) => {
      const [hx, hz] = layout.hips[l];
      const L = l % 2 ? layout.legs.hind! : layout.legs;
      abd.position.set(hx, L.hip + (L.girdle ?? 0) + (l % 2 ? sh.y : 0), hz + (l % 2 ? sh.z : 0));
    });
    fixed.root.updateMatrixWorld(true);

    if (i > 120) {
      maxShiftMm = Math.max(maxShiftMm, Math.hypot(p.shift?.y ?? 0, p.shift?.z ?? 0) * 1000);
      maxSpineDeg = Math.max(maxSpineDeg, Math.abs(p.spineFlex ?? 0) * 180 / Math.PI);
      for (let l = 0; l < 4; l++) {
        if (!p.contacts[l]) continue;
        let p1: THREE.Object3D = stick.legs[l];
        let p2: THREE.Object3D = fixed.legs[l];
        stick.legs[l].traverse(o => { if ((o as THREE.Mesh).isMesh && (o as THREE.Mesh).geometry.type === 'BoxGeometry') p1 = o.parent!; });
        fixed.legs[l].traverse(o => { if ((o as THREE.Mesh).isMesh && (o as THREE.Mesh).geometry.type === 'BoxGeometry') p2 = o.parent!; });
        const w1 = new THREE.Vector3(), w2 = new THREE.Vector3();
        p1.getWorldPosition(w1);
        p2.getWorldPosition(w2);
        maxStick[l] = Math.max(maxStick[l], Math.hypot(w1.x - p.feet[l].x, w1.y - p.feet[l].y, w1.z - p.feet[l].z) * 1000);
        maxFixed[l] = Math.max(maxFixed[l], Math.hypot(w2.x - p.feet[l].x, w2.y - p.feet[l].y, w2.z - p.feet[l].z) * 1000);
      }
    }
  }
  const worstStick = Math.max(...maxStick);
  const worstFixed = Math.max(...maxFixed);
  const score = scoreCheck4({ maxStancePawErrMm: worstStick });
  const knownMatchScore = scoreCheck4({ maxStancePawErrMm: worstFixed });
  const knownMismatchScore = scoreCheck4({ maxStancePawErrMm: 100 });

  return {
    check: {
      id: 'stickrig-gallop-paw-target-alignment',
      label: 'stickRig.ts world paw-to-target alignment (shift & pelvisShift)',
      measured: `9 m/s gallop stance paw error [LF,LH,RF,RH]=[${maxStick.map(v => v.toFixed(1)).join(', ')}] mm (max ${worstStick.toFixed(1)} mm; maxShift=${maxShiftMm.toFixed(1)} mm, maxSpineFlex=${maxSpineDeg.toFixed(1)} deg) vs ${worstFixed.toFixed(2)} mm when shift+pelvisShift applied`,
      expected: `<= 2.0 mm stance paw-to-target error (0.00 mm geometric match to controller.ts pose.feet)`,
      score,
      knownMatchScore,
      knownMismatchScore,
      pass: score >= 0.95,
      source: 'src/animals/locomotion/signals.ts:36-39 & fork/playerRig.ts:176-183 (shift + pelvisShift rig contract)',
    } satisfies CheckResult,
    details: { maxStick, maxFixed, worstStick, worstFixed, maxShiftMm, maxSpineDeg },
  };
}

// --- Check 5: Non-ballistic slope jump & broken ?loco=1 game wiring ---
function scoreCheck5(m: {
  maxAccelErrMps2: number;
  flatAirImpulseMps2: number;
  gameWaterMatchesLevel: boolean;
  locoMirrorsStore: boolean;
  locoPassesHold: boolean;
}) {
  const sSlope = clamp01(1 - m.maxAccelErrMps2 / 25);
  const sFlat = clamp01(1 - m.flatAirImpulseMps2 / 25);
  const sWire = ((m.gameWaterMatchesLevel ? 1 : 0) + (m.locoMirrorsStore ? 1 : 0) + (m.locoPassesHold ? 1 : 0)) / 3;
  return Number(((sSlope + sFlat + sWire) / 3).toFixed(4));
}

function runCheck5() {
  const g = gravity();
  const slope = (_x: number, z: number) => -z * Math.tan(20 * Math.PI / 180);
  const layout = referenceLayout();
  const loco = createLocomotion(layout, slope, { x: 0, z: 0, heading: 0 });
  const dt = 1 / 120, speed = 8.0;
  let z = 0;
  for (let i = 0; i < 60; i++) { z -= speed * dt; loco.update({ x: 0, z, heading: 0, speed }, dt, 'near'); }
  const ys: number[] = [], groundYs: number[] = [];
  for (let i = 0; i < 120; i++) {
    z -= speed * dt;
    const p = loco.update({ x: 0, z, heading: 0, speed, intent: i === 0 ? { kind: 'pounce' } : undefined }, dt, 'near');
    if (loco.jumping() && p.contacts.every(c => !c)) {
      ys.push(p.height);
      groundYs.push(slope(0, z));
    }
  }
  const accs: number[] = [];
  for (let k = 1; k < ys.length - 1; k++) accs.push((ys[k + 1] - 2 * ys[k] + ys[k - 1]) / (dt * dt));
  const maxAccelErrMps2 = Math.max(...accs.map(a => Math.abs(a - (-g))));

  // Flat-ground airborne jumpFrame d2y/dt2 (air = 0..0.2 smoothstep impulse)
  const flatYs: number[] = [];
  const T = jumpSeconds();
  for (let t = 0; t <= T; t += dt) {
    const jf = jumpFrame({ t, kind: 'pounce' }, 0.55);
    if (jf.stage === 'flight') flatYs.push(jf.heightOff);
  }
  const flatAccs: number[] = [];
  for (let k = 1; k < flatYs.length - 1; k++) flatAccs.push((flatYs[k + 1] - 2 * flatYs[k] + flatYs[k - 1]) / (dt * dt));
  const flatAirImpulseMps2 = Math.max(...flatAccs.map(a => Math.abs(a - (-g))));

  const gameSrc = readFileSync(join(ROOT, 'src/animals/locomotion/game.ts'), 'utf8');
  const playSrc = readFileSync(join(ROOT, 'src/render/playables.ts'), 'utf8');
  const gameWaterMatchesLevel = !/Math\.max\(heightAt\(x,\s*z\),\s*-\.2\)/.test(gameSrc) && /LEVEL\.waterSurface|lakeAt|surfaceAt/.test(gameSrc);
  const locoMirrorsStore = !/if\s*\(LOCO_FLAG\)\s*return\s+createLocoPlayer\(\);/.test(playSrc);
  const locoPassesHold = /f\.hold|setHold/.test(gameSrc);

  const score = scoreCheck5({ maxAccelErrMps2, flatAirImpulseMps2, gameWaterMatchesLevel, locoMirrorsStore, locoPassesHold });
  const knownMatchScore = scoreCheck5({ maxAccelErrMps2: 0.0, flatAirImpulseMps2: 0.0, gameWaterMatchesLevel: true, locoMirrorsStore: true, locoPassesHold: true });
  const knownMismatchScore = scoreCheck5({ maxAccelErrMps2: 120.0, flatAirImpulseMps2: 60.0, gameWaterMatchesLevel: false, locoMirrorsStore: false, locoPassesHold: false });

  return {
    check: {
      id: 'jump-slope-ballistics-and-loco-game-wiring',
      label: 'Ballistic slope jump trajectory & ?loco=1 gameGround/store/hold wiring',
      measured: `20 deg uphill pounce: terrain-following rise +${(groundYs[groundYs.length - 1] - groundYs[0]).toFixed(2)} m mid-air, d2y/dt2=[${Math.min(...accs).toFixed(1)}, ${Math.max(...accs).toFixed(1)}] m/s^2 (max err ${maxAccelErrMps2.toFixed(1)} m/s^2 vs -${g.toFixed(2)}); flat-ground air=0..0.2 impulse err=${flatAirImpulseMps2.toFixed(1)} m/s^2; gameGround=-0.2 (vs LEVEL.waterSurface=${LEVEL.waterSurface}), mirrorStoredAnimal=${locoMirrorsStore}, f.hold=${locoPassesHold}`,
      expected: `Constant ballistic d2y/dt2 = -${g.toFixed(2)} m/s^2 (+-0.5 m/s^2) on slopes & flat ground; ?loco=1 uses unified water/terrain surface, mirrors living store, and wires f.hold`,
      score,
      knownMatchScore,
      knownMismatchScore,
      pass: score >= 0.95,
      source: 'Newtonian projectile mechanics (y(t)=y0+v0*t-0.5*g*t^2, g=9.8202 m/s^2); PROJECT-RULES rule 4; src/core/tuning.ts LEVEL.waterSurface=-0.25',
    } satisfies CheckResult,
    details: {
      slopeFlightFrames: ys.length,
      slopeMinAcc: Math.min(...accs),
      slopeMaxAcc: Math.max(...accs),
      maxAccelErrMps2,
      flatAirImpulseMps2,
      apexHeightM: apexHeight(),
      airSecondsS: airSeconds(),
      gameWaterMatchesLevel,
      locoMirrorsStore,
      locoPassesHold,
    },
  };
}

// --- Check 6: Hare side-slope roll=0 slip/leashes, 7 Hz trot wakes & subterranean resting tails ---
function scoreCheck6(m: {
  sideSlopeSlipMm: number;
  sideSlopeLeashes: number;
  wakeCadenceRatio: number;
  wakeUsesBoundOffsets: boolean;
  subterraneanTailFrac: number;
}) {
  const sSlope = clamp01(1 - m.sideSlopeSlipMm / 10 - 0.25 * m.sideSlopeLeashes);
  const sWake = (ratioScore(m.wakeCadenceRatio, 1.0) + (m.wakeUsesBoundOffsets ? 1 : 0)) / 2;
  const sTail = clamp01(1 - m.subterraneanTailFrac * 2.5);
  return Number(((sSlope + sWake + sTail) / 3).toFixed(4));
}

function runCheck6() {
  const sk = skeletonOf(HARE_PLAN);
  const sideSlope = (x: number, _z: number) => x * Math.tan(20 * Math.PI / 180);
  const rig = createBounding(sk, HARE_GAIT, sideSlope, { x: 0, z: 0, heading: 0 }, GIRDLE, HARE_RIG);
  let maxSlipMm = 0, maxFootGroundErrMm = 0, leashes = 0, maxRollDeg = 0;
  for (let i = 0; i < 240; i++) {
    const fr = rig.update(1 / 60, 5.0, 0, null);
    if (i > 90) {
      maxRollDeg = Math.max(maxRollDeg, Math.abs(fr.tilt.roll) * 180 / Math.PI);
      for (let l = 0; l < 4; l++) {
        maxSlipMm = Math.max(maxSlipMm, fr.slip[l] * 1000);
        if (fr.contact[l]) {
          const gy = sideSlope(fr.soles[l].x, fr.soles[l].z);
          maxFootGroundErrMm = Math.max(maxFootGroundErrMm, Math.abs(fr.soles[l].y - gy) * 1000);
        }
      }
      leashes = fr.leashes;
    }
  }

  const hareSrc = readFileSync(join(ROOT, 'src/animals/hare.ts'), 'utf8');
  const wakeHz = /hopHz\s*=\s*speed\s*>\s*3\s*\?\s*7\s*:\s*4/.test(hareSrc) ? 7.0 : boundCadence(HARE_GAIT, 5.0);
  const realHareHz = boundCadence(HARE_GAIT, 5.0);
  const wakeUsesBoundOffsets = !/offsets:\s*\[\s*0\.5,\s*0,\s*0\.5,\s*0\s*\]/.test(hareSrc);
  const poseHareAppliesRoll = /h\.body\.rotation\.z\s*=/.test(hareSrc);

  // Skeleton subterranean resting tail audit across all 54 mammals
  const subTails: { species: string; archetype: string; withers: number; minTailMm: number; pctWithers: number; validateFails: number }[] = [];
  for (const row of MAMMALS) {
    const msk = mammalSkeleton(row[0]);
    const tails = msk.bones.filter(b => b.role === 'tail');
    const minTailY = Math.min(...tails.map(b => Math.min(b.head[1], b.tail[1])));
    if (minTailY < -1e-4) {
      subTails.push({
        species: row[0],
        archetype: row[1],
        withers: row[2],
        minTailMm: Number((minTailY * 1000).toFixed(1)),
        pctWithers: Number(((minTailY / row[2]) * 100).toFixed(1)),
        validateFails: validateSkeleton(msk).length,
      });
    }
  }
  subTails.sort((a, b) => a.minTailMm - b.minTailMm);

  const score = scoreCheck6({
    sideSlopeSlipMm: maxSlipMm,
    sideSlopeLeashes: leashes,
    wakeCadenceRatio: wakeHz / realHareHz,
    wakeUsesBoundOffsets,
    subterraneanTailFrac: subTails.length / MAMMALS.length,
  });
  const knownMatchScore = scoreCheck6({
    sideSlopeSlipMm: 0.0,
    sideSlopeLeashes: 0,
    wakeCadenceRatio: 1.0,
    wakeUsesBoundOffsets: true,
    subterraneanTailFrac: 0.0,
  });
  const knownMismatchScore = scoreCheck6({
    sideSlopeSlipMm: 10.0,
    sideSlopeLeashes: 2,
    wakeCadenceRatio: 1.6,
    wakeUsesBoundOffsets: false,
    subterraneanTailFrac: 0.37,
  });

  return {
    check: {
      id: 'hare-sideslope-roll-wakes-and-skeleton-tails',
      label: 'Hare side-slope roll & wake cadence/offsets, and resting mammal tail ground clearance',
      measured: `20 deg side-slope: roll=${maxRollDeg.toFixed(1)} deg (poseHare roll=${poseHareAppliesRoll}), slip=${maxSlipMm.toFixed(1)} mm, footGroundErr=${maxFootGroundErrMm.toFixed(1)} mm, leashes=${leashes}; wake=${wakeHz.toFixed(2)} Hz vs HARE_GAIT ${realHareHz.toFixed(2)} Hz (+${(((wakeHz / realHareHz) - 1) * 100).toFixed(1)}%) with trot offsets=${!wakeUsesBoundOffsets}; ${subTails.length}/${MAMMALS.length} (${((subTails.length / MAMMALS.length) * 100).toFixed(1)}%) mammal resting tails below y=0 (worst: ${subTails[0]?.species} ${subTails[0]?.minTailMm} mm, all pass validateSkeleton=0)`,
      expected: `Terrain-matched roll on side-slopes (slip < 2 mm, 0 leashes); wakes follow HARE_GAIT cadence (4.40 Hz) & half-bound offsets; 0/${MAMMALS.length} mammal resting tails below y=0`,
      score,
      knownMatchScore,
      knownMismatchScore,
      pass: score >= 0.95,
      source: 'Hildebrand (1977) J. Mammal. 58:131 (Lepus half-bound); Bertram & Gutmann (2009); boundScore.ts REF.slip=10 mm / 0 leashes; skeleton.ts ground plane y >= 0',
    } satisfies CheckResult,
    details: {
      maxRollDeg,
      poseHareAppliesRoll,
      maxSlipMm,
      maxFootGroundErrMm,
      leashes,
      wakeHz,
      realHareHz,
      wakeUsesBoundOffsets,
      subterraneanTailCount: subTails.length,
      totalMammals: MAMMALS.length,
      worstTails: subTails.slice(0, 6),
    },
  };
}

// --- Live Chromium capture on tools/locomotion-lab.html & ?loco=1 ---
async function captureLive() {
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

  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const liveReadouts: Record<string, string> = {};
  let recordingBytes = 0;

  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await ctx.newPage();
    page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
    page.on('pageerror', e => pageErrors.push(String(e)));

    // 1. Frame 0 (clean side-profile stickRig galloping at 9 m/s paused at stance peak shift) + live recording.webm
    await page.goto(`${BASE}/tools/locomotion-lab.html?terrain=flat&gait=auto&speed=9&lod=near&rig=stick&cam=profile&t=1.34&pause=1`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => document.title === 'ready', { timeout: 30000 });
    await page.waitForTimeout(800);
    liveReadouts['frame-0'] = (await page.locator('#ro').textContent()) ?? '';
    await page.screenshot({ path: join(HERE, 'frame-0-loco-lab-stick-gallop-9mps.png') });

    // Unpause and record ~3.5 s of live WebGL gallop animation via MediaRecorder (vp8)
    await page.click('#pa');
    await page.evaluate(() => {
      const canvas = document.querySelector('canvas:not(#strip)') as HTMLCanvasElement | null;
      if (!canvas || typeof MediaRecorder === 'undefined') return;
      const stream = canvas.captureStream(15);
      const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp8') ? 'video/webm;codecs=vp8' : 'video/webm';
      const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 1_500_000 });
      const chunks: Blob[] = [];
      rec.ondataavailable = e => { if (e.data && e.data.size > 0) chunks.push(e.data); };
      rec.start(100);
      (window as unknown as Record<string, unknown>).__auditRec = { rec, chunks };
    });
    for (let k = 0; k < 20; k++) {
      await page.evaluate(async () => {
        for (let i = 0; i < 4; i++) await new Promise(r => requestAnimationFrame(r));
      });
      await page.waitForTimeout(100);
    }
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
      recordingBytes = raw.length;
    }

    // 2. Frame 1: mid LOD at 8 m/s showing sunken feet below the floor plane
    await page.goto(`${BASE}/tools/locomotion-lab.html?terrain=flat&gait=auto&speed=8&lod=mid&rig=real&cam=profile&t=1.42&pause=1`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => document.title === 'ready', { timeout: 30000 });
    await page.waitForTimeout(1800);
    liveReadouts['frame-1'] = (await page.locator('#ro').textContent()) ?? '';
    await page.screenshot({ path: join(HERE, 'frame-1-loco-lab-mid-lod-underground.png') });

    // 3. Frame 2: gait=gallop override at 10 m/s showing duty 0.30, 4.3+ Hz, no extended flight
    await page.goto(`${BASE}/tools/locomotion-lab.html?terrain=flat&gait=gallop&speed=10&lod=near&rig=real&cam=profile&t=1.6&pause=1`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => document.title === 'ready', { timeout: 30000 });
    await page.waitForTimeout(1800);
    liveReadouts['frame-2'] = (await page.locator('#ro').textContent()) ?? '';
    await page.screenshot({ path: join(HERE, 'frame-2-loco-lab-gallop-override-bug.png') });

    // 4. Frame 3: hills pounce at 7 m/s
    await page.goto(`${BASE}/tools/locomotion-lab.html?terrain=hills&gait=auto&speed=7&pounce=1&rig=real&cam=profile&t=1.38&pause=1`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => document.title === 'ready', { timeout: 30000 });
    await page.waitForTimeout(1800);
    liveReadouts['frame-3'] = (await page.locator('#ro').textContent()) ?? '';
    await page.screenshot({ path: join(HERE, 'frame-3-loco-lab-hills-pounce-slope.png') });

    // 5. Live main-game ?loco=1 smoke check
    await page.goto(`${BASE}/?view=ground&nomenu=1&loco=1&noprobe=1&hour=13&day=195`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(4000);
    const locoCanvas = await page.evaluate(() => {
      const c = document.querySelector('canvas');
      return c ? { width: c.width, height: c.height } : null;
    });

    await ctx.close();
    return { consoleErrors, pageErrors, liveReadouts, locoCanvas, recordingBytes };
  } finally {
    await browser.close();
  }
}

async function main() {
  const c1 = runCheck1();
  const c2 = runCheck2();
  const c3 = runCheck3();
  const c4 = runCheck4();
  const c5 = runCheck5();
  const c6 = runCheck6();
  const checks = [c1.check, c2.check, c3.check, c4.check, c5.check, c6.check];

  const live = await captureLive();

  const calibrationValid = checks.every(c => c.knownMatchScore >= 0.99 && c.knownMismatchScore <= 0.20);
  const meanScore = Number((checks.reduce((s, c) => s + c.score, 0) / checks.length).toFixed(4));
  const passed = checks.filter(c => c.pass).length;

  const out = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE,
    calibrationValid,
    passed,
    total: checks.length,
    meanScore,
    checks,
    details: {
      check1: c1.details,
      check2: c2.details,
      check3: c3.details,
      check4: c4.details,
      check5: c5.details,
      check6: c6.details,
    },
    live,
  };

  writeFileSync(join(HERE, 'numbers.json'), JSON.stringify(out, null, 2) + '\n', 'utf8');
  console.log(`Audit complete: ${passed}/${checks.length} pass >= 0.95, meanScore=${meanScore}, calibrationValid=${calibrationValid}, consoleErrors=${live.consoleErrors.length}, pageErrors=${live.pageErrors.length}`);
  for (const c of checks) {
    console.log(`  [${c.pass ? 'PASS' : 'FAIL'}] ${c.id}: score=${c.score.toFixed(4)} (match=${c.knownMatchScore.toFixed(2)}, mismatch=${c.knownMismatchScore.toFixed(2)})`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
