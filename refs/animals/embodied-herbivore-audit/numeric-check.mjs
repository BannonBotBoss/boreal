/**
 * Calibrated numeric audit for T-0229:
 * 1. Embodied herbivore manual food intake (?play=hare, ?play=deer): clover/browse/plant/berry intake = 0.00 kJ (0.00% Energy)
 *    vs HARE_NEEDS clover bite energetics (Belovsky 1984; Sinclair et al. 1982) and white-tailed deer browse intake (Robbins 1993).
 * 2. White-tailed deer missing DEER_NEEDS template in NEEDS_SPECIES (falling back to 40 kg carnivore WOLF_NEEDS):
 *    mass, FMR, water turnover, walk/run/sprint speeds, stamina, and visual field vs Nagy et al. (1999), Worden & Pekins (1995),
 *    Nagy & Peterson (1988), Lautier et al. (1988), Heglund & Taylor (1988), Rue (1997), and D'Angelo et al. (2008).
 * 3. Senses HUD scent-trace radius (ui/senses.ts hardcoded WOLF_AGENT 2,400 m on all embodied species vs DEER_AGENT 2.0 m,
 *    van Ginkel et al. 2019) and missing 'head-sensor' name on playable hare rig (render/playables.ts).
 * 4. Carnivore-only hunting, meat-drumstick hunger thought-bubble glyph, wolf vocalizations (howl/growl/whine/pant),
 *    and WOLF_AGENT autonomy ungated on embodied herbivores.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NEEDS_SPECIES, WOLF_NEEDS, HARE_NEEDS } from '../../../src/core/needs/species/index.ts';
import { dietOf } from '../../../src/core/needs/diet.ts';
import { ICON } from '../../../src/core/needs/thoughts.ts';
import { playerSpeed } from '../../../src/core/playerTuning.ts';
import { PLAYABLES } from '../../../src/render/playables.ts';
import { DEER_AGENT, WOLF_AGENT, MAMMAL_PLANS } from '../../../src/core/species.ts';
import { createContext, availableActions, interact } from '../../../src/core/events.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
mkdirSync(__dirname, { recursive: true });

/**
 * Metric calibration (Rule 11):
 * ratioScore(actual, expected) = max(0, 1 - |actual - expected| / max(1e-6, |expected|))
 * Pass gate: >= 0.95 without rounding.
 */
const ratioScore = (actual, expected) =>
  Math.max(0, 1 - Math.abs(actual - expected) / Math.max(1e-6, Math.abs(expected)));

// Calibration check (known match vs known mismatch)
const calKnownMatchMassScore = ratioScore(HARE_NEEDS.body.massKg.v, 1.5); // 1.0000 (>= 0.95 pass)
const calKnownMatchFovScore = ratioScore(HARE_NEEDS.senses.sight.fovDeg.v, 360); // 1.0000 (>= 0.95 pass)
const calKnownMismatchMassScore = ratioScore(WOLF_NEEDS.body.massKg.v, 70.0); // 0.5714 (< 0.70 fail)
const calKnownMismatchZeroIntakeScore = ratioScore(0, 0.408); // 0.0000 (< 0.70 fail)

// 1. Embodied hare & deer manual feeding energy transfer:
// In main.ts perform():
// - Clover patches & browseGrams are fields, not catalog entities -> target = undefined -> 0 bites, +0.00% Energy.
// - Pressing E on a 'plant' calls events.ts interact(..., 'gather'), which only increments context.inventory.herb++ -> +0.00% Energy.
// - 'forage' (berry patch) is blocked in main.ts:175,178 (`action === 'forage'`) and omitted from Playable.actions -> +0.00% Energy.
const ctx0 = createContext();
const harePlayable = PLAYABLES.find((p) => p.id === 'hare');
const deerPlayable = PLAYABLES.find((p) => p.id === 'deer');
const harePlayer = { x: 0, z: 0, heading: 0, abilities: [...harePlayable.actions] };
const deerPlayer = { x: 0, z: 0, heading: 0, abilities: [...deerPlayable.actions] };
const plantTarget = { key: 'plant:test', kind: 'plant', x: 0.4, z: 0.4 };
const berryTarget = { key: 'forage:test', kind: 'forage', x: 0.4, z: 0.4 };

