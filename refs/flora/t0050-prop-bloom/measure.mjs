// Calibrated measurement for T-0050: chunk plant and forage props follow the flora bloom window.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import * as THREE from 'three';
import { FLORA_BY_ID } from '../../../src/core/flora/plants.ts';
import { buildClump, buildPlant } from '../../../src/render/flora/plant.ts';
import { WEATHER } from '../../../src/core/weather.ts';
import { STAGES } from '../../../src/core/stages/elevation.ts';
import { generateChunk } from '../../../src/core/world.ts';
import { applyPopulation } from '../../../src/core/population.ts';
import { finish } from '../../../src/core/interest.ts';
import { createChunkBatch, PROP_MATERIAL } from '../../../src/render/batch.ts';
import { FORAGE_SPEC, HERB_SPECS, generateGeometry, propBloomMask, stripFlora, syncChunkProps } from '../../../src/render/geometry.ts';

const dir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(dir, '../../..');

function countFlowerVerts(g, hex) {
  const want = new THREE.Color(hex), c = g.getAttribute('color');
  if (!c) return 0;
  let n = 0;
  for (let i = 0; i < c.count; i++) {
    const dr = c.getX(i) - want.r, dg = c.getY(i) - want.g, db = c.getZ(i) - want.b;
    if (dr * dr + dg * dg + db * db < 0.08) n++;
  }
  return n;
}

function legacyStripFlora(g) {
  g.deleteAttribute('aFall'); g.deleteAttribute('aOrgan'); g.deleteAttribute('aBloom');
  return g;
}

function decodePng(d) {
  let i = 8, w = 0, h = 0, ct = 0;
  const idat = [];
  while (i < d.length) {
    const n = d.readUInt32BE(i);
    const t = d.toString('latin1', i + 4, i + 8);
    const c = d.subarray(i + 8, i + 8 + n);
    if (t === 'IHDR') { w = c.readUInt32BE(0); h = c.readUInt32BE(4); ct = c[9]; }
    if (t === 'IDAT') idat.push(c);
    i += 12 + n;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const bpp = ct === 6 ? 4 : 3;
  const stride = w * bpp;
  const rows = [];
  let prev = new Uint8Array(stride), p = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[p];
    const line = Uint8Array.from(raw.subarray(p + 1, p + 1 + stride));
    p += 1 + stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? line[x - bpp] : 0;
      const b = prev[x];
      const c = x >= bpp ? prev[x - bpp] : 0;
      if (f === 1) line[x] = (line[x] + a) & 255;
      else if (f === 2) line[x] = (line[x] + b) & 255;
      else if (f === 3) line[x] = (line[x] + ((a + b) >> 1)) & 255;
      else if (f === 4) {
        const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
        line[x] = (line[x] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
      }
    }
    rows.push(line);
    prev = line;
  }
  return { w, h, bpp, rows };
}

function countOrangeTepalPixels(pngPath) {
  if (!existsSync(pngPath)) return null;
  const { w, h, bpp, rows } = decodePng(readFileSync(pngPath));
  let orange = 0, green = 0;
  const x0 = Math.floor(w * 0.30), x1 = Math.floor(w * 0.70), y0 = Math.floor(h * 0.25), y1 = Math.floor(h * 0.72);
  for (let y = y0; y < y1; y++) {
    const row = rows[y];
    for (let x = x0; x < x1; x++) {
      const i = x * bpp, r = row[i], g = row[i + 1], b = row[i + 2];
      if (r > 120 && r - g > 28 && r - b > 45) orange++;
      if (g > r + 12 && g > b + 12) green++;
    }
  }
  return { w, h, orangePixels: orange, greenPixels: green };
}

function buildRaw(id) {
  const s = FLORA_BY_ID[id];
  return s.carpet ? buildClump({ ...s, carpet: s.carpet }, 0, 0) : buildPlant(s, 0, 0);
}

const speciesRows = {};
for (const id of ['bunchberry', 'bluebead', 'woodlily', 'everlasting']) {
  const s = FLORA_BY_ID[id], hex = s.flower.colour;
  const before = countFlowerVerts(buildRaw(id), hex);
  const legacy227 = countFlowerVerts(legacyStripFlora(buildRaw(id)), hex);
  const day227 = countFlowerVerts(stripFlora(buildRaw(id), 227), hex);
  const day190 = countFlowerVerts(stripFlora(buildRaw(id), 190), hex);
  const day160 = countFlowerVerts(stripFlora(buildRaw(id), 160), hex);
  speciesRows[id] = { bloom: s.flower.bloom, colour: hex, before, legacyDay227: legacy227, day227, day190, day160 };
}
{
  const hex = '#4d6bb3';
  const before = countFlowerVerts(buildClump(FORAGE_SPEC, 0, 0), hex);
  const legacy227 = countFlowerVerts(legacyStripFlora(buildClump(FORAGE_SPEC, 0, 0)), hex);
  const day227 = countFlowerVerts(stripFlora(buildClump(FORAGE_SPEC, 0, 0), 227), hex);
  const day190 = countFlowerVerts(stripFlora(buildClump(FORAGE_SPEC, 0, 0), 190), hex);
  const day160 = countFlowerVerts(stripFlora(buildClump(FORAGE_SPEC, 0, 0), 160), hex);
  speciesRows.forageBlueberry = { bloom: [185, 250], colour: hex, before, legacyDay227: legacy227, day227, day190, day160 };
}

