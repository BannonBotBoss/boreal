import { CHUNK_SIZE, generateChunk, heightAt, isDryLand } from '../../../src/core/world';
import { STAGES, lakeAt } from '../../../src/core/stages/elevation';
import { dryStart } from '../../../src/core/stages/surfaceAt';
import { ROCK_SIZES, rockDiameter, rockRecipe } from '../../../src/core/rocks';
import { ROCK_SHAPES } from '../../../src/render/rocks';
import { siteAt } from '../../../src/core/flora/site';
import { column } from '../../../src/core/ground';
import { LEVEL } from '../../../src/core/tuning';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

STAGES.on = true; // match default world.stagedTerrain in renderSettings.ts
const [startX, startZ] = dryStart(0, 0);
const outDir = resolve('refs/rocks/shield-audit');
mkdirSync(outDir, { recursive: true });

let totalRocks = 0;
let candidateRocks = 0;
let detailStones = 0;
const bySizeClass = new Array(ROCK_SIZES.length).fill(0);
let maxDiam = 0;
let over50cm = 0;
let under20cm = 0;
let onDeepMoss = 0; // rocks < 18 cm diameter sitting on forest floor with organic layer >= 8 cm
let onBedrockSite = 0;
let onOrganicForest = 0;
let perchedOnSlope = 0; // small rocks (<=22cm) on slope > 10 deg where downhill edge has air gap > 2 cm
let halfFloatingBig = 0; // big rocks (>22cm) on slope > 10 deg where downhill edge sits above terrain

interface Spot {
  key: string;
  x: number;
  z: number;
  h: number;
  diam: number;
  slopeDeg: number;
  rockShare: number;
  soil?: string;
}
const bigSpots: Spot[] = [];
const uplandSpots: Spot[] = [];

// Sample 10x10 chunks around dryStart
const cx0 = Math.floor(startX / CHUNK_SIZE), cz0 = Math.floor(startZ / CHUNK_SIZE);
const CHUNKS = 10;
let landAreaM2 = 0;
let underwaterRocksInPerchedLakes = 0;
for (let cx = cx0 - 5; cx < cx0 + 5; cx++) {
  for (let cz = cz0 - 5; cz < cz0 + 5; cz++) {
    // estimate dry land fraction in chunk
    for (let sx = 0; sx < 4; sx++) {
      for (let sz = 0; sz < 4; sz++) {
        const px = (cx + (sx + 0.5) / 4) * CHUNK_SIZE;
        const pz = (cz + (sz + 0.5) / 4) * CHUNK_SIZE;
        if (isDryLand(px, pz)) landAreaM2 += (CHUNK_SIZE * CHUNK_SIZE) / 16;
      }
    }
    const ents = generateChunk(cx, cz);
    for (const e of ents) {
      if (e.kind !== 'rock') continue;
      totalRocks++;
      if (!isDryLand(e.x, e.z)) underwaterRocksInPerchedLakes++;
      if (e.key.startsWith('stones:')) detailStones++;
      else candidateRocks++;
      const rec = rockRecipe(e.seed);
      bySizeClass[rec.size]++;
      const d = rockDiameter(e);
      if (d > maxDiam) maxDiam = d;
      if (d > 0.5) over50cm++;
      if (d <= 0.17) under20cm++;

      const site = siteAt(e.x, e.z);
      if (site.rock > 0.3) onBedrockSite++;
      else onOrganicForest++;

      const col = column(e.x, e.z);
      const organicIds = new Set(['moss', 'freshLitter', 'fragmented', 'duff', 'humus', 'peat']);
      const organicCm = col.layers.filter(l => organicIds.has(l.id)).reduce((s, l) => s + l.thickness * 100, 0);
      const rockHeightCm = d * ROCK_SHAPES[rec.shape][1] * 100;
      if (rockHeightCm <= organicCm && site.rock < 0.2) {
        onDeepMoss++;
      }

      // Check slope air gap under seatRock logic
      const slopeRad = (site.slopeDeg * Math.PI) / 180;
      const dropAcrossRadius = (d / 2) * Math.tan(slopeRad);
      const dims = ROCK_SHAPES[rec.shape];
      const halfHeight = (d / 2) * dims[1];
      if (d <= 0.22 && dropAcrossRadius > 0.025) {
        // seatRock lifts small rocks by max(h(x+vx, z+vz) - h0 - vy), so the uphill edge rests on ground and downhill edge is 2*dropAcrossRadius above ground!
        perchedOnSlope++;
      }
      if (d > 0.22 && dropAcrossRadius > halfHeight * 0.5) {
        halfFloatingBig++;
      }

      if (isDryLand(e.x, e.z) && d >= 0.38 && Math.hypot(e.x - startX, e.z - startZ) < 120) {
        bigSpots.push({ key: e.key, x: +e.x.toFixed(2), z: +e.z.toFixed(2), h: +site.h.toFixed(2), diam: d, slopeDeg: +site.slopeDeg.toFixed(1), rockShare: +site.rock.toFixed(2), soil: site.soil });
      }
      if (isDryLand(e.x, e.z) && site.rock >= 0.5 && d >= 0.29 && Math.hypot(e.x - startX, e.z - startZ) < 300) {
        uplandSpots.push({ key: e.key, x: +e.x.toFixed(2), z: +e.z.toFixed(2), h: +site.h.toFixed(2), diam: d, slopeDeg: +site.slopeDeg.toFixed(1), rockShare: +site.rock.toFixed(2), soil: site.soil });
      }
    }
  }
}

