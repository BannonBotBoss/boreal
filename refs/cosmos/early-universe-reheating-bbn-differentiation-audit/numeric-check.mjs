/**
 * Calibrated Rule 11 numeric evaluation for T-0250:
 *   1. Post-inflation spacetime vs reheating trajectory & scale_samples(a0=1e-14, t=0) discontinuity (+7,349x T spike,
 *      1,396x backward a(t) contraction), un-confined QCD quarks/gluons below 155 MeV (g* = 47.98 vs 10.76 Husdal 2016,
 *      hard 1 MeV cliff, & free gluons at 2.725 K Today), cosmology.rs c^4 g_star_cmb bug, & unbuilt BBN (Y_p = 0, D/H = 0)
 *      (rust/boreal-sim/src/cosmology.rs, reheating.rs, cosmic_time.rs, registry.rs; Issue #279)
 *   2. CosmosSphere non-Planckian neon purple-violet chromaticity at 2,936 K Recombination (R/B = 0.41 vs 2.48 amber),
 *      blazing 1.23 brightness during 132.4 K infrared Cosmic Dark Ages (0 cd/m^2 visible), z-index 25 forest HUD leak,
 *      ignored TIERS (bloom, segments, msaa) + missing OutputPass, & CPU-only unrun benchmark (src/world/cosmos/look.ts, sphere.ts, lod.ts)
 *   3. SPH planetary hot differentiation freezing 99.72% (1,803 / 1,808) of core iron parcels solid (ICB = 3,117.4 km vs
 *      PREM 1,221.5 km), unsettled Mach 4.3 vmax = 1,469.3 m/s & 19.06 km COM drift, & cold bulk-mix 22,969 kg/m^3 core
 *      (rust/boreal-sim/src/differentiation.rs, formation.rs, public/bake/earth-hot.*, earth-mix-6k.*, src/world/globe/parcels.ts)
 *   4. Missing registry::note session call counts across 10 active Rust modules, leaked planet grid inputs onto nucleosynthesis
 *      & 5 drive cards without per-parameter reset buttons, missing k_B^4/(hbar c)^3 in rho_t, uncached run_cached(), & WASM alloc_f64 leaks
 *      (rust/boreal-sim/src/registry.rs, reheating.rs, src/ui/dataPanel.ts, src/core/planetBudget.ts; Issue #279)
 *
 * Run: npx tsx refs/cosmos/early-universe-reheating-bbn-differentiation-audit/numeric-check.mjs
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { K } from '../../../src/core/constants';
import { loadPlanetSim } from '../../../src/core/planetBudget';
import { decodeEngineReport } from '../../../src/core/engineReport';
import { sphereLook } from '../../../src/world/cosmos/look';
import { TIERS } from '../../../src/world/cosmos/lod';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../..');

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const ratioScore = (a, b) => {
  if (!(a > 0) || !(b > 0)) return 0;
  return +(Math.min(a, b) / Math.max(a, b)).toFixed(4);
};
const deltaScore = (measured, reference, fullScale) =>
  +clamp01(1 - Math.abs(measured - reference) / Math.max(fullScale, 1e-9)).toFixed(4);

// Planckian spectral radiance B_lambda(lambda_nm, T_K) (relative) and sRGB encoding (IEC 61966-2-1)
function planckRel(lambdaNm, T) {
  if (!(T > 0)) return 0;
  const lam = lambdaNm * 1e-9;
  const x = (K.h * K.c) / (lam * K.k_B * T);
  if (x > 700) return 0;
  return 1 / (Math.pow(lam, 5) * Math.expm1(x));
}
const linToSrgb = (u) => {
  const c = clamp01(u);
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
};
function blackbodySrgbRatioRB(T) {
  // Narrowband CIE-sRGB primaries (612 nm R, 549 nm G, 464 nm B) normalized to D65 white (6504 K)
  const r = planckRel(612, T) / planckRel(612, 6504);
  const g = planckRel(549, T) / planckRel(549, 6504);
  const b = planckRel(464, T) / planckRel(464, 6504);
  const peak = Math.max(r, g, b, 1e-30);
  const sr = linToSrgb(r / peak);
  const sb = linToSrgb(b / peak);
  return sr / Math.max(sb, 1e-6);
}

const wasmBytes = readFileSync(resolve(REPO_ROOT, 'public/wasm/boreal_sim.wasm'));
const sim = await loadPlanetSim(wasmBytes);
if (!sim) throw new Error('Failed to load public/wasm/boreal_sim.wasm');

const PLANCK_S = 5.391247e-44;
const YEAR_S = 365.25 * 86400;
const cycleOf = (sec) => Math.log10(sec / PLANCK_S) + 1;

function reportAtSec(sec) {
  sim.setEngineCycle(cycleOf(sec));
  return decodeEngineReport(sim.engineReport());
}

const refFig = JSON.parse(readFileSync(resolve(REPO_ROOT, 'data/earth/reference-figure.json'), 'utf8'));
const hotMeta = JSON.parse(readFileSync(resolve(REPO_ROOT, 'public/bake/earth-hot.json'), 'utf8'));
const mixMeta = JSON.parse(readFileSync(resolve(REPO_ROOT, 'public/bake/earth-mix-6k.json'), 'utf8'));
const hotBuf = new Float32Array(readFileSync(resolve(REPO_ROOT, 'public/bake/earth-hot.bin')).buffer);

const obsPath = resolve(__dirname, 'observations.json');
const runtimeObs = existsSync(obsPath) ? JSON.parse(readFileSync(obsPath, 'utf8')) : null;

// ---------------------------------------------------------------------------
// Rule 11 Calibration: Known Matches (>= 0.95) and Known Mismatches (< 0.70)
// ---------------------------------------------------------------------------
const repToday = reportAtSec(13.8e9 * YEAR_S);
const spToday = repToday.instances.find((i) => i.type === 'spacetime');
const rhToday = repToday.instances.find((i) => i.type === 'reheating');
const tCmbToday = spToday.vars.find((v) => v.label === 'temperature').value;
const gStarToday = rhToday.vars.find((v) => v.label === 'g*').value;

const repEw = reportAtSec(2e-32);
const rhEw = repEw.instances.find((i) => i.type === 'reheating');
const gStarHighT = rhEw.vars.find((v) => v.label === 'g*').value;

const knownMatchCmbTemp = ratioScore(tCmbToday, 2.7255); // Fixsen (2009) ApJ 707:916 T_0 = 2.72548 K -> 0.9998
const knownMatchSmHighTGStar = ratioScore(gStarHighT, 106.75); // Husdal (2016) / Saikawa & Shirai (2018) SM g*(T >> m_t) = 106.75 -> 1.0000
const knownMatchPostAnnihilGStar = ratioScore(gStarToday, 2 + (7 / 8) * 6 * Math.pow(4 / 11, 4 / 3)); // 3.3626 -> 1.0000
const knownMatchPremSurfaceRadius = ratioScore(sim.earthFigure().rSurfKm, 6371.0); // Dziewonski & Anderson (1981) PREM 6371 km -> 1.0000

const knownMismatchFreeQuarksAt10MeV = ratioScore(47.975, 10.76); // 0.2243 (< 0.70)
const knownMismatchPurpleVsAmberRecomb = ratioScore(0.32 / 0.78, blackbodySrgbRatioRB(2936)); // 0.1657 (< 0.70)
const knownMismatchFrozenOuterCoreIcb = ratioScore(3117.442, 1221.5); // 0.3918 (< 0.70)
const knownMismatchUnbuiltBbnHelium = deltaScore(0.0, 0.245, 0.245); // 0.0000 (< 0.70)

const calibration = {
  metrics: {
    ratioScore: 'min(a, b) / max(a, b) on strictly positive physical/cosmological/geophysical quantities (1.0 exact, >= 0.95 pass)',
    deltaScore: 'clamp01(1 - |measured - reference| / fullScale) on bounded fractions/counts (>= 0.95 pass)',
  },
  knownMatches: {
    cmbTemperatureFixsen2009: knownMatchCmbTemp,
    standardModelHighTGStar106_75: knownMatchSmHighTGStar,
    postPositronAnnihilationGStar3_363: knownMatchPostAnnihilGStar,
    premEmergentSurfaceRadius6371Km: knownMatchPremSurfaceRadius,
  },
  knownMismatches: {
    deconfinedQuarksGluonsAt10MeV: knownMismatchFreeQuarksAt10MeV,
    purpleSphereVs2936KPlanckianAmber: knownMismatchPurpleVsAmberRecomb,
    frozen3117KmIcbVsPrem1221_5Km: knownMismatchFrozenOuterCoreIcb,
    zeroHelium4InUnbuiltBbn: knownMismatchUnbuiltBbnHelium,
  },
};

const calibrationValid =
  Object.values(calibration.knownMatches).every((s) => s >= 0.95) &&
  Object.values(calibration.knownMismatches).every((s) => s < 0.70);

// ---------------------------------------------------------------------------
// Check 1: Post-inflation spacetime vs reheating continuity & radiation-era a(t)
// Kolb & Turner (1990) & Planck 2018: a(t) expands monotonically (a(1e-9)/a(1e-10) = sqrt(10) = 3.1623),
// and spacetime/reheating agree on one continuous T(t), a(t) without a +7,349x post-inflation T jump
// or a 1,396x backward contraction of a(t).
// ---------------------------------------------------------------------------
const ct = sim.cosmosTable();
let maxPostInflTempJumpRatio = 1;
for (let i = 1; i < ct.length / 5; i++) {
  const tPrev = ct[(i - 1) * 5 + 3];
  const tCur = ct[i * 5 + 3];
  if (tPrev > 0 && tCur > tPrev) {
    maxPostInflTempJumpRatio = Math.max(maxPostInflTempJumpRatio, tCur / tPrev);
  }
}
const rep1e10 = reportAtSec(1e-10);
const rep1e9 = reportAtSec(1e-9);
const rhA1e10 = rep1e10.instances.find((i) => i.type === 'reheating').vars.find((v) => v.label === 'scale factor a').value;
const rhA1e9 = rep1e9.instances.find((i) => i.type === 'reheating').vars.find((v) => v.label === 'scale factor a').value;
const measuredScaleGrowth1e10To1e9 = rhA1e9 / rhA1e10; // 0.000716 (1,396x backward contraction!) vs sqrt(10) = 3.1623
const check1Score = +(0.5 * (ratioScore(measuredScaleGrowth1e10To1e9, Math.sqrt(10)) + ratioScore(1.0, maxPostInflTempJumpRatio))).toFixed(4);

// ---------------------------------------------------------------------------
// Check 2: QCD confinement (~155 MeV) g*(T) curve & absence of free gluons after hadronization
// Borsanyi et al. (2016) Nature 539:69; Husdal (2016) Galaxies 4:78; Saikawa & Shirai (2018) JCAP 08:035:
// At t = 0.008 s (T = 1.493e11 K = 12.87 MeV << 155 MeV), quarks & gluons are confined (rho_gluon = 0)
// and g*(12.87 MeV) = 10.76 (photons + e+- + 3 nu).
// ---------------------------------------------------------------------------
const repHadron = reportAtSec(0.008);
const rhHadron = repHadron.instances.find((i) => i.type === 'reheating');
const gStarAt12_9MeV = rhHadron.vars.find((v) => v.label === 'g*').value; // 47.975
const freeGluonEnergyToday = rhToday.vars.find((v) => v.label === 'gluon energy density').value; // 3.337e-13 J/m^3 (> 8x CMB photons!)
const photonEnergyToday = rhToday.vars.find((v) => v.label === 'photon energy density').value; // 4.172e-14 J/m^3
const gluonToPhotonRatioToday = freeGluonEnergyToday / Math.max(photonEnergyToday, 1e-30); // 8.00 vs 0.00
const check2Score = +(0.5 * (ratioScore(gStarAt12_9MeV, 10.76) + deltaScore(gluonToPhotonRatioToday, 0.0, 1.0))).toFixed(4);

// ---------------------------------------------------------------------------
// Check 3: Big Bang Nucleosynthesis (t = 100 s) primordial 4He (Y_p) & D/H + cosmology g_star_cmb
// Pitrou et al. (2018) Phys. Rept. 754:1 & PDG (2024): Y_p = 0.245 +- 0.003, D/H = 2.547e-5; g_star_cmb = 3.3626.
// ---------------------------------------------------------------------------
const repBbn = reportAtSec(100);
const bbnInst = repBbn.instances.find((i) => i.type === 'nucleosynthesis');
const he4MassFrac = bbnInst?.vars.find((v) => v.label.includes('helium-4'))?.value ?? 0;
const deutAbund = bbnInst?.vars.find((v) => v.label.includes('deuterium'))?.value ?? 0;
const cosmologyRsSrc = readFileSync(resolve(REPO_ROOT, 'rust/boreal-sim/src/cosmology.rs'), 'utf8');
const gStarCmbHasDoubleC2Bug = /let rho_c = 3\.0 \* p\.c \* p\.c[\s\S]{0,140}let rho_r = p\.orr \* rho_c \* p\.c \* p\.c/.test(cosmologyRsSrc);
const check3Score = +(
  (ratioScore(he4MassFrac, 0.245) + ratioScore(deutAbund, 2.547e-5) + (gStarCmbHasDoubleC2Bug ? 0 : 1)) /
  3
).toFixed(4);

// ---------------------------------------------------------------------------
// Check 4: Planckian blackbody chromaticity at Recombination (t = 380 kyr, T = 2,936 K) & Planck era
// Planck Collaboration VI (2020) & CIE 1931 / IEC 61966-2-1: 2,936 K blackbody is warm orange-amber
// (sRGB R/B = 2.476), whereas > 10^5 K Rayleigh-Jeans limit is blue-white (sRGB R/B = 0.654).
// ---------------------------------------------------------------------------
const repRecomb = reportAtSec(380e3 * YEAR_S);
const spRecomb = repRecomb.instances.find((i) => i.type === 'spacetime');
const aRecomb = spRecomb.vars.find((v) => v.label === 'scale factor a').value;
const tRecomb = spRecomb.vars.find((v) => v.label === 'temperature').value; // 2935.8 K
const lookRecomb = sphereLook(aRecomb, 1, tRecomb, 1);
const gameRecombRB = lookRecomb.color[0] / Math.max(lookRecomb.color[2], 1e-6); // 0.32 / 0.78 = 0.4103 (purple-violet!)
const natureRecombRB = blackbodySrgbRatioRB(tRecomb); // ~2.476
const check4Score = ratioScore(gameRecombRB, natureRecombRB);

// ---------------------------------------------------------------------------
// Check 5: Cosmic Dark Ages (t = 50 Myr, T = 132.4 K, lambda_max = 21.9 um IR) visible luminance
// Wien's law & CIE V(lambda) (380-780 nm): visible thermal brightness at 132.4 K is 0.0000.
// ---------------------------------------------------------------------------
const repDark = reportAtSec(50e6 * YEAR_S);
const spDark = repDark.instances.find((i) => i.type === 'spacetime');
const aDark = spDark.vars.find((v) => v.label === 'scale factor a').value;
const tDark = spDark.vars.find((v) => v.label === 'temperature').value; // 132.4 K
const lookDark = sphereLook(aDark, 1, tDark, 1); // brightness = 1.228
const check5Score = deltaScore(lookDark.brightness, 0.0, 1.0);

// ---------------------------------------------------------------------------
// Check 6: CosmosSphere HUD isolation, TIERS fidelity (bloom, segments, msaa + OutputPass), & GPU timer benchmark
// ---------------------------------------------------------------------------
const sphereTsSrc = readFileSync(resolve(REPO_ROOT, 'src/world/cosmos/sphere.ts'), 'utf8');
const hasOutputPass = /OutputPass/.test(sphereTsSrc);
const usesTierBloom = /this\.bloom\.strength\s*=\s*tier\.bloom/.test(sphereTsSrc);
const usesTierMsaa = /tier\.msaa/.test(sphereTsSrc);
const usesGpuTimerQuery = /EXT_disjoint_timer_query/.test(sphereTsSrc);
const hudOverlapCount = runtimeObs?.stage0?.forestHudElementsVisibleOverCosmos ?? 3;
const tierBootedTested = runtimeObs?.stage2?.tierBeforeBench && !runtimeObs.stage2.tierBeforeBench.includes('not tested yet') ? 1 : 0;
const check6PassedItems =
  (hudOverlapCount === 0 ? 1 : 0) +
  (hasOutputPass ? 1 : 0) +
  (usesTierBloom ? 1 : 0) +
  (usesTierMsaa ? 1 : 0) +
  (usesGpuTimerQuery ? 1 : 0) +
  tierBootedTested;
const check6Score = +(check6PassedItems / 6).toFixed(4);

// ---------------------------------------------------------------------------
// Check 7: SPH hot differentiation (earth-hot) ICB radius & liquid outer-core mass fraction
// PREM (Dziewonski & Anderson 1981): r_ICB = 1,221.5 km, r_CMB = 3,480.0 km -> liquid outer core
// is 1 - (1221.5/3480)^3 = 95.67% of core volume (~94.5% of core mass).
// In earth-hot.bin: 1,803 solid iron (mat 12) vs 5 liquid iron (mat 10) = 0.277% liquid, r_ICB = 3,117.4 km!
// ---------------------------------------------------------------------------
let nLiquidFe = 0;
let nSolidFe = 0;
for (let i = 0; i < hotBuf.length / 6; i++) {
  const mat = hotBuf[i * 6 + 3] | 0;
  if (mat === 10) nLiquidFe++;
  else if (mat === 12) nSolidFe++;
}
const measuredLiquidCoreFrac = nLiquidFe / Math.max(1, nLiquidFe + nSolidFe); // 5 / 1808 = 0.002765
const premLiquidCoreMassFrac = 1 - 0.0984 / 1.939; // PREM inner core 9.84e22 kg / total core 1.939e24 kg = 0.9493 liquid
const measuredIcbKm = (hotMeta.icb ?? 0) / 1e3; // 3117.442 km vs 1221.5 km
const check7Score = +(0.5 * (ratioScore(measuredLiquidCoreFrac, premLiquidCoreMassFrac) + ratioScore(measuredIcbKm, refFig.icbKm))).toFixed(4);

// ---------------------------------------------------------------------------
// Check 8: SPH earth-hot hydrostatic equilibrium (vmax <= 10 m/s, COM <= 1,000 m, g_eq, J2)
// Kegerreis et al. (2019) MNRAS 487:5029; WGS84 g_eq = 9.7803 m/s^2; EGM2008 J2 = 1.08263e-3
// ---------------------------------------------------------------------------
const vmaxScore = hotMeta.vmax <= 10 ? 1 : +(10 / hotMeta.vmax).toFixed(4); // 10 / 1469.3 = 0.0068
const comScore = hotMeta.com_m <= 1000 ? 1 : +(1000 / hotMeta.com_m).toFixed(4); // 1000 / 19062.7 = 0.0525
const gEqScore = ratioScore(hotMeta.g_eq, refFig.gEq); // 9.299 / 9.7803 = 0.9508
const j2Score = ratioScore(hotMeta.j2, refFig.j2); // 7.8783e-4 / 1.08263e-3 = 0.7277
const check8Score = Math.min(vmaxScore, comScore, gEqScore, j2Score);

// ---------------------------------------------------------------------------
// Check 9: Cold bulk-mix SPH bake (earth-mix-6k.json) central density, CMB radius & surface gravity
// PREM rho_centre = 13,088 kg/m^3, r_CMB = 3,480 km, WGS84 g_eq = 9.7803 m/s^2
// ---------------------------------------------------------------------------
const mixRhoScore = ratioScore(mixMeta.rho_centre, refFig.rhoCentre); // 13088 / 22969 = 0.5698
const mixCmbScore = ratioScore(mixMeta.cmb / 1e3, refFig.cmbKm); // 2937 / 3480 = 0.8440
const mixGEqScore = ratioScore(mixMeta.g_eq, refFig.gEq); // 9.7803 / 11.685 = 0.8370
const check9Score = Math.min(mixRhoScore, mixCmbScore, mixGEqScore);

// ---------------------------------------------------------------------------
// Check 10: Issue #279 session call counting (registry::note) across 10 active Rust modules
// Modules: formation, differentiation, interior, gas, rt, emergent, animals, perception, cover, species
// ---------------------------------------------------------------------------
const trackedRustFiles = [
  'rust/boreal-sim/src/formation.rs',
  'rust/boreal-sim/src/differentiation.rs',
  'rust/boreal-sim/src/interior.rs',
  'rust/boreal-sim/src/gas.rs',
  'rust/boreal-sim/src/rt.rs',
  'rust/boreal-sim/src/emergent.rs',
  'rust/boreal-sim/src/animals.rs',
  'rust/boreal-sim/src/perception.rs',
  'rust/boreal-sim/src/cover.rs',
  'rust/boreal-sim/src/species.rs',
];
const notedCount = trackedRustFiles.filter((rel) => /registry::note/.test(readFileSync(resolve(REPO_ROOT, rel), 'utf8'))).length;
const check10Score = +(notedCount / trackedRustFiles.length).toFixed(4);

// ---------------------------------------------------------------------------
// Check 11: Data (U) card parameter scoping & per-parameter SM mass reset buttons (Issue #279)
// ---------------------------------------------------------------------------
const dataPanelSrc = readFileSync(resolve(REPO_ROOT, 'src/ui/dataPanel.ts'), 'utf8');
const leakedCards =
  (runtimeObs?.stage1?.leakedPlanetInputsOnBbn?.length > 0 ? 1 : 0) +
  (runtimeObs?.benchAndToday?.driveCardsWithPlanetParams?.length ?? 5);
const perParamResetButtons = runtimeObs?.benchAndToday?.reheatResetPerParamButtons ?? 0;
const filterScopedToSlices = !/inst\.type !== 'planet' && inst\.type !== 'spacetime' && inst\.type !== 'reheating' && p\.type === 'planet'/.test(
  dataPanelSrc,
);
const check11Score = +(
  ((leakedCards === 0 && filterScopedToSlices ? 1 : 0) + Math.min(1, perParamResetButtons / 17)) /
  2
).toFixed(4);

// ---------------------------------------------------------------------------
// Check 12: SI dimensional consistency of rho_t equation, reheating run_cached memoization, & WASM linear-memory reuse
// ---------------------------------------------------------------------------
const registryRsSrc = readFileSync(resolve(REPO_ROOT, 'rust/boreal-sim/src/registry.rs'), 'utf8');
const reheatingRsSrc = readFileSync(resolve(REPO_ROOT, 'rust/boreal-sim/src/reheating.rs'), 'utf8');
const planetBudgetSrc = readFileSync(resolve(REPO_ROOT, 'src/core/planetBudget.ts'), 'utf8');

const rhoTHasSiFactors = /\\hbar/.test(
  registryRsSrc.match(/id:\s*"rho_t"[\s\S]{0,160}/)?.[0] ?? '',
);
const reheatIsMemoized = !/fn run_cached\(\)\s*->\s*Run\s*\{\s*integrate\(\)\s*\}/.test(reheatingRsSrc);
const namePtrReusesScratch = !/private namePtr[\s\S]{0,180}this\.x\.alloc_f64/.test(planetBudgetSrc);
const check12Score = +(((rhoTHasSiFactors ? 1 : 0) + (reheatIsMemoized ? 1 : 0) + (namePtrReusesScratch ? 1 : 0)) / 3).toFixed(4);

const checks = [
  {
    id: 'postInflationContinuityAndScaleFactorMonotonicity',
    measured: {
      maxPostInflTempJumpRatio: +maxPostInflTempJumpRatio.toFixed(1),
      rhA1e10: +rhA1e10.toExponential(4),
      rhA1e9: +rhA1e9.toExponential(4),
      scaleRatio1e10To1e9: +measuredScaleGrowth1e10To1e9.toExponential(4),
    },
    target: { maxPostInflTempJumpRatio: 1.0, scaleRatio1e10To1e9: +Math.sqrt(10).toFixed(4) },
    score: check1Score,
    pass: check1Score >= 0.95,
  },
  {
    id: 'qcdConfinementGStarAndZeroPostHadronFreeGluons',
    measured: {
      gStarAt12_9MeV: +gStarAt12_9MeV.toFixed(3),
      freeGluonToPhotonEnergyRatioToday: +gluonToPhotonRatioToday.toFixed(4),
    },
    target: { gStarAt12_9MeV: 10.76, freeGluonToPhotonEnergyRatioToday: 0.0 },
    score: check2Score,
    pass: check2Score >= 0.95,
  },
  {
    id: 'bbnPrimordialHeliumDeuteriumAndCmbGStar',
    measured: {
      he4MassFractionYp: he4MassFrac,
      deuteriumToHydrogen: deutAbund,
      gStarCmbDoubleC2Bug: gStarCmbHasDoubleC2Bug,
    },
    target: { he4MassFractionYp: 0.245, deuteriumToHydrogen: 2.547e-5, gStarCmbDoubleC2Bug: false },
    score: check3Score,
    pass: check3Score >= 0.95,
  },
  {
    id: 'recombination2936KPlanckianChromaticityRatioRB',
    measured: {
      temperatureK: +tRecomb.toFixed(1),
      sphereLookSrgb: lookRecomb.color.map((c) => +c.toFixed(4)),
      redToBlueRatio: +gameRecombRB.toFixed(4),
    },
    target: { redToBlueRatio: +natureRecombRB.toFixed(4) },
    score: check4Score,
    pass: check4Score >= 0.95,
  },
  {
    id: 'cosmicDarkAges132KVisibleLuminanceSuppression',
    measured: {
      temperatureK: +tDark.toFixed(2),
      wienPeakUm: +(2897.77 / tDark).toFixed(2),
      sphereLookBrightness: +lookDark.brightness.toFixed(4),
      renderedPeakRgb255: runtimeObs?.stage2?.darkAgesSpherePeakRgb255 ?? null,
    },
    target: { visibleBrightness: 0.0 },
    score: check5Score,
    pass: check5Score >= 0.95,
  },
  {
    id: 'cosmosSphereHudIsolationTiersOutputPassAndGpuBench',
    measured: {
      hudOverlapCount,
      hasOutputPass,
      usesTierBloom,
      usesTierMsaa,
      usesGpuTimerQuery,
      tierBootedTested: Boolean(tierBootedTested),
      tierCount: TIERS.length,
    },
    target: { passedItems: 6 },
    score: check6Score,
    pass: check6Score >= 0.95,
  },
  {
    id: 'sphHotDifferentiationLiquidOuterCoreAndIcbRadius',
    measured: {
      icbKm: +measuredIcbKm.toFixed(2),
      nLiquidIronParcels: nLiquidFe,
      nSolidIronParcels: nSolidFe,
      liquidCoreFraction: +measuredLiquidCoreFrac.toFixed(5),
    },
    target: { icbKm: refFig.icbKm, liquidCoreFraction: +premLiquidCoreMassFrac.toFixed(4) },
    score: check7Score,
    pass: check7Score >= 0.95,
  },
  {
    id: 'sphHotDifferentiationHydrostaticSettlingAndFigure',
    measured: {
      vmaxMps: hotMeta.vmax,
      comM: hotMeta.com_m,
      rVolKm: +(hotMeta.r_vol / 1e3).toFixed(1),
      gEqMps2: hotMeta.g_eq,
      j2: hotMeta.j2,
    },
    target: { vmaxMpsMax: 10.0, comMMax: 1000.0, rMeanKm: +(refFig.rMean / 1e3).toFixed(1), gEqMps2: refFig.gEq, j2: refFig.j2 },
    score: check8Score,
    pass: check8Score >= 0.95,
  },
  {
    id: 'sphColdBulkMixCoreDensityAndCmbRadius',
    measured: {
      rhoCentreKgM3: mixMeta.rho_centre,
      cmbKm: +(mixMeta.cmb / 1e3).toFixed(1),
      gEqMps2: mixMeta.g_eq,
    },
    target: { rhoCentreKgM3: refFig.rhoCentre, cmbKm: refFig.cmbKm, gEqMps2: refFig.gEq },
    score: check9Score,
    pass: check9Score >= 0.95,
  },
  {
    id: 'rustModuleRegistrySessionCallCounting',
    measured: { notedModules: notedCount, totalModules: trackedRustFiles.length },
    target: { notedModules: trackedRustFiles.length },
    score: check10Score,
    pass: check10Score >= 0.95,
  },
  {
    id: 'dataPanelCardParameterScopingAndPerParamReset',
    measured: { leakedUnrelatedCards: leakedCards, perParamResetButtons },
    target: { leakedUnrelatedCards: 0, perParamResetButtons: 17 },
    score: check11Score,
    pass: check11Score >= 0.95,
  },
  {
    id: 'siEquationUnitsReheatMemoizationAndWasmScratchSafety',
    measured: { rhoTHasSiFactors, reheatIsMemoized, namePtrReusesScratch },
    target: { rhoTHasSiFactors: true, reheatIsMemoized: true, namePtrReusesScratch: true },
    score: check12Score,
    pass: check12Score >= 0.95,
  },
];

const passedCount = checks.filter((c) => c.pass).length;
const meanScore = +(checks.reduce((acc, c) => acc + c.score, 0) / checks.length).toFixed(4);

const out = {
  task: 'T-0250',
  calibrationValid,
  calibration,
  passedCount,
  totalChecks: checks.length,
  meanScore,
  checks,
};

writeFileSync(resolve(__dirname, 'numbers.json'), JSON.stringify(out, null, 2) + '\n', 'utf8');
console.log(
  `T-0250 numeric audit: calibrationValid=${calibrationValid}, passed=${passedCount}/${checks.length}, meanScore=${meanScore}`,
);
for (const c of checks) {
  console.log(`  [${c.pass ? 'PASS' : 'FAIL'}] ${c.id}: score=${c.score}`);
}