// Chunk 3:0 rebuild test across bloom window
STAGES.on = true;
const prevDay = WEATHER.day;
WEATHER.day = 227;
const entities = applyPopulation(generateChunk(3, 0), 3, 0).filter(e => e.kind !== 'deer' && e.kind !== 'person');
const batch = createChunkBatch(), root = new THREE.Group();
for (const e of entities) batch.add(e.key, new THREE.Vector3(e.x, 0, e.z), [0, 1, 2].map(d => generateGeometry(e, d)), [0, 55, 115]);
for (const m of finish(batch.buildJob())) root.add(m);
const chunks = new Map([['3:0', { entities, batch, bloomMask: propBloomMask(227) }]]);
const bm227 = batch.meshes.find(m => m.material === PROP_MATERIAL);
const chunkWoodlilyVertsDay227 = countFlowerVerts(bm227.geometry, FLORA_BY_ID.woodlily.flower.colour);
const chunkTotalVertsDay227 = bm227.geometry.getAttribute('position').count;

WEATHER.day = 190;
const rebuiltTo190 = syncChunkProps(chunks.values());
const bm190 = batch.meshes.find(m => m.material === PROP_MATERIAL);
const chunkWoodlilyVertsDay190 = countFlowerVerts(bm190.geometry, FLORA_BY_ID.woodlily.flower.colour);
const chunkTotalVertsDay190 = bm190.geometry.getAttribute('position').count;
batch.dispose();
WEATHER.day = prevDay;

const frameLegacyDay227 = countOrangeTepalPixels(join(repoRoot, 'tasks/evidence/2026-10-23-grok-loop-0416/lily-close.png'));
const frameDay227 = countOrangeTepalPixels(join(dir, 'woodlily-day227.png'));
const frameDay190 = countOrangeTepalPixels(join(dir, 'woodlily-day190.png'));

function scoreFrom(outOfWindowVerts227, inWindowVerts227, woodlily190, forage160, chunkRebuilt) {
  const c1 = Math.max(0, 1 - outOfWindowVerts227 / 474);
  const c2 = inWindowVerts227 === 2280 ? 1 : 0;
  const c3 = woodlily190 === 36 && forage160 === 0 && chunkRebuilt === 1 ? 1 : 0;
  return +((0.5 * c1 + 0.25 * c2 + 0.25 * c3)).toFixed(4);
}

const outOfWindowLegacy = speciesRows.woodlily.legacyDay227 + speciesRows.bunchberry.legacyDay227 + speciesRows.bluebead.legacyDay227;
const outOfWindowPost = speciesRows.woodlily.day227 + speciesRows.bunchberry.day227 + speciesRows.bluebead.day227;
const inWindowPost = speciesRows.everlasting.day227 + speciesRows.forageBlueberry.day227;

const result = {
  metric: 'propBloomWindowScore',
  calibration: {
    knownMismatchPreFixDay227: {
      outOfWindowFlowerVerts: outOfWindowLegacy,
      score: scoreFrom(outOfWindowLegacy, 2280, 36, 1440, 0),
      legacyFrameDay227: frameLegacyDay227,
    },
    knownMatchPostFix: {
      outOfWindowFlowerVerts: outOfWindowPost,
      inWindowFlowerVerts: inWindowPost,
      woodlilyDay190Verts: speciesRows.woodlily.day190,
      forageDay160Verts: speciesRows.forageBlueberry.day160,
      chunkRebuiltOn190: rebuiltTo190,
      score: scoreFrom(outOfWindowPost, inWindowPost, speciesRows.woodlily.day190, speciesRows.forageBlueberry.day160, rebuiltTo190),
    },
  },
  speciesRows,
  chunk3_0: {
    plant3_0_29: entities.find(e => e.key === '3:0:29'),
    day227: { woodlilyFlowerVerts: chunkWoodlilyVertsDay227, totalPropVerts: chunkTotalVertsDay227 },
    day190: { rebuilt: rebuiltTo190, woodlilyFlowerVerts: chunkWoodlilyVertsDay190, totalPropVerts: chunkTotalVertsDay190 },
  },
  frames: {
    legacyDay227: frameLegacyDay227,
    day227: frameDay227,
    day190: frameDay190,
  },
};

writeFileSync(join(dir, 'measure.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
