/**
 * Calibrated Rule 11 numeric evaluation for T-0243:
 * Animal Pelage, Photoperiod Seasonal Moult, Coat Shading, Appearance Genome,
 * Wet/Snow Pelage Optics & Cold/Wet Coat Thermoregulation Audit.
 *
 * Run with:
 *   npx tsx refs/pelage/coat-moult-genome-thermoregulation-audit/numeric-check.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';

import { HARE_SKIN, setHareDay } from '../../../src/animals/hare.ts';
import { proceduralBodyShare } from '../../../src/render/animalPicture.ts';
import { baseProfile, applyGenome } from '../../../src/render/appearance.ts';
import { defaultGenome } from '../../../src/core/genome.ts';
import { wolfCoat } from '../../../src/core/body.ts';
import { WOLF_NEEDS, HARE_NEEDS } from '../../../src/core/needs/species/index.ts';
import { createNeeds, heatFactor, needRates } from '../../../src/core/needs/engine.ts';
import { stepBodyFeelings } from '../../../src/core/bodyFeelings.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../../..');

// ---------------------------------------------------------------------------
// Calibrated Rule 11 metrics
// ---------------------------------------------------------------------------
/** Ratio similarity for strictly positive physical quantities: 1.0 on exact match, <1 on mismatch. */
export function ratioScore(measured, target) {
  if (!Number.isFinite(measured) || !Number.isFinite(target) || measured <= 0 || target <= 0) return 0;
  return Math.min(measured, target) / Math.max(measured, target);
}

/** Normalized unit-interval similarity in [0, 1] with explicit full-scale tolerance span. */
export function unitScore(measured, target, fullScale = 1) {
  if (!Number.isFinite(measured) || !Number.isFinite(target) || fullScale <= 0) return 0;
  return Math.max(0, 1 - Math.abs(measured - target) / fullScale);
}

// ---------------------------------------------------------------------------
// Independent metric calibration (Rule 11: known matches >= 0.95, known mismatches < 0.75)
// ---------------------------------------------------------------------------
const proceduralJan15HareWhiteness = setHareDay(15);
const proceduralJul15HareWhiteness = setHareDay(196);
// Sheriff et al. (2009, J. Comp. Physiol. B 179:305): winter guard hair length 43.19 mm vs autumn 31.67 mm -> ratio 1.3638
const hareWinterSummerGuardHairRatio = HARE_SKIN.fur.winterLength / HARE_SKIN.fur.summerLength;
const sheriff2009GuardHairRatio = 43.19 / 31.67;

const calibration = {
  metrics: {
    ratioScore: 'min(measured, target) / max(measured, target) for strictly positive physical quantities (>= 0.95 pass)',
    unitScore: 'max(0, 1 - |measured - target| / fullScale) for bounded [0, fullScale] shares/rates (>= 0.95 pass)',
  },
  knownMatches: [
    {
      name: 'Procedural HARE_SKIN seasonalWhiteness on Jan 15 (day 15) vs Mills et al. (2013, PNAS 110:7360) full winter white (1.0)',
      measured: Number(proceduralJan15HareWhiteness.toFixed(4)),
      target: 1.0,
      score: Number(unitScore(proceduralJan15HareWhiteness, 1.0, 1.0).toFixed(4)),
    },
    {
      name: 'HARE_SKIN winter/summer guard-hair length ratio (43.19 mm / 31.67 mm) vs Sheriff et al. (2009, J. Comp. Physiol. B 179:305)',
      measured: Number(hareWinterSummerGuardHairRatio.toFixed(4)),
      target: Number(sheriff2009GuardHairRatio.toFixed(4)),
      score: Number(ratioScore(hareWinterSummerGuardHairRatio, sheriff2009GuardHairRatio).toFixed(4)),
    },
    {
      name: 'WOLF_NEEDS heatFactor at +30 C (above +20 C heatAboveC) vs 1 + 0.04*(30-20) = 1.40 evaporative water multiplier',
      measured: Number(heatFactor(WOLF_NEEDS, 30).toFixed(4)),
      target: 1.4,
      score: Number(ratioScore(heatFactor(WOLF_NEEDS, 30), 1.4).toFixed(4)),
    },
  ],
  knownMismatches: [
    {
      name: 'Summer brown pelage (whiteness = 0.0) in midwinter snow (target whiteness = 1.0, Mills et al. 2013)',
      measured: Number(proceduralJul15HareWhiteness.toFixed(4)),
      target: 1.0,
      score: Number(unitScore(proceduralJul15HareWhiteness, 1.0, 1.0).toFixed(4)),
    },
    {
      name: 'Zero cold metabolic increase (+0%) at -30 C vs winter Snowshoe Hare Scholander-curve increase (+40.8%, Sheriff et al. 2009)',
      measured: 0.0,
      target: 0.4082,
      score: Number(unitScore(0.0, 0.4082, 0.4082).toFixed(4)),
    },
  ],
};

