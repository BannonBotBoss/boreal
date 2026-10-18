import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyPopulation } from '../src/core/population';
import { RENDER } from '../src/core/renderSettings';
import { CHUNK_SIZE, type Entity } from '../src/core/world';
import { ENTITY_TREES, FAR_TREES, drawnTreesPerHa, farTreesInTile, fillPerHa } from '../src/core/flora/stands';
import { standStructure, speciesStems, standStems, STEM_CURVES } from '../src/core/stand';

test('far trees: the entity baseline is ~131 trees/ha at the reference stand, clamped like core/population', () => {
  assert.ok(Math.abs(drawnTreesPerHa(ENTITY_TREES.stemRef, 1) - 131.25) < .01);
  assert.ok(Math.abs(drawnTreesPerHa(650, 1) - 131.25 * .45) < .01);
  assert.ok(Math.abs(drawnTreesPerHa(9000, 1) - 131.25 * 2.2) < .01);
});
test('far trees: the mirror tracks core/population (mean spruce entities per chunk over many chunks)', () => {
  const was = RENDER.standMap; RENDER.standMap = false; // stand multiplier 1: only the generator share x tree factor remains
  try {
    let n = 0; const chunks = 200;
    for (let c = 0; c < chunks; c++) {
      const ents: Entity[] = Array.from({ length: ENTITY_TREES.candidates }, (_, i) => ({ key: `t:${c}:${i}`, kind: i < ENTITY_TREES.candidates * ENTITY_TREES.share ? 'spruce' : 'log', seed: i, generatorVersion: 1, x: 0, z: 0, rotation: 0, scale: 1 } as Entity));
      n += applyPopulation(ents, c, 0).filter(e => e.kind === 'spruce').length;
    }
    const perHa = n / chunks * 1e4 / (CHUNK_SIZE * CHUNK_SIZE);
    assert.ok(Math.abs(perHa - drawnTreesPerHa(undefined, RENDER.treeDensity)) / perHa < .15, `population ${perHa.toFixed(1)}/ha vs mirror ${drawnTreesPerHa(undefined, RENDER.treeDensity).toFixed(1)}/ha`);
  } finally { RENDER.standMap = was; }
});
test('far trees: stands are topped up toward the stand model, never past the cap', () => {
  for (const age of [20, 40, 70, 140, 260]) {
    const st = standStructure(age), drawn = drawnTreesPerHa(st.stems, 1), fill = fillPerHa(st.stems, 1);
    assert.ok(fill > 0, `age ${age}`);
    assert.ok(drawn + fill <= Math.min(st.stems, FAR_TREES.stemCap) + 1e-6, `age ${age}`);
  }
});
test('far trees: Thomas tiles hit the target density, cluster at a few metres, keep out of water and scale with the governor tree factor', () => {
  const T = FAR_TREES.tile, stems = () => 1300, land = () => 1, n = 400;
  let count = 0, half = 0; const q = 8, cells: number[] = []; // 8 m quadrats for the index of dispersion
  for (let i = 0; i < n; i++) {
    const t = farTreesInTile(i, 7, 1, stems, land), k = T / q, c = new Array(k * k).fill(0); count += t.length; half += farTreesInTile(i, 7, .5, stems, land).length;
    for (const a of t) { const u = Math.floor(a.x / q) - i * k, v = Math.floor(a.z / q) - 7 * k; if (u >= 0 && u < k && v >= 0 && v < k) c[v * k + u]++; }
    cells.push(...c);
  }
  const perHa = count / n * 1e4 / (T * T), target = fillPerHa(1300, 1);
  assert.ok(Math.abs(perHa - target) / target < .15, `${perHa.toFixed(0)}/ha vs ${target.toFixed(0)}/ha`);
  const mean = cells.reduce((a, b) => a + b, 0) / cells.length, vmr = cells.reduce((a, b) => a + (b - mean) ** 2, 0) / (cells.length - 1) / mean;
  assert.ok(vmr > 1.3, `aggregated (Poisson = 1): variance/mean of 8 m quadrat counts ${vmr.toFixed(2)}`); // Rossi 2013: black spruce aggregated at 1-8 m
  assert.ok(half < count * .7 && half > count * .3, 'tree factor .5 roughly halves the filler');
  assert.equal(farTreesInTile(3, 3, 1, stems, () => 0).length, 0);
  assert.equal(farTreesInTile(3, 3, 0, stems, land).length, 0);
  assert.deepEqual(farTreesInTile(5, -2, 1, stems, land), farTreesInTile(5, -2, 1, stems, land), 'pure per tile');
});

test('stand model: mature fire-origin black spruce 1300-2150 stems/ha (Rossi 2013), denser young, thinner old growth', () => {
  for (const age of [80, 100, 120]) { const s = speciesStems('black-spruce', age); assert.ok(s >= 1300 && s <= 2150, `age ${age}: ${s.toFixed(0)}/ha`); }
  assert.ok(speciesStems('black-spruce', 37) >= 2500 && speciesStems('black-spruce', 37) <= 3600, '36-38 yr Beardmore black spruce 2500-3400/ha');
  for (const id of Object.keys(STEM_CURVES)) for (let a = 1; a < 300; a += 7) assert.ok(speciesStems(id, a + 7) < speciesStems(id, a), `${id}: self-thinning is monotone`);
  for (const a of [47, 50, 53]) { const s = speciesStems('jack-pine', a); assert.ok(s >= 1164 && s <= 1789, `jack pine ${a} yr: ${s.toFixed(0)}/ha (sf.128; 1275 at 50 yr, Timmins)`); }
  const jp32 = speciesStems('jack-pine', 32); assert.ok(jp32 >= 1131 && jp32 <= 7042, 'jack pine 32 yr in the NW Ontario plot range');
  assert.ok(speciesStems('trembling-aspen', 6) >= 15000, 'aspen suckers 20-40k/ha by 6 yr'); assert.ok(speciesStems('trembling-aspen', 80) < 1000, 'aspen first cohort breaks up');
  const f21 = speciesStems('balsam-fir', 21); assert.ok(f21 > 3000 && f21 < 4500, 'fir ~3800/ha at ~21 yr (NB SDMD)');
  for (const a of [50, 75, 120]) { const s = speciesStems('balsam-fir', a); assert.ok(s >= 1000 && s <= 3000, `mature fir ${a} yr`); }
  // the stand mixes the curves by its species table (one source: population and stands both read stand.stems)
  for (const a of [30, 80, 150]) { const s = standStructure(a, .5).stems; assert.ok(s > 900 && s < 4000, `mixed stand ${a} yr: ${s.toFixed(0)}`); }
  assert.equal(standStructure(90, .2).stems, standStems(90, .2));
  // drawn = entities + look-only filler reaches the fill share of the mature target, under the cap
  const s = standStructure(100).stems, drawn = drawnTreesPerHa(s, 1) + fillPerHa(s, 1);
  assert.ok(drawn > .6 * s && drawn <= Math.min(s, FAR_TREES.stemCap) + 1e-6, `drawn ${drawn.toFixed(0)}/ha of ${s.toFixed(0)}`);
});