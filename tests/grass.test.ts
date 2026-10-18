import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COVER_SPECIES, GRASS, bladesJob, coverAt, keepAt, setCoverSource, siteAt } from '../src/render/grass/cover';
import { finish } from '../src/core/interest';
import { STAGES, lakeAt } from '../src/core/stages/elevation';
import { riverAt } from '../src/core/stages/rivers';
import { heightAt } from '../src/core/world';
import { LEVEL } from '../src/core/tuning';

test('species rows are physical and cited ranges are ordered', () => {
  for (const s of COVER_SPECIES) {
    assert.ok(s.length.min > 0 && s.length.min <= s.length.mean && s.length.mean <= s.length.max && s.length.max < 1.2, s.id);
    assert.ok(s.width > 0 && s.width < .02 && s.lean[0] <= s.lean[1] && s.stiff >= 0 && s.stiff <= 1, s.id);
    assert.ok(s.wet[0] >= 0 && s.wet[0] <= 1 && s.wet[1] > 0, s.id);
    for (const c of [s.base, s.tip, s.fall]) assert.ok(c.every(v => v >= 0 && v <= .8), `${s.id} albedo`);
  }
  assert.ok(new Set(COVER_SPECIES.map(s => s.form)).size === 3, 'grasses, sedges and low shrubs');
});
test('density falloff: full near, monotone, zero at the radius', () => {
  assert.equal(keepAt(0, 48), 1); assert.equal(keepAt(GRASS.full, 48), 1); assert.equal(keepAt(48, 48), 0);
  for (let d = 0; d < 48; d += .5) assert.ok(keepAt(d + .5, 48) <= keepAt(d, 48) + 1e-12);
});
test('tiles are deterministic, keep-sorted, sit on the terrain and avoid water', () => {
  const a = finish(bladesJob(1, 2)), b = finish(bladesJob(1, 2));
  assert.deepEqual(a.pos, b.pos); assert.deepEqual(a.blade, b.blade); assert.ok(a.count > 0);
  assert.equal(a.sub.length, GRASS.sub ** 2 + 1); assert.equal(a.sub[0], 0); assert.equal(a.sub[GRASS.sub ** 2], a.count);
  const T = GRASS.tile, C = T / GRASS.sub, x0 = 1 * T, z0 = 2 * T;
  for (let c = 0; c < GRASS.sub ** 2; c++) for (let i = a.sub[c]; i < a.sub[c + 1]; i++) {
    if (i > a.sub[c]) assert.ok(a.blade[i * 4 + 3] >= a.blade[(i - 1) * 4 + 3], 'sorted by keep hash inside a cell');
    const x = a.pos[i * 3], z = a.pos[i * 3 + 2]; assert.ok(Math.abs(x - (x0 + (c % GRASS.sub + .5) * C)) <= C / 2 + .1 && Math.abs(z - (z0 + (Math.floor(c / GRASS.sub) + .5) * C)) <= C / 2 + .1, 'blade in its cell'); }
  for (let i = 0; i < a.count; i += 97) { const x = a.pos[i * 3], y = a.pos[i * 3 + 1], z = a.pos[i * 3 + 2];
    assert.ok(Math.abs(y + .01 - heightAt(x, z)) < .08, 'root on the terrain mesh'); assert.ok(y > LEVEL.waterSurface); }
});
test('staged world: no blades in lakes or river channels; the density field is swappable (soils hook)', () => {
  STAGES.on = true;
  try {
    let checked = 0;
    for (let tx = -40; tx < 40 && checked < 400; tx += 7) for (let tz = -40; tz < 40 && checked < 400; tz += 7) { const t = finish(bladesJob(tx, tz));
      for (let i = 0; i < t.count; i += 53) { const x = t.pos[i * 3], z = t.pos[i * 3 + 2], rv = riverAt(STAGES.seed, x, z); checked++;
        assert.ok(!lakeAt(STAGES.seed, x, z), 'not in a lake'); assert.ok(!rv || rv.d >= rv.half, 'not in a river bed'); } }
    assert.ok(checked > 0);
    const s = siteAt(0, 0); assert.ok(s.wet >= 0 && s.wet <= 1 && s.rock >= 0 && s.rock <= 1);
    setCoverSource(() => ({ density: 0, weights: COVER_SPECIES.map(() => 1) })); assert.equal(finish(bladesJob(3, 3)).count, 0);
  } finally { setCoverSource(); STAGES.on = false; }
  assert.ok(coverAt(5, 5).weights.length === COVER_SPECIES.length);
});