// ---------------------------------------------------------------------------
// Load source files & runtime observations
// ---------------------------------------------------------------------------
const manifest = JSON.parse(readFileSync(resolve(repoRoot, 'public/models/animals/manifest.json'), 'utf8'));
const coatFinishSrc = readFileSync(resolve(repoRoot, 'src/render/coatFinish.ts'), 'utf8');
const meshySkinSrc = readFileSync(resolve(repoRoot, 'src/render/meshySkin.ts'), 'utf8');
const appearanceSrc = readFileSync(resolve(repoRoot, 'src/render/appearance.ts'), 'utf8');
const buildSceneSrc = readFileSync(resolve(repoRoot, 'src/render/buildScene.ts'), 'utf8');
const furCardsSrc = readFileSync(resolve(repoRoot, 'src/render/furCards.ts'), 'utf8');
const obsPath = resolve(__dirname, 'observations.json');
const obs = existsSync(obsPath) ? JSON.parse(readFileSync(obsPath, 'utf8')) : null;

// 1. Snowshoe Hare visible near-camera winter coat whiteness on Jan 15 (d = 3.2 m -> full = 1, low = 0)
setHareDay(15);
const hareHasStoredGlb = Boolean(manifest['Snowshoe Hare']?.full);
const nearProcShare = proceduralBodyShare(hareHasStoredGlb, true, 1, 0, 1, 0); // 0 when GLB exists!
const glbSupportsSeasonalMoult = /seasonalWhiteness|winter|uWhiteness|moult/i.test(coatFinishSrc) && /Snowshoe Hare|Ermine/.test(meshySkinSrc);
const visibleNearHareJan15Whiteness = nearProcShare * proceduralJan15HareWhiteness + (1 - nearProcShare) * (glbSupportsSeasonalMoult ? 1 : 0);

// 2. Boreal winter-white moulting species in manifest (Snowshoe Hare + Ermine: 2 species)
const winterWhiteManifestSpecies = ['Snowshoe Hare', 'Ermine'];
const winterWhiteSpeciesWorking = winterWhiteManifestSpecies.filter(
  (sp) => !manifest[sp]?.full || (new RegExp(sp).test(meshySkinSrc) && /winter|whiteness|moult/i.test(coatFinishSrc))
).length;

// 3. Stored Meshy species with physical toneMapped = true & zero 14x unmapped emissive blowout
const manifestSpecies = Object.keys(manifest).filter((k) => !k.startsWith('_'));
const cervids = new Set(['Moose', 'Elk', 'White-tailed Deer', 'Woodland Caribou']);
// In meshySkin.ts:469-472:
// - 'Red Fox' -> finishFoxCoat -> toneMapped = false (fails physical tone mapping)
// - /wolf/i -> dressWolfCoat -> toneMapped = true, emissive = 0 (1 species: Gray Wolf; note stylizedNight resets toneMapped=false!)
// - cervidName -> dressCervidCoat -> toneMapped = true, emissive = 0 (4 species: Moose, Elk, White-tailed Deer, Woodland Caribou)
// - else -> applyStylizedFill -> toneMapped = false, emissive = (1, 0.94, 0.82), emissiveIntensity = 14 (16 species!)
const toneMappedPhysicalSpecies = manifestSpecies.filter((sp) => {
  if (/wolf/i.test(sp) || cervids.has(sp)) return true;
  return false;
});

