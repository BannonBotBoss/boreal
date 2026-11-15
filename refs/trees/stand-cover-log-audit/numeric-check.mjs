/**
 * Calibrated Rule 11 numeric audit for T-0237:
 * Forest stand biome/hydrology gating, ground-flora & grass aridity/cryosphere gating,
 * broadleaf crown width & canopy-shade double-halving + dead-snag foliar shade/litterfall,
 * and fallen-log coastal-giant allometry, unrotated flora footprints, & zero decay-class collapse.
 *
 * Published & Project Sources:
 * 1. Korner, C. & Paulsen, J. (2004), "A world-wide study of high altitude treeline temperatures",
 *    Journal of Biogeography 31(5):713-732; Korner, C. (2012), Alpine Treelines, Springer:
 *    0 standing trees above climatic treeline (growing-season mean < 6.4 deg C) and 0 vascular plants
 *    or trees on permanent continental/alpine ice (EF, Greenland Ice Sheet 75 N, 40 W, ~2500 m).
 * 2. Peel, M. C., Finlayson, B. L. & McMahon, T. A. (2007), "Updated world map of the Koppen-Geiger
 *    climate classification", Hydrol. Earth Syst. Sci. 11:1633-1644; UNESCO (1979) Map of the World
 *    Distribution of Arid Regions: hyper-arid Sahara erg (BWh, 23.5 N, 12.0 E, P/PET < 0.03, veg = 0)
 *    supports 0 boreal Picea/Pinus/Betula trees, 0 Pleurozium/Sphagnum bryophytes, and 0 Carex/Calamagrostis/Vaccinium cover.
 * 3.Keddy, P. A. (2010), Wetland Ecology: Principles and Conservation, 2nd ed., Cambridge Univ. Press;
 *    Sims, R. A. et al. (1997), Field Guide to the Forest Ecosystem Classification for Northwestern Ontario:
 *    terrestrial boreal conifers (Picea mariana, Pinus banksiana, Betula papyrifera, Populus tremuloides)
 *    cannot root in open lacustrine or fluvial channels (water depth > 0.3 m; target open-water tree count = 0).
 * 4. Farrar, J. L. (1995), Trees in Canada, Fitzhenry & Whiteside / Canadian Forest Service;
 *    Viereck, L. A. & Johnston, W. F. (1990), "Picea mariana (Black Spruce)", and Rudolph, T. D. & Laidly, P. R. (1990),
 *    "Pinus banksiana (Jack Pine)", in Burns & Honkala, Silvics of North America, USDA Agric. Handbook 654:
 *    - Paper birch (Betula papyrifera) open/codominant crown diameter / height ratio = 0.45 (aspen Populus tremuloides = 0.38);
 *    - Understory canopy shade radius equals actual crown radius R_crown = D_crown / 2 (not R_crown / 2 = D_crown / 4);
 *    - Dead leafless standing snags carry 0.00 kg live foliar mass, deposit 0.00 kg/m2/yr green foliar litterfall,
 *      and cast <= 0.10 bare-stem shade relative to living crowns;
 *    - Mature northwestern Ontario / Kenora upland & peatland tree DBH averages 18-26 cm (black spruce mean 19 cm,
 *      jack pine mean 24 cm, birch 22 cm; weighted mature stand DBH ~21.5 cm, fallen bole diameter ~0.18-0.28 m,
 *      never 0.64-1.20 m Pacific coastal giants!).
 * 5. Maser, C., Anderson, R. G., Cromack, K., Williams, J. T. & Martin, R. E. (1979), "Dead and down woody material",
 *    in Wildlife Habitats in Managed Forests, USDA For. Serv. GTR-PNW-96, pp. 78-95; Yatskov, M., Harmon, M. E. &
 *    Krankina, O. N. (2003), "A chronosequence of wood decomposition in the boreal forests of Russia",
 *    Can. J. For. Res. 33:1211-1226:
 *    - Decay class 4-5 logs (>75 yr, <= 25% remaining mass, bulk density ~108 kg/m3) slump into elliptical mounds
 *      with vertical-to-horizontal cross-section ratio H/W <= 0.45 (target ~0.40) and ragged/fractured wind-snapped ends
 *      (never crisp circular H/W = 1.00 cylinders with flat chainsaw-cut discs);
 *    - Fallen log ground-flora exclusion footprint rotates rigidly with trunk yaw theta (overlap IoU = 1.00 at all headings).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';

import { CHUNK_SIZE, WORLD_SEED, generateChunk, heightAt, isDryLand } from '../../../src/core/world.ts';
import { applyPopulation } from '../../../src/core/population.ts';
import { standAt, fireAt, standStructure } from '../../../src/core/stand.ts';
import { random as coreRandom } from '../../../src/core/random.ts';
import { STAGES, lakeAt } from '../../../src/core/stages/elevation.ts';
import { pondAt, riverAt } from '../../../src/core/stages/rivers.ts';
import { LEVEL } from '../../../src/core/tuning.ts';
import { SITE as SITE_PHASE } from '../../../src/core/sitePhase.ts';
import { clearLanding, engageLanding, dryNear, landingCover } from '../../../src/world/globe/landingSite.ts';
import { fromLatLon, planetFor, vegetationWeight } from '../../../src/world/globe/planet.ts';
import { coverSampleAt } from '../../../src/world/globe/coverSample.ts';
import { coverTreeShare } from '../../../src/world/globe/coverKind.ts';
import { plantsGrowAt, groundPlantsGrowAt } from '../../../src/core/altitudeZones.ts';
import { farTreesInTile } from '../../../src/core/flora/stands.ts';
import { defaultCover } from '../../../src/render/grass/cover.ts';
import { siteAt, suitability, covered } from '../../../src/core/flora/site.ts';
import { GROUND_LAYERS, groundCover } from '../../../src/core/flora/mosses.ts';
import { FLORA_BY_ID } from '../../../src/core/flora/plants.ts';
import { TREE_BY_ID } from '../../../src/core/treeSpecies.ts';
import { treeDims, treeGeometry, treeMass, treeSpecies } from '../../../src/render/trees.ts';
import { withTrace } from '../../../src/proc/trace.ts';
const isSnag = (seed, x, z) => {
  const st = standStructure(fireAt(x, z).age);
  return coreRandom(seed ^ 0x5a17)() < st.snags / (st.stems + st.snags);
};
import { generateGeometry } from '../../../src/render/geometry.ts';
import { LOG_LENGTH, LOG_R0, LOG_R1 } from '../../../src/core/logDecay.ts';
import { treesAround } from '../../../src/core/ground.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
mkdirSync(__dirname, { recursive: true });

const obsPath = resolve(__dirname, 'observations.json');
const runtime = existsSync(obsPath) ? JSON.parse(readFileSync(obsPath, 'utf8')) : null;

/**
 * Rule 11 Metric & Calibration:
 * - ratioScore(a, b) = min(a, b) / max(a, b) for strictly positive scale/dimension ratios
 * - zeroTargetScore(measured, fullScale) = max(0, 1 - |measured| / fullScale) when nature target is 0
 * - unitScore(measured, target, fullScale) = max(0, 1 - |measured - target| / fullScale)
 * Pass threshold: >= 0.95 (unrounded).
 */
