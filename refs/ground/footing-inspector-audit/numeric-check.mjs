/**
 * Calibrated numeric audit for T-0227:
 * 1. Embodied species foot-loading (main.ts hardcoded 'canid' vs RIG_BODY_PLAN species feet).
 * 2. Bekker snow compaction resistance & thin-snow punch-through continuity (ground.ts footing() & sinkage() vs Wong 2001).
 * 3. Site-climate Q10 soil organic decay & moss gating across global sites (ground.ts columnRaw() vs CBM-CFS3 Kurz et al. 2009).
 * 4. Generation Inspector (inspector.ts + buildScene.ts) terrain picking & playable species identity.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BEKKER, CLIMATE, FOOT, POOLS, column, footing, rates, sinkage } from '../../../src/core/ground.ts';
import { RIG_BODY_PLAN } from '../../../src/core/materials.ts';
import { HYDRO, initWeather, snowDepthCm } from '../../../src/core/weather.ts';
import { STAGES } from '../../../src/core/stages/elevation.ts';
import { WORLD_SEED } from '../../../src/core/world.ts';
import { clearSite } from '../../../src/core/sitePhase.ts';
import { gravity } from '../../../src/proc/physics.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
mkdirSync(__dirname, { recursive: true });

STAGES.on = true;
STAGES.seed = WORLD_SEED;
clearSite();

const g = gravity(); // 9.81998 m/s²

/**
 * Metric calibration (Rule 11):
 * ratioScore(actual, expected) = max(0, 1 - |actual - expected| / max(1e-6, |expected|))
 * Excess-cost score: excessCostScore(actualCost, expectedCost) = max(0, 1 - |actualCost - expectedCost| / Math.max(0.05, expectedCost - 1))
 * Pass gate: >= 0.95 without rounding.
 */
const ratioScore = (actual, expected) => Math.max(0, 1 - Math.abs(actual - expected) / Math.max(1e-6, Math.abs(expected)));
const excessCostScore = (actualCost, expectedCost) =>
  Math.max(0, 1 - Math.abs(actualCost - expectedCost) / Math.max(0.05, Math.abs(expectedCost - 1)));

// Calibration check (known match vs known mismatch)
const calMatchPressureScore = ratioScore(50.6, 50.6); // 1.0000
const calMatchCostScore = excessCostScore(1.069, 1.069); // 1.0000
const calMismatchPressureScore = ratioScore(15.4, 50.6); // 0.3043 (< 0.70 fail)
const calMismatchCostScore = excessCostScore(2.92, 1.069); // 0.0000 (< 0.70 fail)

/**
 * Wong (2001, Theory of Ground Vehicles, 3rd ed., Table 2.3 & eq. 2.28) reference snow compaction resistance:
 * On homogeneous snowpack deeper than z0:
 *   p(z) = (kc/b + kphi) * z^n   [kPa]
 *   z0 = (p_foot / (kc/b + kphi))^(1/n)
 *   R_total (4 feet) = 4 * b * (kc/b + kphi) * 1000 * z0^(n + 1) / (n + 1)   [N]
 *   movementCost = 1 + R_total / (m * g)
 */
function wongSnowFooting(massKg, plan) {
  const foot = FOOT[plan] ?? FOOT.canid;
  const b = foot.w;
  const area = foot.w * foot.l;
  const pKPa = (massKg * g) / 4 / area / 1000;
  const sn = BEKKER.snow;
  const mod = sn.kc / b + sn.kphi;
  const z = (pKPa / mod) ** (1 / sn.n);
  const R = (4 * b * mod * 1000 * z ** (sn.n + 1)) / (sn.n + 1);
  return {
    pressureKPa: pKPa,
    footLoadingGCm2: (massKg * 1000) / (4 * area * 1e4),
    sinkM: z,
    resistanceN: R,
    cost: 1 + R / (massKg * g),
  };
}

