// Day-227 ground flora: mesh height, prop flower vertices after stripFlora, field counts.
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { FLORA, FLORA_BY_ID } from '../../../src/core/flora/plants.ts';
import { buildClump, buildPlant } from '../../../src/render/flora/plant.ts';
import { STAGES } from '../../../src/core/stages/elevation.ts';
import { applyPopulation } from '../../../src/core/population.ts';
import { CHUNK_SIZE, generateChunk, heightAt } from '../../../src/core/world.ts';
import { finish } from '../../../src/core/interest.ts';
import { plantsJob } from '../../../src/render/flora/flora.ts';
import { siteAt } from '../../../src/core/flora/site.ts';
import { standAt } from '../../../src/core/stand.ts';
import { windAt } from '../../../src/core/weather.ts';

const dir = dirname(fileURLToPath(import.meta.url));
STAGES.on = true;
const DAY = 227;
const HERB = ['bunchberry', 'bluebead', 'woodlily', 'everlasting'];

function meshHeight(g) {
  g.computeBoundingBox();
  return +(g.boundingBox.max.y - Math.min(0, g.boundingBox.min.y)).toFixed(3);
}
function flowerVerts(g, hex) {
  const want = new THREE.Color(hex);
  const c = g.getAttribute('color');
  const o = g.getAttribute('aOrgan');
  const b = g.getAttribute('aBloom');
  let n = 0;
  if (!c) return { n: 0, hasOrgan: !!o, hasBloom: !!b };
  for (let i = 0; i < c.count; i++) {
    if (o && o.getX(i) < 0.5) continue;
    const dr = c.getX(i) - want.r, dg = c.getY(i) - want.g, db = c.getZ(i) - want.b;
    if (dr * dr + dg * dg + db * db < 0.08) n++;
  }
  return { n, verts: c.count, hasOrgan: !!o, hasBloom: !!b, bloom: b ? [b.getX(0), b.getY(0)] : null };
}
function stripFlora(g) {
  g.deleteAttribute('aFall');
  g.deleteAttribute('aOrgan');
  g.deleteAttribute('aBloom');
  return g;
}

const heights = FLORA.map(s => {
  const g = buildPlant(s, 0, 0);
  const inBloom = s.flower ? DAY >= s.flower.bloom[0] && DAY <= s.flower.bloom[1] : false;
  return {
    id: s.id,
    mean: s.height.mean,
    min: s.height.min,
    max: s.height.max,
    meshY: meshHeight(g),
    bloom: s.flower?.bloom ?? null,
    inBloomOn227: inBloom,
    flower: s.flower?.colour ?? null,
  };
});

const props = {};
for (const id of HERB) {
  const spec = FLORA_BY_ID[id];
  const clump = spec.carpet
    ? buildClump({ ...spec, carpet: spec.carpet }, 0, 0)
    : buildPlant(spec, 0, 0);
  const before = flowerVerts(clump, spec.flower.colour);
  stripFlora(clump);
  const after = flowerVerts(clump, spec.flower.colour);
  props[id] = { before, after, bloom: spec.flower.bloom, inBloomOn227: DAY >= spec.flower.bloom[0] && DAY <= spec.flower.bloom[1] };
}

const forage = { ...FLORA_BY_ID.blueberry, carpet: { ...FLORA_BY_ID.blueberry.carpet, ramets: 12, radius: 0.38, form: { stems: 2, branching: 3,
  flower: { kind: 'corymb', count: 6, petals: 5, petalLength: 0.009, petalWidth: 0.007, open: 0.35, nod: 2.2, cup: 0.003, colour: '#4d6bb3', centre: '#2c4178', bloom: [185, 250] } } } };
const fg = buildClump(forage, 0, 0);
const fgBefore = flowerVerts(fg, '#4d6bb3');
stripFlora(fg);
props.forageBlueberry = { before: fgBefore, after: flowerVerts(fg, '#4d6bb3'), bloom: [185, 250], inBloomOn227: true };

const plants = [];
for (let cx = 2; cx <= 5; cx++) for (let cz = 0; cz <= 3; cz++) {
  for (const e of applyPopulation(generateChunk(cx, cz), cx, cz)) {
    if (e.kind !== 'plant' && e.kind !== 'forage') continue;
    const herb = e.kind === 'plant' ? HERB[(e.seed >>> 5) % 4] : 'forage-blueberry';
    plants.push({ key: e.key, kind: e.kind, herb, x: +e.x.toFixed(2), z: +e.z.toFixed(2), y: +heightAt(e.x, e.z).toFixed(2), seed: e.seed >>> 0 });
  }
}

const sites = [{ name: 'flat', x: 148, z: 64 }, { name: 'shore', x: 200, z: 250 }];
const field = [];
for (const s of sites) {
  const tx = Math.floor(s.x / 20), tz = Math.floor(s.z / 20);
  const list = finish(plantsJob(tx, tz));
  const by = {};
  for (const p of list) {
    const id = p.clump ? FLORA[p.species].id + ':clump' : FLORA[p.species].id;
    by[id] = (by[id] ?? 0) + 1;
  }
  const site = siteAt(s.x, s.z);
  const stand = standAt(s.x, s.z);
  const wind = windAt(s.x, 10, s.z);
  field.push({
    ...s, tile: [tx, tz], n: list.length, perM2: +(list.length / 400).toFixed(3), by,
    site: { water: site.water, wet: +site.wet.toFixed(2), light: +site.light.toFixed(2), rock: +site.rock.toFixed(2), soil: site.soil },
    stand: { canopy: +stand.canopy.toFixed(2), stems: Math.round(stand.stems), bunchberry: stand.cover?.bunchberry },
    wind: { x: +wind.x.toFixed(2), z: +wind.z.toFixed(2), u: +Math.hypot(wind.x, wind.z).toFixed(2) },
  });
}

const wood = plants.filter(p => p.herb === 'woodlily').slice(0, 8);
const bunch = plants.filter(p => p.herb === 'bunchberry').slice(0, 8);
const out = { day: DAY, chunk: CHUNK_SIZE, heights, props, plantEntities: plants.length, woodlily: wood, bunchberry: bunch, forage: plants.filter(p => p.kind === 'forage').slice(0, 6), field };
writeFileSync(join(dir, 'measure.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify({ heights: heights.map(h => [h.id, h.meshY, h.mean, h.inBloomOn227]), props: Object.fromEntries(Object.entries(props).map(([k, v]) => [k, { inBloom: v.inBloomOn227, flowerVertsAfterStrip: v.after.n, hasBloomAfter: v.after.hasBloom }])), field, wood: wood.slice(0, 3), bunch: bunch.slice(0, 3) }, null, 2));
