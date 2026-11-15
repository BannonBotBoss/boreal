/**
 * Calibrated Rule 11 numeric audit for T-0239:
 * Physics, procedural mass allometry, player-animal solid contact, snout rock-push mechanics, and human visitor anatomy/posture.
 *
 * Published & Project Sources:
 * 1. Fuller, T. K. (1990), "Dynamics of a declining white-tailed deer population in north-central Minnesota",
 *    Wildlife Monographs 110:1-37; Ditchkoff, S. S. (2011), Biology and Management of White-tailed Deer, CRC Press;
 *    Nowak, R. M. (1999), Walker's Mammals of the World (6th ed.):
 *    - Boreal/Laurentian adult Odocoileus virginianus body mass: 65-95 kg (~75.0 kg mean), shoulder height ~0.98 m (0.90-1.05 m).
 * 2. Kolenosky, G. B. & Standfield, R. O. (1975), in The Wild Canids, Van Nostrand Reinhold; Mech, L. D. & Boitani, L. (2003),
 *    Wolves: Behavior, Ecology, and Conservation, Univ. of Chicago Press; Krebs, C. J. et al. (2001), Ecosystem Dynamics of the
 *    Boreal Forest: The Kluane Project, Oxford Univ. Press:
 *    - NW Ontario adult Canis lupus mean mass ~38.0 kg (32-44 kg); adult Lepus americanus mean mass ~1.45 kg (1.35-1.55 kg).
 * 3. Hall, I. V., Aalders, L. E., Nickerson, N. L. & Vander Kloet, S. P. (1979), "The biological flora of Canada. 1. Vaccinium
 *    angustifolium Ait., sweet lowbush blueberry", Canadian Field-Naturalist 93(4):415-430; Harmon, M. E. et al. (1986),
 *    "Ecology of coarse woody debris in temperate ecosystems", Advances in Ecological Research 15:133-302:
 *    - Lowbush blueberry clone patch (r = 0.38 m, area = 0.45 m^2) fresh above-ground shoot biomass ~0.35 kg (never 130.38 kg);
 *    - Boreal Class 5 decayed log wood bulk density falls from ~512 kg/m^3 (fresh) to ~108 kg/m^3 dry (~162 kg/m^3 moist;
 *      matching LOG_FLOOR_BULK = 108 in src/core/logDecay.ts).
 * 4. Williams, S. B. et al. (2009), "Pitch then power: limitations to acceleration in quadrupeds", Biology Letters 5(5):610-613;
 *    Wilson, A. M. et al. (2013), "Locomotion dynamics of hunting in wild cheetahs", Nature 498:185-189:
 *    - Cursorial mammal horizontal ground acceleration is bounded by Coulomb paw-soil traction (mu_s * g ~= 7.86 m/s^2 on forest
 *      loam/duff) and pitching moment (~6.5 m/s^2 canids, ~10.0 m/s^2 leporids, <= 13.0 m/s^2 cheetah peak; never 30.0 m/s^2 =
 *      3.06 g wolf or 78.2 m/s^2 = 7.97 g hare);
 *    - Two-body solid impact conserves total horizontal linear momentum p = m1*v1 + m2*v2 (|Delta p| = 0, applying recoil v1' to
 *      both bodies and separating overlap).
 * 5. Wentworth, C. K. (1922), J. Geol. 30:377-392; Carson, M. A. (1977), "Angles of repose, angles of shearing resistance and
 *    angles of talus slopes", Earth Surface Processes 2(4):363-380:
 *    - Wolf snout nudging moves loose small pebbles/cobbles (~<= 2.5 kg, d <= 0.13 m) against Coulomb friction F = mu * m * g,
 *      blocked by trunks/boulders/waterlines and settling downslope above cobble angle of repose (~35 deg).
 * 6. ICRP Publication 23 (1975), Report of the Task Group on Reference Man, Pergamon Press; Drillis, R. & Contini, R. (1966),
 *    Body Segment Parameters, Tech. Rep. 1166.03; Perry, J. & Burnfield, J. M. (2010), Gait Analysis (2nd ed.); Bohannon, R. W.
 *    (1997), Age and Ageing 26:15-19:
 *    - Reference adult stature ~1.75 m, body mass ~70.0 kg (matching PERSON_REFERENCE_KG = 70 in src/core/visitors.ts:20),
 *      cranial height / stature ~= 1 / 7.5 = 0.1333, hip stride excursion ~0.70 rad (~40 deg) at 1.393 m/s walk, and 0.00 m
 *      sub-terrain leg burial when seated on ground.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';

import { gravity, accelLimit, collide } from '../../../src/proc/physics.ts';
import { PHYS } from '../../../src/core/tuning.ts';
import { COMPOSITIONS, density } from '../../../src/core/materials.ts';
import { rigMass, entityMass } from '../../../src/render/mass.ts';
import { createDeerRig } from '../../../src/render/animalRig.ts';
import { createPlayerWolf } from '../../../src/render/playerWolf.ts';
import { createHareModel } from '../../../src/animals/hare.ts';
import { createBear } from '../../../src/render/bear.ts';
import { TRUNK_DENSITY } from '../../../src/core/settle.ts';
import { LOG_FLOOR_BULK } from '../../../src/core/logDecay.ts';
import { rockDiameter, PUSH_DISTANCE, SNOUT_REACH } from '../../../src/core/rocks.ts';
import { createContext, interact } from '../../../src/core/events.ts';
import { STAGES } from '../../../src/core/stages/elevation.ts';
import { isDry } from '../../../src/core/stages/surfaceAt.ts';
import { generateGeometry } from '../../../src/render/geometry.ts';
import { PERSON_REFERENCE_KG, PERSON_SIT_M, visitorSitDrop } from '../../../src/core/visitors.ts';
import { PERSON_WALK_MPS } from '../../../src/core/species.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
mkdirSync(__dirname, { recursive: true });

STAGES.on = true;

const obsPath = resolve(__dirname, 'observations.json');
const runtime = existsSync(obsPath) ? JSON.parse(readFileSync(obsPath, 'utf8')) : null;
const buildSceneSrc = readFileSync(resolve(__dirname, '../../../src/render/buildScene.ts'), 'utf8');
const worldSrc = readFileSync(resolve(__dirname, '../../../src/core/world.ts'), 'utf8');
const eventsSrc = readFileSync(resolve(__dirname, '../../../src/core/events.ts'), 'utf8');

/**
 * Rule 11 Metric & Calibration:
 * - ratioScore(a, b) = min(a, b) / max(a, b) for positive physical/allometric quantities
 * - unitScore(measured, target, fullScale) = max(0, 1 - |measured - target| / fullScale) when target = 0 or bounded fraction
 * Pass threshold: >= 0.95 (unrounded).
 */