// Construct a 40 cm snowpack test column (SWE = 100 mm -> 40.0 cm at 250 kg/m³, Sturm et al. 2010)
initWeather(15, 12, 0, 0, 8);
const baseCol = column(15, 15, 0);
const snow40Col = {
  ...baseCol,
  layers: [
    {
      id: 'snow',
      label: 'snowpack',
      top: 0,
      thickness: 0.40,
      kg: 0.40 * HYDRO.snowDensity,
      bulk: HYDRO.snowDensity,
      moisture: 1,
      source: 'Sturm et al. 2010',
    },
    ...baseCol.layers.filter((l) => l.id !== 'snow').map((l) => ({ ...l, top: l.top + 0.40 })),
  ],
};

// 1. Embodied White-tailed deer (65 kg, Telfer & Kelsall 1984 JWM 48:1324)
const deerMassKg = 65.0;
const deerGameMainTsBug = footing(snow40Col, deerMassKg, 'canid', g); // main.ts:312 hardcodes 'canid'!
const deerRefCervidWong = wongSnowFooting(deerMassKg, RIG_BODY_PLAN.deer);
const deerPressureScore = ratioScore(deerGameMainTsBug.pressure, deerRefCervidWong.pressureKPa);
const deerSinkScore = ratioScore(deerGameMainTsBug.sink, deerRefCervidWong.sinkM);

// 2. Embodied Grizzly bear (215 kg, Murie 1954)
const bearMassKg = 215.0;
const bearGameMainTsBug = footing(snow40Col, bearMassKg, 'canid', g); // main.ts:312 hardcodes 'canid'!
const bearRefUrsidWong = wongSnowFooting(bearMassKg, RIG_BODY_PLAN.bear);
const bearPressureScore = ratioScore(bearGameMainTsBug.pressure, bearRefUrsidWong.pressureKPa);

// 3. Snowshoe hare (1.50 kg, Murray & Boutin 1991 Oecologia 88:463) on 40 cm snow:
// Even if plan = 'leporid' is passed, ground.ts:238 uses BEKKER.wetLoam32 (n=0.5) instead of BEKKER.snow (n=1.6) for compaction resistance R!
const hareMassKg = 1.50;
const hareGameMainTsCanid = footing(snow40Col, hareMassKg, 'canid', g);
const hareGameLeporidResistanceBug = footing(snow40Col, hareMassKg, 'leporid', g);
const hareRefWongSnow = wongSnowFooting(hareMassKg, 'leporid');
const hareSnowResistanceBugRatio =
  (hareGameLeporidResistanceBug.cost - 1) / Math.max(1e-9, hareRefWongSnow.cost - 1);
const hareSnowCostScore = excessCostScore(hareGameLeporidResistanceBug.cost, hareRefWongSnow.cost);

// 4. Thin-snow / organic-mat punch-through continuity check in ground.ts sinkage():
// Test organic -> mineral boundary where organic = 0.08 m, snow = 0.05 m, footWidth = 0.045 m (cervid):
const thinCol = {
  ...baseCol,
  organic: 0.08,
  layers: [
    { id: 'snow', label: 'snowpack', top: 0, thickness: 0.05, kg: 12.5, bulk: 250, source: 'test' },
  ],
};
const oMod = BEKKER.wetLoam32.kc / 0.045 + BEKKER.wetLoam32.kphi; // 69.021 kPa / m^0.5
const pJustBelowOrganicPunch = oMod * 0.08 ** BEKKER.wetLoam32.n - 1e-4; // ~19.5220 kPa -> zo = 0.079999 m <= 0.08
const pJustAboveOrganicPunch = oMod * 0.08 ** BEKKER.wetLoam32.n + 1e-4; // ~19.5222 kPa -> zo > 0.08 -> switches to full-pressure mineral!
const zBelowPunch = sinkage(thinCol, pJustBelowOrganicPunch, 0.045);
const zAbovePunch = sinkage(thinCol, pJustAboveOrganicPunch, 0.045);

