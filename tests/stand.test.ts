import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FIRE, ageFromU, fireAt, standDbh, standStructure, successionWeight } from '../src/core/stand';
import { random } from '../src/proc/rng';
import { TREE_BY_ID, standTable } from '../src/core/treeSpecies';

test('stand age follows Van Wagner negative exponential (mean ≈ C, P(a > C) ≈ e⁻¹)', () => {
  const r = random(3), xs = Array.from({ length: 40000 }, () => ageFromU(r()));
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length, over = xs.filter(a => a > FIRE.cycleYears).length / xs.length;
  assert.ok(Math.abs(mean - FIRE.cycleYears) < 3, `mean ${mean}`); assert.ok(Math.abs(over - Math.exp(-1)) < .01, `P(a>C) ${over}`);
  assert.ok(xs.every(a => a >= 0 && a <= FIRE.maxAge));
});
test('fire patches: deterministic and spatially coherent; landscape ages ~ exponential', () => {
  assert.deepEqual(fireAt(123, 456), fireAt(123, 456));
  let same = 0; for (let i = 0; i < 200; i++) if (fireAt(i * 37, 900).id === fireAt(i * 37 + 3, 900).id) same++;
  assert.ok(same > 180, 'neighbouring points mostly share a patch');
  const ages = new Map<string, number>(); for (let x = 0; x < 20000; x += 97) for (let z = 0; z < 20000; z += 97) { const f = fireAt(x, z); ages.set(f.id, f.age); }
  const a = [...ages.values()], m = a.reduce((p, c) => p + c, 0) / a.length; assert.ok(a.length > 1000 && Math.abs(m - FIRE.cycleYears) < 12, `patches ${a.length} mean ${m}`);
});
test('diameter distribution: young stands small and dense; old growth reverse-J understory + large canopy toward the upper bound', () => {
  const d = TREE_BY_ID['white-spruce'].attr.dbh, r = random(9), young = standStructure(15), old = standStructure(300);
  const y = Array.from({ length: 6000 }, () => standDbh(r, d, young)), o = Array.from({ length: 6000 }, () => standDbh(r, d, old));
  assert.ok([...y, ...o].every(v => v >= d.min && v <= d.max), 'within species bounds');
  const mean = (a: number[]) => a.reduce((p, c) => p + c, 0) / a.length;
  assert.ok(mean(y) < d.mean, 'young < species mean'); assert.ok(young.stems > 3 * old.stems, 'young stands are dense');
  const big = o.filter(v => v > d.mean + d.sd).length / o.length; assert.ok(big > .05, `large old-growth stems ${big}`);
  const bins = [0, 0, 0, 0]; const w = (d.max - d.min) / 4; for (const v of o) bins[Math.min(3, Math.floor((v - d.min) / w))]++;
  assert.ok(bins[0] > bins[1] && bins[1] > bins[3], `reverse-J ${bins}`);
});
test('succession and stand structure: pioneers early, late species old; canopy closes; CWD U-shaped; old moss cover', () => {
  assert.ok(successionWeight('pioneer', 30) > successionWeight('late', 30)); assert.ok(successionWeight('late', 250) > successionWeight('pioneer', 250));
  const share = (t: readonly (readonly [string, number])[], id: string) => { const i = t.findIndex(x => x[0] === id); return t[i][1] - (i ? t[i - 1][1] : 0); };
  assert.ok(share(standTable(.45, 30), 'trembling-aspen') > share(standTable(.45, 250), 'trembling-aspen'));
  assert.ok(share(standTable(.45, 250), 'balsam-fir') > share(standTable(.45, 30), 'balsam-fir'));
  const s = [1, 60, 300].map(a => standStructure(a, .5));
  assert.ok(s[1].canopy > .8 && s[0].canopy < .2); assert.ok(s[1].cwd < s[0].cwd && s[1].cwd < s[2].cwd, `CWD ${s.map(x => x.cwd.toFixed(2))}`);
  assert.ok(s[2].cover.feathermoss > .4 && s[0].cover.feathermoss < .05);
});