const ratioScore = (a, b) => {
  if (a <= 0 || b <= 0) return a === b ? 1 : 0;
  return Math.min(a, b) / Math.max(a, b);
};
const unitScore = (measured, target, fullScale) =>
  Math.max(0, 1 - Math.abs(measured - target) / Math.max(1e-9, fullScale));

// --- Calibration checks (Rule 11: >= 2 known matches >= 0.95 and >= 2 known mismatches < 0.30) ---
const gMeasured = gravity(0); // 9.81997 m/s^2
const graniteDensity = density(COMPOSITIONS.rock.granite); // 2619 kg/m^3
const walkSpeed = PERSON_WALK_MPS; // 1.393 m/s

// --- Direct deterministic measurements from Boreal generators & runtime ---
const deerRig = createDeerRig(1400, 0);
deerRig.root.updateMatrixWorld(true);
const deerBox = new THREE.Box3().setFromObject(deerRig.root);
const deerSize = new THREE.Vector3();
deerBox.getSize(deerSize);
const deerMass1Kg = rigMass(deerRig.root, 'cervid'); // 515.35 kg at scale=1.0
const deerMeanWildScale = (0.75 + 1.40) / 2; // world.ts:80 0.75 + rng() * 0.65 -> 1.075
const deerMeanWildMassKg = deerMass1Kg * deerMeanWildScale ** 3; // ~640.3 kg