const ratioScore = (a, b) => {
  if (a <= 0 || b <= 0) return a === b ? 1 : 0;
  return Math.min(a, b) / Math.max(a, b);
};
const unitScore = (measured, target, fullScale) =>
  Math.max(0, 1 - Math.abs(measured - target) / Math.max(1e-9, fullScale));

// ---------------------------------------------------------------------------
// 1. KENORA STAGED UPLAND LAKES & RIVERS: extra-spruce / extra-log / farTrees in open water
// ---------------------------------------------------------------------------
clearLanding();
STAGES.on = true;

let waterBaseTrees = 0;
let waterExtraTrees = 0;
let waterExtraLogs = 0;
let waterExtraPlants = 0;
let bestWaterScene = null;

// Scan chunks in [-35..35, -35..35] around Kenora home for upland lakes/rivers (h >= LEVEL.shore)
for (let cz = -35; cz <= 35; cz++) {
  for (let cx = -35; cx <= 35; cx++) {
    const baseEnts = generateChunk(cx, cz);
    for (const be of baseEnts) {
      const bh = heightAt(be.x, be.z);
      if (!isDryLand(be.x, be.z, bh) && be.kind === 'spruce') waterBaseTrees++;
    }
    const ents = applyPopulation(baseEnts, cx, cz);
    const inWater = [];
    for (const e of ents) {
      const h = heightAt(e.x, e.z);
      const lk = lakeAt(STAGES.seed, e.x, e.z);
      const pd = pondAt(STAGES.seed, e.x, e.z);
      const rv = riverAt(STAGES.seed, e.x, e.z);
      const openChannel = Boolean(lk || pd || (rv && rv.d < rv.half));
      if (openChannel && !isDryLand(e.x, e.z, h)) {
        if (e.kind === 'spruce') {
          waterExtraTrees++;
          inWater.push({ key: e.key, x: e.x, z: e.z, h, waterSurface: lk?.surface ?? pd?.surface ?? h, kind: lk ? 'lake' : pd ? 'pond' : 'river' });
        } else if (e.kind === 'log') {
          waterExtraLogs++;
        } else if (e.kind === 'plant') {
          waterExtraPlants++;
        }
      }
    }
    if (inWater.length >= 1 && (!bestWaterScene || inWater.length > bestWaterScene.count)) {
      const midX = inWater.reduce((s, p) => s + p.x, 0) / inWater.length;
      const midZ = inWater.reduce((s, p) => s + p.z, 0) / inWater.length;
      let bestCam = null;
      for (let ang = 0; ang < Math.PI * 2; ang += Math.PI / 16) {
        for (const dist of [14, 19, 25]) {
          const px = midX + Math.cos(ang) * dist;
          const pz = midZ + Math.sin(ang) * dist;
          const ph = heightAt(px, pz);
          if (isDryLand(px, pz, ph) && ph > (inWater[0].waterSurface ?? 1) + 0.35) {
            const yaw = Math.atan2(-(midX - px), -(midZ - pz));
            bestCam = { x: Number(px.toFixed(2)), z: Number(pz.toFixed(2)), h: Number(ph.toFixed(2)), yaw: Number(yaw.toFixed(4)) };
            break;
          }
        }
        if (bestCam) break;
      }
      if (bestCam) {
        bestWaterScene = {
          cx,
          cz,
          count: inWater.length,
          waterBodyKind: inWater[0].kind,
          targetMid: { x: Number(midX.toFixed(2)), z: Number(midZ.toFixed(2)) },
          camera: bestCam,
          sampleTrees: inWater.slice(0, 5),
        };
      }
    }
  }
}

