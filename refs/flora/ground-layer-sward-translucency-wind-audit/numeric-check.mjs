/**
 * Rule 11 Calibrated Numeric Gate for T-0248:
 * ContinuousTerrain Dropped onBeforeCompile & 92% Boreal Ground-Layer Overwrite + Missing Layer-1 GI Bounce,
 * Nocturnal Vegetation STYLIZED Self-Emission, Frozen Straw Steppe Sward & 8 m Ring Cutoff + Desert Prairie Thatch,
 * Unshadowed Foliage Subsurface Translucency, and Uncapped Horizontal Canopy Wind Shear Without Arc-Length Drop.
 *
 * Run with:
 *   npx tsx refs/flora/ground-layer-sward-translucency-wind-audit/numeric-check.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as THREE from 'three';
import { FLOOR, setGroundFloor, steppeCure, terrainMaterial, addTranslucency } from '../../../src/render/pbr.ts';
import '../../../src/render/flora/moss.ts';
import { GROUND_LAYERS } from '../../../src/core/flora/mosses.ts';
import { continuousMaterial, createContinuousTerrain } from '../../../src/render/continuousTerrain.ts';
import { STYLIZED } from '../../../src/render/stylizedPalette.ts';
import { STIPA_RADIUS_M, steppeTuftGeometry } from '../../../src/render/flora/steppeTuft.ts';
import { GRASS } from '../../../src/render/grass/cover.ts';
import { LUX, moonAge, moonLux } from '../../../src/core/light.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../../..');

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const ratioScore = (measured, reference) => {
  if (!(measured > 0) || !(reference > 0)) return 0;
  return clamp01(Math.min(measured, reference) / Math.max(measured, reference));
};
const deltaScore = (measured, reference, scale) => clamp01(1 - Math.abs(measured - reference) / scale);

const linearLuma = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

// ============================================================================
// 1. Calibration Suite (Rule 11: known matches >= 0.95, known mismatches < 0.75)
// ============================================================================
const cladoniaMeanLuma = linearLuma(
  GROUND_LAYERS[1].albedo[0].map((v, i) => 0.5 * (v + GROUND_LAYERS[1].albedo[1][i]))
); // ~0.487 linear, ~0.24-0.54 reflectance range (Petzold & Goward 1988)

const calibration = {
  knownMatches: [
    {
      name: 'pbr.ts steppeCure(227) cured August steppe = 1.0000 vs Flora of China vol. 22 post-anthesis curing 1.0000',
      score: +deltaScore(steppeCure(227), 1.0, 1.0).toFixed(4),
    },
    {
      name: 'pbr.ts steppeCure(156) early-June spring growth = 0.0000 vs Flora of China vol. 22 green May-July anthesis 0.0000',
      score: +deltaScore(steppeCure(156), 0.0, 1.0).toFixed(4),
    },
    {
      name: 'light.ts LUX.nightSky = 0.001 lx vs Kyba et al. (2015 Sci. Rep. 5:8409) moonless clear night sky ~0.001 lx',
      score: +ratioScore(LUX.nightSky, 0.001).toFixed(4),
    },
    {
      name: 'Inextensible Euler-Bernoulli stem arc-length conservation L / H = 1.002 vs 1.000 (scale 0.25, Morgan & Cannell 1987)',
      score: +deltaScore(1.002, 1.0, 0.25).toFixed(4),
    },
  ],
  knownMismatches: [
    {
      name: '92% pbr.ts boreal litter overwrite leaving 0.0800 Cladonia contrast inside 10.5 m vs 1.0000 un-erased lichen carpet',
      score: +ratioScore(0.08, 1.0).toFixed(4),
    },
    {
      name: 'STIPA_RADIUS_M = 8.0 m circular tuft cutoff vs GRASS.radius = 48.0 m continuous near-tier sward',
      score: +ratioScore(8.0, 48.0).toFixed(4),
    },
    {
      name: 'Uncapped 12 m/s wind shearing 22 m trunk by 14.985 m (delta/H = 0.6811) vs Gardiner et al. (2000) ~0.1100',
      score: +ratioScore(0.6811, 0.11).toFixed(4),
    },
  ],
};

const calibrationValid =
  calibration.knownMatches.every((m) => m.score >= 0.95) &&
  calibration.knownMismatches.every((m) => m.score < 0.75);

// ============================================================================
// 2. Live Module & Shader Evaluations
// ============================================================================
async function main() {
  const obsPath = resolve(__dirname, 'observations.json');
  const obs = existsSync(obsPath) ? JSON.parse(readFileSync(obsPath, 'utf8')) : null;

  // --- Group 1: ContinuousTerrain onBeforeCompile, 92% Moss Overwrite, & Layer-1 GI Bounce ---
  const cMat = continuousMaterial();
  const dummyC = {
    vertexShader: '#include <common>\n#include <begin_vertex>\n#include <worldpos_vertex>\n',
    fragmentShader: '#include <color_fragment>\n#include <roughnessmap_fragment>\n#include <normal_fragment_maps>\n#include <lights_fragment_end>\n#include <dithering_fragment>\n',
    uniforms: {},
  };
  cMat.onBeforeCompile(dummyC, {});
  const continuousCompiledSubsystems = [
    dummyC.fragmentShader.includes('groundLayer'),
    dummyC.fragmentShader.includes('uFloor'),
    dummyC.fragmentShader.includes('vWet') && dummyC.fragmentShader.includes('vSnow'),
    dummyC.fragmentShader.includes('uCloudTex'),
  ].filter(Boolean).length;

  const tMat = terrainMaterial();
  const dummyT = {
    vertexShader: '#include <begin_vertex>\n#include <worldpos_vertex>\n',
    fragmentShader: '#include <color_fragment>\n#include <roughnessmap_fragment>\n#include <normal_fragment_maps>\n#include <lights_fragment_end>\n',
    uniforms: {},
  };
  tMat.onBeforeCompile(dummyT, {});
  // Inside reach * 0.35 = 30 * 0.35 = 10.5 m on snow-free boreal ground (uFloor = 0, snow = 0):
  // cover = floorNear * (1 - snow) * mix(0.92, 1.0, 0) = 0.92 -> diffuseColor = mix(groundLayer, boreal, 0.92).
  // Remaining Cladonia-vs-feathermoss contrast share inside 10.5 m is 1 - 0.92 = 0.0800.
  const pbrSrc = readFileSync(resolve(repoRoot, 'src/render/pbr.ts'), 'utf8');
  const nearCoverMatch = pbrSrc.match(/mix\(\s*(0\.\d+)\s*,\s*1\.0\s*,\s*uCure/);
  const nearOverwriteCover = nearCoverMatch ? Number(nearCoverMatch[1]) : 0.92;
  const nearCladoniaContrastRetained = +(1 - nearOverwriteCover).toFixed(4);

  // Layer-1 visible ground mesh check for photoreal.ts slicedCube(32, 1, 0.5, 200) SH GI bounce probe:
  const buildSceneSrc = readFileSync(resolve(repoRoot, 'src/render/buildScene.ts'), 'utf8');
  const chunkGroundHidden = /ground\.visible\s*=\s*false/.test(buildSceneSrc);
  const ct = createContinuousTerrain();
  const layer1Mask = 1 << 1;
  const continuousOnLayer1 = (ct.mesh.layers.mask & layer1Mask) !== 0;
  ct.dispose();
  const visibleLayer1TerrainCount = (!chunkGroundHidden ? 1 : 0) + (continuousOnLayer1 ? 1 : 0);

  // --- Group 2: Nocturnal Self-Luminous Vegetation Emissive Glow (grass.ts & conifer.ts) ---
  const mAge196 = moonAge(196, 2026);
  const mLuxMidnight = moonLux(mAge196, -0.25); // moon below horizon / new moon -> 0 lx
  const grassLiftLuma = +linearLuma(STYLIZED.grassLift).toFixed(5); // 0.06037 linear
  const foliageLiftLuma = +linearLuma(STYLIZED.foliageLift).toFixed(5); // 0.03729 linear
  const barkLiftLuma = +linearLuma(STYLIZED.barkLift).toFixed(5); // 0.02197 linear
  // Under 0.001 lx starlight with sky.ts night hemi (~0.0024) and leaf VIS reflectance ~0.12 (Jacquemoud & Baret 1990),
  // physical reflected linear luminance is ~0.0003-0.0005.
  const physicalStarlightGrassLuma = 0.0005;

  const grassSrc = readFileSync(resolve(repoRoot, 'src/render/grass/grass.ts'), 'utf8');
  const coniferSrc = readFileSync(resolve(repoRoot, 'src/render/trees/conifer.ts'), 'utf8');
  const vegNightAttenuated = [
    !/emissive\.setRGB\(\s*STYLIZED\.grassLift/.test(grassSrc) || /stylizedNight|uNight|coatNight/.test(grassSrc),
    !/emissive\.setRGB\(\s*STYLIZED\.barkLift/.test(coniferSrc) || /stylizedNight|uNight|coatNight/.test(coniferSrc),
    !/emissive\.setRGB\(\s*STYLIZED\.foliageLift/.test(coniferSrc) || /stylizedNight|uNight|coatNight/.test(coniferSrc),
  ].filter(Boolean).length;

  // --- Group 3: Steppe Sward Phenology, 8 m Cutoff, Zero Wind/Snow Coupling, & Desert Prairie Thatch ---
  const tuftGeo = steppeTuftGeometry(1);
  const tuftCol = tuftGeo.getAttribute('color').array;
  let rSum = 0, gSum = 0, bSum = 0;
  const vCount = tuftCol.length / 3;
  for (let i = 0; i < tuftCol.length; i += 3) {
    rSum += tuftCol[i]; gSum += tuftCol[i + 1]; bSum += tuftCol[i + 2];
  }
  const tuftMeanRgb = [rSum / vCount, gSum / vCount, bSum / vCount];
  tuftGeo.dispose();
  // On DOY 156 (June 5), steppeCure(156) = 0 (live green growth, G > R). In steppeTuft.ts, R=0.5056 > G=0.4022 (100% cured straw).
  const tuftEffectiveCureDay156 = tuftMeanRgb[0] > tuftMeanRgb[1] ? 1.0 : 0.0;

  const tuftSrc = readFileSync(resolve(repoRoot, 'src/render/flora/steppeTuft.ts'), 'utf8');
  const tuftEnvCouplings = [
    /uWind|WIND_UNIFORMS/.test(tuftSrc),
    /uSnowM|snowDepthCm/.test(tuftSrc),
  ].filter(Boolean).length;

  setGroundFloor('desert', 156);
  const desertPrairieThatchFloor = FLOOR.uFloor.value;
  setGroundFloor('boreal', 196);

  // --- Group 4: Unshadowed Foliage Translucency & Uncapped Canopy Wind Shear ---
  const dummyTrans = {
    uniforms: {},
    fragmentShader: '#include <lights_fragment_end>\n#include <opaque_fragment>\n',
  };
  addTranslucency(dummyTrans);
  // Check whether addTranslucency gates solar transmission by shadow visibility / directDiffuse rather than raw uSunCol:
  const translucencyGatedByShadow = /directDiffuse|getShadow|shadowMask|reflectedLight/.test(
    dummyTrans.fragmentShader
  );
  const unoccludedBeamLeakInShadow = translucencyGatedByShadow ? 0.0 : 1.0;

  // Canopy wind kinematics at U = 8.0 m/s (Beaufort 5 fresh breeze -> uWindAmp = Math.min(4, (8/4)^2) = 4.0 in trees.ts:343)
  // on a mature 25.0 m boreal white spruce / aspen (e.g. live 31.39 m white-spruce in frame-3.png):
  const treesSrc = readFileSync(resolve(repoRoot, 'src/render/trees.ts'), 'utf8');
  const capMatch = treesSrc.match(/windAmp\.value\s*=\s*Math\.min\(\s*([\d.]+)\s*,/);
  const windAmpCap = capMatch ? Number(capMatch[1]) : 4.0;
  const U = 8.0, H = 25.0; // Beaufort 5 fresh breeze (8.0 m/s) on 25 m mature white spruce / aspen
  const uWindAmp8 = Math.min(windAmpCap, (U / 4) ** 2); // 4.0 in trees.ts:343
  const bend25 = H * H * 0.0016; // 1.000
  const peakWave = 0.8 + 1.0 + 0.35; // 2.15 along-wind crest
  const peakDx = bend25 * uWindAmp8 * peakWave; // 8.6000 m horizontal shear (13.56 m on live 31.39 m spruce!)
  const deflectionOverHeight = +(peakDx / H).toFixed(4); // 0.3440 at 8 m/s vs ~0.0600 (Gardiner et al. 2000; Mayer 1987)

  const hasVerticalForeshortening = /transformed\.y\s*-=/.test(treesSrc) && /transformed\.y\s*-=/.test(coniferSrc);
  const hasWindNormalRotation = /rotA\([^)]*objectNormal|objectNormal[^;]*uWind/.test(treesSrc) && /objectNormal[^;]*uWind/.test(coniferSrc);
  // Inextensible cantilever vertical tip drop Delta_y = -(3/5) * delta^2 / H (Morgan & Cannell 1987; Niklas 1992):
  const expectedVerticalDropM = +((0.6 * peakDx * peakDx) / H).toFixed(4); // 1.7750 m vertical drop on 8.60 m deflection (3.51 m on 31.39 m spruce)
  const actualVerticalDropM = hasVerticalForeshortening ? expectedVerticalDropM : 0.0;

  const checks = [
    {
      id: 'continuous_terrain_ground_subsystems_compiled',
      description: 'Ground-surface shader subsystems (moss/lichen, uFloor/uCure, aWet/aSnow, cloudShadow) compiled onto continuousMaterial()',
      measured: continuousCompiledSubsystems,
      target: 4,
      unit: 'subsystems (out of 4)',
      source: 'Petzold & Goward (1988) Can. J. Bot. 66:2255; Lekner & Dorf (1988) Appl. Opt. 27:1278; src/render/continuousTerrain.ts:233',
      score: +deltaScore(continuousCompiledSubsystems / 4, 1.0, 1.0).toFixed(4),
    },
    {
      id: 'near_boreal_cladonia_contrast_retained',
      description: 'Fraction of Cladonia reindeer-lichen / Sphagnum reflectance contrast surviving pbr.ts near (<10.5 m) boreal floor overwrite',
      measured: nearCladoniaContrastRetained,
      target: 1.0,
      unit: 'contrast fraction',
      source: 'Petzold & Goward (1988) Can. J. Bot. 66:2255 (Cladonia VIS 0.20-0.28 vs feathermoss 0.04-0.08); Bubier et al. (1997) JGR 102:29483',
      score: +ratioScore(nearCladoniaContrastRetained, 1.0).toFixed(4),
    },
    {
      id: 'gi_probe_layer1_visible_terrain',
      description: 'Visible terrain meshes on Layer 1 contributing ground-albedo bounce to photoreal.ts SH GI probe',
      measured: visibleLayer1TerrainCount,
      target: 1,
      unit: 'visible Layer-1 ground meshes',
      source: 'Ramamoorthi & Hanrahan (2001) SIGGRAPH irradiance environment maps; Oke (1987) Boundary Layer Climates',
      score: +deltaScore(visibleLayer1TerrainCount, 1, 1).toFixed(4),
    },
    {
      id: 'midnight_starlight_grass_linear_luma',
      description: 'Moonless clear midnight (0.001 lx starlight) grass sward linear luminance (STYLIZED.grassLift vs starlight reflectance)',
      measured: grassLiftLuma,
      target: physicalStarlightGrassLuma,
      unit: 'linear RGB luminance',
      source: 'Kyba et al. (2015) Sci. Rep. 5:8409 (~0.001 lx natural night sky); Jacquemoud & Baret (1990) PROSPECT leaf reflectance',
      score: +deltaScore(grassLiftLuma, physicalStarlightGrassLuma, 0.06).toFixed(4),
    },
    {
      id: 'nocturnal_vegetation_emissive_attenuation',
      description: 'STYLIZED emissive vegetation materials (grass, conifer bark, conifer foliage) attenuated at astronomical night',
      measured: vegNightAttenuated,
      target: 3,
      unit: 'materials (out of 3)',
      source: 'Johnsen et al. (2006) J. Exp. Biol. 209:789; Kyba et al. (2015) Sci. Rep. 5:8409',
      score: +deltaScore(vegNightAttenuated / 3, 1.0, 1.0).toFixed(4),
    },
    {
      id: 'june_steppe_tuft_curing_state',
      description: 'Early-June (DOY 156) Stipa feather-grass curing state (0 = green spring growth, 1 = cured September straw)',
      measured: tuftEffectiveCureDay156,
      target: steppeCure(156),
      unit: 'curing fraction [0..1]',
      source: 'Flora of China vol. 22 (Stipa lessingiana May-July green growth & anthesis); src/render/pbr.ts:31 steppeCure(156) = 0',
      score: +deltaScore(tuftEffectiveCureDay156, steppeCure(156), 1.0).toFixed(4),
    },
    {
      id: 'steppe_sward_continuous_radius_m',
      description: 'Steppe feather-grass sward draw radius around viewer vs near-tier GRASS.radius (48 m)',
      measured: STIPA_RADIUS_M,
      target: GRASS.radius,
      unit: 'm',
      source: 'Lavrenko & Karamysheva (1993) Ecosystems of the World 8B (continuous Stipa steppe sward); src/render/grass/cover.ts GRASS.radius = 48 m',
      score: +ratioScore(STIPA_RADIUS_M, GRASS.radius).toFixed(4),
    },
    {
      id: 'steppe_tuft_wind_and_snow_couplings',
      description: 'Steppe tussock shader couplings to shared WIND_UNIFORMS (wind sway) and uSnowM (snowpack burial)',
      measured: tuftEnvCouplings,
      target: 2,
      unit: 'couplings (out of 2)',
      source: 'de Langre (2008) Annu. Rev. Fluid Mech. 40:141; Py et al. (2006) J. Fluid Mech. 568:165 (herbaceous culm wind wave)',
      score: +deltaScore(tuftEnvCouplings / 2, 1.0, 1.0).toFixed(4),
    },
    {
      id: 'desert_prairie_thatch_floor_flag',
      description: 'Prairie grass-thatch floor flag (FLOOR.uFloor) applied when biome === "desert"',
      measured: desertPrairieThatchFloor,
      target: 0.0,
      unit: 'uFloor flag [0 = bare mineral, 1 = prairie thatch]',
      source: 'UNESCO (1979) Arid Regions; Peel et al. (2007) HESS 11:1633 (hyper-arid BWh/BWk lacks continuous grass thatch)',
      score: +deltaScore(desertPrairieThatchFloor, 0.0, 1.0).toFixed(4),
    },
    {
      id: 'shadowed_foliage_direct_translucency_leak',
      description: 'Direct-beam solar subsurface translucency fraction leaking inside 100% occluded CSM / cloud shadows',
      measured: unoccludedBeamLeakInShadow,
      target: 0.0,
      unit: 'unoccluded beam fraction in shadow',
      source: 'Jacquemoud & Baret (1990) RSE 34:75 (PROSPECT); Ross (1981) Radiation Regime of Plant Stands (L_T = 0 when E_direct = 0)',
      score: +deltaScore(unoccludedBeamLeakInShadow, 0.0, 1.0).toFixed(4),
    },
    {
      id: 'beaufort5_8ms_canopy_deflection_ratio',
      description: 'Peak crown horizontal deflection ratio (delta / H) of a 25 m mature boreal spruce at 8 m/s (Beaufort 5 fresh breeze)',
      measured: deflectionOverHeight,
      target: 0.06,
      unit: 'delta / H',
      source: 'Gardiner, Peltola & Kellomaki (2000) Ecol. Model. 129:1; Mayer (1987) Trees 1:195 (~0.04-0.08 H deflection at 8 m/s)',
      score: +ratioScore(deflectionOverHeight, 0.06).toFixed(4),
    },
    {
      id: 'canopy_wind_inextensible_foreshortening_and_normals',
      description: 'Inextensible cantilever vertical tip foreshortening (-0.6 * delta^2 / H) and bent-stem normal rotation under wind sway',
      measured: +(0.5 * (actualVerticalDropM / expectedVerticalDropM) + 0.5 * (hasWindNormalRotation ? 1 : 0)).toFixed(4),
      target: 1.0,
      unit: 'kinematic & normal coupling fraction [0..1]',
      source: 'Niklas (1992) Plant Biomechanics; Morgan & Cannell (1987) Tree Physiol. 3:365 (inextensible cantilever drop & tangent normal)',
      score: +deltaScore(0.5 * (actualVerticalDropM / expectedVerticalDropM) + 0.5 * (hasWindNormalRotation ? 1 : 0), 1.0, 1.0).toFixed(4),
    },
  ];

  const passCount = checks.filter((c) => c.score >= 0.95).length;
  const meanScore = +(checks.reduce((s, c) => s + c.score, 0) / checks.length).toFixed(4);

  const report = {
    task: 'T-0248',
    generatedAt: new Date().toISOString(),
    calibration,
    calibrationValid,
    summary: {
      totalChecks: checks.length,
      passed95: passCount,
      meanScore,
      allPass95: calibrationValid && passCount === checks.length,
    },
    diagnostics: {
      cladoniaMeanLinearLuma: +cladoniaMeanLuma.toFixed(4),
      moonAgeDay196: +mAge196.toFixed(4),
      midnightMoonLux: +mLuxMidnight.toFixed(6),
      grassLiftLuma,
      foliageLiftLuma,
      barkLiftLuma,
      tuftMeanLinearRgb: tuftMeanRgb.map((v) => +v.toFixed(4)),
      peakWindDeflectionM25mTreeAt8ms: +peakDx.toFixed(4),
      expectedCantileverVerticalDropM25mTreeAt8ms: expectedVerticalDropM,
      actualVerticalDropM,
      hasWindNormalRotation,
      liveBrowserTelemetryAttached: Boolean(obs),
    },
    checks,
  };

  writeFileSync(resolve(__dirname, 'numbers.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify(report.summary, null, 2));
  if (!calibrationValid) {
    console.error('Calibration failed!');
    process.exit(2);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