const hareActionsOnPlant = availableActions(harePlayer, plantTarget, ctx0); // ['gather']
const hareActionsOnBerry = availableActions(harePlayer, berryTarget, ctx0); // []
const deerActionsOnPlant = availableActions(deerPlayer, plantTarget, ctx0); // []
const deerActionsOnBerry = availableActions(deerPlayer, berryTarget, ctx0); // []
const ctxAfterHareGather = interact(ctx0, harePlayer, plantTarget, 'gather'); // only inventory.herb = 1, zero dietOf().eat()!

const hareExpectedCloverMeal = dietOf(HARE_NEEDS).eat(HARE_NEEDS, { water: 50, rest: 80 }, 50, 'clover').meal;
const cloverFood = HARE_NEEDS.diet.foods.clover;
const hareExpectedCloverBiteKj = cloverFood.biteKg.v * cloverFood.kJPerKg.v * cloverFood.assimilation.v;
const hareManualFoodEnergyGainPct = 0; // perform() never calls dietOf().eat()
const hareManualFeedingScore = ratioScore(hareManualFoodEnergyGainPct, hareExpectedCloverMeal.energy);

// 2. White-tailed deer template lookup in NEEDS_SPECIES:
// NEEDS_SPECIES only registers { wolf, hare }, so ?play=deer resolves to WOLF_NEEDS (40 kg carnivore)!
const deerGameTemplate = NEEDS_SPECIES['deer'] ?? WOLF_NEEDS;
const deerRefMassKg = MAMMAL_PLANS.cervid.massKg; // 70 kg (MAMMAL_PLANS.cervid / MAMMALS['White-tailed Deer'], Fuller 1990 / Nowak 1999)
// Nagy, Girard & Brown (1999, Annu. Rev. Nutr. 19:247, Table 2 eq. 2 eutherians: FMR = 4.21 * g^0.772 kJ/d; herbivore eq. 8 similar;
// Worden & Pekins 1995 Can. J. Zool. 73:452 adult white-tailed deer FMR ~21-24 MJ/d):
const deerRefFmrKjPerDay = 4.21 * (deerRefMassKg * 1000) ** 0.772; // 23,149.1 kJ/d
// Nagy & Peterson (1988, UC Publ Zool 120: eutherian water flux = 0.326 * g^0.818 mL/d; Lautier et al. 1988 JWM 52:602):
const deerRefWaterMlPerDay = 0.326 * (deerRefMassKg * 1000) ** 0.818; // 2,998.9 mL/d
// Speeds: DEER_AGENT.speed.approach = 1.3 m/s; Heglund & Taylor (1988 JEB 138:301) preferred gallop = 2.78 * M^0.116 = 4.551 m/s;
// sprint: DEER_AGENT.speed.flee = 15.65 m/s (35 mph, Rue 1997) or game-scaled cervid sprint:
const deerGameWalkMps = playerSpeed('walk', deerGameTemplate) * deerPlayable.speedScale; // 2.0 * 1.15 = 2.30 m/s
const deerGameRunMps = playerSpeed('run', deerGameTemplate) * deerPlayable.speedScale; // 4.0 * 1.5 * 1.15 = 6.90 m/s
const deerGameSprintMps = playerSpeed('sprint', deerGameTemplate) * deerPlayable.speedScale; // 7.0 * 1.5 * 1.15 = 12.075 m/s
const deerRefWalkMps = DEER_AGENT.speed.approach; // 1.30 m/s
const deerRefRunMps = 2.78 * deerRefMassKg ** 0.116; // 4.551 m/s (Heglund & Taylor 1988)
const deerRefSprintMps = DEER_AGENT.speed.flee; // 15.65 m/s (Rue 1997, 35 mph)
const deerGameSprintSeconds = deerGameTemplate.stamina.sprintSeconds.v; // 12 s (WOLF_NEEDS)
const deerRefSprintSeconds = DEER_AGENT.levels.stamina.drainSeconds; // 45 s (DEER_AGENT)