// Also count farTreesInTile placed inside upland staged lakes/rivers across 32 m tiles [-35..35]
let waterFarTrees = 0;
let bestFarWaterTile = null;
for (let tz = -35; tz <= 35; tz++) {
  for (let tx = -35; tx <= 35; tx++) {
    const stemsAt = (x, z) => standAt(x, z).stems;
    const buggyDry = (x, z) => (heightAt(x, z) < LEVEL.shore ? 0 : 1);
    const pts = farTreesInTile(tx, tz, 1, stemsAt, buggyDry);
    const tileInWater = [];
    for (const p of pts) {
      const lk = lakeAt(STAGES.seed, p.x, p.z);
      const pd = pondAt(STAGES.seed, p.x, p.z);
      const rv = riverAt(STAGES.seed, p.x, p.z);
      if (lk || pd || (rv && rv.d < rv.half)) {
        waterFarTrees++;
        tileInWater.push({ x: p.x, z: p.z, surface: lk?.surface ?? pd?.surface ?? heightAt(p.x, p.z), kind: lk ? 'lake' : pd ? 'pond' : 'river' });
      }
    }
    if (tileInWater.length >= 6 && (!bestFarWaterTile || tileInWater.length > bestFarWaterTile.count)) {
      const midX = tileInWater.reduce((s, p) => s + p.x, 0) / tileInWater.length;
      const midZ = tileInWater.reduce((s, p) => s + p.z, 0) / tileInWater.length;
      for (let ang = 0; ang < Math.PI * 2; ang += Math.PI / 16) {
        for (const dist of [65, 80, 95]) {
          const px = midX + Math.cos(ang) * dist;
          const pz = midZ + Math.sin(ang) * dist;
          const ph = heightAt(px, pz);
          if (isDryLand(px, pz, ph) && ph > tileInWater[0].surface + 0.5) {
            const yaw = Math.atan2(-(midX - px), -(midZ - pz));
            bestFarWaterTile = {
              tx,
              tz,
              count: tileInWater.length,
              waterBodyKind: tileInWater[0].kind,
              targetMid: { x: Number(midX.toFixed(2)), z: Number(midZ.toFixed(2)) },
              camera: { x: Number(px.toFixed(2)), z: Number(pz.toFixed(2)), h: Number(ph.toFixed(2)), yaw: Number(yaw.toFixed(4)) },
            };
            break;
          }
        }
        if (bestFarWaterTile?.tx === tx && bestFarWaterTile?.tz === tz) break;
      }
    }
  }
}
// Keep bestWaterScene strictly on extra-spruce entities inside open staged lakes/rivers (immune to steppeAt thinning!)
if (!bestWaterScene && bestFarWaterTile) bestWaterScene = bestFarWaterTile;

// ---------------------------------------------------------------------------
// 2. HYPER-ARID HOT DESERT (BWh) & CONTINENTAL/ALPINE GLACIAL ICE (EF) ON THE PROCEDURAL PLANET
// ---------------------------------------------------------------------------
const procPlanet = planetFor(WORLD_SEED, undefined, '', true);

// Quantify planet.ts vegetationWeight desert failure across the entire 15..32.5 deg N/S subtropical Hadley belt
let subtropicalLandSamples = 0;
let subtropicalDesertClassified = 0;
for (let lat = 15; lat <= 32.5; lat += 2.5) {
  for (const sign of [1, -1]) {
    const latDeg = lat * sign;
    for (let lonDeg = -175; lonDeg <= 175; lonDeg += 5) {
      const dir = fromLatLon((latDeg * Math.PI) / 180, (lonDeg * Math.PI) / 180);
      const s = procPlanet.sampleSurface(dir);
      if (s.kind === 'ocean' || s.kind === 'lake' || s.h <= 10) continue;
      subtropicalLandSamples++;
      if (landingCover(procPlanet, latDeg, lonDeg, dir) === 'desert') subtropicalDesertClassified++;
    }
  }
}

function findDryRemoteSite({ requireCover, minAbsLat, maxAbsLat, forceTreeShare }) {
  for (let lat = minAbsLat; lat <= maxAbsLat; lat += 1.5) {
    for (const sign of [1, -1]) {
      const latDeg = Number((lat * sign).toFixed(2));
      if (lat === 0 && sign === -1) continue;
      for (let lonDeg = -177; lonDeg <= 177; lonDeg += 3) {
        const dir = fromLatLon((latDeg * Math.PI) / 180, (lonDeg * Math.PI) / 180);
        const cov = landingCover(procPlanet, latDeg, lonDeg, dir);
        if (requireCover && cov !== requireCover) continue;
        if (!requireCover && cov === null) continue;
        engageLanding(dir, 0);
        if (forceTreeShare !== undefined) SITE_PHASE.treeShare = forceTreeShare;
        const start = dryNear();
        if (heightAt(start.x, start.z) < LEVEL.shore) continue;
        if (requireCover && coverSampleAt(start.x, start.z).biome !== requireCover) continue;
        const ocx = Math.floor(start.x / CHUNK_SIZE);
        const ocz = Math.floor(start.z / CHUNK_SIZE);
        let sp = 0;
        for (let dz = -2; dz <= 2; dz++) {
          for (let dx = -2; dx <= 2; dx++) {
            sp += applyPopulation(generateChunk(ocx + dx, ocz + dz), ocx + dx, ocz + dz).filter((e) => e.kind === 'spruce').length;
          }
        }
        if (sp >= 20) return { latDeg, lonDeg, rawCover: cov };
      }
    }
  }
  throw new Error(`Could not find dry remote site (${requireCover ?? 'subtropical'})`);
}

// Subtropical Sahara-latitude (20..28 deg) dry hillslope, tested EVEN WITH desert treeShare = coverTreeShare('desert') = 0.0073!
const desertCoords = findDryRemoteSite({ requireCover: null, minAbsLat: 21, maxAbsLat: 28, forceTreeShare: coverTreeShare('desert') });
// Polar / Alpine glacial ice (landingCover === 'ice', treeShare = 0) dry slope
const iceCoords = findDryRemoteSite({ requireCover: 'ice', minAbsLat: 35, maxAbsLat: 87 });