const wolfRig = createPlayerWolf();
const wolfMassKg = rigMass(wolfRig.root, 'canid'); // 72.38 kg
const hareRig = createHareModel();
const hareMassKg = rigMass(hareRig.root, 'leporid'); // 4.09 kg
const bearRig = createBear(1400);
const bearMassKg = rigMass(bearRig.root, 'ursid'); // 458.23 kg

const forageMassKg = entityMass({ key: 'f', kind: 'forage', x: 0, z: 0, seed: 1, generatorVersion: 1, rotation: 0, scale: 1 });
const plantMassKg = entityMass({ key: 'p', kind: 'plant', x: 0, z: 0, seed: 1, generatorVersion: 1, rotation: 0, scale: 1 });
const logMassScale1Kg = entityMass({ key: 'l', kind: 'log', x: 0, z: 0, seed: 1, generatorVersion: 1, rotation: 0, scale: 1 });

// Ground acceleration limits (tuning.ts PHYS.wolfAccel = 30, proc/physics.ts accelLimit)
const wolfGroundAccelMps2 = accelLimit(wolfMassKg, wolfMassKg); // 30.00 m/s^2
const hareGroundAccelMps2 = accelLimit(hareMassKg, wolfMassKg); // 78.20 m/s^2

// Two-body player-animal collision momentum check (buildScene.ts:321 `[,vd2]=collide(mp,vp,md,vd)`)
const discardsPlayerRecoil = /\[\s*,\s*vd2\s*\]\s*=\s*collide\(/.test(buildSceneSrc);
const [vpExpectedAfter, vdAfter] = collide(wolfMassKg, 6.0, deerMass1Kg, 0.0);
const vpActualAfter = discardsPlayerRecoil ? 6.0 : vpExpectedAfter;
const pBefore = wolfMassKg * 6.0;
const pAfter = wolfMassKg * vpActualAfter + deerMass1Kg * vdAfter;
const momentumViolationRatio = Math.abs(pAfter - pBefore) / pBefore; // +1.137 (+494.0 N*s spurious momentum gain!)

// Snout rock push mechanics (rocks.ts:77-92, events.ts:68-73)
let maxPushableCobbleKg = 0;
let maxPushSeed = 1;
for (let i = 1; i <= 500; i++) {
  const rEnt = { key: 'r', kind: 'rock', x: 0, z: 0, seed: i * 99991, generatorVersion: 1, rotation: 0, scale: 1 };
  if (rockDiameter(rEnt) <= 0.22) {
    const m = entityMass(rEnt);
    if (m > maxPushableCobbleKg) {
      maxPushableCobbleKg = m;
      maxPushSeed = rEnt.seed;
    }
  }
}
// Shoreline wet push test near dryStart(0,0) = [30, 0]
let shoreDryX = 30;
for (let x = 30; x >= -5; x -= 0.1) {
  if (!isDry(x, 0)) {
    shoreDryX = +(x + 0.1).toFixed(2);
    break;
  }
}
const shoreRock = { key: 'test:shore', kind: 'rock', x: shoreDryX, z: 0, seed: maxPushSeed, generatorVersion: 1, rotation: 0, scale: 1 };
const ctxAfterPush = interact(
  createContext(),
  { x: shoreRock.x + SNOUT_REACH, z: 0, heading: Math.PI / 2, abilities: ['move'] },
  shoreRock,
  'move'
);
const pushedIntoWater = !isDry(ctxAfterPush.records['test:shore'].entity.x, ctxAfterPush.records['test:shore'].entity.z);
const checksDryOrSlopeInMove = eventsSrc.includes('isDry') || eventsSrc.includes('slope');

// Human visitor ('person') anatomy, posture & biome/water gating
const person1 = { key: 'p1', kind: 'person', x: 0, z: 0, seed: 1, generatorVersion: 1, rotation: 0, scale: 1 };
const personMesh1 = generateGeometry(person1, 0);
personMesh1.updateMatrixWorld(true);
const personBox1 = new THREE.Box3().setFromObject(personMesh1);
const personSize1 = new THREE.Vector3();
personBox1.getSize(personSize1);
const personScale1HeightM = personSize1.y; // 2.28 m
const personMeanWildHeightM = personScale1HeightM * deerMeanWildScale; // 2.451 m
const personScale1MassKg = entityMass(person1); // 422.83 kg
const personMeanWildMassKg = personScale1MassKg * deerMeanWildScale ** 3; // 525.3 kg
const personHeadHeightM = 0.60; // sphere r=0.25 scaled y*1.2 -> 0.60 m tall
const personHeadStatureRatio = personHeadHeightM / personScale1HeightM; // 0.2632 vs 0.1333 (1:7.5)
const personWalkingLegExcursionRad = 0.0; // welded static cylinder legs in geometry.ts:165-169 & buildScene.ts:491-497
const personRestBurialDepthM = visitorSitDrop('rest', deerMeanWildScale); // 0.4838 m underground!
const personGatedByTreelineOrCover = /kind\s*===\s*'person'/.test(worldSrc.slice(worldSrc.indexOf('generateChunk')));
const visitorUsesLegacyDeerWater = buildSceneSrc.includes('h >= LEVEL.deerWater');

const calibration = {
  metric: 'ratioScore(a,b) = min(a,b)/max(a,b) for positive physical/allometric quantities; unitScore(m,t,scale) = max(0, 1 - |m-t|/scale) for zero-target conservation/burial invariants; pass >= 0.95',
  knownMatches: [
    {
      name: 'Surface gravitational acceleration gravity(0) vs standard boreal surface gravity (~49 deg N)',
      measured: +gMeasured.toFixed(5),
      reference: 9.81,
      unit: 'm/s^2',
      source: 'WGS84 / Somigliana normal gravity at 49 deg N (9.810 m/s^2)',
      score: ratioScore(gMeasured, 9.81),
    },
    {
      name: 'Canadian Shield granite mineral density vs Klein & Dutrow (2007)',
      measured: graniteDensity,
      reference: 2630,
      unit: 'kg/m^3',
      source: 'Klein & Dutrow (2007), Manual of Mineral Science (23rd ed.): granite 2,630 kg/m^3',
      score: ratioScore(graniteDensity, 2630),
    },
    {
      name: 'Adult comfortable walking speed PERSON_WALK_MPS vs Bohannon (1997)',
      measured: walkSpeed,
      reference: 1.393,
      unit: 'm/s',
      source: 'Bohannon (1997), Age and Ageing 26:15-19: 1.393 m/s',
      score: ratioScore(walkSpeed, 1.393),
    },
  ],
  knownMismatches: [
    {
      name: 'Voxel-column White-tailed Deer rigMass (515.35 kg at scale=1) vs adult O. virginianus (75 kg)',
      measured: +deerMass1Kg.toFixed(2),
      reference: 75.0,
      unit: 'kg',
      score: ratioScore(deerMass1Kg, 75.0),
    },
    {
      name: 'Pre-T-0027 7-ellipsoid lowbush blueberry entityMass (130.38 kg) vs published shoot biomass (0.35 kg)',
      measured: +forageMassKg.toFixed(2),
      reference: 0.35,
      unit: 'kg',
      score: ratioScore(forageMassKg, 0.35),
    },
  ],
};

const checks = [
  {
    id: 'deer_allometric_body_mass',
    label: 'Adult White-tailed Deer procedural rigMass (scale=1.0: 515.35 kg; wild mean: 640.3 kg, 1:0:15 = 1,303.2 kg)',
    measured: +deerMass1Kg.toFixed(2),
    expected: '65-95 kg (75.0 kg mean adult boreal Odocoileus virginianus)',
    referenceValue: 75.0,
    unit: 'kg',
    source: 'Fuller (1990), Wildl. Monogr. 110:1-37; Ditchkoff (2011), Biology and Management of White-tailed Deer',
    score: ratioScore(deerMass1Kg, 75.0),
    pass: ratioScore(deerMass1Kg, 75.0) >= 0.95,
  },
  {
    id: 'deer_antler_and_stature_height',
    label: 'White-tailed Deer rig total height (scale=1.0: 3.25 m antler top / 1.95 m back; wild 1:0:15 = 4.43 m)',
    measured: +deerSize.y.toFixed(3),
    expected: '0.90-1.05 m shoulder height (~1.35 m antler top on mature buck)',
    referenceValue: 1.35,
    unit: 'm',
    source: 'Nowak (1999), Walker\'s Mammals of the World (6th ed.); Sauer (1984)',
    score: ratioScore(deerSize.y, 1.35),
    pass: ratioScore(deerSize.y, 1.35) >= 0.95,
  },
  {
    id: 'wolf_hare_bear_rig_masses',
    label: 'Wolf (72.38 kg vs 38 kg) & Snowshoe Hare (4.09 kg vs 1.45 kg) procedural rigMass mean accuracy',
    measured: { wolfKg: +wolfMassKg.toFixed(2), hareKg: +hareMassKg.toFixed(2), bearKg: +bearMassKg.toFixed(2) },
    expected: 'Wolf 32-44 kg (38.0 kg mean); Hare 1.35-1.55 kg (1.45 kg mean)',
    referenceValue: { wolfKg: 38.0, hareKg: 1.45 },
    unit: 'kg',
    source: 'Kolenosky & Standfield (1975); Mech & Boitani (2003); Krebs et al. (2001, Kluane Project)',
    score: (ratioScore(wolfMassKg, 38.0) + ratioScore(hareMassKg, 1.45)) / 2,
    pass: (ratioScore(wolfMassKg, 38.0) + ratioScore(hareMassKg, 1.45)) / 2 >= 0.95,
  },
  {
    id: 'understory_forage_and_herb_mass',
    label: 'Lowbush blueberry (forage) & bunchberry/lily (plant) entityMass (130.38 kg 7-ellipsoid wood blob)',
    measured: +forageMassKg.toFixed(2),
    expected: '~0.35 kg fresh shoot biomass for r=0.38 m lowbush blueberry clone (~0.015 kg for herb clump)',
    referenceValue: 0.35,
    unit: 'kg',
    source: 'Hall et al. (1979), Can. Field-Nat. 93(4):415-430 (Vaccinium angustifolium)',
    score: ratioScore(forageMassKg, 0.35),
    pass: ratioScore(forageMassKg, 0.35) >= 0.95,
  },
  {
    id: 'decayed_log_bulk_density_coupling',
    label: 'Class 5 decayed fallen log (100 yr) density in entityMass & settleTrunk (fixed 511.8 kg/m^3)',
    measured: +TRUNK_DENSITY.toFixed(2),
    expected: '~108 kg/m^3 dry (~162 kg/m^3 moist) Class 5 CWD bulk density from logDecay.ts arenaOf()',
    referenceValue: LOG_FLOOR_BULK * 1.5, // ~162 kg/m^3 moist Class 5 wood
    unit: 'kg/m^3',
    source: 'Harmon et al. (1986), Adv. Ecol. Res. 15:133-302; Seedre et al. (2013); src/core/logDecay.ts LOG_FLOOR_BULK',
    score: ratioScore(TRUNK_DENSITY, LOG_FLOOR_BULK * 1.5),
    pass: ratioScore(TRUNK_DENSITY, LOG_FLOOR_BULK * 1.5) >= 0.95,
  },
  {
    id: 'terrestrial_traction_accel_cap',
    label: 'Embodied horizontal ground acceleration (Wolf 30.00 m/s^2 = 3.06 g; Hare 78.20 m/s^2 = 7.97 g)',
    measured: { wolfMps2: +wolfGroundAccelMps2.toFixed(2), hareMps2: +hareGroundAccelMps2.toFixed(2) },
    expected: 'Wolf ~6.5 m/s^2, Hare ~10.0 m/s^2 (bounded by soil traction mu_s*g ~= 7.86-10 m/s^2, <= 13 m/s^2 cheetah)',
    referenceValue: { wolfMps2: 6.5, hareMps2: 10.0 },
    unit: 'm/s^2',
    source: 'Williams et al. (2009), Biol. Lett. 5:610-613; Wilson et al. (2013), Nature 498:185-189; HARE_AGENT.speed.accel',
    score: (ratioScore(wolfGroundAccelMps2, 6.5) + ratioScore(hareGroundAccelMps2, 10.0)) / 2,
    pass: (ratioScore(wolfGroundAccelMps2, 6.5) + ratioScore(hareGroundAccelMps2, 10.0)) / 2 >= 0.95,
  },
  {
    id: 'solid_collision_momentum_conservation',
    label: 'Player-animal collision momentum conservation & recoil (buildScene.ts:322 discards player recoil v1\')',
    measured: +momentumViolationRatio.toFixed(4),
    expected: '0.0000 fractional momentum violation (both bodies recoil, overlap separated, CONTACTS published)',
    referenceValue: 0,
    unit: '|Delta p| / p0',
    source: 'Newtonian conservation of linear momentum (m1*v1 + m2*v2 = m1*v1\' + m2*v2\')',
    score: discardsPlayerRecoil ? 0 : unitScore(momentumViolationRatio, 0, 0.2),
    pass: !discardsPlayerRecoil && unitScore(momentumViolationRatio, 0, 0.2) >= 0.95,
  },
  {
    id: 'snout_rock_push_mass_and_friction',
    label: 'Max snout-pushable cobble mass (13.38 kg basalt cobble moved 0.22 m with zero friction/mass scaling)',
    measured: +maxPushableCobbleKg.toFixed(2),
    expected: '<= 2.50 kg loose surface pebble/cobble (push displacement scaled by 1/(mu*m*g) & soil embedment)',
    referenceValue: 2.5,
    unit: 'kg',
    source: 'Wentworth (1922), J. Geol. 30:377; Coulomb sliding resistance on forest duff/till (mu_s ~= 0.65)',
    score: ratioScore(maxPushableCobbleKg, 2.5),
    pass: ratioScore(maxPushableCobbleKg, 2.5) >= 0.95,
  },
  {
    id: 'rock_push_water_obstacle_and_repose_gate',
    label: 'Snout rock-push waterline, trunk obstacle & steep-slope angle-of-repose (~35 deg) enforcement',
    measured: pushedIntoWater && !checksDryOrSlopeInMove ? 0 : 1,
    expected: '1.0000 (stones blocked by trunks/boulders, settle downslope > 35 deg, and never hover/stay dry-pushed underwater)',
    referenceValue: 1,
    unit: 'compliance fraction',
    source: 'Carson (1977), Earth Surf. Process. 2(4):363-380 (cobble angle of repose 32-38 deg)',
    score: pushedIntoWater && !checksDryOrSlopeInMove ? 0 : 1,
    pass: !pushedIntoWater && checksDryOrSlopeInMove,
  },
  {
    id: 'visitor_human_stature_and_mass',
    label: 'Human Visitor (person) mean wild stature (2.45 m) & entityMass (525.3 kg; 4:0:15 = 2.69 m / 690.65 kg)',
    measured: { meanHeightM: +personMeanWildHeightM.toFixed(3), meanMassKg: +personMeanWildMassKg.toFixed(2) },
    expected: '1.75 m mean adult stature, 70.0 kg mean body mass (matching PERSON_REFERENCE_KG = 70 in visitors.ts:20)',
    referenceValue: { heightM: 1.75, massKg: PERSON_REFERENCE_KG },
    unit: 'm / kg',
    source: 'ICRP Publication 23 (1975), Reference Man (1.75 m, 70 kg); Drillis & Contini (1966)',
    score: (ratioScore(personMeanWildHeightM, 1.75) + ratioScore(personMeanWildMassKg, PERSON_REFERENCE_KG)) / 2,
    pass: (ratioScore(personMeanWildHeightM, 1.75) + ratioScore(personMeanWildMassKg, PERSON_REFERENCE_KG)) / 2 >= 0.95,
  },
  {
    id: 'visitor_cranial_ratio_and_walking_stride',
    label: 'Visitor cranial-to-stature ratio (0.263 = 1:3.8 sphere head) & walking leg swing (0.00 rad welded cylinders)',
    measured: { headToStature: +personHeadStatureRatio.toFixed(4), legExcursionRad: personWalkingLegExcursionRad },
    expected: 'Head/stature ~= 0.1333 (1:7.5) and ~0.70 rad (~40 deg) hip stride excursion at 1.393 m/s walk',
    referenceValue: { headToStature: 1 / 7.5, legExcursionRad: 0.70 },
    unit: 'ratio / rad',
    source: 'Drillis & Contini (1966), Body Segment Parameters; Perry & Burnfield (2010), Gait Analysis (2nd ed.)',
    score: (ratioScore(personHeadStatureRatio, 1 / 7.5) + ratioScore(personWalkingLegExcursionRad, 0.70)) / 2,
    pass: (ratioScore(personHeadStatureRatio, 1 / 7.5) + ratioScore(personWalkingLegExcursionRad, 0.70)) / 2 >= 0.95,
  },
  {
    id: 'visitor_seated_ground_clearance_and_biome_gating',
    label: 'Visitor seated leg burial (-0.48 m mean, -0.53 m on 4:0:15) & biome/staged-water gating',
    measured: {
      meanLegBurialM: +personRestBurialDepthM.toFixed(3),
      treelineBiomeGated: personGatedByTreelineOrCover,
      usesLegacyDeerWater: visitorUsesLegacyDeerWater,
    },
    expected: '0.00 m sub-terrain leg burial (articulated hip/knee sit above ground), treeline/biome cover gate, and staged isDry water check',
    referenceValue: 0,
    unit: 'm underground',
    source: 'Drillis & Contini (1966) seated anthropometry; staged hydrology surfaceAt.ts isDry()',
    score: unitScore(personRestBurialDepthM, 0, PERSON_SIT_M) * (personGatedByTreelineOrCover && !visitorUsesLegacyDeerWater ? 1 : 0),
    pass: personRestBurialDepthM === 0 && personGatedByTreelineOrCover && !visitorUsesLegacyDeerWater,
  },
];

const meanScore = checks.reduce((s, c) => s + c.score, 0) / checks.length;
const passedCount = checks.filter((c) => c.pass).length;

const output = {
  generatedAt: new Date().toISOString(),
  task: 'T-0239',
  runtimeObservationsLoaded: Boolean(runtime),
  calibration,
  summary: {
    totalChecks: checks.length,
    passedChecks: passedCount,
    failedChecks: checks.length - passedCount,
    meanScore: +meanScore.toFixed(4),
    passThreshold: 0.95,
    overallPass: passedCount === checks.length && meanScore >= 0.95,
  },
  checks,
};

writeFileSync(resolve(__dirname, 'numbers.json'), JSON.stringify(output, null, 2) + '\n');
console.log(
  `Numeric audit complete: ${passedCount}/${checks.length} passed, meanScore=${output.summary.meanScore}, runtimeLoaded=${output.runtimeObservationsLoaded}`
);