// Wait: let's also check snow -> organic punch-through on stiffer organic or check residual-pressure difference!
// At pJustAboveSnowPunch (p = 2.4366 kPa on 5 cm snow), snow already supports 2.4365 kPa, leaving 0.0001 kPa residual on organic,
// yet sinkage() applies the FULL 2.4366 kPa to organic!
const snMod = BEKKER.snow.kc / 0.045 + BEKKER.snow.kphi;
const pSnowCap5cm = snMod * 0.05 ** BEKKER.snow.n; // 2.4365 kPa
const zJustBelowSnowCap = sinkage(thinCol, pSnowCap5cm * 0.9999, 0.045);
const zJustAboveSnowCap = sinkage(thinCol, pSnowCap5cm * 1.0001, 0.045); // residual dp = 0.00024 kPa -> true extra dz ~ 0 m, game jumps +1.25 mm; at 20 cm snow:
const snow20Col = { ...thinCol, layers: [{ id: 'snow', label: 'snowpack', top: 0, thickness: 0.20, kg: 50, bulk: 250, source: 'test' }] };
const pSnowCap20cm = snMod * 0.20 ** BEKKER.snow.n; // 22.38 kPa!
const zBelow20cm = sinkage(snow20Col, pSnowCap20cm * 0.9999, 0.045); // 0.19999 m
const zAbove20cm = sinkage(snow20Col, pSnowCap20cm * 1.0001, 0.045); // jumps straight to 0.20 + 0.08 + mineral = 0.2821 m (+8.21 cm instantaneous jump for 0.002 kPa!)
const punchJumpCmAt20cmSnow = (zAbove20cm - zBelow20cm) * 100;

// 5. Global Q10 soil organic decay (CBM-CFS3 Kurz et al. 2009 Table 3) & desert/ice moss mat:
const kGameFixed2_5C = rates(CLIMATE.meanAnnualTempC); // always 2.5 °C in columnRaw!
const kTropical26C = rates(26.0); // Amazon lowland rainforest mean annual ~26 °C
const kPolarMinus18C = rates(-18.0); // High Arctic / Antarctic ice-margin ~-18 °C
const tropicalFreshLitterRatio = kTropical26C[0] / kGameFixed2_5C[0]; // 2.65^((26 - 2.5)/10) = 9.89x!
const tropicalDecayScore = ratioScore(kGameFixed2_5C[0], kTropical26C[0]);
const polarDecayScore = ratioScore(kGameFixed2_5C[0], kPolarMinus18C[0]);

// 6. Code & live observation checks for Generation Inspector & buildScene terrain pick:
const obsPath = resolve(__dirname, 'observations.json');
let liveObs = null;
try {
  liveObs = JSON.parse(readFileSync(obsPath, 'utf8'));
} catch {}