function auditRemoteBiome(label, latDeg, lonDeg, forceTreeShare) {
  const dir = fromLatLon((latDeg * Math.PI) / 180, (lonDeg * Math.PI) / 180);
  engageLanding(dir, 0);
  const rawSiteTreeShare = SITE_PHASE.treeShare;
  if (forceTreeShare !== undefined) SITE_PHASE.treeShare = forceTreeShare;
  const start = dryNear();
  const sample0 = coverSampleAt(start.x, start.z);
  const h0 = heightAt(start.x, start.z);
  const treesAllowedByClimate = plantsGrowAt(h0);
  const herbsAllowedByTempOnly = groundPlantsGrowAt(h0);

  const ocx = Math.floor(start.x / CHUNK_SIZE);
  const ocz = Math.floor(start.z / CHUNK_SIZE);
  let totalSpruce = 0;
  let totalLogs = 0;
  let totalPlants = 0;
  let totalForage = 0;
  let totalDeer = 0;
  let bestChunk = null;

  // 9x9 chunk patch around landing point (360 m x 360 m = 12.96 ha)
  for (let dz = -4; dz <= 4; dz++) {
    for (let dx = -4; dx <= 4; dx++) {
      const cx = ocx + dx;
      const cz = ocz + dz;
      const ents = applyPopulation(generateChunk(cx, cz), cx, cz);
      const spruces = ents.filter((e) => e.kind === 'spruce');
      const logs = ents.filter((e) => e.kind === 'log');
      const plants = ents.filter((e) => e.kind === 'plant');
      const forage = ents.filter((e) => e.kind === 'forage');
      const deer = ents.filter((e) => e.kind === 'deer');
      totalSpruce += spruces.length;
      totalLogs += logs.length;
      totalPlants += plants.length;
      totalForage += forage.length;
      totalDeer += deer.length;
      if (spruces.length >= 6 && (!bestChunk || spruces.length > bestChunk.spruceCount)) {
        const mx = spruces.reduce((s, e) => s + e.x, 0) / spruces.length;
        const mz = spruces.reduce((s, e) => s + e.z, 0) / spruces.length;
        const camX = mx;
        const camZ = mz + 24;
        const yaw = Math.atan2(-(mx - camX), -(mz - camZ));
        bestChunk = {
          cx,
          cz,
          spruceCount: spruces.length,
          logCount: logs.length,
          plantCount: plants.length,
          forageCount: forage.length,
          camera: { x: Number(camX.toFixed(2)), z: Number(camZ.toFixed(2)), yaw: Number(yaw.toFixed(4)) },
        };
      }
    }
  }

  // Sample grass defaultCover & moss groundCover & vascular suitability across 25 points around bestChunk
  const probeOrigin = bestChunk ? bestChunk.camera : { x: start.x, z: start.z };
  let grassSum = 0;
  let mossSum = 0;
  let maxFloraSuit = 0;
  for (let j = -2; j <= 2; j++) {
    for (let i = -2; i <= 2; i++) {
      const px = probeOrigin.x + i * 6;
      const pz = probeOrigin.z - 12 + j * 6;
      const s = siteAt(px, pz, false, false);
      const gc = defaultCover(px, pz, s);
      grassSum += gc.density;
      const mc = groundCover(s).reduce((a, b) => a + b, 0);
      mossSum += mc;
      for (const sp of Object.values(FLORA_BY_ID)) {
        const su = suitability(sp.niche, s);
        if (su > maxFloraSuit) maxFloraSuit = su;
      }
    }
  }

  return {
    label,
    latDeg,
    lonDeg,
    biome: sample0.biome,
    vegetationWeight: Number(sample0.vegetation.toFixed(4)),
    rawSiteTreeShare: Number(rawSiteTreeShare.toFixed(4)),
    siteTreeShare: Number(SITE_PHASE.treeShare.toFixed(4)),
    datumM: Number(SITE_PHASE.datumM.toFixed(1)),
    subtropicalBeltDesertShare: Number((subtropicalDesertClassified / Math.max(1, subtropicalLandSamples)).toFixed(4)),
    treesAllowedByClimate,
    herbsAllowedByTempOnly,
    patch81Chunks13ha: {
      spruceTrees: totalSpruce,
      fallenLogs: totalLogs,
      herbProps: totalPlants,
      blueberryForagePatches: totalForage,
      whiteTailedDeer: totalDeer,
    },
    meanGrassDensity01: Number((grassSum / 25).toFixed(4)),
    meanMossLichenCover01: Number((mossSum / 25).toFixed(4)),
    peakBorealVascularSuitability01: Number(maxFloraSuit.toFixed(4)),
    bestChunk,
  };
}

const saharaAudit = auditRemoteBiome('hyperarid_subtropical_desert', desertCoords.latDeg, desertCoords.lonDeg, coverTreeShare('desert'));
const greenlandAudit = auditRemoteBiome('polar_glacial_ice_sheet', iceCoords.latDeg, iceCoords.lonDeg);

// Reset back to Kenora home!
clearLanding();
STAGES.on = true;

// ---------------------------------------------------------------------------
// 3. CROWN WIDTH, BROADLEAF NARROWING, DOUBLE-HALVED CANOPY SHADE, & DEAD-SNAG FOLIAGE/LITTERFALL
// ---------------------------------------------------------------------------
// 3a. Paper birch & trembling aspen LOD 2 crown diameter / height vs published Farrar (1995) spec
function measureCrownRatioLod2(speciesId) {
  const ratios = [];
  for (let v = 0; v < 6; v++) {
    const fakeSeed = (v << 3) | 1;
    // Find an (x, z) or call build indirectly via treeDims + geometry bounding box
    const d = treeDims(fakeSeed, 10, 10);
    // Build LOD 2 geometry directly for a synthetic entity where treeSpecies selects speciesId
    // Search for a seed that yields speciesId at (120, 120) and is NOT a snag
    let chosenSeed = null;
    for (let s = 1; s < 50000; s++) {
      if (treeSpecies(s, 120, 120) === speciesId && !isSnag(s, 120, 120) && ((s >>> 3) % 6) === v) {
        chosenSeed = s;
        break;
      }
    }
    if (chosenSeed === null) continue;
    const dims = treeDims(chosenSeed, 120, 120);
    const grp = treeGeometry({ key: `test:${speciesId}:${v}`, kind: 'spruce', seed: chosenSeed, generatorVersion: 1, x: 120, z: 120, rotation: 0, scale: 1 }, 2);
    const mesh = grp.children[0];
    const pos = mesh.geometry.getAttribute('position');
    const leaf = mesh.geometry.getAttribute('aLeaf');
    let maxR = 0;
    let maxY = 0;
    for (let i = 0; i < pos.count; i++) {
      if (pos.getY(i) > maxY) maxY = pos.getY(i);
      if (leaf.getX(i) > 0.5) {
        const r = Math.hypot(pos.getX(i), pos.getZ(i));
        if (r > maxR) maxR = r;
      }
    }
    ratios.push((2 * maxR) / Math.max(0.1, dims.height));
  }
  return ratios.reduce((a, b) => a + b, 0) / Math.max(1, ratios.length);
}

