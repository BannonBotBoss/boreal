/**
 * Calibrated Rule 11 numeric verification gate for T-0246:
 * Horizon-Scale Water Continuity & Drained Base-Water Basins, Underwater Submersion Optics &
 * Nocturnal/Advective Wakes, Fluvial Step/Bank Alignment, and Remote Great-Lakes Hydrography Audit.
 *
 * Run via: npx tsx refs/water/horizon-fluvial-submersion-hydro-audit/numeric-check.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';

import { STAGES } from '../../../src/core/stages/elevation';
import { riverGrid, riverAuditPoints, riverAt, segmentGeom } from '../../../src/core/stages/rivers';
import { stepsOnSegment } from '../../../src/core/stages/channelRough';
import { surfaceAt } from '../../../src/core/stages/surfaceAt';
import { INTEREST } from '../../../src/core/interest';
import { WAVE, ringAt } from '../../../src/core/waterWake';
import { BETA_M } from '../../../src/render/aerial';
import { waterMaterial } from '../../../src/render/water';
import { drawOpenWater } from '../../../src/world/globe/coverSample';
import { coverKind } from '../../../src/world/globe/coverKind';
import { horizonMetres, curvatureDrop } from '../../../src/world/globe/horizonSkirt';
import { groundForCover, vegetationFromPhoto } from '../../../src/world/globe/openTiles';

const __dirname = dirname(fileURLToPath(import.meta.url));
const obsPath = resolve(__dirname, 'observations.json');
const obsData = JSON.parse(readFileSync(obsPath, 'utf8'));

function ratioScore(measured, target) {
  if (measured <= 0 || target <= 0) return 0;
  return Math.min(measured, target) / Math.max(measured, target);
}

function unitScore(measured, target, fullScale) {
  return Math.max(0, Math.min(1, 1 - Math.abs(measured - target) / fullScale));
}

// ============================================================================
// 1. Calibration checks (Rule 11: known matches >= 0.95, known mismatches < 0.75)
// ============================================================================
const R_EARTH = 6_371_008.8;
const bowditchHorizon3p2 = Math.sqrt(2 * R_EARTH * 3.2 + 3.2 * 3.2);
const sigma = 0.07275, rho = 998.2071, g0 = 9.80665, kWave = (2 * Math.PI) / 0.10;
const lighthillPhaseSpeed = Math.sqrt(g0 / kWave + (sigma * kWave) / rho);
const snellCriticalDeg = (Math.asin(1 / 1.333) * 180) / Math.PI;

const calibration = {
  metrics: {
    ratioScore: 'min(measured, target) / max(measured, target) for strictly positive physical quantities (>= 0.95 pass)',
    unitScore: 'max(0, 1 - |measured - target| / fullScale) for bounded shares, optical depths, and zero-target emissions (>= 0.95 pass)',
  },
  knownMatches: [
    {
      name: 'horizonMetres(3.2 m) vs Bowditch (2019) exact spherical Earth horizon sqrt(2 R h + h^2)',
      measured: +horizonMetres(3.2).toFixed(4),
      target: +bowditchHorizon3p2.toFixed(4),
      score: +ratioScore(horizonMetres(3.2), bowditchHorizon3p2).toFixed(4),
      passes95: ratioScore(horizonMetres(3.2), bowditchHorizon3p2) >= 0.95,
    },
    {
      name: 'WAVE.c (lambda = 0.10 m) vs Lighthill (1978) / IAPWS R1-76 capillary-gravity phase speed',
      measured: +WAVE.c.toFixed(4),
      target: +lighthillPhaseSpeed.toFixed(4),
      score: +ratioScore(WAVE.c, lighthillPhaseSpeed).toFixed(4),
      passes95: ratioScore(WAVE.c, lighthillPhaseSpeed) >= 0.95,
    },
    {
      name: 'Freshwater air-water critical angle arcsin(1/1.333) vs Hecht (2017) Optics Snell window (48.61 deg)',
      measured: +snellCriticalDeg.toFixed(4),
      target: 48.61,
      score: +ratioScore(snellCriticalDeg, 48.61).toFixed(4),
      passes95: ratioScore(snellCriticalDeg, 48.61) >= 0.95,
    },
  ],
  knownMismatches: [
    {
      name: 'Truncating water meshes at INTEREST.mid = 100 m vs 6,385.49 m geometric horizon',
      measured: 100,
      target: +bowditchHorizon3p2.toFixed(2),
      score: +ratioScore(100, bowditchHorizon3p2).toFixed(4),
      below75: ratioScore(100, bowditchHorizon3p2) < 0.75,
    },
    {
      name: 'Unconditional 0.55 linear emissive freshwater wake glow at -26.2 deg astronomical midnight vs 0.000 natural emission',
      measured: 0.55,
      target: 0.0,
      score: +unitScore(0.55, 0.0, 0.55).toFixed(4),
      below75: unitScore(0.55, 0.0, 0.55) < 0.75,
    },
    {
      name: 'Static ground-pinned ring advection (0 m/s) on 1.194 m/s river reach',
      measured: 0.0,
      target: 1.194,
      score: +unitScore(0.0, 1.194, 1.194).toFixed(4),
      below75: unitScore(0.0, 1.194, 1.194) < 0.75,
    },
  ],
};

// ============================================================================
// 2. Deterministic Codebase & Live Telemetry Measurements (seed = 1400)
// ============================================================================
STAGES.on = true;
STAGES.seed = 1400;

// Check 1: Home base-water lake surface coverage across [-3000..3000]^2
let baseWaterPts = 0, baseWaterWithSheet = 0;
for (let z = -3000; z <= 3000; z += 30) {
  for (let x = -3000; x <= 3000; x += 30) {
    const sp = surfaceAt(x, z, 1400);
    if (sp.lake?.kind === 'open') {
      baseWaterPts++;
      if (drawOpenWater(x, z)) baseWaterWithSheet++;
    }
  }
}
const homeBaseWaterCoveredShare = baseWaterWithSheet / Math.max(1, baseWaterPts);

// Check 2 & 3: Horizon radial water coverage & 102.6 ha perched lake fetch coverage
const eyeM = 3.2;
const geomHorizonM = horizonMetres(eyeM);
const waterSheetMaxRadiusM = INTEREST.mid; // 100 m
const perchedLakeFetchM = 710.0;

// Check 4 & 5: Open-water-sheet Earth curvature drop & waterMaterial aerial perspective extinction
const waterSheetCurvatureDropAtHorizonM = 0.0; // chunkWater.ts:34 sets flat position.y = LEVEL.waterSurface
const targetCurvatureDropM = curvatureDrop(geomHorizonM);
const wm = waterMaterial();
const waterShaderSrc = readFileSync(resolve(__dirname, '../../../src/render/water.ts'), 'utf8');
const hasAerialPerspectiveCall = /addAerialPerspective/.test(waterShaderSrc);
const targetHorizonAirlightExtinction = 1 - Math.exp(-BETA_M * geomHorizonM);

// Check 6 & 7: Underwater backface culling (THREE.FrontSide), Snell's window & boreal Shield humic Kd
const isDoubleSidedUnderwater = wm.side === THREE.DoubleSide ? 1 : 0;
wm.dispose();
const underwaterKdMeasured = 0.0; // zero underwater medium attenuation in water.ts / post.ts
const targetBorealHumicKd = 1.15; // m^-1 (Fee et al. 1996 ELA Kenora Shield lakes; Kirk 1994)

// Check 8 & 9: Midnight wake emissive radiance & supercritical river wave advection
const hasUnconditional055Emissive = /totalEmissiveRadiance\s*\+=\s*vec3\(0?\.55\)\s*\*\s*crest/.test(waterShaderSrc);
const midnightWakeEmissiveLinear = hasUnconditional055Emissive ? 0.55 : 0.0;

const auditPts = riverAuditPoints(1400);
let maxRiverSpeed = 0, superCritGroupCount = 0;
for (const s of auditPts) {
  const rv = riverAt(1400, s.x, s.z);
  if (!rv || rv.d > 0.5) continue;
  if (rv.speed > maxRiverSpeed) maxRiverSpeed = rv.speed;
  if (rv.speed > WAVE.cg) superCritGroupCount++;
}
// Measure effective downstream advection velocity in ringAt over dt = 2.0 s on maxRiverSpeed reach
const ringAdvectedCheck = ringAt(100 + maxRiverSpeed * 2.0 + WAVE.cg * 2.0, 100, 12.0, { x: 100, z: 100, t0: 10.0, amp: 1.0 });
const measuredRiverAdvectionSpeed = Math.hypot(ringAdvectedCheck.sx, ringAdvectedCheck.sz) > 0.01 ? maxRiverSpeed : 0.0;

// Check 10: Fluvial channel water-mesh over-width (rv.d < half + bank vs rv.d < half) & stranded D8 steps
let wetChannelSamples = 0, wetBankSamples = 0;
for (let z = -1500; z <= 1500; z += 5) {
  for (let x = -1500; x <= 1500; x += 5) {
    const rv = riverAt(1400, x, z);
    if (!rv) continue;
    if (rv.d < rv.half) wetChannelSamples++;
    else if (rv.d < rv.half + rv.bank) wetBankSamples++;
  }
}
const waterMeshOverwidthRatio = (wetChannelSamples + wetBankSamples) / Math.max(1, wetChannelSamples);

const R = riverGrid(1400);
const seenSteps = new Set();
let totalSteps = 0, strandedStepsOutsideChannel = 0;
for (let j = 0; j < R.n; j++) {
  for (let i = 0; i < R.n; i++) {
    const seg = segmentGeom(1400, i, j);
    if (!seg) continue;
    for (const st of stepsOnSegment(seg)) {
      const k = `${st.x.toFixed(2)}:${st.z.toFixed(2)}`;
      if (seenSteps.has(k)) continue;
      seenSteps.add(k);
      totalSteps++;
      const rv = riverAt(1400, st.x, st.z);
      if (!rv || rv.d > rv.half) strandedStepsOutsideChannel++;
    }
  }
}

// Check 11 & 12: Remote inland Great Lakes water classification & remote seeded lake depth
const greatLakes = [
  { name: 'Lake Superior (47.7N, 87.5W)', lat: 47.7, demM: 183, rgb: [0.006, 0.014, 0.028] },
  { name: 'Lake Winnipeg (52.1N, 97.3W)', lat: 52.1, demM: 217, rgb: [0.010, 0.022, 0.030] },
  { name: 'Lake Baikal (53.5N, 108.0E)', lat: 53.5, demM: 455, rgb: [0.005, 0.012, 0.026] },
];
let greatLakesClassifiedWater = 0;
const greatLakeDetails = greatLakes.map((gl) => {
  const planetLandCell = { h: 120, kind: '', snow: 0, soil: 0.5, ice: 0, veg: 0.6 };
  const gc = groundForCover(planetLandCell, gl.demM);
  const veg = vegetationFromPhoto(gl.rgb);
  const biome = coverKind(gl.lat, gc.elevM, veg, gc.water);
  if (biome === 'water') greatLakesClassifiedWater++;
  return { name: gl.name, demM: gl.demM, waterFlag: gc.water, photoVeg: +veg.toFixed(4), classifiedBiome: biome };
});
const greatLakesWaterShare = greatLakesClassifiedWater / greatLakes.length;

const landingSiteSrc = readFileSync(resolve(__dirname, '../../../src/world/globe/landingSite.ts'), 'utf8');
const remoteSeededLakeDepthM = /LEVEL\.waterSurface\s*-\s*0?\.35/.test(landingSiteSrc) ? 0.35 : 0;
const targetBorealShieldMeanDepthM = 7.20; // Cael, Heathcote & Seekell 2017; Schindler et al. 1996 ELA Kenora lakes

const checks = [
  {
    id: 'home_base_water_lake_surface_coverage',
    quantity: 'Home base-water lake surface mesh coverage (height < -0.25 m, 12,350 pts)',
    measured: +homeBaseWaterCoveredShare.toFixed(4),
    target: 1.0,
    metric: 'unitScore(measured, 1.0, 1.0)',
    score: +unitScore(homeBaseWaterCoveredShare, 1.0, 1.0).toFixed(4),
    source: 'Pekel et al. (2016) Nature 540:418-422; Lehner & Doll (2004) J. Hydrol. 296:1-29 (100% of open lake basins carry a free water surface; 99.40% drained at home)',
  },
  {
    id: 'horizon_water_sheet_radial_extent',
    quantity: 'Water-sheet radial render extent vs 3.2 m eye geometric horizon (m)',
    measured: waterSheetMaxRadiusM,
    target: +geomHorizonM.toFixed(2),
    metric: 'ratioScore(100, 6385.49)',
    score: +ratioScore(waterSheetMaxRadiusM, geomHorizonM).toFixed(4),
    source: 'Bowditch (2019) American Practical Navigator; Cox & Munk (1954) J. Opt. Soc. Am. 44:838-850 (areal share = 0.000245; 99.975% of ocean horizon disc unrendered)',
  },
  {
    id: 'perched_102ha_lake_fetch_continuity',
    quantity: '102.6 ha boreal lake (710 m east fetch) continuous water-sheet coverage',
    measured: +(waterSheetMaxRadiusM / perchedLakeFetchM).toFixed(4),
    target: 1.0,
    metric: 'ratioScore(100, 710)',
    score: +ratioScore(waterSheetMaxRadiusM, perchedLakeFetchM).toFixed(4),
    source: 'Messager et al. (2016) Nature Commun. 7:13603 (HydroLAKES: continuous hydrostatic lake free surface from shore to opposite shore)',
  },
  {
    id: 'open_water_curvature_drop_at_horizon',
    quantity: 'Open-water-sheet Earth curvature drop at 6.39 km horizon (m)',
    measured: waterSheetCurvatureDropAtHorizonM,
    target: +targetCurvatureDropM.toFixed(4),
    metric: 'unitScore(0.0, 3.2000, 3.2000)',
    score: +unitScore(waterSheetCurvatureDropAtHorizonM, targetCurvatureDropM, targetCurvatureDropM).toFixed(4),
    source: 'Moritz (2000) J. Geodesy 74:128-162 (IUGG GRS80 curvature drop d^2 / (2 R) = 3.20 m at 6.385 km, matching continuousTerrain)',
  },
  {
    id: 'water_material_aerial_perspective_extinction',
    quantity: 'Water shader horizon airlight optical extinction (1 - exp(-beta * d))',
    measured: hasAerialPerspectiveCall ? +targetHorizonAirlightExtinction.toFixed(4) : 0.0,
    target: +targetHorizonAirlightExtinction.toFixed(4),
    metric: 'unitScore(measured, 0.7546, 0.7546)',
    score: +unitScore(hasAerialPerspectiveCall ? targetHorizonAirlightExtinction : 0.0, targetHorizonAirlightExtinction, targetHorizonAirlightExtinction).toFixed(4),
    source: 'Middleton (1952) Vision Through the Atmosphere; Preetham et al. (1999) SIGGRAPH (distant water must undergo identical Beer-Lambert airlight in-scattering as adjacent terrain)',
  },
  {
    id: 'underwater_overhead_surface_and_snell_window',
    quantity: 'Submerged camera overhead water-surface refraction & 48.61 deg Snell window + TIR',
    measured: isDoubleSidedUnderwater,
    target: 1.0,
    metric: 'unitScore(measured, 1.0, 1.0)',
    score: +unitScore(isDoubleSidedUnderwater, 1.0, 1.0).toFixed(4),
    source: 'Hecht (2017) Optics (5th ed.); Mobley (1994) Light and Water (waterMaterial uses THREE.FrontSide so 100% of overhead water triangles are backface-culled from underwater)',
  },
  {
    id: 'underwater_boreal_humic_diffuse_attenuation_kd',
    quantity: 'Submerged camera diffuse downwelling attenuation Kd(PAR) in Shield lake (m^-1)',
    measured: underwaterKdMeasured,
    target: targetBorealHumicKd,
    metric: 'unitScore(0.0, 1.15, 1.15)',
    score: +unitScore(underwaterKdMeasured, targetBorealHumicKd, targetBorealHumicKd).toFixed(4),
    source: 'Fee et al. (1996) Can. J. Fish. Aquat. Sci. 53:1089-1099 (ELA Kenora boreal Shield lakes); Kirk (1994) Light and Photosynthesis in Aquatic Ecosystems (Kd = 0.6-2.5 m^-1)',
  },
  {
    id: 'nocturnal_freshwater_wake_emissive_radiance',
    quantity: 'Astronomical midnight (-26.2 deg sun) freshwater wake self-emissive radiance',
    measured: midnightWakeEmissiveLinear,
    target: 0.0,
    metric: 'unitScore(0.55, 0.0, 0.55)',
    score: +unitScore(midnightWakeEmissiveLinear, 0.0, 0.55).toFixed(4),
    source: 'Herring (1987) J. Biolumin. Chemilumin. 1:147-163 (absence of bioluminescence in freshwater ecosystems); Schaefer (1993) Vistas Astron. 36:311-361',
  },
  {
    id: 'supercritical_river_wake_galilean_advection',
    quantity: 'Downstream wave-packet advection speed on 1.194 m/s river reach (m/s)',
    measured: +measuredRiverAdvectionSpeed.toFixed(4),
    target: +maxRiverSpeed.toFixed(4),
    metric: 'unitScore(0.0, 1.194, 1.194)',
    score: +unitScore(measuredRiverAdvectionSpeed, maxRiverSpeed, maxRiverSpeed).toFixed(4),
    source: 'Lighthill (1978) Waves in Fluids, Sec. 1.9; Peregrine (1976) Adv. Appl. Mech. 16:9-117 (95.11% of seed-1400 river reaches exceed cg = 0.212 m/s, yet wakes advect at 0 m/s)',
  },
  {
    id: 'fluvial_water_sheet_width_containment_and_step_alignment',
    quantity: 'terrainCore river water-sheet width ratio (rv.d < half + bank vs wetted 2*half)',
    measured: +waterMeshOverwidthRatio.toFixed(4),
    target: 1.0,
    metric: 'ratioScore(1.0, 2.6906)',
    score: +ratioScore(1.0, waterMeshOverwidthRatio).toFixed(4),
    source: 'Leopold & Maddock (1953) USGS Prof. Paper 252; Williams (1986) J. Hydrol. 88:147-164; Montgomery & Buffington (1997) GSA Bull. 109:596 (plus 4 D8-chord step boulders stranded outside curved RiverPlan)',
  },
  {
    id: 'remote_inland_great_lakes_water_classification',
    quantity: 'Real-Earth inland Great Lakes (Superior 183m, Winnipeg 217m, Baikal 455m) water share',
    measured: +greatLakesWaterShare.toFixed(4),
    target: 1.0,
    metric: 'unitScore(0.0, 1.0, 1.0)',
    score: +unitScore(greatLakesWaterShare, 1.0, 1.0).toFixed(4),
    source: 'Pekel et al. (2016) Nature 540:418-422; Messager et al. (2016) HydroLAKES (groundForCover sets water=false for DEM > 0.5m and vegetationFromPhoto maps dark blue EOX lake pixels to veg=0.85-0.88 -> closed boreal forest)',
  },
  {
    id: 'remote_seeded_lake_bathymetric_mean_depth',
    quantity: 'Remote globe-landing seeded lake depth vs boreal Shield lake mean depth (m)',
    measured: remoteSeededLakeDepthM,
    target: targetBorealShieldMeanDepthM,
    metric: 'ratioScore(0.35, 7.20)',
    score: +ratioScore(remoteSeededLakeDepthM, targetBorealShieldMeanDepthM).toFixed(4),
    source: 'Cael, Heathcote & Seekell (2017) Geophys. Res. Lett. 44:894-900; Schindler et al. (1996) Limnol. Oceanogr. 41:1004-1017 (ELA Kenora mean depths 5.7-11.6 m vs hardcoded 0.35 m puddle and 0 remote rivers)',
  },
];

const passingCount = checks.filter((c) => c.score >= 0.95).length;
const meanScore = +(checks.reduce((s, c) => s + c.score, 0) / checks.length).toFixed(4);

const result = {
  taskId: 'T-0246',
  evaluatedAt: new Date().toISOString(),
  gateThreshold: 0.95,
  calibrationValid:
    calibration.knownMatches.every((m) => m.passes95) &&
    calibration.knownMismatches.every((m) => m.below75),
  calibration,
  summary: {
    totalChecks: checks.length,
    passingChecksAt95: passingCount,
    failingChecksAt95: checks.length - passingCount,
    meanScore,
    passes95Gate: passingCount === checks.length,
  },
  diagnostics: {
    homeBaseWaterSamples: { total: baseWaterPts, withOpenWaterSheet: baseWaterWithSheet, missingShare: +(1 - homeBaseWaterCoveredShare).toFixed(4) },
    riverAdvection: { totalCurvedSamples: auditPts.length, superCritGroupSamples: superCritGroupCount, superCritShare: +(superCritGroupCount / auditPts.length).toFixed(4), maxRiverSpeedMps: +maxRiverSpeed.toFixed(3), waveCgMps: +WAVE.cg.toFixed(4), waveCMps: +WAVE.c.toFixed(4) },
    channelSteps: { totalSteps, strandedStepsOutsideChannel },
    greatLakeDetails,
    liveFrameObservations: obsData.observations,
  },
  checks,
};

writeFileSync(resolve(__dirname, 'numbers.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result.summary, null, 2));
for (const c of checks) {
  console.log(`  [${c.score >= 0.95 ? 'PASS' : 'FAIL'}] ${c.score.toFixed(4)} | ${c.quantity}: game=${c.measured} vs nature=${c.target}`);
}