const deerMassScore = ratioScore(deerGameTemplate.body.massKg.v, deerRefMassKg);
const deerFmrScore = ratioScore(deerGameTemplate.body.fmrKjPerDay.v, deerRefFmrKjPerDay);
const deerWaterScore = ratioScore(deerGameTemplate.needs.water.turnoverMlPerDay.v, deerRefWaterMlPerDay);
const deerWalkSpeedScore = ratioScore(deerGameWalkMps, deerRefWalkMps);
const deerRunSpeedScore = ratioScore(deerGameRunMps, deerRefRunMps);
const deerSprintSpeedScore = ratioScore(deerGameSprintMps, deerRefSprintMps);
const deerStaminaScore = ratioScore(deerGameSprintSeconds, deerRefSprintSeconds);

// 3. Sensory geometry & scent-trace radius:
// White-tailed deer total horizontal visual field = 310° (D'Angelo et al. 2008, J. Wildl. Manage. 72:1738) vs WOLF_NEEDS 250°;
// Sight range = 80 m (DEER_AGENT, VerCauteren & Pipas 2003) vs WOLF_NEEDS 60 m;
// Scent trace range in ui/senses.ts:121 = WOLF_AGENT.senses.scent.range (2,400 m) hardcoded for all species vs DEER_AGENT 2.0 m (van Ginkel et al. 2019).
const deerRefFovDeg = 310;
const deerRefSightRangeM = DEER_AGENT.senses.sight.range; // 80 m
const deerFovScore = ratioScore(deerGameTemplate.senses.sight.fovDeg.v, deerRefFovDeg);
const deerSightRangeScore = ratioScore(deerGameTemplate.senses.sight.rangeM.v, deerRefSightRangeM);
const hudHardcodedTraceRangeM = WOLF_AGENT.senses.scent.range; // 2400 m
const deerRefTraceRangeM = DEER_AGENT.senses.scent.range; // 2 m
const deerTraceRangeScore = ratioScore(hudHardcodedTraceRangeM, deerRefTraceRangeM);

// Check playable rig sensor naming ('head-sensor' required by thoughtBubbles.ts:34 & senses.ts:90)
const playablesSrc = readFileSync(resolve(__dirname, '../../../src/render/playables.ts'), 'utf8');
const animalRigSrc = readFileSync(resolve(__dirname, '../../../src/render/animalRig.ts'), 'utf8');
const harePlayableBlock = playablesSrc.slice(playablesSrc.indexOf("id: 'hare'"));
const hareHasNamedHeadSensor = harePlayableBlock.includes('head-sensor');
const deerHasNamedHeadSensor = animalRigSrc.includes('head-sensor');

// 4. Herbivore diet-gating checks (meat thought bubble, hunt-lock, wolf vocalizations, WOLF_AGENT autonomy):
const obsPath = resolve(__dirname, 'observations.json');
let liveObs = null;
try {
  liveObs = JSON.parse(readFileSync(obsPath, 'utf8'));
} catch {}

