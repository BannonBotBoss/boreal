/**
 * T-0104 evidence gate. Individuals plus the density are one population.
 * The coarse step is Verhulst on the folded count only. The scale list is the one already on the clock.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { INTEREST } from '../src/core/interest';
import { K } from '../src/core/constants';
import { createAnimal, createWorld } from '../src/core/sim';
import { resolveObservation, OBSERVATION_SCALES } from '../src/core/worldClock';
import {
  DEER_PER_KM2, wolfPerKm2, animalShares, accountShares, markFor, coarseStep, demoteFar, promoteField, pictureKind,
} from '../src/core/coarse';

const immediate = () => resolveObservation('immediate', 1);

test('shares sum to one animal at every distance and the crossing frame has both pictures', () => {
  const obs = immediate();
  const distances: number[] = [];
  for (let d = 0; d <= 200; d += 0.5) distances.push(d);
  for (const d of distances) {
    const s = animalShares(d, obs);
    assert.ok(Math.abs(s.body + s.density - 1) < 1e-9, `sum at ${d}`);
    const m = markFor(d, obs);
    assert.ok(m.order.length > 0, `empty frame at ${d}`);
    assert.ok(m.body > 0 || m.ink > 0, `hole at ${d}`);
    if (m.ink > 0 && m.body > 0) assert.equal(m.order[0], 'density', `density is painted first at ${d}`);
  }
  const leaving = markFor(INTEREST.near + 1, obs);
  assert.ok(leaving.body > 0 && leaving.ink > 0, 'just outside near, the body is still up and the disc is on');
  assert.equal(leaving.order[0], 'density');
  const far = markFor(INTEREST.mid + 5, obs);
  assert.equal(far.body, 0);
  assert.equal(far.density, 1);
  assert.equal(far.kind, 'density');
  const herd = markFor((INTEREST.near + INTEREST.mid) / 2, obs);
  assert.equal(herd.kind, 'herd');
  const book = accountShares([10, 80, 150], obs);
  assert.equal(book.population, 3);
  assert.ok(Math.abs(book.individuals + book.density - 3) < 1e-9);
});

test('a faster scale folds a near animal, and the scale names are the existing eight', () => {
  assert.deepEqual([...OBSERVATION_SCALES], ['immediate', 'behavioral', 'ecological', 'seasonal', 'generational', 'evolutionary', 'geological', 'planetary']);
  const herd = resolveObservation('immediate', 20);
  const near = markFor(10, herd);
  assert.equal(near.body, 0);
  assert.equal(near.density, 1);
  assert.equal(near.kind, 'herd');
  const mid = resolveObservation('immediate', 10);
  const fading = animalShares(10, mid);
  assert.ok(fading.body > 0 && fading.density > 0, 'inside the 8×–12× band both pictures are up');
  assert.ok(Math.abs(fading.body + fading.density - 1) < 1e-9);
  const eco = markFor(10, resolveObservation('immediate', 2000));
  assert.equal(eco.kind, 'density');
  const range = markFor(10, resolveObservation('immediate', 1e10));
  assert.equal(range.kind, 'range');
  const src = readFileSync(new URL('../src/core/coarse.ts', import.meta.url), 'utf8');
  assert.equal(src.includes('TIME_LEVELS'), false);
  assert.equal(src.includes('OBSERVATION_SCALES ='), false);
});

test('the coarse step eases a folded count toward the published density and does not touch individuals', () => {
  assert.equal(DEER_PER_KM2, 1);
  assert.ok(Math.abs(wolfPerKm2() - 0.04) < 1e-12);
  assert.equal(coarseStep(0, K.julian_year_s, 'deer'), 0);
  assert.equal(coarseStep(5, 0, 'deer'), 5);
  const year = coarseStep(5, K.julian_year_s, 'deer');
  assert.ok(year < 5 && year > DEER_PER_KM2, `after a year ${year} is between the start and 1/km²`);
  const settled = coarseStep(5, K.julian_year_s * 80, 'deer');
  assert.ok(Math.abs(settled - DEER_PER_KM2) < 1e-3, `settled ${settled}`);
  const wolves = coarseStep(2, K.julian_year_s * 80, 'wolf');
  assert.ok(Math.abs(wolves - wolfPerKm2()) < 1e-4);

  const w = createWorld({ seed: 3 });
  const player = createAnimal(w, 'wolf', { x: 0, z: 0 }, { controlled: true, energy: 40 });
  const farHares = [1, 2, 3].map(i => createAnimal(w, 'hare', { x: 200 + i, z: 10 }, { energy: 60 + i }));
  for (const h of farHares) { h.needs = { water: 80, rest: 70 }; }
  const nearHare = createAnimal(w, 'hare', { x: 5, z: 0 }, { energy: 55 });
  const before = w.animals.length;
  const folded = demoteFar(w, { x: 0, z: 0 }, immediate());
  const fieldCount = folded.field.reduce((s, c) => s + c.count, 0);
  assert.equal(folded.individuals + fieldCount, before);
  assert.equal(fieldCount, 3);
  assert.equal(folded.individuals, 2);
  assert.ok(w.animals.includes(player) && w.animals.includes(nearHare));
  assert.ok(farHares.every(h => !w.animals.includes(h)));
  assert.equal(folded.field.length, 1);
  assert.ok(Math.abs(folded.field[0].energy - (61 + 62 + 63) / 3) < 1e-9);
  assert.equal(folded.field[0].water, 80);
  const stepped = coarseStep(folded.field[0].count, 0, 'deer');
  assert.equal(folded.individuals + stepped, before);
  const back = promoteField(w, { ...folded.field[0], count: stepped });
  assert.equal(back.bodies + back.remainder + folded.individuals, before);
  assert.equal(w.animals.filter(a => a.species === 'hare').length, 1 + back.bodies);
  const restored = w.animals.filter(a => a.species === 'hare' && a !== nearHare);
  assert.ok(restored.every(a => a.energy === folded.field[0].energy && a.needs.water === 80));
});

test('the scene paints the density disc before it fades the body', () => {
  const scene = readFileSync(new URL('../src/render/buildScene.ts', import.meta.url), 'utf8');
  const syncAt = scene.indexOf('density.sync(');
  const bodyAt = scene.indexOf('setBodyShare(');
  assert.ok(syncAt > 0 && bodyAt > syncAt);
  const density = readFileSync(new URL('../src/render/animalDensity.ts', import.meta.url), 'utf8');
  assert.match(density, /gl_PointCoord/);
  assert.match(density, /T-0070/);
});