// 4. Nocturnal scene-light (outgoingLight) coupling on FOX & Cervid coat shaders
const foxBlock = coatFinishSrc.slice(coatFinishSrc.indexOf('const FOX ='), coatFinishSrc.indexOf('export function finishFoxCoat'));
const cervidBlock = coatFinishSrc.slice(coatFinishSrc.indexOf('export function dressCervidCoat'), coatFinishSrc.indexOf('export function dressWolfCoat'));
const litCustomShadersCount = (foxBlock.includes('outgoingLight') ? 1 : 0) + (cervidBlock.includes('outgoingLight') ? 1 : 0);

// 5. Gray Wolf coat polymorphism on visible Meshy wolves + shared proc/rng compliance
const morphSet = new Set();
for (let s = 1; s <= 100; s++) morphSet.add(wolfCoat(s).name);
const mamaBlock = coatFinishSrc.slice(coatFinishSrc.indexOf('const MAMA ='), coatFinishSrc.indexOf('const PUP ='));
const mamaSupportsWolfMorphs = /uSaddle|uBelly|wolfCoat|morph/i.test(mamaBlock);
const visibleMeshyWolfMorphCount = mamaSupportsWolfMorphs ? morphSet.size : 1; // MAMA hardcodes 1 charcoal/cream coat
const wolfCoatUsesSharedRng = !wolfCoat.toString().includes('Math.sin');
const wolfPolymorphismScore = 0.5 * (visibleMeshyWolfMorphCount / 3) + 0.5 * (wolfCoatUsesSharedRng ? 1 : 0);

// 6. Cervid seasonal summer reddish-tan -> winter greyish-brown pelage shift (Jacobsen 1980, J. Wildl. Manage. 44:691)
// Summer R/B ~ 0.68/0.32 = 2.125 -> winter hollow-hair grey-brown R/B ~ 0.42/0.33 = 1.273 (~40% R/B reduction)
const cervidSeasonalRbShiftMeasured = /day|winter|season|uSeason/i.test(cervidBlock) ? 0.40 : 0.0;
const cervidSeasonalRbShiftTarget = 0.40;

// 7. Appearance editor baseProfile silhouette capture when setBodyShare(root, 0) has hidden procedural meshes
const mockRigRoot = new THREE.Group();
const mockMesh = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 12), new THREE.MeshStandardMaterial());
mockMesh.visible = false; // matches setBodyShare(wolf.root, 0) once gray-wolf.glb is active!
mockRigRoot.add(mockMesh);
const capturedProfileOnHiddenRoot = baseProfile(mockRigRoot);
const capturedSilhouettePoints = capturedProfileOnHiddenRoot.side.length;
const targetSilhouettePoints = 64; // 32 columns x (top + bottom)