const out = {
  generatedAt: new Date().toISOString(),
  metric: {
    name: 'ratioScore vs Nagy et al. (1999), Nagy & Peterson (1988), Heglund & Taylor (1988), D\'Angelo et al. (2008), van Ginkel et al. (2019), and Belovsky (1984)',
    passThreshold: 0.95,
    calibration: {
      knownMatchHareMassScore: Number(calKnownMatchMassScore.toFixed(4)),
      knownMatchHareFovScore: Number(calKnownMatchFovScore.toFixed(4)),
      knownMismatchWolfVsDeerMassScore: Number(calKnownMismatchMassScore.toFixed(4)),
      knownMismatchZeroIntakeScore: Number(calKnownMismatchZeroIntakeScore.toFixed(4)),
    },
  },
  manualHerbivoreFeeding: {
    hareActionsOnPlant,
    hareActionsOnBerry,
    deerActionsOnPlant,
    deerActionsOnBerry,
    hareInventoryHerbsAfterGather: ctxAfterHareGather.inventory.herb,
    hareManualEnergyGainPctPerAction: hareManualFoodEnergyGainPct,
    expectedCloverBiteEnergyGainPct: Number(hareExpectedCloverMeal.energy.toFixed(4)),
    expectedCloverBiteKj: Number(hareExpectedCloverBiteKj.toFixed(4)),
    manualFeedingScore: Number(hareManualFeedingScore.toFixed(4)),
  },
  deerNeedsFallbackBug: {
    registeredSpeciesInNeedsRegistry: Object.keys(NEEDS_SPECIES),
    deerTemplateResolvedId: deerGameTemplate.id,
    deerTemplateResolvedDiet: deerGameTemplate.diet.kind,
    gameMassKg: deerGameTemplate.body.massKg.v,
    refMassKg: deerRefMassKg,
    massScore: Number(deerMassScore.toFixed(4)),
    gameFmrKjPerDay: deerGameTemplate.body.fmrKjPerDay.v,
    refFmrKjPerDay: Number(deerRefFmrKjPerDay.toFixed(1)),
    fmrScore: Number(deerFmrScore.toFixed(4)),
    gameWaterMlPerDay: deerGameTemplate.needs.water.turnoverMlPerDay.v,
    refWaterMlPerDay: Number(deerRefWaterMlPerDay.toFixed(1)),
    waterScore: Number(deerWaterScore.toFixed(4)),
    gameWalkMps: Number(deerGameWalkMps.toFixed(3)),
    refWalkMps: deerRefWalkMps,
    walkSpeedScore: Number(deerWalkSpeedScore.toFixed(4)),
    gameRunMps: Number(deerGameRunMps.toFixed(3)),
    refRunMps: Number(deerRefRunMps.toFixed(3)),
    runSpeedScore: Number(deerRunSpeedScore.toFixed(4)),
    gameSprintMps: Number(deerGameSprintMps.toFixed(3)),
    refSprintMps: deerRefSprintMps,
    sprintSpeedScore: Number(deerSprintSpeedScore.toFixed(4)),
    gameSprintEnduranceSec: deerGameSprintSeconds,
    refSprintEnduranceSec: deerRefSprintSeconds,
    staminaScore: Number(deerStaminaScore.toFixed(4)),
  },
  sensoryAndRigAnchors: {
    deerGameFovDeg: deerGameTemplate.senses.sight.fovDeg.v,
    deerRefFovDeg,
    deerFovScore: Number(deerFovScore.toFixed(4)),
    deerGameSightRangeM: deerGameTemplate.senses.sight.rangeM.v,
    deerRefSightRangeM,
    deerSightRangeScore: Number(deerSightRangeScore.toFixed(4)),
    sensesHudHardcodedTraceRangeM: hudHardcodedTraceRangeM,
    deerRefTraceRangeM,
    deerTraceRangeScore: Number(deerTraceRangeScore.toFixed(4)),
    hareRigHasNamedHeadSensor: hareHasNamedHeadSensor,
    deerRigHasNamedHeadSensor: deerHasNamedHeadSensor,
  },
  carnivoreLeakageOnHerbivores: {
    energyThoughtIconGlyphForAllSpecies: ICON.energy.glyph,
    herbivoreExpectedEnergyGlyph: 'plant_or_clover',
    carnivoreGlyphScore: 0,
    bootEnergyQueryRequested: 8,
    bootEnergyAfterApplyPendingOverwrite: liveObs
      ? Number((liveObs.observations?.[0]?.playerBeforeE?.energy ?? 0).toFixed(2))
      : null,
    bootEnergyPersistenceScore: liveObs
      ? Number(ratioScore(liveObs.observations?.[0]?.playerBeforeE?.energy ?? 75, 8).toFixed(4))
      : null,
    sensesHudIncludesWolfAndFoxPredators: false,
    sensesPredatorDetectionScore: 0,
    liveDeerBrowseUnderFeetGrams: liveObs
      ? liveObs.observations?.[1]?.browseHereGrams ?? null
      : null,
    liveDeerManualEnergyGainOn7kgBrowse: liveObs
      ? liveObs.observations?.[1]?.manualEnergyGainFromPressingE ?? null
      : null,
    liveDeerAutonomousStatusLine: liveObs
      ? (liveObs.observations?.[2]?.statusSnapshot || '').split('\n')[0] || ''
      : null,
  },
};

writeFileSync(resolve(__dirname, 'numbers.json'), JSON.stringify(out, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(out, null, 2));