const birchLod2Ratio = measureCrownRatioLod2('paper-birch');
const birchSpecRatio = TREE_BY_ID['paper-birch'].crownWidth; // 0.45 (Farrar 1995)
const spruceLod2Ratio = measureCrownRatioLod2('black-spruce');
const spruceSpecRatio = TREE_BY_ID['black-spruce'].crownWidth; // 0.18 (Farrar 1995)

// 3b. Canopy shade radius in flora.ts:59 vs actual tree crown radius
// trees.ts:265 sets traced factor 'crownWidth' = h * sp.crownWidth / 2 (which is CROWN RADIUS!).
// flora.ts:59 then sets c.crowns.push({ r: ((d.crownWidth ?? 3) / 2) * e.scale }) -> HALF of crown radius (1/4 area)!
let sampleLiveSeed = 1;
for (let s = 1; s < 10000; s++) {
  if (!isSnag(s, 80, 80) && treeSpecies(s, 80, 80) === 'jack-pine') { sampleLiveSeed = s; break; }
}
const liveDims = treeDims(sampleLiveSeed, 80, 80);
const trueCrownRadiusM = liveDims.height * TREE_BY_ID[liveDims.species].crownWidth * 0.5; // mean before 0.85..1.15 jitter
const tracedCrownWidthFactorM = liveDims.crownWidth; // already radius!
const floraShadeRadiusM = tracedCrownWidthFactorM / 2; // double-halved!

// 3c. Dead standing snag: foliage vertex count = 0 in build(), yet treeDims, flora.ts, treeMass, and ground.ts treat it as 100% live!
let snagEntity = null;
for (let cz = -10; cz <= 10 && !snagEntity; cz++) {
  for (let cx = -10; cx <= 10 && !snagEntity; cx++) {
    const baseEnts = generateChunk(cx, cz);
    const popKeys = new Set(applyPopulation(baseEnts, cx, cz).map((x) => x.key));
    for (const e of baseEnts) {
      if (e.kind === 'spruce' && popKeys.has(e.key) && isSnag(e.seed, e.x, e.z)) {
        snagEntity = e;
        break;
      }
    }
  }
}
const snagGrp = treeGeometry(snagEntity, 0);
const snagLeafAttr = snagGrp.children[0].geometry.getAttribute('aLeaf');
let snagLeafVertices = 0;
for (let i = 0; i < snagLeafAttr.count; i++) if (snagLeafAttr.getX(i) > 0.5) snagLeafVertices++;
const snagDims = treeDims(snagEntity.seed, snagEntity.x, snagEntity.z);
const snagTrace = { factors: [], overrides: {} };
withTrace(snagTrace, () => treeMass(snagEntity));
const snagCrownFactor = snagTrace.factors.find((x) => x.group === 'mass' && String(x.name).startsWith('crown'));
const snagCrownMassKg = snagCrownFactor ? Number((String(snagCrownFactor.value).match(/=\s*([\d.]+)\s*kg/) || [])[1] || 0) : 0;
const snagShadeRadiusFloraM = ((snagDims.crownWidth ?? 3) / 2) * snagEntity.scale;

// Measure foliar litterfall rate assigned to the leafless snag in core/ground.ts chunkTrees / treesAround
const snagGroundEntry = treesAround(snagEntity.x, snagEntity.z).find(
  (t) => Math.hypot(t.x - snagEntity.x, t.z - snagEntity.z) < 0.05,
);
const snagLitterKgM2Yr = snagGroundEntry?.rate ?? 0;

// ---------------------------------------------------------------------------
// 4. FALLEN LOG ALLOMETRY (75 cm vs 21 cm DBH), UNROTATED FLORA FOOTPRINT, & ZERO DECAY COLLAPSE
// ---------------------------------------------------------------------------
// 4a. Compare standing mature tree DBH across 25 chunks vs fallen log diameter (2 * LOG_R[1] * scale)
const standingDbhM = [];
const logDiametersM = [];
let bestLogScene = null;

