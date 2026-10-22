import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FLORA, FLORA_BY_ID } from '../src/core/flora/plants';
import { siteAt, suitability, thomas } from '../src/core/flora/site';
import { buildPlant } from '../src/render/flora/plant';
import { plantsJob } from '../src/render/flora/flora';
import { finish } from '../src/core/interest';
import { STAGES, lakeAt } from '../src/core/stages/elevation';
import { soilAt } from '../src/core/stages/soils';
import { LEVEL } from '../src/core/tuning';

test('species rows are physical, flowers bloom inside the year', () => {
  for (const s of FLORA) {
    assert.ok(s.height.min > 0 && s.height.min <= s.height.mean && s.height.mean <= s.height.max && s.height.max < 6, s.id);
    if (s.flower) { const [a, b] = s.flower.bloom; assert.ok(a >= 90 && a < b && b <= 300, s.id); assert.ok(s.flower.petals >= 3 && s.flower.petals <= 40, s.id); }
  }
});

test('Thomas process: deterministic, intensity ≈ κμ, clustered (variance > mean)', () => {
  const c = { kappa: .01, mu: 10, sigma: 1 }, one = () => 1;
  assert.deepEqual(thomas('t', 3, 4, 20, c, one), thomas('t', 3, 4, 20, c, one));
  const counts: number[] = []; let n = 0;
  for (let t = 0; t < 200; t++) { const p = thomas('t', t, 0, 20, c, one); n += p.length;
    const q = new Array(16).fill(0); for (const { x, z } of p) { const i = Math.floor((x - t * 20) / 5), j = Math.floor(z / 5); if (i >= 0 && i < 4 && j >= 0 && j < 4) q[j * 4 + i]++; } counts.push(...q); }
  const mean = n / 200 / 400; assert.ok(Math.abs(mean - .1) < .02, `intensity ${mean}`);
  const m = counts.reduce((a, b) => a + b) / counts.length, v = counts.reduce((a, b) => a + (b - m) ** 2, 0) / counts.length;
  assert.ok(v > 2 * m, `index of dispersion ${v / m}`); // CSR would give ≈ 1
  assert.equal(thomas('t', 0, 0, 20, c, () => 0).length, 0);
});

test('every plant builds with organs; flowers carry their bloom window', () => {
  for (const s of FLORA) for (const d of [0, 1]) {
    const g = buildPlant(s, 1, d), o = g.getAttribute('aOrgan'), b = g.getAttribute('aBloom');
    assert.ok(g.index!.count > 0 && g.getAttribute('position').count === o.count, s.id);
    let flowers = 0; for (let i = 0; i < o.count; i++) if (o.getX(i) > .5) { flowers++; assert.deepEqual([b.getX(i), b.getY(i)], s.flower!.bloom, s.id); }
    assert.equal(flowers > 0, !!s.flower, s.id);
  }
  for (const s of FLORA) assert.ok(buildPlant(s, 0, 1).index!.count < buildPlant(s, 0, 0).index!.count, `${s.id} LOD`);
});

test('staged world: site reads stage-3 soils; no plants in lakes; bedrock thins', () => {
  STAGES.on = true;
  try {
    let n = 0, wet = 0;
    for (let a = 0; a < 6; a++) for (let b = 0; b < 6; b++) for (const p of finish(plantsJob(a * 9 - 20, b * 9 - 20))) { n++; assert.ok(!lakeAt(STAGES.seed, p.x, p.z), 'not in a lake'); }
    assert.ok(n > 200, `${n} plants`);
    for (let i = 0; i < 300; i++) { const x = i * 31.7 - 4000, z = i * 17.3 - 2000, s = siteAt(x, z); if (s.water) { assert.equal(suitability(FLORA[0].niche, s), 0); continue; }
      const so = soilAt(STAGES.seed, x, z); if (so.kind === 'peat') wet++, assert.ok(s.wet > .5, 'peat is wet'); }
  } finally { STAGES.on = false; }
});

test('littoral macrophytes (horsetail, bulrush, pond-lily): depth zonation, slope limit, and surface floating placement', () => {
  const ht = FLORA_BY_ID['horsetail'], br = FLORA_BY_ID['bulrush'], pl = FLORA_BY_ID['pond-lily'];
  assert.ok(ht && br && pl && pl.floating);
  const plGeom = buildPlant(pl, 0, 2), plNorm = plGeom.getAttribute('normal'), plOrgan = plGeom.getAttribute('aOrgan');
  let leafVerts = 0, flatLeafVerts = 0;
  for (let i = 0; i < plNorm.count; i++) if (plOrgan.getX(i) < .5 && plNorm.getX(i) ** 2 + plNorm.getY(i) ** 2 + plNorm.getZ(i) ** 2 > .5) { leafVerts++; if (Math.abs(plNorm.getY(i)) > .95) flatLeafVerts++; }
  assert.ok(leafVerts > 0 && flatLeafVerts / leafVerts > .9, 'floating pond-lily pads lie horizontally on the water surface');
  const shallow = { water: true, waterDepth: .35, waterSurface: -.25, flow: 0, slopeDeg: 5, wet: 1, rock: 0, depth: 1.5, h: -.6, light: 1 };
  const outer = { water: true, waterDepth: 1.1, waterSurface: -.25, flow: 0, slopeDeg: 4, wet: 1, rock: 0, depth: 1.5, h: -1.35, light: 1 };
  const deep = { water: true, waterDepth: 2.1, waterSurface: -.25, flow: 0, slopeDeg: 3, wet: 1, rock: 0, depth: 1.5, h: -2.35, light: 1 };
  const steep = { water: true, waterDepth: .5, waterSurface: -.25, flow: 0, slopeDeg: 16, wet: 1, rock: 0, depth: 1, h: -.75, light: 1 };
  assert.ok(suitability(ht.niche, shallow) > .5 && suitability(br.niche, shallow) > .5 && suitability(pl.niche, shallow) > .2);
  assert.ok(suitability(pl.niche, outer) > suitability(ht.niche, outer), 'floating-leaved pond-lily dominates deeper littoral water beyond horsetail');
  assert.equal(suitability(ht.niche, deep), 0); assert.equal(suitability(br.niche, deep), 0); assert.equal(suitability(pl.niche, deep), 0);
  assert.equal(suitability(ht.niche, steep), 0); assert.equal(suitability(br.niche, steep), 0); assert.equal(suitability(pl.niche, steep), 0);
  STAGES.on = true;
  try {
    const shore = finish(plantsJob(0, 0)); // x = 0..20, z = 0..20 spans the shoreline at x ~ 13.5 and littoral zone x = 0..13.5
    const lilies = shore.filter(p => FLORA[p.species].id === 'pond-lily');
    const emergents = shore.filter(p => FLORA[p.species].id === 'horsetail' || FLORA[p.species].id === 'bulrush');
    assert.ok(lilies.length > 0 && emergents.length > 0, `lilies=${lilies.length}, emergents=${emergents.length}`);
    for (const l of lilies) assert.ok(Math.abs(l.y - (LEVEL.waterSurface + .012)) < 1e-4, 'pond-lily floats at the water surface');
  } finally { STAGES.on = false; }
});