const out = {
  generatedAt: new Date().toISOString(),
  metric: {
    name: 'ratioScore & excessCostScore vs Wong (2001), Telfer & Kelsall (1984), Murray & Boutin (1991), and CBM-CFS3 Kurz et al. (2009)',
    passThreshold: 0.95,
    calibration: {
      knownMatchPressureScore: Number(calMatchPressureScore.toFixed(4)),
      knownMatchCostScore: Number(calMatchCostScore.toFixed(4)),
      knownMismatchPressureScore: Number(calMismatchPressureScore.toFixed(4)),
      knownMismatchCostScore: Number(calMismatchCostScore.toFixed(4)),
    },
  },
  deerSnowFooting: {
    massKg: deerMassKg,
    gamePlanUsedInMainTs: 'canid',
    expectedPlan: 'cervid',
    gamePressureKPa: Number(deerGameMainTsBug.pressure.toFixed(3)),
    expectedCervidPressureKPa: Number(deerRefCervidWong.pressureKPa.toFixed(3)),
    publishedRangeKPa: [39.2, 58.8], // 400-600 g/cm² (Telfer & Kelsall 1984)
    gameSnowSinkCm: Number((deerGameMainTsBug.sink * 100).toFixed(2)),
    expectedCervidSnowSinkCm: Number((deerRefCervidWong.sinkM * 100).toFixed(2)),
    pressureScore: Number(deerPressureScore.toFixed(4)),
    sinkScore: Number(deerSinkScore.toFixed(4)),
  },
  bearSnowFooting: {
    massKg: bearMassKg,
    gamePlanUsedInMainTs: 'canid',
    expectedPlan: 'ursid',
    gamePressureKPa: Number(bearGameMainTsBug.pressure.toFixed(3)),
    expectedUrsidPressureKPa: Number(bearRefUrsidWong.pressureKPa.toFixed(3)),
    pressureScore: Number(bearPressureScore.toFixed(4)),
  },
  hareSnowCompactionBug: {
    massKg: hareMassKg,
    snowDepthCm: 40,
    harePressureKPa_canidBug: Number(hareGameMainTsCanid.pressure.toFixed(3)),
    harePressureKPa_leporid: Number(hareRefWongSnow.pressureKPa.toFixed(3)),
    hareSnowSinkCm_leporid: Number((hareRefWongSnow.sinkM * 100).toFixed(2)),
    gameMovementCost_leporidWetLoamBug: Number(hareGameLeporidResistanceBug.cost.toFixed(4)),
    wongExpectedMovementCost_leporidSnow: Number(hareRefWongSnow.cost.toFixed(4)),
    excessCompactionResistanceMultiplier: Number(hareSnowResistanceBugRatio.toFixed(2)),
    snowCostScore: Number(hareSnowCostScore.toFixed(4)),
  },
  bekkerLayerPunchDiscontinuity: {
    snowThicknessCm: 20,
    organicThicknessCm: 8,
    pressureBelowCapKPa: Number((pSnowCap20cm * 0.9999).toFixed(4)),
    pressureAboveCapKPa: Number((pSnowCap20cm * 1.0001).toFixed(4)),
    sinkBelowCapCm: Number((zBelow20cm * 100).toFixed(2)),
    sinkAboveCapCm: Number((zAbove20cm * 100).toFixed(2)),
    instantaneousJumpCmFor0_004kPa: Number(punchJumpCmAt20cmSnow.toFixed(2)),
  },
  globalSoilDecayQ10: {
    gameHardcodedTempC: CLIMATE.meanAnnualTempC,
    tropical26C_kFreshPerYr: Number(kTropical26C[0].toFixed(4)),
    game2_5C_kFreshPerYr: Number(kGameFixed2_5C[0].toFixed(4)),
    tropicalRateUnderestimateFactor: Number(tropicalFreshLitterRatio.toFixed(2)),
    tropicalDecayScore: Number(tropicalDecayScore.toFixed(4)),
    polarMinus18C_kFreshPerYr: Number(kPolarMinus18C[0].toFixed(5)),
    polarDecayScore: Number(polarDecayScore.toFixed(4)),
  },
  liveBrowserSummary: liveObs ? {
    terrainClicksAllReturnedNull: liveObs.observations?.[0]?.terrainClickHits?.every((h) => !h.inspectorHeader) ?? null,
    hareInspectorWhyExcerpt: liveObs.observations?.[0]?.inspectorWhyExcerpt ?? [],
    deerInspectorWhyExcerpt: liveObs.observations?.[1]?.inspectorWhyExcerpt ?? [],
    saharaDesertMossThicknessCm: liveObs.observations?.[2]?.groundMossThicknessCm ?? null,
    saharaDesertDuffAgeLabel: liveObs.observations?.[2]?.groundDuffAgeLabel ?? null,
  } : null,
};

writeFileSync(resolve(__dirname, 'numbers.json'), JSON.stringify(out, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(out, null, 2));