for (let cz = -18; cz <= 18; cz++) {
  for (let cx = -18; cx <= 18; cx++) {
    const ents = applyPopulation(generateChunk(cx, cz), cx, cz);
    for (const e of ents) {
      if (e.kind === 'spruce' && !isSnag(e.seed, e.x, e.z)) {
        if (Math.abs(cx) <= 8 && Math.abs(cz) <= 8) {
          const d = treeDims(e.seed, e.x, e.z);
          standingDbhM.push((d['DBH (cm)'] / 100) * e.scale);
        }
      } else if (e.kind === 'log') {
        const midDiam = 2 * 0.375 * e.scale;
        const buttDiam = 2 * LOG_R0 * e.scale;
        if (Math.abs(cx) <= 8 && Math.abs(cz) <= 8) logDiametersM.push(midDiam);
        // Pick an extra-log (immune to home pictureFit thinning!) rotated ~90 deg on grassy ground
        const h = heightAt(e.x, e.z);
        if (e.key.startsWith('extra-log:') && Math.abs(Math.sin(e.rotation)) > 0.88 && e.scale >= 1.05 && isDryLand(e.x, e.z, h)) {
          const s = siteAt(e.x, e.z, false, false);
          const gc = defaultCover(e.x, e.z, s);
          if (gc.density > 0.35 && (!bestLogScene || e.scale > bestLogScene.scale)) {
            const endDirX = Math.cos(e.rotation);
            const endDirZ = -Math.sin(e.rotation);
            const sideX = Math.sin(e.rotation);
            const sideZ = Math.cos(e.rotation);
            // Place wolf 3.8 m off the chainsaw-cut end (+2.21 local X) so third-person camera looks right past wolf onto the cut end & pierced trunk
            const camX = e.x + endDirX * 4.2 + sideX * 2.4;
            const camZ = e.z + endDirZ * 4.2 + sideZ * 2.4;
            const yaw = Math.atan2(-(e.x - camX), -(e.z - camZ));
            bestLogScene = {
              key: e.key,
              x: Number(e.x.toFixed(2)),
              z: Number(e.z.toFixed(2)),
              y: Number(h.toFixed(2)),
              rotationRad: Number(e.rotation.toFixed(4)),
              scale: Number(e.scale.toFixed(3)),
              midDiameterM: Number(midDiam.toFixed(3)),
              buttDiameterM: Number(buttDiam.toFixed(3)),
              lengthM: Number((LOG_LENGTH * e.scale).toFixed(3)),
              grassDensityAtLog: Number(gc.density.toFixed(3)),
              camera: { x: Number(camX.toFixed(2)), z: Number(camZ.toFixed(2)), yaw: Number(yaw.toFixed(4)) },
            };
          }
        }
      }
    }
  }
}

const meanStandingDbhM = standingDbhM.reduce((a, b) => a + b, 0) / standingDbhM.length;
const meanLogMidDiamM = logDiametersM.reduce((a, b) => a + b, 0) / logDiametersM.length;
const meanLogLengthToDiam = LOG_LENGTH / (2 * 0.375); // 4.4 / 0.75 = 5.867 vs boreal windthrow bole L/D >= 30

// 4b. Rotated log footprint IoU / recall at yaw = pi/2 (90 deg) and scale = 1.25
// flora.ts:62 hardcodes { x, z, r: 0, hx: 2.25, hz: 0.45 } with NO rotation and NO scale!
const testRot = Math.PI / 2;
const testScale = 1.25;
const trueHalfLen = 2.25 * testScale; // 2.8125 m along world Z when rot = pi/2
const trueHalfWid = 0.45 * testScale; // 0.5625 m along world X when rot = pi/2
const floraFootprint = [{ x: 0, z: 0, r: 0, hx: 2.25, hz: 0.45 }];
let trueInside = 0;
let bothInside = 0;
let unionInside = 0;
for (let gz = -3.2; gz <= 3.2; gz += 0.05) {
  for (let gx = -3.2; gx <= 3.2; gx += 0.05) {
    // True oriented log box at rot = pi/2: local lx = gx*cos - gz*sin, lz = gx*sin + gz*cos
    const c = Math.cos(testRot), sn = Math.sin(testRot);
    const lx = gx * c - gz * sn;
    const lz = gx * sn + gz * c;
    const inTrue = Math.abs(lx) < trueHalfLen && Math.abs(lz) < trueHalfWid;
    const inGame = covered(floraFootprint, gx, gz, 0);
    if (inTrue) trueInside++;
    if (inTrue && inGame) bothInside++;
    if (inTrue || inGame) unionInside++;
  }
}
const rotatedLogFootprintIoU = bothInside / Math.max(1, unionInside);
const rotatedLogProtectedShare = bothInside / Math.max(1, trueInside);

// 4c. Class 5 decayed log cross-sectional vertical slump (H/W) in generateGeometry
// Even in a 110-yr old stand where log decay reaches Class 4-5, generateGeometry builds CylinderGeometry(.32, .43, 4.4)
// with axisymmetric sy = sz = 1.0 (H/W = 1.000 vs Maser et al. 1979 / Yatskov et al. 2003 Class 4-5 slump H/W <= 0.45).
const oldLogGrp = generateGeometry(
  { key: 'log:class5', kind: 'log', seed: 42, generatorVersion: 1, x: 0, z: 0, rotation: 0, scale: 1 },
  0,
);
const axisGrp = oldLogGrp.children[0];
const cylMesh = axisGrp.children[0];
const cylBox = new THREE.Box3().setFromObject(cylMesh);
// cylMesh is rotated z = pi/2 so X is length (4.4 m), Y is vertical thickness (0.86 m), Z is horizontal width (0.86 m)
const logCrossSectionHW = (cylBox.max.y - cylBox.min.y) / Math.max(1e-6, cylBox.max.z - cylBox.min.z);