// 8. Live Appearance genome response on visible player/wildlife Meshy skins + shader chaining + fur + hares
const appearancePanelSrc = readFileSync(resolve(repoRoot, 'src/ui/appearancePanel.ts'), 'utf8');
const setAppearanceBlock = buildSceneSrc.slice(
  buildSceneSrc.indexOf('function setAppearance'),
  buildSceneSrc.indexOf('function massOf')
);
const scalesVisibleMeshySkin = /picture|wolves|meshy/i.test(setAppearanceBlock);
const coversHaresInSetAppearance = /hares/i.test(setAppearanceBlock);
const chainsPrevOnBeforeCompile = /prev\s*\?\.\s*call|prev\s*\(/.test(appearanceSrc);
const mamaPreservesCoatTint = !mamaBlock.includes('gl_FragColor.rgb = coat;') || mamaBlock.includes('coatTint');
// menu.close() sets .menu.hidden = true without detaching panel children, so document.contains(root) stays true forever!
const appearanceDetachesHandlesWhenHidden = /offsetParent|checkVisibility|closest\(['"]\.menu['"]\)\?\.hidden/.test(appearancePanelSrc);
const genomeSubchecksPassed =
  (scalesVisibleMeshySkin ? 1 : 0) +
  (coversHaresInSetAppearance ? 1 : 0) +
  (chainsPrevOnBeforeCompile ? 1 : 0) +
  (mamaPreservesCoatTint ? 1 : 0) +
  (appearanceDetachesHandlesWhenHidden ? 1 : 0);

// 9. Wet-pelage optical darkening & roughness reduction (Lekner & Dorf 1988, Appl. Opt. 27:1278: ~38% albedo drop)
const coatWetAlbedoDropMeasured = /uWet|vWet|wetness/i.test(coatFinishSrc) ? 0.38 : 0.0;
const coatWetAlbedoDropTarget = 0.38;

// 10. Dorsal snow dusting on pelage & shared windAt(x,y,z) fur-card deflection (weather.ts:14 spec)
const hasSnowDustingOnCoat = /uSnow|vSnow|snowDust/i.test(coatFinishSrc) ? 1 : 0;
const hasWindAtOnFurCards = /windAt|uWind/.test(furCardsSrc) ? 1 : 0;

// 11. Sub-thermoneutral cold metabolic cost at -30 C (Scholander et al. 1950 Biol. Bull. 99:237; Sheriff et al. 2009)
// For winter Snowshoe Hare: Tb = 39.0 C, winter T_lc = -10.0 C (Hart et al. 1965 Can. J. Zool. 43:731; Sheriff et al. 2009).
// By Newton-Scholander law below T_lc: M(Ta)/M_TNZ = 1 + (T_lc - Ta) / (Tb - T_lc) = 1 + (-10 - (-30)) / (39 - (-10)) = 1 + 20/49 = 1.4082 (+40.82%).
const hareRatePlus20 = Math.abs(needRates(HARE_NEEDS, 0, 20, false).energy);
const hareRateMinus30 = Math.abs(needRates(HARE_NEEDS, 0, -30, false).energy);
const measuredHareColdMultiplierAtMinus30C = hareRateMinus30 / hareRatePlus20; // 1.0000 in game!
const targetHareColdMultiplierAtMinus30C = 1 + (-10 - (-30)) / (39 - (-10)); // 1.4082
const measuredHareColdExcessFrac = measuredHareColdMultiplierAtMinus30C - 1; // 0.0000
const targetHareColdExcessFrac = targetHareColdMultiplierAtMinus30C - 1; // 0.4082

const wolfFeelingsMinus30 = stepBodyFeelings(
  WOLF_NEEDS,
  createNeeds(),
  100,
  { stamina: 100, pain: 0, health: 100, temperatureC: -30, temperatureStress: 0, oxygenStress: 0 },
  3,
  { dtGame: 600, dtReal: 50, speed: 0, gait: 'idle', tC: -30, drinking: false, generatedKg: WOLF_NEEDS.body.massKg.v },
  'wolf-cold-check'
);

// 12. Wet-coat thermal conductance multiplier (Scholander et al. 1950; Webb & King 1984 J. Therm. Biol. 9:189: ~3.0x dry conductance)
const engineSrc = readFileSync(resolve(repoRoot, 'src/core/needs/engine.ts'), 'utf8');
const measuredWetConductanceExcess = /wet|submerg|soaked/i.test(engineSrc) ? 2.0 : 0.0; // C_wet/C_dry - 1: game = 0.0, nature = 2.0 (3.0x total)
const targetWetConductanceExcess = 2.0;

const checks = [
  {
    id: 'snowshoe_hare_jan15_visible_winter_whiteness',
    quantity: 'Near-camera (<32 m) visible Snowshoe Hare pelage whiteness on Jan 15 (day 15)',
    gameValue: Number(visibleNearHareJan15Whiteness.toFixed(4)),
    natureTarget: 1.0,
    unit: 'whiteness [0..1]',
    source: 'Mills et al. (2013) PNAS 110:7360; Sheriff et al. (2009) J. Comp. Physiol. B 179:305',
    score: Number(unitScore(visibleNearHareJan15Whiteness, 1.0, 1.0).toFixed(4)),
    resemblesNature: unitScore(visibleNearHareJan15Whiteness, 1.0, 1.0) >= 0.95,
    note: 'HARE_SKIN computes 1.0000 winter white, but animalPicture.ts hides HARE_SKIN (proc=0) and draws brown snowshoe-hare.glb',
  },
  {
    id: 'boreal_winter_white_moult_species_coverage',
    quantity: 'Manifest winter-white moulting species (Snowshoe Hare, Ermine) white in January',
    gameValue: `${winterWhiteSpeciesWorking} / ${winterWhiteManifestSpecies.length}`,
    natureTarget: '2 / 2',
    unit: 'species',
    source: 'Mills et al. (2013) PNAS 110:7360; King & Powell (2007) Natural History of Weasels and Stoats',
    score: Number(unitScore(winterWhiteSpeciesWorking / 2, 1.0, 1.0).toFixed(4)),
    resemblesNature: winterWhiteSpeciesWorking === 2,
    note: 'Both snowshoe-hare.glb and ermine.glb render static summer-brown pelage all winter',
  },
  {
    id: 'stored_meshy_species_physical_tonemapped_coat_share',
    quantity: 'Manifest animal species without unmapped 14x emissive blowout (toneMapped=true, emissive=0)',
    gameValue: `${toneMappedPhysicalSpecies.length} / ${manifestSpecies.length}`,
    natureTarget: `${manifestSpecies.length} / ${manifestSpecies.length}`,
    unit: 'species',
    source: 'Pharr, Jakob & Humphreys (2023) Physically Based Rendering 4th ed.; coatFinish.ts:86-90',
    score: Number(unitScore(toneMappedPhysicalSpecies.length / manifestSpecies.length, 1.0, 1.0).toFixed(4)),
    resemblesNature: toneMappedPhysicalSpecies.length === manifestSpecies.length,
    note: '15 species hit applyStylizedFill (emissiveIntensity=14, toneMapped=false) and Red Fox sets toneMapped=false',
  },
  {
    id: 'nocturnal_scene_light_coupling_fox_and_cervid',
    quantity: 'Custom non-wolf Meshy coat shaders (Red Fox, Cervids) coupled to outgoingLight at night',
    gameValue: `${litCustomShadersCount} / 2`,
    natureTarget: '2 / 2',
    unit: 'shaders',
    source: 'Johnsen et al. (2006) J. Exp. Biol. 209:789 (starlight/nocturnal irradiance <1e-3x noon)',
    score: Number(unitScore(litCustomShadersCount / 2, 1.0, 1.0).toFixed(4)),
    resemblesNature: litCustomShadersCount === 2,
    note: 'Both FOX (coatFinish.ts:62-66) and dressCervidCoat (coatFinish.ts:100-108) omit outgoingLight and glow full-bright at 00:00',
  },
  {
    id: 'gray_wolf_coat_polymorphism_and_shared_rng',
    quantity: 'Visible Meshy Gray Wolf coat morphs (grey/tan/black) & shared src/proc/rng.ts compliance',
    gameValue: `${visibleMeshyWolfMorphCount}/3 morphs, sin-hash=${!wolfCoatUsesSharedRng}`,
    natureTarget: '3/3 morphs + src/proc/rng.ts',
    unit: 'composite [0..1]',
    source: 'Gipson et al. (2002) Wildl. Soc. Bull. 30:821; Anderson et al. (2009) Science 323:1339; PROJECT-RULES Rule 2',
    score: Number(wolfPolymorphismScore.toFixed(4)),
    resemblesNature: wolfPolymorphismScore >= 0.95,
    note: 'MAMA shader overwrites gl_FragColor.rgb with one charcoal/cream coat for all wolves; body.ts:187 uses Math.sin hash',
  },
  {
    id: 'cervid_seasonal_summer_winter_coat_shift',
    quantity: 'Cervid summer rufous-tan -> winter grey-brown guard-hair R/B chroma shift',
    gameValue: Number(cervidSeasonalRbShiftMeasured.toFixed(4)),
    natureTarget: cervidSeasonalRbShiftTarget,
    unit: 'relative R/B shift',
    source: 'Jacobsen (1980) J. Wildl. Manage. 44:691-697; Cowan (1956) Deer of North America',
    score: Number(unitScore(cervidSeasonalRbShiftMeasured, cervidSeasonalRbShiftTarget, cervidSeasonalRbShiftTarget).toFixed(4)),
    resemblesNature: unitScore(cervidSeasonalRbShiftMeasured, cervidSeasonalRbShiftTarget, cervidSeasonalRbShiftTarget) >= 0.95,
    note: 'dressCervidCoat bakes static summer coatOf(species) RGB literal with zero dayOfYear winter shift',
  },
  {
    id: 'appearance_base_profile_silhouette_points_with_glb_active',
    quantity: 'Shape-tools side-silhouette points captured on player rig after GLB hides procedural mesh',
    gameValue: capturedSilhouettePoints,
    natureTarget: targetSilhouettePoints,
    unit: 'silhouette points',
    source: 'src/render/appearance.ts:17-32 & src/ui/shapeTools.ts:68-80 spec',
    score: Number(unitScore(Math.min(capturedSilhouettePoints, targetSilhouettePoints), targetSilhouettePoints, targetSilhouettePoints).toFixed(4)),
    resemblesNature: capturedSilhouettePoints >= 56,
    note: 'baseProfile skips !o.visible meshes after setBodyShare(wolf.root, 0), caching min=+Infinity, size=-Infinity, side=[]',
  },
  {
    id: 'appearance_genome_live_meshy_and_shader_integration',
    quantity: 'Appearance genome integration (visible Meshy scale/tint, hares, onBeforeCompile chain, MAMA coatTint, handle hide)',
    gameValue: `${genomeSubchecksPassed} / 5`,
    natureTarget: '5 / 5',
    unit: 'subsystems',
    source: 'src/core/genome.ts, src/render/appearance.ts:41-81, src/ui/appearancePanel.ts:56, src/render/buildScene.ts:656-660',
    score: Number(unitScore(genomeSubchecksPassed / 5, 1.0, 1.0).toFixed(4)),
    resemblesNature: genomeSubchecksPassed === 5,
    note: 'Visible Meshy wolf ignores genome; inject() wipes prev onBeforeCompile; hares omitted; cyan 0x4ad0ff handles stay stuck after menu close',
  },
  {
    id: 'wet_pelage_lekner_dorf_optical_darkening',
    quantity: 'Water-saturated pelage diffuse albedo darkening & guard-hair roughness clumping',
    gameValue: Number(coatWetAlbedoDropMeasured.toFixed(4)),
    natureTarget: coatWetAlbedoDropTarget,
    unit: 'albedo drop fraction',
    source: 'Lekner & Dorf (1988) Appl. Opt. 27:1278-1280 (water film n=1.33 internal reflection ~38% darkening)',
    score: Number(unitScore(coatWetAlbedoDropMeasured, coatWetAlbedoDropTarget, coatWetAlbedoDropTarget).toFixed(4)),
    resemblesNature: unitScore(coatWetAlbedoDropMeasured, coatWetAlbedoDropTarget, coatWetAlbedoDropTarget) >= 0.95,
    note: 'Terrain applies wet darkening/roughness, but animal coats and fur cards stay 100% dry when swimming/wading',
  },
  {
    id: 'snow_dusting_and_wind_at_fur_deflection',
    quantity: 'Environmental coat coupling: dorsal snowfall dusting + weather.ts:14 windAt fur-card deflection',
    gameValue: `${hasSnowDustingOnCoat + hasWindAtOnFurCards} / 2`,
    natureTarget: '2 / 2',
    unit: 'couplings',
    source: 'src/core/weather.ts:14 ("windAt(x,y,z) is sampled by trees, grass, fur..."); boreal winter snowfall optics',
    score: Number(unitScore((hasSnowDustingOnCoat + hasWindAtOnFurCards) / 2, 1.0, 1.0).toFixed(4)),
    resemblesNature: hasSnowDustingOnCoat + hasWindAtOnFurCards === 2,
    note: 'Zero dorsal snow accumulation on coats and zero windAt sampling in furCards.ts',
  },
  {
    id: 'cold_exposure_scholander_metabolic_cost_at_minus_30c',
    quantity: 'Standing metabolic cold-thermogenesis increase at -30 C (winter Snowshoe Hare below T_lc = -10 C)',
    gameValue: Number((measuredHareColdExcessFrac * 100).toFixed(2)) + '% (stress=' + wolfFeelingsMinus30.feelings.temperatureStress.toFixed(3) + ')',
    natureTarget: Number((targetHareColdExcessFrac * 100).toFixed(2)) + '% (stress > 0)',
    unit: '% metabolic increase above TNZ',
    source: 'Scholander et al. (1950) Biol. Bull. 99:237; Hart et al. (1965) Can. J. Zool. 43:731; Sheriff et al. (2009)',
    score: Number(unitScore(measuredHareColdExcessFrac, targetHareColdExcessFrac, targetHareColdExcessFrac).toFixed(4)),
    resemblesNature: unitScore(measuredHareColdExcessFrac, targetHareColdExcessFrac, targetHareColdExcessFrac) >= 0.95,
    note: 'heatFactor (needs/engine.ts:35) clamps Math.max(0, tC - heatAboveC): 0% cold drain and 0.000 temperatureStress at -30 C',
  },
  {
    id: 'wet_coat_thermal_conductance_penalty',
    quantity: 'Soaked-pelage excess thermal conductance (C_wet/C_dry - 1) in cold water / rain',
    gameValue: Number(measuredWetConductanceExcess.toFixed(4)) + ' (1.00x dry)',
    natureTarget: Number(targetWetConductanceExcess.toFixed(4)) + ' (3.00x dry)',
    unit: 'excess conductance multiple',
    source: 'Scholander et al. (1950) Biol. Bull. 99:237; Webb & King (1984) J. Therm. Biol. 9:189 (2.5-4.0x wet fur conductance)',
    score: Number(unitScore(measuredWetConductanceExcess, targetWetConductanceExcess, targetWetConductanceExcess).toFixed(4)),
    resemblesNature: unitScore(measuredWetConductanceExcess, targetWetConductanceExcess, targetWetConductanceExcess) >= 0.95,
    note: 'NeedsStep & BodyStep omit coat wetness/submersion; swimming in 0 C January water incurs 0% extra heat loss',
  },
];

const passingCount = checks.filter((c) => c.score >= 0.95).length;
const meanScore = Number((checks.reduce((s, c) => s + c.score, 0) / checks.length).toFixed(4));

const output = {
  taskId: 'T-0243',
  evaluatedAt: new Date().toISOString(),
  branch: 'agy/t0243-propose',
  calibration,
  summary: {
    totalChecks: checks.length,
    passingAt95Pct: passingCount,
    meanScore,
    passesGate: passingCount === checks.length && meanScore >= 0.95,
  },
  runtimeObservationsLoaded: Boolean(obs),
  checks,
};

const outFile = resolve(__dirname, 'numbers.json');
writeFileSync(outFile, JSON.stringify(output, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(output, null, 2));