bigSpots.sort((a, b) => b.diam - a.diam || Math.hypot(a.x - startX, a.z - startZ) - Math.hypot(b.x - startX, b.z - startZ));
uplandSpots.sort((a, b) => b.rockShare - a.rockShare || Math.hypot(a.x - startX, a.z - startZ) - Math.hypot(b.x - startX, b.z - startZ));

// Cluster / pair distance check in chunk (0,0) and (1,0): nearest-neighbour distance vs Clark-Evans R=1 CSR expectation
const c0 = generateChunk(1, 0).filter(e => e.kind === 'rock');
let nnSum = 0;
for (const a of c0) {
  let best = Infinity;
  for (const b of c0) {
    if (a.key === b.key) continue;
    const dist = Math.hypot(a.x - b.x, a.z - b.z);
    if (dist < best) best = dist;
  }
  nnSum += best;
}
const meanNN = nnSum / c0.length;
const densityPerM2 = c0.length / (CHUNK_SIZE * CHUNK_SIZE);
const expectedCsrNN = 1 / (2 * Math.sqrt(densityPerM2));
const clarkEvansR = meanNN / expectedCsrNN;

const summary = {
  sampledChunks: CHUNKS * CHUNKS,
  totalAreaHa: (CHUNKS * CHUNKS * CHUNK_SIZE * CHUNK_SIZE) / 10000,
  dryLandAreaHa: +(landAreaM2 / 10000).toFixed(2),
  totalRocks,
  underwaterRocksInStagedLakesOrRivers: underwaterRocksInPerchedLakes,
  candidateRocks,
  detailStones,
  rocksPerHaDryLand: Math.round(totalRocks / (landAreaM2 / 10000)),
  sizeDistribution: ROCK_SIZES.map((s, i) => ({
    diameterM: s,
    wentworthClass: s < 0.064 ? 'pebble' : s < 0.256 ? 'cobble' : 'boulder',
    count: bySizeClass[i],
    sharePct: +((bySizeClass[i] / totalRocks) * 100).toFixed(1),
  })),
  maxDiameterM: maxDiam,
  shareUnder20cmPct: +((under20cm / totalRocks) * 100).toFixed(1),
  shareOver50cmPct: +((over50cm / totalRocks) * 100).toFixed(1),
  sharePebblesSittingOnDeepOrganicFloorPct: +((onDeepMoss / totalRocks) * 100).toFixed(1),
  shareOnBedrockUplandPct: +((onBedrockSite / totalRocks) * 100).toFixed(1),
  perchedSmallRocksOnSlopeCount: perchedOnSlope,
  halfFloatingBigRocksOnSlopeCount: halfFloatingBig,
  spatialPatternChunk1_0: {
    rockCount: c0.length,
    meanNearestNeighbourM: +meanNN.toFixed(3),
    expectedCsrM: +expectedCsrNN.toFixed(3),
    clarkEvansR: +clarkEvansR.toFixed(3),
  },
  sampleBigRocksNearSpawn: bigSpots.slice(0, 8),
  sampleUplandRocksNearSpawn: uplandSpots.slice(0, 8),
};

writeFileSync(`${outDir}/probe-summary.json`, JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