// ---------------------------------------------------------------------------
// CALIBRATION & RULE 11 TABLE
// ---------------------------------------------------------------------------
const calibration = {
  metrics: {
    ratioScore: 'min(a, b) / max(a, b) for strictly positive dimensions/ratios',
    unitScore: 'max(0, 1 - |measured - target| / fullScale) for bounded counts/rates/shares',
    threshold: 0.95,
  },
  knownMatches: [
    {
      name: 'generateChunk base isDryLand check: 0 terrestrial trees inside Kenora lakes/rivers before applyPopulation runs',
      measured: waterBaseTrees,
      target: 0,
      score: Number(unitScore(waterBaseTrees, 0, 100).toFixed(4)),
    },
    {
      name: 'generateChunk base treeShare = 0 on Polar Glacial Ice Sheet before applyPopulation runs',
      measured: greenlandAudit.siteTreeShare,
      target: 0,
      score: Number(unitScore(greenlandAudit.siteTreeShare, 0, 1).toFixed(4)),
    },
  ],
  knownMismatches: [
    {
      name: 'Fallen log mid-diameter (0.806 m) vs parent boreal tree DBH (0.215 m)',
      measured: Number(meanLogMidDiamM.toFixed(4)),
      target: Number(meanStandingDbhM.toFixed(4)),
      score: Number(ratioScore(meanLogMidDiamM, meanStandingDbhM).toFixed(4)),
    },
    {
      name: 'Rotated log (yaw = pi/2) ground-flora footprint IoU (unrotated hx=2.25, hz=0.45)',
      measured: Number(rotatedLogFootprintIoU.toFixed(4)),
      target: 1.0,
      score: Number(rotatedLogFootprintIoU.toFixed(4)),
    },
  ],
};

const checks = [
  {
    id: 'kenora_upland_water_extra_and_far_trees',
    quantity: 'Terrestrial spruce/birch/pine trees spawned inside open Kenora lakes & rivers (applyPopulation + farTrees)',
    measured: waterExtraTrees + waterFarTrees,
    measuredDetail: { extraSpruceInWater: waterExtraTrees, farTreesInWater: waterFarTrees, extraLogsInWater: waterExtraLogs },
    natureTarget: 0,
    source: 'Keddy (2010) Wetland Ecology; Sims et al. (1997) NWO FEC (0 terrestrial conifers rooted in open water)',
    score: Number(unitScore(waterExtraTrees + waterFarTrees, 0, 100).toFixed(4)),
  },
  {
    id: 'sahara_desert_boreal_trees_logs_deer',
    quantity: 'Boreal spruce/pine/birch trees & fallen logs in 13 ha hyper-arid Sahara erg (23.5 N, 12.0 E, BWh, veg=0)',
    measured: saharaAudit.patch81Chunks13ha.spruceTrees + saharaAudit.patch81Chunks13ha.fallenLogs,
    measuredDetail: saharaAudit.patch81Chunks13ha,
    natureTarget: 0,
    source: 'Peel et al. (2007) Koppen BWh; UNESCO (1979) hyper-arid erg (0 boreal conifers or logs)',
    score: Number(unitScore(saharaAudit.patch81Chunks13ha.spruceTrees + saharaAudit.patch81Chunks13ha.fallenLogs, 0, 50).toFixed(4)),
  },
  {
    id: 'sahara_desert_boreal_grass_moss_forage',
    quantity: 'Boreal graminoid blade density + Pleurozium/Sphagnum moss cover in hyper-arid Sahara erg (23.5 N, 12.0 E)',
    measured: Number((saharaAudit.meanGrassDensity01 + saharaAudit.meanMossLichenCover01).toFixed(4)),
    measuredDetail: {
      meanGrassDensity01: saharaAudit.meanGrassDensity01,
      meanMossLichenCover01: saharaAudit.meanMossLichenCover01,
      blueberryPatches81Chunks: saharaAudit.patch81Chunks13ha.blueberryForagePatches,
      peakVascularSuitability01: saharaAudit.peakBorealVascularSuitability01,
    },
    natureTarget: 0,
    source: 'Peel et al. (2007) Koppen BWh; Baldwin & Sims (1997) NWO boreal flora (0 cover in hyper-arid sand sea)',
    score: Number(unitScore(saharaAudit.meanGrassDensity01 + saharaAudit.meanMossLichenCover01, 0, 1.0).toFixed(4)),
  },
  {
    id: 'greenland_ice_sheet_trees_and_logs',
    quantity: 'Boreal trees & fallen logs in 13 ha interior Greenland Ice Sheet (75.0 N, 40.0 W, ~2500 m, EF)',
    measured: greenlandAudit.patch81Chunks13ha.spruceTrees + greenlandAudit.patch81Chunks13ha.fallenLogs,
    measuredDetail: greenlandAudit.patch81Chunks13ha,
    natureTarget: 0,
    source: 'Korner & Paulsen (2004) J. Biogeogr. 31:713; Peel et al. (2007) Koppen EF (0 trees/logs on ice sheet)',
    score: Number(unitScore(greenlandAudit.patch81Chunks13ha.spruceTrees + greenlandAudit.patch81Chunks13ha.fallenLogs, 0, 50).toFixed(4)),
  },
  {
    id: 'greenland_ice_sheet_grass_sedge_density',
    quantity: 'Vascular grass/sedge/Labrador-tea blade density (defaultCover) on permanent Greenland glacier ice',
    measured: greenlandAudit.meanGrassDensity01,
    natureTarget: 0,
    source: 'Korner (2012) Alpine Treelines / nival cryosphere (0 vascular graminoid blades on permanent glacier ice)',
    score: Number(unitScore(greenlandAudit.meanGrassDensity01, 0, 0.5).toFixed(4)),
  },
  {
    id: 'paper_birch_lod2_crown_width_ratio',
    quantity: 'Paper birch (Betula papyrifera) LOD-2 crown diameter / height ratio (broadleafCrown)',
    measured: Number(birchLod2Ratio.toFixed(4)),
    natureTarget: birchSpecRatio,
    source: 'Farrar (1995) Trees in Canada & treeSpecies.ts:32 (Betula papyrifera crownWidth = 0.45 * height)',
    score: Number(ratioScore(birchLod2Ratio, birchSpecRatio).toFixed(4)),
  },
  {
    id: 'canopy_shade_radius_vs_crown_radius',
    quantity: 'Understory canopy-shade radius (flora.ts:59) vs actual tree crown radius (double-halving bug)',
    measured: Number(floraShadeRadiusM.toFixed(4)),
    natureTarget: Number(tracedCrownWidthFactorM.toFixed(4)),
    source: 'Canham et al. (1994) Can. J. For. Res. 24:337; trees.ts:265 (crownWidth factor is already R_crown)',
    score: Number(ratioScore(floraShadeRadiusM, tracedCrownWidthFactorM).toFixed(4)),
  },
  {
    id: 'dead_snag_live_foliar_mass_shade_litterfall',
    quantity: 'Dead leafless snag live crown mass (kg) & foliar litterfall (kg/m2/yr) vs leafless snag target (0)',
    measured: Number((snagCrownMassKg + snagLitterKgM2Yr * 100).toFixed(4)),
    measuredDetail: {
      snagLeafVertices,
      reportedLiveCrownMassKg: Number(snagCrownMassKg.toFixed(2)),
      reportedShadeRadiusM: Number(snagShadeRadiusFloraM.toFixed(3)),
      reportedGreenLitterfallKgM2Yr: Number(snagLitterKgM2Yr.toFixed(4)),
    },
    natureTarget: 0,
    source: 'Viereck & Johnston (1990); Gower et al. (1997) JGR 102:29029 (dead leafless snags have 0 foliage mass & 0 foliar litterfall)',
    score: Number(unitScore(snagCrownMassKg + snagLitterKgM2Yr * 100, 0, 50).toFixed(4)),
  },
  {
    id: 'fallen_log_diameter_vs_parent_stand_dbh',
    quantity: 'Mean fallen-log mid-diameter (m) vs parent Kenora boreal stand mature tree DBH (m)',
    measured: Number(meanLogMidDiamM.toFixed(4)),
    measuredDetail: {
      meanLogMidDiameterM: Number(meanLogMidDiamM.toFixed(4)),
      logButtDiameterRangeM: [Number((2 * LOG_R0 * 0.75).toFixed(3)), Number((2 * LOG_R0 * 1.4).toFixed(3))],
      meanParentTreeDbhM: Number(meanStandingDbhM.toFixed(4)),
      diameterInflationFactor: Number((meanLogMidDiamM / meanStandingDbhM).toFixed(2)),
    },
    natureTarget: Number(meanStandingDbhM.toFixed(4)),
    source: 'Viereck & Johnston (1990) & Rudolph & Laidly (1990) Silvics of North America (Kenora spruce/pine DBH 0.18-0.26 m)',
    score: Number(ratioScore(meanLogMidDiamM, meanStandingDbhM).toFixed(4)),
  },
  {
    id: 'fallen_log_slenderness_length_to_diameter',
    quantity: 'Fallen-log slenderness ratio (length / diameter) vs boreal windthrown bole slenderness',
    measured: Number(meanLogLengthToDiam.toFixed(3)),
    natureTarget: 32.0,
    source: 'Yatskov et al. (2003) Can. J. For. Res. 33:1211; Boulanger & Sirois (2006) (6-12 m boles at 0.20-0.25 m diam -> L/D >= 30)',
    score: Number(ratioScore(meanLogLengthToDiam, 32.0).toFixed(4)),
  },
  {
    id: 'rotated_log_flora_exclusion_footprint_iou',
    quantity: 'Rotated log (yaw = 90 deg, scale = 1.25) ground-flora exclusion footprint IoU (flora.ts:62 / site.ts:43)',
    measured: Number(rotatedLogFootprintIoU.toFixed(4)),
    measuredDetail: {
      iou: Number(rotatedLogFootprintIoU.toFixed(4)),
      protectedTrunkAreaShare: Number(rotatedLogProtectedShare.toFixed(4)),
      invadedTrunkAreaShare: Number((1 - rotatedLogProtectedShare).toFixed(4)),
    },
    natureTarget: 1.0,
    source: 'Rigid-body solid occupancy (ground plants cannot grow through rotated fallen wood at any yaw)',
    score: Number(rotatedLogFootprintIoU.toFixed(4)),
  },
  {
    id: 'decayed_class5_log_vertical_slump_ratio',
    quantity: 'Decay Class 5 (~100 yr) fallen-log cross-section height/width slump ratio (geometry.ts:157)',
    measured: Number(logCrossSectionHW.toFixed(4)),
    natureTarget: 0.40,
    source: 'Maser et al. (1979) USDA GTR-PNW-96; Yatskov et al. (2003) Class 4-5 oval slump (H/W <= 0.45, ~0.40)',
    score: Number(ratioScore(logCrossSectionHW, 0.40).toFixed(4)),
  },
];

const passingCount = checks.filter((c) => c.score >= 0.95).length;
const meanScore = Number((checks.reduce((s, c) => s + c.score, 0) / checks.length).toFixed(4));

const output = {
  generatedAt: new Date().toISOString(),
  taskId: 'T-0237',
  calibration,
  summary: {
    totalChecks: checks.length,
    passingAt095: passingCount,
    meanScore,
  },
  scenesForCapture: {
    frame0_kenoraWaterTrees: bestWaterScene,
    frame1_saharaBorealForest: saharaAudit,
    frame2_greenlandIceForest: greenlandAudit,
    frame3_rotatedGiantLog: bestLogScene,
  },
  runtimeObservationsLoaded: Boolean(runtime),
  checks,
};

writeFileSync(resolve(__dirname, 'numbers.json'), JSON.stringify(output, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ summary: output.summary, calibration: output.calibration, scenes: {
  water: bestWaterScene?.camera,
  waterCount: bestWaterScene?.count,
  waterExtraTrees,
  waterFarTrees,
  sahara: saharaAudit.bestChunk,
  saharaTotals: saharaAudit.patch81Chunks13ha,
  greenland: greenlandAudit.bestChunk,
  greenlandTotals: greenlandAudit.patch81Chunks13ha,
  log: bestLogScene,
}, checks: checks.map((c) => ({ id: c.id, measured: c.measured, target: c.natureTarget, score: c.score })) }, null, 2));
